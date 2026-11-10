// 检查当前 Electron 窗口状态与页面是否可用。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const CHECK = `(() => {
  const wins = require('electron').BrowserWindow.getAllWindows().filter(x => !x.isDestroyed())
  return wins.map(x => ({
    id: x.id,
    url: x.webContents.getURL().slice(0, 80),
    loading: x.webContents.isLoading(),
  }))
})()`

const INNER = `({
  hash: location.hash,
  ready: document.readyState,
  hasRoot: !!document.getElementById('root'),
  hasChunk: Object.keys(window).some(k => k.startsWith('webpackChunk')),
  rows: document.querySelectorAll('.list-item').length,
})`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)

  const wins = await ws.evaluate(CHECK, false)
  console.log('窗口:', JSON.stringify(wins.value, null, 1))

  const code = `
    (() => {
      const { BrowserWindow } = require('electron')
      const w = BrowserWindow.getAllWindows().find(x => {
        const u = x.webContents.getURL()
        return u.includes('localhost:9080') || u.includes('index.html')
      })
      if (!w) return Promise.resolve({ noWindow: true })
      return w.webContents.executeJavaScript(${JSON.stringify(INNER)}, true)
    })()
  `
  const res = await ws.evaluate(code, true)
  console.log('页面:', JSON.stringify(res.value, null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
