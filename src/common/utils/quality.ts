// 音质相关纯逻辑（主/渲染共用，无副作用，便于隔离测试）。
//
// 本文件与移动改良版（souvenp/lx-netease-music-mobile）对齐：
//   · 音质标识集合：128k / 320k / flac / hires / atmos / atmos_plus / master
//   · **没有 flac24bit** —— 手机版在数据转换时把 flac24bit 统一改名为 hires
//   · 展示名沿用手机版 zh-cn 语言包的取值：
//       hires      -> Hires 无损24-Bit   （即原 flac24bit 的位置）
//       atmos      -> 臻品音质
//       atmos_plus -> 臻品音质 2.0
//       master     -> 臻品母带
//
// 注意：这里只做「标识 ↔ 展示名」的映射，不涉及网络与设置读写。

export type QualityKey = '128k' | '192k' | '320k' | 'flac' | 'hires' | 'atmos' | 'atmos_plus' | 'master' | 'ape' | 'wav'

/**
 * 音质在界面上的默认展示名（简体中文）。
 * 其它语言由 i18n 的 `quality__*` 键覆盖；这里作为兜底与纯函数测试的基准。
 * 取值与移动改良版一致。
 */
export const QUALITY_LABELS: Record<QualityKey, string> = {
  '128k': '128K',
  '192k': '192K',
  '320k': '320K',
  flac: 'FLAC',
  hires: 'Hires 无损24-Bit',
  atmos: '臻品音质',
  atmos_plus: '臻品音质 2.0',
  master: '臻品母带',
  ape: 'APE',
  wav: 'WAV',
}

/**
 * i18n 键名映射。渲染层用它取当前语言下的名称，
 * 取不到时回退到 QUALITY_LABELS。
 */
export const QUALITY_I18N_KEYS: Record<QualityKey, string> = {
  '128k': 'quality__128k',
  '192k': 'quality__192k',
  '320k': 'quality__320k',
  flac: 'quality__flac',
  hires: 'quality__hires',
  atmos: 'quality__atmos',
  atmos_plus: 'quality__atmos_plus',
  master: 'quality__master',
  ape: 'quality__ape',
  wav: 'quality__wav',
}

/**
 * 旧标识 → 标准标识 的别名映射。
 * 与移动改良版 `toNewMusicInfo` 完全一致（mobile `src/utils/index.ts` L59-97）。
 */
export const QUALITY_ALIAS: Readonly<Record<string, QualityKey>> = {
  flac32bit: 'hires',
  flac24bit: 'hires',
  effect: 'atmos',
  effect_plus: 'atmos_plus',
}

/** 是否为已知音质标识 */
export const isKnownQuality = (key: unknown): key is QualityKey =>
  typeof key == 'string' && Object.prototype.hasOwnProperty.call(QUALITY_LABELS, key)

/** 把旧/别名标识解析成标准标识；无法识别时原样返回 */
export const normalizeQuality = (key: string): string => {
  const alias = QUALITY_ALIAS[key]
  return alias ?? key
}

/**
 * 取音质的展示名。
 * @param key 音质标识（会先做别名归一）
 * @param translate 可选的翻译函数（i18n）；取不到时用内置中文名兜底
 */
export const getQualityLabel = (key: string, translate?: (key: string) => string): string => {
  const normalized = normalizeQuality(key)
  if (!isKnownQuality(normalized)) return String(key ?? '').toUpperCase()
  if (translate) {
    const i18nKey = QUALITY_I18N_KEYS[normalized]
    const text = translate(i18nKey)
    // i18n 未命中时通常返回键名本身，此时回退到内置名
    if (text && text !== i18nKey) return text
  }
  return QUALITY_LABELS[normalized]
}

/** 无损及以上音质（用于列表徽标判断） */
const LOSSLESS_OR_ABOVE: QualityKey[] = ['master', 'atmos_plus', 'atmos', 'hires', 'flac', 'ape', 'wav']

/** 是否是「无损及以上」音质 */
export const isLosslessQuality = (key: string): boolean =>
  LOSSLESS_OR_ABOVE.includes(normalizeQuality(key) as QualityKey)

/**
 * 从可用音质字典里挑出「当前最好的一个」，按传入的优先级顺序。
 * @param qualitys 形如 { hires: {...}, flac: {...} }
 * @param priority 优先级列表（从高到低）
 */
export const pickBestQuality = (qualitys: Record<string, unknown> | null | undefined, priority: readonly string[]): string | null => {
  if (!qualitys) return null
  for (const q of priority) {
    if (qualitys[q]) return q
  }
  return null
}
