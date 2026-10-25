<template>
  <div :class="$style.container">
    <material-online-list
      ref="listRef"
      :page="listDetailInfo.page"
      :limit="listDetailInfo.limit"
      :total="listDetailInfo.total"
      :list="listDetailInfo.list"
      :no-item="listDetailInfo.noItemLabel"
      :playing-list-id="playingListId"
      :playing-index-offset="playingIndexOffset"
      @show-menu="hideListsMenu"
      @play-list="handlePlayList"
      @toggle-page="togglePage"
    />
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, computed } from '@common/utils/vueTools'
import useList from './useList'
import { pendingScrollIndex, safeScrollToIndex, toPageAndRow } from '../scrollState'


const props = defineProps<{
  source: LX.OnlineSource
  boardId?: string
}>()

const emit = defineEmits(['show-menu'])

const {
  listRef,
  listDetailInfo,
  getList,
  handlePlayList,
} = useList()

// 播放标识：播放排行榜歌曲时 tempListMeta.id 记为 `board__<boardId>`，
// 因此这里用同样的格式传给列表组件，才能匹配到「当前播放」。
const playingListId = computed(() => props.boardId ? `board__${props.boardId}` : null)
// 当前页之前的行数：把页内行号换算成全局行号，供播放标识匹配
const playingIndexOffset = computed(() => Math.max(((listDetailInfo.page || 1) - 1) * (listDetailInfo.limit || 30), 0))

watch(() => props.boardId, (boardId) => {
  if (!boardId) return
  getList(boardId, 1)
}, {
  immediate: true,
})

/**
 * 「定位当前播放」的消费循环（支持跨页）。
 *
 * 两个必须处理的现实情况：
 *  1. playInfo.playIndex 是**全局行号**（完整播放队列里查到的下标），可能是几百；
 *     而页面每页只渲染 30 首。直接用全局行号滚当前页必然越界 → 表现为「只回到顶部」。
 *     因此先换算成「第几页 + 页内第几行」，必要时先切到那一页再滚。
 *  2. 同一榜单二次进入时 getAndSetListDetail 会命中缓存直接 return，
 *     数据加载回调不会执行，所以这里用短间隔轮询兜底。
 */
let scrollTimer: number | null = null
let scrollTries = 0
// 已经为本次定位切换过页码，避免反复切页
let scrollPageSwitched = false

const stopScrollRetry = () => {
  if (scrollTimer != null) {
    clearInterval(scrollTimer)
    scrollTimer = null
  }
}

const startScrollRetry = () => {
  if (pendingScrollIndex.value == null) return
  if (scrollTimer != null) return
  scrollTries = 0
  scrollPageSwitched = false

  const tick = () => {
    scrollTries++
    const globalIndex = pendingScrollIndex.value
    if (globalIndex == null) {
      stopScrollRetry()
      return
    }
    // 等列表数据就绪
    const pageSize = listDetailInfo.limit || 30
    if (!listDetailInfo.list.length) {
      if (scrollTries > 30) stopScrollRetry()
      return
    }

    const { page, rowIndex } = toPageAndRow(globalIndex, pageSize)

    // 目标不在当前页：先切页（只切一次，切页后重新加载会再次进入 tick）
    if (listDetailInfo.page !== page) {
      if (!scrollPageSwitched) {
        scrollPageSwitched = true
        getList(listDetailInfo.id, page)
      }
      if (scrollTries > 60) stopScrollRetry()
      return
    }

    // 已在对的页：滚到页内行
    const ok = safeScrollToIndex(listRef.value, rowIndex, listDetailInfo.list.length)
    if (ok) {
      pendingScrollIndex.value = null
      stopScrollRetry()
    } else if (scrollTries > 60) {
      stopScrollRetry()
    }
  }

  // 先立即试一次，再每 100ms 重试
  tick()
  if (pendingScrollIndex.value != null && scrollTimer == null) {
    scrollTimer = window.setInterval(tick, 100)
  }
}

onMounted(startScrollRetry)

// 路由更新（同一组件复用）时重新开始
watch(pendingScrollIndex, () => {
  startScrollRetry()
})

onBeforeUnmount(stopScrollRetry)


const hideListsMenu = () => {
  emit('show-menu')
}

const togglePage = (page: number) => {
  getList(listDetailInfo.id, page)
}

const hideMenu = () => {
  listRef.value.handleMenuClick()
}

defineExpose({ hideMenu })


</script>


<style lang="less" module>
.container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
}

</style>
