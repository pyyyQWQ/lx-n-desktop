// 网易云「喜欢」状态的响应式读取与切换。
//
// 对应移动改良版的 `useIsWyLiked`（mobile `src/store/user/hook.ts`）+ `handleLikeMusic`
// （mobile `src/components/OnlineList/listAction.ts`）。
//
// 与手机版的差异说明：
//   手机版用 `state_event` 事件总线通知「喜欢列表已变化」；
//   桌面版已有同名事件 `window.app_event.wyLikedListChanged()`（见 store/user/action.ts），
//   但此前没有任何监听方。这里补上监听，让列表里的心形图标能实时刷新。
//
// 注意：`wyLikedSongIds` 是 `shallowReactive<Set>`，Vue 无法追踪 `Set.has()` 的变化，
// 因此这里用「版本号 + 事件」的方式触发重算，而不是直接依赖 Set 本身。

import { computed, onMounted, ref } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { wyLikedSongIds, wyUid } from '@renderer/store/user/state'
import { addWyLikedSong, removeWyLikedSong, setWyLikedSongs } from '@renderer/store/user/action'
import wyUserApi from '@renderer/utils/musicSdk/wy/user'
import { toast } from '@renderer/plugins/Tips/toast'

/**
 * 喜欢状态的版本号。
 * 每次 `wyLikedListChanged` 事件触发时自增，驱动依赖它的 computed 重新求值。
 */
const likedVersion = ref(0)

let listening = false
const bumpVersion = () => { likedVersion.value++ }
const onLikedChanged = () => { bumpVersion() }

/**
 * 全局只注册一次监听（避免每个列表项都挂一遍）。
 */
const ensureListener = () => {
  if (listening) return
  listening = true
  const ev = window.app_event
  if (ev && typeof ev.on === 'function') {
    ev.on('wyLikedListChanged', onLikedChanged)
  }
}

/**
 * 判断某首网易云歌曲是否已被喜欢。
 * @param songId 歌曲 id（songId / songmid 均可）
 * @returns 响应式布尔值
 */
export const useIsWyLiked = (songId: () => string | number | null | undefined) => {
  ensureListener()
  return computed(() => {
    // 依赖版本号，保证喜欢列表变化后能重新求值
    void likedVersion.value
    const id = songId()
    if (id == null || id === '') return false
    return wyLikedSongIds.has(String(id))
  })
}

/**
 * 切换某首网易云歌曲的喜欢状态。
 *
 * 复用桌面版已有的 `useMenu.js` 逻辑：乐观更新 → 调接口 → 成功后从服务端同步真实集合 →
 * 失败则回滚。移动改良版的行为与此一致。
 *
 * @param songId 歌曲 id
 * @param currentLiked 当前是否已喜欢（由调用方传入，避免重复读取）
 * @returns 操作是否成功
 */
export const toggleWyLike = async(songId: string | number, currentLiked: boolean): Promise<boolean> => {
  const target = !currentLiked
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
      } catch (_) { /* 同步失败不影响主流程 */ }
    }
    toast(target ? '喜欢成功' : '已取消喜欢')
    return true
  } catch (error) {
    // 失败回滚乐观更新
    if (target) removeWyLikedSong(songId)
    else addWyLikedSong(songId)
    const msg = error instanceof Error ? error.message : String(error)
    toast(`操作失败：${msg}`)
    return false
  }
}

/**
 * 供组件使用：组件挂载时确保监听已注册。
 * （`ensureListener` 本身幂等，这里只是语义化封装）
 */
export const useWyLike = () => {
  onMounted(() => { ensureListener() })
}
