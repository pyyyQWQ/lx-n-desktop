// 校验：用户音源脚本声明的音质，是否全部能通过主进程白名单（改版音质生效的关键）。
const fs = require('fs')

const SOURCE = 'C:/Users/PY/Desktop/lx-music-source-paid-1792733355355.js'
const PRELOAD = 'C:/Users/PY/Desktop/LX-N-Desktop-NEW/src/main/modules/userApi/renderer/preload.js'

const src = fs.readFileSync(SOURCE, 'utf8')
const m = src.match(/const MUSIC_QUALITY = (\{[^}]*\});/)
if (!m) { console.error('未找到 MUSIC_QUALITY 声明'); process.exit(1) }
const decl = JSON.parse(m[1].replace(/(\w+):/g, '"$1":'))

console.log('=== 音源声明的音质 ===')
for (const [k, v] of Object.entries(decl)) console.log('  ' + k + ': ' + v.join(', '))

const pre = fs.readFileSync(PRELOAD, 'utf8')
const wl = pre.match(/const supportQualitys = \{([\s\S]*?)\n\}/)[1]
const allow = {}
for (const mm of wl.matchAll(/(\w+): \[([^\]]*)\]/g)) {
  allow[mm[1]] = mm[2].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
}

console.log('=== 白名单（改后） ===')
for (const [k, v] of Object.entries(allow)) console.log('  ' + k + ': ' + (v.length ? v.join(', ') : '(空)'))

console.log('=== 逐平台比对 ===')
let allOk = true
for (const [pl, qs] of Object.entries(decl)) {
  if (!allow[pl]) { console.log('  ' + pl + ': 白名单缺失'); allOk = false; continue }
  const blocked = qs.filter(q => !allow[pl].includes(q))
  console.log('  ' + pl + ': 声明 ' + qs.length + ' 项，被拦截: ' + (blocked.length ? blocked.join(', ') : '无'))
  if (blocked.length) allOk = false
}

console.log('')
console.log(allOk ? '结论: 你的音源声明的全部音质都会被放行' : '结论: 仍有音质被拦截')
process.exit(allOk ? 0 : 1)
