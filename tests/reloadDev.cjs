// 让开发版窗口重新加载页面（webpack-dev-server 已重新编译，需要 reload 才能拿到新代码）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const code = `
    (() => {
      const { BrowserWindow } = require('electron')
      const w = BrowserWindow.getAllWindows().find(x => {
        const u = x.webContents.getURL()
        return u.includes('localhost:9080') || u.includes('index.html')
      })
      if (!w) return Promise.resolve({ noWindow: true })
      w.webContents.reloadIgnoringCache()
      return Promise.resolve({ reloaded: true, url: w.webContents.getURL() })
    })()
  `
  const res = await ws.evaluate(code, true)
  console.log(JSON.stringify(res.value))
  ws.close()
  // 等待页面重新加载完成
  await new Promise(r => setTimeout(r, 9000))
  console.log('等待 9s 后返回')
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
