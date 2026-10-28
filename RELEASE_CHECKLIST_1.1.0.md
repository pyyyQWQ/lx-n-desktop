# LX-N Desktop 1.1.0 发布检查清单

> 生成时间：2026-10-24
> 用途：交给 Codex 做 GitHub 上传前最终核查
> **本清单由 DSH 在本地完成，未执行任何上传/推送/Release 操作**

---

## 一、版本信息

| 项 | 值 |
|---|---|
| 目标版本 | **1.1.0** |
| 上一正式版 | 1.0.0（tag `v1.0.0` / commit `15bb7230`） |
| `package.json` version | 1.1.0 ✅ |
| exe `FileVersion` / `ProductVersion` | 1.1.0 / 1.1.0 ✅ |
| 产品名 | `lx-netease-music-desktop` |
| appId | `com.lxnetease.music.desktop` |
| 发布主体 | `pyyyQWQ` |

---

## 二、分发包（发布附件，**不进入 Git**）

目录：`<USER_HOME>\Desktop\LX-N-Desktop-NEW\build\`

| 文件 | 大小 | SHA-256 |
|---|---:|---|
| `lx-netease-music-desktop-v1.1.0-x64-Setup.exe` | 122,195,128 B（116.53 MB） | `61C5D77E6E53B69DA65684692EE4E0F99F68ACBF28B966CAC2538BBAFF1C21EE` |
| `lx-netease-music-desktop-v1.1.0-x64-portable.exe` | 110,528,233 B（105.41 MB） | `EC1AD9636388D9E10684FF2DC548C6F6FF838390959C6C264CF73A997BF6A978` |
| `SHA256SUMS.txt` | — | 含上述两条校验值 |

其他构建副产物（**不要上传**）：
- `build/lx-netease-music-desktop-v1.1.0-x64-Setup.exe.blockmap`（差分更新用）
- `build/latest.yml`（electron-updater 描述文件，本版本不启用自动更新）
- `build/builder-debug.yml`
- `build/win-unpacked/`（未打包的目录形态）

> `build/` 已在 `.gitignore` 中（第 65 行），不会误入 Git。

---

## 三、应进入 Git 的文件

### 3.1 已修改（51 个）

**版本与配置**
- `package.json` — version 1.0.0 → 1.1.0
- `pnpm-lock.yaml` — webdav 依赖
- `.gitignore` — 新增忽略 `启动开发版.bat`
- `README.md` — 版本号与产物文件名 1.0.0 → 1.1.0

**图标资源（9 个）**
- `resources/icons/{16x16,32x32,48x48,64x64,128x128,256x256,512x512}.png`
- `resources/icons/{icon.png,icon.ico,icon.icns}`
- `doc/images/icon.png`

**每日推荐相关**
- `src/common/config.ts`（更新源常量）
- `src/renderer/router.ts`、`src/renderer/components/layout/Aside/NavBar.vue`、`src/renderer/components/layout/Icons.vue`
- `src/renderer/store/user/{state,action}.ts`
- `src/renderer/utils/musicSdk/wy/index.js`
- `src/lang/{zh-cn,zh-tw,en-us,ko-kr}.json`

**更新模块与品牌化**
- `src/renderer/utils/update.js`、`src/renderer/core/useApp/useUpdate.ts`
- `src/main/modules/winMain/autoUpdate.ts`
- `src/renderer/event/appEvent.ts`、`src/renderer/views/Setting/components/SettingUpdate.vue`
- `src/main/modules/appMenu.ts`、`src/main/utils/winLegacy.ts`
- `src/renderer/components/layout/{UpdateModal,ChangeLogModal,PactModal}.vue`
- `src/renderer/views/Setting/components/{SettingAbout,SettingOpenAPI,UserApiModal}.vue`
- `src/renderer/views/songList/List/components/OpenListModal.vue`

**WebDAV 同步**
- `src/common/defaultSetting.ts`、`src/common/types/app_setting.d.ts`
- `src/main/modules/userApi/index.ts`、`src/main/modules/winMain/rendererEvent/userApi.ts`
- `src/renderer/utils/ipc.ts`、`src/renderer/main.ts`
- `src/renderer/views/Setting/components/SettingSync/index.vue`
- `src/lang/i18n.ts`（跨端语言标识崩溃修复）
- `tests/run.mjs` — 注册每日推荐、更新源与 WebDAV 新增测试

**窗口图标启用**
- `src/main/modules/winMain/main.ts`、`src/main/modules/winLyric/main.ts`

### 3.2 新增（17 个文件 / 14 组）

- `PROJECT_HANDOFF.md`（交接文档）
- `RELEASE_NOTES-v1.1.0.md`（**本次新增**）
- `RELEASE_CHECKLIST_1.1.0.md`（**本次新增**）
- `src/common/utils/webdavSync.ts`
- `src/common/utils/wyDailyRec.ts`
- `src/renderer/core/sync/`（`webdavSync.ts`）
- `src/renderer/utils/webdav.ts`
- `src/renderer/utils/musicSdk/wy/dailyRec.js`
- `src/renderer/views/wy/DailyRec/`（`index.vue`）
- `src/renderer/views/Setting/components/SettingSync/WebdavSync.vue`
- `src/static/icons/`（`icon.ico`、`512x512.png`）
- `tests/{dailyRec,updateFeed,webdavSync}.test.mjs`
- `tests/webdavE2E.check.mjs`、`tests/webdavTransport.check.cjs`

---

## 四、不应进入 Git 的文件

| 类别 | 具体 | 状态 |
|---|---|---|
| 依赖目录 | `node_modules/` | ✅ 已忽略 |
| 构建产物 | `build/`、`dist/` | ✅ 已忽略 |
| 本地环境配置 | `.npmrc`、`pnpm-workspace.yaml` | ✅ 已忽略 |
| 开发脚本 | `start-dev.bat`、`check-userdata.bat`、`启动开发版.bat` | ✅ 已忽略 |
| 日志 | `*.log` | ✅ 已忽略 |
| 敏感 | `publish/utils/githubToken.js` | ✅ 已忽略 |

---

## 五、敏感信息检查（已实际扫描）

| 检查项 | 结果 |
|---|---|
| 真实网易云 Cookie 值 | ✅ 无。源码中 4 处 `MUSIC_U=` 均为**判断登录态或拼接 token 的代码逻辑**，非真实凭据 |
| `__csrf` 实际值 | ✅ 无 |
| 音源 API Key | ✅ 无（未在任何源码文件中出现实值） |
| 账号邮箱 | ✅ 无（未在源码中发现真实账号邮箱） |
| 个人绝对路径 | ✅ 已脱敏：本机路径统一替换为 `<USER_HOME>` |
| `build/` 产物是否含开发机数据 | ✅ 不含。asar 内仅有程序代码与第三方库 |

---

## 六、许可证与来源说明（不得删除）

| 文件 | 保留内容 |
|---|---|
| `LICENSE` | Apache-2.0 全文（未改动） |
| `licenses/license_zh.txt` | 补充协议 + 末尾 `By: 落雪无痕` |
| `licenses/license_en.txt` | 补充协议 + 末尾 `By: lyswhut` |
| `licenses/license.rtf` | 安装向导读取的协议正文 |
| `README.md` | 「基于 LX Music 桌面版…上游版权归原作者及贡献者所有」 |
| `RELEASE_NOTES-v1.1.0.md` | 同上来源说明 |

---

## 七、验证状态（严格区分）

### ✅ 已实际执行并通过

- 自动化测试 164 断言
- WebDAV 传输层 8/8（本地 mock 服务器，真实 HTTP）
- WebDAV 数据安全 24/24（含篡改注入防护）
- 生产编译 4 目标
- NSIS 安装包构建（exit 0）
- 静默安装（exit 0，安装目录与卸载程序生成）
- 安装版启动（窗口标题 `LX-N Music`）
- 便携版启动（孤立目录，`userData\LxDatas` 创建成功）
- exe 版本信息核对（Setup 与 portable 均为 1.1.0）
- SHA256SUMS 生成并自校验

### ⚠️ 部分验证

- **WebDAV 真实服务**：仅用本地 mock 验证协议层；坚果云等真实服务未做系统回归
- **每日推荐**：dev 环境实测通过（13 首歌/18 个歌单）；打包版未单独复测该页面

### ❌ 未验证

- 真实网易云账号端到端（发布环境无账号）
- 手机端 ↔ 桌面端 WebDAV 互通
- x86 / ARM64 / Windows 7/8 构建
- 代码签名（未配置证书，预期 SmartScreen 提示）
- 从 1.0.0 覆盖升级到 1.1.0 的实际升级路径（仅验证了全新安装）

---

## 八、Codex 上传前需注意

1. **`PROJECT_HANDOFF.md` 已脱敏**：本机路径已统一替换为 `<USER_HOME>`。

2. **`publish/version.json` 仍是原版内容**：该文件当前 `version: "2.12.6"`，含 119 条原版历史记录，**不是本项目的版本信息**。当前 `updateFeedEnabled = true` 会读取线上 `publish/version.json`，但**本地这个文件不参与本版本发布**（更新源指向 GitHub main 分支的该文件）。请勿在本次提交中误把它当作 1.1.0 的版本元数据。

3. **`latest.yml` / `.blockmap` 不上传**：本版本不启用 electron 自动更新下载，这些文件仅由 electron-builder 自动生成。

4. **建议的 Release 附件**：仅上传 `Setup.exe`、`portable.exe`、`SHA256SUMS.txt` 三个文件。

5. **tag 命名**：1.0.0 用的是 `v1.0.0`，建议 1.1.0 用 `v1.1.0` 保持一致。

6. **Release 正文**：可直接使用 `RELEASE_NOTES-v1.1.0.md`。

7. **未提交状态**：DSH 本轮**未做任何 git 提交**。当前分支 `baseline-v1.0`，HEAD `15bb7230`，51 改 + 17 个新增文件全部为工作区改动，等待 Codex 核查后由用户授权提交。

---

## 九、建议的提交拆分

若需分 commit，建议顺序：

1. `feat: 每日推荐`（router/NavBar/Icons/store/wy/dailyRec/lang/tests）
2. `feat: 独立版更新源与品牌化`（config/update/useUpdate/autoUpdate/appEvent/SettingUpdate/链接改写/appMenu/winLegacy）
3. `feat: WebDAV 歌单同步`（webdavSync/webdav.ts/ipc/userApi/defaultSetting/app_setting/lang/main.ts/SettingSync/tests）
4. `feat: 软件图标替换`（resources/icons、src/static/icons、doc/images/icon.png、窗口图标启用）
5. `chore: 品牌信息治理`（lang 文案、winLegacy、UserApiModal aria-label、i18n 兜底）
6. `chore: 发布 1.1.0`（package.json、README、RELEASE_NOTES、RELEASE_CHECKLIST、.gitignore）

---

*本清单中的所有结论均来自本地实际执行结果。未执行的项目已明确标为「未验证」。*
