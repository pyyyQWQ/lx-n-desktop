// 网易云登录 Cookie 工具测试（阶段 B2）
// 运行：node tests/cookie.test.mjs
import { buildCookieString, filterNeteaseCookies, isLoginedByCookie } from '../src/common/utils/neteaseCookie.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('buildCookieString')
assert('空数组返回空串', buildCookieString([]) === '')
assert('过滤空 name/value', buildCookieString([{ name: '', value: 'x' }, { name: 'a', value: '' }]) === '')
assert('拼接 k=v', buildCookieString([{ name: 'a', value: '1' }, { name: 'b', value: '2' }]) === 'a=1; b=2')
assert('忽略非法条目', buildCookieString([{ name: 'a', value: '1' }, { name: null, value: '2' }, { name: 'c', value: null }]) === 'a=1')

console.log('filterNeteaseCookies')
const cookies = [
  { name: 'MUSIC_U', value: 'x', domain: '.music.163.com' },
  { name: 'NMTID', value: 'y', domain: '.music.163.com' },
  { name: 'evil', value: 'z', domain: '.music.163.com.example.com' },
  { name: 'other', value: 'q', domain: '.example.com' },
]
const filtered = filterNeteaseCookies(cookies)
assert('只保留网易云域名 cookie', filtered.length === 2)
assert('过滤伪造子域', !filtered.some(c => c.name == 'evil'))
assert('过滤无关域名', !filtered.some(c => c.name == 'other'))
assert('保留 MUSIC_U', filtered.some(c => c.name == 'MUSIC_U'))

console.log('isLoginedByCookie')
assert('含 MUSIC_U 为已登录', isLoginedByCookie('MUSIC_U=abc; NMTID=1') === true)
assert('不含 MUSIC_U 未登录', isLoginedByCookie('NMTID=1') === false)
assert('空串未登录', isLoginedByCookie('') === false)

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)