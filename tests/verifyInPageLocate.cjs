// 验证「已在本页时右击定位」是否生效（含重复定位同一首的情况）。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INNER = `(async () => {
  const req = window.__REQ__
  const out = { steps: [] }

  const playState = req('./src/renderer/store/player/state.ts')
  const loc = req('./src/renderer/components/layout/PlayBar/useMusicLocation.ts')
  const routerRaw = req('./src/renderer/router.ts')
  const router = routerRaw.default || routerRaw

  const listId = playState.playMusicInfo?.listId ?? null
  const idx = playState.playInfo?.playIndex ?? -1
  out.input = { listId, playIndex: idx }

  // 先到每日推荐页
  await router.push({ path: '/wy/dailyRec' })
  await new Promise(r => setTimeout(r, 1500))
  out.onPage = location.hash

  const findComp = () => {
    const root = document.querySelector('#root')
    let comp = null
    const walk = (inst, d) => {
      if (!inst || d > 25 || comp) return
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
    walk(root?.__vue_app__?._instance, 0)
    return comp
  }
  const getTop = () => {
    const c = findComp()
    if (c && c.exposed && typeof c.exposed.getScrollTop === 'function') {
      const v = c.exposed.getScrollTop()
      return typeof v === 'number' ? Math.round(v) : null
    }
    return null
  }

  // 关键：先手动滚到顶部，模拟"用户在页面里但没在目标行"
  const c0 = findComp()
  if (c0 && c0.exposed && typeof c0.exposed.scrollToTop === 'function') {
    c0.exposed.scrollToTop()
    await new Promise(r => setTimeout(r, 600))
  }
  out.topBefore = getTop()

  // 第一次定位（在当前页右击）
  const t1 = loc.resolveMusicLocation(listId, idx)
  out.target1 = t1
  await router.push({ path: t1.path, query: t1.query })
  await new Promise(r => setTimeout(r, 2500))
  out.afterFirst = { hash: location.hash, scrollTop: getTop() }

  // 再滚回顶部
  const c1 = findComp()
  if (c1 && c1.exposed && typeof c1.exposed.scrollToTop === 'function') {
    c1.exposed.scrollToTop()
    await new Promise(r => setTimeout(r, 600))
  }
  out.topBeforeSecond = getTop()

  // 第二次定位（同一首歌，scrollIndex 不变 → 必须靠 locateSeq 才能触发）
  const t2 = loc.resolveMusicLocation(listId, idx)
  out.target2 = t2
  out.seqChanged = t1.query.locateSeq !== t2.query.locateSeq
  await router.push({ path: t2.path, query: t2.query })
  await new Promise(r => setTimeout(r, 2500))
  out.afterSecond = { hash: location.hash, scrollTop: getTop() }

  return out
})()`

const main = async () => {
  const r = await httpGet('127.0.0.1', 5858, '/json/list')
  const ws = await connectWS(JSON.parse(r.body).find(t => t.type === 'node').webSocketDebuggerUrl)
  const initInner = `(() => new Promise((resolve) => {
    if (window.__REQ__) return resolve('cached')
    const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
    window[ck].push([['__d_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
    setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 500)
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
  const v = res && res.value
  console.log(JSON.stringify(v, null, 1))
  if (v) {
    console.log('\n=== 判定（关键：已在页面时右击定位）===')
    console.log('  当前播放 index:', v.input.playIndex)
    console.log('  定位前 scrollTop:', v.topBefore)
    console.log('  第一次定位后 scrollTop:', v.afterFirst && v.afterFirst.scrollTop, (v.afterFirst && v.afterFirst.scrollTop > 0) ? '✅ 已滚动' : '❌ 未滚动')
    console.log('  --- 重复定位同一首 ---')
    console.log('  再次滚回顶部后:', v.topBeforeSecond)
    console.log('  locateSeq 已变化:', v.seqChanged ? '✅' : '❌')
    console.log('  第二次定位后 scrollTop:', v.afterSecond && v.afterSecond.scrollTop, (v.afterSecond && v.afterSecond.scrollTop > 0) ? '✅ 已滚动' : '❌ 未滚动')
  }
  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
