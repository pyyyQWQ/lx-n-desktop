// 列表内联过滤：纯逻辑测试。
// 运行：node tests/listFilter.test.mjs
// 只测 src/common/utils/listFilter.ts，不触网、不碰 store。
import { filterMusicIndices } from '../src/common/utils/listFilter.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

const mk = (id, name, singer, album) => ({
  id, name, singer, meta: { albumName: album },
})

const list = [
  mk('1', '晴天', '周杰伦', '叶惠美'),
  mk('2', '七里香', '周杰伦', '七里香'),
  mk('3', '夜曲', '周杰伦', '十一月的萧邦'),
  mk('4', 'Lemon', '米津玄師', 'BOOTLEG'),
  mk('5', '打上花火', 'DAOKO', '打上花火'),
  mk('6', '勾指起誓', '洛天依', ''),
]

console.log('空关键词 → 返回全部下标')
{
  assert('空串返回全部', filterMusicIndices(list, '').length === list.length)
  assert('空串顺序为 0..n-1', JSON.stringify(filterMusicIndices(list, '')) === JSON.stringify([0, 1, 2, 3, 4, 5]))
  assert('纯空格等同空串', filterMusicIndices(list, '   ').length === list.length)
  assert('null 等同空串', filterMusicIndices(list, null).length === list.length)
  assert('undefined 等同空串', filterMusicIndices(list, undefined).length === list.length)
  assert('空列表返回空数组', filterMusicIndices([], '晴天').length === 0)
}

console.log('精确匹配：歌名 / 歌手 / 专辑分别成组')
{
  const r = filterMusicIndices(list, '晴天')
  assert('匹配到 1 首', r.length === 1)
  assert('命中下标 0', r[0] === 0)
}
{
  const r = filterMusicIndices(list, '周杰伦')
  assert('按歌手命中 3 首', r.length === 3)
  assert('只含 0/1/2 且保持原顺序', JSON.stringify(r) === JSON.stringify([0, 1, 2]))
}
{
  const r = filterMusicIndices(list, '叶惠美')
  assert('按专辑命中 1 首', JSON.stringify(r) === JSON.stringify([0]))
}

console.log('大小写不敏感')
{
  const r1 = filterMusicIndices(list, 'lemon')
  const r2 = filterMusicIndices(list, 'LEMON')
  assert('小写能命中', r1.length === 1 && r1[0] === 3)
  assert('大写同样命中', JSON.stringify(r1) === JSON.stringify(r2))
}

console.log('分组优先级：歌名组 → 歌手组 → 专辑组')
{
  // 「七里香」既是歌名也是专辑名：歌名组应排在前
  const r = filterMusicIndices(list, '七里香')
  assert('歌名命中在下标 1', r.includes(1))
  assert('下标 1 排在专辑命中之前', r[0] === 1)
}

console.log('模糊匹配：字符按序出现')
{
  const r = filterMusicIndices(list, '周杰')
  assert('「周杰」命中周杰伦 3 首', r.length === 3)
}
{
  // 单字「花」应命中「打上花火」
  const r = filterMusicIndices(list, '花')
  assert('「花」命中打上花火', r.includes(4))
}

console.log('无匹配')
{
  assert('不存在的关键词返回空数组', filterMusicIndices(list, 'zzzzzzzz').length === 0)
}

console.log('返回值是原始下标（关键：下游依赖下标）')
{
  const r = filterMusicIndices(list, '周杰伦')
  const names = r.map(i => list[i].name)
  assert('下标可正确映射回原对象', JSON.stringify(names) === JSON.stringify(['晴天', '七里香', '夜曲']))
  assert('过滤不改变原数组长度', list.length === 6)
  assert('过滤不修改原对象', list[0].name === '晴天')
}

console.log('健壮性')
{
  const messy = [
    { id: 'a', name: '甲', singer: '乙' },              // 无 meta
    { id: 'b', name: '', singer: '乙', meta: {} },       // 空 name + 空 meta
    { id: 'c', name: '甲丙', singer: '', meta: { albumName: '' } },
  ]
  const r = filterMusicIndices(messy, '甲')
  assert('无 meta 项不抛错', r.includes(0))
  assert('空 name 项不抛错', Array.isArray(r))
  assert('空 singer 项不抛错', r.includes(2))
}
{
  // 含正则元字符的关键词不应抛错
  let ok = true
  let r
  try { r = filterMusicIndices(list, 'a.*b') } catch (_) { ok = false }
  assert('正则元字符不抛错', ok)
  assert('返回数组', Array.isArray(r))
}
{
  const r = filterMusicIndices(list, '[')
  assert('未闭合方括号不抛错', Array.isArray(r))
}

console.log('重复项处理')
{
  const dup = [mk('1', '同名', 'A', ''), mk('2', '同名', 'A', '')]
  const r = filterMusicIndices(dup, '同名')
  assert('两个同名项都返回', r.length === 2)
  assert('下标不重复', new Set(r).size === r.length)
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
