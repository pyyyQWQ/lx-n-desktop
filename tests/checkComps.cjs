// 直接用「真实用户路径」验证：调用 resolveMusicLocation + router.push，再读列表 scrollTop。
// 不依赖 webpack require 探针，改为从 DOM/组件实例取信息。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const STEP1 = `(() => {
  // 通过 #root 的 vue app 实例，找到 OnlineList 并读 getScrollTop
  const root = document.querySelector('#root')
  const app = root && root.__vue_app__
  if (!app) return { err: 'no vue app' }

  let comp = null
  const walk = (inst, d) => {
    if (!inst || d > 30 || comp) return
    const nm = inst.type?.name || inst.type?.__name
    if (nm === 'MaterialOnlineList') { comp = inst; return }
    const visit = (vn) => {
      if (!vn || typeof vn !== 'object' || comp) return
      if (vn.component) walk(vn.component, d + 1)
      if (Array.isArray(vn.children)) vn.children.forEach(visit)
      if (vn.dynamicChildren) vn.dynamicChildren.forEach(visit)
    }
    visit(inst.subTree)
  }
  walk(app._instance, 0)

  if (!comp) return { err: 'no OnlineList comp' }
  const ex = comp.exposed || {}
  return {
    exposedKeys: Object.keys(ex),
    scrollTop: typeof ex.getScrollTop === 'function' ? ex.getScrollTop() : null,
    hasScrollToIndex: typeof ex.scrollToIndex === 'function',
    hash: location.hash,
  }
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const run = async(inner, awaitP = true) => {
    const code = `
      (() => {
        const { BrowserWindow } = require('electron')
        const w = BrowserWindow.getAllWindows().find(x => {
          const u = x.webContents.getURL()
          return u.includes('localhost:9080') || u.includes('index.html')
        })
        if (!w) return Promise.resolve({ noWindow: true })
        return w.webContents.executeJavaScript(${JSON.stringify(inner)}, ${awaitP})
          .then(v => ({ ok: true, value: v }))
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 300) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }

  console.log('=== 当前状态 ===')
  console.log(JSON.stringify(await run(STEP1), null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
