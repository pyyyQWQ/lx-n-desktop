import { httpFetch } from '../../request'
import { sizeFormate } from '../../index'

// 歌曲音质详情（QQ 音乐）。
//
// 复用移动改良版 `src/utils/musicSdk/tx/quality_detail.js` 的实现：
// 调用 musicu.fcg 的 `music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo` 接口，
// 一次请求可取多首歌曲的完整音质与文件大小。
// 桌面端原本只依赖搜索结果，拿不到 hires / atmos / atmos_plus / master 等档位。

/**
 * 批量获取音质信息。
 * @param {Array<string|number>} songIds 歌曲 mid
 * @returns {Promise<Record<string, {types: Array, _types: Record<string, {size: string}>}>>}
 */
export const getBatchMusicQualityInfo = async(songIds) => {
  const ids = (songIds ?? []).filter(id => id != null && id !== '')
  if (!ids.length) return {}

  const requestObj = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
    },
    body: {
      comm: {
        ct: '19',
        cv: '1859',
        uin: '0',
      },
      req: {
        module: 'music.trackInfo.UniformRuleCtrl',
        method: 'CgiGetTrackInfo',
        param: {
          types: Array(ids.length).fill(1),
          ids,
          ctx: 0,
        },
      },
    },
  })

  const qualityInfoMap = {}

  await requestObj.promise.then(({ statusCode, body }) => {
    if (statusCode != 200 || body.code != 0) throw new Error('获取音质信息失败')

    const tracks = body?.req?.data?.tracks ?? []
    for (const track of tracks) {
      const file = track.file ?? {}
      const songId = track.id
      const types = []
      const _types = {}

      const push = (type, size) => {
        if (!size || size <= 0) return
        const sizeText = sizeFormate(size)
        if (_types[type]) return
        types.push({ type, size: sizeText })
        _types[type] = { size: sizeText }
      }

      push('128k', file.size_128mp3)
      push('320k', file.size_320mp3)
      push('flac', file.size_flac)
      push('hires', file.size_hires)
      // size_new 数组：0 -> master、1 -> atmos、2 -> atmos_plus（与手机版一致）
      const sizeNew = file.size_new ?? []
      push('atmos', sizeNew[1])
      push('atmos_plus', sizeNew[2])
      push('master', sizeNew[0])

      qualityInfoMap[songId] = { types, _types }
    }
  }).catch(() => {
    // 失败时返回空映射，交由调用方降级
    throw new Error('获取音质信息失败')
  })

  return qualityInfoMap
}

/**
 * 单曲音质信息（内部走批量接口）。
 * @param {string|number} id
 */
export const getMusicQualityInfo = async(id) => {
  const map = await getBatchMusicQualityInfo([id])
  return map[id] ?? { types: [], _types: {} }
}
