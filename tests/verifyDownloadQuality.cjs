// 运行时验证：下载弹窗的音质补齐链路是否真的工作（wy 与 tx 两个平台）。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(async () => {
  const req = window.__REQ__
  if (!req) return { err: 'no require' }

  const utils = req('./src/renderer/core/music/utils.ts')
  const out = { platforms: {} }

  for (const src of ['wy', 'tx']) {
    const sdkPath = './src/renderer/utils/musicSdk/' + src + '/index.js'
    let sdk = null
    for (const id of Object.keys(req.m || {})) {
      if (id === sdkPath) { sdk = req(id).default || req(id); break }
    }
    if (!sdk || !sdk.musicSearch) { out.platforms[src] = { err: 'no sdk' }; continue }

    // 搜一首
    let song = null
    try {
      const res = await sdk.musicSearch.search(src === 'wy' ? '晴天' : '晴天 周杰伦', 1, 3)
      song = (res.list || []).find(x => x && x.songmid) || (res.list || [])[0]
    } catch (e) {
      out.platforms[src] = { err: 'search: ' + String(e && e.message).slice(0, 80) }; continue
    }
    if (!song) { out.platforms[src] = { err: 'no song' }; continue }

    // 构造 musicInfo（与列表点击下载时一致的结构）
    const info = {
      id: song.songmid + '_' + src,
      name: song.name, singer: song.singer, source: src,
      interval: song.interval,
      meta: {
        songId: song.songmid, albumName: song.albumName, picUrl: song.img,
        qualitys: song.types || [], _qualitys: song._types || {},
        hash: song.hash, strMediaMid: song.strMediaMid,
      },
    }
    const beforeTypes = (info.meta.qualitys || []).map(t => t.type)

    // 调用补齐函数
    const startedAt = Date.now()
    let filled = null
    let err = null
    try {
      filled = await utils.fillFullQuality(info)
    } catch (e) { err = String(e && e.message).slice(0, 120) }
    const elapsed = Date.now() - startedAt

    const afterTypes = filled ? (filled.meta.qualitys || []).map(t => t.type) : []
    const sizes = {}
    if (filled?.meta?._qualitys) {
      for (const [k, v] of Object.entries(filled.meta._qualitys)) sizes[k] = v && v.size ? v.size : null
    }

    out.platforms[src] = {
      song: song.name, singer: song.singer, songmid: song.songmid,
      beforeTypes, afterTypes, sizes, elapsedMs: elapsed,
      hasFullFlag: filled ? !!filled.meta._full : false,
      err,
    }
  }
  return out
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)

  const initInner = `(() => new Promise((resolve) => {
    if (window.__REQ__) return resolve('cached')
    const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
    if (!ck) return resolve('no chunk')
    window[ck].push([['__dq_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
    setTimeout(() => resolve(window.__REQ__ ? 'installed' : 'failed'), 400)
  }))()`

  const run = async(inner) => {
    const code = `
      (() => {
        const { BrowserWindow } = require('electron')
        const w = BrowserWindow.fromId(1)
        if (!w) return Promise.resolve({ __noWindow: true })
        return w.webContents.executeJavaScript(${JSON.stringify(inner)}, true)
          .then(v => ({ ok: true, value: v }))
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 350) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }

  console.log('探针:', JSON.stringify(await run(initInner)))
  const res = await run(INNER)
  const d = res && res.value
  if (!d) { console.log('失败:', JSON.stringify(res, null, 1)); ws.close(); return }

  for (const src of ['wy', 'tx']) {
    const p = d.platforms[src]
    const label = src === 'wy' ? '网易云 (wy)' : 'QQ音乐 (tx)'
    console.log(`\n${'='.repeat(60)}`)
    console.log('平台:', label)
    if (p.err) { console.log('  错误:', p.err); continue }
    console.log('  歌曲:', p.song, '-', p.singer)
    console.log('  补齐前音质:', (p.beforeTypes || []).join(', ') || '(空)')
    console.log('  补齐后音质:', (p.afterTypes || []).join(', ') || '(空)')
    console.log('  耗时:', p.elapsedMs + ' ms')
    console.log('  _full 标记:', p.hasFullFlag ? '✅' : '❌')
    if (p.sizes) {
      console.log('  文件大小:')
      for (const [k, v] of Object.entries(p.sizes)) {
        if (v) console.log(`    ${k.padEnd(12)} ${v}`)
      }
    }
    const gained = (p.afterTypes || []).filter(t => !(p.beforeTypes || []).includes(t))
    console.log('  新增档位:', gained.length ? gained.join(', ') : '(无)')
  }

  console.log('\n=== 判定 ===')
  const wy = d.platforms.wy || {}
  const tx = d.platforms.tx || {}
  const wyOk = !wy.err && wy.hasFullFlag && (wy.afterTypes || []).length > (wy.beforeTypes || []).length
  // QQ 音乐在搜索层就直接带出高音质，无需要额外补齐；判定为「最终结果里含 master」即可
  const txOk = !tx.err && (tx.afterTypes || []).includes('master')
  console.log('  网易云补齐成功:', wyOk ? '✅' : '❌')
  console.log('  QQ音乐补齐成功:', txOk ? '✅' : '❌')

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
