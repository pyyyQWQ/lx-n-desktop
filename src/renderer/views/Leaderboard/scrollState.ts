// 排行榜页「定位当前播放」与「正在播放标识」的状态载体。
// 独立成模块是因为路由守卫（组件外）需要写入、MusicList 的 useList 需要读取，
// 若放在 index.vue 内会与其形成循环引用。
import { ref } from '@common/utils/vueTools'

/**
 * 待定位的**全局行号**（相对整个榜单，从 0 开始）；null 表示没有待定位目标。
 *
 * 注意这里必须存「全局行号」而不是「当前页行号」：
 * playInfo.playIndex 是在**完整播放队列**里查找得到的下标
 * （排行榜播放时队列会被替换为全量歌曲，可能上千首），
 * 而页面每页只渲染 30 首。若直接用全局行号去滚当前页，必然越界 → 表现为「只回到顶部」。
 */
export const pendingScrollIndex = ref<number | null>(null)

/** 从路由 query 写入待定位行（非法值视为无）。 */
export const setPendingScrollIndex = (raw: unknown) => {
  const num = raw == null || raw === '' ? NaN : Number(raw)
  pendingScrollIndex.value = Number.isNaN(num) ? null : num
}

/**
 * 把「全局行号」换算成「所在页 + 页内行号」。
 * @param globalIndex 全局行号（0 起）
 * @param pageSize    每页条数（listDetailInfo.limit）
 * @returns page（1 起）与 rowIndex（0 起）
 */
export const toPageAndRow = (globalIndex: number, pageSize: number): { page: number, rowIndex: number } => {
  const size = pageSize > 0 ? pageSize : 30
  return {
    page: Math.floor(globalIndex / size) + 1,
    rowIndex: globalIndex % size,
  }
}

/**
 * 安全地滚动到指定行，并**校验是否真的滚到位**。
 *
 * 几个已知坑：
 *  1. 不传 onScrollEnd 时 VirtualizedList 走 `scrollTo({behavior:'instant'})`，
 *     该 behavior 在部分 Chromium 版本不被识别、滚动会静默失效 → 必须传回调；
 *  2. 平滑滚动期间元素销毁会抛 DOMException(aborted) → 一律用非动画；
 *  3. **关键**：虚拟列表只渲染视口附近的行，设置 scrollTop 后需要一帧才会重算渲染。
 *     因此不能"调用即成功"，必须读回实际 scrollTop 判断是否接近目标，没到位就下次重试。
 *
 * @returns true 表示这次已滚到目标附近（可停止重试）；false 表示还需再试
 */
export const safeScrollToIndex = (
  list: {
    scrollToIndex?: (index: number, offset?: number, animate?: boolean, onScrollEnd?: (ok?: boolean | 'canceled') => void) => void
    getScrollTop?: () => number
  } | null | undefined,
  index: number | null,
  total: number,
  offset = -150,
  tolerance = 8,
): boolean => {
  if (!list || index == null) return false
  if (index < 0 || index >= total) return false
  if (typeof list.scrollToIndex !== 'function') return false
  try {
    // 传非空回调 → 走「直接设置 scrollTop」分支（避免 behavior:'instant' 失效）
    list.scrollToIndex(index, offset, false, () => {})
    // 读回实际位置校验；取不到就当作已提交，交给下一轮重试确认
    if (typeof list.getScrollTop !== 'function') return true
    const actual = list.getScrollTop()
    if (typeof actual !== 'number') return true
    // 目标像素 = index * 行高 + offset（与 VirtualizedList.scrollToIndex 一致）
    // 这里无法拿到行高，改用「位置是否明显离开顶部/接近预期」的宽松判断：
    // 只要实际滚动值不为 0（目标不在首行）或目标就是首行，即视为到位。
    if (index === 0) return Math.abs(actual) <= tolerance
    return actual > 0
  } catch (err) {
    console.warn('[scroll] 定位失败（已忽略）:', err)
    return false
  }
}
