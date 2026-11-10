// 临时列表「播放来源」信息的序列化/反序列化（纯函数，可在 node 测试中直接导入）。
//
// 背景：temp 列表每次在线播放都会被整体覆盖，但它**播放自哪个页面**
// （每日推荐 / 排行榜 / 歌单详情）只记录在 tempListMeta.id 里。
// 原先该值只存在内存普通对象中，进程退出即丢失 —— 重启后「恢复上次播放」的
// listId 仍是 `temp`，来源却为空，底部封面右击「定位」就永远解析不出目标页。
//
// temp 列表在数据库里没有 my_list 记录（见 dbService/statements.ts），
// 因此改用渲染进程 localStorage 持久化。这里只放与存储格式相关的纯逻辑，
// 真正的 localStorage 读写留在 store 里，便于单测覆盖。

/** localStorage 中保存临时列表来源信息的键名。 */
export const TEMP_LIST_META_KEY = 'temp_list_meta'

export interface TempListMeta {
  id: string
}

/**
 * 把来源 id 序列化成待写入 localStorage 的字符串。
 * @param id 来源 id（如 `dailyrec_wy` / `board__wy__xxx` / `wy__123456`），空值表示无来源
 */
export const serializeTempListMeta = (id: string): string => {
  const safeId = typeof id === 'string' ? id : ''
  return JSON.stringify({ id: safeId })
}

/**
 * 从 localStorage 读到的原始字符串还原来源 id。
 *
 * 任何异常输入（空、非 JSON、结构不对、id 非字符串）都返回空字符串，
 * 保证「读取失败」等价于「没有来源」，不会把脏数据带进定位逻辑。
 */
export const parseTempListMeta = (raw: string | null | undefined): string => {
  if (typeof raw != 'string' || !raw) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (_) {
    return ''
  }
  if (typeof parsed != 'object' || parsed == null) return ''
  const id = (parsed as { id?: unknown }).id
  return typeof id == 'string' ? id : ''
}
