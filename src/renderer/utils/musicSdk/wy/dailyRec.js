import { httpFetch } from '../../request'
import { weapi } from './utils/crypto'
import { toOldSongInfo, toOldPlaylistInfo } from '@common/utils/wyDailyRec'
import { appSetting } from '@renderer/store/setting'

/**
 * 网易云音乐「每日推荐」相关接口（阶段 C2）。
 * 每日推荐歌曲 + 每日推荐歌单。
 * 桌面端适配：复用 request.js 的 weapi 加密链路，Cookie 由请求层按域名自动注入，
 * 显式传入的 cookie header 用于授权下取词的一致性。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54'
const MA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'

const getCsrf = cookie => (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1] || ''

const neteaseHeaders = (cookie, userAgent = UA) => ({
  'User-Agent': userAgent,
  origin: 'https://music.163.com',
  Referer: 'https://music.163.com',
  ...(cookie ? { cookie } : {}),
})

/**
 * 获取每日推荐歌曲。
 * @param {string} cookie 网易云 Cookie
 * @returns {Promise<{ list: Array, source: 'wy' }>}
 */
export const getList = async(cookie, retryNum = 0) => {
  if (retryNum > 2) return Promise.reject(new Error('try max num'))

  try {
    const csrfToken = getCsrf(cookie)
    const requestObj = httpFetch('https://music.163.com/weapi/v3/discovery/recommend/songs', {
      method: 'post',
      headers: neteaseHeaders(cookie, MA),
      form: weapi({
        offset: 0,
        total: true,
        limit: 30,
        csrf_token: csrfToken,
      }),
    })
    const { body, statusCode } = await requestObj.promise

    if (statusCode !== 200 || body.code !== 200 || !body.data) {
      throw new Error('获取每日推荐失败或返回数据无效')
    }

    const rawSongs = body.data.dailySongs || []
    const list = rawSongs.filter(item => item && item.id).map(toOldSongInfo)
    return { list, source: 'wy' }
  } catch (error) {
    console.log(`获取日推失败，正在进行第 ${retryNum + 1} 次重试...`, error.message)
    return getList(cookie, retryNum + 1)
  }
}

/**
 * 获取每日推荐歌单。
 * @param {string} cookie 网易云 Cookie
 * @returns {Promise<Array<{id:string,name:string,trackCount:number,coverImgUrl:string,description?:string,playCount?:number}>>}
 */
export const getRecPlaylists = async(cookie, retryNum = 0) => {
  if (retryNum > 2) return Promise.reject(new Error('try max num'))

  try {
    const requestObj = httpFetch('https://music.163.com/weapi/v1/discovery/recommend/resource', {
      method: 'post',
      headers: neteaseHeaders(cookie),
      form: weapi({
        csrf_token: '',
      }),
    })
    const { body, statusCode } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error('获取每日推荐歌单失败')

    const raw = body.recommend || []
    return raw
      .filter(item => item && item.id)
      .map(toOldPlaylistInfo)
  } catch (error) {
    console.log(`获取每日推荐歌单失败，正在进行第 ${retryNum + 1} 次重试...`, error.message)
    return getRecPlaylists(cookie, retryNum + 1)
  }
}

/**
 * 当前配置的网易云 Cookie（供 UI 复用）。
 */
export const getCurrentCookie = () => {
  return appSetting['common.wy_cookie'] || ''
}

export default {
  getList,
  getRecPlaylists,
  getCurrentCookie,
}
