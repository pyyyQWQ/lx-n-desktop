import { wyLoginStatus, wyUid, wyLikedSongIds, wyUserInfo, isWyVerifying, wyUserDataLoaded, wyPlaylists, wyDailyRecSongs, wyDailyRecPlaylists } from './state'

// 通知 UI 喜欢的歌曲列表已变化
const notifyLikedChanged = () => {
  window.app_event?.wyLikedListChanged?.()
}

/**
 * 清空网易云喜欢列表（退出登录 / 切换账号时调用）。
 */
const clearWyLikedSongs = () => {
  wyLikedSongIds.clear()
  wyPlaylists.splice(0, wyPlaylists.length)
  wyDailyRecSongs.splice(0, wyDailyRecSongs.length)
  wyDailyRecPlaylists.splice(0, wyDailyRecPlaylists.length)
}

/**
 * 清空网易云登录状态（清 Cookie、退出登录或验证失败时调用）。
 * 退出/失效时一并清理与账户相关的业务缓存。
 */
const setWyNotLogin = () => {
  wyLoginStatus.value = 'no-login'
  wyUid.value = null
  clearWyLikedSongs()
  wyUserInfo.nickname = ''
  wyUserInfo.avatarUrl = ''
  wyUserDataLoaded.value = false
  notifyLikedChanged()
}

/**
 * 进入验证中状态。
 */
const setWyVerifying = () => {
  wyLoginStatus.value = 'verifying'
  wyUid.value = null
  isWyVerifying.value = true
}

/**
 * 登录成功，保存 uid、状态与用户信息。
 */
const setWyLoggedIn = (uid: string) => {
  wyUid.value = uid
  wyLoginStatus.value = 'logged-in'
  isWyVerifying.value = false
}

/**
 * 应用启动时，根据是否配置了 Cookie 设置初始状态。
 * - 未配置 Cookie：'not-login'
 * - 配置了 Cookie：'no-login'（等待启动期验证）
 */
const initWyLoginStatus = (hasCookie: boolean) => {
  wyUid.value = null
  wyLoginStatus.value = hasCookie ? 'no-login' : 'not-login'
  clearWyLikedSongs()
  wyUserDataLoaded.value = false
}

/**
 * 登录失效（如请求层 301），Cookie 已失效被清空。
 * 置为未配置状态（not-login），与已清空持久化 Cookie 保持一致，并清理业务缓存。
 */
const setWyLoginExpired = () => {
  wyUid.value = null
  wyLoginStatus.value = 'not-login'
  isWyVerifying.value = false
  clearWyLikedSongs()
  wyUserInfo.nickname = ''
  wyUserInfo.avatarUrl = ''
  wyUserDataLoaded.value = false
  notifyLikedChanged()
}

/**
 * 设置用户资料。
 */
const setWyUserInfo = (info: { nickname?: string; avatarUrl?: string }) => {
  if (info.nickname != null) wyUserInfo.nickname = info.nickname
  if (info.avatarUrl != null) wyUserInfo.avatarUrl = info.avatarUrl
}

/**
 * 覆盖写入喜欢的歌曲 id 集合。
 * @param ids 歌曲 id 列表（数字或字符串均可）
 */
const setWyLikedSongs = (ids: Array<string | number>) => {
  const next = new Set(ids.map(String))
  wyLikedSongIds.clear()
  for (const id of next) wyLikedSongIds.add(id)
  notifyLikedChanged()
}

/**
 * 添加一首歌到喜欢列表（已被请求层确认成功后调用）。
 */
const addWyLikedSong = (songId: string | number) => {
  const strId = String(songId)
  if (wyLikedSongIds.has(strId)) return
  wyLikedSongIds.add(strId)
  notifyLikedChanged()
}

/**
 * 从喜欢列表移除一首歌（已被请求层确认成功后调用）。
 */
const removeWyLikedSong = (songId: string | number) => {
  const strId = String(songId)
  if (!wyLikedSongIds.has(strId)) return
  wyLikedSongIds.delete(strId)
  notifyLikedChanged()
}

/**
 * 设置用户数据加载完成状态。
 */
const setWyUserDataLoaded = (loaded: boolean) => {
  wyUserDataLoaded.value = loaded
}

/**
 * 覆盖写入我的歌单列表（真实接口结果）。
 */
const setWyPlaylists = (playlists: Array<{
  id: string
  userId: number
  name: string
  coverImgUrl: string
  trackCount: number
  description?: string
  playCount?: number
}>) => {
  wyPlaylists.splice(0, wyPlaylists.length, ...playlists)
}

/**
 * 覆盖写入每日推荐歌曲列表（真实接口结果）。
 */
const setWyDailyRecSongs = (songs: LX.Music.MusicInfo[]) => {
  wyDailyRecSongs.splice(0, wyDailyRecSongs.length, ...songs)
}

/**
 * 覆盖写入每日推荐歌单列表（真实接口结果）。
 */
const setWyDailyRecPlaylists = (playlists: Array<{
  id: string
  name: string
  trackCount: number
  coverImgUrl: string
  creator?: string
  playCount?: number
  description?: string
}>) => {
  wyDailyRecPlaylists.splice(0, wyDailyRecPlaylists.length, ...playlists)
}

export {
  setWyNotLogin,
  setWyVerifying,
  setWyLoggedIn,
  setWyLoginExpired,
  initWyLoginStatus,
  setWyUserInfo,
  setWyLikedSongs,
  addWyLikedSong,
  removeWyLikedSong,
  setWyUserDataLoaded,
  setWyPlaylists,
  setWyDailyRecSongs,
  setWyDailyRecPlaylists,
}

export default {
  setWyNotLogin,
  setWyVerifying,
  setWyLoggedIn,
  setWyLoginExpired,
  initWyLoginStatus,
  setWyUserInfo,
  setWyLikedSongs,
  addWyLikedSong,
  removeWyLikedSong,
  setWyUserDataLoaded,
  setWyPlaylists,
  setWyDailyRecSongs,
  setWyDailyRecPlaylists,
}
