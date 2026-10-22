// 网易云官方域名判定（阶段 B2 安全边界）——主进程与 renderer 共用。
// 仅用于决定是否需要携带用户 Cookie 的 URL，以及登录失效(301)是否应复位登录态。
// 目的：避免仅凭字符串 includes 判断域名，从而防止把账号 Cookie 发送到
// 类似 "music.163.com.example.com" 的伪造域名，或对伪造域名的响应错误地复位登录态。

const NETEASE_HOST = 'music.163.com'

/**
 * 判断给定的绝对 URL（http/https）是否属于网易云官方域名（精确 hostname 或严格子域）。
 * @param {string} absoluteUrl
 * @returns {boolean}
 */
export const isNeteaseMusicUrl = (absoluteUrl: unknown): boolean => {
  if (typeof absoluteUrl !== 'string') return false
  if (!/^https?:\/\//i.test(absoluteUrl)) {
    // 非 http(s) 协议（javascript:、file:、ftp 等）一律不判定为网易云域名
    return false
  }
  let host: string
  try {
    // URL 会规范化，并把主机名转为小写
    host = new URL(absoluteUrl).hostname
  } catch (_) {
    return false
  }
  if (!host) return false
  // 精确匹配（大小写已被 URL 规范化）或严格子域
  return host === NETEASE_HOST || host.endsWith(`.${NETEASE_HOST}`)
}

/**
 * 判断是否需要为某个 URL 注入网易云用户 Cookie。
 * 比 isNeteaseMusicUrl 更严格：还要求协议为 https（避免明文传输账号凭据）。
 * @param {string} absoluteUrl
 * @returns {boolean}
 */
export const shouldInjectWyCookie = (absoluteUrl: unknown): boolean => {
  if (typeof absoluteUrl !== 'string') return false
  if (!/^https:\/\//i.test(absoluteUrl)) return false
  return isNeteaseMusicUrl(absoluteUrl)
}

export default {
  isNeteaseMusicUrl,
  shouldInjectWyCookie,
}
