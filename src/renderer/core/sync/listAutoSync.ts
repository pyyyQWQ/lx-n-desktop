// 列表变更级自动同步（WebDAV）。
//
// 复用来源：移动改良版 `src/core/sync/webdavSync.ts` 的 `markListsChanged` + `debouncedSync`。
//
// 手机版做法（本文件严格对齐其语义）：
//   · 13 个列表操作点（新建/删除/改名/加歌/移歌/删歌/清空/排序…）都调用 `markListsChanged()`
//   · `markListsChanged()` 置 `listsChanged = true` 并触发 `debounce(3000)` 的同步
//   · 同步时只要 `enable && syncLists` 两个开关都开就执行
//   · **没有独立的“变更同步”开关** —— `syncLists` 一项同时管“启动时同步”和“变更后同步”
//
// 与手机版的有意差异（桌面端没有对应基础设施，强行移植风险高）：
//   · 手机版用 opQueue 记录每个操作、同步时把本地操作重放到远端实现「增量合并」；
//     桌面端**没有** opQueue / applyListOperation，因此这里不做合并：
//     变更后直接调用桌面版既有的 `syncLists()`，
//     它内部已有「远端较新→询问后下载覆盖 / 本地较新→上传」的语义。
//   · 因此多端同时修改会以「较新的一方整体覆盖」收场（单机使用无此问题）。
//
// 额外安全措施（桌面端独有，因为这里没有操作队列兜底）：
//   · 同步自身写入数据库时会再次触发 myListUpdate → 用 SELF_WRITE_QUIET_MS 静默窗口避免回环
//   · 同步进行中直接跳过，不排队，避免请求堆积
//   · 自动同步失败只写控制台，不弹 toast 打扰用户
import { appSetting } from '@renderer/store/setting'

/** 防抖延迟，与移动改良版一致（3000ms）。 */
const DEBOUNCE_MS = 3000

/**
 * 同步自身写入后的静默窗口。
 * `overwriteListFull` 会触发 myListUpdate，若不静默会立刻把刚下载的数据又上传回去。
 * 取 8s：覆盖大歌单的写入耗时通常远小于此，而用户的正常后续操作也不会被长期吞掉。
 */
const SELF_WRITE_QUIET_MS = 8000

type SyncFn = () => Promise<void>

let syncHandler: SyncFn | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let isInited = false
/** 是否有未同步的列表变更（对应手机版的 listsChanged）。 */
let listsChanged = false
/** 最近一次「由同步自身引起」的时间戳。 */
let lastSelfWriteAt = 0

/** 是否具备自动同步的前提条件（对应手机版 debouncedSync 里的判断）。 */
const canAutoSync = () => {
  if (!appSetting['sync.webdav.enable']) return false
  if (!appSetting['sync.webdav.syncLists']) return false
  if (!appSetting['sync.webdav.url']) return false
  return true
}

const runSync = () => {
  if (!canAutoSync()) {
    listsChanged = false
    return
  }
  // 同步自身刚写过数据：跳过本轮，避免「下载 → 上传」回环
  if (Date.now() - lastSelfWriteAt < SELF_WRITE_QUIET_MS) {
    listsChanged = false
    return
  }
  if (!syncHandler) return
  void syncHandler().finally(() => {
    listsChanged = false
  })
}

const debouncedSync = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (listsChanged) runSync()
  }, DEBOUNCE_MS)
}

/**
 * 标记「列表发生了变更」，并安排一次防抖同步。
 * 与移动改良版的 `markListsChanged()` 语义一致。
 */
export const markListsChanged = () => {
  if (!appSetting['sync.webdav.enable']) return
  listsChanged = true
  debouncedSync()
}

/**
 * 标记「刚刚由同步自身改动了列表」。
 * 在下载远端数据、覆盖本地之前调用，避免随后被自己的写入触发反向上传。
 */
export const markSelfWrite = () => {
  lastSelfWriteAt = Date.now()
  listsChanged = false
}

/**
 * 初始化：只建立同步函数引用。
 *
 * 说明：桌面端已有统一事件 `window.app_event.myListUpdate`，
 * 它覆盖了新建/删除/改名/加歌/移歌/删歌/清空等所有列表写操作，
 * 因此这里用事件监听替代手机版在 13 处手写 `markListsChanged()` 的方式，
 * 达到同样效果且不漏点。
 */
export const initListAutoSync = (sync: SyncFn) => {
  syncHandler = sync
  if (isInited) return
  isInited = true
  window.app_event.on('myListUpdate', handleListUpdate)
}

const handleListUpdate = () => {
  markListsChanged()
}

/** 释放监听。 */
export const disposeListAutoSync = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (!isInited) return
  isInited = false
  window.app_event.off('myListUpdate', handleListUpdate)
}
