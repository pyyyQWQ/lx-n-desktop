// 本地 WebDAV 传输层验证脚本（真实 HTTP，非 mock）。
// 目的：用最小 WebDAV 服务器验证 webdav 库的 testConnection / 逐级建目录 / upload / download / 404 语义。
// 不属于业务代码，验证后可删除。
const http = require('http')
const { createClient } = require('webdav')

const files = new Map()
const dirs = new Set(['/', '/dav', '/dav/LX_Music', '/dav/同步目录'])

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const method = req.method

  if (req.headers.authorization !== 'Basic ' + Buffer.from('user:pass').toString('base64')) {
    res.writeHead(401); return res.end('unauthorized')
  }

  if (method === 'PROPFIND') {
    if (url === '/' || url === '/dav' || url === '/dav/' || dirs.has(url)) {
      const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`
      res.writeHead(207, { 'Content-Type': 'application/xml' }); return res.end(body)
    }
    // 文件资源：返回大小/时间，供 stat 使用
    if (files.has(url)) {
      const len = Buffer.byteLength(files.get(url), 'utf8')
      const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>${len}</d:getcontentlength><d:getlastmodified>${new Date().toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`
      res.writeHead(207, { 'Content-Type': 'application/xml' }); return res.end(body)
    }
    res.writeHead(404); return res.end()
  }

  if (method === 'MKCOL') {
    dirs.add(url); res.writeHead(201); return res.end()
  }

  if (method === 'PUT') {
    let buf = ''
    req.on('data', c => { buf += c })
    req.on('end', () => { files.set(url, buf); res.writeHead(201); res.end() })
    return
  }

  if (method === 'GET') {
    if (files.has(url)) { res.writeHead(200); return res.end(files.get(url)) }
    res.writeHead(404); return res.end()
  }

  res.writeHead(405); res.end()
})

const results = []
const check = (label, ok, extra) => {
  results.push({ label, ok, extra })
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`)
}

server.listen(0, '127.0.0.1', async() => {
  const port = server.address().port
  const base = `http://127.0.0.1:${port}/dav`
  const cli = createClient(base, { username: 'user', password: 'pass' })

  try {
    // 1) 连接测试
    await cli.getDirectoryContents('/')
    check('testConnection（getDirectoryContents）成功', true)

    // 2) 错误凭据应失败
    const bad = createClient(base, { username: 'user', password: 'wrong' })
    let badOk = false, badStatus = null
    try { await bad.getDirectoryContents('/') } catch (e) { badOk = true; badStatus = e.status }
    check('错误密码被拒绝（401）', badOk && badStatus === 401, 'status=' + badStatus)

    // 3) 逐级建目录 + 上传
    for (const seg of ['LX_Music']) {
      if (!(await cli.exists('/' + seg))) await cli.createDirectory('/' + seg)
    }
    const payload = JSON.stringify({ version: '2', lastModified: 1700000000000, data: { defaultList: [{ id: 'a' }] } })
    await cli.putFileContents('/LX_Music/playlists.json', payload, { overwrite: true })
    check('逐级建目录 + 上传 playlists.json', true)

    // 4) 下载并校验内容一致
    const got = await cli.getFileContents('/LX_Music/playlists.json', { format: 'text' })
    check('下载内容与上传一致', got === payload, 'len=' + String(got).length)

    // 5) 404 → 库抛错且 status=404（供上层转 null）
    let notFound = false, nfStatus = null
    try { await cli.getFileContents('/LX_Music/settings.json', { format: 'text' }) } catch (e) { notFound = true; nfStatus = e.status }
    check('不存在的文件返回 404', notFound && nfStatus === 404, 'status=' + nfStatus)

    // 6) stat 存在文件
    const st = await cli.stat('/LX_Music/playlists.json')
    check('stat 可读取文件大小', st && st.size === payload.length, 'size=' + (st && st.size))

    // 7) 覆盖上传（overwrite）
    await cli.putFileContents('/LX_Music/playlists.json', '{"v":3}', { overwrite: true })
    const got2 = await cli.getFileContents('/LX_Music/playlists.json', { format: 'text' })
    check('同名文件可被覆盖', got2 === '{"v":3}')

    // 8) 中文路径目录
    if (!(await cli.exists('/同步目录'))) await cli.createDirectory('/同步目录')
    await cli.putFileContents('/同步目录/test.json', '{"cn":true}', { overwrite: true })
    check('中文目录路径上传成功', (await cli.getFileContents('/同步目录/test.json', { format: 'text' })) === '{"cn":true}')
  } catch (e) {
    check('执行异常: ' + e.message, false)
  }

  const passed = results.filter(r => r.ok).length
  console.log(`\n结果: 通过 ${passed}, 失败 ${results.length - passed}`)
  server.close()
  process.exit(passed === results.length ? 0 : 1)
})
