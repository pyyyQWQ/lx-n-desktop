// 客观验证：对同一首歌的各档音质，只发 HEAD 请求读取 Content-Length，比较文件大小。
// 文件大小是判断音质是否真生效的客观指标（高音质文件应明显更大）。
// 不下载音频正文，只读响应头。
//
// 用法（开发版必须先启动，且 5858 调试端口可连）：
//   node tests/probeFileSizes.cjs
//
// 前提：开发版由 `pnpm run dev` 启动，主进程会监听 5858（Electron 默认 --inspect 端口）。
// 说明：本脚本只做「搜索一首歌 + 取 URL + HEAD」，不写入任何用户数据、不下载音频。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const requestHead = (url) => new Promise((resolve) => {
  try {
    const u = new URL(url)
    const mod = u.protocol === 'https:' ? require('https') : require('http')
    const req = mod.request({
      host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
    }, res => {
      resolve({ status: res.statusCode, length: res.headers['content-length'], type: res.headers['content-type'] })
    })
    req.on('error', e => resolve({ err: e.message }))
    req.setTimeout(15000, () => { req.destroy(); resolve({ err: 'timeout' }) })
    req.end()
  } catch (e) { resolve({ err: String(e.message) }) }
})

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const target = JSON.parse(r.body).find(t => t.type === 'node')
  const ws = await connectWS(target.webSocketDebuggerUrl)
  const runInPage = async(inner) => {
    const code = `
      (() => {
        const { BrowserWindow } = require('electron')
        const w = BrowserWindow.fromId(1)
        return w.webContents.executeJavaScript(${JSON.stringify(inner)}, true)
          .catch(e => ({ __error: String(e && e.message || e) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }

  const song = await runInPage(`
    (async () => {
      const req = window.__REQ__
      let wy = null
      for (const id of Object.keys(req.m || {})) {
        if (id === './src/renderer/utils/musicSdk/wy/index.js') { wy = req(id).default || req(id); break }
      }
      const res = await wy.musicSearch.search('晴天', 1, 1)
      const s = res.list[0]
      return { name: s.name, singer: s.singer, songmid: s.songmid }
    })()
  `)
  console.log('测试歌曲:', song.name, '-', song.singer, '| songmid:', song.songmid)

  const urls = await runInPage(`
    (async () => {
      const req = window.__REQ__
      const store = req('./src/renderer/store/index.ts')
      const userApis = store.userApi.apis
      const info = { name: '', singer: '', songmid: ${JSON.stringify(song.songmid)}, source: 'wy', interval: '', img: '', albumName: '' }
      const out = {}
      for (const q of ['128k','320k','flac','flac24bit','hires','atmos','master']) {
        try { out[q] = (await userApis.wy.getMusicUrl(info, q).promise).url } catch (e) { out[q] = null }
      }
      return out
    })()
  `)
  ws.close()

  console.log('\n=== 各档音质的真实文件大小（HEAD 请求） ===')
  const rows = []
  for (const q of ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master']) {
    const u = urls[q]
    if (!u) { console.log(`  ${q.padEnd(10)} 取 URL 失败`); continue }
    const h = await requestHead(u)
    if (h.err) { console.log(`  ${q.padEnd(10)} HEAD 失败: ${h.err}`); continue }
    const len = Number(h.length || 0)
    rows.push({ q, len })
    console.log(`  ${q.padEnd(10)} ${(len / 1024 / 1024).toFixed(2).padStart(8)} MB   status=${h.status}  ${h.type || ''}`)
  }

  console.log('\n=== 结论 ===')
  if (rows.length >= 2) {
    const bySize = [...rows].sort((a, b) => a.len - b.len)
    console.log('  从小到大: ' + bySize.map(r => `${r.q}(${(r.len / 1024 / 1024).toFixed(2)}MB)`).join(' < '))
    const uniq = new Set(rows.map(r => r.len))
    console.log(`  文件大小种类数: ${uniq.size} / ${rows.length}`)
    if (uniq.size === 1) console.log('  ⚠️ 所有音质文件大小完全相同 → 音源可能对每档返回同一个文件')
    else console.log('  ✅ 不同音质返回不同大小的文件，说明音源确实按档位下发不同资源')
  }
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
