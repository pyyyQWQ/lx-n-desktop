// 更新源 / LX-N 项目地址配置测试（阶段：更新与关于页面独立化）
// 运行：node tests/updateFeed.test.mjs
import {
  LX_N_REPO_OWNER,
  LX_N_REPO_NAME,
  LX_N_REPO_BRANCH,
  LX_N_HOMEPAGE,
  LX_N_RELEASES,
  LX_N_ISSUES,
  updateFeedEnabled,
  getUpdateFeedAddress,
} from '../src/common/config.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('LX-N 独立版仓库常量（不应再指向原版 lyswhut/lx-music-desktop）')
assert('owner 为 pyyyQWQ', LX_N_REPO_OWNER === 'pyyyQWQ')
assert('repo 为 lx-n-desktop', LX_N_REPO_NAME === 'lx-n-desktop')
assert('不含 lyswhut 且不含 lx-music-desktop', !/lyswhut|lx-music-desktop/i.test(`${LX_N_REPO_OWNER}/${LX_N_REPO_NAME}`))
assert('default branch 为 main', LX_N_REPO_BRANCH === 'main')
assert('homepage 指向独立仓库', LX_N_HOMEPAGE === 'https://github.com/pyyyQWQ/lx-n-desktop')
assert('releases 指向独立仓库', LX_N_RELEASES === 'https://github.com/pyyyQWQ/lx-n-desktop/releases')
assert('issues 指向独立仓库', LX_N_ISSUES === 'https://github.com/pyyyQWQ/lx-n-desktop/issues')

console.log('更新源 URL 模板（通过常量拼接，应指向独立仓库 main 分支）')
const versionJsonUrl = `https://raw.githubusercontent.com/${LX_N_REPO_OWNER}/${LX_N_REPO_NAME}/${LX_N_REPO_BRANCH}/publish/version.json`
assert('更新源为主仓 main/publish/version.json', versionJsonUrl === 'https://raw.githubusercontent.com/pyyyQWQ/lx-n-desktop/main/publish/version.json')
assert('更新源不含原版标识', !/lyswhut|lx-music-desktop-version-info/.test(versionJsonUrl))

console.log('updateFeedEnabled（当前开启「检查 → 跳 Releases 手动下载」）')
assert('updateFeedEnabled === true', updateFeedEnabled === true)

console.log('更新源地址清单（只保留 github 源站，不依赖可能缓存旧原版内容的 CDN）')
const feed = getUpdateFeedAddress()
assert('更新源仅一个', feed.length === 1)
const feedUrl = feed[0][0]
assert('更新源为 raw.githubusercontent.com/pyyyQWQ/lx-n-desktop/main/publish/version.json', feedUrl === 'https://raw.githubusercontent.com/pyyyQWQ/lx-n-desktop/main/publish/version.json')
assert('更新源不含 jsdelivr/fastly/gcore CDN', !/(jsdelivr|gcore|cdn\.stsky)/.test(feedUrl))
assert('更新源不含原版标识', !/lyswhut|lx-music-desktop-version-info/.test(feedUrl))

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)