// WebDAV 同步的纯逻辑层（主/渲染可共用，便于隔离测试）。
// 复用自移动改良版 lx-netease-music-mobile 的 syncHelpers.ts / webdavSync.ts 语义，
// 仅保留桌面端确有对应能力、且可安全单测的部分；不引入 request / store / DOM / 网络。

/**
 * 同步时**绝不上云、也绝不从云端覆盖**的敏感设置键。
 *
 * 与移动端 SENSITIVE_SETTING_KEYS 相比，桌面端做了两点如实调整：
 * 1. 桌面端不存在 `common.wy_serpapi_key` / `common.yt_cookie`（不同音源能力），故不放；
 * 2. 保留 `common.wy_cookie` 与 `sync.webdav.password`——这两项在桌面端真实存在且必须保护。
 *
 * 另：桌面端 `common.tryAutoUpdate` 已由本项目的更新模块废弃（改为手动检查更新），
 * 它不是敏感键，无需过滤。
 */
export const WEBDAV_SENSITIVE_SETTING_KEYS = [
  'common.wy_cookie',
  'sync.webdav.password',
] as const

/**
 * 过滤掉敏感设置键，返回可安全上传/可安全应用的新对象（不修改入参）。
 * 用于「上传设置」「下载设置」两侧，确保凭据既不上云也不被云端覆盖。
 */
export const filterWebdavSensitiveSettings = <T extends Record<string, any>>(settings: T): Partial<T> => {
  const next: Record<string, any> = { ...settings }
  for (const key of WEBDAV_SENSITIVE_SETTING_KEYS) {
    delete next[key]
  }
  return next as Partial<T>
}

/** 规范化远端目录路径：保证以 `/` 开头、不以 `/` 结尾（根目录收敛为 `/`）。 */
export const normalizeRemoteBasePath = (path?: string | null): string => {
  const raw = (path ?? '').trim()
  if (!raw) return '/LX_Music'
  // 先收敛连续斜杠，再统一去掉首尾斜杠，避免路径中出现空段（如 `//a//b`）
  const cleaned = raw.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '')
  return cleaned ? `/${cleaned}` : ''
}

/**
 * 构建远端文件路径。
 * 与移动端一致：`/<cleanPath>/<fileName>`，默认目录 `/LX_Music/`。
 */
export const buildRemoteFilePath = (basePath: string | null | undefined, fileName: string): string => {
  const base = normalizeRemoteBasePath(basePath)
  return `${base}/${fileName}`
}

/** 远端三文件的固定文件名（与移动端保持一致，保证跨端可互读）。 */
export const WEBDAV_FILE_NAMES = {
  lists: 'playlists.json',
  settings: 'settings.json',
  userApis: 'user_apis.json',
} as const

export interface RemoteListsFile {
  version?: string
  lastModified: number
  data: any
  playHistory?: any[]
  downloadTasks?: any[]
}

/**
 * 判断一份 `data` 是否真的是「歌单数据」（ListDataFull）。
 *
 * 用于防止把手机端上传的 `settings.json` / `user_apis.json` 误认成歌单文件。
 * 歌单数据的特征是至少含 defaultList / loveList / userList 之一且为数组；
 * 设置数据是「键值对」，音源数据是 `{ list, scripts }`，两者都不满足该特征。
 */
export const isListsDataShape = (data: any): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return ['defaultList', 'loveList', 'userList'].some(key => Array.isArray(data[key]))
}

/**
 * 归一化远端 playlists.json 的内容。
 * - 缺失 / 非法 lastModified → 0（视为最旧，避免误判为「远端更新」）
 * - playHistory / downloadTasks 非数组 → undefined（不臆造空数据去覆盖本地）
 * - 缺失 data → 抛出明确错误，交由调用方提示，绝不静默写坏本地歌单
 * - data 不是歌单结构（例如被误放的设置/音源文件）→ 抛错，**绝不**用于覆盖本地歌单
 */
export const normalizeRemoteListsData = (raw: any): RemoteListsFile => {
  if (!raw || typeof raw !== 'object') throw new Error('invalid remote lists payload')
  if (!raw.data || typeof raw.data !== 'object') throw new Error('remote lists payload missing data')
  if (!isListsDataShape(raw.data)) throw new Error('remote payload is not list data')

  return {
    version: typeof raw.version === 'string' ? raw.version : undefined,
    lastModified: Number.isFinite(raw.lastModified) ? Number(raw.lastModified) : 0,
    data: raw.data,
    playHistory: Array.isArray(raw.playHistory) ? raw.playHistory : undefined,
    downloadTasks: Array.isArray(raw.downloadTasks) ? raw.downloadTasks : undefined,
  }
}

/**
 * 判断远端是否比本地记录的同步时间更新。
 * 语义与移动端一致：严格大于才算「远端更新」，相等时为「已最新」。
 */
export const isRemoteNewer = (remoteTimestamp: number, localTimestamp: number): boolean => {
  return (Number(remoteTimestamp) || 0) > (Number(localTimestamp) || 0)
}

/** 是否为「本设备首次同步」（本地无同步记录）。 */
export const isFirstSync = (localTimestamp: number): boolean => {
  return !(Number(localTimestamp) || 0)
}

/**
 * 校验远端设置对象是否可安全应用（实现在文件末尾，依赖 sanitizeRemoteSettingsForDesktop）。
 * 仅做转发，定义顺序在下方以保证常量已初始化。
 */

/**
 * 计算歌单内容指纹（用于判断「本地是否有未上传的改动」）。
 *
 * 为什么需要它：
 *   原实现只比较 `lastSyncTimeLists`（上次与云端交互的时间）与远端 `lastModified`。
 *   但**本地改动不会更新 lastSyncTimeLists**，于是「本地加了一首歌」这件事
 *   在时间戳上完全看不出来；若此时远端时间戳更大（例如手机端传过），
 *   就会被误判成「云端较新」，弹出「下载会覆盖本地」——把用户刚做的改动判成了过时数据。
 *
 * 指纹只取「结构」不取「易变字段」：
 *   · 列表 id / 名称 / 顺序
 *   · 每首歌的 id 与顺序
 * 忽略 playCount、更新时间、封面 URL 等元数据，避免仅仅刷新过信息就误判为「内容变了」。
 *
 * 该值为纯字符串，不写进远端文件，**对手机端完全透明**。
 */
export const computeListsHash = (lists: {
  defaultList?: any[]
  loveList?: any[]
  userList?: any[]
} | null | undefined): string => {
  const ids = (arr: any): string =>
    Array.isArray(arr) ? arr.map(m => String(m?.id ?? '')).join(',') : ''

  const parts: string[] = []
  parts.push('d:', ids(lists?.defaultList))
  parts.push('l:', ids(lists?.loveList))

  // 按 id 排序，避免「仅调整歌单顺序」被误判为内容变化
  const sorted = [...(Array.isArray(lists?.userList) ? lists.userList : [])]
    .sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
  for (const l of sorted) {
    parts.push(`u:${String(l?.id ?? '')}:${String(l?.name ?? '')}:${ids(l?.list)}`)
  }
  return parts.join('|')
}

/** 同步决策结果。 */
export type SyncDecision =
  /** 本地有未上传改动 → 直接上传，不参与「远端较新」比较 */
  | 'upload-local-changed'
  /** 老用户首次升级（无历史指纹）→ 只记录指纹，本次行为与旧版一致 */
  | 'init-hash'
  /** 远端没有被比较的意义（时间戳更旧或相等）→ 上传 */
  | 'upload'
  /** 远端较新 → 需要用户决定（手动）/ 静默跳过（自动） */
  | 'remote-newer'

/**
 * 决定本次同步该做什么。
 *
 * 纯函数，不读写设置、不发网络请求，便于完整覆盖各分支。
 *
 * @param currentHash 当前本地歌单内容指纹
 * @param lastHash 上次成功同步时记录的指纹（老用户升级后为空字符串）
 * @param remoteTimestamp 远端 lastModified
 * @param localTimestamp 本地记录的上次同步时间
 */
export const decideSyncAction = (
  currentHash: string,
  lastHash: string,
  remoteTimestamp: number,
  localTimestamp: number,
): SyncDecision => {
  // 老用户首次升级：指纹为空。此时**不能**当作「本地有改动」，
  // 否则第一次同步就会强制上传、覆盖手机端数据。
  // 只记录指纹并沿用旧逻辑，保证升级瞬间行为与旧版完全一致。
  if (!lastHash) return 'init-hash'

  // 本地内容与上次同步时不同 → 本地确实有未上传的改动，本地优先
  if (currentHash !== lastHash) return 'upload-local-changed'

  // 内容没变：此时才可以安全地用时间戳判断远端是否有新数据
  return isRemoteNewer(remoteTimestamp, localTimestamp) ? 'remote-newer' : 'upload'
}

/**
 * 统计本地列表数据的基本信息，用于同步前的可读提示（不参与写入）。
 */
export const summarizeListsForSync = (lists: {
  defaultList?: any[]
  loveList?: any[]
  userList?: any[]
  tempList?: any[]
} | null | undefined): { defaultCount: number, loveCount: number, userListCount: number, totalSongs: number } => {
  const defaultCount = Array.isArray(lists?.defaultList) ? lists!.defaultList.length : 0
  const loveCount = Array.isArray(lists?.loveList) ? lists!.loveList.length : 0
  const userList = Array.isArray(lists?.userList) ? lists!.userList : []
  let totalSongs = defaultCount + loveCount
  for (const list of userList) {
    if (Array.isArray(list?.list)) totalSongs += list.list.length
  }
  return { defaultCount, loveCount, userListCount: userList.length, totalSongs }
}

/**
 * 把底层 WebDAV/网络错误转成用户可读的中文提示。
 *
 * 纯函数：仅依赖 error 的 status/message，不读取任何配置，也不输出凭据。
 * 放在 common 层是为了可被隔离测试覆盖（renderer 侧只做转发）。
 */
export const describeWebdavError = (error: any): string => {
  const status = error?.status
  const rawMsg = String(error?.message ?? error ?? '未知错误')

  if (status === 401 || /401|Unauthorized/i.test(rawMsg)) return '认证失败：用户名或密码不正确'
  if (status === 403 || /403|Forbidden/i.test(rawMsg)) return '无权限访问该路径'
  if (status === 404) return '服务器地址或路径不存在（404）'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(rawMsg)) return '无法解析服务器地址，请检查 URL'
  if (/ECONNREFUSED/i.test(rawMsg)) return '连接被拒绝，请检查地址与端口'
  if (/ETIMEDOUT|timeout|timed out/i.test(rawMsg)) return '连接超时，请检查网络或服务器'
  if (/CERT|SSL|TLS/i.test(rawMsg)) return '证书/HTTPS 校验失败，请检查证书或改用 http'
  return `请求失败：${rawMsg}`
}

/**
 * 规整从云端下载的设置，使其可安全应用到桌面端。
 *
 * 除了过滤敏感键，还要处理**跨端标识差异**：
 *   - 移动端语言标识是 `zh_cn` / `zh_tw`（下划线），桌面端是 `zh-cn` / `zh-tw`（连字符）。
 *     直接把 `zh_cn` 写进桌面端设置会让 i18n 找不到语言包并导致界面崩溃（已实测）。
 *     因此这里统一把下划线换成连字符。
 *   - `audio` 相关键（如移动端语言标识之外的端侧专属配置）不在过滤名单内，
 *     但语言这一项必须有明确映射，否则用户同步一次就白屏。
 *
 * 注意：本函数只做「键值层面的安全化」，不猜测桌面端没有的功能键；
 * 桌面端 mergeSetting 会忽略未知键（已核实 updateSetting 走 mergeSetting）。
 */
export const sanitizeRemoteSettingsForDesktop = (data: Record<string, any>): Record<string, any> => {
  const next = { ...filterWebdavSensitiveSettings(data) } as Record<string, any>

  const langId = next['common.langId']
  if (typeof langId === 'string') {
    // zh_cn → zh-cn；同时把其余下划线形式统一为连字符（en_us → en-us）
    const normalized = langId.replace(/_/g, '-').toLowerCase()
    next['common.langId'] = normalized
  }

  return next
}

/**
 * 校验远端设置对象是否可安全应用。
 * 只接受普通对象；过滤敏感键并规整跨端语言标识差异后返回。
 * 非法输入抛出错误（不静默覆盖本地设置）。
 */
export const parseRemoteSettingsForApply = (raw: any): Partial<Record<string, any>> => {
  if (!raw || typeof raw !== 'object') throw new Error('invalid remote settings payload')
  const data = raw.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('remote settings payload missing data')
  return sanitizeRemoteSettingsForDesktop(data)
}