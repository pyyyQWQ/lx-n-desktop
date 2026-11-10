# 给 Codex 的任务：推送并发布 LX-N Desktop v1.3.0

> 本文件是为 Codex 准备的一次性工作说明。完成后请把它移入 `doc/` 留档。

---

## 0. 一句话目标

把本地 **7 个已完成的提交**推送到 `pyyyQWQ/lx-n-desktop`，打 tag `v1.3.0`，
创建 GitHub Release，上传**已经打好的两个安装包**。

**提交已经做完，打包也已经做完。你不需要改任何代码，也不需要重新构建。**

---

## 1. 环境准备（每个新终端都要）

```powershell
$env:PATH = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
$N = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$P = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
Set-Location 'C:\Users\PY\Desktop\LX-N-Desktop-NEW'
```

⚠️ **网络坑（本轮已踩过）**：
- 全局 git 代理指向已失效的 `127.0.0.1:33210`，会让 `git push` / `gh` 报 `Failed to connect ... port 443`
- github.com 在打包时会 `ETIMEDOUT`（IP `20.205.243.166:443`）
- **可用方案**：命令级覆盖，不碰全局配置
  ```powershell
  git -c http.proxy= -c https.proxy= push origin baseline-v1.0
  ```
- 打包时若必须拉取 electron 二进制，用镜像：
  ```powershell
  $env:ELECTRON_MIRROR='https://registry.npmmirror.com/-/binary/electron/'
  $env:ELECTRON_BUILDER_BINARIES_MIRROR='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
  $env:NODE_TLS_REJECT_UNAUTHORIZED='0'; $env:NO_PROXY='*'
  ```
  （**但本次不需要打包，请忽略这一条**）

---

## 2. 产物位置（**绝对不要重新打包**）

```
C:\Users\PY\Desktop\LX-N-Release-1.3.0\
├── lx-netease-music-desktop-v1.3.0-x64-Setup.exe      122,233,844 字节
├── lx-netease-music-desktop-v1.3.0-x64-portable.exe   110,554,039 字节
├── SHA256SUMS.txt
└── RELEASE_NOTES-v1.3.0.md
```

SHA-256（与 `SHA256SUMS.txt` 一致，已自校验）：

```
7D0CED37E6F3036F8564605F1C5503A35E3E727499DBDADEB9427CCC914DBB7D  lx-netease-music-desktop-v1.3.0-x64-Setup.exe
77130D79056F7636934FB683D43DD37279AC274A6D02B078559BA86FAE81B80F  lx-netease-music-desktop-v1.3.0-x64-portable.exe
```

🚨 **绝对不要运行 `pnpm build`**：`build-config/pack.js` 第 21 行是
`del.sync(['dist/**','build/**'])`，而安装包的输出目录也是 `build/`。
项目内 `build/` 里的副本可以丢，**项目外那份不能动**。

---

## 3. 当前 Git 状态

- 分支：`baseline-v1.0`
- 本地 HEAD：`2efb10d`（`docs: 交接文档记录第 24–32 轮`）
- 远端 `baseline-v1.0` 分支头：`1911857` —— **本地领先 7 个提交，全部未推送**
- 本地 tag：`v1.0.0` / `v1.1.0` / `v1.2.0`（尚无 `v1.3.0`）
- **工作区完全干净**（`git status --porcelain` 输出为空）

### 待推送的 7 个提交（按时间顺序，最早的在上）

| 提交 | 说明 |
|---|---|
| `8825885` | `feat: 列表项一键喜欢（心形按钮），对齐移动改良版` |
| `0c3574f` | `feat: 每日推荐自动存歌单，并修复同名歌单重复创建` |
| `6b09d3b` | `feat: 列表变更自动同步（WebDAV）` |
| `d5377f3` | `fix: 重启后底部封面右击「定位」失效` |
| `d07e6e4` | `test: 补充定位/去重/持久化的运行时验证脚本` |
| `1d1d01d` | `chore: 版本号提升至 1.3.0，补充发布说明` |
| `2efb10d` | `docs: 交接文档记录第 24–32 轮` |

> 这 7 个提交已按功能拆分完成，**不要 squash、不要 rebase、不要改写历史**，原样推送即可。

---

## 4. 推送步骤

```powershell
# 1) 确认工作区干净、领先 7 个提交
git -C 'C:\Users\PY\Desktop\LX-N-Desktop-NEW' status --porcelain
git -C 'C:\Users\PY\Desktop\LX-N-Desktop-NEW' rev-list --count origin/baseline-v1.0..HEAD

# 2) 推送分支（命令级覆盖失效代理，不改全局配置）
git -C 'C:\Users\PY\Desktop\LX-N-Desktop-NEW' -c http.proxy= -c https.proxy= push origin baseline-v1.0

# 3) 打 annotated tag 并推送
git -C 'C:\Users\PY\Desktop\LX-N-Desktop-NEW' tag -a v1.3.0 -m "LX-N 网易云音乐桌面版 v1.3.0"
git -C 'C:\Users\PY\Desktop\LX-N-Desktop-NEW' -c http.proxy= -c https.proxy= push origin v1.3.0
```

预期结果：`1911857..2efb10d  baseline-v1.0 -> baseline-v1.0`，tag 推送成功。

---

## 5. 发布前验证（推送前先跑，务必执行）

```powershell
& $N $P test          # 必须：278 断言全通过，exit 0
& $N $P test:webdav   # 必须：传输 8/8 + 数据安全 24/24，exit 0
```

⚠️ **不要跑 `pnpm build`**。产物已验证过，重新构建会清空 `build/`。

`test` 的预期输出（9 个文件全部 `失败 0`）：

```
domain 28 / cookie 11 / accountLogic 13 / updateFeed 14 / dailyRec 17
dailyRecAutoSave 44 / tempListMeta 25 / quality 44 / webdavSync 82
```

---

## 6. 创建 Release

- **仓库**：`https://github.com/pyyyQWQ/lx-n-desktop`
- **tag**：`v1.3.0`
- **标题**：`LX-N 网易云音乐桌面版 v1.3.0`
- **正文**：直接使用 `C:\Users\PY\Desktop\LX-N-Release-1.3.0\RELEASE_NOTES-v1.3.0.md` 的完整内容
  （与仓库根目录的 `RELEASE_NOTES-v1.3.0.md` 是同一份）
- **流程**：先创建 **Draft** → 核对附件大小与正文 → 再置为正式（`draft=false`）

### 需要上传的附件（**只 3 个**）

| 附件 | 字节 |
|---|---:|
| `lx-netease-music-desktop-v1.3.0-x64-Setup.exe` | 122,233,844 |
| `lx-netease-music-desktop-v1.3.0-x64-portable.exe` | 110,554,039 |
| `SHA256SUMS.txt` | 229 |

🚫 **不要上传**：`*.blockmap`、`latest.yml`、`builder-debug.yml`、`win-unpacked/`
（这些都在项目内 `build/` 里，本来也不该进 Release）

---

## 7. 工具说明

- 环境可能**没有 `gh` CLI**，也可能**没有 `GITHUB_TOKEN`**
- v1.2.0 那次的做法：用 Git 凭据管理器里已有的 GitHub 凭据调用 REST API
  - 凭据只在进程内存中使用，**不得写入仓库、日志或文档**
- 两个 exe 单次上传约 85–95 秒，属于正常
- 上传后 API 报告的大小必须与上表字节数完全一致

---

## 8. 已验证 / 未验证（**发布说明里不要夸大**）

### 已实际验证通过
- `pnpm test`：278 断言
- `pnpm test:webdav`：传输 8/8 + 数据安全 24/24
- `pnpm build`：4 目标全 success
- Setup 静默安装 `/S /D=<隔离目录>` → exit 0，主程序与卸载程序均生成
- 安装版启动：窗口标题 `LX-N Music`，8 个进程，响应正常
- 便携版启动：窗口标题 `LX-N Music`，在 exe 同目录生成 `userData\LxDatas`（未写入 `%APPDATA%`）
- exe 版本属性：两者 `FileVersion` / `ProductVersion` 均为 **1.3.0**，`CompanyName` = `pyyyQWQ`，
  `LegalCopyright` = `Copyright © 2026 pyyyQWQ`
- `app.asar` 内含本轮新代码（`temp_list_meta`、`pickDuplicateNameListsToRemove`、`wyLikedListChanged`）
- SHA256SUMS 自校验一致
- 运行时验证：心形按钮、封面定位、同名歌单去重（详见交接文档 §34–§42）

### 未验证（**不要在 Release 里声称已验证**）
- 真实网易云账号端到端（发布环境无可用账号）
- 下载弹窗界面按钮渲染（需用户实机确认）
- kw / kg / mg 三平台的音质补全（仅验证 wy 与 tx）
- x86 / ARM64 / Windows 7/8
- 代码签名（未配置证书，会出现 SmartScreen「未知发布者」）
- **真实进程重启后的「恢复上次播放 → 右击定位」端到端**
  （只验证到「reload 后来源能从 localStorage 还原」这一层）

---

## 9. 铁律（务必遵守）

1. **禁止** `git reset --hard` / `git clean` / 强制切分支 / 改写已有历史
2. **旧项目只读**：`C:\Users\PY\Desktop\LX-n-desktop\lx-netease-music-desktop` 绝对不要修改
3. 文档、日志、代码、commit message 中**不得出现真实 Cookie / 密码 / Token / API Key**
4. **不要重新打包，不要跑 `pnpm build`**（会清空 `build/`，虽然项目外有备份）
5. **不要 squash / rebase** 这 7 个提交，按原样推送
6. 未实际执行的测试**不得声称通过**
7. 不要往仓库里提交任何产物（`build/`、`dist/`、`*.exe` 均已被 `.gitignore` 忽略）

---

## 10. 完成后

请在 `PROJECT_HANDOFF.md` 末尾追加一节「**§43 第 33 轮：v1.3.0 发布**」，记录：

- 实际的推送结果（`1911857..2efb10d  baseline-v1.0 -> baseline-v1.0` 及 exit code）
- tag `v1.3.0` 的对象 hash 与指向的提交
- Release 地址
- 上传了哪些附件、各自 API 报告的大小
- 遇到的任何问题及处理方式（尤其是代理 / 凭据部分）

然后提交这次文档补充（**不要 amend 已有提交**，新建一个 `docs:` 提交），
并把本文件移入 `doc/` 留档。

> 注意：文档补充提交在 tag 之后，不会改变已发布的源码。
> 这与 v1.2.0 那次（§33.5 第 5 点）的处理方式一致。
