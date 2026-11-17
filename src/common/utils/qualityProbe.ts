// 音源音质档位检测 —— 纯逻辑层（无网络、无 store、无 DOM，可直接单测）。
//
// 目标：回答「当前音源的某个音质档位能不能真的用」。
//
// 背景：音源接口不提供「档位可用性清单」，只能拿一首**样本歌**去实际请求播放地址：
//   · 拿到 URL → 该档位可用
//   · 返回 200 但没有 URL → 不可用（或该样本歌本身没有这个档位）
//   · 超时 / 403 → 接口异常
//
// ⚠️ 关键认知（必须体现在 UI 上）：
//   用一首歌测出来的结果**不能代表该平台的全部歌曲**。
//   样本歌本身可能就没有母带版权，此时「未通过」不代表音源不支持该档位。
//   因此结果状态里专门保留 `unverified`，与真正的 `fail` 区分开。
//
// 参考实现：GZ_Music 2.2.2 的 LxQualityTestPlanKt / LxPluginTester
//   核心策略：按插件声明逐档**串行**，档位之间至少间隔 300ms，
//   只探测样本链接与少量资源，**不下载整首歌曲**。
//   本项目因 request.js 无法截断响应体，改用 fetch + Range 只读前 64KB。

import { getQualityLabel, isKnownQuality } from './quality'
import { getQualityLabelBySource, getQualityKeysBySource } from './qualityLabelBySource'

/** 单个档位的探测结果状态。 */
export type ProbeStatus =
  /** 通过：拿到可播放地址，且响应正常 */
  | 'pass'
  /** 未确认：拿到了 200 但无 URL，或该样本歌不提供此档位 —— 不代表音源不支持 */
  | 'unverified'
  /** 失败：明确的错误响应（403/404/500） */
  | 'fail'
  /** 超时 */
  | 'timeout'
  /** 该档位返回的是 HLS 播放列表（.m3u8），本项目不解析，需人工确认 */
  | 'needs-manual'
  /** 该音源压根没声明这个档位（不是错误，只是不支持） */
  | 'undeclared'

/** 检测模式。 */
export type ProbeMode =
  /** 快速：每个平台只测声明里最高的一档 */
  | 'quick'
  /** 全档：测声明里的全部档位 */
  | 'full'

/** 单条探测记录。 */
export interface ProbeEntry {
  source: string
  quality: string
  /** 展示用标签，如「大师音质」 */
  qualityLabel: string
  status: ProbeStatus
  /** 状态说明；失败/未确认时给出原因 */
  reason?: string
  /** 音频文件字节数（来自 Content-Length），仅 pass 时有意义 */
  sizeBytes?: number
  /** 本次探测耗时（毫秒） */
  elapsedMs: number
}

/** 单个平台的汇总。 */
export interface ProbePlatformSummary {
  source: string
  /** 平台展示名 */
  sourceName: string
  /** 该平台声明的档位总数 */
  declaredCount: number
  /** 通过的档位数 */
  passedCount: number
  /** 明细 */
  entries: ProbeEntry[]
  /** 该平台总耗时 */
  totalMs: number
}

/** 整体汇总。 */
export interface ProbeSummary {
  platforms: ProbePlatformSummary[]
  /** 有任意档位通过的平台数 */
  platformsWithPass: number
  /** 参与检测的平台总数 */
  platformCount: number
  /** 总耗时 */
  totalMs: number
}

/**
 * 档位从高到低的排序权重。
 *
 * 与 `QUALITY_RANK` 保持一致的语义，但额外覆盖 QUALITY_RANK 之外的键
 * （wav / ape / 192k），避免排序时把它们丢掉。
 */
const QUALITY_ORDER: Readonly<Record<string, number>> = {
  master: 1000,
  atmos_plus: 950,
  atmos: 900,
  hires: 800,
  flac: 700,
  wav: 650,
  ape: 600,
  '320k': 320,
  '192k': 192,
  '128k': 128,
}

/**
 * 档位排序权重。未知档位一律给 0，保证：
 *   · 不会被静默丢弃（排序仍保留）
 *   · 但排在所有已知档位之后
 */
export const qualityOrder = (quality: string): number => QUALITY_ORDER[quality] ?? 0

/** 按高→低排序档位（不修改入参）。 */
export const sortQualitiesDesc = (qualities: readonly string[]): string[] =>
  [...qualities].sort((a, b) => qualityOrder(b) - qualityOrder(a))

/**
 * 生成测试计划。
 *
 * 只接受「已声明」的档位 —— 音源没声明的档位不去测，避免无谓请求与被限流。
 *
 * @param declaredBySource 各平台声明的档位（来自 qualityList）
 * @param mode quick 只取每个平台最高一档；full 取全部
 * @returns 按平台分组、组内按档位从高到低
 */
/**
 * 检测结果里固定展示的平台，顺序即展示顺序。
 *
 * 为什么不动态从 declaredBySource 取：音源插件只声明它支持的平台，
 * 直接遍历会导致「不支持的平台整块消失」，用户无法知道该平台是
 * 「没测」还是「不支持」。固定列出，未声明的平台标注出来更有信息量。
 */
export const PROBE_ALL_SOURCES = ['wy', 'tx', 'kg', 'kw', 'mg'] as const

/**
 * 检测结果里固定展示的档位（高 → 低），全平台统一。
 *
 * 同理：每个平台声明的档位不同，若只显示声明过的，
 * 用户无法对比「这个平台缺哪一档」。
 */
export const PROBE_ALL_QUALITIES = [
  'master',
  'atmos_plus',
  'atmos',
  'hires',
  'flac',
  '320k',
  '192k',
  '128k',
] as const

/**
 * 生成测试计划。
 *
 * 现在覆盖**全部平台 × 全部档位**，不再只测声明过的组合：
 * 未声明的组合会标为「未声明」，让用户看到完整矩阵。
 *
 * @param declaredBySource 各平台声明的档位（来自 qualityList）
 * @param mode quick 只取每平台最高一档；full 取全部
 * @param onlyDeclared 为 true 时退回旧行为（只测声明过的），供调试用
 */
export const buildProbePlan = (
  declaredBySource: Partial<Record<string, readonly string[]>> | null | undefined,
  mode: ProbeMode,
  onlyDeclared = false,
): Array<{ source: string, qualities: string[] }> => {
  const declared = declaredBySource ?? {}

  // 旧的「只测声明过的」行为，保留以兼容测试
  if (onlyDeclared) {
    const plan: Array<{ source: string, qualities: string[] }> = []
    for (const source of Object.keys(declared).sort()) {
      const arr = declared[source]
      if (!Array.isArray(arr) || !arr.length) continue
      const sorted = sortQualitiesDesc(arr.filter(q => typeof q == 'string' && q.length > 0))
      if (!sorted.length) continue
      plan.push({ source, qualities: mode === 'quick' ? sorted.slice(0, 1) : sorted })
    }
    return plan
  }

  // 新行为：固定列出所有平台，每个平台用它**自己**的档位集合。
  //
  // 每个平台的档位不同（网易云 6 档、QQ 8 档、酷我 5 档…），
  // 因此不能用一份统一的档位全集去套所有平台 —— 那会把平台没有的档位
  // 也列出来，用户无法判断「这个平台究竟支不支持母带」。
  const plan: Array<{ source: string, qualities: string[] }> = []
  for (const source of PROBE_ALL_SOURCES) {
    // 优先用该平台的专属档位表；表里没有的平台退回通用全集
    const own = getQualityKeysBySource(source)
    const full = own.length ? own : [...PROBE_ALL_QUALITIES]
    const qualities = mode === 'quick' ? full.slice(0, 1) : [...full]
    plan.push({ source, qualities })
  }
  return plan
}

/** 根据 HTTP 状态码与是否拿到 URL 判定结果。 */
export const judgeProbe = (params: {
  hasUrl: boolean
  httpStatus?: number
  isHls?: boolean
  errorMessage?: string
  timedOut?: boolean
}): { status: ProbeStatus, reason?: string } => {
  if (params.timedOut) return { status: 'timeout', reason: '取链超时（未自动重试）' }
  if (!params.hasUrl) {
    return { status: 'unverified', reason: '接口返回成功但没有 URL（可能是该样本歌不提供此档位）' }
  }
  if (params.isHls) {
    return { status: 'needs-manual', reason: '返回 HLS 播放列表（.m3u8），本项目不解析' }
  }
  const status = params.httpStatus
  if (status == null) {
    return { status: 'unverified', reason: params.errorMessage ?? '未能获取响应' }
  }
  if (status >= 200 && status < 300) return { status: 'pass' }
  if (status === 403) return { status: 'fail', reason: 'HTTP 403 拒绝访问（可能需要鉴权或已限流）' }
  if (status === 404) return { status: 'fail', reason: 'HTTP 404 链接不存在' }
  if (status >= 500) return { status: 'fail', reason: `HTTP ${status} 服务端错误` }
  return { status: 'fail', reason: `HTTP ${status}` }
}

/** 是否为 HLS 地址。 */
export const isHlsUrl = (url: string): boolean => /\.m3u8(\?|$)/i.test(url)

/**
 * 汇总单平台的探测明细。
 */
export const summarizePlatform = (
  source: string,
  sourceName: string,
  declaredCount: number,
  entries: ProbeEntry[],
  totalMs: number,
): ProbePlatformSummary => ({
  source,
  sourceName,
  declaredCount,
  passedCount: entries.filter(e => e.status === 'pass').length,
  entries,
  totalMs,
})

/** 汇总整体结果。 */
export const summarizeProbe = (platforms: ProbePlatformSummary[]): ProbeSummary => ({
  platforms,
  platformsWithPass: platforms.filter(p => p.passedCount > 0).length,
  platformCount: platforms.length,
  totalMs: platforms.reduce((sum, p) => sum + p.totalMs, 0),
})

/**
 * 构造一条探测记录（统一填 qualityLabel）。
 */
export const makeEntry = (params: {
  source: string
  quality: string
  status: ProbeStatus
  reason?: string
  sizeBytes?: number
  elapsedMs: number
  translate?: (key: string) => string
}): ProbeEntry => ({
  source: params.source,
  quality: params.quality,
  // 按平台取真实名称（网易云「超清母带」/ QQ「大师音质」…），
  // 平台没有专属名称时回退到通用标签。
  qualityLabel: getQualityLabelBySource(params.source, params.quality, params.translate),
  status: params.status,
  reason: params.reason,
  sizeBytes: params.sizeBytes,
  elapsedMs: params.elapsedMs,
})

/** 把字节数格式化成可读字符串（如 102.1 MB）。 */
export const formatBytes = (bytes?: number): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** 把毫秒格式化成可读字符串（如 732ms / 5.2s）。 */
export const formatMs = (ms?: number): string => {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
