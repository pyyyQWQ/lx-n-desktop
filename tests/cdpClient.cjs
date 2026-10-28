// 通过 CDP 读取运行中的开发版主进程/渲染进程状态。
// 用途：客观验证音质是否真的生效（不靠听感）。
// 极简 CDP（Chrome DevTools Protocol）客户端，供 tests/probeFileSizes.cjs 使用。
// 用途：连接运行中的开发版主进程调试端口（默认 5858），并在页面上下文求值，
// 从而客观验证音质链路是否生效（不依赖人耳听感）。
//
// 只用于本地开发自测，不参与打包、不被生产代码引用。
const http = require('http')

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const httpGet = (host, port, path) => new Promise((resolve, reject) => {
  const req = http.request({ host, port, path, method: 'GET' }, res => {
    let b = ''
    res.on('data', d => b += d)
    res.on('end', () => resolve({ status: res.statusCode, body: b }))
  })
  req.on('error', reject)
  req.setTimeout(5000, () => req.destroy(new Error('timeout')))
  req.end()
})

const { createHash, randomBytes } = require('crypto')
const net = require('net')

// 极简 WebSocket 客户端（仅用于本地 CDP，够用即可）
const connectWS = (url) => new Promise((resolve, reject) => {
  const m = url.match(/^ws:\/\/([^:/]+):(\d+)(\/.*)$/)
  if (!m) return reject(new Error('bad ws url'))
  const [, host, port, path] = m
  const key = randomBytes(16).toString('base64')
  const sock = net.connect(Number(port), host, () => {
    sock.write(
      `GET ${path} HTTP/1.1\r\n` +
      `Host: ${host}:${port}\r\n` +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
    )
  })
  let buf = Buffer.alloc(0)
  let handshaked = false
  const pending = new Map()
  let idc = 0
  const onMessage = (payload) => {
    try {
      const msg = JSON.parse(payload.toString('utf8'))
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    } catch (_) { /* 忽略非 JSON */ }
  }
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d])
    if (!handshaked) {
      const idx = buf.indexOf('\r\n\r\n')
      if (idx === -1) return
      const head = buf.slice(0, idx).toString('latin1')
      if (!/101/.test(head.split('\r\n')[0])) return reject(new Error('handshake failed: ' + head.split('\r\n')[0]))
      buf = buf.slice(idx + 4)
      handshaked = true
      resolve(api)
    }
    // 解析帧
    while (buf.length >= 2) {
      const b1 = buf[1]
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let off = 2
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      const maskLen = masked ? 4 : 0
      if (buf.length < off + maskLen + len) return
      const mask = masked ? buf.slice(off, off + 4) : null
      const payload = Buffer.from(buf.slice(off + maskLen, off + maskLen + len))
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
      buf = buf.slice(off + maskLen + len)
      onMessage(payload)
    }
  })
  sock.on('error', reject)
  const sendFrame = (text) => {
    const payload = Buffer.from(text, 'utf8')
    const len = payload.length
    let header
    const mask = randomBytes(4)
    if (len < 126) {
      header = Buffer.from([0x81, 0x80 | len])
    } else if (len < 65536) {
      header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2)
    } else {
      header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2)
    }
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
    sock.write(Buffer.concat([header, mask, payload]))
  }
  const api = {
    evaluate: (expression, awaitPromise = false) => new Promise((resolveEval, rejectEval) => {
      const id = ++idc
      pending.set(id, (msg) => {
        if (msg.error) return rejectEval(new Error(JSON.stringify(msg.error)))
        const r = msg.result || {}
        if (r.exceptionDetails) return rejectEval(new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)))
        resolveEval(r.result)
      })
      sendFrame(JSON.stringify({
        id, method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise, includeCommandLineAPI: true },
      }))
    }),
    close: () => sock.destroy(),
  }
})

module.exports = { httpGet, connectWS }
