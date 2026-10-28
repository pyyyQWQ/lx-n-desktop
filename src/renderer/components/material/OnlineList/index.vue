<template>
  <div :class="$style.songList">
    <!-- <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut"> -->
    <div :class="$style.list">
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
              <th class="nobreak" style="width: 24%;">{{ $t('music_singer') }}</th>
              <th class="nobreak" style="width: 27%;">{{ $t('music_album') }}</th>
              <th class="nobreak" style="width: 10%;">{{ $t('music_time') }}</th>
            </tr>
          </thead>
        </table>
      </div>
      <div :class="$style.content">
        <div v-show="!noItem" ref="dom_listContent" :class="$style.content">
          <base-virtualized-list v-if="actionButtonsVisible" ref="listRef" :list="list" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item, index }">
              <div
                class="list-item" :class="[{ selected: rightClickSelectedIndex == index }, { active: selectedList.includes(item) }]"
                @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
              >
                <div class="list-item-cell no-select" :class="$style.numCell" style="flex: 0 0 5%;" @click.stop>
                  <div v-if="isCurrentPlaying(index)" :class="$style.playIcon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                      <use xlink:href="#icon-play-outline" />
                    </svg>
                  </div>
                  <div v-else class="num">{{ index + 1 }}</div>
                </div>
                <div class="list-item-cell auto name">
                  <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                  <span v-if="item.meta._qualitys.master || item.meta._qualitys.atmos_plus || item.meta._qualitys.atmos || item.meta._qualitys.hires" class="no-select badge badge-theme-primary">{{ $t('tag__hires') }}</span>
                  <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                  <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                  <span v-if="sourceTag" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
                </div>
                <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
                <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
                <div class="list-item-cell" style="flex: 0 0 9%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
                <div class="list-item-cell" style="flex: 0 0 16%; padding-left: 0; padding-right: 0;">
                  <material-list-buttons :index="index" :remove-btn="false" :download-btn="assertApiSupport(item.source)" :play-btn="checkApiSource ? assertApiSupport(item.source) : true" @btn-click="handleListBtnClick" />
                </div>
              </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
          <base-virtualized-list v-else ref="listRef" :list="list" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item, index }">
              <div
                class="list-item" :class="[{ selected: rightClickSelectedIndex == index }, { active: selectedList.includes(item) }]"
                @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
              >
                <div class="list-item-cell no-select" :class="$style.numCell" style="flex: 0 0 5%;" @click.stop>
                  <div v-if="isCurrentPlaying(index)" :class="$style.playIcon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                      <use xlink:href="#icon-play-outline" />
                    </svg>
                  </div>
                  <div v-else class="num">{{ index + 1 }}</div>
                </div>
                <div class="list-item-cell auto name">
                  <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                  <span v-if="item.meta._qualitys.master || item.meta._qualitys.atmos_plus || item.meta._qualitys.atmos || item.meta._qualitys.hires" class="no-select badge badge-theme-primary">{{ $t('tag__hires') }}</span>
                  <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                  <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                  <span v-if="sourceTag" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
                </div>
                <div class="list-item-cell" style="flex: 0 0 24%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
                <div class="list-item-cell" style="flex: 0 0 27%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
                <div class="list-item-cell" style="flex: 0 0 10%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
              </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
        </div>
        <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
          <div v-show="noItem" :class="$style.noitem">
            <p v-text="noItem" />
          </div>
        </transition>
      </div>
    </div>
    <!-- </transition> -->
    <!-- <material-flow-btn :show="isShowEditBtn && assertApiSupport(source)" :remove-btn="false" @btn-click="handleFlowBtnClick" /> -->
    <!-- <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" /> -->
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <common-list-add-multiple-modal v-model:show="isShowListAddMultiple" :music-list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { ref } from '@common/utils/vueTools'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useMusicActions from './useMusicActions'
import { appSetting } from '@renderer/store/setting'
import { tempListMeta } from '@renderer/store/list/state'
import { playInfo } from '@renderer/store/player/state'
import { LIST_IDS } from '@common/constants'
export default {
  name: 'MaterialOnlineList',
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    page: {
      type: Number,
      required: true,
    },
    limit: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    sourceTag: {
      type: Boolean,
      default: false,
    },
    noItem: {
      type: String,
      default: '',
    },
    checkApiSource: {
      type: Boolean,
      default: false,
    },
    /**
     * 当前正在播放的来源列表 id（可选）。
     * 传入后，若与 store 中记录的播放来源（tempListMeta.id）一致，
     * 序号列会把当前播放项显示为播放图标。默认 null = 不显示（其他在线列表行为不变）。
     */
    playingListId: {
      type: String,
      default: null,
    },
    /**
     * 当前页之前已省略的行数（分页列表用）。
     * 用于把「页内行号」换算成「全局行号」再与 playInfo.playIndex 比较，
     * 否则第 2 页及以后无法标出正在播放的那首。
     */
    playingIndexOffset: {
      type: Number,
      default: 0,
    },
  },
  emits: ['show-menu', 'play-list', 'togglePage'],
  setup(props, { emit }) {
    const actionButtonsVisible = appSetting['list.actionButtonsVisible']
    const rightClickSelectedIndex = ref(-1)
    const dom_listContent = ref(null)
    const listRef = ref(null)

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
    } = useList({ props, listRef })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ selectedList, props, removeAllSelect, emit })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, props })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, props })

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleDislikeMusic,
    } = useMusicActions({ props })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      props,
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleSearch,
      handleShowMusicAddModal,
      handleOpenMusicDetail,
      handleDislikeMusic,
    })

    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, props.list[index], index)
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
    const handleListBtnClick = ({ action, index }) => {
      switch (action) {
        case 'download':
          handleShowDownloadModal(index, true)
          break
        case 'play':
          void handlePlayMusic(index, true)
          break
        case 'search':
          handleSearch(index)
          break
        case 'listAdd':
          handleShowMusicAddModal(index, true)
          break
      }
    }
    /** 当前滚动位置（用于校验定位是否真的生效）。 */
    const getScrollTop = () => {
      try { return listRef.value?.getScrollTop?.() ?? 0 } catch (_) { return 0 }
    }

    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    /**
     * 滚动到指定行（供外部「定位当前播放」使用）。
     * offset 为负值时向上留出空间，让目标行不贴边。
     */
    const scrollToIndex = (index, offset = -150, animate = false) => {
      if (!listRef.value?.scrollToIndex) return
      // 传入 onScrollEnd 回调，让 VirtualizedList 走「直接设置 scrollTop」分支。
      // 不传回调时它用 scrollTo({behavior:'instant'})，该 behavior 在部分 Chromium 版本
      // 不被识别、会退化为默认行为导致滚动不生效 —— 这正是此前「跳到榜单但不定位」的原因。
      listRef.value.scrollToIndex(index, offset, animate, () => {})
    }

    /**
     * 判断某一行是否为「当前播放」。
     * 仅在外部传入 playingListId、且它与当前播放来源（tempListMeta.id）一致时才生效，
     * 因此不会影响排行榜/搜索等未传入该属性的在线列表。
     */
    const isCurrentPlaying = index => {
      if (!props.playingListId) return false
      if (tempListMeta.id !== props.playingListId) return false
      return playInfo.playerListId === LIST_IDS.TEMP && playInfo.playIndex === (index + (props.playingIndexOffset || 0))
    }

    return {
      listItemHeight,
      handleListItemClick,
      selectedList,
      handleListItemRightClick,
      removeAllSelect,
      handleListBtnClick,
      rightClickSelectedIndex,
      dom_listContent,
      listRef,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,
      scrollToIndex,
      getScrollTop,
      actionButtonsVisible,

      isCurrentPlaying,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
// 序号列：作为播放图标的定位基准（缺失会导致图标跑到别处、序号位置空白）。
// 注意用独立类名 numCell，避免与全局 .num / layout.less 中的同名类冲突被覆盖。
.numCell {
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
  opacity: 0.7;
}
.songList {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

.list {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  font-size: 14px;
}

.content {
  flex: auto;
  min-height: 0;
  position: relative;
  height: 100%;
}

.pagination {
  text-align: center;
  padding: 15px 0;
  // left: 50%;
  // transform: translateX(-50%);
}
.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  // background-color: var(--color-000);

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

</style>
