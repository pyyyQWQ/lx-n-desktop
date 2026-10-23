// WebDAV 数据同步核心。**只同步歌单**。
//
// 复用来源：移动改良版 lx-netease-music-mobile 的 src/core/sync/webdavSync.ts（同步语义、
// 冲突判定、首次同步询问、远端文件契约），并按桌面端 v1.0 架构做了**必要且最小**的适配：
//
// 1. 列表读写改用桌面端 `getListMusics` / `overwriteListFull`（契约与移动端 ListDataFull 一致）；
// 2. 桌面端**没有播放历史**、下载任务模型不同 → 上传不携带这两个字段，下载忽略它们
//    （绝不用空值覆盖手机端已有数据，也不做有损转换）；
// 3. **不同步「设置」与「自定义音源」**（按用户 2026-10-23 决定放弃该功能）：
//    桌面端既不读也不写 settings.json / user_apis.json。
//    仅在同步目录下读写 playlists.json，手机端上传的另外两个文件被**完全忽略**。
//    此外 normalizeRemoteListsData 会校验 data 是不是歌单结构，
//    万一 playlists.json 被误写成设置/音源内容，也会拒绝应用，避免破坏本地歌单。
// 4. UI 依赖改为桌面端 dialog / toast / i18n。
//
// 未复用：opQueue 逐操作合并、debounce 自动同步增量。原因：桌面端没有对应操作队列与
// applyListOperation，强行移植会引入未经实机验证的冲突合并路径。改为「远端较新则整体覆盖、
// 本地较新则整体上传」，并在覆盖前强制确认，避免静默丢数据。
import {
  buildRemoteFilePath,
  WEBDAV_FILE_NAMES,
  normalizeRemoteListsData,
  isRemoteNewer,
  isFirstSync,
  summarizeListsForSync,
} from '@common/utils/webdavSync'
import { toRaw } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { dialog } from '@renderer/plugins/Dialog'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListMusics, overwriteListFull } from '@renderer/store/list/action'
import { toast } from '@renderer/plugins/Tips/toast'
import {
  downloadFile,
  uploadFile,
  testWebdavConnection,
  resetWebdavClient,
  isWebdavConfigured,
  describeWebdavError,
} from '@renderer/utils/webdav'

// i18n 取值封装：键名在编译期无法逐一枚举（按需动态传入），
// 因此在此收敛为宽松签名，避免把类型噪声扩散到每个调用点。
const t = (key: string, params?: Record<string, any>): string =>
  (window.i18n.t as (k: string, p?: Record<string, any>) => string)(key, params)

let isSyncing = false

/** 是否正在同步（供 UI 禁用按钮）。 */
export const getIsSyncing = () => isSyncing

const getRemoteListsPath = () => buildRemoteFilePath(appSetting['sync.webdav.path'], WEBDAV_FILE_NAMES.lists)

/**
 * 汇总本地全部列表（与移动端 getAllDataForSync 的 lists 部分同构）。
 * 契约：{ defaultList, loveList, userList, tempList }
 */
const getAllListsForSync = async() => {
  const dl = await getListMusics(defaultList.id).then(musics => toRaw(musics))
  const ll = await getListMusics(loveList.id).then(musics => toRaw(musics))
  const userList: any[] = []
  for (const list of userLists) {
    const musics = await getListMusics(list.id).then(m => toRaw(m))
    userList.push({ ...toRaw(list), list: musics })
  }
  return {
    defaultList: dl,
    loveList: ll,
    userList,
    tempList: [] as any[],
  }
}

/** 上传歌单到远端（不携带 playHistory / downloadTasks，避免覆盖手机端已有内容）。 */
const uploadLists = async() => {
  const timestamp = Date.now()
  const data = await getAllListsForSync()
  const payload = {
    version: '2',
    lastModified: timestamp,
    data,
  }
  await uploadFile(getRemoteListsPath(), JSON.stringify(payload))
  updateSetting({ 'sync.webdav.lastSyncTimeLists': timestamp })
  return timestamp
}
/** 把远端列表数据应用到本地（覆盖）。 */
const applyRemoteLists = async(remoteData: any) => {
  await overwriteListFull(remoteData as LX.List.ListActionDataOverwrite)
}

const requireConfigured = () => {
  if (!appSetting['sync.webdav.enable']) {
    toast(t('setting__sync_webdav_need_enable'))
    return false
  }
  if (!isWebdavConfigured()) {
    toast(t('setting__sync_webdav_need_config'))
    return false
  }
  return true
}

const guardSyncing = () => {
  if (isSyncing) {
    toast(t('setting__sync_webdav_syncing'))
    return false
  }
  return true
}

/** 测试连接（供设置页按钮调用）。 */
export const handleTestConnection = async(): Promise<{ ok: boolean, message: string }> => {
  if (!isWebdavConfigured()) {
    return { ok: false, message: t('setting__sync_webdav_need_config') }
  }
  try {
    resetWebdavClient()
    await testWebdavConnection()
    return { ok: true, message: t('setting__sync_webdav_test_ok') }
  } catch (error: any) {
    return { ok: false, message: describeWebdavError(error) }
  }
}

/**
 * 手动「上传歌单」：本地 → 云端，覆盖远端。高风险，必须确认。
 */
export const manualUploadLists = async() => {
  if (!guardSyncing() || !requireConfigured()) return
  const summary = summarizeListsForSync(await getAllListsForSync())
  const confirm = await dialog({
    message: t('setting__sync_webdav_confirm_upload_lists', {
      songs: summary.totalSongs,
      lists: summary.userListCount,
    }),
    confirmButtonText: t('setting__sync_webdav_upload'),
    cancelButtonText: t('setting__sync_webdav_cancel'),
    showCancel: true,
  })
  if (!confirm) return

  isSyncing = true
  try {
    await uploadLists()
    toast(t('setting__sync_webdav_upload_lists_ok'))
  } catch (error: any) {
    console.error('[WebDAV] upload lists failed:', describeWebdavError(error))
    toast(t('setting__sync_webdav_upload_failed', { message: describeWebdavError(error) }))
  } finally {
    isSyncing = false
  }
}

/**
 * 手动「下载歌单」：云端 → 本地，覆盖本地。高风险，必须确认。
 */
export const manualDownloadLists = async() => {
  if (!guardSyncing() || !requireConfigured()) return
  const confirm = await dialog({
    message: t('setting__sync_webdav_confirm_download_lists'),
    confirmButtonText: t('setting__sync_webdav_download'),
    cancelButtonText: t('setting__sync_webdav_cancel'),
    showCancel: true,
  })
  if (!confirm) return

  isSyncing = true
  try {
    const content = await downloadFile(getRemoteListsPath())
    if (!content) {
      toast(t('setting__sync_webdav_no_remote_lists'))
      return
    }
    const remoteData = normalizeRemoteListsData(JSON.parse(content))
    await applyRemoteLists(remoteData.data)
    updateSetting({ 'sync.webdav.lastSyncTimeLists': remoteData.lastModified })
    toast(t('setting__sync_webdav_download_lists_ok'))
  } catch (error: any) {
    console.error('[WebDAV] download lists failed:', describeWebdavError(error))
    toast(t('setting__sync_webdav_download_failed', { message: describeWebdavError(error) }))
  } finally {
    isSyncing = false
  }
}

/**
 * 主同步流程（手动触发；也可在启动时自动调用一次）。
 *
 * 语义（对齐移动端）：
 * - 远端无文件 → 上传本地；
 * - 本设备首次同步且远端有数据 → 弹窗让用户选择方向（不可静默覆盖任何一方）；
 * - 远端较新 → 提示并下载覆盖本地（需确认）；
 * - 本地较新/相等 → 上传本地（本地为唯一来源时也直接上传）。
 *
 * 与移动端差异：不做逐操作合并（桌面端无 opQueue），因此所有「覆盖」方向都先确认。
 */
export const syncLists = async(isManual = false): Promise<void> => {
  if (!guardSyncing()) return
  if (isManual && !requireConfigured()) return
  if (!appSetting['sync.webdav.enable'] || !isWebdavConfigured()) return

  isSyncing = true
  try {
    const remotePath = getRemoteListsPath()
    const content = await downloadFile(remotePath)

    // 1) 远端没有歌单文件：上传本地作为初始数据
    if (!content) {
      await uploadLists()
      if (isManual) toast(t('setting__sync_webdav_upload_lists_ok'))
      return
    }

    const remoteData = normalizeRemoteListsData(JSON.parse(content))
    const remoteTimestamp = remoteData.lastModified
    const localTimestamp = Number(appSetting['sync.webdav.lastSyncTimeLists']) || 0

    // 2) 本设备首次同步且云端已有数据：让用户决定方向
    if (isFirstSync(localTimestamp)) {
      const choice = await dialog({
        message: t('setting__sync_webdav_first_sync_tip'),
        confirmButtonText: t('setting__sync_webdav_upload_local'),
        cancelButtonText: t('setting__sync_webdav_download_remote'),
        showCancel: true,
      })
      if (choice) {
        await uploadLists()
        toast(t('setting__sync_webdav_upload_lists_ok'))
      } else {
        await applyRemoteLists(remoteData.data)
        updateSetting({ 'sync.webdav.lastSyncTimeLists': remoteTimestamp })
        toast(t('setting__sync_webdav_download_lists_ok'))
      }
      return
    }

    // 3) 远端较新：确认后覆盖本地（防止静默丢失本地改动）
    if (isRemoteNewer(remoteTimestamp, localTimestamp)) {
      const confirm = await dialog({
        message: t('setting__sync_webdav_remote_newer_tip'),
        confirmButtonText: t('setting__sync_webdav_download'),
        cancelButtonText: t('setting__sync_webdav_cancel'),
        showCancel: true,
      })
      if (!confirm) {
        if (isManual) toast(t('setting__sync_webdav_cancelled'))
        return
      }
      await applyRemoteLists(remoteData.data)
      updateSetting({ 'sync.webdav.lastSyncTimeLists': remoteTimestamp })
      toast(t('setting__sync_webdav_download_lists_ok'))
      return
    }

    // 4) 本地为最新（或同时间戳）：上传本地
    await uploadLists()
    if (isManual) toast(t('setting__sync_webdav_upload_lists_ok'))
  } catch (error: any) {
    const msg = describeWebdavError(error)
    console.error('[WebDAV] sync failed:', msg)
    toast(t('setting__sync_webdav_sync_failed', { message: msg }))
  } finally {
    isSyncing = false
  }
}

/** 启动时调用：仅在「启用 + 自动同步歌单」时后台触发一次。 */
export const initWebdavSync = () => {
  if (!appSetting['sync.webdav.enable'] || !appSetting['sync.webdav.syncLists']) return
  if (!isWebdavConfigured()) return
  setTimeout(() => {
    void syncLists(false)
  }, 3000)
}

// 供 UI 使用的列表/设置键常量（避免 UI 里散落字符串）
export const WEBDAV_LIST_ID = LIST_IDS.DEFAULT
