<template>
  <div :class="$style.container">
    <div :class="$style.songListHeader">
      <div :class="$style.songListHeaderLeft" :style="{ backgroundImage: 'url('+(picUrl || listDetailInfo.info.img)+')' }">
        <!-- <span v-if="listDetailInfo.info.play_count" :class="$style.playNum">{{ listDetailInfo.info.play_count }}</span> -->
      </div>
      <div :class="$style.songListHeaderMiddle">
        <h3 :title="listDetailInfo.info.name">{{ listDetailInfo.info.name }}</h3>
        <p :title="listDetailInfo.info.desc">{{ listDetailInfo.info.desc }}</p>
      </div>
      <div :class="$style.songListHeaderRight">
        <base-btn
          :class="$style.headerRightBtn"
          :disabled="!!listDetailInfo.noItemLabel"
          @click="playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list)"
        >
          {{ $t('list__play') }}
        </base-btn>
        <base-btn
          :class="$style.headerRightBtn"
          :disabled="!!listDetailInfo.noItemLabel"
          @click="addSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.info.name)"
        >
          {{ $t('list__collect') }}
        </base-btn>
        <base-btn :class="$style.headerRightBtn" @click="handleBack">{{ $t('back') }}</base-btn>
      </div>
    </div>
    <div :class="$style.list">
      <material-online-list
        ref="listRef"
        :page="listDetailInfo.page"
        :limit="listDetailInfo.limit"
        :total="listDetailInfo.total"
        :list="listDetailInfo.list"
        :no-item="listDetailInfo.noItemLabel"
        :playing-list-id="playingListId"
        :playing-index-offset="playingIndexOffset"
        @play-list="handlePlayList"
        @toggle-page="togglePage"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { listDetailInfo } from '@renderer/store/songList/state'
import { setVisibleListDetail } from '@renderer/store/songList/action'
import { useRouter } from '@common/utils/vueRouter'
import { addSongListDetail, playSongListDetail } from './action'
import useList from './useList'
import { setPendingScrollIndex, pendingScrollIndex, safeScrollToIndex, toPageAndRow } from './scrollState'
import useKeyBack from './useKeyBack'


const source = ref<LX.OnlineSource>('kw')
const id = ref<string>('')
const page = ref<number>(1)
const picUrl = ref<string>('')
const refresh = ref<boolean>(false)

interface Query {
  source?: string
  id?: string
  page?: string
  picUrl?: string
  refresh?: 'true'
  fromName?: string
  scrollIndex?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _id = to.query.id
  let _page: string | undefined = to.query.page
  let _picUrl: string | undefined = to.query.picUrl
  let _refresh: 'true' | undefined = to.query.refresh

  if (_source == null || _id == null) {
    if (listDetailInfo.key) {
      _source = listDetailInfo.source
      _id = listDetailInfo.id
      _page = listDetailInfo.page.toString()
      _picUrl = listDetailInfo.info.img
    } else {
      setVisibleListDetail(false)
      next({ path: '/songList/list', query: {} })
      return
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, id: _id, page: _page, picUrl: _picUrl, refresh: _refresh },
    })
    return
  }
  next()
  setVisibleListDetail(true)
  source.value = _source as LX.OnlineSource
  id.value = _id
  page.value = _page ? parseInt(_page) : 1
  picUrl.value = _picUrl ?? ''
  refresh.value = _refresh ? _refresh == 'true' : false
  if (to.query.fromName) window.lx.songListInfo.fromName = to.query.fromName
  // 「定位当前播放」：路由带 scrollIndex 时，等列表加载完成后滚动到该行
  setPendingScrollIndex(to.query.scrollIndex)
}


export default {
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const router = useRouter()

    // 播放标识：从歌单详情播放时 tempListMeta.id 记为 <source>__<listId>，
    // 用同样格式传给列表组件才能匹配「当前播放」。
    const playingListId = computed(() => (source.value && id.value) ? (source.value + '__' + id.value) : null)
    // 当前页之前的行数：把页内行号换算成全局行号，否则第 2 页及以后标不出正在播放的那首
    const playingIndexOffset = computed(() => Math.max(((listDetailInfo.page || 1) - 1) * (listDetailInfo.limit || 30), 0))

    /**
     * 「定位当前播放」的轮询（支持跨页）。
     * playInfo.playIndex 是完整播放队列里的**全局行号**，可能远超当前页条数；
     * 直接用它滚当前页会越界 → 表现为「只回到顶部」。所以先算目标在第几页，必要时切页。
     */
    let scrollTimer: number | null = null
    let scrollTries = 0
    let scrollPageSwitched = false
    const stopScrollRetry = () => {
      if (scrollTimer != null) { clearInterval(scrollTimer); scrollTimer = null }
    }
    const startScrollRetry = () => {
      if (pendingScrollIndex.value == null || scrollTimer != null) return
      scrollTries = 0
      scrollPageSwitched = false
      const tick = () => {
        scrollTries++
        const globalIndex = pendingScrollIndex.value
        if (globalIndex == null) { stopScrollRetry(); return }
        if (!listDetailInfo.list.length) {
          if (scrollTries > 30) stopScrollRetry()
          return
        }
        const pageSize = listDetailInfo.limit || 30
        const { page, rowIndex } = toPageAndRow(globalIndex, pageSize)
        if (listDetailInfo.page !== page) {
          if (!scrollPageSwitched) {
            scrollPageSwitched = true
            void getListData(source.value, id.value, page, false)
          }
          if (scrollTries > 60) stopScrollRetry()
          return
        }
        const ok = safeScrollToIndex(listRef.value, rowIndex, listDetailInfo.list.length)
        if (ok) {
          pendingScrollIndex.value = null
          stopScrollRetry()
        } else if (scrollTries > 60) {
          stopScrollRetry()
        }
      }
      setTimeout(() => {
        tick()
        if (pendingScrollIndex.value != null && scrollTimer == null) scrollTimer = window.setInterval(tick, 100)
      }, 80)
    }
    onMounted(startScrollRetry)
    watch(pendingScrollIndex, startScrollRetry)
    onBeforeUnmount(stopScrollRetry)

    const {
      listRef,
      listDetailInfo,
      getListData,
      handlePlayList,
    } = useList()


    const togglePage = (page: number) => {
      void getListData(source.value, id.value, page, refresh.value)
    }

    const handleBack = () => {
      setVisibleListDetail(false)
      if (window.lx.songListInfo.fromName) void router.replace({ name: window.lx.songListInfo.fromName })
      else router.back()
    }

    useKeyBack(handleBack)

    watch([source, id, page, refresh], async([_source, _id, _page, _refresh]) => {
      if (!_source || !_id) return router.replace({ path: '/songList/list' })
      // console.log(_source, _id, _page, _refresh, picUrl.value)
      // source.value = _source
      // id.value = _id
      // refresh.value = _refresh
      // page.value = _page ?? 1
      void getListData(_source, _id, _page, _refresh)
    }, {
      immediate: true,
    })

    return {
      source,
      id,
      page,
      picUrl,
      listDetailInfo,
      listRef,
      playingListId,
      playingIndexOffset,
      togglePage,
      addSongListDetail,
      playSongListDetail,
      handlePlayList,
      handleBack,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  // position: absolute;
  // left: 0;
  // top: 0;
  // width: 100%;
  // height: 100%;
  display: flex;
  flex-flow: column nowrap;
}

.songListHeader {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  height: 80px;
}
.songListHeaderLeft {
  flex: none;
  margin-left: 15px;
  height: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-position: center;
  background-size: cover;
  opacity: .9;
  box-shadow: 0 0 2px 0 rgba(0,0,0,.2);
}
.playNum {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background-color: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 12px;
  text-align: right;
  .mixin-ellipsis-1();
}

.songListHeaderMiddle {
  flex: auto;
  padding: 2px 7px;
  min-width: 0;
  h3 {
    .mixin-ellipsis-1();
    line-height: 1.2;
    padding-bottom: 5px;
    color: var(--color-font);
  }
  p {
    .mixin-ellipsis(3);
    font-size: 12px;
    line-height: 1.2;
    color: var(--color-font-label);
  }
}
.songListHeaderRight {
  flex: none;
  display: flex;
  align-items: center;
  padding-right: 15px;

  .headerRightBtn {
    border-radius: 0;
    &:first-child {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }
    &:last-child {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
    }
  }
}

.list {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: auto;
  height: 100%;
}
</style>

