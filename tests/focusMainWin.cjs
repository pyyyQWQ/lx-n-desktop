// 把开发版主窗口显示到最前（用于人工视觉确认）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const code = `
    (() => {
      const { BrowserWindow } = require('electron')
      const wins = BrowserWindow.getAllWindows()
      const info = wins.map(w => ({ id: w.id, url: (w.webContents.getURL() || '').slice(0, 80), visible: w.isVisible(), minimized: w.isMinimized() }))
      const w = wins.find(x => {
        const u = x.webContents.getURL()
        return u.includes('localhost:9080') || u.includes('index.html')
      })
      if (w) {
        w.show()
        w.restore()
        w.setAlwaysOnTop(true)
        w.focus()
        setTimeout(() => { try { w.setAlwaysOnTop(false) } catch (_) {} }, 4000)
      }
      return Promise.resolve({ info, shown: !!w })
    })()
  `
  const res = await ws.evaluate(code, true)
  console.log(JSON.stringify(res.value, null, 1))
  ws.close()
  await new Promise(r => setTimeout(r, 3000))
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
