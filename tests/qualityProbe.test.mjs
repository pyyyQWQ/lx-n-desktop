// 音源音质档位检测：纯逻辑测试。
// 运行：node tests/qualityProbe.test.mjs
// 只测 src/common/utils/qualityProbe.ts，不触网、不碰 store。
import {
  qualityOrder,
  sortQualitiesDesc,
  buildProbePlan,
  judgeProbe,
  isHlsUrl,
  summarizePlatform,
  summarizeProbe,
  makeEntry,
  formatBytes,
  formatMs,
} from '../src/common/utils/qualityProbe.ts'

let passed = 0
let failed = 0
const assert = (label, cond, extra) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

console.log('qualityOrder / sortQualitiesDesc')
{
  assert('master 最高', qualityOrder('master') > qualityOrder('flac'))
  assert('128k 最低（已知）', qualityOrder('128k') < qualityOrder('320k'))
  assert('未知档位为 0', qualityOrder('whatever') === 0)
  assert('未知档位排在已知之后', qualityOrder('ape') > qualityOrder('unknown_x'))

  const sorted = sortQualitiesDesc(['128k', 'master', 'flac', '320k'])
  assert('按高到低排序', JSON.stringify(sorted) === JSON.stringify(['master', 'flac', '320k', '128k']))

  const withUnknown = sortQualitiesDesc(['128k', 'weird', 'master'])
  assert('未知档位不被丢弃', withUnknown.includes('weird'))
  assert('未知档位排在最后', withUnknown[withUnknown.length - 1] === 'weird')

  const src = ['128k', 'master']
  sortQualitiesDesc(src)
  assert('不修改入参', JSON.stringify(src) === JSON.stringify(['128k', 'master']))
}

console.log('buildProbePlan')
{
  const declared = {
    kw: ['128k', '320k', 'flac', 'master'],
    wy: ['128k', 'flac'],
  }
  const full = buildProbePlan(declared, 'full')
  assert('full 固定返回 5 个平台', full.length === 5)
  // 各平台档位数不同：网易云 6 / QQ 8 / 酷狗 6 / 酷我 4 / 咪咕 4
  const bySrc = Object.fromEntries(full.map(p => [p.source, p.qualities.length]))
  assert('wy 6 档', bySrc.wy === 6)
  assert('tx 8 档', bySrc.tx === 8)
  assert('kg 6 档', bySrc.kg === 6)
  assert('kw 4 档', bySrc.kw === 4)
  assert('mg 4 档', bySrc.mg === 4)
  assert('组内按高到低', full.find(p => p.source === 'wy').qualities[0] === 'master')

  const quick = buildProbePlan(declared, 'quick')
  const wyq = quick.find(p => p.source === 'wy')
  assert('quick 只取最高一档', wyq.qualities.length === 1 && wyq.qualities[0] === 'master')
  // 酷我最高档是 hires（没有 master），quick 应取它自己的最高档
  const kwq = quick.find(p => p.source === 'kw')
  assert('酷我 quick 取 hires', kwq.qualities[0] === 'hires')

  // 默认行为：固定 5 平台 × 固定档位全集（不再因未声明而隐藏）
  const allPlan = buildProbePlan({ kw: ['128k'] }, 'full')
  assert('固定列出 5 个平台', allPlan.length === 5)
  assert('按各平台自己的档位表', allPlan.find(p => p.source === 'wy').qualities.length === 6)
  assert('空声明也列 5 个平台', buildProbePlan({}, 'full').length === 5)
  assert('null 也列 5 个平台', buildProbePlan(null, 'full').length === 5)

  // 兼容旧行为（onlyDeclared）
  assert('onlyDeclared 时空声明返回空', buildProbePlan({}, 'full', true).length === 0)
  assert('onlyDeclared 时跳过空数组平台', buildProbePlan({ kw: [] }, 'full', true).length === 0)
}

console.log('judgeProbe')
{
  assert('拿到 URL + 200 → pass', judgeProbe({ hasUrl: true, httpStatus: 200 }).status === 'pass')
  assert('206 也通过（Range 请求）', judgeProbe({ hasUrl: true, httpStatus: 206 }).status === 'pass')

  const noUrl = judgeProbe({ hasUrl: false })
  assert('无 URL → unverified（不判 fail）', noUrl.status === 'unverified')
  assert('无 URL 有原因', typeof noUrl.reason === 'string' && noUrl.reason.length > 0)

  assert('HLS → needs-manual', judgeProbe({ hasUrl: true, isHls: true }).status === 'needs-manual')
  assert('403 → fail', judgeProbe({ hasUrl: true, httpStatus: 403 }).status === 'fail')
  assert('404 → fail', judgeProbe({ hasUrl: true, httpStatus: 404 }).status === 'fail')
  assert('500 → fail', judgeProbe({ hasUrl: true, httpStatus: 500 }).status === 'fail')
  assert('超时优先于其他', judgeProbe({ hasUrl: false, timedOut: true }).status === 'timeout')
  assert('undeclared 是合法状态', makeEntry({ source: 'wy', quality: 'atmos', status: 'undeclared', elapsedMs: 0 }).status === 'undeclared')
  assert('超时有原因', judgeProbe({ hasUrl: true, timedOut: true }).reason.includes('超时'))
}

console.log('isHlsUrl')
{
  assert('.m3u8 识别', isHlsUrl('https://a.com/x.m3u8'))
  assert('带参数识别', isHlsUrl('https://a.com/x.m3u8?token=1'))
  assert('mp3 不识别', !isHlsUrl('https://a.com/x.mp3'))
  assert('flac 不识别', !isHlsUrl('https://a.com/x.flac'))
  assert('大小写不敏感', isHlsUrl('https://a.com/x.M3U8'))
}

console.log('summarizePlatform / summarizeProbe')
{
  const e1 = makeEntry({ source: 'kw', quality: 'master', status: 'pass', sizeBytes: 107000000, elapsedMs: 732 })
  const e2 = makeEntry({ source: 'kw', quality: 'flac', status: 'fail', reason: 'HTTP 403', elapsedMs: 400 })
  assert('makeEntry 填充标签', e1.qualityLabel.length > 0)
  assert('makeEntry 保留大小', e1.sizeBytes === 107000000)

  const p1 = summarizePlatform('kw', '酷狗', 2, [e1, e2], 1132)
  assert('passedCount 只数 pass', p1.passedCount === 1)
  assert('declaredCount 保留', p1.declaredCount === 2)

  const p2 = summarizePlatform('mg', '咪咕', 1, [
    makeEntry({ source: 'mg', quality: 'flac', status: 'unverified', elapsedMs: 800 }),
  ], 800)
  assert('unverified 不算通过', p2.passedCount === 0)

  const sum = summarizeProbe([p1, p2])
  assert('platformsWithPass 正确', sum.platformsWithPass === 1)
  assert('platformCount 正确', sum.platformCount === 2)
  assert('totalMs 累加', sum.totalMs === 1932)
}

console.log('formatBytes / formatMs')
{
  assert('空值返回空串', formatBytes(undefined) === '' && formatBytes(0) === '')
  assert('负数返回空串', formatBytes(-1) === '')
  assert('B 单位', formatBytes(500) === '500 B')
  assert('MB 单位', formatBytes(107000000) === '102.0 MB')
  assert('GB 单位', formatBytes(2 * 1024 ** 3) === '2.0 GB')

  assert('毫秒 <1s', formatMs(732) === '732ms')
  assert('秒 >=1s', formatMs(5200) === '5.2s')
  assert('空值', formatMs(undefined) === '')
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)
