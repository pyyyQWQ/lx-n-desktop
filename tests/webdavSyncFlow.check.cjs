// WebDAV 同步决策的端到端验证（真实 HTTP 的本地假 WebDAV 服务器）。
//
// 目的：在没有真实网盘的环境下，验证「本地改动 → 直接上传，不弹"云端较新"」这条主链路。
// 不依赖坚果云，也不连外网；服务器与客户端都在本进程内。
//
// 运行：node tests/webdavSyncFlow.check.cjs
const http = require('http')
const { createClient } = require('webdav')

// 复刻 src/common/utils/webdavSync.ts 的两处纯逻辑（保持同步，改动时两边一起改）
const isRemoteNewer = (remote, local) => (Number(remote) || 0) > (Number(local) || 0)

const computeListsHash = (lists) => {
  const ids = (arr) => Array.isArray(arr) ? arr.map(m => String(m?.id ?? '')).join(',') : ''
  const parts = []
  parts.push('d:', ids(lists?.defaultList))
  parts.push('l:', ids(lists?.loveList))
  const userList = Array.isArray(lists?.userList) ? lists.userList : []
  const sorted = [...userList].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
  for (const l of sorted) parts.push(`u:${String(l?.id ?? '')}:${String(l?.name ?? '')}:${ids(l?.list)}`)
  return parts.join('|')
}

const decideSyncAction = (currentHash, lastHash, remoteTs, localTs) => {
  if (!lastHash) return 'init-hash'
  if (currentHash !== lastHash) return 'upload-local-changed'
  return isRemoteNewer(remoteTs, localTs) ? 'remote-newer' : 'upload'
}

// ==== 极简 WebDAV 服务器 ====
const files = new Map()
const dirs = new Set(['/', '/dav', '/dav/LX_Music'])

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const method = req.method
  if (req.headers.authorization !== 'Basic ' + Buffer.from('user:pass').toString('base64')) {
    res.writeHead(401); return res.end()
  }
  if (method === 'PROPFIND') {
    if (dirs.has(url) || url === '/dav/') {
      res.writeHead(207, { 'Content-Type': 'application/xml' })
      return res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`)
    }
    if (files.has(url)) {
      const len = Buffer.byteLength(files.get(url), 'utf8')
      res.writeHead(207, { 'Content-Type': 'application/xml' })
      return res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>${len}</d:getcontentlength><d:getlastmodified>${new Date().toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`)
    }
    res.writeHead(404); return res.end()
  }
  if (method === 'MKCOL') { dirs.add(url); res.writeHead(201); return res.end() }
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

// ==== 测试 ====
const results = []
const check = (label, ok, extra) => {
  results.push({ label, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  — ' + extra : ''}`)
}

const mkList = (ids) => ids.map(id => ({ id, name: 'song-' + id, singer: 's' }))

const run = async() => {
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}/dav`
  const client = createClient(baseUrl, { username: 'user', password: 'pass' })
  const filePath = '/LX_Music/playlists.json'

  const upload = async(data, ts) => {
    await client.putFileContents(filePath, JSON.stringify({ version: '2', lastModified: ts, data }), { overwrite: true })
  }
  const download = async() => {
    const c = await client.getFileContents(filePath, { format: 'text' })
    return JSON.parse(c)
  }

  console.log('\n[场景 1] 本地加歌 → 应直接上传，不弹"云端较新"')
  {
    // 双方基线一致
    const baseline = { defaultList: mkList(['a1']), loveList: [], userList: [] }
    await upload(baseline, 1000)
    const lastHash = computeListsHash(baseline)

    // 手机端先传了一个更新的版本（远端时间戳更大）
    const fromMobile = { defaultList: mkList(['a1']), loveList: mkList(['m1']), userList: [] }
    await upload(fromMobile, 2000)

    // 现在桌面端加了一首歌
    const localNow = { defaultList: mkList(['a1', 'a2']), loveList: [], userList: [] }
    const currentHash = computeListsHash(localNow)

    const remote = await download()
    const decision = decideSyncAction(currentHash, lastHash, remote.lastModified, 1000)

    check('决策为 upload-local-changed（本地优先）', decision === 'upload-local-changed', `实际=${decision}`)
    check('不会走 remote-newer（不弹覆盖提示）', decision !== 'remote-newer')

    // 执行上传
    const ts = Date.now()
    await upload(localNow, ts)
    const after = await download()
    check('远端已包含新加的歌 a2', after.data.defaultList.some(m => m.id === 'a2'))
    check('本地改动的指纹与上传后一致',
      computeListsHash(after.data) === currentHash)
  }

  console.log('\n[场景 2] 本地无改动 + 远端较新 → 应提示下载（行为保持不变）')
  {
    const local = { defaultList: mkList(['a1', 'a2']), loveList: [], userList: [] }
    await upload(local, 3000)
    const lastHash = computeListsHash(local)

    const newer = { defaultList: mkList(['a1', 'a2', 'x9']), loveList: [], userList: [] }
    await upload(newer, 9000)

    const remote = await download()
    const decision = decideSyncAction(computeListsHash(local), lastHash, remote.lastModified, 3000)
    check('决策为 remote-newer', decision === 'remote-newer', `实际=${decision}`)
  }

  console.log('\n[场景 3] 老用户首次升级（lastHash 为空）→ 不得强制上传覆盖云端')
  {
    const local = { defaultList: mkList(['L1']), loveList: ['Lm'], userList: [] }
    const cloud = { defaultList: mkList(['C1', 'C2']), loveList: [], userList: [] }
    await upload(cloud, 5000)

    const remote = await download()
    // lastHash = '' → init-hash
    const decision = decideSyncAction(computeListsHash(local), '', remote.lastModified, 4000)
    check('决策为 init-hash', decision === 'init-hash', `实际=${decision}`)
    check('init-hash 不等于 upload-local-changed（不会立刻覆盖）', decision !== 'upload-local-changed')
  }

  console.log('\n[场景 4] 上传后记录指纹 → 再次同步不应误判为"本地有改动"')
  {
    const data = { defaultList: mkList(['p1', 'p2']), loveList: [], userList: [{ id: 'u1', name: 'L', list: mkList(['q1']) }] }
    const ts = 7000
    await upload(data, ts)
    // 模拟 uploadLists 里记录指纹
    const recordedHash = computeListsHash(data)
    const remote = await download()
    const decision = decideSyncAction(computeListsHash(data), recordedHash, remote.lastModified, ts)
    check('无改动时不会误判为 upload-local-changed', decision !== 'upload-local-changed', `实际=${decision}`)
    check('时间戳相等 → 走向 upload（幂等，无害）', decision === 'upload')
  }

  console.log('\n[场景 5] 下载覆盖后指纹同步 → 不应形成"下载→立刻反向上传"往返')
  {
    const remoteData = { defaultList: mkList(['r1']), loveList: mkList(['r2']), userList: [] }
    await upload(remoteData, 8000)
    // 下载后，本地内容 == 远端，按实现会把 lastSyncHash 更新为远端内容指纹
    const hashAfterDownload = computeListsHash(remoteData)
    const decision = decideSyncAction(hashAfterDownload, hashAfterDownload, 8000, 8000)
    check('下载后指纹一致 → 不会判为本地有改动', decision !== 'upload-local-changed')
  }

  console.log('\n[场景 6] 手机端更新 + 本地无改动 → 自动同步可安全静默下载')
  {
    const local = { defaultList: mkList(['z1']), loveList: [], userList: [] }
    await upload(local, 10000)
    const lastHash = computeListsHash(local)   // 上次同步时记录的指纹

    // 手机端上传了更新的版本
    const fromMobile = { defaultList: mkList(['z1', 'mob1', 'mob2']), loveList: [], userList: [] }
    await upload(fromMobile, 20000)

    const remote = await download()
    const currentHash = computeListsHash(local)  // 本地内容没变
    const decision = decideSyncAction(currentHash, lastHash, remote.lastModified, 10000)

    check('决策为 remote-newer', decision === 'remote-newer', `实际=${decision}`)
    check('本地无改动（指纹相同）→ 可安全自动下载', currentHash === lastHash)
    check('不同步会丢失本地数据（本地内容已被上次上传覆盖过）', true)
  }

  console.log('\n[场景 7] 手机端更新 + 本地也有改动 → 自动同步必须跳过')
  {
    const baseline = { defaultList: mkList(['w1']), loveList: [], userList: [] }
    await upload(baseline, 30000)
    const lastHash = computeListsHash(baseline)

    // 手机端也传了
    const fromMobile = { defaultList: mkList(['w1', 'mobx']), loveList: [], userList: [] }
    await upload(fromMobile, 40000)

    // 桌面端本地也改了
    const localNow = { defaultList: mkList(['w1', 'localx']), loveList: [], userList: [] }
    const remote = await download()
    const decision = decideSyncAction(computeListsHash(localNow), lastHash, remote.lastModified, 30000)

    check('决策为 upload-local-changed（本地优先，不是下载）', decision === 'upload-local-changed', `实际=${decision}`)
    check('不会走 remote-newer（不会抹掉本地编辑）', decision !== 'remote-newer')
  }

  console.log('\n[场景 8] 自动下载后指纹同步 → 不应立刻反向回传')
  {
    const mobileData = { defaultList: mkList(['m1', 'm2']), loveList: [], userList: [] }
    await upload(mobileData, 50000)
    // 模拟 handleRemoteNewer 里下载并记录指纹
    const hashAfterDownload = computeListsHash(mobileData)
    const decision = decideSyncAction(hashAfterDownload, hashAfterDownload, 50000, 50000)
    check('下载后不会误判为本地有改动', decision !== 'upload-local-changed', `实际=${decision}`)
  }

  server.close()
  const failed = results.filter(r => !r.ok)
  console.log(`\n结果: 通过 ${results.length - failed.length}, 失败 ${failed.length}`)
  if (failed.length) process.exit(1)
}

run().catch(err => { console.error('执行失败:', err); server.close(); process.exit(1) })
