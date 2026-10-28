// 验证打包版（安装版）里音质功能是否真的生效。
// 打包版页面是 file://，没有 webpack 运行时，无法用 require 探针。
// 改用主进程 CDP：直接读主进程状态 + 在页面里检查 DOM/全局对象。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const main = async () => {
  let port = null
  const candidates = [5858, 9222, 9229]
  for (const p of candidates) {
    try {
      const r = await httpGet('127.0.0.1', p, '/json/list')
      const list = JSON.parse(r.body)
      if (Array.isArray(list) && list.length) { port = p; break }
    } catch (_) { /* 下一个 */ }
  }
  if (!port) { console.log('❌ 未找到调试端口（应用是否以 --inspect 启动？）'); return }

  console.log('调试端口:', port)
  const r = await httpGet('127.0.0.1', port, '/json/list')
  const target = JSON.parse(r.body).find(t => t.type === 'node')
  const ws = await connectWS(target.webSocketDebuggerUrl)

  const run = async(label, expr) => {
    try {
      const res = await ws.evaluate(expr, true)
      console.log(`\n===== ${label} =====`)
      console.log(JSON.stringify(res.value, null, 1))
      return res.value
    } catch (e) {
      console.log(`\n===== ${label} =====\n失败: ${e.message.slice(0, 200)}`)
    }
  }

  await run('应用与数据目录', `
    JSON.stringify({
      version: require('electron').app.getVersion(),
      userData: require('electron').app.getPath('userData'),
      isPackaged: require('electron').app.isPackaged,
      nodeEnv: process.env.NODE_ENV,
    })
  `)

  await run('窗口列表', `
    JSON.stringify(require('electron').BrowserWindow.getAllWindows()
      .filter(w => !w.isDestroyed())
      .map(w => ({ url: w.webContents.getURL().slice(0, 80), title: w.getTitle() })))
  `)

  // 页面里检查音质相关 UI 是否可用（设置页音质选项）
  await run('页面内音质设置可见性', `
    (async () => {
      const { BrowserWindow } = require('electron')
      const w = BrowserWindow.getAllWindows().find(x => {
        const u = x.webContents.getURL()
        return u.includes('index.html') || u.includes('localhost')
      })
      if (!w) return JSON.stringify({ err: 'no main window' })
      return await w.webContents.executeJavaScript(\`({
        url: location.href.slice(0, 60),
        hasRoot: !!document.getElementById('root'),
        bodyHasNav: (document.body.innerText || '').includes('设置'),
      })\`, true)
    })()
  `)

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
