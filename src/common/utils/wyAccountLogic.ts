// 网易云账户业务逻辑（纯函数，阶段 B2）——renderer 与测试共用。

/**
 * 判断一个错误消息是否代表「Cookie 确定失效」（过期 / 无效）。
 * 用于决定是否清空持久化 Cookie；网络类错误不在此列，从而避免误删可能仍有效的 Cookie。
 * @param {string} message
 * @returns {boolean}
 */
export const isCookieInvalidError = (message: unknown): boolean => {
  if (typeof message != 'string' || !message) return false
  return message.includes('过期') || message.includes('无效')
}

/**
 * 判断某歌曲是否应视为已被喜欢（依据网易云喜欢的 id 集合 + 歌曲 id）。
 * @param {Set<string>} likedIds 喜欢的歌曲 id 集合
 * @param {string | number} songId 歌曲的真实 id（网易云 songmid）
 * @returns {boolean}
 */
export const isSongLiked = (likedIds: Set<string>, songId: string | number): boolean => {
  return likedIds.has(String(songId))
}

export default {
  isCookieInvalidError,
  isSongLiked,
}
