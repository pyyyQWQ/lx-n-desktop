import { httpFetch } from '../../request'
import { weapi } from './utils/crypto'
import { appSetting } from '@renderer/store/setting'

/**
 * 网易云账号相关接口（阶段 B2）。
 * 身份验证 + 我的歌单 + 喜欢歌曲等用户能力。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54'
const MA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'

const getCsrf = cookie => (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1] || ''

const neteaseHeaders = (cookie, userAgent = UA, referer = 'https://music.163.com') => ({
  'User-Agent': userAgent,
  origin: 'https://music.163.com',
  Referer: referer,
  ...(cookie ? { cookie } : {}),
})

/**
 * 校验 Cookie 并获取用户 uid。
 * @param {string} cookie 网易云 Cookie
 * @returns {Promise<{ uid: string, vipType: number }>}
 */
export const getUid = async(cookie, retryNum = 0) => {
  if (!cookie) throw new Error('Cookie is required to get UID')
  const maxRetries = 3
  const retryDelay = 200

  try {
    const _requestObj = httpFetch('https://music.163.com/weapi/nuser/account/get', {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        csrf_token: getCsrf(cookie),
      }),
    })
    const { body, statusCode } = await _requestObj.promise

    if (statusCode !== 200 || body.code !== 200) throw new Error('获取UID失败')
    if (!body.account) throw new Error('登录已过期或Cookie无效')

    const uid = body.account.id
    return {
      uid: String(uid),
      vipType: body.account.vipType ?? 0,
      nickname: body.profile?.nickname ?? '',
      avatarUrl: body.profile?.avatarUrl ?? '',
    }
  } catch (error) {
    if (retryNum < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return getUid(cookie, retryNum + 1)
    } else {
      throw error
    }
  }
}

/**
 * 获取当前登录用户在网易云保存的「我喜欢的音乐」列表 id。
 * @param {string} uid
 * @param {string} cookie
 * @returns {Promise<string[]>}
 */
export const getLikedSongIds = async(uid, cookie, retryNum = 0) => {
  const maxRetries = 3
  const retryDelay = 200
  try {
    const requestObj = httpFetch('https://music.163.com/weapi/song/like/get', {
      method: 'post',
      headers: neteaseHeaders(cookie, MA),
      form: weapi({
        uid: String(uid),
        csrf_token: getCsrf(cookie),
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error('获取喜欢列表歌曲失败')
    return body.ids || []
  } catch (error) {
    if (retryNum < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return getLikedSongIds(uid, cookie, retryNum + 1)
    }
    throw error
  }
}

/**
 * 喜欢 / 取消喜欢某首歌曲（真实接口 weapi/song/like）。
 * @param {string|number} songId
 * @param {boolean} like true 喜欢 / false 取消喜欢
 * @returns {Promise<object>}
 */
export const likeSong = async(songId, like, retryNum = 0) => {
  const cookie = appSetting['common.wy_cookie'] || ''
  if (!cookie) return Promise.reject(new Error('未设置Cookie'))
  const maxRetries = 3
  const retryDelay = 200
  try {
    const requestObj = httpFetch('https://music.163.com/weapi/song/like', {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        trackId: songId,
        like,
        time: 3,
        alg: 'itembased',
        csrf_token: getCsrf(cookie),
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error((body && body.message) || '操作失败')
    return body
  } catch (error) {
    if (retryNum < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return likeSong(songId, like, retryNum + 1)
    }
    throw error
  }
}

/**
 * 获取当前用户的歌单列表（我创建 + 我收藏）。
 * @param {string} uid
 * @param {string} cookie
 * @returns {Promise<Array<{id:string,userId:number,name:string,coverImgUrl:string,trackCount:number,description?:string,playCount?:number}>>}
 */
export const getUserPlaylists = async(uid, cookie, retryNum = 0) => {
  const maxRetries = 3
  const retryDelay = 200
  try {
    const requestObj = httpFetch('https://music.163.com/weapi/user/playlist', {
      method: 'post',
      headers: neteaseHeaders(cookie, UA, `https://music.163.com/user/home?id=${uid}`),
      form: weapi({
        uid,
        limit: 1000,
        offset: 0,
        includeVideo: true,
        csrf_token: getCsrf(cookie),
      }),
    })
    const { body } = await requestObj.promise
    if (body.code !== 200) throw new Error('获取用户歌单失败')
    return body.playlist || []
  } catch (error) {
    if (retryNum < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return getUserPlaylists(uid, cookie, retryNum + 1)
    }
    throw error
  }
}

/**
 * 关注 / 取消关注歌手（weapi/artist/sub|unsub）。
 */
export const followSinger = async(id, isFollow, retryNum = 0) => {
  const cookie = appSetting['common.wy_cookie'] || ''
  if (!cookie) return Promise.reject(new Error('未设置Cookie'))
  const maxRetries = 3
  const retryDelay = 200
  const action = isFollow ? 'sub' : 'unsub'
  try {
    const requestObj = httpFetch(`https://music.163.com/weapi/artist/${action}`, {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        artistId: id,
        artistIds: `['${id}']`,
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error((body && body.message) || '操作失败')
    return body
  } catch (error) {
    if (retryNum < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return followSinger(id, isFollow, retryNum + 1)
    }
    throw error
  }
}

/**
 * 收藏 / 取消收藏专辑（weapi/album/sub|unsub）。
 */
export const subAlbum = async(id, isSub, retryNum = 0) => {
  const cookie = appSetting['common.wy_cookie'] || ''
  if (!cookie) return Promise.reject(new Error('未设置Cookie'))
  const maxRetries = 3
  const retryDelay = 200
  const action = isSub ? 'sub' : 'unsub'
  try {
    const requestObj = httpFetch(`https://music.163.com/weapi/album/${action}`, {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        id,
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error((body && body.message) || '操作失败')
    return body
  } catch (error) {
    if (retryNum < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return subAlbum(id, isSub, retryNum + 1)
    }
    throw error
  }
}

/**
 * 订阅 / 取消订阅歌单（weapi/playlist/subscribe|unsubscribe）。
 */
export const subPlaylist = async(id, isSub, retryNum = 0) => {
  const cookie = appSetting['common.wy_cookie'] || ''
  if (!cookie) return Promise.reject(new Error('未设置Cookie'))
  const maxRetries = 3
  const retryDelay = 200
  const action = isSub ? 'subscribe' : 'unsubscribe'
  try {
    const requestObj = httpFetch(`https://music.163.com/weapi/playlist/${action}`, {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        id,
        csrf_token: getCsrf(cookie),
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error((body && body.message) || '操作失败')
    return body
  } catch (error) {
    if (retryNum < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return subPlaylist(id, isSub, retryNum + 1)
    }
    throw error
  }
}

/**
 * 当前配置的网易云 Cookie（供 UI 复用）。
 */
export const getCurrentCookie = () => {
  return appSetting['common.wy_cookie'] || ''
}

export default {
  getUid,
  getLikedSongIds,
  likeSong,
  getUserPlaylists,
  followSinger,
  subAlbum,
  subPlaylist,
  getCurrentCookie,
}
