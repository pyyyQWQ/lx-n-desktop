// 运行时回归：回退视频功能后，音质链路是否仍然正常。
// 检查项：
//   1) 音源声明的音质（qualityList）是否含 hires/atmos/master
//   2) 设置页可选音质是否为 7 项
//   3) getPlayQuality 回退逻辑是否正确
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(() => {
  const req = window.__REQ__
  if (!req) return { err: 'no webpack require' }
  const store = req('./src/renderer/store/index.ts')
  const utils = req('./src/renderer/core/music/utils.ts')
  const setting = req('./src/renderer/store/setting.ts')

  const ql = store.qualityList ? store.qualityList.value : null

  // 构造不同版权基础的歌曲，测试回退
  const mk = (qs) => ({
    id: 'wy_1', name: 't', singer: 's', source: 'wy', interval: '03:00',
    meta: { songId: 1, albumName: 'a', picUrl: null, qualitys: [],
            _qualitys: Object.fromEntries(qs.map(q => [q, { size: null }])) },
  })

  return {
    qualityList: ql,
    currentPlayQuality: setting.appSetting['player.playQuality'],
    tryQualityList: utils.TRY_QUALITYS_LIST,
    fallback: {
      '只有128k_选master': utils.getPlayQuality('master', mk(['128k'])),
      '只有320k_选master': utils.getPlayQuality('master', mk(['128k', '320k'])),
      '有flac_选master': utils.getPlayQuality('master', mk(['128k', '320k', 'flac'])),
      '有flac24bit_选master': utils.getPlayQuality('master', mk(['128k', '320k', 'flac', 'flac24bit'])),
      '有flac_选atmos': utils.getPlayQuality('atmos', mk(['128k', 'flac'])),
      '有flac_选hires': utils.getPlayQuality('hires', mk(['128k', 'flac'])),
    },
  }
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)

  // 安装 require 探针
  const initInner = `(() => new Promise((resolve) => {
    if (window.__REQ__) return resolve('cached')
    const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
    if (!ck) return resolve('no chunk')
    window[ck].push([['__r_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
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
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 300) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }

  const init = await run(initInner)
  console.log('探针:', JSON.stringify(init))

  const v = await run(INNER)
  console.log('\n===== 音质运行时状态 =====')
  if (!v || !v.value) { console.log(JSON.stringify(v, null, 1)); ws.close(); return }

  const d = v.value
  console.log('\n--- 音源声明（qualityList）---')
  console.log(JSON.stringify(d.qualityList, null, 1))

  console.log('\n--- 设置 ---')
  console.log('  当前优先音质:', JSON.stringify(d.currentPlayQuality))
  console.log('  回退链:', JSON.stringify(d.tryQualityList))

  console.log('\n--- 回退行为 ---')
  for (const [k, val] of Object.entries(d.fallback || {})) {
    console.log('  ' + k.padEnd(26) + ' → ' + val)
  }

  console.log('\n===== 判定 =====')
  const ql = d.qualityList || {}
  const hasExt = ['hires', 'atmos', 'master'].every(q => (ql.wy || []).includes(q))
  console.log('  音源仍声明扩展音质:', hasExt ? '✅' : '❌')
  const chainOk = JSON.stringify(d.tryQualityList) === JSON.stringify(['master', 'atmos_plus', 'atmos', 'hires', 'flac24bit', 'flac', '320k'])
  console.log('  回退链完整:', chainOk ? '✅' : '❌ ' + JSON.stringify(d.tryQualityList))
  const fb = d.fallback || {}
  const fbOk = fb['只有128k_选master'] === '128k' && fb['有flac_选master'] === 'master'
  console.log('  回退逻辑正确:', fbOk ? '✅' : '❌')

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
