// WebDAV 同步纯逻辑隔离测试。
// 运行：node --experimental-strip-types --experimental-loader ./tests/ts-resolve-loader.mjs tests/run.mjs
// 仅测纯函数（src/common/utils/webdavSync.ts），不发起任何网络请求，不含任何凭据。
import {
  WEBDAV_SENSITIVE_SETTING_KEYS,
  filterWebdavSensitiveSettings,
  normalizeRemoteBasePath,
  buildRemoteFilePath,
  WEBDAV_FILE_NAMES,
  normalizeRemoteListsData,
  isRemoteNewer,
  isFirstSync,
  parseRemoteSettingsForApply,
  summarizeListsForSync,
  describeWebdavError,
  isListsDataShape,
} from '../src/common/utils/webdavSync.ts'
import fsNode from 'node:fs'
import pathNode from 'node:path'
import { fileURLToPath } from 'node:url'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('敏感设置键过滤（凭据绝不上云、绝不被云端覆盖）')
{
  const keys = [...WEBDAV_SENSITIVE_SETTING_KEYS]
  assert('包含网易云 Cookie', keys.includes('common.wy_cookie'))
  assert('包含 WebDAV 密码', keys.includes('sync.webdav.password'))
  assert('不包含普通设置键', !keys.includes('player.volume'))
  assert('不包含已废弃的 tryAutoUpdate', !keys.includes('common.tryAutoUpdate'))

  const src = {
    'common.wy_cookie': 'MUSIC_U=secret',
    'sync.webdav.password': 'p@ssw0rd',
    'player.volume': 0.8,
    'sync.webdav.url': 'https://dav.example.com/dav',
  }
  const out = filterWebdavSensitiveSettings(src)
  assert('Cookie 被剔除', out['common.wy_cookie'] === undefined)
  assert('WebDAV 密码被剔除', out['sync.webdav.password'] === undefined)
  assert('普通设置保留', out['player.volume'] === 0.8)
  assert('URL 保留', out['sync.webdav.url'] === 'https://dav.example.com/dav')
  assert('不修改入参（无副作用）', src['common.wy_cookie'] === 'MUSIC_U=secret')
}

console.log('远端目录路径规范化')
{
  assert('空值回退默认目录', normalizeRemoteBasePath('') === '/LX_Music')
  assert('undefined 回退默认目录', normalizeRemoteBasePath(undefined) === '/LX_Music')
  assert('缺首斜杠补齐', normalizeRemoteBasePath('MySync') === '/MySync')
  assert('多余尾斜杠去除', normalizeRemoteBasePath('/MySync/') === '/MySync')
  assert('多重斜杠收敛', normalizeRemoteBasePath('//a//b//') === '/a/b')
  assert('仅斜杠收敛为根', normalizeRemoteBasePath('/') === '')
}

console.log('远端文件路径构建（与移动端契约一致）')
{
  assert('playlists 文件名固定', WEBDAV_FILE_NAMES.lists === 'playlists.json')
  assert('settings 文件名固定', WEBDAV_FILE_NAMES.settings === 'settings.json')
  assert('user_apis 文件名固定', WEBDAV_FILE_NAMES.userApis === 'user_apis.json')

  assert('默认路径拼接', buildRemoteFilePath('/LX_Music/', 'playlists.json') === '/LX_Music/playlists.json')
  assert('自定义路径拼接', buildRemoteFilePath('/MySync', 'settings.json') === '/MySync/settings.json')
  assert('空路径回退默认', buildRemoteFilePath('', 'playlists.json') === '/LX_Music/playlists.json')
}

console.log('远端歌单载荷归一化（防止写坏本地）')
{
  const ok = normalizeRemoteListsData({ version: '2', lastModified: 1700000000000, data: { defaultList: [] } })
  assert('正常载荷 lastModified', ok.lastModified === 1700000000000)
  assert('正常载荷 version', ok.version === '2')

  const noTs = normalizeRemoteListsData({ data: { defaultList: [] } })
  assert('缺失 lastModified → 0（不会误判为远端更新）', noTs.lastModified === 0)

  const badTs = normalizeRemoteListsData({ data: { defaultList: [] }, lastModified: 'abc' })
  assert('非法 lastModified → 0', badTs.lastModified === 0)

  const noExtra = normalizeRemoteListsData({ data: { defaultList: [] }, playHistory: 'nope', downloadTasks: {} })
  assert('playHistory 非数组 → undefined', noExtra.playHistory === undefined)
  assert('downloadTasks 非数组 → undefined', noExtra.downloadTasks === undefined)

  const withExtra = normalizeRemoteListsData({ data: { defaultList: [] }, playHistory: [{ id: 1 }], downloadTasks: [{ id: 2 }] })
  assert('合法 playHistory 保留', Array.isArray(withExtra.playHistory) && withExtra.playHistory.length === 1)
  assert('合法 downloadTasks 保留', Array.isArray(withExtra.downloadTasks) && withExtra.downloadTasks.length === 1)

  let threw = false
  try { normalizeRemoteListsData({ lastModified: 1 }) } catch (_) { threw = true }
  assert('缺失 data 时抛错（不静默覆盖）', threw)

  threw = false
  try { normalizeRemoteListsData(null) } catch (_) { threw = true }
  assert('null 载荷抛错', threw)
}

console.log('同步方向判定（首次同步 / 远端更新）')
{
  assert('本地无记录为首次同步', isFirstSync(0) === true)
  assert('本地有记录非首次', isFirstSync(1700000000000) === false)
  assert('undefined 视为首次', isFirstSync(undefined) === true)

  assert('远端更新 → true', isRemoteNewer(200, 100) === true)
  assert('时间相同 → false', isRemoteNewer(100, 100) === false)
  assert('远端更旧 → false', isRemoteNewer(50, 100) === false)
  assert('远端 0 不覆盖', isRemoteNewer(0, 100) === false)
  assert('本地 0 且远端有时间 → true', isRemoteNewer(100, 0) === true)
}

console.log('远端设置解析（过滤敏感键 + 拒绝非法数据）')
{
  const applied = parseRemoteSettingsForApply({
    data: {
      'common.wy_cookie': 'MUSIC_U=secret',
      'sync.webdav.password': 'pwd',
      'player.playQuality': '320k',
    },
  })
  assert('下载设置剔除 Cookie', applied['common.wy_cookie'] === undefined)
  assert('下载设置剔除密码', applied['sync.webdav.password'] === undefined)
  assert('下载设置保留普通项', applied['player.playQuality'] === '320k')

  let threw = false
  try { parseRemoteSettingsForApply({ }) } catch (_) { threw = true }
  assert('缺失 data 抛错', threw)

  threw = false
  try { parseRemoteSettingsForApply({ data: [] }) } catch (_) { threw = true }
  assert('data 为数组抛错', threw)

  threw = false
  try { parseRemoteSettingsForApply(null) } catch (_) { threw = true }
  assert('null 抛错', threw)
}

console.log('本地列表摘要（同步确认提示用）')
{
  const s = summarizeListsForSync({
    defaultList: [1, 2, 3],
    loveList: [1, 2],
    userList: [{ list: [1, 2, 3, 4] }, { list: [] }],
    tempList: [1],
  })
  assert('默认列表计数', s.defaultCount === 3)
  assert('喜欢列表计数', s.loveCount === 2)
  assert('自建歌单计数', s.userListCount === 2)
  assert('歌曲总数含自建歌单（不含临时列表）', s.totalSongs === 3 + 2 + 4)

  const empty = summarizeListsForSync(null)
  assert('空输入安全', empty.defaultCount === 0 && empty.userListCount === 0 && empty.totalSongs === 0)
}

console.log('错误提示映射（覆盖常见失败，均不含凭据）')
{
  const c401 = describeWebdavError({ status: 401, message: 'Unauthorized' })
  assert('401 → 认证失败', /认证失败/.test(c401))
  assert('403 → 无权限', /无权限/.test(describeWebdavError({ status: 403 })))
  assert('404 → 路径不存在', /不存在/.test(describeWebdavError({ status: 404 })))
  assert('DNS 解析失败', /无法解析/.test(describeWebdavError({ message: 'getaddrinfo ENOTFOUND x' })))
  assert('连接被拒绝', /连接被拒绝/.test(describeWebdavError({ message: 'connect ECONNREFUSED 1.2.3.4:1' })))
  assert('超时', /超时/.test(describeWebdavError({ message: 'ETIMEDOUT' })))
  assert('证书问题', /证书/.test(describeWebdavError({ message: 'self signed certificate' })))
  assert('未知错误有兜底', /请求失败/.test(describeWebdavError({ message: 'weird' })))
  assert('错误提示不含密码字样', !/password|密码=/.test(describeWebdavError({ status: 401 })))
}

console.log('忽略手机端的设置/音源文件（不得被当成歌单而覆盖本地）')
{
  // 歌单数据：含 defaultList/loveList/userList 之一
  assert('真实歌单数据被识别', isListsDataShape({ defaultList: [], loveList: [], userList: [] }) === true)
  assert('仅含 defaultList 也算歌单', isListsDataShape({ defaultList: [] }) === true)
  assert('含 userList 数组算歌单', isListsDataShape({ userList: [] }) === true)

  // 手机端的 settings.json：data 是扁平键值对象
  const mobileSettings = { data: { 'common.langId': 'zh_cn', 'player.volume': 1, 'sync.webdav.url': 'x' } }
  assert('设置数据不被误认为歌单', isListsDataShape(mobileSettings.data) === false)
  let threw = false
  try { normalizeRemoteListsData(mobileSettings) } catch (_) { threw = true }
  assert('设置数据归一化时抛错（阻止覆盖）', threw)

  // 手机端的 user_apis.json：data 是 { list, scripts }
  const mobileApis = { data: { list: [{ id: 'a' }], scripts: { a: 'code' } } }
  assert('音源数据不被误认为歌单', isListsDataShape(mobileApis.data) === false)
  threw = false
  try { normalizeRemoteListsData(mobileApis) } catch (_) { threw = true }
  assert('音源数据归一化时抛错（阻止覆盖）', threw)

  // 非对象/数组等畸形输入
  assert('null 不是歌单', isListsDataShape(null) === false)
  assert('数组不是歌单', isListsDataShape([]) === false)
  assert('字符串不是歌单', isListsDataShape('x') === false)
  assert('空对象不是歌单', isListsDataShape({}) === false)
}
{
  // 从源码中抽取所有 t('setting__sync_webdav_*') 的字面量键名，逐一对照语言文件。
  // 这条测试直接覆盖本次「取消按钮显示成 setting__sync_webdav_$2」类问题。
  const fs = fsNode
  const path = pathNode
  const root = path.dirname(fileURLToPath(import.meta.url))
  const coreFile = path.join(root, '..', 'src', 'renderer', 'core', 'sync', 'webdavSync.ts')
  const vueFile = path.join(root, '..', 'src', 'renderer', 'views', 'Setting', 'components', 'SettingSync', 'WebdavSync.vue')

  const usedKeys = new Set()
  for (const f of [coreFile, vueFile]) {
    const src = fs.readFileSync(f, 'utf8')
    const re = /(?:t\(|\$t\()\s*'([A-Za-z0-9_.]+)'/g
    let m
    while ((m = re.exec(src)) !== null) {
      if (m[1].startsWith('setting__sync_webdav')) usedKeys.add(m[1])
    }
  }
  assert('源码中能抽取到 webdav 文案键', usedKeys.size > 0, 'count=' + usedKeys.size)

  // 不允许出现字面量残留（如正则反向引用未展开产生的 $2）
  const badRefs = [...usedKeys].filter(k => /\$/.test(k))
  assert('无未展开的正则反向引用（$1/$2 等）', badRefs.length === 0, badRefs.join(','))

  for (const lang of ['zh-cn', 'en-us', 'zh-tw', 'ko-kr']) {
    const p = path.join(root, '..', 'src', 'lang', lang + '.json')
    const dict = JSON.parse(fs.readFileSync(p, 'utf8'))
    const missing = [...usedKeys].filter(k => dict[k] === undefined)
    assert(`${lang}.json 覆盖全部引用的 webdav 键`, missing.length === 0, missing.length ? 'missing=' + missing.join(',') : '')
  }

  // 四个语言的 webdav 键集合必须一致（避免漏翻）
  const sets = ['zh-cn', 'en-us', 'zh-tw', 'ko-kr'].map(lang => {
    const p = path.join(root, '..', 'src', 'lang', lang + '.json')
    const dict = JSON.parse(fs.readFileSync(p, 'utf8'))
    return new Set(Object.keys(dict).filter(k => k.startsWith('setting__sync_webdav')))
  })
  const base = [...sets[0]].sort().join('|')
  const allSame = sets.every(s => [...s].sort().join('|') === base)
  assert('四个语言的 webdav 键集合一致', allSame, 'keys=' + sets[0].size)

  // 关键按钮文案必须非空且不是原始键名（防止把 key 直接显示出来）
  const zh = JSON.parse(fs.readFileSync(path.join(root, '..', 'src', 'lang', 'zh-cn.json'), 'utf8'))
  const buttonKeys = [
    'setting__sync_webdav_upload', 'setting__sync_webdav_download', 'setting__sync_webdav_cancel',
    'setting__sync_webdav_upload_lists', 'setting__sync_webdav_download_lists',
  ]
  for (const k of buttonKeys) {
    const v = zh[k]
    assert(`${k} 文案有效（非空、非键名）`, typeof v === 'string' && v.length > 0 && v !== k, v)
  }
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
