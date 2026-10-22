import tips from './Tips'

/**
 * 轻提示（toast）：居中显示、自动消失、无需点击确认。
 * 基于项目既有 Tips 组件封装。
 * @param {string} message 提示内容
 */
export const toast = (message) => {
  const containerWidth = document.documentElement.clientWidth
  const left = Math.round(containerWidth * 0.5)
  const top = 60
  tips({ message, autoCloseTime: 2000, position: { top, left } }, {
    beforeClose() {},
  })
}

export default toast
