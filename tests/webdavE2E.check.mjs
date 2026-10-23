// 端到端「同步载荷」验证：用真实 webdav 库 + 本地 mock 服务器，
// 验证上传/下载的 JSON 载荷在**敏感数据**上的真实行为（不 mock 业务逻辑）。
// 复用的是 src/common/utils/webdavSync.ts 的真实实现（通过 ts loader 引入）。
// 非业务代码，验证后可删除。
import http from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const files = new Map()
const dirs = new Set(['/', '/dav'])

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const method = req.method
  if (req.headers.authorization !== 'Basic ' + Buffer.from('u:p').toString('base64')) {
    res.writeHead(401); return res.end()
  }
  if (method === 'PROPFIND') {
    if (url === '/' || url === '/dav' || dirs.has(url)) {
      res.writeHead(207, { 'Content-Type': 'application/xml' })
      return res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`)
    }
    if (files.has(url)) {
      const len = Buffer.byteLength(files.get(url), 'utf8')
      res.writeHead(207, { 'Content-Type': 'application/xml' })
      return res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${url}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>${len}</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`)
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

let passed = 0; let failed = 0
const assert = (label, cond, extra) => {
  if (cond) { passed++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) } else { failed++; console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

async function main() {
  const { createClient } = require('webdav')
  const mod = await import('../src/common/utils/webdavSync.ts')

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}/dav`
  const cli = createClient(base, { username: 'u', password: 'p' })

  // 模拟桌面端的真实设置对象（含敏感凭据）
  const localSettings = {
    'common.wy_cookie': 'MUSIC_U=SECRET_COOKIE_VALUE',
    'sync.webdav.password': 'SECRET_DAV_PASSWORD',
    'sync.webdav.url': base,
    'sync.webdav.username': 'u',
    'player.playQuality': '320k',
    'player.volume': 0.6,
    'player.mediaDeviceId': 'some-device-id',
    'download.savePath': 'D:/Music',
    'common.langId': 'zh-cn',
  }

  console.log('上传设置：敏感键必须被剔除')
  const filtered = mod.filterWebdavSensitiveSettings(localSettings)
  const payload = { version: '2', lastModified: Date.now(), data: filtered }
  await cli.putFileContents('/LX_Music/settings.json', JSON.stringify(payload), { overwrite: true })
  const rawUploaded = files.get('/dav/LX_Music/settings.json')
  assert('上传载荷不含 Cookie 值', rawUploaded.indexOf('SECRET_COOKIE_VALUE') === -1)
  assert('上传载荷不含 WebDAV 密码值', rawUploaded.indexOf('SECRET_DAV_PASSWORD') === -1)
  assert('上传载荷不含 wy_cookie 键', rawUploaded.indexOf('common.wy_cookie') === -1)
  assert('上传载荷不含 webdav.password 键', rawUploaded.indexOf('sync.webdav.password') === -1)
  assert('上传载荷保留音质设置', rawUploaded.indexOf('player.playQuality') >= 0)
  assert('上传载荷保留音量设置', rawUploaded.indexOf('player.volume') >= 0)
  assert('上传载荷保留媒体设备 id（非敏感）', rawUploaded.indexOf('player.mediaDeviceId') >= 0)

  console.log('下载设置：敏感键不得覆盖本地')
  const downloaded = JSON.parse(rawUploaded)
  const toApply = mod.parseRemoteSettingsForApply(downloaded)
  assert('下载结果不含 Cookie', toApply['common.wy_cookie'] === undefined)
  assert('下载结果不含 WebDAV 密码', toApply['sync.webdav.password'] === undefined)
  assert('下载结果保留普通设置', toApply['player.playQuality'] === '320k')

  console.log('即使云端被篡改塞入 Cookie，下载也不应写回')
  const tampered = { data: { 'common.wy_cookie': 'EVIL_INJECTED', 'sync.webdav.password': 'EVIL_PWD', 'player.volume': 0.3 } }
  const applied = mod.parseRemoteSettingsForApply(tampered)
  assert('篡改的 Cookie 被过滤', applied['common.wy_cookie'] === undefined)
  assert('篡改的密码被过滤', applied['sync.webdav.password'] === undefined)
  assert('合法项仍可应用', applied['player.volume'] === 0.3)

  console.log('歌单载荷：结构契约与移动端一致')
  const lists = { defaultList: [{ id: 'm1' }], loveList: [], userList: [{ id: 'ul1', name: 'x', list: [{ id: 'm2' }] }], tempList: [] }
  await cli.putFileContents('/LX_Music/playlists.json', JSON.stringify({ version: '2', lastModified: 123456, data: lists }), { overwrite: true })
  const plRaw = await cli.getFileContents('/LX_Music/playlists.json', { format: 'text' })
  const normalized = mod.normalizeRemoteListsData(JSON.parse(plRaw))
  assert('playlists 含 version=2', normalized.version === '2')
  assert('playlists lastModified 正确', normalized.lastModified === 123456)
  assert('playlists.data.defaultList 保留', normalized.data.defaultList.length === 1)
  assert('playlists.data.userList 保留', normalized.data.userList.length === 1)
  assert('上传歌单不携带 playHistory', normalized.playHistory === undefined)
  assert('上传歌单不携带 downloadTasks', normalized.downloadTasks === undefined)

  console.log('路径构建与真实服务器交互')
  const p1 = mod.buildRemoteFilePath('/LX_Music/', mod.WEBDAV_FILE_NAMES.lists)
  assert('默认路径 = /LX_Music/playlists.json', p1 === '/LX_Music/playlists.json')
  const p2 = mod.buildRemoteFilePath('  /同步/  ', 'settings.json')
  assert('自定义中文路径规范化', p2 === '/同步/settings.json', p2)

  console.log('首次同步与新旧判定')
  assert('首次同步识别', mod.isFirstSync(0) === true)
  assert('远端更新识别', mod.isRemoteNewer(200, 100) === true)
  assert('非更新识别', mod.isRemoteNewer(100, 200) === false)

  console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
  server.close()
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error('执行异常:', e.message); server.close(); process.exit(1) })
