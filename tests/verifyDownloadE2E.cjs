// 端到端验证：模拟「点击下载按钮」的完整路径，确认不再抛 DataCloneError。
// 走真实链路：fillFullQuality -> createDownloadTasks（内部 postMessage 给 Worker）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(async () => {
  const req = window.__REQ__
  const vueTools = req('./src/common/utils/vueTools.ts')
  const musicUtils = req('./src/renderer/core/music/utils.ts')
  const downloadAction = req('./src/renderer/store/download/action.ts')
  const out = { steps: [] }

  // 搜一首真实的歌（模拟列表项）
  let sdk = null
  for (const id of Object.keys(req.m || {})) {
    if (id === './src/renderer/utils/musicSdk/wy/index.js') { sdk = req(id).default || req(id); break }
  }
  const res = await sdk.musicSearch.search('晴天', 1, 1)
  const s = res.list[0]
  out.song = s.name + ' - ' + s.singer

  // 构造与列表一致的 musicInfo
  const rawInfo = {
    id: s.songmid + '_wy', name: s.name, singer: s.singer, source: 'wy', interval: s.interval,
    meta: { songId: s.songmid, albumName: s.albumName, picUrl: s.img, qualitys: s.types || [], _qualitys: s._types || {} },
  }

  // 1) 模拟弹窗打开：补全音质（此时 musicInfo 来自 props，可能是响应式）
  const reactiveInfo = vueTools.reactive(rawInfo)
  const filled = await musicUtils.fillFullQuality(vueTools.toRaw(reactiveInfo))
  out.afterFill = (filled.meta.qualitys || []).map(t => t.type)

  // 2) 模拟「修复后」的点击：toRaw + JSON 深拷贝
  const payload = JSON.parse(JSON.stringify(vueTools.toRaw(filled)))
  // 先只验证可克隆性
  try {
    structuredClone(payload)
    out.steps.push({ case: 'payload 可克隆', ok: true })
  } catch (e) {
    out.steps.push({ case: 'payload 可克隆', ok: false, err: String(e && e.message).slice(0, 120) })
  }

  // 3) 真正调用 createDownloadTasks（会用 comlink postMessage 给 Worker）
  try {
    await downloadAction.createDownloadTasks([payload], 'master', null)
    out.steps.push({ case: 'createDownloadTasks(master)', ok: true })
  } catch (e) {
    out.steps.push({ case: 'createDownloadTasks(master)', ok: false, err: String(e && e.message).slice(0, 200) })
  }

  // 4) 对照组：直接用 reactive 调（预期失败，用于确认这个坑真实存在）
  try {
    await downloadAction.createDownloadTasks([vueTools.toRaw(reactiveInfo)], '128k', null)
    out.steps.push({ case: 'createDownloadTasks(仅 toRaw，不做深拷贝)', ok: true })
  } catch (e) {
    out.steps.push({ case: 'createDownloadTasks(仅 toRaw，不做深拷贝)', ok: false, err: String(e && e.message).slice(0, 200) })
  }

  return out
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)

  const initInner = `(() => new Promise((resolve) => {
    if (window.__REQ__) return resolve('cached')
    const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
    window[ck].push([['__e2e_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
    setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 400)
  }))()`

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

  await run(initInner)
  const res = await run(INNER)
  const d = res && res.value
  if (!d) { console.log('失败:', JSON.stringify(res, null, 1)); ws.close(); return }

  console.log('\n=== 端到端：点击下载 ===')
  console.log('  歌曲:', d.song)
  console.log('  补齐后音质:', (d.afterFill || []).join(', '))
  console.log('')
  for (const s of d.steps) {
    console.log(`  ${s.case.padEnd(42)} ${s.ok ? '✅ 成功' : '❌ 失败'}`)
    if (s.err) console.log(`      ${s.err}`)
  }

  const master = d.steps.find(s => s.case.includes('master'))
  console.log('\n=== 判定 ===')
  console.log('  修复后点击下载可用:', master && master.ok ? '✅ 是（DataCloneError 已解决）' : '❌ 否')

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
