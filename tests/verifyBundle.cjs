// 检查打包产物里是否真的含有「音质回退链」与「无损下限」逻辑。
const fs = require('fs')
const dir = 'C:/Users/PY/Desktop/LX-N-Desktop-NEW/dist'

const t = fs.readFileSync(dir + '/renderer.js', 'utf8')

console.log('=== 回退链字面量 ===')
for (const n of ['master', 'atmos_plus', 'atmos', 'hires', 'flac24bit', 'flac', '320k']) {
  console.log('  ' + n.padEnd(12), t.includes('"' + n + '"') ? 'OK' : 'NO')
}

console.log('\n=== 连续回退链数组（压缩后仍是字面量数组） ===')
const re = /\[(?:"(?:master|atmos_plus|atmos|hires|flac24bit|flac|320k|128k)",?){3,}\]/g
const found = [...new Set(t.match(re) || [])]
console.log('  命中数量:', found.length)
for (const s of found) console.log('  ' + s)

console.log('\n=== 无损下限判定痕迹 ===')
// 源码 LOSSLESS_FLOOR_QUALITYS = ['flac','flac24bit','wav','ape'] 会被打成数组字面量
for (const pat of ['["flac","flac24bit","wav","ape"]', "['flac','flac24bit','wav','ape']", 'flac24bit","wav']) {
  console.log('  ' + pat.padEnd(42), t.includes(pat) ? 'OK' : 'NO')
}

console.log('\n=== i18n 新键 ===')
for (const k of ['quality__master', 'quality__hires', 'quality__atmos', 'tag__hires']) {
  console.log('  ' + k.padEnd(18), t.includes(k) ? 'OK' : 'NO')
}
