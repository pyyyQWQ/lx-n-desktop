import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'
import { pendingScrollIndex, safeScrollToIndex } from '../scrollState'

export default () => {
  const listRef = ref<any>(null)

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
  }

  const getList = (id: string, page: number) => {
    void getAndSetListDetail(id, page).then(() => {
      setTimeout(() => {
        if (!listRef.value) return
        // 「定位当前播放」：有待定位行时滚到该行（一次性消费），否则维持原有「回到顶部」
        if (pendingScrollIndex.value != null) {
          const target = pendingScrollIndex.value
          pendingScrollIndex.value = null
          safeScrollToIndex(listRef.value, target, listDetailInfo.list.length)
        } else {
          listRef.value.scrollToTop()
        }
      })
    })
  }

  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
  }
}
