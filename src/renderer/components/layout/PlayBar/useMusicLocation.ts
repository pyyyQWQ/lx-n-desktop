// 「底部封面右键 → 回到当前歌曲的播放来源页并定位」的统一实现。
//
// 背景（实测确认）：
//  - 「我的列表」（默认/收藏/自建）播放时，playMusicInfo.listId 就是该列表 id 本身；
//  - 所有「在线列表」播放时先塞进临时播放队列，此时 playMusicInfo.listId 恒为 `temp`，
//    真实来源记录在 tempListMeta.id 中，格式分三种：
//      · `dailyrec_wy`                 每日推荐
//      · `board__<source>__<boardId>`  排行榜（Leaderboard/action.ts 的 getListId 又套了一层 board__）
//      · `<source>__<listId>`          在线歌单详情（songList/Detail/action.ts 的 getListId）
// 原实现只处理「我的列表」并写死跳 /list，导致所有在线来源都定位失败。
import { tempListMeta } from '@renderer/store/list/state'
import { LIST_IDS } from '@common/constants'

/** 每日推荐使用的临时列表 id（与 views/wy/DailyRec 中保持一致）。 */
export const DAILY_REC_LIST_ID = 'dailyrec_wy'

/** 排行榜来源 id 的前缀（见 views/Leaderboard/action.ts）。 */
const BOARD_LIST_PREFIX = 'board__'

export interface MusicLocationTarget {
  path: string
  query: Record<string, string | number>
}

/**
 * 计算「当前播放歌曲应回到哪一页 + 用哪个下标定位」。
 * 返回 null 表示不支持定位（下载列表、无效下标、无来源信息）。
 */
export const resolveMusicLocation = (playListId: string | null, playIndex: number): MusicLocationTarget | null => {
  if (playIndex < 0) return null
  // 下载列表：按现行行为不定位
  if (playListId === LIST_IDS.DOWNLOAD) return null

  // 【关键】先判断「是不是从我的列表播放」。
  //
  // tempListMeta.id 只会在**在线列表播放**（歌单详情/排行榜/每日推荐）时被写入，
  // 从「我的列表」播放**不会**清空它，因此它可能是上一次在线播放残留的来源。
  // 若先读 tempListMeta，就会把「我的列表」的歌误判成上次那个榜单/歌单，
  // 跳到错误页面 —— 这正是「我的列表第 20 首无法定位回去」的原因。
  //
  // 而「我的列表」播放时 playMusicInfo.listId 就是该列表自身的 id
  // （default / love / userlist_xxx），与在线列表恒为 `temp` 有本质区别。
  if (playListId && playListId !== LIST_IDS.TEMP) {
    return {
      path: '/list',
      query: { id: playListId, scrollIndex: playIndex },
    }
  }

  const sourceId = tempListMeta.id || ''

  // 1) 每日推荐
  if (sourceId === DAILY_REC_LIST_ID) {
    return { path: '/wy/dailyRec', query: { scrollIndex: playIndex } }
  }

  // 2) 排行榜：tempListMeta.id 形如 `board__<source>__<boardId>`
  //
  // 两个坑（都已实测踩到）：
  //   a. 排行榜页的 query.boardId 期望 **`<source>__<boardId>`**（含 source 前缀），
  //      因为 store/leaderboard/action.ts 的 getListDetail 用 `id.split('__')` 拆出 source；
  //      只传纯数字会让 `musicSdk[source]` 为 undefined，报
  //      "Cannot read properties of undefined (reading 'list')"。
  //   b. 排行榜页路由守卫要求 query.source 存在，否则会走「用默认榜单并重定向」的分支，
  //      重定向前就 return，导致 scrollIndex 丢失（定位失效）。
  //      因此 source 和 boardId 必须同时给。
  if (sourceId.startsWith(BOARD_LIST_PREFIX)) {
    const boardQueryId = sourceId.slice(BOARD_LIST_PREFIX.length)
    const sep = boardQueryId.indexOf('__')
    if (sep > 0) {
      const source = boardQueryId.slice(0, sep)
      if (source) {
        return {
          path: '/leaderboard',
          query: { source, boardId: boardQueryId, scrollIndex: playIndex },
        }
      }
    }
    // 解析不出具体榜单时，至少回到排行榜页（由页面按设置恢复默认榜）
    return { path: '/leaderboard', query: { scrollIndex: playIndex } }
  }

  // 3) 在线歌单详情：`<source>__<listId>`
  const sep = sourceId.indexOf('__')
  if (sep > 0) {
    const source = sourceId.slice(0, sep)
    const id = sourceId.slice(sep + 2)
    if (id) {
      return {
        path: '/songList/detail',
        query: { source, id, scrollIndex: playIndex },
      }
    }
  }

  return null
}
