// 背景遮罩不透明度的纯逻辑换算。
//
// 为什么单独抽出来：两个滑块在 UI 上都叫「不透明度」，但实现里控制的是
// **遮罩层**（铺在图片上的主题底色）的 opacity，方向含义很容易搞反；
// 一旦反了，表现是「越往右拉越看不见」，靠肉眼很难第一时间判断。
// 抽成纯函数便于单测覆盖边界值与越界值。

const clampPercent = (value: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(n, 0), 100)
}

/**
 * 自定义背景的「不透明度」→ 遮罩层 opacity。
 *
 * 值是**图片可见度**：100 = 图片完全可见（遮罩全透明），0 = 图片被完全遮住。
 * 因此遮罩 opacity = 1 - 值/100，与滑块方向一致（往右拉图片更清楚）。
 */
export const customBgMaskOpacity = (value: number): number => {
  return Math.round((1 - clampPercent(value) / 100) * 100) / 100
}

/**
 * 动态背景的「遮罩浓度」→ 遮罩层 opacity。
 *
 * 值和遮罩浓度同向：100 = 遮罩最浓（封面几乎看不见），0 = 完全不遮。
 * 与自定义背景的语义相反，这是故意的：动态背景是封面高斯模糊，
 * 太清楚会盖住内容，所以滑块表达的是「压多深」。
 */
export const dynamicBgMaskOpacity = (value: number): number => {
  return Math.round(clampPercent(value)) / 100
}

/** 按当前背景类型取遮罩 opacity。 */
export const resolveBgMaskOpacity = (isCustomBg: boolean, customBgOpacity: number, picOpacity: number): number => {
  return isCustomBg ? customBgMaskOpacity(customBgOpacity) : dynamicBgMaskOpacity(picOpacity)
}
