// 模拟真实用户操作：已在每日推荐页 → 右击封面定位 → 检查是否滚动。
// 通过点击播放栏封面触发真实组件逻辑，而非直接调 router。
const { httpGet, connectWS } = require('./cdpClient.cjs')

const GET_STATE = `(() => {
  const root = document.querySelector('#root')
  const app = root && root.__vue_app__
  if (!app) return { err: 'no app' }
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
  walk(app._instance, 0)
  const ex = comp ? (comp.exposed || {}) : {}
  const rows = [...document.querySelectorAll('.list-item')]
  return {
    hash: location.hash,
    scrollTop: typeof ex.getScrollTop === 'function' ? ex.getScrollTop() : null,
    rowCount: rows.length,
    firstRow: rows[0] ? (rows[0].innerText || '').split('\\n')[0] : null,
    lastRow: rows.length ? (rows[rows.length - 1].innerText || '').split('\\n')[0] : null,
  }
})()`

const SCROLL_TOP = `(() => {
  const root = document.querySelector('#root')
  const app = root && root.__vue_app__
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
  walk(app._instance, 0)
  if (comp && comp.exposed && typeof comp.exposed.scrollToTop === 'function') {
    comp.exposed.scrollToTop()
    return { scrolled: true }
  }
  return { scrolled: false }
})()`

// 模拟右击：直接触发组件里的 handleToMusicLocation 逻辑（等价于用户右击桌面封面）
const TRIGGER_LOCATE = `(async () => {
  // 通过播放栏组件的 DOM 触发 contextmenu 事件
  const pic = document.querySelector('[class*="picContent"] img, [class*="picContent"]')
  if (!pic) return { err: 'no cover img found' }
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
  pic.dispatchEvent(ev)
  return { dispatched: true, target: pic.className.slice(0, 60) }
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
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 300) }))
      })()
    `
    const res = await ws.evaluate(code, true)
    return res.value
  }

  console.log('1) 初始状态:', JSON.stringify(await run(GET_STATE)))

  console.log('2) 滚到顶部:', JSON.stringify(await run(SCROLL_TOP)))
  await new Promise(r2 => setTimeout(r2, 600))
  console.log('   滚后状态:', JSON.stringify(await run(GET_STATE)))

  console.log('3) 模拟右击封面:', JSON.stringify(await run(TRIGGER_LOCATE)))
  await new Promise(r2 => setTimeout(r2, 3000))
  console.log('4) 定位后状态:', JSON.stringify(await run(GET_STATE)))

  ws.close()
}

main().catch(e => { console.error('失败:', e.message); process.exit(1) })
