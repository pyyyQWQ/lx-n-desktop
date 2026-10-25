import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/songList/action'
import { listDetailInfo } from '@renderer/store/songList/state'
import { playSongListDetail } from './action'
import { consumePendingScroll, pendingScrollIndex } from './scrollState'

export default () => {
  const listRef = ref<any>(null)

  /**
   * 列表加载完成后的收尾：有定位目标就滚到目标行，否则维持原有「回到顶部」。
   * 定位另有轮询兜底（见 index.vue 的 startScrollRetry）：
   * 命中缓存时 getAndSetListDetail 会直接 return，根本不会走到这里的 .then。
   */
  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    await getAndSetListDetail(id, source, page, refresh).then(() => {
      setTimeout(() => {
        if (!listRef.value) return
        if (consumePendingScroll(() => listRef.value, () => listDetailInfo.list.length)) return
        // 无待定位目标时保持原行为
        if (pendingScrollIndex.value == null) listRef.value.scrollToTop()
      })
    })
  }

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }


  return {
    listRef,
    listDetailInfo,
    getListData,
    handlePlayList,
  }
}
