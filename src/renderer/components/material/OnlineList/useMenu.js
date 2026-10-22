import { computed, ref, reactive, nextTick } from '@common/utils/vueTools'
import musicSdk from '@renderer/utils/musicSdk'
import { useI18n } from '@renderer/plugins/i18n'
import { hasDislike } from '@renderer/core/dislikeList'
import wyUserApi from '@renderer/utils/musicSdk/wy/user'
import { wyLoginStatus, wyLikedSongIds, wyUid } from '@renderer/store/user/state'
import { addWyLikedSong, removeWyLikedSong, setWyLikedSongs } from '@renderer/store/user/action'
import { appSetting } from '@renderer/store/setting'
import { toast } from '@renderer/plugins/Tips/toast'

export default ({
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
}) => {
  const itemMenuControl = reactive({
    play: true,
    addTo: true,
    playLater: true,
    download: true,
    search: true,
    sourceDetail: true,
    dislike: true,
    wyLike: false,
  })
  const t = useI18n()
  const menuLocation = reactive({ x: 0, y: 0 })
  const isShowItemMenu = ref(false)
  const currentSongId = ref(null)

  // 仅网易云源、且已登录时显示「喜欢/取消喜欢」
  const currentIsWyLiked = ref(false)

  const menus = computed(() => {
    const base = [
      {
        name: t('list__play'),
        action: 'play',
        disabled: !itemMenuControl.play,
      },
      {
        name: t('list__download'),
        action: 'download',
        disabled: !itemMenuControl.download,
      },
      {
        name: t('list__play_later'),
        action: 'playLater',
        disabled: !itemMenuControl.playLater,
      },
      {
        name: t('list__search'),
        action: 'search',
        disabled: !itemMenuControl.search,
      },
      {
        name: t('list__add_to'),
        action: 'addTo',
        disabled: !itemMenuControl.addTo,
      },
      {
        name: t('list__source_detail'),
        action: 'sourceDetail',
        disabled: !itemMenuControl.sourceDetail,
      },
      {
        name: t('list__dislike'),
        action: 'dislike',
        disabled: !itemMenuControl.dislike,
      },
    ]

    const wyLikeItem = {
      name: currentIsWyLiked.value ? t('wy_login__unlike') : t('wy_login__like'),
      action: 'wyLike',
      disabled: !itemMenuControl.wyLike,
    }

    return itemMenuControl.wyLike ? [wyLikeItem, ...base] : base
  })

  const showMenu = (event, musicInfo) => {
    itemMenuControl.sourceDetail = !!musicSdk[musicInfo.source]?.getMusicDetailPageUrl
    itemMenuControl.download = assertApiSupport(musicInfo.source)
    itemMenuControl.dislike = !hasDislike(musicInfo)

    // 网易云源 + 已登录才启用喜欢操作。
    // 仅当拿到真实的网易云 songId（数值型）时才可用，避免把 "wy_xxx" 之类伪造 id 发给接口。
    const rawSongId = musicInfo.source == 'wy' ? musicInfo.meta?.songId : null
    const isValidSongId = rawSongId != null && /^\d+$/.test(String(rawSongId))
    const isWy = musicInfo.source == 'wy' && wyLoginStatus.value == 'logged-in' && !!isValidSongId
    itemMenuControl.wyLike = isWy
    const wySongId = isWy ? String(rawSongId) : ''
    currentSongId.value = wySongId || null
    currentIsWyLiked.value = isWy && !!wySongId && wyLikedSongIds.has(wySongId)

    if (props.checkApiSource) {
      itemMenuControl.playLater =
      itemMenuControl.play =
        itemMenuControl.download
    }

    menuLocation.x = event.pageX
    menuLocation.y = event.pageY

    if (isShowItemMenu.value) return
    emit('show-menu')
    nextTick(() => {
      isShowItemMenu.value = true
    })
  }

  const hideMenu = () => {
    isShowItemMenu.value = false
  }

  const handleWyLike = async() => {
    const songId = currentSongId.value
    if (!songId) return
    const target = !currentIsWyLiked.value
    const uid = wyUid.value
    const cookie = appSetting['common.wy_cookie'] || ''
    // 乐观更新，先让 UI 即时响应
    if (target) addWyLikedSong(songId)
    else removeWyLikedSong(songId)
    try {
      await wyUserApi.likeSong(songId, target)
      // 服务端成功后，从真实接口同步一次喜欢的 id 集合，确保本地状态与网易云一致
      if (uid && cookie) {
        try {
          const ids = await wyUserApi.getLikedSongIds(uid, cookie)
          setWyLikedSongs(ids)
        } catch (_) {}
      }
      toast(target ? t('wy_login__like_success') : t('wy_login__unlike_success'))
    } catch (error) {
      // 失败回滚乐观更新
      if (target) removeWyLikedSong(songId)
      else addWyLikedSong(songId)
      const msg = error instanceof Error ? error.message : String(error)
      toast(t('wy_login__like_failed', { message: msg }))
      console.error('[wyLike] failed:', msg)
    }
  }

  const menuClick = (action, index) => {
    // console.log(action)
    hideMenu()
    if (!action) return

    switch (action.action) {
      case 'download':
        handleShowDownloadModal(index)
        break
      case 'play':
        handlePlayMusic(index)
        break
      case 'playLater':
        handlePlayMusicLater(index)
        break
      case 'search':
        handleSearch(index)
        break
      case 'addTo':
        handleShowMusicAddModal(index)
        break
      case 'sourceDetail':
        handleOpenMusicDetail(index)
        break
      case 'dislike':
        handleDislikeMusic(index)
        break
      case 'wyLike':
        // 乐观更新 + 失败回滚已在 handleWyLike 内完成；.catch 满足 no-floating-promises
        handleWyLike().catch(() => {})
        break
    }
  }

  return {
    menus,
    menuLocation,
    isShowItemMenu,
    showMenu,
    menuClick,
  }
}
