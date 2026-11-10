// 验证 tempListMeta 持久化：写入 → 读 localStorage → 模拟重启（重新读 state）后仍拿得到
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INIT_REQ = `(() => new Promise((resolve) => {
  if (window.__REQ__) return resolve('cached')
  const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
  if (!ck) return resolve('no chunk')
  window[ck].push([['__d_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
  setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 800)
}))()`

const INNER = `(async () => {
  const req = window.__REQ__
  const out = {}
  const listState = req('./src/renderer/store/list/state.ts')
  const listAction = req('./src/renderer/store/list/action.ts')

  out.keyBefore = window.localStorage.getItem('temp_list_meta')
  out.memBefore = JSON.parse(JSON.stringify(listState.tempListMeta))

  // 1) 写入来源
  listState.setTempListMetaId('dailyrec_wy')
  out.memAfterSet = JSON.parse(JSON.stringify(listState.tempListMeta))
  out.storedAfterSet = window.localStorage.getItem('temp_list_meta')

  // 2) setTempList 也应同步落盘
  try {
    await listAction.setTempList('board__wy__19723756', [])
    out.storedAfterSetTempList = window.localStorage.getItem('temp_list_meta')
    out.memAfterSetTempList = JSON.parse(JSON.stringify(listState.tempListMeta))
  } catch (e) {
    out.setTempListError = String(e && e.message || e).slice(0, 200)
  }

  // 3) 写坏数据 → 解析应安全降级，不抛错
  window.localStorage.setItem('temp_list_meta', 'not-json')
  try {
    const st = req('./src/common/utils/tempListMeta.ts')
    out.badParse = st.parseTempListMeta(window.localStorage.getItem('temp_list_meta'))
  } catch (e) {
    out.badParseError = String(e && e.message || e).slice(0, 200)
  }

  // 4) 恢复成有效值，留给后续"重启"读取
  window.localStorage.setItem('temp_list_meta', JSON.stringify({ id: 'dailyrec_wy' }))
  out.finalStored = window.localStorage.getItem('temp_list_meta')
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
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 400) }))
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
