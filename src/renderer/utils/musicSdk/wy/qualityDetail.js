import { httpFetch } from '../../request'
import { sizeFormate } from '../../index'

// 单曲音质详情。
//
// 复用移动改良版 `src/utils/musicSdk/wy/quality_detail.js` 的实现：
// 调用网易云官方「歌曲音质详情」接口，返回该曲实际可用的音质与文件大小。
// 桌面端原本只依赖搜索结果里的 privileges，拿不到 master / atmos / hires 等档位，
// 因此下载弹窗看不到高音质选项；这里补齐。

/**
 * 字段 → 音质 的映射（与手机版一致）
 *   l/m -> 128k、h -> 320k、sq -> flac、hr -> hires、jm -> master、je/db -> atmos
 */
const getQualityInfo = (id) => {
  const requestObj = httpFetch(`https://music.163.com/api/song/music/detail/get?songId=${id}`, {
    method: 'get',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      origin: 'https://music.163.com',
    },
    family: 4,
  })

  requestObj.promise = requestObj.promise.then(({ statusCode, body }) => {
    if (statusCode != 200 || body.code != 200) return Promise.reject(new Error('获取音质信息失败'))

    const data = body.data ?? {}
    const types = []
    const _types = {}

    const push = (type, size) => {
      if (size == null || size <= 0) return
      const sizeText = sizeFormate(size)
      // 同一音质只保留第一次（l/m 都映射 128k）
      if (_types[type]) return
      types.push({ type, size: sizeText })
      _types[type] = { size: sizeText }
    }

    if (data.l?.size) push('128k', data.l.size)
    else if (data.m?.size) push('128k', data.m.size)
    if (data.h?.size) push('320k', data.h.size)
    if (data.sq?.size) push('flac', data.sq.size)
    if (data.hr?.size) push('hires', data.hr.size)
    if (data.jm?.size) push('master', data.jm.size)
    // 空间音频：je 与 db 都可能出现，取其一
    if (data.je?.size) push('atmos', data.je.size)
    else if (data.db?.size) push('atmos', data.db.size)

    return { types, _types }
  })

  return requestObj
}

/**
 * 获取单曲的完整音质信息。
 * @param {string|number} id 歌曲 ID（songId / songmid）
 * @returns {Promise<{types: Array, _types: Record<string, {size: string}>}>}
 */
export const getMusicQualityInfo = async(id) => {
  const { promise } = getQualityInfo(id)
  return promise
}

/**
 * 批量获取（同一平台的多次单曲请求并行）。
 * 失败的单曲返回空结果，不影响其他歌曲。
 * @param {Array<string|number>} idList
 */
export const getBatchMusicQualityInfo = async(idList) => {
  const ids = (idList ?? []).filter(id => id != null && id !== '')
  const results = await Promise.all(ids.map(id =>
    getMusicQualityInfo(id).catch(() => ({ types: [], _types: {} })),
  ))
  const map = {}
  ids.forEach((id, index) => { map[id] = results[index] })
  return map
}
