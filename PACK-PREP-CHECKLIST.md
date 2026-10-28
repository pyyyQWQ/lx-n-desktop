# 打包前准备清单

> 生成时间：2026-10-27 23:55（第 17 轮：打包前准备）
> 用途：等你确定版本号后，照着本清单逐项执行即可，避免踩坑。

---

## 0. 前置：版本号（**尚未确定，必须先定**）

打包前必须先把 `package.json` 的 `version` 改成目标版本，否则：
- 产物文件名仍是旧版本号
- exe 的 `FileVersion` / `ProductVersion` 仍是旧版本
- 用户无法区分新旧

建议 **1.2.0**（本轮是功能新增）。改完记得同步：
- `README.md` 里的「当前正式版本」与产物文件名
- 新建 `RELEASE_NOTES-v<版本号>.md`（用 `RELEASE_NOTES-TEMPLATE-NEXT.md` 填充占位符）

---

## 1. 打包前的强制检查（已全部通过 ✅）

| 检查 | 命令 | 当前结果 |
|---|---|---|
| 自动化测试 | `pnpm test` | ✅ 226 断言全通过（7 组） |
| 生产构建 | `pnpm build` | ✅ 4 目标全 success，0 ERROR |
| 产物含新逻辑 | `node tests/verifyBundle.cjs` | ✅ 回退链 + 无损下限 + i18n 键均在产物中 |
| 音源白名单 | `node tests/qualityWhitelist.check.cjs` | ✅ 42 处声明，0 拦截 |
| 我自己改的源码 lint | `eslint <我改的文件>` | ✅ 0 错误 |
| electron-builder 缓存 | 检查 `%LOCALAPPDATA%\electron-builder\Cache` | ✅ 7zip / nsis / winCodeSign **均已在缓存**，无需联网下载 |

> ⚠️ 全项目 `pnpm run lint` 会有 **21 个错误**，但**全部位于本轮未改动的文件**
> （`neteaseCookie.ts`、`webdavSync.ts`、`wyDailyRec.ts`、`app.ts`、`userApi/index.ts`、
> `wyWebLogin.ts`、`renderer/main.ts`、`user/action.ts`、`user/index.ts`、`renderer/utils/ipc.ts`）。
> 这是**项目既有状态**，非本轮引入。是否顺手修由你决定。

---

## 2. 🚨 最关键的坑：构建会清空 build 目录

`build-config/pack.js:21` → `del.sync(['dist/**', 'build/**'])`
而 electron-builder 的产物**也输出到 `build/`**。

**因此必须严格按此顺序：**

```powershell
# 环境
$env:PATH = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
$env:HTTPS_PROXY='http://127.0.0.1:33210'; $env:HTTP_PROXY='http://127.0.0.1:33210'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
$N = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$P = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
Set-Location 'C:\Users\PY\Desktop\LX-N-Desktop-NEW'

# 1) 构建（会清空 build/，所以这步必须在打包前）
& $N $P build

# 2) 打 Setup 包
& $N build-config/build-pack.js target=win arch=x64 type=setup

# 3) 打 portable 包
& $N build-config/build-pack.js target=win arch=x64 type=portable

# 4) 立刻把产物搬出 build/（关键！否则下次 build 会被删）
New-Item -ItemType Directory -Force 'C:\Users\PY\Desktop\LX-N-Release-Staging' | Out-Null
Copy-Item 'build\*.exe' 'C:\Users\PY\Desktop\LX-N-Release-Staging\' -Force
```

---

## 3. 产物验证清单（打完包逐项做）

| 项 | 检查方法 |
|---|---|
| 文件存在 | `Get-ChildItem build\*.exe` |
| exe 版本信息 | 右键属性 / `(Get-Item xxx.exe).VersionInfo` → FileVersion 应为目标版本 |
| CompanyName | 应为 `pyyyQWQ` |
| LegalCopyright | 应为 `Copyright © 2026 pyyyQWQ` |
| 静默安装 | `Setup.exe /S /D=<隔离目录>` → exit 0，目录生成主程序与卸载程序 |
| 安装版启动 | 从安装目录启动，窗口标题应为 `LX-N Music` |
| 便携版启动 | 复制到独立目录运行，能正常启动 |
| 便携数据隔离 | 便携 exe 同目录应生成 `userData\LxDatas` |
| **新功能确认** | 设置→播放，确认 7 个音质选项都在 |
| SHA-256 | 生成 `SHA256SUMS.txt` |

---

## 4. 不要上传的东西

- `*.blockmap`、`latest.yml`、`builder-debug.yml`、`win-unpacked/`
- 只上传：`Setup.exe`、`portable.exe`、`SHA256SUMS.txt`

---

## 5. 本轮改动尚未提交

当前工作区有 **16 个修改 + 6 个新增**，全部**未 commit**。
按铁律，commit / push / Release **都需要你明确授权**。

新增文件：
- `src/common/utils/quality.ts`
- `tests/quality.test.mjs`
- `tests/qualityWhitelist.check.cjs`
- `tests/cdpClient.cjs`
- `tests/probeFileSizes.cjs`
- `tests/probeFallbackE2E.cjs`
- `tests/verifyBundle.cjs`
- `RELEASE_NOTES-TEMPLATE-NEXT.md`

---

## 6. 备份

- 本轮打包前备份：`C:\Users\PY\Desktop\LX-N-Desktop-PRE-PACK-20261027-2355`（865 文件）
- 音质改动前备份：`C:\Users\PY\Desktop\LX-N-Desktop-PRE-QUALITY-20261027-2255`（859 文件）
