// 检查渲染进程是否还有编译错误覆盖层（webpack-dev-server 的 error overlay）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(() => {
  const out = {}
  // webpack-dev-server 的 overlay 容器
  const overlay = document.querySelector('#webpack-dev-server-client-overlay')
    || document.querySelector('iframe#webpack-dev-server-client-overlay')
  out.hasOverlayEl = !!overlay
  // 有些版本用 shadow DOM 承载
  let shadowText = ''
  if (overlay && overlay.shadowRoot) shadowText = (overlay.shadowRoot.textContent || '').slice(0, 600)
  out.shadowText = shadowText
  // 兜底：页面上是否出现 "Compiled with problems"
  const bodyText = document.body ? (document.body.innerText || '') : ''
  out.hasProblemsText = /Compiled with problems/i.test(bodyText)
  const m = bodyText.match(/ERROR in [^\\n]{0,160}/g)
  out.errorLines = m ? m.slice(0, 8) : []
  out.hash = location.hash
  return out
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const code = `
    (() => {
      const { BrowserWindow } = require('electron')
      const w = BrowserWindow.getAllWindows().find(x => {
        const u = x.webContents.getURL()
        return u.includes('localhost:9080')
      })
      if (!w) return Promise.resolve({ noWindow: true })
      return w.webContents.executeJavaScript(${JSON.stringify(INNER)}, true)
        .then(v => ({ ok: true, value: v }))
        .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 400) }))
    })()
  `
  const res = await ws.evaluate(code, true)
  console.log(JSON.stringify(res.value, null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
