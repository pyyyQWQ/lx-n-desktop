// WebDAV 客户端封装。
// 复用自移动改良版 lx-netease-music-mobile 的 src/utils/webdav.ts（逐级建目录、
// 404/409 视为「不存在」、stat 兜底），仅把设置读取方式与日志替换为桌面端实现。
// 本文件只做传输，不含任何同步策略；策略在 core/sync/webdavSync.ts。
import { createClient } from 'webdav'
import type { FileStat, WebDAVClient } from 'webdav'
import { appSetting } from '@renderer/store/setting'
import { describeWebdavError as commonDescribeWebdavError } from '@common/utils/webdavSync'

let client: WebDAVClient | null = null
let clientKey = ''

/** 用于日志的最简配置摘要——绝不包含密码。 */
const describeConfig = () => {
  const url = appSetting['sync.webdav.url'] || ''
  const hasUser = !!appSetting['sync.webdav.username']
  let host = ''
  try {
    host = url ? new URL(url).host : ''
  } catch (_) {
    host = ''
  }
  return `host=${host || '(invalid)'} user=${hasUser ? 'set' : 'empty'}`
}

const getConfigKey = () => [
  appSetting['sync.webdav.url'] || '',
  appSetting['sync.webdav.username'] || '',
  appSetting['sync.webdav.password'] || '',
].join('\u0000')

/** WebDAV 客户端（按配置缓存；配置变化时自动重建）。 */
export const getWebdavClient = (): WebDAVClient | null => {
  const url = appSetting['sync.webdav.url'] || ''
  const username = appSetting['sync.webdav.username'] || ''
  const password = appSetting['sync.webdav.password'] || ''

  if (!url || !username) return null

  const nextKey = getConfigKey()
  if (client && clientKey === nextKey) return client

  client = createClient(url, { username, password })
  clientKey = nextKey
  return client
}

/** 配置变更后调用，丢弃缓存的客户端。 */
export const resetWebdavClient = () => {
  client = null
  clientKey = ''
}

/** 配置是否足以发起请求（URL + 用户名）。 */
export const isWebdavConfigured = () => {
  return !!(appSetting['sync.webdav.url'] && appSetting['sync.webdav.username'])
}

/**
 * 测试连接：读取根目录列表。
 * 成功返回 true；未配置抛错；认证失败等异常向上抛，由调用方给出针对性提示。
 */
export const testWebdavConnection = async(): Promise<boolean> => {
  const cli = getWebdavClient()
  if (!cli) throw new Error('WebDAV 未配置（缺少服务器地址或用户名）')
  await cli.getDirectoryContents('/')
  return true
}

/**
 * 逐级创建目录，兼容不支持递归创建的服务器。
 * 原样复用移动端 ensureDirectoryExists 的逐级策略。
 */
const ensureDirectoryExists = async(cli: WebDAVClient, dirPath: string): Promise<void> => {
  if (!dirPath || dirPath === '/') return

  const segments = dirPath.split('/').filter(Boolean)
  let currentPath = ''

  for (const segment of segments) {
    currentPath += `/${segment}`
    try {
      if (!(await cli.exists(currentPath))) {
        await cli.createDirectory(currentPath)
      }
    } catch (error: any) {
      throw new Error(`创建目录 ${currentPath} 失败: ${error?.message ?? error}`)
    }
  }
}

/** 上传文本文件；父目录不存在时自动逐级创建。 */
export const uploadFile = async(path: string, content: string): Promise<void> => {
  const cli = getWebdavClient()
  if (!cli) throw new Error('WebDAV 未配置')

  const dirPath = path.substring(0, path.lastIndexOf('/'))
  await ensureDirectoryExists(cli, dirPath)
  await cli.putFileContents(path, content, { overwrite: true })
}

/**
 * 下载文本文件；不存在（404/409）返回 null（这是预期分支，不是错误）。
 * 其他错误向上抛，避免把「权限/网络故障」误当成「云端没有数据」而静默上传覆盖。
 */
export const downloadFile = async(path: string): Promise<string | null> => {
  const cli = getWebdavClient()
  if (!cli) throw new Error('WebDAV 未配置')
  try {
    const content = await cli.getFileContents(path, { format: 'text' })
    return typeof content === 'string' ? content : String(content)
  } catch (error: any) {
    if (error?.status === 404 || error?.status === 409) return null
    throw error
  }
}

/** 获取文件状态；不存在返回 null。 */
export const getStat = async(path: string): Promise<FileStat | null> => {
  const cli = getWebdavClient()
  if (!cli) throw new Error('WebDAV 未配置')
  try {
    return await cli.stat(path) as FileStat
  } catch (error: any) {
    if (error?.status === 404 || error?.status === 409) return null
    throw error
  }
}

/**
 * 把底层错误转成用户可读的中文提示（实现在 @common/utils/webdavSync，便于隔离测试）。
 * 不包含任何凭据信息。
 */
export const describeWebdavError = commonDescribeWebdavError

/** 日志用的配置摘要（不含密码），供调试输出。 */
export const getWebdavConfigSummary = describeConfig
