import { BrowserWindow, session } from 'electron'
import { isNeteaseMusicUrl } from '@common/utils/neteaseDomain'
import { buildCookieString, filterNeteaseCookies } from '@common/utils/neteaseCookie'

const LOGIN_URL = 'https://music.163.com/login'
export const LOGIN_PARTITION = 'temp:netease-login'

let loginWin: Electron.BrowserWindow | null = null

/**
 * 构建用于登录业务的 Cookie 字符串（仅网易云官方域名，且仅业务必需）。
 * @param cookies cookie 列表
 * @returns "k=v; k2=v2" 字符串
 */
export const buildLoginCookieString = (cookies: Electron.Cookie[]): string => {
  return buildCookieString(cookies)
}

/**
 * 登录成功后从登录专用 session 读取网易云 Cookie。
 * 仅在当前登录窗口对应的 session 上读取，不触碰主窗口会话。
 */
export const getLoginCookies = async(): Promise<string> => {
  try {
    const ses = session.fromPartition(LOGIN_PARTITION)
    const cookies = await ses.cookies.get({})
    const wyCookies = filterNeteaseCookies(cookies)
    return buildCookieString(wyCookies)
  } catch (_) {
    return ''
  }
}

const clearLoginSession = async() => {
  try {
    const ses = session.fromPartition(LOGIN_PARTITION)
    await ses.clearStorageData()
    await ses.clearCache()
  } catch (_) {}
}

export const openLoginWindow = () => {
  closeLoginWindow()
  const ses = session.fromPartition(LOGIN_PARTITION)
  loginWin = new BrowserWindow({
    width: 460,
    height: 640,
    useContentSize: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: '网易云音乐登录',
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      enableWebSQL: false,
      spellcheck: false,
    },
  })

  // 阻止新窗口（弹窗/外链）直接在 Electron 中打开，转交系统浏览器
  loginWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // 导航安全：仅允许网易云官方域名（登录页内部跳转），其余一律阻止。
  // 配合 app.ts 的全局 navigationUrlWhiteList 双保险。
  loginWin.webContents.on('will-navigate', (event, url) => {
    if (!isNeteaseMusicUrl(url)) event.preventDefault()
  })

  loginWin.once('closed', () => {
    loginWin = null
    void clearLoginSession()
  })

  loginWin.once('ready-to-show', () => {
    loginWin?.show()
  })

  void loginWin.loadURL(LOGIN_URL)
  return loginWin
}

export const closeLoginWindow = () => {
  if (loginWin) {
    loginWin.destroy()
    loginWin = null
  }
  void clearLoginSession()
}

export const isLoginWindowOpen = () => !!loginWin
