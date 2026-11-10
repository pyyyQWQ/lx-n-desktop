<template>
  <div :class="$style.list">
    <!-- 内联过滤条：输入即刻过滤下方列表，不清空选择、不改原始下标 -->
    <div :class="$style.filterBar">
      <div :class="$style.filterInputWrap">
        <svg :class="$style.filterIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" space="preserve">
          <use xlink:href="#icon-search" />
        </svg>
        <input
          ref="dom_filterInput" v-model="filterKeyword" :class="[$style.filterInput, 'ignore-esc']"
          :placeholder="$t('list__filter_placeholder')" type="text" spellcheck="false"
          @keydown.esc.prevent="handleClearFilter"
        >
        <button v-if="isFiltering" :class="$style.filterClear" :aria-label="$t('list__filter_clear')" @click="handleClearFilter">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 212.982 212.982" space="preserve">
            <use xlink:href="#icon-delete" />
          </svg>
        </button>
      </div>
      <span v-if="isFiltering" :class="$style.filterCount">
        {{ $t('list__filter_count', { total: list.length, count: displayIndices.length }) }}
      </span>
    </div>
    <div class="thead">
      <table>
        <thead>
          <tr v-if="actionButtonsVisible">
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak">{{ $t('music_name') }}</th>
            <th class="nobreak" style="width: 22%;">{{ $t('music_singer') }}</th>
            <th class="nobreak" style="width: 22%;">{{ $t('music_album') }}</th>
            <th class="nobreak" style="width: 9%;">{{ $t('music_time') }}</th>
            <th class="nobreak" style="width: 16%;">{{ $t('action') }}</th>
          </tr>
          <tr v-else>
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak">{{ $t('music_name') }}</th>
            <th class="nobreak" style="width: 25%;">{{ $t('music_singer') }}</th>
            <th class="nobreak" style="width: 25%;">{{ $t('music_album') }}</th>
            <th class="nobreak" style="width: 9%;">{{ $t('music_time') }}</th>
            </tr>
          </thead>
      </table>
    </div>
    <div v-show="displayList.length" ref="dom_listContent" :class="$style.content">
      <base-virtualized-list
        v-if="actionButtonsVisible" ref="listRef" v-slot="{ item, index }" :list="displayList" key-name="id"
        :item-height="listItemHeight" container-class="scroll" content-class="list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <div
          class="list-item" :class="[{ [$style.active]: playerInfo.isPlayList && playerInfo.playIndex === displayIndices[index] }, { selected: selectedIndex == displayIndices[index] || rightClickSelectedIndex == displayIndices[index] }, { active: selectedList.includes(item) }, { disabled: !assertApiSupport(item.source) }]"
          @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
        >
          <div class="list-item-cell no-select" :class="$style.num" style="flex: 0 0 5%;">
            <transition name="play-active">
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex === displayIndices[index]" :class="$style.playIcon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-play-outline" />
                </svg>
              </div>
              <!-- 过滤时显示原始序号，方便对照真实列表 -->
              <div v-else class="num">{{ displayIndices[index] + 1 }}</div>
            </transition>
          </div>
          <div class="list-item-cell auto name" :aria-label="item.name">
            <span class="select name">{{ item.name }}</span>
            <span v-if="isShowSource" class="no-select label-source">{{ item.source }}</span>
          </div>
          <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 9%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
          <div class="list-item-cell" :class="$style.actionCell" style="flex: 0 0 16%; padding-left: 0; padding-right: 0;">
            <!-- 心形占据原「下载」按钮的位置；下载入口保留在右键菜单中 -->
            <material-wy-like-btn :music-info="item" />
            <material-list-buttons :index="index" :download-btn="false" @btn-click="handleListBtnClick" />
          </div>
        </div>
      </base-virtualized-list>
      <base-virtualized-list
        v-else ref="listRef" v-slot="{ item, index }" :list="displayList" key-name="id"
        :item-height="listItemHeight" container-class="scroll" content-class="list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <div
          class="list-item"
          :class="[{ [$style.active]: playerInfo.isPlayList && playerInfo.playIndex === displayIndices[index] }, { selected: selectedIndex == displayIndices[index] || rightClickSelectedIndex == displayIndices[index] }, { active: selectedList.includes(item) }, { disabled: !assertApiSupport(item.source) }]"
          @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
        >
          <div class="list-item-cell no-select" :class="$style.num" style="flex: 0 0 5%;">
            <transition name="play-active">
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex === displayIndices[index]" :class="$style.playIcon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-play-outline" />
                </svg>
              </div>
              <div v-else class="num">{{ displayIndices[index] + 1 }}</div>
            </transition>
          </div>
          <div class="list-item-cell auto name">
            <span class="select name" :aria-label="item.name">{{ item.name }}</span>
            <span v-if="isShowSource" class="no-select label-source">{{ item.source }}</span>
          </div>
          <div class="list-item-cell" style="flex: 0 0 25%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 25%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 9%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
        </div>
      </base-virtualized-list>
    </div>
    <div v-show="!displayList.length" :class="$style.noItem">
      <p v-text="isFiltering ? $t('list__filter_empty') : $t('no_item')" />
    </div>
    <common-list-add-modal
      v-model:show="isShowListAdd" :is-move="isMove" :from-list-id="listId"
      :music-info="selectedAddMusicInfo" :exclude-list-id="excludeListIds" teleport="#view"
    />
    <common-list-add-multiple-modal
      v-model:show="isShowListAddMultiple" :from-list-id="listId"
      :is-move="isMoveMultiple" :music-list="selectedList" :exclude-list-id="excludeListIds" teleport="#view" @confirm="removeAllSelect"
    />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" :list-id="listId" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" :list-id="listId" @confirm="removeAllSelect" />
    <search-list :list="list" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <music-sort-modal v-model:show="isShowMusicSortModal" :music-info="selectedSortMusicInfo" :selected-num="selectedNum" @confirm="sortMusic" />
    <music-toggle-modal v-model:show="isShowMusicToggleModal" :music-info="selectedToggleMusicInfo" @toggle="toggleSource" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { ref, computed, watch, nextTick } from '@common/utils/vueTools'
import { filterMusicIndices } from '@common/utils/listFilter'
import SearchList from './components/SearchList.vue'
import MusicSortModal from './components/MusicSortModal.vue'
import MusicToggleModal from './components/MusicToggleModal.vue'
import useListInfo from './useListInfo'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useSort from './useSort'
import useMusicActions from './useMusicActions'
import useSearch from './useSearch'
import useListScroll from './useListScroll'
import useMusicToggle from './useMusicToggle'
import { appSetting } from '@renderer/store/setting'
export default {
  name: 'MusicList',
  components: {
    SearchList,
    MusicSortModal,
    MusicToggleModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
  },
  emits: ['show-menu'],
  setup(props, { emit }) {
    const actionButtonsVisible = appSetting['list.actionButtonsVisible']

    let scrollIndex = null
    let isAnimation = false
    const handleRestoreScroll = (_scrollIndex, _isAnimation) => {
      scrollIndex = _scrollIndex
      isAnimation = _isAnimation
      if (isAnimation) void restoreScroll(scrollIndex, isAnimation)
      // console.log('handleRestoreScroll', scrollIndex, isAnimation)
    }
    const onLoadedList = () => {
      // console.log('restoreScroll', scrollIndex, isAnimation)
      void restoreScroll(scrollIndex, isAnimation)
    }

    const {
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      list,
      playerInfo,
      setSelectedIndex,
      isShowSource,
      excludeListIds,
    } = useListInfo({ props, onLoadedList })

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
    } = useList({ listRef, list })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ props, selectedList, list, removeAllSelect })

    const {
      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
    } = useMusicAdd({ selectedList, list })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, list })

    const {
      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      handleShowSortModal,
      sortMusic,
    } = useSort({ props, list, selectedList, removeAllSelect })

    const {
      handleShowMusicToggleModal,
      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    } = useMusicToggle(props, list)

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    } = useMusicActions({ props, list, removeAllSelect, selectedList })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleShowMusicToggleModal,
      handleSearch,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
      handleShowSortModal,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    })

    const {
      isShowSearchBar,
      searchList,
      handleMusicSearchAction,
    } = useSearch({
      setSelectedIndex,
      handlePlayMusic,
      listRef,
    })

    const { saveListPosition, restoreScroll } = useListScroll({ props, listRef, list, handleRestoreScroll })

    // ==== 内联过滤 ====
    //
    // 设计要点：**只过滤渲染层**。
    // `list` 保持原始完整数组不变，因为下游的播放、右键菜单、批量选择、
    // 拖拽排序、以及 playerInfo.playIndex 全都基于「原始下标」。
    // 若把过滤后的数组直接替换掉 list，这些下标会全部错位。
    // 因此：displayIndices 记录「显示第 i 行 → 原始下标」的映射，
    // 列表渲染 displayList（过滤后的对象数组），
    // 所有交互回调收到的是显示下标，进入业务前先经 displayIndices 换回原始下标。
    const filterKeyword = ref('')
    const dom_filterInput = ref(null)

    const displayIndices = computed(() => filterMusicIndices(list.value, filterKeyword.value))
    const displayList = computed(() => displayIndices.value.map(i => list.value[i]))
    const isFiltering = computed(() => filterKeyword.value.trim().length > 0)

    /** 显示下标 → 原始下标（越界时原样返回，交给下层自行判空） */
    const toSourceIndex = (displayIndex) => {
      const map = displayIndices.value
      if (displayIndex < 0 || displayIndex >= map.length) return displayIndex
      return map[displayIndex]
    }

    const handleClearFilter = () => {
      filterKeyword.value = ''
      // 清空后回到顶部，避免停在过滤后的滚动位置
      void nextTick(() => {
        listRef.value?.scrollTo?.(0, false)
      })
    }

    // 过滤条件变化时重置滚动位置：过滤后行数变少，原来的 scrollTop 可能越界
    watch(filterKeyword, () => {
      removeAllSelect()
      rightClickSelectedIndex.value = -1
      void nextTick(() => {
        listRef.value?.scrollTo?.(0, false)
      })
    })

    // 切换列表时清空过滤关键词。
    // 否则从 A 列表过滤后切到 B 列表，会看到「被过滤过的 B」，
    // 用户容易误以为歌曲丢失。
    watch(() => props.listId, () => {
      if (filterKeyword.value) {
        filterKeyword.value = ''
      }
    })


    const handleListItemClick = (event, displayIndex) => {
      if (rightClickSelectedIndex.value > -1) return
      const index = toSourceIndex(displayIndex)
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, displayIndex) => {
      const index = toSourceIndex(displayIndex)
      rightClickSelectedIndex.value = index
      showMenu(event, list.value[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }
    const handleListRightClick = (event) => {
      if (!event.target.classList.contains('select')) return
      event.stopImmediatePropagation()
      let classList = dom_listContent.value.classList
      classList.add('copying')
      window.requestAnimationFrame(() => {
        let str = window.getSelection().toString()
        classList.remove('copying')
        str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
        if (!str.length) return
        clipboardWriteText(str)
      })
    }
    const handleListBtnClick = ({ action, index: displayIndex }) => {
      // 行内按钮传来的也是显示下标，需换回原始下标
      const index = toSourceIndex(displayIndex)
      switch (action) {
        case 'download':
          handleShowDownloadModal(index, true)
          break
        case 'play':
          handlePlayMusic(index, true)
          break
        case 'search':
          handleSearch(index)
          break
        case 'listAdd':
          handleShowMusicAddModal(index, true)
          break
      }
    }
    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    return {
      listItemHeight,
      handleListItemClick,
      selectedList,
      handleListItemRightClick,
      removeAllSelect,
      handleListBtnClick,
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      excludeListIds,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,

      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      sortMusic,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,

      isShowSearchBar,
      searchList,
      handleMusicSearchAction,

      list,
      playerInfo,

      // 内联过滤（只影响渲染层，list 本身保持原样）
      filterKeyword,
      dom_filterInput,
      displayList,
      displayIndices,
      isFiltering,
      handleClearFilter,

      saveListPosition,
      isShowSource,
      handleRestoreScroll,

      actionButtonsVisible,

      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    }
  },
}
</script>


<style lang="less" module>

// 操作列：心形（可选）+ 耳机/加号/下载按钮并排显示。
// 注意：.list-item-cell 带 overflow:hidden（.mixin-ellipsis-1），
// 若把心形放进独立的窄列（如 4%）会被裁掉右侧；放进本列与按钮同排即可避免裁剪，
// 且与其它按钮天然处于同一基线。
.actionCell {
  display: flex;
  align-items: center;
}

// ==== 内联过滤条 ====
// 高度固定，不挤压下方虚拟列表；与表头左对齐。
.filterBar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 2px;
}

.filterInputWrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 240px;
  height: 26px;
  border-radius: 13px;
  background-color: var(--color-primary-light-600-alpha-700);
  border: 1px solid transparent;
  transition: border-color .2s ease, background-color .2s ease;

  &:hover {
    background-color: var(--color-primary-light-500-alpha-600);
  }
  &:focus-within {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light-700-alpha-600);
  }
}

.filterIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-left: 9px;
  opacity: .55;
  color: var(--color-font);
  fill: currentColor;
}

.filterInput {
  flex: auto;
  min-width: 0;
  height: 100%;
  padding: 0 4px 0 6px;
  border: none;
  outline: none;
  background-color: transparent;
  font-size: 12.5px;
  color: var(--color-font);

  &::placeholder {
    color: var(--color-font-label);
    font-size: .96em;
  }
}

.filterClear {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 100%;
  margin-right: 4px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: transparent;
  cursor: pointer;
  color: var(--color-font-label);
  opacity: .75;
  transition: opacity .2s ease, background-color .2s ease;

  svg {
    width: 9px;
    height: 9px;
    fill: currentColor;
  }
  &:hover {
    opacity: 1;
    background-color: var(--color-primary-dark-100-alpha-700);
  }
}

.filterCount {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@import '@renderer/assets/styles/layout.less';

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;

  :global(.list-item) {
    &.active {
      color: var(--color-button-font);
    }
  }
  :global {
    .label-source {
      color: var(--color-primary);
      padding: 5px;
      font-size: .8em;
      line-height: 1.2;
      opacity: .75;
      display: inline-block;
    }
  }
}
.num {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.playIcon {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--color-button-font);
  opacity: .7;
}
.content {
  min-height: 0;
  font-size: 14px;
  display: flex;
  flex-flow: column nowrap;
  flex: auto;
}

.noItem {
  position: relative;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

</style>
