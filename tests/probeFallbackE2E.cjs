// 走应用完整链路验证音质回退：调用 handleGetOnlineMusicUrl（真正的播放取 URL 入口），
// 对「只有 128k 版权」和「有无损基础」两类歌，看最终落到的音质与文件大小。
//
// 用法（开发版必须先启动，5858 调试端口可连）：
//   node tests/probeFallbackE2E.cjs
//
// 目的：验证「选了最高音质但歌曲没有时，会按 master→atmos→hires→flac24bit→flac→320k→128k 回退」。
// 只做搜索 + 取 URL + HEAD，不写入用户数据、不下载音频正文。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const requestHead = (url) => new Promise((resolve) => {
  const u = new URL(url)
  const mod = u.protocol === 'https:' ? require('https') : require('http')
  const req = mod.request({
    host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'HEAD',
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
  }, res => resolve({ status: res.statusCode, length: Number(res.headers['content-length'] || 0), type: res.headers['content-type'] }))
  req.on('error', e => resolve({ err: e.message }))
  req.setTimeout(15000, () => { req.destroy(); resolve({ err: 'timeout' }) })
  req.end()
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

  const result = await runInPage(`
    (async () => {
      const req = window.__REQ__
      let wy = null
      for (const id of Object.keys(req.m || {})) {
        if (id === './src/renderer/utils/musicSdk/wy/index.js') { wy = req(id).default || req(id); break }
      }
      const utils = req('./src/renderer/core/music/utils.ts')

      // 找两首歌：一首只有128k，一首有无损
      let low = null, high = null
      for (const k of ['月亮代表我的心', '晴天']) {
        const res = await wy.musicSearch.search(k, 1, 8)
        for (const s of (res.list || [])) {
          const keys = Object.keys(s._types || {})
          const info = {
            id: s.songmid+'_wy', name: s.name, singer: s.singer, source: 'wy', interval: s.interval,
            meta: { songId: s.songmid, albumName: s.albumName, picUrl: s.img,
                    qualitys: s.types, _qualitys: s._types },
          }
          if (!low && keys.length === 1 && keys[0] === '128k') low = info
          if (!high && keys.includes('flac')) high = info
          if (low && high) break
        }
        if (low && high) break
      }

      const tryOne = async (info, label) => {
        if (!info) return { label, err: '未找到样本' }
        try {
          // 走真实入口：handleGetOnlineMusicUrl（内部会用 getPlayQuality 做回退）
          const r = await utils.handleGetOnlineMusicUrl({
            musicInfo: info, isRefresh: true, allowToggleSource: false, onToggleSource: () => {},
          })
          return {
            label,
            歌曲: info.name.slice(0, 18),
            元数据: Object.keys(info.meta._qualitys || {}).join('+') || '(空)',
            最终音质: r.quality,
            url: r.url,
          }
        } catch (e) {
          return { label, 歌曲: info.name.slice(0,18), err: String(e.message).slice(0, 140) }
        }
      }

      const a = await tryOne(low, '只有128k版权')
      const b = await tryOne(high, '有无损基础')
      return [a, b]
    })()
  `)

  if (!Array.isArray(result)) { console.log('结果异常:', JSON.stringify(result)); ws.close(); return }
  ws.close()

  console.log('\n=== 走完整链路的结果 ===')
  for (const item of result) {
    if (item.err) { console.log(`  [${item.label}] ${item.歌曲 || ''} 失败: ${item.err}`); continue }
    const h = await requestHead(item.url)
    console.log(`  [${item.label}] ${item.歌曲}`)
    console.log(`      元数据: ${item.元数据}`)
    console.log(`      最终音质: ${item.最终音质}`)
    console.log(`      文件大小: ${h.err ? h.err : (h.length / 1024 / 1024).toFixed(2) + ' MB'}`)
  }
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
