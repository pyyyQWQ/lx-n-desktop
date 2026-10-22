import { openNeteaseLoginWindow, closeNeteaseLoginWindow, getNeteaseLoginCookie } from '@renderer/utils/neteaseLogin'
import { verifyAndLogin } from '@renderer/core/wyLogin'
import { isWyVerifying } from '@renderer/store/user/state'

/**
 * 网易云网页登录流程（阶段 B2）。
 * 打开官方登录窗口 -> 轮询 Cookie -> 校验 -> 保存 -> 关闭清理。
 * 失败 / 取消不破坏原有有效登录状态。
 */

let checking = false
let stop = false

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const sleepUntilStopped = async(ms: number) => {
  for (let i = 0; i < ms / 100; i++) {
    if (stop) return false
    await wait(100)
  }
  return true
}

export const startWebLogin = async(): Promise<{ success: boolean, message?: string }> => {
  if (isWyVerifying.value || checking) {
    return { success: false, message: 'verifying' }
  }
  checking = true
  stop = false
  try {
    await openNeteaseLoginWindow()
    // 轮询等待登录窗口会话写入 Cookie
    const maxWait = 2 * 60 * 1000 // 2 分钟
    const startedAt = Date.now()
    let cookie = ''
    let isLogined = false
    while (Date.now() - startedAt < maxWait) {
      if (stop) {
        await closeNeteaseLoginWindow()
        return { success: false, message: 'cancelled' }
      }
      // 每 1.5s 尝试读取一次
      if (!(await sleepUntilStopped(1500))) {
        await closeNeteaseLoginWindow()
        return { success: false, message: 'cancelled' }
      }
      try {
        const res = await getNeteaseLoginCookie()
        isLogined = res.isLogined
        cookie = res.cookie
        if (isLogined && cookie) break
      } catch (_) {
        // 窗口忙碌或已关闭，继续轮询
      }
    }
    if (!cookie || !isLogined) {
      await closeNeteaseLoginWindow()
      return { success: false, message: 'not-logged-in' }
    }
    // 用统一流程验证并保存
    await verifyAndLogin(cookie)
    await closeNeteaseLoginWindow()
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // 验证失败不关闭窗口？——失败时存储状态已在 verifyAndLogin 处理，关闭窗口
    await closeNeteaseLoginWindow()
    return { success: false, message: msg }
  } finally {
    checking = false
  }
}

/**
 * 取消进行中的网页登录流程。
 */
export const cancelWebLogin = () => {
  stop = true
}

export default {
  startWebLogin,
  cancelWebLogin,
}
