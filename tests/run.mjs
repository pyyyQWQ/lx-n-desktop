// 阶段 B2 隔离测试总入口。
// 运行：node --experimental-strip-types --experimental-loader ./tests/ts-resolve-loader.mjs tests/run.mjs
// （package.json 的 test 脚本已带上这些参数）
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tests = [
  'domain.test.mjs',
  'cookie.test.mjs',
  'accountLogic.test.mjs',
]

let allOk = true
for (const file of tests) {
  console.log(`\n===== ${file} =====`)
  try {
    await import(new URL(file, new URL(`file://${__dirname}/`)).href)
  } catch (err) {
    allOk = false
    console.error(`执行失败: ${file}`, err)
  }
}
console.log(`\n${allOk ? '全部通过' : '存在失败'}`)
process.exit(allOk ? 0 : 1)