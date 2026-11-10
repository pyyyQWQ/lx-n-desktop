// 每日推荐自动存歌单（含 store / IPC 的部分）。
//
// 纯逻辑（逻辑日期、命名、保留数量、是否覆盖、同名去重）已抽到
// `@common/utils/dailyRecAutoSave`，便于单元测试；本文件只负责：
//   · 读取设置开关
//   · 调用列表 API（创建/删除/更新/覆盖）
//   · 弹 toast
//
// 复用来源：移动改良版 `src/screens/Home/Views/DailyRec/listAction.ts` 的 `autoSaveDailyPlaylist`。
//
// 与手机版的差异：
//   · 手机版写死保留 15 个；桌面端按要求改为 **3 个**
//   · 手机版默认开启；桌面端**默认关闭**，需用户显式启用（自动建歌单属写操作）
import { appSetting } from '@renderer/store/setting'
import { userLists } from '@renderer/store/list/state'
import { createUserList } from '@renderer/store/list/action'
import {
  removeUserList,
  updateUserList,
  getListMusics,
  overwriteListMusics,
  getUserLists,
} from '@renderer/store/list/listManage'
import { toast } from '@renderer/plugins/Tips/toast'
import {
  buildDailyPlaylistName,
  pickDailyRecPlaylistsToRemove,
  pickDailyRecListToKeep,
  pickDuplicateNameListsToRemove,
  shouldOverwriteDailyRec,
  DAILY_REC_KEEP_COUNT,
} from '@common/utils/dailyRecAutoSave'

export { DAILY_REC_KEEP_COUNT }

export interface AutoSaveResult {
  action: 'skipped' | 'created' | 'updated' | 'failed'
  name?: string
  removed?: string[]
}

/**
 * 是否已有一次自动存档正在进行。
 *
 * 为什么需要它：`loadSongs()` 里是 `void autoSaveDailyPlaylist(...)`（不 await），
 * 而页面在「首次进入 / 登录状态变化 / 手动刷新 / 路由重新激活」等多条路径下都会调用。
 * 多次调用会**并发**跑到 `lists.find(...)`，此时谁都还没创建，
 * 于是各自走「新建」分支 —— 这是「同名歌单被重复创建」的主要成因。
 * 用模块级互斥锁把并发请求串行化：后到者等前一次结束，再基于最新列表判断，
 * 自然就会走「已存在 → 更新」而不是再建一个。
 */
let inFlight: Promise<AutoSaveResult> | null = null

/**
 * 自动把每日推荐歌曲保存为一个歌单。
 *
 * @param songList 每日推荐歌曲（旧结构，可直接存入列表）
 * @param options.silent 为 true 时不弹 toast（页面自动执行时用）
 */
export const autoSaveDailyPlaylist = async(
  songList: any[],
  options: { silent?: boolean } = {},
): Promise<AutoSaveResult> => {
  // 并发保护：复用进行中的那次，避免同时走「新建」分支
  if (inFlight) return inFlight
  inFlight = runAutoSave(songList, options).finally(() => {
    inFlight = null
  })
  return inFlight
}

const runAutoSave = async(
  songList: any[],
  options: { silent?: boolean },
): Promise<AutoSaveResult> => {
  if (!appSetting['list.isAutoSaveDailyRec']) return { action: 'skipped' }
  if (!Array.isArray(songList) || !songList.length) return { action: 'skipped' }

  const name = buildDailyPlaylistName()
  const silent = options.silent === true
  const newFirstId = songList[0]?.id

  // 关键：先向主进程重新拉一次真实列表，而不是只用内存里的 userLists。
  // userLists 在启动早期可能尚未填充完成，此时查重会「查不到 → 直接新建」，
  // 这正是重装/重启后第一批重复歌单的来源。
  try {
    await getUserLists()
  } catch (err: any) {
    console.warn('[DailyRec auto-save] 刷新列表失败，改用内存快照:', err?.message ?? err)
  }

  const lists = [...userLists]
  const keep = pickDailyRecListToKeep(
    lists.map(l => ({ id: l.id, name: l.name })),
    name,
  )

  // ① 今天已有同名歌单：清理多余的同名重复项，再按第一首歌决定是否覆盖
  if (keep) {
    const removed: string[] = []
    try {
      // 历史遗留的多个同名歌单必须一并清掉，否则永远只更新第一个、其余变孤儿
      const dupIds = pickDuplicateNameListsToRemove(
        lists.map(l => ({ id: l.id, name: l.name })),
        name,
        keep.id,
      )
      for (const dupId of dupIds) {
        try {
          await removeUserList([dupId])
          removed.push(dupId)
        } catch (err: any) {
          console.warn('[DailyRec auto-save] 清理重复歌单失败:', dupId, err?.message ?? err)
        }
      }

      const existingSongs = await getListMusics(keep.id)
      if (shouldOverwriteDailyRec(existingSongs[0]?.id, newFirstId)) {
        await overwriteListMusics({
          listId: keep.id,
          musicInfos: songList as LX.Music.MusicInfo[],
        })
        // keep 可能来自刷新后的新快照，这里按最新对象更新
        const latest = userLists.find(l => l.id === keep.id)
        if (latest) await updateUserList([{ ...latest, locationUpdateTime: Date.now() }])
      }

      if (!silent) {
        if (removed.length) toast(`已合并 ${removed.length + 1} 个同名每日推荐歌单：${name}`)
        else toast(`已更新每日推荐歌单：${name}`)
      }
      return {
        action: 'updated',
        name,
        removed,
      }
    } catch (err: any) {
      console.error('[DailyRec auto-save] 更新歌单失败:', err?.message ?? err)
      return { action: 'failed', name, removed }
    }
  }

  // ② 不存在：先清理超量旧歌单，再新建
  const removed: string[] = []
  try {
    const toRemove = pickDailyRecPlaylistsToRemove(
      lists.map(l => l.name),
      DAILY_REC_KEEP_COUNT,
      true,
    )
    for (const removeName of toRemove) {
      const target = lists.find(l => l.name === removeName)
      if (!target) continue
      await removeUserList([target.id])
      removed.push(removeName)
    }

    await createUserList({ name, list: songList as LX.Music.MusicInfo[] })
    if (!silent) toast(`已保存每日推荐歌单：${name}`)
    return { action: 'created', name, removed }
  } catch (err: any) {
    console.error('[DailyRec auto-save] 创建歌单失败:', err?.message ?? err)
    return { action: 'failed', name, removed }
  }
}
