// 验证「重启后仍能定位」：先备份 localStorage → 触发页面 reload（等价于重启渲染进程）
// → reload 后检查 tempListMeta 是否从 localStorage 还原 → 触发定位验证可用。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INIT_REQ = `(() => new Promise((resolve) => {
  if (window.__REQ__) return resolve('cached')
  const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
  if (!ck) return resolve('no chunk')
  window[ck].push([['__d_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
  setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 1200)
}))()`

const WRITE = `(() => {
  window.localStorage.setItem('temp_list_meta', JSON.stringify({ id: 'dailyrec_wy' }))
  return { wrote: window.localStorage.getItem('temp_list_meta') }
})()`

const CHECK = `(async () => {
  const req = window.__REQ__
  const out = {}
  const listState = req('./src/renderer/store/list/state.ts')
  out.rawStorage = window.localStorage.getItem('temp_list_meta')
  out.memAfterReload = JSON.parse(JSON.stringify(listState.tempListMeta))

  const playState = req('./src/renderer/store/player/state.ts')
  const loc = req('./src/renderer/components/layout/PlayBar/useMusicLocation.ts')
  out.play = {
    listId: playState.playMusicInfo?.listId ?? null,
    playIndex: playState.playInfo?.playIndex ?? null,
    name: playState.playMusicInfo?.musicInfo?.name ?? null,
  }
  // 直接算定位目标（不真跳转，避免干扰）
  out.target = loc.resolveMusicLocation(out.play.listId, out.play.playIndex)
  out.resolvable = !!out.target && out.target.path === '/wy/dailyRec'
  return out
})()`

const RELOAD = `
  (() => {
    const { BrowserWindow } = require('electron')
    const w = BrowserWindow.getAllWindows().find(x => {
      const u = x.webContents.getURL()
      return u.includes('localhost:9080') || u.includes('index.html')
    })
    if (!w) return Promise.resolve({ noWindow: true })
    w.webContents.reloadIgnoringCache()
    return Promise.resolve({ reloaded: true })
  })()
`

const mkRun = (ws) => async (inner) => {
  const code = `
    (() => {
      const { BrowserWindow } = require('electron')
      const w = BrowserWindow.getAllWindows().find(x => {
        const u = x.webContents.getURL()
        return u.includes('localhost:9080') || u.includes('index.html')
      })
      if (!w) return Promise.resolve({ noWindow: true })
      return w.webContents.executeJavaScript(${JSON.stringify(inner)}, true)
        .then(v => ({ ok: true, value: v }))
        .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 400) }))
    })()
  `
  const res = await ws.evaluate(code, true)
  return res.value
}

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const run = mkRun(ws)

  console.log('1) 写入来源标记:', JSON.stringify(await run(WRITE)))

  console.log('2) 重新加载页面（等价重启渲染进程）:', JSON.stringify(await ws.evaluate(RELOAD, true).then(r2 => r2.result)))
  await new Promise(r2 => setTimeout(r2, 12000))

  await run(INIT_REQ)
  console.log('3) reload 后状态:', JSON.stringify(await run(CHECK), null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
