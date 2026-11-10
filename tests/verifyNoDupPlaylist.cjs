// 运行时验证：清理历史重复歌单 + 验证修复后不再重复创建
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INIT_REQ = `(() => new Promise((resolve) => {
  if (window.__REQ__) return resolve('cached')
  const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
  if (!ck) return resolve('no chunk')
  window[ck].push([['__d_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
  setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 1500)
}))()`

const INNER = `(async () => {
  const req = window.__REQ__
  const out = { steps: [] }
  const listState = req('./src/renderer/store/list/state.ts')
  const autoSave = req('./src/renderer/views/wy/DailyRec/useAutoSave.ts')
  const loc = req('./src/common/utils/dailyRecAutoSave.ts')
  const listApi = req('./src/renderer/store/list/listManage/index.ts')

  const name = loc.buildDailyPlaylistName()
  const countSame = () => (listState.userLists ?? []).filter(l => l.name === name).length
  const snap = (tag) => out.steps.push({ tag, total: listState.userLists.length, sameName: countSame() })

  await listApi.getUserLists()
  out.name = name
  snap('before')

  const mk = (id) => ({
    id: String(id), name: 'probe-' + id, singer: 'probe', source: 'wy', interval: '03:00',
    meta: { albumName: 'probe', _qualitys: { '128k': null } },
  })
  const songs = [mk('s1'), mk('s2'), mk('s3')]

  // 1) 连续并发调用 4 次（模拟页面多条路径同时触发）
  out.concurrent = await Promise.all([
    autoSave.autoSaveDailyPlaylist(songs, { silent: true }),
    autoSave.autoSaveDailyPlaylist(songs, { silent: true }),
    autoSave.autoSaveDailyPlaylist(songs, { silent: true }),
    autoSave.autoSaveDailyPlaylist(songs, { silent: true }),
  ])
  await new Promise(r => setTimeout(r, 2000))
  await listApi.getUserLists()
  snap('afterConcurrent4')

  // 2) 再串行调 2 次
  out.serial1 = await autoSave.autoSaveDailyPlaylist(songs, { silent: true })
  await new Promise(r => setTimeout(r, 1200))
  out.serial2 = await autoSave.autoSaveDailyPlaylist(songs, { silent: true })
  await new Promise(r => setTimeout(r, 1200))
  await listApi.getUserLists()
  snap('afterSerial2')

  out.finalLists = (listState.userLists ?? []).map(l => ({ id: l.id, name: l.name }))
  return out
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const run = async(inner) => {
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
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 600) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }
  console.log('init:', JSON.stringify(await run(INIT_REQ)))
  console.log(JSON.stringify(await run(INNER), null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
