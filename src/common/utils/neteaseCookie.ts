// 网易云登录 Cookie 工具（阶段 B2）——主进程与 renderer 共用、可测试。
import { isNeteaseMusicUrl } from './neteaseDomain'

/**
 * 从 Electron Cookie 对象列表构建 "k=v; k2=v2" 字符串。
 * 仅保留 name/value 均非空的条目。
 * @param cookies Electron.Cookie[]
 * @returns {string}
 */
export const buildCookieString = (cookies: Array<{ name?: string; value?: string }>): string => {
  return cookies
    .filter(c => typeof c.name == 'string' && c.name.length > 0 && typeof c.value == 'string' && c.value.length > 0)
    .map(c => `${c.name}=${c.value}`)
    .join('; ')
}

/**
 * 过滤出仅属于网易云官方域名的 Cookie（用于网页登录后取 Cookie）。
 * cookie 对象的 domain 形如 ".music.163.com" 或 "music.163.com"。
 * @param cookies 含 domain 的 cookie 对象列表
 * @returns 网易云域名相关的 cookie（保留 name/value）
 */
export const filterNeteaseCookies = (cookies: Array<{ domain?: string }>): Array<{ name?: string; value?: string }> => {
  return cookies.filter(c => {
    const domain = c.domain || ''
    const bare = domain.startsWith('.') ? domain.slice(1) : domain
    if (!bare) return false
    // 通过 URL 语义校验 hostname（复用域名安全判定）
    return isNeteaseMusicUrl(`http://${bare}/`)
  }) as Array<{ name?: string; value?: string }>
}

/**
 * 构建一份不包含 login 关键登录态判断的 cookie 字符串。
 * 用于判断是否已登录：登录成功的网易云会话 cookie 通常包含 MUSIC_U。
 * @param cookie cookie 字符串
 * @returns 是否已登录
 */
export const isLoginedByCookie = (cookie: string): boolean => {
  return typeof cookie == 'string' && cookie.includes('MUSIC_U=')
}

export default {
  buildCookieString,
  filterNeteaseCookies,
  isLoginedByCookie,
}
