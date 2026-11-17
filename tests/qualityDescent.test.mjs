// 播放音质降级：按各平台自己的档位顺序向下找。
// 运行：node tests/qualityDescent.test.mjs
import { descendQuality, getQualityKeysBySource } from '../src/common/utils/qualityLabelBySource.ts'

let passed = 0
let failed = 0
const assert = (label, cond, extra) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

console.log('各平台档位顺序（降级依据）')
{
  assert('wy 6 档', getQualityKeysBySource('wy').length === 6)
  assert('tx 8 档', getQualityKeysBySource('tx').length === 8)
  assert('kw 4 档', getQualityKeysBySource('kw').length === 4)
  assert('wy 最高是 master', getQualityKeysBySource('wy')[0] === 'master')
  assert('kw 最高是 hires（没有 master）', getQualityKeysBySource('kw')[0] === 'hires')
  assert('tx 含 192k', getQualityKeysBySource('tx').includes('192k'))
  assert('wy 不含 192k', !getQualityKeysBySource('wy').includes('192k'))
}

console.log('同平台降级：高音质不可用 → 次高档')
{
  const wy = getQualityKeysBySource('wy')
  assert('wy 选master 有master → master', descendQuality('master', { master: 1, flac: 1 }, wy) === 'master')
  assert('wy 选master 无master → flac', descendQuality('master', { flac: 1, '320k': 1 }, wy) === 'flac')
  assert('wy 选atmos 只有320k → 320k', descendQuality('atmos', { '320k': 1 }, wy) === '320k')
  assert('wy 选hires 只有128k → 128k', descendQuality('hires', { '128k': 1 }, wy) === '128k')

  const tx = getQualityKeysBySource('tx')
  // 关键：192k 在 tx 的顺序里，不能被跳过
  assert('tx 选320k 有192k → 192k（不能跳过）', descendQuality('320k', { '192k': 1, '128k': 1 }, tx) === '192k')
  assert('tx 选master 只有atmos_plus → atmos_plus', descendQuality('master', { atmos_plus: 1 }, tx) === 'atmos_plus')
  assert('tx 选atmos_plus 无 → atmos', descendQuality('atmos_plus', { atmos: 1 }, tx) === 'atmos')

  const kw = getQualityKeysBySource('kw')
  assert('kw 选hires 有flac → flac', descendQuality('hires', { flac: 1 }, kw) === 'flac')
  assert('kw 选hires 只有320k → 320k', descendQuality('hires', { '320k': 1, '128k': 1 }, kw) === '320k')
}

console.log('跨平台：所选档位该平台没有 → 取该平台最高可用')
{
  const kw = getQualityKeysBySource('kw')
  // 用户在 QQ 选了 master，切到酷我（无 master）
  assert('kw 选master(不支持) 有hires → hires', descendQuality('master', { hires: 1, flac: 1 }, kw) === 'hires')
  assert('kw 选master(不支持) 有flac → flac', descendQuality('master', { flac: 1, '320k': 1 }, kw) === 'flac')
  assert('kw 选atmos_plus(不支持) 只有320k → 320k', descendQuality('atmos_plus', { '320k': 1 }, kw) === '320k')

  const mg = getQualityKeysBySource('mg')
  assert('mg 选master(不支持) 有flac → flac', descendQuality('master', { flac: 1, '128k': 1 }, mg) === 'flac')
  // 不应掉到最低档
  assert('mg 选master(不支持) 不会掉到128k', descendQuality('master', { flac: 1, '128k': 1 }, mg) !== '128k')
}

console.log('兜底与边界')
{
  const wy = getQualityKeysBySource('wy')
  assert('全部不可用 → 最低档', descendQuality('master', {}, wy) === '128k')
  assert('空顺序 → 128k', descendQuality('master', { master: 1 }, []) === '128k')
  assert('最低档是128k', wy[wy.length - 1] === '128k')
  assert('未知档位 + 只有128k → 128k', descendQuality('what', { '128k': 1 }, wy) === '128k')
  assert('未知平台顺序为空 → 128k', descendQuality('master', { master: 1 }, getQualityKeysBySource('xxx')) === '128k')
}

console.log('真实 meta._qualitys 形态')
{
  const wy = getQualityKeysBySource('wy')
  // 实际数据里可能带 null 值（表示该档位存在但大小未知）
  const realMeta = { '128k': { size: null }, '320k': { size: null }, flac: { size: null } }
  assert('值为对象时也能命中', descendQuality('master', realMeta, wy) === 'flac')
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
