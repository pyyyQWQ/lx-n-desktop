// 业务工具方法

/**
 * 音质别名迁移：把旧/别名标识统一成移动改良版使用的标准标识。
 *
 * 与移动改良版 `toNewMusicInfo`（mobile `src/utils/index.ts` L59-97）完全一致：
 *   flac32bit   -> hires
 *   flac24bit   -> hires
 *   effect      -> atmos
 *   effect_plus -> atmos_plus
 *
 * 原因：网易云等音源的原始标识与界面标识不统一；若同时保留 flac / flac24bit / hires，
 * 会出现三档指向同一文件、用户切换却无任何区别的问题。统一别名后每个档位才真实唯一。
 *
 * @param types  旧结构 `types` 数组（会就地修改 type 字段）
 * @param _types 旧结构 `_types` 映射
 */
export const migrateQualityAlias = (types: any[], _types: Record<string, any>): void => {
  const aliasMap: Array<[string, string]> = [
    ['flac32bit', 'hires'],
    ['flac24bit', 'hires'],
    ['effect', 'atmos'],
    ['effect_plus', 'atmos_plus'],
  ]
  for (const [from, to] of aliasMap) {
    if (!_types[from]) continue
    const hadTarget = Boolean(_types[to])
    if (!hadTarget) {
      // 只存在别名：迁移到标准标识
      _types[to] = _types[from]
    }
    // 该字段名本身来自别名表，属于需要动态清理的键；用 Reflect.deleteProperty
    // 避免 @typescript-eslint/no-dynamic-delete（语义与 delete 等价）
    Reflect.deleteProperty(_types, from)

    if (Array.isArray(types)) {
      for (const item of types) {
        if (item && item.type == from) item.type = to
      }
      // 两者并存时，数组里可能残留同 type 的重复项，需要去重
      if (hadTarget) {
        const seen = new Set<string>()
        for (let i = types.length - 1; i >= 0; i--) {
          const type = types[i]?.type
          if (!type) continue
          if (seen.has(type)) types.splice(i, 1)
          else seen.add(type)
        }
      }
    }
  }
}

export const toNewMusicInfo = (oldMusicInfo: any): LX.Music.MusicInfo => {
  const meta: Record<string, any> = {
    songId: oldMusicInfo.songmid, // 歌曲ID，local为文件路径
    albumName: oldMusicInfo.albumName, // 歌曲专辑名称
    picUrl: oldMusicInfo.img, // 歌曲图片链接
  }
  const newInfo = {
    id: `${oldMusicInfo.source}_${oldMusicInfo.songmid}`,
    name: oldMusicInfo.name,
    singer: oldMusicInfo.singer,
    source: oldMusicInfo.source,
    interval: oldMusicInfo.interval,
    meta: meta as LX.Music.MusicInfoOnline['meta'],
  }

  if (oldMusicInfo.source == 'local') {
    meta.filePath = oldMusicInfo.filePath ?? oldMusicInfo.songmid ?? ''
    meta.ext = oldMusicInfo.ext ?? /\.(\w+)$/.exec(meta.filePath)?.[1] ?? ''
  } else {
    meta.qualitys = oldMusicInfo.types
    meta._qualitys = oldMusicInfo._types
    meta.albumId = oldMusicInfo.albumId
    // 音质别名统一（与移动改良版一致）
    if (meta._qualitys) migrateQualityAlias(meta.qualitys, meta._qualitys)

    switch (oldMusicInfo.source) {
      case 'kg':
        meta.hash = oldMusicInfo.hash
        meta.albumAudioId = oldMusicInfo.albumAudioId
        newInfo.id = oldMusicInfo.songmid + '_' + oldMusicInfo.hash
        break
      case 'tx':
        meta.strMediaMid = oldMusicInfo.strMediaMid
        meta.id = oldMusicInfo.songId
        meta.albumMid = oldMusicInfo.albumMid
        break
      case 'mg':
        meta.copyrightId = oldMusicInfo.copyrightId
        meta.lrcUrl = oldMusicInfo.lrcUrl
        meta.mrcUrl = oldMusicInfo.mrcUrl
        meta.trcUrl = oldMusicInfo.trcUrl
        break
    }
  }

  return newInfo
}

export const toOldMusicInfo = (minfo: LX.Music.MusicInfo) => {
  const oInfo: Record<string, any> = {
    name: minfo.name,
    singer: minfo.singer,
    source: minfo.source,
    songmid: minfo.meta.songId,
    interval: minfo.interval,
    albumName: minfo.meta.albumName,
    img: minfo.meta.picUrl ?? '',
    typeUrl: {},
  }
  if (minfo.source == 'local') {
    oInfo.filePath = minfo.meta.filePath
    oInfo.ext = minfo.meta.ext
    oInfo.albumId = ''
    oInfo.types = []
    oInfo._types = {}
  } else {
    oInfo.albumId = minfo.meta.albumId
    oInfo.types = minfo.meta.qualitys
    oInfo._types = minfo.meta._qualitys

    switch (minfo.source) {
      case 'kg':
        oInfo.hash = minfo.meta.hash
        oInfo.albumAudioId = minfo.meta.albumAudioId
        break
      case 'tx':
        oInfo.strMediaMid = minfo.meta.strMediaMid
        oInfo.albumMid = minfo.meta.albumMid
        oInfo.songId = minfo.meta.id
        break
      case 'mg':
        oInfo.copyrightId = minfo.meta.copyrightId
        oInfo.lrcUrl = minfo.meta.lrcUrl
        oInfo.mrcUrl = minfo.meta.mrcUrl
        oInfo.trcUrl = minfo.meta.trcUrl
        break
    }
  }

  return oInfo
}

/**
 * 修复历史列表数据里的音质标识。
 *
 * 除原版的 flac32bit -> flac24bit 之外，现按移动改良版统一到标准标识：
 *   flac24bit -> hires、effect -> atmos、effect_plus -> atmos_plus
 * （迁移函数见 migrateQualityAlias）
 */
export const fixNewMusicInfoQuality = (musicInfo: LX.Music.MusicInfo) => {
  if (musicInfo.source == 'local') return musicInfo

  const meta = musicInfo.meta as unknown as LX.Music.MusicInfoOnline['meta']
  if (meta._qualitys) migrateQualityAlias(meta.qualitys, meta._qualitys)

  return musicInfo
}

export const filterMusicList = <T extends LX.Music.MusicInfo>(list: T[]): T[] => {
  const ids = new Set<string>()
  return list.filter(s => {
    if (!s.id || ids.has(s.id) || !s.name) return false
    if (s.singer == null) s.singer = ''
    ids.add(s.id)
    return true
  })
}


const MAX_NAME_LENGTH = 80
const MAX_FILE_NAME_LENGTH = 150
export const clipNameLength = (name: string) => {
  if (name.length <= MAX_NAME_LENGTH || !name.includes('、')) return name
  const names = name.split('、')
  let newName = names.shift()!
  for (const name of names) {
    if (newName.length + name.length > MAX_NAME_LENGTH) break
    newName = newName + '、' + name
  }
  return newName
}
export const clipFileNameLength = (name: string) => {
  return name.length > MAX_FILE_NAME_LENGTH ? name.substring(0, MAX_FILE_NAME_LENGTH) : name
}

export const formatMusicName = (format: string, name: string, singer: string) => {
  // return format.replace(/歌名|歌手/g, match => match === '歌名' ? name : singer)
  return format.replace('歌手', singer).replace('歌名', name)
}
