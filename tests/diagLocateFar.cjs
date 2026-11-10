// 真实双击第 10 行 → 右击定位 → 验证 scrollTop 是否 > 0 且目标行进入视口
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
  const playState = req('./src/renderer/store/player/state.ts')
  const listState = req('./src/renderer/store/list/state.ts')
  const routerRaw = req('./src/renderer/router.ts')
  const router = routerRaw.default || routerRaw

  const findComp = () => {
    let comp = null
    const walk = (inst, d) => {
      if (!inst || d > 30 || comp) return
      const nm = inst.type?.name || inst.type?.__name
      if (nm === 'MaterialOnlineList') { comp = inst; return }
      const visit = (vn) => {
        if (!vn || typeof vn !== 'object' || comp) return
        if (vn.component) walk(vn.component, d + 1)
        if (Array.isArray(vn.children)) vn.children.forEach(visit)
        if (vn.dynamicChildren) vn.dynamicChildren.forEach(visit)
      }
      visit(inst.subTree)
    }
    walk(document.querySelector('#root')?.__vue_app__?._instance, 0)
    return comp
  }
  const top = () => { const c = findComp(); return c?.exposed?.getScrollTop ? Math.round(c.exposed.getScrollTop()) : null }

  await router.push({ path: '/wy/dailyRec' })
  await new Promise(r => setTimeout(r, 1800))

  const rows = [...document.querySelectorAll('.list-item')]
  out.rowCount = rows.length
  // 先滚到顶部，确保第 10 行不在视口
  const c0 = findComp()
  if (c0?.exposed?.scrollToTop) c0.exposed.scrollToTop()
  await new Promise(r => setTimeout(r, 800))
  // 需要滚下去才能看到第 10 行；虚拟列表只有可见行
  if (c0?.exposed?.scrollToIndex) c0.exposed.scrollToIndex(10, -150, false)
  await new Promise(r => setTimeout(r, 900))
  const rowsNow = [...document.querySelectorAll('.list-item')]
  out.visibleFirst = rowsNow[0] ? (rowsNow[0].innerText || '').split('\\n')[0] : null
  const targetRow = rowsNow.find(e => (e.innerText || '').split('\\n')[0] === '10')
  out.targetRowFound = !!targetRow
  if (targetRow) {
    const cell = targetRow.querySelector('.list-item-cell.auto.name') || targetRow
    cell.click()
    await new Promise(r => setTimeout(r, 120))
    cell.click()
  }
  await new Promise(r => setTimeout(r, 3500))
  out.played = {
    listId: playState.playMusicInfo?.listId ?? null,
    playIndex: playState.playInfo?.playIndex ?? null,
    name: playState.playMusicInfo?.musicInfo?.name ?? null,
    metaId: listState.tempListMeta?.id ?? null,
  }

  // 滚回顶部 → 右击封面
  const c1 = findComp()
  if (c1?.exposed?.scrollToTop) c1.exposed.scrollToTop()
  await new Promise(r => setTimeout(r, 800))
  out.scrollTopBefore = top()
  out.visibleBefore = [...document.querySelectorAll('.list-item')][0] ? ([...document.querySelectorAll('.list-item')][0].innerText || '').split('\\n')[0] : null

  const pic = [...document.querySelectorAll('div')].find(e => typeof e.className === 'string' && e.className.includes('picContent'))
  if (pic) pic.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
  await new Promise(r => setTimeout(r, 2800))

  out.hashAfter = location.hash
  out.scrollTopAfter = top()
  const vis = [...document.querySelectorAll('.list-item')]
  out.visibleAfter = vis.map(e => (e.innerText || '').split('\\n')[0])
  out.targetVisible = out.visibleAfter.includes(String((out.played.playIndex ?? -1) + 1))
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
  await run(INIT_REQ)
  const v = await run(INNER)
  console.log(JSON.stringify(v, null, 1))
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
