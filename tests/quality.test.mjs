// 音质逻辑测试（对齐移动改良版）。
// 运行：node tests/quality.test.mjs
// 仅测纯函数（src/common/utils/quality.ts 与 src/common/constants.ts），不触网、不含凭据。
import {
  QUALITY_LABELS,
  QUALITY_I18N_KEYS,
  QUALITY_ALIAS,
  isKnownQuality,
  normalizeQuality,
  getQualityLabel,
  isLosslessQuality,
  pickBestQuality,
} from '../src/common/utils/quality.ts'
import { QUALITYS, PLAY_QUALITY_OPTIONS } from '../src/common/constants.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('音质标识与展示名（对齐手机版）')
{
  assert('标准 7 档均已登记',
    ['128k', '320k', 'flac', 'hires', 'atmos', 'atmos_plus', 'master'].every(q => isKnownQuality(q)))
  assert('**flac24bit 不再被识别为标准标识**', !isKnownQuality('flac24bit'))
  assert('未知标识不被误判', !isKnownQuality('flac32bit') && !isKnownQuality('') && !isKnownQuality(null))
  assert('每个展示名都非空', Object.values(QUALITY_LABELS).every(v => typeof v == 'string' && v.length > 0))
  assert('每个展示名都有 i18n 键', Object.keys(QUALITY_LABELS).every(k => !!QUALITY_I18N_KEYS[k]))
  assert('hires 展示名为 Hires 无损24-Bit（与手机版一致）',
    QUALITY_LABELS.hires === 'Hires 无损24-Bit')
  assert('atmos 展示名为 臻品音质', QUALITY_LABELS.atmos === '臻品音质')
  assert('atmos_plus 展示名为 臻品音质 2.0', QUALITY_LABELS.atmos_plus === '臻品音质 2.0')
  assert('master 展示名为 臻品母带', QUALITY_LABELS.master === '臻品母带')
}

console.log('别名归一（核心：对齐手机版 toNewMusicInfo）')
{
  assert('flac24bit -> hires', normalizeQuality('flac24bit') === 'hires')
  assert('flac32bit -> hires', normalizeQuality('flac32bit') === 'hires')
  assert('effect -> atmos', normalizeQuality('effect') === 'atmos')
  assert('effect_plus -> atmos_plus', normalizeQuality('effect_plus') === 'atmos_plus')
  assert('标准标识不被改写', normalizeQuality('master') === 'master' && normalizeQuality('flac') === 'flac')
  assert('QUALITY_ALIAS 恰好 4 条', Object.keys(QUALITY_ALIAS).length === 4)
  assert('getQualityLabel 对别名给出一致结果',
    getQualityLabel('flac24bit') === getQualityLabel('hires'))
  assert('getQualityLabel(flac24bit) = Hires 无损24-Bit',
    getQualityLabel('flac24bit') === 'Hires 无损24-Bit')
}

console.log('getQualityLabel（翻译兜底）')
{
  assert('无翻译函数时用内置中文名', getQualityLabel('master') === '臻品母带')
  assert('翻译命中时用翻译值', getQualityLabel('hires', (k) => k === 'quality__hires' ? 'Hi-Res' : k) === 'Hi-Res')
  assert('翻译未命中（返回键名）时回退内置名', getQualityLabel('hires', (k) => k) === 'Hires 无损24-Bit')
  assert('翻译返回空串时回退内置名', getQualityLabel('atmos', () => '') === '臻品音质')
  assert('未知标识转大写兜底', getQualityLabel('weird') === 'WEIRD')
  assert('未知标识 null 安全', getQualityLabel(null) === '')
}

console.log('无损判定')
{
  assert('master 属无损及以上', isLosslessQuality('master'))
  assert('hires 属无损及以上', isLosslessQuality('hires'))
  assert('flac24bit（别名）也被判为无损', isLosslessQuality('flac24bit'))
  assert('320k 不属无损', !isLosslessQuality('320k'))
  assert('128k 不属无损', !isLosslessQuality('128k'))
}

console.log('pickBestQuality（按优先级取最优）')
{
  const avail = { hires: {}, flac: {} }
  assert('无 master 时取 hires', pickBestQuality(avail, QUALITYS) === 'hires')
  assert('有 master 时优先取 master', pickBestQuality({ master: {}, flac: {} }, QUALITYS) === 'master')
  assert('空字典返回 null', pickBestQuality({}, QUALITYS) === null)
  assert('null 安全', pickBestQuality(null, QUALITYS) === null)
}

console.log('QUALITYS 降级链（对齐手机版 QUALITY_RANK）')
{
  assert('master 位于最高优先级', QUALITYS[0] === 'master')
  assert('atmos_plus 排第二', QUALITYS[1] === 'atmos_plus')
  assert('128k 位于最低优先级', QUALITYS[QUALITYS.length - 1] === '128k')
  assert('包含全部 4 个高音质档', ['hires', 'atmos', 'atmos_plus', 'master'].every(q => QUALITYS.includes(q)))
  assert('**链路中不含 flac24bit**', !QUALITYS.includes('flac24bit'))
  assert('无重复项', new Set(QUALITYS).size === QUALITYS.length)
}

console.log('设置页选项（对齐手机版 TRY_QUALITYS_LIST）')
{
  assert('恰好 7 个选项', PLAY_QUALITY_OPTIONS.length === 7)
  assert('顺序由低到高', PLAY_QUALITY_OPTIONS[0] === '128k' && PLAY_QUALITY_OPTIONS[PLAY_QUALITY_OPTIONS.length - 1] === 'master')
  assert('包含 4 个高音质档', ['hires', 'atmos', 'atmos_plus', 'master'].every(q => PLAY_QUALITY_OPTIONS.includes(q)))
  assert('**不含 flac24bit**', !PLAY_QUALITY_OPTIONS.includes('flac24bit'))
  assert('reverse 后与手机版一致',
    JSON.stringify([...PLAY_QUALITY_OPTIONS].reverse()) === JSON.stringify(['master', 'atmos_plus', 'atmos', 'hires', 'flac', '320k', '128k']))
  const labels = [...PLAY_QUALITY_OPTIONS].reverse().map(q => getQualityLabel(q))
  assert('页面展示 7 个中文名',
    JSON.stringify(labels) === JSON.stringify(['臻品母带', '臻品音质 2.0', '臻品音质', 'Hires 无损24-Bit', 'FLAC', '320K', '128K']))
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
