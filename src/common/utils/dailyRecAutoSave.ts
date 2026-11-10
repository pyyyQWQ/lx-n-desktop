// 每日推荐自动存歌单 —— 纯逻辑（可隔离测试，无 store / IPC 依赖）。
//
// 从移动改良版 `src/screens/Home/Views/DailyRec/listAction.ts` 提取：
//   · getLogicalDateForPlaylist —— 逻辑日期（早 7 点分界）
//   · 歌单命名规则 `MM_DD_daily`
//   · 保留数量与筛选/排序规则
//
// 之所以单独放这里：`src/renderer/views/wy/DailyRec/useAutoSave.ts` 依赖 store 与 IPC，
// 纯 Node 环境无法导入；把这部分逻辑抽离后即可用单元测试覆盖（与本项目
// `common/utils/quality.ts`、`common/utils/wyDailyRec.ts` 同一模式）。

/** 保留多少个每日推荐歌单（超过则删最旧的）。用户选定 3 天。 */
export const DAILY_REC_KEEP_COUNT = 3

/** 每日推荐歌单命名规则：`MM_DD_daily`。 */
export const DAILY_REC_NAME_RXP = /^\d{2}_\d{2}_daily$/

/**
 * 逻辑日期：早上 7 点之前算作前一天。
 * 与移动改良版一致，避免用户熬夜到凌晨时，当天推荐已被刷新导致重复创建歌单。
 * 不修改传入对象。
 */
export const getLogicalDate = (now: Date = new Date()): Date => {
  const d = new Date(now.getTime())
  if (d.getHours() < 7) d.setDate(d.getDate() - 1)
  return d
}

/** 由日期生成歌单名，如 `11_10_daily`（月、日均补零）。 */
export const buildDailyPlaylistName = (date: Date = getLogicalDate()): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}_${day}_daily`
}

/** 是否为每日推荐歌单名。 */
export const isDailyRecPlaylistName = (name: unknown): boolean =>
  typeof name == 'string' && DAILY_REC_NAME_RXP.test(name)

/**
 * 从已有歌单名中挑出「需要删除的超量项」。
 *
 * @param names 现有每日推荐歌单名（会按名字升序 = 日期升序）
 * @param keep 保留数量（默认 DAILY_REC_KEEP_COUNT）
 * @param willCreate 本次是否还要新建一个（true 时需为新歌单腾出一个位置）
 * @returns 需要删除的歌单名（最旧的在前）
 */
export const pickDailyRecPlaylistsToRemove = (
  names: string[],
  keep: number = DAILY_REC_KEEP_COUNT,
  willCreate = true,
): string[] => {
  const daily = names.filter(isDailyRecPlaylistName).sort((a, b) => a.localeCompare(b))
  // 新建后总数不能超过 keep，因此需要清掉 (daily.length + 1 - keep) 个
  const targetCount = willCreate ? Math.max(0, daily.length + 1 - keep) : Math.max(0, daily.length - keep)
  return daily.slice(0, targetCount)
}

/**
 * 判断已存在的同日歌单是否需要覆盖。
 * 手机版语义：第一首歌相同 → 认为未更新，跳过；不同 → 覆盖。
 */
export const shouldOverwriteDailyRec = (
  existingFirstSongId: string | null | undefined,
  newFirstSongId: string | null | undefined,
): boolean => {
  if (!existingFirstSongId) return true
  return existingFirstSongId !== newFirstSongId
}

export interface DailyRecListLike {
  id: string
  name: string
}

/**
 * 从一批用户歌单中挑出「同名重复项」需要清理的部分。
 *
 * 为什么需要它：早期版本的去重只做 `find(l => l.name === name)` 取**第一个**匹配，
 * 一旦库里已经积累了多个同名歌单（历史 bug 造成），它就永远只更新第一个，
 * 剩下的永远是孤儿——用户看到的就是「一长串 11_10_daily」。
 * 因此每次自动存档时都要把「多余的同名项」一并清掉，让历史脏数据能自愈。
 *
 * @param lists 全部用户歌单
 * @param name 目标歌单名
 * @param keepId 要保留的那个歌单 id（通常是最早创建的，保住它的播放记录/顺序）
 * @returns 需要删除的歌单 id（不含 keepId）
 */
export const pickDuplicateNameListsToRemove = (
  lists: DailyRecListLike[],
  name: string,
  keepId: string,
): string[] => {
  if (!name) return []
  return lists
    .filter(l => l.name === name && l.id !== keepId)
    .map(l => l.id)
}

/**
 * 选出「应该保留」的同名歌单：优先保留调用方指定的 id，
 * 若不存在则退回列表中的第一个（数组顺序来自 DB，天然是创建顺序）。
 */
export const pickDailyRecListToKeep = (
  lists: DailyRecListLike[],
  name: string,
  preferId?: string,
): DailyRecListLike | null => {
  const sameName = lists.filter(l => l.name === name)
  if (!sameName.length) return null
  if (preferId) {
    const preferred = sameName.find(l => l.id === preferId)
    if (preferred) return preferred
  }
  return sameName[0]
}
