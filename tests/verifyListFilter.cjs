// 用真实键盘输入验证过滤框（而非直接改 state）
const { httpGet, connectWS } = require('./cdpClient.cjs')

const INIT_REQ = `(() => new Promise((resolve) => {
  if (window.__REQ__) return resolve('cached')
  const ck = Object.keys(window).find(k => k.startsWith('webpackChunk'))
  if (!ck) return resolve('no chunk')
  window[ck].push([['__d_' + Date.now()], {}, (req) => { window.__REQ__ = req }])
  setTimeout(() => resolve(window.__REQ__ ? 'ok' : 'fail'), 1500)
}))()`

const INNER = `(async () => {
  const req = window.__REQ__
  const out = {}
  const routerRaw = req('./src/renderer/router.ts')
  const router = routerRaw.default || routerRaw

  await router.push({ path: '/list', query: { id: 'wy_18ce67724ef7b3e709e3ea4053d4c596' } })
  await new Promise(r => setTimeout(r, 3000))

  const inputs = [...document.querySelectorAll('input')]
  out.placeholders = inputs.map(i => i.placeholder)
  const el = inputs.find(i => (i.placeholder || '').includes('过滤'))
  if (!el) return { ...out, error: '找不到过滤输入框' }
  out.rect = (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })()
  out.visible = !!(el.offsetWidth || el.offsetHeight)
  out.readOnly = el.readOnly
  out.disabled = el.disabled
  out.beforeValue = el.value

  // 聚焦 + 逐字符输入（模拟真实打字，走 v-model 的 input 事件）
  el.focus()
  out.focused = document.activeElement === el
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const type = async (text) => {
    let acc = ''
    for (const ch of text) {
      acc += ch
      setter.call(el, acc)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(r => setTimeout(r, 80))
    }
  }

  const rows = () => [...document.querySelectorAll('.list-item')]
  out.steps = []
  const snap = (tag) => out.steps.push({
    tag,
    inputValue: el.value,
    rowCount: rows().length,
    nums: rows().slice(0, 4).map(e => (e.innerText || '').split('\\n')[0]),
    names: rows().slice(0, 3).map(e => {
      const n = e.querySelector('.list-item-cell.auto.name .name')
      return n ? n.textContent.trim() : null
    }),
  })

  snap('before')
  await type('晴天')
  await new Promise(r => setTimeout(r, 900))
  snap('typed')

  // 点清除按钮
  const clearBtn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('清除'))
  out.clearBtnFound = !!clearBtn
  if (clearBtn) {
    clearBtn.click()
    await new Promise(r => setTimeout(r, 900))
    snap('afterClearClick')
    out.valueAfterClear = el.value
  }
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
          .catch(e => ({ ok: false, error: String((e && e.message) || e).slice(0, 600) }))
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
