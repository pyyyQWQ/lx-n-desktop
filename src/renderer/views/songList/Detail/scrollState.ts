// 歌单详情页「定位当前播放」与「正在播放标识」的状态载体。
// 独立成模块是因为路由守卫（组件外）需要写入、组件内需要读取，
// 若放在 index.vue 内会与 useList 形成循环引用。
import { ref } from '@common/utils/vueTools'

/** 待定位的行索引；null 表示没有待定位目标（正常「回到顶部」）。 */
export const pendingScrollIndex = ref<number | null>(null)

/**
 * 把「全局行号」换算成「所在页 + 页内行号」。
 * playInfo.playIndex 是完整播放队列里的下标，可能远超当前页条数（每页 30 首），
 * 必须先换算再滚，否则会越界、表现为「只回到顶部」。
 */
export const toPageAndRow = (globalIndex: number, pageSize: number): { page: number, rowIndex: number } => {
  const size = pageSize > 0 ? pageSize : 30
  return {
    page: Math.floor(globalIndex / size) + 1,
    rowIndex: globalIndex % size,
  }
}

/** 从路由 query 写入待定位行（非法值视为无）。 */
export const setPendingScrollIndex = (raw: unknown) => {
  const num = raw == null || raw === '' ? NaN : Number(raw)
  pendingScrollIndex.value = Number.isNaN(num) ? null : num
}

/**
 * 安全地滚动到指定行。
 *
 * 平滑滚动期间若目标元素被销毁（列表重载、快速切页），
 * 浏览器会抛出 `DOMException: The operation could not be performed and was aborted`。
 * 这里先校验实例与下标范围，并吞掉内部异常，保证定位失败不影响页面。
 */
export const safeScrollToIndex = (
  list: { scrollToIndex?: (index: number, offset?: number, animate?: boolean, onScrollEnd?: (ok?: boolean | 'canceled') => void) => void } | null | undefined,
  index: number | null,
  total: number,
  offset = -150,
): boolean => {
  if (!list || index == null) return false
  if (index < 0 || index >= total) return false
  // 方法不存在时不能算成功，否则定位目标会被消费掉、永久丢失
  if (typeof list.scrollToIndex !== 'function') return false
  try {
    // 非动画滚动：平滑滚动在元素销毁时会抛 DOMException（aborted），定位不需要动画
    // 传 onScrollEnd 回调：让 VirtualizedList 走「直接设置 scrollTop」分支，
    // 不传时它用 scrollTo({behavior:'instant'})，该值在部分 Chromium 版本不生效
    list.scrollToIndex(index, offset, false, () => {})
    return true
  } catch (err) {
    console.warn('[scroll] 定位失败（已忽略）:', err)
    return false
  }
}

/**
 * 消费待定位目标（一次性）。
 *
 * 为什么用轮询而非只在数据加载回调里滚一次：
 * 歌单详情的 getAndSetListDetail 在同一歌单已加载/命中缓存时会**直接 return**，
 * `.then` 不执行，滚动代码就不会跑，表现为「跳到歌单但没定位到歌曲」。
 *
 * @param getListInstance 返回当前列表组件实例（可能为 null）
 * @param getTotal        返回当前列表条目数
 * @returns 是否已成功消费
 */
export const consumePendingScroll = (
  getListInstance: () => any,
  getTotal: () => number,
): boolean => {
  if (pendingScrollIndex.value == null) return false
  const target = pendingScrollIndex.value
  const total = getTotal()
  if (!total) return false
  const list = getListInstance()
  if (!list) return false
  const ok = safeScrollToIndex(list, target, total)
  if (ok) pendingScrollIndex.value = null
  return ok
}
