// 背景遮罩不透明度换算：两个滑块方向相反，必须钉死。
// 运行：node tests/backgroundOpacity.test.mjs
import { customBgMaskOpacity, dynamicBgMaskOpacity, resolveBgMaskOpacity } from '../src/common/utils/backgroundOpacity.ts'

let passed = 0
let failed = 0
const assert = (label, cond, extra) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

console.log('自定义背景：值是「图片可见度」，遮罩取反')
{
  assert('100 → 遮罩 0（图片完全可见）', customBgMaskOpacity(100) === 0)
  assert('0 → 遮罩 1（图片被完全遮住）', customBgMaskOpacity(0) === 1)
  assert('50 → 遮罩 0.5', customBgMaskOpacity(50) === 0.5)
  assert('30 → 遮罩 0.7（与实测现场一致）', customBgMaskOpacity(30) === 0.7)
  assert('越大越透明（方向不能反）', customBgMaskOpacity(80) < customBgMaskOpacity(20))
}

console.log('动态背景：值是「遮罩浓度」，同向')
{
  assert('100 → 遮罩 1', dynamicBgMaskOpacity(100) === 1)
  assert('0 → 遮罩 0', dynamicBgMaskOpacity(0) === 0)
  assert('60（默认）→ 遮罩 0.6', dynamicBgMaskOpacity(60) === 0.6)
  assert('越大越遮（与自定义背景相反）', dynamicBgMaskOpacity(80) > dynamicBgMaskOpacity(20))
}

console.log('边界与异常输入')
{
  assert('负数按 0 处理（自定义）', customBgMaskOpacity(-20) === 1)
  assert('超过 100 按 100 处理（自定义）', customBgMaskOpacity(180) === 0)
  assert('NaN → 兜底 1（自定义）', customBgMaskOpacity(NaN) === 1)
  assert('字符串数字可用', customBgMaskOpacity('40') === 0.6)
  assert('负数按 0 处理（动态）', dynamicBgMaskOpacity(-20) === 0)
  assert('超过 100 按 100 处理（动态）', dynamicBgMaskOpacity(180) === 1)
  assert('NaN → 0（动态）', dynamicBgMaskOpacity(NaN) === 0)
  assert('undefined → 0（动态）', dynamicBgMaskOpacity(undefined) === 0)
  assert('结果只有两位小数，不出现浮点尾巴', customBgMaskOpacity(33) === 0.67)
}

console.log('按背景类型分派')
{
  assert('自定义背景走 customBgOpacity', resolveBgMaskOpacity(true, 100, 60) === 0)
  assert('动态背景走 picOpacity', resolveBgMaskOpacity(false, 100, 60) === 0.6)
  assert('自定义背景时 picOpacity 不影响结果', resolveBgMaskOpacity(true, 50, 0) === 0.5)
  assert('动态背景时 customBgOpacity 不影响结果', resolveBgMaskOpacity(false, 0, 35) === 0.35)
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed > 0) process.exit(1)
