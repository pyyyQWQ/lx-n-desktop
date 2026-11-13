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
  computeListsHash,
  decideSyncAction,
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
import { markSelfWrite } from './listAutoSync'

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
  updateSetting({
    'sync.webdav.lastSyncTimeLists': timestamp,
    // 记录本次上传的内容指纹：下次同步时据此判断「本地是否又被改过」。
    // 注意必须用**实际上传的 data** 计算，而不是事后重新读一遍列表——
    // 上传与算哈希之间若用户又改了列表，重读会得到不一致的值，导致下一轮误判。
    'sync.webdav.lastSyncHash': computeListsHash(data),
  })
  return timestamp
}
/** 把远端列表数据应用到本地（覆盖）。 */
const applyRemoteLists = async(remoteData: any) => {
  // 覆盖会触发 myListUpdate → 若不先标记「自身写入」，
  // 列表变更自动同步会立刻把刚下载的数据又上传回去（无意义的往返，且可能与手机端打架）。
  markSelfWrite()
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
 * 处理「远端较新」的情况。三种场景分开处理：
 *
 * 1) 手动同步 → 弹窗询问，用户确认后才下载覆盖（高风险操作必须显式同意）。
 *
 * 2) 自动同步 + **本地无改动**（指纹与上次同步时相同）→ **静默下载覆盖**。
 *    此时本地与「上次上传的内容」完全一致，下载不会丢失任何本地数据，
 *    属于安全操作。这样手机端改了歌单，桌面端启动/下次同步时能自动拿到。
 *
 * 3) 自动同步 + **本地有改动**（指纹不同，说明有未上传的编辑）→ 跳过并记日志。
 *    自动下载会把这些改动直接抹掉，因此绝不冒险，把决定权留给手动同步。
 *
 * 关于自动同步为何不弹窗：
 *   自动同步由列表变更或启动触发，用户可能正在操作歌单。
 *   此时弹「云端较新，要下载覆盖吗？」——点确定会丢掉刚做的改动，
 *   点取消则本次同步作废且不重试，两种都表现为「同步失败」。
 *   因此场景 3 选择静默跳过，而不是弹窗。
 */
const handleRemoteNewer = async(
  remoteData: { lastModified: number, data: any },
  remoteTimestamp: number,
  isManual: boolean,
  localHasChanges: boolean,
): Promise<void> => {
  if (!isManual) {
    if (localHasChanges) {
      // 场景 3：本地有未上传的改动 → 不覆盖、不上传，保留决定权
      console.warn(
        '[WebDAV] 云端比本地记录更新，但本地也有未同步的改动，自动同步已跳过。' +
        '请在设置里手动点「立即同步歌单」来决定保留哪一边。',
      )
      return
    }
    // 场景 2：本地无改动 → 安全地静默下载最新数据
    await applyRemoteLists(remoteData.data)
    updateSetting({
      'sync.webdav.lastSyncTimeLists': remoteTimestamp,
      // 覆盖后本地内容已等于远端，必须同步指纹，
      // 否则下一轮会误判「本地有未上传改动」而立刻反向上传
      'sync.webdav.lastSyncHash': computeListsHash(remoteData.data),
    })
    console.log('[WebDAV] 已自动下载云端更新（本地无改动，安全覆盖）')
    return
  }

  // 场景 1：手动同步 → 询问
  const confirm = await dialog({
    message: t('setting__sync_webdav_remote_newer_tip'),
    confirmButtonText: t('setting__sync_webdav_download'),
    cancelButtonText: t('setting__sync_webdav_cancel'),
    showCancel: true,
  })
  if (!confirm) {
    toast(t('setting__sync_webdav_cancelled'))
    return
  }
  await applyRemoteLists(remoteData.data)
  updateSetting({
    'sync.webdav.lastSyncTimeLists': remoteTimestamp,
    'sync.webdav.lastSyncHash': computeListsHash(remoteData.data),
  })
  toast(t('setting__sync_webdav_download_lists_ok'))
}

/**
 * 主同步流程（手动触发；也可在启动/列表变更时自动调用）。
 *
 * 语义：
 * - 远端无文件 → 上传本地；
 * - 本设备首次同步且远端有数据 → 弹窗让用户选择方向（不可静默覆盖任何一方）；
 * - **本地内容有未上传改动（指纹不同）→ 本地优先，直接上传**；
 * - 本地无改动且远端较新 → 手动同步时询问；**自动同步时静默下载**（安全，不丢数据）；
 * - 本地有改动且远端较新 → 手动同步时询问；自动同步时跳过（避免抹掉本地编辑）；
 * - 本地无改动且远端不新 → 上传本地。
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
        updateSetting({
          'sync.webdav.lastSyncTimeLists': remoteTimestamp,
          // 下载后本地内容已与远端一致，指纹同步更新，
          // 否则下一次同步会误判「本地有未上传改动」而立刻反向上传
          'sync.webdav.lastSyncHash': computeListsHash(remoteData.data),
        })
        toast(t('setting__sync_webdav_download_lists_ok'))
      }
      return
    }

    // 3) 用「内容指纹」判断本地是否真有未上传的改动
    //
    // 为什么不能只看时间戳：本地加歌/删歌**不会**更新 lastSyncTimeLists，
    // 于是「本地刚改过」在时间戳上完全看不出来。若此时远端时间戳更大
    // （例如手机端传过），就会被误判为「云端较新」并提示"下载会覆盖本地"，
    // 把用户刚做的改动当成过时数据 —— 这正是实测到的问题。
    const currentHash = computeListsHash(await getAllListsForSync())
    const lastHash = String(appSetting['sync.webdav.lastSyncHash'] ?? '')
    const decision = decideSyncAction(currentHash, lastHash, remoteTimestamp, localTimestamp)

    // 3a) 老用户首次升级：只记录指纹，本次沿用旧的「时间戳比较」逻辑
    //
    // 传 localHasChanges=true：这是升级后的第一次同步，无法判断本地是否动过，
    // 因此**不自动下载**，按最保守的方式处理（自动同步时跳过、手动时询问），
    // 避免升级瞬间就把用户本地数据覆盖掉。
    if (decision === 'init-hash') {
      updateSetting({ 'sync.webdav.lastSyncHash': currentHash })
      if (isRemoteNewer(remoteTimestamp, localTimestamp)) {
        await handleRemoteNewer(remoteData, remoteTimestamp, isManual, true)
      } else {
        await uploadLists()
        if (isManual) toast(t('setting__sync_webdav_upload_lists_ok'))
      }
      return
    }

    // 3b) 本地有未上传改动：本地优先，直接上传
    if (decision === 'upload-local-changed' || decision === 'upload') {
      await uploadLists()
      if (isManual) toast(t('setting__sync_webdav_upload_lists_ok'))
      return
    }

    // 3c) 远端较新。
    // 能走到这里说明 decision === 'remote-newer'，即指纹与上次同步时相同，
    // 本地没有任何未上传的改动 —— 因此自动同步可以安全地静默下载。
    await handleRemoteNewer(remoteData, remoteTimestamp, isManual, false)
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
