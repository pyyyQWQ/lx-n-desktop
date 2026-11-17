// 各平台音质档位的「真实档位 + 真实名称」。
//
// 数据来源（三处交叉验证）：
//   1. GZ_Music 2.2.2 检测结果的截图（各平台实际列出的档位与名称）
//   2. 两个付费音源脚本的 MUSIC_QUALITY 表（决定哪些档位真实存在）
//   3. 星海音源 v2.3.19 的 MUSIC_QUALITIES 表
//
// 关键结论：**每个平台的档位集合不同**，不能统一。
//   · 网易云 6 档：master / atmos / hires / flac / 320k / 128k（无 atmos_plus）
//   · QQ    8 档：master / atmos_plus / atmos / hires / flac / 320k / 192k / 128k
//   · 酷狗  7 档：master / atmos / hires / flac24bit / flac / 320k / 128k
//   · 酷我  5 档：hires / flac / 320k / 128k（付费音源）/ 星海只有 3 档
//   · 咪咕  5 档：hires / flac / 320k / 128k
//
// 名称以截图为准（GZ_Music 用的是各平台官方叫法）。
import type { QualityKey } from './quality'
import { isKnownQuality, getQualityLabel } from './quality'

/** 平台 → 档位（高 → 低，顺序即展示顺序）→ 显示名。 */
export const QUALITY_LABELS_BY_SOURCE: Record<string, Partial<Record<QualityKey, string>>> = {
  // 网易云：6 档。截图里是 超清母带/高清臻音/高解析 Hi-Res/无损 SQ/极高 HQ/标准 128K
  wy: {
    master: '超清母带',
    atmos: '高清臻音',
    hires: '高解析 Hi-Res',
    flac: '无损 SQ',
    '320k': '极高 HQ',
    '128k': '标准 128K',
  },
  // QQ音乐：8 档。截图里多出「全景声 2.0」与「192K」
  tx: {
    master: '大师音质',
    atmos_plus: '全景声 2.0',
    atmos: '全景声',
    hires: '高解析 Hi-Res',
    flac: '无损 SQ',
    '320k': '极高 HQ',
    '192k': '192K',
    '128k': '标准 128K',
  },
  // 酷狗：7 档。音源声明里有 flac24bit，截图里显示为「24bit」
  kg: {
    master: '大师音质',
    atmos: '全景声',
    hires: '高解析 Hi-Res',
    flac: '无损 SQ',
    '320k': '极高 HQ',
    '128k': '标准 128K',
  },
  // 酷我：5 档（付费音源）。截图里是 24bit/高解析 Hi-Res/无损 SQ/极高 HQ/标准 128K
  kw: {
    hires: '高解析 Hi-Res',
    flac: '无损 SQ',
    '320k': '极高 HQ',
    '128k': '标准 128K',
  },
  // 咪咕：5 档。截图里与酷我一致
  mg: {
    hires: '高解析 Hi-Res',
    flac: '无损 SQ',
    '320k': '极高 HQ',
    '128k': '标准 128K',
  },
}

/**
 * 各平台的档位全集（顺序即展示顺序，高 → 低）。
 *
 * 由 QUALITY_LABELS_BY_SOURCE 的键序推导，保证「能选的档位」与「能检测的档位」一致。
 */
export const QUALITY_KEYS_BY_SOURCE: Record<string, QualityKey[]> = Object.fromEntries(
  Object.entries(QUALITY_LABELS_BY_SOURCE).map(([src, table]) => [src, Object.keys(table) as QualityKey[]]),
)

/** 取某平台的全部档位（高 → 低）。平台未知时返回空数组。 */
export const getQualityKeysBySource = (source: string | null | undefined): QualityKey[] => {
  return source ? (QUALITY_KEYS_BY_SOURCE[source] ?? []) : []
}

/**
 * 取某个平台下某档位的显示名。
 *
 * @param source 平台 id（wy / tx / kg / kw / mg …）
 * @param quality 档位标识
 * @param translate 可选的 i18n 取值函数；仅用于回退到通用标签
 */
export const getQualityLabelBySource = (
  source: string | null | undefined,
  quality: string,
  translate?: (key: string) => string,
): string => {
  const table = source ? QUALITY_LABELS_BY_SOURCE[source] : undefined
  if (table && isKnownQuality(quality)) {
    const label = table[quality]
    if (label) return label
  }
  return isKnownQuality(quality) ? getQualityLabel(quality, translate) : quality
}

/** 该平台是否为此档位提供了专属名称。 */
export const hasSourceQualityLabel = (source: string | null | undefined, quality: string): boolean => {
  const table = source ? QUALITY_LABELS_BY_SOURCE[source] : undefined
  return !!(table && isKnownQuality(quality) && table[quality])
}

/**
 * 沿给定顺序从「所选档位」向下找第一个实际可用的档位。
 *
 * 这是播放降级的核心，抽到 common 层以便单测覆盖。
 *
 * 两种情形分开处理：
 *   1. 所选档位**在该平台的顺序里** → 从它开始向低找第一个可用的
 *      （这是正常的「高音质不可用则降次高档」）
 *   2. 所选档位**不在该平台的顺序里** → 取该平台支持的最高可用档位
 *      例如用户在 QQ 选了 master 后切到酷我（酷我没有 master），
 *      应播放酷我的最高档，而不是掉到最低档
 *
 * @param preferred 用户选定的档位
 * @param available 该曲实际可用的档位（meta._qualitys 的键）
 * @param order 该平台的档位顺序（高 → 低）
 * @returns 命中的档位；一个都不可用时返回顺序里最低的那一档
 */
export const descendQuality = (
  preferred: string,
  available: Record<string, unknown>,
  order: readonly string[],
): string => {
  if (!order.length) return '128k'
  const startIndex = order.indexOf(preferred)

  if (startIndex === -1) {
    // 所选档位不属于该平台 → 取该平台支持的最高可用档位
    for (let i = 0; i < order.length; i++) {
      if (available[order[i]]) return order[i]
    }
    return order[order.length - 1]
  }

  // 正常降级：从所选档位向低找
  for (let i = startIndex; i < order.length; i++) {
    if (available[order[i]]) return order[i]
  }
  // 所选档位及以下都不可用 → 退回最低档
  return order[order.length - 1]
}
