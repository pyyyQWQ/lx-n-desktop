// 网易云账户业务逻辑测试（阶段 B2）
// 运行：node tests/accountLogic.test.mjs
import { isCookieInvalidError, isSongLiked } from '../src/common/utils/wyAccountLogic.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('isCookieInvalidError（决定是否清持久化 Cookie）')
assert('「登录已过期或Cookie无效」为 true', isCookieInvalidError('登录已过期或Cookie无效') === true)
assert('「Cookie 无效或已过期」为 true', isCookieInvalidError('Cookie 无效或已过期') === true)
assert('「登录状态已过期」为 true', isCookieInvalidError('登录状态已过期') === true)
assert('「获取UID失败」为 false（非凭据失效）', isCookieInvalidError('获取UID失败') === false)
assert('socket hang up 为 false（网络类，不清理）', isCookieInvalidError('socket hang up') === false)
assert('timeout 为 false（网络类，不清理）', isCookieInvalidError('timeout') === false)
assert('空串为 false', isCookieInvalidError('') === false)
assert('非字符串为 false', isCookieInvalidError(null) === false)
assert('普通错误消息为 false', isCookieInvalidError('Network Error') === false)

console.log('isSongLiked')
assert('命中喜欢', isSongLiked(new Set(['123', '456']), '123') === true)
assert('数字转字符串命中', isSongLiked(new Set(['456']), 456) === true)
assert('未命中', isSongLiked(new Set(['123']), '999') === false)
assert('空集合 false', isSongLiked(new Set(), '1') === false)

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)