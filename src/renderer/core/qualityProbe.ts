// 音源音质档位检测 —— 执行层（含网络请求）。
//
// 策略（参考 GZ_Music 2.2.2 的 LxPluginTester）：
//   · 按插件声明的档位**逐档串行**，档位之间至少间隔 intervalMs（默认 300ms），避免被限流
//   · 取到播放地址后，**只读响应头 + 前 64KB**，不下载整首歌曲
//   · 单档超时独立，失败不自动重试
//   · 跳过 HLS：遇到 .m3u8 标记为 needs-manual，不去解析索引
//
// 为什么不复用 request.js：
//   它的实现是 `resp.body = resp.raw.toString()`，会把整个响应体读进内存。
//   用它探测一首 175MB 的母带就是真的下载 175MB。
//   因此这里直接用 fetch + Range，拿到 content-length 后立即 cancel。
import musicSdk from '@renderer/utils/musicSdk'
import { toOldMusicInfo, toNewMusicInfo } from '@renderer/utils'
import {
  buildProbePlan,
  judgeProbe,
  isHlsUrl,
  makeEntry,
  summarizePlatform,
  summarizeProbe,
} from '@common/utils/qualityProbe'
import type {
  ProbeEntry,
  ProbeMode,
  ProbePlatformSummary,
  ProbeSummary,
} from '@common/utils/qualityProbe'

/** 默认单档超时。 */
const DEFAULT_TIMEOUT_MS = 15000
/** 默认档位间隔。 */
const DEFAULT_INTERVAL_MS = 300
/** 只读前 64KB 用于确认响应可用（不读完整文件）。 */
const HEADER_PROBE_BYTES = 65536

export interface ProbeOptions {
  timeoutMs?: number
  intervalMs?: number
  /**
   * 公用的样本歌（全平台共用同一首）。
   * 各平台的 samplemid 由 resolveSample 用该平台自己的搜索接口解析出来；
   * 为 null 时全部平台跳过。
   */
  sample: LX.Music.MusicInfoOnline | null
  /**
   * 各平台声明的档位。用于区分「该平台根本没声明这一档」与「声明了但取链失败」——
   * 前者不是错误，单独标为 undeclared 更有信息量。
   */
  declaredBySource?: Partial<Record<string, readonly string[]>>
  /** 进度回调 */
  onProgress?: (payload: { platformIndex: number, platformCount: number, entry?: ProbeEntry }) => void
  /** 中止信号 */
  signal?: AbortSignal
}

/**
 * 把「只有歌名的样本」解析成音源真正认得的歌曲对象。
 *
 * 为什么必须做这一步：各音源取链用的是 `songInfo.songmid`（平台内部 ID），
 * 不是歌名。用户只填「晴天」，若直接把歌名当 songmid，接口会返回
 * 「200 but no URL」——这正是实测到的「通过 0 个档位」。
 *
 * 解析策略：用该平台自己的搜索接口按「歌名 + 歌手」搜一次，取第一条结果的
 * songmid 与完整元信息。搜索失败或无结果时，退回用原样传入的对象，
 * 让上层如实报「未确认」，而不是伪装成失败。
 */
export const resolveSample = async(params: {
  source: string
  sample: LX.Music.MusicInfoOnline
  timeoutMs?: number
}): Promise<{ info: LX.Music.MusicInfoOnline, resolved: boolean, reason?: string }> => {
  const { source, sample } = params
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // 只有当样本自带一个「看起来像平台真实 ID」的 songmid 时才跳过搜索。
  //
  // 注意：UI 传进来的样本是裸对象，songmid 常常被填成歌名（用户只填了歌名），
  // 之前用「songmid 存在且不等于 name」判断会误判为已解析，导致把歌名当 ID
  // 发给音源插件，插件抛「音乐 ID 不存在」——因此这里要求 ID 必须是
  // 「非空、不等于歌名、也不像纯中文」的字符串，否则一律走搜索。
  const rawSongmid = (sample as any)?.songmid
  const name = String(sample?.name ?? '').trim()
  const idLike = typeof rawSongmid == 'string' || typeof rawSongmid == 'number'
    ? String(rawSongmid).trim()
    : ''
  const looksLikeRealId = idLike.length > 0
    && idLike !== name
    // 纯中文/纯字母歌名不可能是平台数字 ID；含数字或以字母数字混合才可能是
    && /[0-9A-Za-z]/.test(idLike)
    && !/^[\u4e00-\u9fa5\s]+$/.test(idLike)
  if (looksLikeRealId) {
    return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: true }
  }

  const keyword = [sample?.name, (sample as any)?.singer].filter(Boolean).join(' ').trim()
  if (!keyword) return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: false, reason: '样本歌缺少名称' }

  try {
    const sdk = (musicSdk as any)[source]
    const searchApi = sdk?.musicSearch
    if (!searchApi?.search) {
      return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: false, reason: `音源 ${source} 未提供搜索接口` }
    }

    const result = await Promise.race([
      searchApi.search(keyword, 1, 5),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('__timeout__')), timeoutMs)),
    ]) as { list?: any[] }

    const first = result?.list?.[0]
    if (!first?.songmid) {
      return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: false, reason: `搜索「${keyword}」无结果` }
    }

    // 用搜索结果构造完整歌曲对象：搜索返回的是旧结构（songmid/types），
    // 转成 MusicInfoOnline 供取链使用。
    const info = toNewMusicInfo(first) as LX.Music.MusicInfoOnline
    return { info, resolved: true }
  } catch (err: any) {
    if (err?.message === '__timeout__') return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: false, reason: '样本歌搜索超时' }
    return { info: { ...sample, source } as LX.Music.MusicInfoOnline, resolved: false, reason: `样本歌搜索失败：${String(err?.message ?? err).slice(0, 100)}` }
  }
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('aborted'))
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, ms)
  const onAbort = () => {
    clearTimeout(timer)
    reject(new Error('aborted'))
  }
  signal?.addEventListener('abort', onAbort, { once: true })
})

/**
 * 探测一个档位。
 *
 * @returns 探测记录（不会 reject —— 所有错误都转成状态）
 */
export const probeOneQuality = async(params: {
  source: string
  quality: string
  sample: LX.Music.MusicInfoOnline
  timeoutMs?: number
  translate?: (key: string) => string
}): Promise<ProbeEntry> => {
  const { source, quality, sample, translate } = params
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()

  const finish = (status: ProbeEntry['status'], reason?: string, sizeBytes?: number): ProbeEntry =>
    makeEntry({ source, quality, status, reason, sizeBytes, elapsedMs: Date.now() - startedAt, translate })

  // 1) 取播放地址
  let url = ''
  try {
    const sdk = (musicSdk as any)[source]
    if (!sdk?.getMusicUrl) return finish('fail', `音源 ${source} 未提供取链接口`)

    const req = sdk.getMusicUrl(toOldMusicInfo(sample), quality)
    const res = await Promise.race([
      req.promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('__timeout__')), timeoutMs)),
    ]) as { url?: string }

    url = res?.url ?? ''
    // 取链期间用户可能取消 → 尽量释放
    if (!url && req.canceleFn) req.canceleFn()
  } catch (err: any) {
    if (err?.message === '__timeout__') return finish('timeout')
    const msg = String(err?.message ?? err)
    // 「音乐 ID 不存在」属于样本无效，换档位也没用 → 标记为致命，上层直接跳过该平台
    if (/音乐\s*ID\s*不存在|ID\s*不存在|invalid.*(song)?id/i.test(msg)) {
      return finish('fail', `样本歌无效（${msg.slice(0, 80)}），已跳过该平台其余档位`)
    }
    return finish('fail', msg.slice(0, 200))
  }

  // 2) 没拿到地址：可能是该样本歌不提供此档位，不判 fail
  if (!url) {
    const judged = judgeProbe({ hasUrl: false })
    return finish(judged.status, judged.reason)
  }

  // 3) HLS：本项目不解析，标记为需人工确认
  if (isHlsUrl(url)) {
    const judged = judgeProbe({ hasUrl: true, isHls: true })
    return finish(judged.status, judged.reason)
  }

  // 4) 只读响应头 + 少量字节，确认链接真的可用
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_PROBE_BYTES - 1}` },
      signal: controller.signal,
      // 音频直链不需要 cookie
      credentials: 'omit',
    })
    const contentLength = Number(res.headers.get('content-length')) || undefined
    const totalLength = parseContentRangeTotal(res.headers.get('content-range')) ?? contentLength

    // 读到一小段就断开，绝不下载完整文件
    try { await res.body?.cancel() } catch (_) {}

    const judged = judgeProbe({ hasUrl: true, httpStatus: res.status })
    return finish(judged.status, judged.reason, judged.status === 'pass' ? totalLength : undefined)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const judged = judgeProbe({ hasUrl: true, timedOut: true })
      return finish(judged.status, judged.reason)
    }
    const judged = judgeProbe({ hasUrl: true, errorMessage: String(err?.message ?? err) })
    return finish(judged.status, judged.reason)
  } finally {
    clearTimeout(timer)
  }
}

/** 从 `Content-Range: bytes 0-65535/102400000` 里取总长度。 */
const parseContentRangeTotal = (value: string | null): number | undefined => {
  if (!value) return undefined
  const m = /\/(\d+)\s*$/.exec(value)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * 执行完整检测。
 *
 * @returns 汇总结果；被中止时抛出 `aborted`
 */
export const runProbe = async(
  declaredBySource: Partial<Record<string, readonly string[]>>,
  mode: ProbeMode,
  options: ProbeOptions,
): Promise<ProbeSummary> => {
  const plan = buildProbePlan(declaredBySource, mode)
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const platforms: ProbePlatformSummary[] = []

  for (let pi = 0; pi < plan.length; pi++) {
    if (options.signal?.aborted) throw new Error('aborted')
    const item = plan[pi]
    const sample = options.sample
    const startedAt = Date.now()

    // 没有样本歌 → 该平台整体跳过，明确记录原因
    if (!sample) {
      const placeholder = item.qualities.map(q =>
        makeEntry({
          source: item.source,
          quality: q,
          status: 'fail',
          reason: '未配置该平台的样本歌',
          elapsedMs: 0,
        }),
      )
      platforms.push(summarizePlatform(item.source, item.source, item.qualities.length, placeholder, 0))
      options.onProgress?.({ platformIndex: pi, platformCount: plan.length })
      continue
    }

    // 同一首样本在不同平台有不同的内部 ID，必须按平台各自解析一次。
    const resolved = await resolveSample({ source: item.source, sample, timeoutMs })
    if (!resolved.resolved) {
      const entries = item.qualities.map(q =>
        makeEntry({
          source: item.source,
          quality: q,
          status: 'unverified',
          reason: resolved.reason ?? '样本歌无法解析',
          elapsedMs: 0,
        }),
      )
      platforms.push(summarizePlatform(item.source, item.source, item.qualities.length, entries, Date.now() - startedAt))
      options.onProgress?.({ platformIndex: pi, platformCount: plan.length })
      continue
    }
    // 强制把 source 对齐到当前探测的平台：
    // 全局样本的 source 是空的，而 toOldMusicInfo 会把它带下去，
    // 不少音源插件会校验 source 与自身一致，为空会直接失败。
    const usableSample = { ...resolved.info, source: item.source } as LX.Music.MusicInfoOnline

    const declaredList = options.declaredBySource?.[item.source]
    const declaredSet = new Set(Array.isArray(declaredList) ? declaredList : [])

    const entries: ProbeEntry[] = []
    for (let qi = 0; qi < item.qualities.length; qi++) {
      if (options.signal?.aborted) throw new Error('aborted')

      // 该音源没声明这一档 → 直接标 undeclared，不发请求。
      // 这不是失败，只是该平台不提供，如实呈现比隐藏更有信息量。
      if (declaredSet.size > 0 && !declaredSet.has(item.qualities[qi])) {
        entries.push(makeEntry({
          source: item.source,
          quality: item.qualities[qi],
          status: 'undeclared',
          reason: '该音源未声明此档位',
          elapsedMs: 0,
        }))
        options.onProgress?.({ platformIndex: pi, platformCount: plan.length, entry: entries[entries.length - 1] })
        continue
      }

      // 档位之间间隔，第一档不等待
      if (qi > 0) await sleep(intervalMs, options.signal)

      const entry = await probeOneQuality({
        source: item.source,
        quality: item.qualities[qi],
        sample: usableSample,
        timeoutMs,
      })
      entries.push(entry)
      options.onProgress?.({ platformIndex: pi, platformCount: plan.length, entry })

      // 样本本身无效时，后续档位必然同样失败，直接剪断，避免刷屏报错
      if (qi === 0 && entry.status === 'fail' && /样本歌无效/.test(entry.reason ?? '')) {
        for (let rest = qi + 1; rest < item.qualities.length; rest++) {
          entries.push(makeEntry({
            source: item.source,
            quality: item.qualities[rest],
            status: 'fail',
            reason: '已跳过（样本歌无效）',
            elapsedMs: 0,
          }))
        }
        break
      }
    }

    platforms.push(summarizePlatform(
      item.source,
      item.source,
      item.qualities.length,
      entries,
      Date.now() - startedAt,
    ))
  }

  return summarizeProbe(platforms)
}

export { HEADER_PROBE_BYTES, DEFAULT_INTERVAL_MS, DEFAULT_TIMEOUT_MS }
