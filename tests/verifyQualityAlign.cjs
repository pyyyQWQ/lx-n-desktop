// 运行时验证：音质对齐手机版后，实际链路是否正常。
// 重点：
//   1) 设置页 7 项（无 flac24bit）
//   2) 歌曲元数据经别名归一后，flac24bit 已变成 hires
//   3) getPlayQuality 回退正确（只看 _qualitys）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(() => {
  const req = window.__REQ__
  if (!req) return { err: 'no require' }
  const store = req('./src/renderer/store/index.ts')
  const utils = req('./src/renderer/core/music/utils.ts')
  const setting = req('./src/renderer/store/setting.ts')
  const tools = req('./src/common/utils/tools.ts')

  // 构造歌曲（元数据里用 bl 别名模拟真实 SDK 产出）
  const mkRaw = (types, _types) => ({ songmid: 1, name: 't', singer: 's', source: 'wy', interval: '03:00', types, _types, albumName: 'a', img: '' })

  // 走真实转换函数，验证别名归一
  const rawWithFlac24 = mkRaw(
    [{ type: '128k', size: null }, { type: 'flac24bit', size: '20M' }],
    { '128k': { size: null }, flac24bit: { size: '20M' } },
  )
  const converted = tools.toNewMusicInfo(rawWithFlac24)

  const rawWithEffect = mkRaw(
    [{ type: '128k', size: null }, { type: 'effect', size: '50M' }],
    { '128k': { size: null }, effect: { size: '50M' } },
  )
  const convertedEffect = tools.toNewMusicInfo(rawWithEffect)

  const mkNew = (qs) => ({
    id: 'wy_1', name: 't', singer: 's', source: 'wy', interval: '03:00',
    meta: { songId: 1, albumName: 'a', picUrl: null, qualitys: [],
            _qualitys: Object.fromEntries(qs.map(q => [q, { size: null }])) },
  })

  return {
    tryQualityList: utils.TRY_QUALITYS_LIST,
    qualityRank: utils.QUALITY_RANK,
    currentPlayQuality: setting.appSetting['player.playQuality'],
    // 别名归一验证
    flac24bit转换后: {
      _types键: Object.keys(converted.meta._qualitys || {}),
      types: (converted.meta.qualitys || []).map(t => t.type),
    },
    effect转换后: {
      _types键: Object.keys(convertedEffect.meta._qualitys || {}),
      types: (convertedEffect.meta.qualitys || []).map(t => t.type),
    },
    // 回退验证
    fallback: {
      '只有128k_选master': utils.getPlayQuality('master', mkNew(['128k'])),
      '只有320k_选master': utils.getPlayQuality('master', mkNew(['128k', '320k'])),
      '有flac_选master': utils.getPlayQuality('master', mkNew(['128k', 'flac'])),
      '有hires_选master': utils.getPlayQuality('master', mkNew(['128k', 'flac', 'hires'])),
      '有master有hires_选master': utils.getPlayQuality('master', mkNew(['128k', 'flac', 'hires', 'master'])),
      '有master_选hires': utils.getPlayQuality('hires', mkNew(['128k', 'flac', 'hires', 'master'])),
    },
  }
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)

  const initInner = `(() => new Promise((resolve) => {
    if (window.__REQ__) return resolve('cached')
    const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
    if (!ck) return resolve('no chunk')
    window[ck].push([['__q_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
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

  console.log('\n=== 设置页音质列表 ===')
  console.log('  TRY_QUALITYS_LIST:', JSON.stringify(d.tryQualityList))
  console.log('  QUALITY_RANK     :', JSON.stringify(d.qualityRank))
  console.log('  当前优先音质     :', JSON.stringify(d.currentPlayQuality))

  console.log('\n=== 别名归一（真实转换函数） ===')
  console.log('  flac24bit 转换后 → _types:', JSON.stringify(d.flac24bit转换后._types键), '| types:', JSON.stringify(d.flac24bit转换后.types))
  console.log('  effect    转换后 → _types:', JSON.stringify(d.effect转换后._types键), '| types:', JSON.stringify(d.effect转换后.types))

  console.log('\n=== 回退行为 ===')
  for (const [k, v] of Object.entries(d.fallback || {})) console.log('  ' + k.padEnd(28) + ' → ' + v)

  console.log('\n=== 判定 ===')
  const noFlac24 = !JSON.stringify(d.tryQualityList).includes('flac24bit') && !JSON.stringify(d.qualityRank).includes('flac24bit')
  console.log('  列表已无 flac24bit        :', noFlac24 ? '✅' : '❌')
  const aliasOk = d.flac24bit转换后._types键.includes('hires') && !d.flac24bit转换后._types键.includes('flac24bit')
  console.log('  flac24bit → hires 生效    :', aliasOk ? '✅' : '❌')
  const effectOk = d.effect转换后._types键.includes('atmos') && !d.effect转换后._types键.includes('effect')
  console.log('  effect → atmos 生效       :', effectOk ? '✅' : '❌')
  const fb = d.fallback || {}
  const fbOk = fb['只有128k_选master'] === '128k' && fb['有flac_选master'] === 'flac' && fb['有master有hires_选master'] === 'master'
  console.log('  回退逻辑正确              :', fbOk ? '✅' : '❌')

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
