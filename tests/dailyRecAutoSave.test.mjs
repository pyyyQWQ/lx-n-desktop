// 每日推荐自动存歌单：纯逻辑测试。
// 运行：node tests/dailyRecAutoSave.test.mjs
// 只测纯函数（src/common/utils/dailyRecAutoSave.ts），不触网、不写数据库、无 store 依赖。
import {
  getLogicalDate,
  buildDailyPlaylistName,
  isDailyRecPlaylistName,
  pickDailyRecPlaylistsToRemove,
  pickDailyRecListToKeep,
  pickDuplicateNameListsToRemove,
  shouldOverwriteDailyRec,
  DAILY_REC_KEEP_COUNT,
} from '../src/common/utils/dailyRecAutoSave.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('逻辑日期（早上 7 点分界，对齐移动改良版）')
{
  const d7 = getLogicalDate(new Date(2026, 10, 10, 7, 0, 0))
  assert('07:00 → 当天 11-10', d7.getDate() === 10 && d7.getMonth() === 10)

  const d23 = getLogicalDate(new Date(2026, 10, 10, 23, 30, 0))
  assert('23:30 → 当天 11-10', d23.getDate() === 10)

  const d0 = getLogicalDate(new Date(2026, 10, 10, 0, 30, 0))
  assert('00:30 → 前一天 11-09', d0.getDate() === 9 && d0.getMonth() === 10)

  const d6 = getLogicalDate(new Date(2026, 10, 10, 6, 59, 59))
  assert('06:59:59 → 前一天 11-09', d6.getDate() === 9)

  const cross = getLogicalDate(new Date(2026, 10, 1, 3, 0, 0))
  assert('跨月 11-01 03:00 → 10-31', cross.getMonth() === 9 && cross.getDate() === 31)

  const crossYear = getLogicalDate(new Date(2027, 0, 1, 2, 0, 0))
  assert('跨年 01-01 02:00 → 12-31', crossYear.getFullYear() === 2026 && crossYear.getMonth() === 11 && crossYear.getDate() === 31)

  const input = new Date(2026, 10, 10, 3, 0, 0)
  const inputTime = input.getTime()
  getLogicalDate(input)
  assert('不修改传入的 Date 对象', input.getTime() === inputTime)
}

console.log('歌单命名（MM_DD_daily）')
{
  assert('11-10 → 11_10_daily', buildDailyPlaylistName(new Date(2026, 10, 10, 12, 0, 0)) === '11_10_daily')
  assert('01-05 → 01_05_daily（个位补零）', buildDailyPlaylistName(new Date(2026, 0, 5, 12, 0, 0)) === '01_05_daily')
  assert('12-31 → 12_31_daily', buildDailyPlaylistName(new Date(2026, 11, 31, 12, 0, 0)) === '12_31_daily')
  assert('默认参数符合格式', isDailyRecPlaylistName(buildDailyPlaylistName()))
}

console.log('命名识别')
{
  assert('11_10_daily 匹配', isDailyRecPlaylistName('11_10_daily'))
  assert('01_01_daily 匹配', isDailyRecPlaylistName('01_01_daily'))
  assert('11_10_dailyx 不匹配', !isDailyRecPlaylistName('11_10_dailyx'))
  assert('x11_10_daily 不匹配', !isDailyRecPlaylistName('x11_10_daily'))
  assert('11_1_daily 不匹配（未补零）', !isDailyRecPlaylistName('11_1_daily'))
  assert('普通歌单不匹配', !isDailyRecPlaylistName('我的收藏'))
  assert('null / undefined 安全', !isDailyRecPlaylistName(null) && !isDailyRecPlaylistName(undefined))
}

console.log('保留 3 天：删除超量项')
{
  assert('保留数量为 3', DAILY_REC_KEEP_COUNT === 3)

  // 已有 0 个 → 新建不用删
  assert('0 个 → 无需删除', pickDailyRecPlaylistsToRemove([]).length === 0)
  // 已有 1 个 → 新建后共 2 个，未超 3
  assert('1 个 → 无需删除', pickDailyRecPlaylistsToRemove(['11_09_daily']).length === 0)
  // 已有 2 个 → 新建后共 3 个，刚好达标
  assert('2 个 → 无需删除', pickDailyRecPlaylistsToRemove(['11_09_daily', '11_08_daily']).length === 0)
  // 已有 3 个 → 新建后共 4 个，需删 1 个最旧的
  const r3 = pickDailyRecPlaylistsToRemove(['11_09_daily', '11_07_daily', '11_08_daily'])
  assert('3 个 → 删 1 个', r3.length === 1)
  assert('删除的是最旧的 11_07_daily', r3[0] === '11_07_daily')
  // 已有 5 个 → 删 3 个（最旧 3 个）
  const r5 = pickDailyRecPlaylistsToRemove(['11_09_daily', '11_05_daily', '11_08_daily', '11_06_daily', '11_07_daily'])
  assert('5 个 → 删 3 个', r5.length === 3)
  assert('删的是最旧三个（05/06/07）', JSON.stringify(r5) === JSON.stringify(['11_05_daily', '11_06_daily', '11_07_daily']))
  // 非每日推荐歌单不受影响
  const mixed = pickDailyRecPlaylistsToRemove(['我的收藏', '11_09_daily', '11_08_daily', '11_07_daily'])
  assert('忽略非每日推荐歌单', mixed.length === 1 && mixed[0] === '11_07_daily')
}

console.log('同日是否需要覆盖')
{
  assert('第一首歌相同 → 跳过', shouldOverwriteDailyRec('wy_1', 'wy_1') === false)
  assert('第一首歌不同 → 覆盖', shouldOverwriteDailyRec('wy_1', 'wy_2') === true)
  assert('原歌单为空 → 覆盖', shouldOverwriteDailyRec(undefined, 'wy_2') === true)
  assert('原歌单为空字符串 → 覆盖', shouldOverwriteDailyRec('', 'wy_2') === true)
}

console.log('同名重复歌单：选出要保留的那个')
{
  const lists = [
    { id: 'a', name: '11_10_daily' },
    { id: 'b', name: '11_10_daily' },
    { id: 'c', name: '11_10_daily' },
    { id: 'd', name: '我的收藏' },
  ]
  assert('无同名 → null', pickDailyRecListToKeep(lists, '11_09_daily') === null)
  assert('默认保留第一个（DB 顺序即创建顺序）', pickDailyRecListToKeep(lists, '11_10_daily')?.id === 'a')
  assert('可按 preferId 保留指定项', pickDailyRecListToKeep(lists, '11_10_daily', 'c')?.id === 'c')
  assert('preferId 不存在时退回第一个', pickDailyRecListToKeep(lists, '11_10_daily', 'zzz')?.id === 'a')
  assert('空列表安全', pickDailyRecListToKeep([], '11_10_daily') === null)
  assert('名字为空 → null', pickDailyRecListToKeep(lists, '') === null)
}

console.log('同名重复歌单：选出要删除的项')
{
  const lists = [
    { id: 'a', name: '11_10_daily' },
    { id: 'b', name: '11_10_daily' },
    { id: 'c', name: '11_10_daily' },
    { id: 'd', name: '我的收藏' },
    { id: 'e', name: '11_09_daily' },
  ]
  const dup = pickDuplicateNameListsToRemove(lists, '11_10_daily', 'a')
  assert('删掉除 keep 外的所有同名项', JSON.stringify(dup) === JSON.stringify(['b', 'c']))
  assert('不删其它日期', !dup.includes('e'))
  assert('不删非每日推荐歌单', !dup.includes('d'))
  assert('只有 1 个同名 → 无重复可删', pickDuplicateNameListsToRemove([{ id: 'a', name: '11_10_daily' }], '11_10_daily', 'a').length === 0)
  assert('无同名 → 空数组', pickDuplicateNameListsToRemove(lists, '11_08_daily', 'a').length === 0)
  assert('名字为空 → 空数组（防误删全部）', pickDuplicateNameListsToRemove(lists, '', 'a').length === 0)
  assert('keepId 不在列表中 → 删除所有同名项', JSON.stringify(pickDuplicateNameListsToRemove(lists, '11_10_daily', 'nope')) === JSON.stringify(['a', 'b', 'c']))
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
