// 网易云「每日推荐」纯转换逻辑（主/渲染可共用，便于隔离测试）。
// 仅依赖 common 的 formatPlayTime / sizeFormate，不引入 request / store / DOM。

import { formatPlayTime, sizeFormate } from './common'

/**
 * 将每日推荐接口返回的单曲转换为桌面端旧结构（与 musicSearch.handleResult 一致的
 * `source:'wy'` + `types/_types` + `songmid`），便于复用 toNewMusicInfo / 播放队列。
 * 每日推荐歌曲本身自带 h/m/l/sq/hr 等音质字段，无需依赖 privileges 数组。
 */
export const toOldSongInfo = (item: any): Record<string, any> => {
  const types: Array<Record<string, any>> = []
  const _types: Record<string, any> = {}
  let size: string | null

  const getSize = (field: string) => (item[field] && item[field].size != null ? sizeFormate(item[field].size) : null)

  if (item.hr) {
    size = getSize('hr')
    types.push({ type: 'flac24bit', size })
    _types.flac24bit = { size }
  }
  if (item.sq) {
    size = getSize('sq')
    types.push({ type: 'flac', size })
    _types.flac = { size }
  }
  if (item.h) {
    size = getSize('h')
    types.push({ type: '320k', size })
    _types['320k'] = { size }
  }
  if (item.m) {
    size = getSize('m')
    types.push({ type: '128k', size })
    _types['128k'] = { size }
  }
  if (item.l) {
    size = getSize('l')
    if (!_types['128k']) {
      types.push({ type: '128k', size })
      _types['128k'] = { size }
    }
  }
  types.reverse()

  // 若一个音质都没有，给一个基础的 128k 占位，保证后续播放链路能识别
  if (!types.length) {
    types.push({ type: '128k', size: null })
    _types['128k'] = { size: null }
  }

  const getSinger = (singers: Array<{ name: string }> | undefined | null) => (singers || []).map(s => s.name).join('、')

  return {
    singer: getSinger(item.ar),
    name: item.name ?? '',
    albumName: item.al?.name,
    albumId: item.al?.id,
    source: 'wy',
    interval: formatPlayTime(item.dt / 1000),
    songmid: item.id,
    img: item.al?.picUrl || '',
    lrc: null,
    types,
    _types,
    typeUrl: {},
  }
}

/**
 * 将每日推荐歌单接口返回的列表映射为桌面端卡片所需结构。
 */
export const toOldPlaylistInfo = (item: any): Record<string, any> => ({
  id: String(item.id),
  name: item.name ?? '',
  trackCount: item.trackCount ?? 0,
  coverImgUrl: item.picUrl ?? '',
  creator: item.creator?.nickname ?? '',
  playCount: item.playcount ?? 0,
  description: item.copywriter ?? '',
})