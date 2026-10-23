export interface WindowSize {
  id: number
  name: string
  width: number
  height: number
}

export const windowSizeList: WindowSize[] = [
  {
    id: 0,
    name: 'smaller',
    width: 828,
    height: 540,
  },
  {
    id: 1,
    name: 'small',
    width: 920,
    height: 600,
  },
  {
    id: 2,
    name: 'medium',
    width: 1020,
    height: 660,
  },
  {
    id: 3,
    name: 'big',
    width: 1114,
    height: 718,
  },
  {
    id: 4,
    name: 'larger',
    width: 1202,
    height: 776,
  },
  {
    id: 5,
    name: 'oversized',
    width: 1385,
    height: 896,
  },
  {
    id: 6,
    name: 'huge',
    width: 1700,
    height: 1070,
  },
]

// 独立版 LX-N 的项目地址（发布、更新与反馈均指向此处，不再沿用原版 lx-music-desktop）。
// 详见 src/renderer/utils/update.js 与 build-config/build-pack.js 的 publish 配置。
export const LX_N_REPO_OWNER = 'pyyyQWQ'
export const LX_N_REPO_NAME = 'lx-n-desktop'
export const LX_N_REPO_BRANCH = 'main'
export const LX_N_HOMEPAGE = `https://github.com/${LX_N_REPO_OWNER}/${LX_N_REPO_NAME}`
export const LX_N_RELEASES = `${LX_N_HOMEPAGE}/releases`
export const LX_N_ISSUES = `${LX_N_HOMEPAGE}/issues`

/**
 * 是否启用「检查新版本 → 跳转独立版 GitHub Releases 手动下载」的更新提示。
 *
 * 启用后，应用启动/手动检查时会读取仓库 `main` 分支的 `publish/version.json`，
 * 若其 version 高于本地当前版本（package.json 的 version），则弹窗「发现新版本」
 * 并提供跳转到 LX_N_RELEASES 的手动下载入口；不下载、不覆盖安装。
 *
 * = 启用前提（发布流程中必须遵守） =
 * 1. 仓库 `main` 分支的 `publish/version.json` 的 version 必须与当前最新 Release 一致：
 *    否则版本不一致会给用户错误提示（例如沿用了原版 2.12.6 会让 1.0.0 用户被误报）。
 *    发布新版本时，把该文件的 version 改成新版本号并推送。
 * 2. 本地 package.json 的 version 与线上实际构建/对外发布版本保持一致。
 *
 * 当前状态：true（已开启「检查 → 提示 → 跳 Releases 手动下载」）。
 */
export const updateFeedEnabled = true

/**
 * 更新源地址清单（仅保留 github 源站 raw.githubusercontent.com）。
 * 刻意不加入 jsdelivr 等 CDN：这些 CDN 可能缓存旧的原版内容（如 2.12.6），
 * 会导致无法访问 GitHub 的用户被错误提示为原版版本。宁可获取失败，也不显示原版信息。
 * 供 src/renderer/utils/update.js 使用；独立成纯函数以便测试断言。
 */
export const getUpdateFeedAddress = () => [
  [`https://raw.githubusercontent.com/${LX_N_REPO_OWNER}/${LX_N_REPO_NAME}/${LX_N_REPO_BRANCH}/publish/version.json`, 'direct'],
]

export const navigationUrlWhiteList: RegExp[] = [
  // 阶段 B2：允许网易云官方域名的网页登录导航（含登录主站与子域）。
  // 精确到 music.163.com 及其子域，避免放开无关域名。仅用于登录页导航，不影响其他安全边界。
  /^https?:\/\/music\.163\.com(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/(?:data|interface|interface\d|m|p\d|p\d\.m)\.music\.163\.com(?::\d+)?(?:\/|$)/i,
]

// 基础黑白色
// export const commonColorNames = [
//   '--color-000', '--color-050', '--color-100', '--color-200', '--color-300', '--color-400',
//   '--color-500', '--color-600', '--color-700', '--color-800', '--color-900',
// ] as const
// export const commonLightColorValues = [
//   'rgb(255, 255, 255)',
//   'rgb(217,217,217)',
//   'rgb(184,184,184)',
//   'rgb(156,156,156)',
//   'rgb(133,133,133)',
//   'rgb(113,113,113)',
//   'rgb(96,96,96)',
//   'rgb(82,82,82)',
//   'rgb(70,70,70)',
//   'rgb(60,60,60)',
//   'rgb(51,51,51)',
// ] as const
// export const commonDarkColorValues = [
//   'rgb(11, 11, 11)',
//   'rgb(60,60,60)',
//   'rgb(99,99,99)',
//   'rgb(130,130,130)',
//   'rgb(155,155,155)',
//   'rgb(175,175,175)',
//   'rgb(191,191,191)',
//   'rgb(204,204,204)',
//   'rgb(214,214,214)',
//   'rgb(222,222,222)',
//   'rgb(229,229,229)',
// ] as const

