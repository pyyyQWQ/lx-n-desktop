// 网易云域名安全边界测试（阶段 B2）
// 直接运行：node tests/domain.test.mjs
import { isNeteaseMusicUrl, shouldInjectWyCookie } from '../src/common/utils/neteaseDomain.ts'

let passed = 0
let failed = 0

const assert = (label, cond) => {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

// ---- isNeteaseMusicUrl ----
console.log('isNeteaseMusicUrl 精确 hostname')

// 合法：精确匹配
assert('music.163.com 精确匹配为 true', isNeteaseMusicUrl('https://music.163.com') === true)
assert('music.163.com 根路径为 true', isNeteaseMusicUrl('https://music.163.com/login') === true)
assert('music.163.com 带端口为 true', isNeteaseMusicUrl('https://music.163.com:443/login') === true)
assert('http://music.163.com 为 true', isNeteaseMusicUrl('http://music.163.com/login') === true)
assert('大写主机名 true', isNeteaseMusicUrl('https://MUSIC.163.COM/login') === true)

// 合法：严格子域
assert('interface.music.163.com 为 true', isNeteaseMusicUrl('https://interface.music.163.com/eapi/x') === true)
assert('p1.music.163.com 为 true', isNeteaseMusicUrl('https://p1.music.163.com/x') === true)
assert('data.music.163.com 为 true', isNeteaseMusicUrl('https://data.music.163.com/x') === true)

// 伪造域名（必须为 false）
assert('music.163.com.example.com 为 false', isNeteaseMusicUrl('https://music.163.com.example.com/x') === false)
assert('music.163.com.cn 为 false', isNeteaseMusicUrl('https://music.163.com.cn/x') === false)
assert('evil-music.163.com 为 false', isNeteaseMusicUrl('https://evil-music.163.com/x') === false)
assert('163.com 为 false', isNeteaseMusicUrl('https://163.com/x') === false)
assert('example.com 为 false', isNeteaseMusicUrl('https://example.com/x') === false)
assert('appy 结尾伪造 music163.com 为 false', isNeteaseMusicUrl('https://music.163.comx/x') === false)

// 协议/类型边界
assert('javascript: 为 false', isNeteaseMusicUrl('javascript:alert(1)') === false)
assert('file: 为 false', isNeteaseMusicUrl('file:///music.163.com/x') === false)
assert('非字符串为 false', isNeteaseMusicUrl(null) === false)
assert('非字符串为 false (number)', isNeteaseMusicUrl(123) === false)
assert('相对路径为 false', isNeteaseMusicUrl('/music.163.com/x') === false)
assert('ftp 为 false', isNeteaseMusicUrl('ftp://music.163.com/x') === false)
assert('畸形 URL 为 false', isNeteaseMusicUrl('https://') === false)

// userinfo 场景（URL 规范会吃掉 @ 前内容）
assert('带 user:pass@ 归属仍判定 host', isNeteaseMusicUrl('https://u:p@music.163.com/x') === true)
assert('带 user:pass@ 伪造域名仍 false', isNeteaseMusicUrl('https://u:p@music.163.com.evil.com/x') === false)

// ---- shouldInjectWyCookie ----
console.log('shouldInjectWyCookie https + 精确域名')
assert('https music.163.com true', shouldInjectWyCookie('https://music.163.com/weapi/x') === true)
assert('http music.163.com false（拒绝明文）', shouldInjectWyCookie('http://music.163.com/weapi/x') === false)
assert('https 伪造域名 false', shouldInjectWyCookie('https://music.163.com.example.com/x') === false)
assert('非字符串 false', shouldInjectWyCookie(null) === false)
assert('https 子域 true', shouldInjectWyCookie('https://interface.music.163.com/eapi/x') === true)

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)