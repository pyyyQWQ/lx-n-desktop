import { mainHandle } from '@common/mainIpc'
import { NETEASE_LOGIN_EVENT_NAME } from '@common/ipcNames'
import { openLoginWindow, closeLoginWindow, isLoginWindowOpen, getLoginCookies, buildLoginCookieString, LOGIN_PARTITION } from './main'

/**
 * 网易云网页登录模块。
 * 主进程负责：
 *  - 打开临时登录窗口（独立临时 session，与主窗口 persist:win-main 隔离）
 *  - 读取登录后的网易云 Cookie（仅业务必需，不输出到日志）
 *  - 关闭/清理临时 window 与 session
 */

export default () => {
  // 打开登录窗口
  mainHandle(NETEASE_LOGIN_EVENT_NAME.open, async() => {
    // 若窗口已打开则先关闭，保证从干净状态开始
    if (isLoginWindowOpen()) closeLoginWindow()
    openLoginWindow()
    return { opened: true }
  })

  // 关闭登录窗口并清理临时 session
  mainHandle(NETEASE_LOGIN_EVENT_NAME.close, async() => {
    closeLoginWindow()
    return { closed: true }
  })

  // 获取登录后的 Cookie（仅网易云官方域名）
  mainHandle(NETEASE_LOGIN_EVENT_NAME.get_cookie, async() => {
    if (!isLoginWindowOpen()) return { cookie: '', isLogined: false }
    const cookie = await getLoginCookies()
    // 通过 getUid 语义判断是否含有登录会话：存在 MUSIC_U 才算真正登录
    const isLogined = cookie.includes('MUSIC_U=')
    return { cookie, isLogined }
  })
}

export { buildLoginCookieString, LOGIN_PARTITION }
