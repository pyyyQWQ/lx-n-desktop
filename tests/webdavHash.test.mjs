// WebDAV 同步决策：内容指纹 + 决策逻辑的纯函数测试。
// 运行：node tests/webdavHash.test.mjs
// 只测 src/common/utils/webdavSync.ts 的新增纯函数，不触网、不碰 store。
import { computeListsHash, decideSyncAction } from '../src/common/utils/webdavSync.ts'

let passed = 0
let failed = 0
const assert = (label, cond, extra) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const mkMusic = (id) => ({ id, name: 'n' + id, singer: 's' })

console.log('computeListsHash：基本结构')
{
  const a = computeListsHash({
    defaultList: [mkMusic('a1'), mkMusic('a2')],
    loveList: [mkMusic('b1')],
    userList: [{ id: 'u1', name: 'L1', list: [mkMusic('c1')] }],
  })
  assert('返回非空字符串', typeof a === 'string' && a.length > 0)

  const b = computeListsHash({
    defaultList: [mkMusic('a1'), mkMusic('a2')],
    loveList: [mkMusic('b1')],
    userList: [{ id: 'u1', name: 'L1', list: [mkMusic('c1')] }],
  })
  assert('相同内容 → 相同指纹', a === b)
}

console.log('computeListsHash：能检出真实改动')
{
  const base = {
    defaultList: [mkMusic('a1')],
    loveList: [mkMusic('b1')],
    userList: [{ id: 'u1', name: 'L1', list: [mkMusic('c1')] }],
  }
  const h0 = computeListsHash(base)

  assert('加一首歌 → 指纹变化', computeListsHash({
    ...base,
    userList: [{ id: 'u1', name: 'L1', list: [mkMusic('c1'), mkMusic('c2')] }],
  }) !== h0)

  assert('删一首歌 → 指纹变化', computeListsHash({
    ...base,
    loveList: [],
  }) !== h0)

  assert('改歌单名 → 指纹变化', computeListsHash({
    ...base,
    userList: [{ id: 'u1', name: 'L2', list: [mkMusic('c1')] }],
  }) !== h0)

  assert('新建歌单 → 指纹变化', computeListsHash({
    ...base,
    userList: [
      { id: 'u1', name: 'L1', list: [mkMusic('c1')] },
      { id: 'u2', name: 'L2', list: [] },
    ],
  }) !== h0)

  assert('歌曲顺序变化 → 指纹变化', computeListsHash({
    ...base,
    defaultList: [mkMusic('a2'), mkMusic('a1')],
  }) !== computeListsHash({ ...base, defaultList: [mkMusic('a1'), mkMusic('a2')] }))
}

console.log('computeListsHash：忽略不该影响判断的差异')
{
  const h1 = computeListsHash({
    userList: [
      { id: 'u1', name: 'L1', list: [mkMusic('c1')] },
      { id: 'u2', name: 'L2', list: [mkMusic('c2')] },
    ],
  })
  const h2 = computeListsHash({
    // 歌单顺序颠倒
    userList: [
      { id: 'u2', name: 'L2', list: [mkMusic('c2')] },
      { id: 'u1', name: 'L1', list: [mkMusic('c1')] },
    ],
  })
  assert('仅调整歌单顺序 → 指纹不变（不应误判为改动）', h1 === h2)

  const withMeta = computeListsHash({
    defaultList: [{ id: 'x1', name: 'song', singer: 's', interval: '03:00', playCount: 99 }],
    loveList: [],
    userList: [],
  })
  const withoutMeta = computeListsHash({
    defaultList: [{ id: 'x1', name: 'changed', singer: 'other', interval: '09:99', playCount: 0 }],
    loveList: [],
    userList: [],
  })
  assert('仅元数据变化（名称/时长/播放次数）→ 指纹不变', withMeta === withoutMeta)
}

console.log('computeListsHash：健壮性')
{
  assert('null 不抛错', typeof computeListsHash(null) === 'string')
  assert('undefined 不抛错', typeof computeListsHash(undefined) === 'string')
  assert('空对象不抛错', typeof computeListsHash({}) === 'string')
  assert('缺 list 字段的歌单不抛错', typeof computeListsHash({ userList: [{ id: 'u1', name: 'x' }] }) === 'string')
  assert('缺 id 的歌曲不抛错', typeof computeListsHash({ defaultList: [{ name: 'x' }] }) === 'string')
}

console.log('decideSyncAction：老用户首次升级（最关键）')
{
  // 老用户升级后 lastSyncHash 为空：绝不能被当成「本地有改动」而强制上传
  const r1 = decideSyncAction('hash-now', '', 100, 50)
  assert('空 lastHash → init-hash（不强制上传）', r1 === 'init-hash')
  const r2 = decideSyncAction('hash-now', '', 50, 100)
  assert('空 lastHash 且远端更旧 → 仍是 init-hash（保持旧行为）', r2 === 'init-hash')
}

console.log('decideSyncAction：本地有改动 → 本地优先')
{
  const r = decideSyncAction('hash-new', 'hash-old', 999, 100)
  assert('指纹不同且远端更新 → 仍然本地优先上传', r === 'upload-local-changed',
    '这正是修复的问题：不该弹"云端较新"')
  const r2 = decideSyncAction('hash-new', 'hash-old', 10, 100)
  assert('指纹不同且远端更旧 → 本地优先上传', r2 === 'upload-local-changed')
  const r3 = decideSyncAction('hash-new', 'hash-old', 100, 100)
  assert('指纹不同且时间戳相等 → 本地优先上传', r3 === 'upload-local-changed')
}

console.log('decideSyncAction：本地无改动 → 才用时间戳判断')
{
  const same = 'hash-same'
  assert('无改动 + 远端更新 → remote-newer', decideSyncAction(same, same, 200, 100) === 'remote-newer')
  assert('无改动 + 远端更旧 → upload', decideSyncAction(same, same, 50, 100) === 'upload')
  assert('无改动 + 相等 → upload', decideSyncAction(same, same, 100, 100) === 'upload')
}

console.log('decideSyncAction：远端时间戳异常值')
{
  const same = 'h'
  assert('远端 0 → upload', decideSyncAction(same, same, 0, 100) === 'upload')
  assert('远端 NaN → upload', decideSyncAction(same, same, NaN, 100) === 'upload')
  assert('本地 0 且远端有值 → remote-newer', decideSyncAction(same, same, 100, 0) === 'remote-newer')
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
