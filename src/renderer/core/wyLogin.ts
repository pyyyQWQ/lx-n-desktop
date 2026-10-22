import { appSetting, updateSetting } from '@renderer/store/setting'
import {
  initWyLoginStatus as initStoreWyLoginStatus,
  setWyLoggedIn,
  setWyNotLogin,
  setWyVerifying,
  setWyLoginExpired,
  setWyUserInfo,
  setWyLikedSongs,
  setWyUserDataLoaded,
  setWyPlaylists,
} from '@renderer/store/user/action'
import { isWyVerifying } from '@renderer/store/user/state'
import wyUserApi from '@renderer/utils/musicSdk/wy/user'

/**
 * 启动恢复网易云登录状态（阶段 B2.1 / B2）。
 * 仅根据已保存的 Cookie 校验身份，不阻塞应用与其他音源启动。
 */

export const initWyLoginStatus = () => {
  const hasCookie = !!(appSetting['common.wy_cookie'] || '')
  initStoreWyLoginStatus(hasCookie)
}

/**
 * 登录成功后加载用户资料与业务数据（喜欢列表、个人歌单）。
 * 设计为只读、可重复；失败不影响登录态（保留已登录，仅不填充数据）。
 * @param {string} cookie 已验证的 Cookie
 */
const loadWyUserData = async(cookie: string, uid: string) => {
  // 后台加载，不阻塞 UI
  setWyUserDataLoaded(false)
  void Promise.allSettled([
    wyUserApi.getLikedSongIds(uid, cookie).then(setWyLikedSongs).catch(() => null),
    wyUserApi.getUserPlaylists(uid, cookie).then(setWyPlaylists).catch(() => null),
  ]).then(() => {
    // 仅当仍是同一 cookie 时才标记完成，避免账号切换后误标
    if (cookie === (appSetting['common.wy_cookie'] || '')) setWyUserDataLoaded(true)
  })
}

/**
 * 统一的验证 + 登录流程（手动 Cookie 与网页登录共用）。
 * @param {string} cookie 待验证的 Cookie
 * @returns {Promise<{ uid: string, vipType: number, nickname?: string, avatarUrl?: string }>} 验证成功后返回
 */
export const verifyAndLogin = async(cookie: string): Promise<{ uid: string, vipType: number, nickname?: string, avatarUrl?: string }> => {
  if (!cookie) throw new Error('Cookie is required to get UID')
  if (isWyVerifying.value) throw new Error('正在验证中')
  setWyVerifying()
  try {
    const info = await wyUserApi.getUid(cookie) as { uid: string, vipType: number, nickname?: string, avatarUrl?: string }
    // 只有当前输入仍是这份 cookie 时才提交（防止并发/旧请求回退）
    if (cookie !== (appSetting['common.wy_cookie'] || '')) {
      updateSetting({ 'common.wy_cookie': cookie })
    }
    setWyLoggedIn(String(info.uid))
    setWyUserInfo({ nickname: info.nickname, avatarUrl: info.avatarUrl })
    void loadWyUserData(cookie, String(info.uid))
    return info
  } catch (error) {
    // 验证失败不保留旧登录状态
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('过期') || msg.includes('无效')) {
      setWyLoginExpired()
      // 仅确认 Cookie 失效时才清空持久化，避免网络抖动误清
      updateSetting({ 'common.wy_cookie': '' })
    } else {
      // 网络类错误：保留持久化 Cookie，仅回落状态
      setWyNotLogin()
    }
    throw error
  }
}

export const initWyLoginVerify = async() => {
  const cookie = appSetting['common.wy_cookie'] || ''
  if (!cookie) return
  try {
    await verifyAndLogin(cookie)
  } catch (_) {
    // 失败已在 verifyAndLogin 内处理
  }
}

/**
 * 网易云请求层返回 301 时，登录态已失效。
 * 统一重置登录状态、清空持久化 Cookie，避免状态与请求注入不一致。
 */
export const onWyLoginExpired = () => {
  setWyLoginExpired()
  updateSetting({ 'common.wy_cookie': '' })
}

export const initWyLoginExpiredListener = () => {
  window.app_event?.on('wyLoginExpired', onWyLoginExpired)
}

export default {
  initWyLoginStatus,
  initWyLoginVerify,
  initWyLoginExpiredListener,
  onWyLoginExpired,
  verifyAndLogin,
  loadWyUserData,
}
