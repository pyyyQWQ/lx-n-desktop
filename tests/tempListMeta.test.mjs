// 临时列表「播放来源」持久化：纯函数测试。
// 运行：node tests/tempListMeta.test.mjs
// 只测 src/common/utils/tempListMeta.ts，不触网、不碰 localStorage。
import { TEMP_LIST_META_KEY, serializeTempListMeta, parseTempListMeta } from '../src/common/utils/tempListMeta.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('存储键')
{
  assert('键名稳定（改名会使老数据失效）', TEMP_LIST_META_KEY === 'temp_list_meta')
}

console.log('serializeTempListMeta 序列化')
{
  assert('每日推荐来源', serializeTempListMeta('dailyrec_wy') === '{"id":"dailyrec_wy"}')
  assert('排行榜来源（含双下划线）', serializeTempListMeta('board__wy__19723756') === '{"id":"board__wy__19723756"}')
  assert('歌单来源', serializeTempListMeta('wy__24381616') === '{"id":"wy__24381616"}')
  assert('空字符串可序列化', serializeTempListMeta('') === '{"id":""}')
  assert('非字符串入参降级为空', serializeTempListMeta(null) === '{"id":""}')
  assert('undefined 降级为空', serializeTempListMeta(undefined) === '{"id":""}')
}

console.log('parseTempListMeta 反序列化')
{
  assert('正常回读', parseTempListMeta('{"id":"dailyrec_wy"}') === 'dailyrec_wy')
  assert('排行榜回读', parseTempListMeta('{"id":"board__wy__19723756"}') === 'board__wy__19723756')
  assert('空值 → 空串', parseTempListMeta('') === '')
  assert('null → 空串', parseTempListMeta(null) === '')
  assert('undefined → 空串', parseTempListMeta(undefined) === '')
  assert('非 JSON → 空串（不抛错）', parseTempListMeta('not json') === '')
  assert('JSON 数组 → 空串', parseTempListMeta('["a"]') === '')
  assert('JSON null → 空串', parseTempListMeta('null') === '')
  assert('JSON 字符串 → 空串', parseTempListMeta('"dailyrec_wy"') === '')
  assert('id 缺失 → 空串', parseTempListMeta('{}') === '')
  assert('id 是数字 → 空串（类型严格）', parseTempListMeta('{"id":123}') === '')
  assert('id 是 null → 空串', parseTempListMeta('{"id":null}') === '')
  assert('多余字段被忽略', parseTempListMeta('{"id":"wy__1","extra":true}') === 'wy__1')
}

console.log('序列化 ↔ 反序列化 往返一致')
{
  const ids = ['dailyrec_wy', 'board__wy__19723756', 'wy__24381616', 'kg__abc', '']
  for (const id of ids) {
    const round = parseTempListMeta(serializeTempListMeta(id))
    assert(`往返一致: "${id}"`, round === id)
  }
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
