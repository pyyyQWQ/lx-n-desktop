import { rendererInvoke } from '@common/rendererIpc'
import { NETEASE_LOGIN_EVENT_NAME } from '@common/ipcNames'

/**
 * 网易云网页登录 renderer 侧封装。
 */

/**
 * 打开网易云登录窗口。
 */
export const openNeteaseLoginWindow = async() => {
  return rendererInvoke<{ opened: boolean }>(NETEASE_LOGIN_EVENT_NAME.open)
}

/**
 * 关闭网易云登录窗口并清理临时 session。
 */
export const closeNeteaseLoginWindow = async() => {
  return rendererInvoke<{ closed: boolean }>(NETEASE_LOGIN_EVENT_NAME.close)
}

/**
 * 从登录窗口 session 获取网易云 Cookie。
 * @returns {Promise<{ cookie: string, isLogined: boolean }>}
 */
export const getNeteaseLoginCookie = async() => {
  return rendererInvoke<{ cookie: string, isLogined: boolean }>(NETEASE_LOGIN_EVENT_NAME.get_cookie)
}
