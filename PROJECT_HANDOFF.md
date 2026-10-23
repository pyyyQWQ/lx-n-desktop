# PROJECT_HANDOFF —— LX-N 桌面版（全新基线 + 每日推荐 + 更新模块 + WebDAV 同步）

> 记录时间：2026-10-23（第 1 轮：全新基线 + 每日推荐；第 3 轮：更新模块；第 4 轮：WebDAV 同步）
> **凭据安全**：本文件不包含任何 Cookie / Token / 密码等敏感凭据。

---

## 1. 一句话状态

- **已建立全新 v1.0 开发基线**并验证：依赖安装、`pnpm test`、`pnpm run dev`（编译 + webpack-dev-server + **真实 GUI 窗口启动**）、`pnpm build`（4 目标）均正常。
- **已完整迁移「网易云每日推荐」**功能，**实机验证通过**：13 首推荐歌曲、18 个推荐歌单、点击播放、刷新按钮、登录态复用全部正常。
- **已迁移「独立版更新源 + 手动检查更新 + 品牌化」**（第 3 轮）：更新源指向 `pyyyQWQ/lx-n-desktop`、关闭自动下载、新增检查更新按钮、全站链接改指独立版；**GUI 实测通过**。
- **已迁移「WebDAV 数据同步」**（第 4 轮）：连接配置、测试连接、上传/下载歌单、上传/下载设置、启动自动同步、完整错误提示；**141 断言 + 8 项真实 HTTP + 24 项数据安全验证全部通过**，GUI 实测界面与设置持久化正常。详见 **§14**。
- **音频基线已实测通过**：13 个设备 / 6 个音频输出，普通音源与自定义音源均可播放（旧 dev 音频问题未复现，真实根因是 `ELECTRON_RUN_AS_NODE=1`）。
- **网易云登录**沿用 v1.0 已提交实现，未重复开发；全程未改动登录文件。
- 关键发现：旧会话「窗口不弹/设备为空」主因是环境变量 `ELECTRON_RUN_AS_NODE=1`，已通过 `启动开发版.bat` 规避。
- 详见 **§11 实机验证记录**、**§13 全量差异盘点与剩余功能迁移**。

---

## 2. 新旧项目实际路径

| 角色 | 完整路径 | 说明 |
|---|---|---|
| 旧项目（只读参考） | `<USER_HOME>\Desktop\LX-n-desktop\lx-netease-music-desktop` | 分支 `phaseA`，HEAD `4e722226`（阶段A基线，之后登录/歌单/每日推荐均为未提交工作区改动）。仅读取参考，未修改。 |
| 旧交接文档 | `<USER_HOME>\Desktop\LX-n-desktop\PROJECT_HANDOFF.md` | 历史进度/已知问题（登录、歌单、每日推荐 C2、WebDAV 回退、音频排查 T/U）。 |
| **新项目（本次工作目录）** | `<USER_HOME>\Desktop\LX-N-Desktop-NEW` | 全新 git 仓库，`baseline-v1.0` 分支，HEAD = v1.0.0 tag。 |
| 独立备份（本轮新建） | `<USER_HOME>\Desktop\LX-n-desktop-baseline-backup-20261023-1935` | 旧项目全源码副本（排除 node_modules/dist/publish）。详见 §4。 |
| 既有备份（更早） | `<USER_HOME>\Desktop\LX-n-desktop-backup-20261023-181453` | 旧交接 T1 记录的历史备份。 |

> 说明：`<USER_HOME>\Desktop\LX-n-desktop-new` 与 `<USER_HOME>\Desktop\LX-N-Desktop-NEW` 为同一路径（Windows 不区分大小写）。

---

## 3. 确权 v1.0 源码版本（从 GitHub 核实）

| 项 | 值 |
|---|---|
| 远程仓库 | `https://github.com/pyyyQWQ/lx-n-desktop.git`（origin） |
| 权威 v1.0.0 tag 提交 | `15bb72304d82fd983b733311752eeefc6b1df8fc`（tag `v1.0.0`） |
| 远程 main 最新 | `dee5ad35dd1f4eddc4ca4c004aed116ddcd52169` |
| 新项目克隆 tag | 以 `--branch v1.0.0` 克隆 → 检出 `15bb7230`，`git describe` = `v1.0.0` |
| 新项目分支 | `baseline-v1.0`（在 v1.0.0 上创建） |

**关键核实结论**：
- GitHub 上唯一 tag 是 `v1.0.0` → `15bb7230`，即“正式版 1.0.0 Windows 正式版”。本地旧项目曾有一个损坏的本地 tag `v1.0.0→9dbf96c2`（对象缺失），**以 GitHub 远端 `15bb7230` 为准**。
- v1.0.0（15bb7230）**已提交**网易云登录整套（`neteaseLogin/`、`store/user/`、`wyLogin.ts`、`wyWebLogin.ts`、`neteaseCookie.ts` 等）。
- **每日推荐未提交到任何分支**（`git cat-file` 在 origin/main 与 15bb7230 中均无 `dailyRec.js`/`DailyRec/index.vue`），仅存在于旧项目**未提交工作区**。因此每日推荐必须由人工、精确地从旧项目迁移（本次已做）。

---

## 4. 独立备份

### 4.1 本轮新建备份
- 路径：`<USER_HOME>\Desktop\LX-n-desktop-baseline-backup-20261023-1935`
- 内容：旧项目 `lx-netease-music-desktop` 全源码树（含 `.git`、`src`、`tests`、`.github`、`doc`、`resources`、`.npmrc`、`pnpm-lock.yaml`、所有未提交/未跟踪的用户文件与每日推荐工作区）；另存 `PROJECT_HANDOFF_live.md`（当时的实时交接文档）。
- **排除（可再生成）**：`node_modules/`、`dist/`、`publish/`。
- 命令：`robocopy <旧项目> <备份> /E /XD node_modules dist publish`。

### 4.2 备份完整性验证（实测）
- 源码文件数：旧项目（排除 node_modules/dist/publish）= **1002**，备份 = 1003（多出的为额外 `PROJECT_HANDOFF_live.md`）。✅
- 旧 HEAD：`4e72222653c32269ce39f01776f4a102a7e3e8e7` 分支 `phaseA`，备份 .git 存在。✅
- 关键文件哈希逐一比对（package.json、config.ts、DailyRec/index.vue、wy/user.js、store/user/action.ts）：**全部一致** ✅

> 备份成功、验证完整，符合“备份失败则停止”的要求；备份独立于旧项目与新项目之外。

---

## 5. 依赖安装与开发基线（新项目）

### 5.1 环境
- 使用 DSH 捆绑 Node `v24.21.0`（`<USER_HOME>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`）+ pnpm。
- **PATH 需手动加入 `...\node\bin`**（系统 PATH 无 node），否则 pnpm 子进程报 `'node' is not recognized`（仅噪音，非功能错误）。
- 网络：`registry.npmmirror.com` 经代理 `http://127.0.0.1:33210` 可达；github.com 偶发超时。**pnpm 内容寻址 store**（`<USER_HOME>\AppData\Local\pnpm\store\v11`）复用旧 store，1158 个包全部 hard-link（`reused 1158`），无需重新下载 git 依赖。

### 5.2 安装结果
- `pnpm install`：1158 依赖全部 added（hard-link），除 electron 二进制的 install 脚本因首次 postinstall 中断需手动补跑外，均可。
- 手动补跑：`node node_modules/electron/install.js` → `electron.exe`（234MB）就绪。
- `node build-config/postinstall.js`（better-sqlite3 复制 prebuild）→ exit 0；`better-sqlite3` 实测加载 OK（内存库建表成功）。
- `pnpm config set verify-deps-before-run false`：避免每次运行前的依赖校验噪音。

### 5.3 新项目 .npmrc
- 复制旧项目可用配置：npmmirror registry + 代理 33210 + electron/electron-builder 镜像。**未升级任何依赖、未改动构建体系。**

### 5.4 test / build / dev 结果
| 检查 | 结果 |
|---|---|
| `pnpm test`（基线） | ✅ exit 0（domain 28 + cookie 11 + accountLogic 13） |
| `pnpm test`（+每日推荐后） | ✅ exit 0（**+dailyRec 16 = 68 断言**，见 §6） |
| `pnpm build`（v1.0 基线） | ✅ 4 目标编译成功（main/renderer/renderer-lyric/renderer-scripts） |
| `pnpm build`（+每日推荐后） | ✅ 4 目标编译成功；dist/renderer.js 含 dailyRec 全部标记 |
| `pnpm run dev` | ✅ 4 目标编译成功、webpack-dev-server 9080/9081 启动；`%APPDATA%\lx-netease-music-desktop\LxDatas` 已创建（数据目录隔离生效）。Electron GUI 窗口未在本会话常驻（见 §7 音频/会话说明）。 |

---

## 6. 每日推荐迁移（本轮主任务）

### 6.1 功能范围（与旧项目 C2 一致）
- **每日推荐歌曲**：`weapi/v3/discovery/recommend/songs` → 30 首推荐单曲，自含 h/m/l/sq/hr 音质，无需 privileges。
- **每日推荐歌单**：`weapi/v1/discovery/recommend/resource` → Recommend 歌单卡片。
- **页面交互**：顶栏「每日推荐歌曲 / 每日推荐歌单」双 tab + 「刷新推荐」；未登录 / 为空 / 失败态；歌曲列表点击播放；歌单卡片点击进歌单详情并可播放。
- **播放接续**：复用桌面 `setTempList('dailyrec_wy', list)` + `playList(LIST_IDS.TEMP, index)`，与移动端 listId 一致。
- **依赖**：网易云登录 Cookie（`appSetting['common.wy_cookie']`）+ 用户登录态（`wyLoginStatus == 'logged-in'`）。

### 6.2 涉及文件（新基线）
**新增（复制自旧项目已验证版本）**
| 文件 | 作用 |
|---|---|
| `src/common/utils/wyDailyRec.ts` | 纯转换逻辑 `toOldSongInfo` / `toOldPlaylistInfo`（可隔离测试） |
| `src/renderer/utils/musicSdk/wy/dailyRec.js` | `getList`（推荐歌曲）与 `getRecPlaylists`（推荐歌单），复用 request.js weapi 链路 |
| `src/renderer/views/wy/DailyRec/index.vue` | 桌面页（歌曲列表 + 歌单网格 + 刷新/加载/空/未登录/失败态 + 点击播放/跳详情） |
| `tests/dailyRec.test.mjs` | 纯转换逻辑隔离测试（16 断言，无网络/凭据） |

**修改（按新 v1.0 架构精确注入，未覆盖其它内容）**
| 文件 | 改动 |
|---|---|
| `src/renderer/utils/musicSdk/wy/index.js` | 导入并聚合 `dailyRec` |
| `src/renderer/store/user/state.ts` | 新增 `wyDailyRecSongs` / `wyDailyRecPlaylists` |
| `src/renderer/store/user/action.ts` | 新增 `setWyDailyRecSongs`/`setWyDailyRecPlaylists`；`clearWyLikedSongs` 一并清空每日推荐（切换账号/退出联动） |
| `src/renderer/router.ts` | 新增路由 `/wy/dailyRec` → WyDailyRec |
| `src/renderer/components/layout/Aside/NavBar.vue` | 新增「每日推荐」导航项 |
| `src/renderer/components/layout/Icons.vue` | 新增 `icon-wy-daily-rec`（日历+星标） |
| `src/lang/{zh-cn,en-us,zh-tw,ko-kr}.json` | 新增 `wy_daily_rec__*` 共 8 键/语言 |
| `tests/run.mjs` | 加入 `dailyRec.test.mjs` |

**明确未动（避免把无关改动带入）**：
- 未带入旧项目工作区里的非每日推荐改动（如 `setting__about`→“LX-N Music”、`setting__update_check_btn`、`request.js` 其它改动等）。新项目 `setting__about` 仍为原版“关于 LX Music”。

### 6.3 验证结果（区分已验证 / 未验证）
- ✅ **自动化测试**：`pnpm test` exit 0，**68/68 断言全部通过**（含每日推荐 16）。
- ✅ **生产构建**：`pnpm build` 4 目标全部 success；`dist/renderer.js` 实测含 `dailyRec`、`v3/discovery/recommend/songs`、`v1/discovery/recommend/resource`、`WyDailyRec`、`wy_daily_rec`、`dailyrec_wy` 等全部标记。
- ✅ **代码编译**：TypeScript + Vue 编译通过，无模块解析错误；`setTempList`/`playList`/`LIST_IDS.TEMP`/`toNewMusicInfo`/`material-online-list` 依赖契约均已核验与构建确认。
- ⚠️ **真实接口/播放 **未验证**：每日推荐实际拉取需真实网易云登录态 Cookie 与服务端返回；实际能否播放取决于源站/版权。需用户本地登录后实测。
- ⚠️ **GUI 实机渲染播放**未在本会话端到端验证（受会话约束，见 §7）。

---

## 7. 网易云登录复用与兼容性

- v1.0（15bb7230）**已内置完整网易云登录**：网页登录（`wyWebLogin.ts` + `neteaseLogin/` main 进程）、Cookie 校验（`neteaseCookie.ts`）、用户状态（`store/user/`）、Cookie 注入（`request.js`）、喜欢/歌单。**本次零改动、零重复开发。**
- 每日推荐仅**复用**上述登录状态：读 `appSetting['common.wy_cookie']` 与 `wyLoginStatus == 'logged-in'` 做登录门控；退出/失效/切换账号经 `clearWyLikedSongs` 联动清空每日推荐缓存。
- **兼容性结论**：每日推荐改动不触碰登录/请求/其它音源文件；构建与测试证明未破坏现网功能。登录流程是否异常需用户实机确认（见 §8）。

---

## 8. 音频设备与播放 —— 基线检查（区分事实/推测/未解决）

- **已知背景（来自旧交接 T/U 章节，用户同一台 Windows 电脑）**：
  - **打包正式版 v1.0.0** 在这台机器：音频设备列表正常、可播放普通音源与自定义音源。✅
  - **开发版（pnpm run dev）**：曾出现「音频输出设备列表为空 + 播放无声 + 自定义源播放失败」，**根因未确证**（源码与正式版完全一致，音频文件 git diff 为空）。此为历史遗留问题，非本轮引入。推断方向（非断言）：dev 的持久分区/媒体权限残留、未签名 electron 可执行体差异、或一次运行残留的异常态。

- **本轮新基线音频检查（如实）**：
  - ✅ 音频相关源码 = v1.0.0 原样（未改动），构建/测试通过。
  - ✅ **本轮已实测确认（见 §11）**：音频设备枚举正常（13 设备 / 6 音频输出），普通音源与自定义音源均可播放，每日推荐可正常拉取并播放。**开发版音频问题在新基线未复现。**

> **历史噪音已定位**：旧会话中「音频设备为空 / 窗口不弹」的直接原因之一是环境变量 `ELECTRON_RUN_AS_NODE=1`（DSH 进程作用域）——Electron 检测到该变量存在即进入纯 Node 模式、不创建 GUI/媒体栈。新项目已提供 `启动开发版.bat`，启动前自动清除该变量。

---

## 9. 尚未完成 / 下一步建议

### 9.1 未完成（需用户桌面环境实测）
1. ~~新基线 dev/打包版在真实 Windows 桌面：音频设备列表、普通/自定义音源播放回归。~~ ✅ **本轮已实测通过（§11）**
2. ~~网易云登录（网页登录 + Cookie）在真实桌面的完整流程与持久化。~~ ✅ **登录态复用已实测（每日推荐成功拉取真实数据，§11）**
3. ~~每日推荐在真实桌面：进入页面自动拉取、歌曲点击播放、歌单卡片跳详情、刷新按钮。~~ ✅ **本轮已实测通过（§11）**

> 当前无阻塞项。以下为可选增强。

### 9.2 遗留（可选项，非本轮阻塞）
- 每日推荐「自动存为歌单」（桌面无 `list.isAutoSaveDailyRec` 设置项，未实现，留作可选增强）。
- 相似歌曲 / 风格化推荐（当前无桌面数据流，未造空壳）。
- 打包安装包（`pnpm pack`）本轮未做，仅在 dev 与 `pnpm build` 层面验证。
- 若需正式提交每日推荐，需先将本次改动 commit（当前为未提交工作区，符合"未授权不提交"）。

### 9.3 下一步建议
1. 需要源码级版本时，将 v1.0 基线 + 每日推荐改动整理提交为独立 commit（待授权）。
2. 需要分发包时，跑 `pnpm pack` 生成 Windows 安装包。
3. 后续新增功能继续沿用「读 v1.0 基线 → 最小注入 → pnpm test + pnpm build → 实机截图验证」流程。

---

## 10. 本轮安全与边界声明
- 未执行 `git reset` / `git clean` / 强 checkout / 破坏性覆盖；未提交、未推送、未发布。
- 未引入 WebDAV。
- 未重复开发登录；未改动登录/请求/其它音源文件。
- 未将旧项目全部历史改动混入新基线；仅迁移每日推荐所需内容（并经 diff 复核）。
- 全文无真实凭据。

---

## 11. 实机验证记录（2026-10-23 19:41–19:45，本轮新增，决定性证据）

> 本轮已成功在真实 Windows 桌面把**新基线开发版**完整跑起来并逐项实测。以下均为实际执行并截图确认的结果，非推测。

### 11.1 启动方式与关键环境修复
- **根因（已确证）**：DSH 进程作用域存在 `ELECTRON_RUN_AS_NODE=1`，Electron 检测到该变量**存在**（即使值为空）即进入纯 Node 模式 → 不创建 GUI 窗口、不初始化媒体设备栈 → 表现为「窗口不弹 / 音频设备列表为空」。**此为环境问题，非业务源码缺陷。**
- **解法（已在项目中落地）**：新项目根目录新增 `启动开发版.bat`，启动前自动 `set "ELECTRON_RUN_AS_NODE="` 清除该变量，并自动探测 node/pnpm（系统无则回退 DSH 内置）。
- 实测：清除该变量后 `pnpm run dev` → 4 目标编译成功 → **Electron 主进程正常启动**（`main.log` 新增 `19:41:23 App starting...`，7–8 个 electron 进程），窗口正常显示。

### 11.2 音频基线（实测通过 ✅）
- **独立 Electron 42.11.6 探针**：`navigator.mediaDevices.enumerateDevices()` 返回 **13 个设备**，其中 **audiooutput = 6 个**（JBL GO 2、ATK N9 PRO dongle、Senary Audio、NVIDIA G3 等），`isSecureContext=true`、`hasMediaDevices=true`。→ **本机音频设备枚举完全正常。**
- **应用内「设置 → 播放设置」**：页面正常打开，音频输出区块可见；底栏音量/设备图标正常。
- **真实播放**：底栏正在播放 `FEEL ALIVE - Lunak`，间隔 30 秒两次截图进度 `00:27 → 00:57 → 02:06 → 03:22` 持续前进，歌词同步滚动（"thunder lightning" → "it's time to let go"），暂停按钮为「播放中」态。→ **音频真实出声播放正常，非仅界面展示。**

### 11.3 自定义音源（实测通过 ✅）
- 「设置 → 基本设置」中显示：**「聆澜音源(赞助版)…v8.9.2 [初始化成功]」**，自定义音源成功加载。

### 11.4 每日推荐（实测通过 ✅）
| 验证项 | 结果 |
|---|---|
| 侧边栏入口 | ✅ 存在「每日推荐」日历图标（第 7 个导航项） |
| 进入页面自动拉取 | ✅ 无需手动点击，直接加载出数据 |
| 每日推荐歌曲 | ✅ **13 首真实歌曲**，含歌名/艺术家/专辑/时长，并显示 `SQ` `HQ` `24bit` 音质标记与 `wy` 来源标记 |
| 每日推荐歌单 | ✅ 点击 tab 切换后显示 **18 个真实歌单卡片**（封面、名称、曲目数，如有 55/75/100/463 等） |
| 双 tab + 刷新按钮 | ✅ 顶栏「每日推荐歌曲 / 每日推荐歌单 / 刷新推荐」三个胶囊按钮同款 UI、位置正确 |
| 页面渲染无报错 | ✅ 布局正常、无空白/错误提示（非未登录/空/失败态） |

### 11.5 网易云登录复用（实测通过 ✅）
- 每日推荐能拉出**账号个性化的真实数据**（每日推荐歌曲/歌单是登录态专属接口），直接证明 **v1.0 已有登录态被成功复用**，登录流程未被破坏。

### 11.6 结论
- **开发版音频问题在新基线未复现**；普通音源、自定义音源、每日推荐播放均正常。
- 用户已于 2026-10-23 桌面实测并口头确认「都确认完了没有问题」。
- 每日推荐迁移**功能完整 + 实机验证通过**，本轮主要目标达成。

### 11.7 验证后的现场处理
- 开发版进程已全部停止（electron 0 个，9080/9081/5858 端口已释放）。
- 临时音频探针文件（`audio-probe.js/html/json`）已删除，未留在项目中。
- 验证截图存于 `%TEMP%\lxnew-window*.png`、`lxnew-play.png`、`dev-now.png`（临时目录，非项目文件）。

---

## 12. 启动器排障记录（2026-10-23 19:56–20:05，第 2 轮补记）

> 背景：用户反馈「双击 `启动开发版.bat` 没有窗口出来」。本轮实测定位并修复，**未改动任何业务源码**。

### 12.1 根因一：bat 文件编码导致脚本被 cmd 撕碎（已修复 ✅）
- **现象**：双击后无窗口；用 cmd 捕获输出，出现大量 `'lectron' 不是内部或外部命令`、`'PM" run dev'` 等乱码报错。
- **原因**：bat 原先保存为 **UTF-8 无 BOM**，而 cmd.exe 按本地代码页（GBK）解析，中文注释/中文提示把行结构破坏，`set`/`%NODE_BIN%` 等命令因此失效。
- **修复**：把 `启动开发版.bat` 内容改为**纯 ASCII 英文**（提示语、注释全英文），任何代码页下都不会解析错乱。修复后实测可正常进入编译流程。
- **经验**：本项目所有 `.bat` 一律用纯 ASCII 编写，或在 bat 首行前加 `chcp` 并保存为 GBK/ANSI，不要用 UTF-8 存中文 bat。

### 12.2 根因二：Windows 系统代理指向已失效的本机端口（已定位，影响已在启动器规避）
- **现象**：编译成功后窗口虽能出现，但日志持续报：
  `[main window] An error occurred: Error: net::ERR_PROXY_CONNECTION_FAILED`
  以及 `Failed to fetch extension, trying N more times`。
- **实测证据**：
  - 注册表 `HKCU\...\Internet Settings\ProxyEnable = 1`，`ProxyServer = http://127.0.0.1:33210`。
  - 但端口 33210 **无任何进程监听**（代理软件当时未运行），`curl -x http://127.0.0.1:33210` 返回 `000`。
  - Chromium 会读取 Windows 系统代理，于是对外请求（含 Vue DevTools 扩展下载）全部连不上。
- **影响范围（已实测界定）**：该报错**不影响主窗口显示与业务功能**——窗口正常打开、每日推荐正常、播放正常。它只影响 dev 模式下的 **Vue DevTools 扩展下载**（开发辅助功能，不影响产品功能）。
- **启动器规避**：bat 内设置 `NO_PROXY=localhost,127.0.0.1,::1`，本地开发流量不走系统代理。
- **已验证无效的做法**：`ELECTRON_EXTRA_LAUNCH_ARGS` 环境变量——实测 Electron 42.11.6 **不识别**该变量（探针 `process.argv` 中无对应开关），不要再用此方式传参。
- **根治建议（用户侧，可选）**：要么启动那个代理软件（Clash/Verge 等，使 33210 恢复监听），要么在 Windows 设置里关闭系统代理；否则 dev 模式该报错会一直出现但无害。

### 12.3 本轮实测确认（窗口已正常）
- 通过 `启动开发版.bat` 启动：4 目标编译成功 → `main.log` 新增 `20:02:30 App starting...` → 8 个 electron 进程、主窗口标题显示当前播放曲目。
- 截图确认：设置页正常、自定义源「聆澜音源(赞助版) v8.9.2 [初始化成功]」、底栏正在播放 `Feel Alive - Grafix、Lauren L'aimant`。
- 本轮未改动业务源码；`.bat` 为运维脚本，非业务代码。

---

## 13. 全量差异盘点（2026-10-23 20:20，第 3 轮：剩余功能迁移）

> 方法：对新项目（v1.0 基线 + 每日推荐）与旧项目工作区做**逐文件 SHA-256 比对**，再对每个差异文件做内容级 diff 分析。
> 本轮备份：`<USER_HOME>\Desktop\LX-N-Desktop-NEW-backup-20261023-201819`（845 文件，关键文件哈希校验一致）。

### 13.1 盘点总量
- 旧项目中相对新基线**存在差异的文件共 51 个**，另有 **5 个旧项目独有文件**（`check-userdata.bat`/`pnpm-workspace.yaml`/`rebuild-deps.bat`/`start-dev.bat`/`tests/updateFeed.test.mjs`）。
- 其中大量差异为**换行符/编码伪差异**（内容逐字符相同），已逐项排除，不计入迁移范围。

### 13.2 分类结论

#### A. 已完成 / 已迁移（无需再动）✅
| 功能 | 证据 |
|---|---|
| 网易云登录（网页登录 + Cookie + 校验 + 过期处理） | `neteaseCookie.ts`/`neteaseDomain.ts`/`wyAccountLogic.ts`/`neteaseLogin.ts`/`neteaseDomain.js`/`wyLogin.ts`/`wyWebLogin.ts`/`neteaseLogin/`(main)/`toast.js` **逐字与新项目一致** |
| 我的歌单 | `views/wy/Playlist/index.vue` **逐字一致** |
| 设置页登录 UI | `SettingBasic.vue` **逐字一致** |
| 每日推荐（歌曲+歌单+播放+路由+导航） | 本会话第 1–2 轮已迁移并实机验证 |
| 已有测试（domain/cookie/accountLogic/ts-resolve-loader） | 逐字一致 |

#### B. 未迁移 —— 有价值，本轮范围内 🔧
| 模块 | 涉及文件 | 价值 |
|---|---|---|
| **独立版更新源**（指向 pyyyQWQ/lx-n-desktop，去掉对原版/CDN 的依赖） | `src/common/config.ts`、`src/renderer/utils/update.js`、`src/renderer/core/useApp/useUpdate.ts`、`src/main/modules/winMain/autoUpdate.ts` | 高：否则会读到原版 2.12.6 版本信息、误报更新 |
| **手动「检查更新」入口** | `SettingUpdate.vue`、`appEvent.ts`、`useUpdate.ts`、lang×4 | 中高：配套 UI 入口 |
| **独立版品牌化 / 链接改写** | `SettingAbout.vue`、`UpdateModal.vue`、`ChangeLogModal.vue`、`PactModal.vue`、`OpenListModal.vue`、`SettingOpenAPI.vue`、`SettingSync/index.vue`、`UserApiModal.vue`、`winLegacy.ts`、`appMenu.ts`、`package.json`、`build-pack.js`、lang×4(`setting__about`) | 中：避免指向原版仓库/文档造成误导 |
| **更新源隔离测试** | `tests/updateFeed.test.mjs`（旧项目独有）+ `tests/run.mjs` 注册 | 中：为更新源提供自动化断言 |

#### C. 重复 / 不必迁移 ⏭️
- `useMenu.js`、`songList/Detail/action.ts`、`renderer/utils/ipc.ts`、`main/modules/index.ts`、`defaultSetting.ts`、`ipcNames.ts`、`app_setting.d.ts`、`request.js`、`renderer/main.ts`、`neteaseCookie.ts` 等：**内容与新项目完全相同**（仅换行/BOM 字节差异）。
- `README.md`：旧项目改写为 LX-N 说明（144 行）。属文档，本轮不改（避免与仓库发布流程冲突），仅记录。
- `pnpm-lock.yaml`/`build-config/main/webpack.config.prod.js`：本机构建/依赖差异，新项目已能正常构建，不动。

#### D. 过时 / 应丢弃 🗑️
- `src/main/index-dev.ts` 中「临时关闭自动打开 devtools」的改动：旧项目为排查音频问题所加的**临时调试改动**，非产品功能；新项目已确认音频正常，**不迁移**。
- `check-userdata.bat`/`rebuild-deps.bat`/`start-dev.bat`/`pnpm-workspace.yaml`：旧环境运维脚本/占位文件；新项目已有 `启动开发版.bat`，**不迁移**。

#### E. 风险项 —— 明确不迁移 ⚠️
| 项 | 说明 |
|---|---|
| **硬编码真实 Cookie** | 旧项目 `src/renderer/utils/musicSdk/wy/lyric.js` 与 `wy/utils/index.js` 中有一行**被注释掉的真实网易云 Cookie**（含 `MUSIC_A`/`__csrf` 等）。**属敏感凭据泄漏，绝对不迁移**，且建议由用户自行清理旧项目该行。本交接文档不复制该值。 |
| **依赖升级** | 旧 `package.json` 与新项目仅 author/contributors 字段差异，无依赖版本变化；本轮不动依赖。 |

### 13.3 本轮迁移顺序（按依赖从底到上）
1. **批次 1（基础配置）**：`config.ts`（新增 LX-N 仓库常量 + `getUpdateFeedAddress` + `updateFeedEnabled`）→ 测试 `updateFeed.test.mjs`。
2. **批次 2（更新链路）**：`update.js`（改用 `getUpdateFeedAddress`，去掉 npm/jsdelivr 源）→ `useUpdate.ts`（去掉自动下载/超时、加手动检查）→ `autoUpdate.ts`（强制 `autoDownload=false`）。
3. **批次 3（UI 与品牌化）**：`appEvent.ts`（新增 `checkForUpdate`）→ `SettingUpdate.vue`（检查更新按钮 + 去掉自动更新勾选）→ 链接改写（About/UpdateModal/ChangeLog/Pact/OpenAPI/Sync/UserApiModal/OpenListModal/winLegacy/appMenu）→ lang×4。
4. **批次 4（打包标识）**：`package.json`（author/contributors）、`build-pack.js`（copyright/npmRebuild/legalTrademarks/maintainer）。
5. 每批后：`pnpm test` + `pnpm build` + diff 复核；全部完成后统一回归 + GUI 实测。

### 13.4 执行结果（2026-10-23 20:19–20:36，已全部实际执行）

#### 备份 ✅
- 新备份：`<USER_HOME>\Desktop\LX-N-Desktop-NEW-backup-20261023-201819`
- 验证：845 个文件（排除 node_modules/dist/.git），关键文件 SHA-256 全部一致。

#### 批次 1：更新源基础配置 ✅
| 文件 | 改动 |
|---|---|
| `src/common/config.ts` | 新增 `LX_N_REPO_OWNER/NAME/BRANCH`、`LX_N_HOMEPAGE/RELEASES/ISSUES`、`updateFeedEnabled = true`、`getUpdateFeedAddress()`（仅 raw.githubusercontent.com，剔除 jsdelivr/npm 等可能缓存原版内容的源） |
| `tests/updateFeed.test.mjs`（新增） | 14 条断言：仓库常量、URL 模板、无原版标识、无 CDN |
| `tests/run.mjs` | 注册 `updateFeed.test.mjs` |
- 验证：`pnpm test` → **exit 0，82 断言全通过**（domain 28 + cookie 11 + accountLogic 13 + updateFeed 14 + dailyRec 16）。

#### 批次 2：更新链路改造 ✅
| 文件 | 改动 |
|---|---|
| `src/renderer/utils/update.js` | 改用 `getUpdateFeedAddress()`，删除 npm 源与 5 个 jsdelivr/gitee/stsky 回退源，删除 `getNpmPkgInfo` |
| `src/renderer/core/useApp/useUpdate.ts` | 删除 `startUpdateTimeout` 自动下载超时逻辑；失败不再回退旧缓存（统一返回 `0.0.0` 未知态，避免误报 2.12.6）；新增 `handleManualCheck`/`onCheckForUpdate`/`offCheckForUpdate` 并在 `onBeforeUnmount` 解绑；移除 `isWin` 未用导入 |
| `src/main/modules/winMain/autoUpdate.ts` | `autoUpdater.autoDownload` 从读设置改为**强制 `false`**（不再自动下载） |
- 验证：`pnpm test` exit 0。

#### 批次 3：UI 与品牌化 ✅
| 文件 | 改动 |
|---|---|
| `src/renderer/event/appEvent.ts` | 新增 `checkForUpdate()` 事件方法 |
| `src/renderer/views/Setting/components/SettingUpdate.vue` | 移除「尝试自动更新」勾选框；新增「检查更新」按钮（调 `window.app_event.checkForUpdate()`）；检查中提示位置调整 |
| `SettingAbout.vue` | 全部链接改 `pyyyQWQ/lx-n-desktop`；文案 `LX-N 没有微信公众号…`；落款追加「（LX-N 网易云改良版，基于 lx-music-desktop 独立构建）」 |
| `UpdateModal.vue` / `ChangeLogModal.vue` / `PactModal.vue` | Releases/Issues/FAQ 链接改指独立版 |
| `OpenListModal.vue` / `SettingOpenAPI.vue` / `SettingSync/index.vue` / `UserApiModal.vue` | FAQ/文档链接改指独立版仓库 |
| `src/main/utils/winLegacy.ts` | Win 旧版提示跳转改指独立版 Releases |
| `src/main/modules/appMenu.ts` | 菜单「关于洛雪音乐」→「关于 LX-N Music」 |
| `src/lang/{zh-cn,en-us,zh-tw,ko-kr}.json` | `setting__about` 改为 LX-N 品牌；新增 `setting__update_check_btn`（检查更新/Check for updates/檢查更新/업데이트 확인） |
- 验证：4 个 lang JSON 均通过 `JSON.parse`；`pnpm test` exit 0。

#### 批次 4：打包标识 —— **经核查无需迁移** ⏭️
- 新项目（v1.0）`package.json` 已是 `author: pyyyQWQ` + `repository/bugs/homepage` 均指向 `pyyyQWQ/lx-n-desktop`；`build-pack.js` 已含 `copyright: 'Copyright © 2026 pyyyQWQ'`、`npmRebuild: false`、`publish: { owner: 'pyyyQWQ', repo: 'lx-n-desktop' }`。
- 旧项目对应字段反而**更旧**（`author: lyswhut`、`legalTrademarks: lyswhut`），属早期未更新遗留 → **不迁移**。

#### 统一回归 ✅
| 检查 | 结果 |
|---|---|
| `pnpm test` | ✅ **exit 0，82/82 断言通过** |
| `pnpm build` | ✅ **exit 0**，main/renderer/renderer-lyric/renderer-scripts 四目标 build success |
| 产物标记（renderer.js） | ✅ `pyyyQWQ/lx-n-desktop`、`raw.githubusercontent.com`、`setting__update_check_btn`、`checkForUpdate`、`lx-n-desktop/releases` 均存在 |
| 原版残留（renderer.js） | ✅ `lyswhut.github.io` = **0**、`lx-music-desktop/releases` = **0** |

#### GUI 实测（实际启动并截图，非推测）✅
| 项 | 结果 |
|---|---|
| 应用启动 | ✅ 主窗口正常（1114×718），`App starting... / init / db inited` 全通过 |
| 网易云登录态 | ✅ 「我的网易云歌单」正常显示 7 个真实歌单（含 376/98/133/380 曲目数），登录未回归 |
| 设置 → 关于 | ✅ 标题「关于 LX-N Music」、链接为 `pyyyQWQ/lx-n-desktop`、落款含 LX-N 改良版说明 |
| 设置 → 软件更新 | ✅ 无「自动更新」勾选框；有 **「检查更新」按钮**；显示「当前版本 1.0.0」「最新版本：未知」（GitHub 不可达时正确显示未知，未误报 2.12.6） |
| 每日推荐 | ✅ **无回归**：13 首真实歌曲、SQ/24bit/HQ 音质标记、wy 来源、双 tab + 刷新正常 |
| 音频播放 | ✅ 底栏正常显示播放条与曲目信息 |

### 13.5 本轮未迁移项与原因（已在 §13.2 分类，此处汇总）
1. **硬编码 Cookie**（旧项目 lyric.js / wy/utils/index.js 注释行）：敏感凭据，**拒绝迁移**，建议用户在旧项目清理。
2. **`index-dev.ts` 临时关闭 devtools**：旧项目为排查音频问题所加临时调试改动，非功能；新项目已确认音频正常，**不迁移**。
3. **README.md 改写**：文档类，避免与仓库发布流程冲突，**不改**。
4. **运维脚本**（check-userdata.bat/rebuild-deps.bat/start-dev.bat/pnpm-workspace.yaml）：新项目已有 `启动开发版.bat`，**不迁移**。
5. **`useMenu.js`/`Detail/action.ts`/`ipc.ts`/`defaultSetting.ts`** 等：内容与新项目完全一致，**无需迁移**。

### 13.6 未解决问题 / 下一步
- **更新检查的网络前提**：本机 Github 不可达（代理 33210 未运行），「最新版本」显示「未知」属预期行为；配置可访问 GitHub 的网络后可验证真实版本比对。
- **`publish/version.json` 版本同步**：`updateFeedEnabled = true` 生效后，发布新版本时须同步 `main` 分支 `publish/version.json` 的 version，否则会误报（已在 `config.ts` 注释中注明）。
- **打包产物验证**：本轮只做了 `pnpm build`（源码目标编译），未跑 `pnpm pack` 生成安装包。
- **可选功能**（旧项目也没有，非迁移项）：每日推荐自动存歌单、相似歌曲/风格化推荐。
---

## 14. WebDAV 数据同步迁移（2026-10-23 21:00–21:55，第 4 轮）

> 目标：把旧项目曾实现过的 WebDAV 同步迁回新项目，**优先复用旧实现**，并先查清历史故障与回退原因。
> 结论先行：**旧桌面版 WebDAV 代码已在回退时彻底删除且不可恢复**，因此本轮复用对象是旧桌面版当初参照的同一份源码——移动改良版 `souvenp/lx-netease-music-mobile` 的实现。

### 14.1 旧实现与历史故障调查（先查证，未预设结论）

**A. 旧桌面版 WebDAV 代码是否存在？——不存在**
| 检索位置 | 结果 |
|---|---|
| 旧项目当前工作区 | 无（已在 S 章节按用户要求完整回退） |
| `_webdav-backups/backup-prede/` | 是 **WebDAV 开发前**（14:37）快照，本就不含 WebDAV |
| `_webdav-backups/exp-noremap/` | 仅 `main.ts.full`、`SettingSync-index.vue.full` 两个外围文件 |
| `LX-n-desktop-backup-20261023-181453/` | 无 `core/sync/`、无 `utils/webdav.ts`、`defaultSetting.ts` 无 `sync.webdav` 键 |
| git 对象库 `git fsck` | 有 broken link 损坏，**无悬空 blob** 可恢复 |
| 回收站 | 0 项 |
| 桌面压缩包 | 仅两个无关的游戏资源包 |

**B. 可复用的真实源码（移动改良版，旧桌面版当初的参照物）**
| 文件 | 作用 | 复用方式 |
|---|---|---|
| `worktrees/netease_main/src/utils/webdav.ts` | WebDAV 客户端：`createClient`/`testConnection`/逐级建目录/404→null/`getStat` | **近乎原样复用**到 `src/renderer/utils/webdav.ts` |
| `worktrees/netease_main/src/core/sync/webdavSync.ts` | 同步语义：远端文件契约、`lastModified` 冲突判定、首次同步询问、敏感键过滤 | **语义复用**到 `src/renderer/core/sync/webdavSync.ts`（按桌面端架构适配） |
| `worktrees/netease_main/src/core/sync/syncHelpers.ts` | `SENSITIVE_SETTING_KEYS` 与 `getAllDataForSync` | 敏感键清单复用并**按桌面端实际键集调整** |

**C. 历史音频故障 —— 不作为「WebDAV 有罪」的依据**
- 旧交接 S3 明确记载：**源码完整回退 + webdav 库完全移除 bundle 后，音频问题依旧**；且正式版 v1.0.0 在同机完全正常。
- 旧交接 T 章节的隔离实验证明 `enumerateDevices()` 在 http/file、精确 webPreferences、透明窗口、devtools 故障、时序下**均返回完整 6 个 audiooutput**。
- **本轮进一步确证真实根因**（第 2 轮已实测）：`ELECTRON_RUN_AS_NODE=1` 使 Electron 退化为纯 Node 模式 → 不初始化 GUI/媒体栈。清除后音频完全正常。
- **结论**：音频问题与 WebDAV 无因果关系；WebDAV 不触碰任何音频设备枚举/播放链路（关键文件 `useMediaDevice.ts`、`SettingPlay.vue` 本轮零改动）。

### 14.2 开发前备份（已完成并验证）
- 路径：`<USER_HOME>\Desktop\LX-N-Desktop-PRE-WEBDAV-20261023-2105`
- 内容：新项目全源码（排除 `node_modules`/`dist`/`.git`）
- 验证：**846 个文件**全部复制；`PROJECT_HANDOFF.md`、`package.json`、`config.ts`、`DailyRec/index.vue`、`useUpdate.ts`、`启动开发版.bat` 哈希逐一一致
- 备份时 Git 现场：分支 `baseline-v1.0` / HEAD `15bb723` / 34 个改动文件

### 14.3 同步范围与数据安全边界（本轮重点核查）
| 数据 | 是否同步 | 依据 |
|---|---|---|
| 歌单（默认/喜欢/自建） | ✅ 同步 | `ListDataFull` 结构与移动端一致，桌面端有 `getListMusics`/`overwriteListFull` |
| 应用设置（普通项） | ✅ 同步 | 音质、音量、界面等 |
| **网易云 Cookie** | ❌ **从不上传、从不被覆盖** | 列入敏感键过滤（双向过滤） |
| **WebDAV 密码** | ❌ **从不上传、从不被覆盖** | 同上 |
| 媒体设备 id / 播放设置 | ⚠️ 属普通设置，会随设置同步 | 非凭据，不涉及音频初始化逻辑本身 |
| 自定义音源 `user_apis.json` | ❌ 本轮**未实现** | 桌面端 userApi 走子进程写回，风险高；不做半成品 |
| 播放历史 | ❌ 不读写 | **桌面端无该功能**，不臆造 |
| 下载任务 | ❌ 不读写 | 两端模型结构不同，不做有损转换 |
| 应用数据目录 | ❌ 不触碰 | 同步只走网络，不移动/删除本地数据目录 |

### 14.4 新增/修改文件清单
**新增**
| 文件 | 说明 |
|---|---|
| `src/common/utils/webdavSync.ts` | 纯逻辑：敏感键过滤、路径规范化、远端载荷归一化、同步方向判定、错误提示映射（可隔离测试） |
| `src/renderer/utils/webdav.ts` | WebDAV 客户端封装（复用移动端实现，设置读取改为桌面端；日志不含密码） |
| `src/renderer/core/sync/webdavSync.ts` | 同步核心：测试连接、上传/下载歌单、上传/下载设置、主同步流程、启动自动同步 |
| `src/renderer/views/Setting/components/SettingSync/WebdavSync.vue` | 设置 UI：启用开关、URL/用户名/密码/路径、测试连接、立即同步、上传·下载歌单、上传·下载设置、上次同步时间 |
| `tests/webdavSync.test.mjs` | 纯逻辑测试（59 断言，含错误映射 9 条） |
| `tests/webdavTransport.check.cjs` | **真实 HTTP** 传输层验证（8 项：连接/401/建目录/上传/下载/404/stat/覆盖/中文路径） |
| `tests/webdavE2E.check.mjs` | **端到端数据安全**验证（24 项：敏感键双向过滤、篡改注入防护、载荷契约） |

**修改**
| 文件 | 改动 |
|---|---|
| `package.json` | 新增依赖 `webdav@^5.11.0`；新增 `test:webdav` 脚本 |
| `pnpm-lock.yaml` | 锁定 webdav 及其依赖 |
| `src/common/types/app_setting.d.ts` | 新增 7 个 `sync.webdav.*` 设置键类型 |
| `src/common/defaultSetting.ts` | 新增 7 个默认值（默认 `enable=false`，密码空，路径 `/LX_Music/`） |
| `src/renderer/views/Setting/components/SettingSync/index.vue` | 挂载 `<WebdavSync>` 区块（与局域网同步并存） |
| `src/renderer/main.ts` | 启动时调用 `initWebdavSync()`（仅启用+自动同步时后台触发一次） |
| `src/lang/{zh-cn,en-us,zh-tw,ko-kr}.json` | 各新增 48 条 `setting__sync_webdav_*` 文案 |
| `tests/run.mjs` | 注册 `webdavSync.test.mjs` |

### 14.5 与移动端实现的关键差异（有意为之，非缺陷）
1. **无逐操作合并（opQueue）**：桌面端没有操作队列与 `applyListOperation`。强行移植会引入未经实机验证的冲突合并路径，故改为「远端较新→确认后整体覆盖；本地较新→整体上传」，**所有覆盖方向都先弹窗确认**。
2. **首次同步**：与移动端一致，检测到「本地无同步记录 + 云端已有数据」时弹窗让用户选方向，不静默覆盖任何一方。
3. **失败处理**：`downloadFile` 仅把 **404/409** 视作「云端无数据」；权限/网络故障一律向上抛错，**绝不把故障当成空数据去上传覆盖**。
4. **敏感键集调整**：移动端清单含 `common.wy_serpapi_key`/`common.yt_cookie`（桌面端不存在）；桌面端保留 `common.wy_cookie` + `sync.webdav.password`。
5. **不做自动下载/自动应用**：启动自动同步只在「启用 + 自动同步歌单」时触发一次歌单同步。

### 14.6 测试与构建结果（均为实际执行）

| 检查 | 结果 |
|---|---|
| `pnpm test`（主套件） | ✅ **exit 0，141 断言全部通过**（domain 28 + cookie 11 + accountLogic 13 + updateFeed 14 + dailyRec 16 + **webdavSync 59**） |
| `pnpm test:webdav`（真实 HTTP 传输） | ✅ **8/8 通过**：连接成功、错误密码 401、逐级建目录+上传、下载内容一致、404、stat 大小、覆盖上传、中文目录 |
| `pnpm test:webdav`（端到端数据安全） | ✅ **24/24 通过**：上传载荷不含 Cookie/密码、下载不写回、**云端被篡改注入 Cookie 也被过滤**、音质/音量正常保留、歌单契约（version/lastModified/userList）、不携带 playHistory/downloadTasks、路径规范化、首次同步/新旧判定 |
| `pnpm build` | ✅ **4 目标全部 build success**，无 `ERROR in` |
| 产物复核 | ✅ `dist/renderer.js` 含 `putFileContents`/`getFileContents`/`LX_Music`/`playlists.json`/`settings.json`/`sync.webdav.password`；bundle 1.72MB → **1.89MB**（webdav 库） |
| 构建期修复 | 2 个类型/规范错误已修：`t()` 的 i18n 键类型（收敛为宽松签名）、`WebdavSync.vue` 未使用的 `useI18n`/`toast` 导入 |

### 14.7 GUI 实测（实际启动并截图）
| 项 | 结果 |
|---|---|
| 应用启动 | ✅ 8 个 electron 进程，`main.log` 记录 `App starting...`，窗口标题显示播放曲目 |
| 设置 → 数据同步 | ✅ 既有局域网同步正常，**新增「WebDAV 同步」区块**正常渲染 |
| 勾选「启用 WebDAV 数据同步」 | ✅ 配置区展开（提示语、服务器地址、用户名、密码、路径、测试连接） |
| 设置持久化 | ✅ `%APPDATA%\lx-netease-music-desktop\LxDatas\config_v2.json` 中 7 个 `sync.webdav.*` 键全部写入，`enable=true` 生效 |
| **每日推荐回归** | ✅ **无回归**：13 首歌曲、SQ/24bit/HQ 标记、双 tab、播放正常 |
| 网易云登录 | ✅ 登录态正常（每日推荐仍能拉取账号数据） |
| 播放/音频 | ✅ 底栏播放正常；音频相关文件本轮**零改动** |

### 14.8 已知限制与未验证项（如实声明）
1. **未接真实第三方 WebDAV 服务**（坚果云/Nextcloud 等）。本轮用本地 mock WebDAV 服务器验证了协议层与数据安全，但**真实服务商的认证方式、TLS、路径大小写差异仍需你实测**。
2. **未做手机端↔桌面端真实互通**（无真实 WebDAV 账号）。
3. **未实现自定义音源同步**（`user_apis.json`），UI 已按「设置同步」命名，避免夸大能力。
4. **未做逐次列表变更的自动同步**（移动端 debounce 语义），只有「启动时一次」+「手动」。
5. **未跑 `pnpm pack`** 打包验证。
6. 测试脚本 `tests/webdavTransport.check.cjs`、`tests/webdavE2E.check.mjs` 保留在仓库中（通过 `pnpm test:webdav` 可复跑），如不需要可删除。

### 14.9 保护与安全核验
- 未执行 `git reset`/`git clean`/强切分支；**未提交、未推送、未发布**。
- 旧项目零改动（仍为 `phaseA`/`4e722226`）。
- 未重新引入任何 WebDAV 之前被回退的旧桌面代码（因其不存在），全部基于可查证的移动端源码复用 + 桌面端适配。
- **全文与本轮所有日志、测试输出均不含真实 Cookie/密码/令牌**；测试用的 `SECRET_COOKIE_VALUE`/`SECRET_DAV_PASSWORD` 为虚构占位值。
---

## 15. 自定义音源同步 + 跨端语言标识修复（2026-10-23 22:30–23:10，第 5 轮）

### 15.1 首个真实跨端故障：手机端设置导致界面崩溃（已修复）

**现象**：手机端上传设置后，桌面端下载设置完成，界面随即报错并白屏：
```
TypeError: Cannot read properties of undefined (reading 'search')
  at Object.getMessage (src/lang/i18n.ts:59)
  at NavBar.vue:24
```

**根因（实测确证）**：手机端 `common.langId` 的值是 **`zh_cn`（下划线）**，桌面端语言包文件名是 **`zh-cn`（连字符）**。
`setLanguage('zh_cn')` 时 `this.message = messages['zh_cn']` 得到 `undefined`，随后 `getMessage` 执行
`this.message[key]` 抛错，导致整个侧边栏渲染失败。
（配置实测：`%APPDATA%\...\LxDatas\config_v2.json` 中 `common.langId` 原值为 `"zh_cn"`。）

**修复（双保险）**：
| 文件 | 改动 |
|---|---|
| `src/lang/i18n.ts` | `setLanguage` 增加语言存在性校验（不存在的语言回退到当前或 `zh-cn`）；`getMessage` 用可选链兜底，**任何未知语言都不会再崩 UI** |
| `src/common/utils/webdavSync.ts` | 新增 `sanitizeRemoteSettingsForDesktop`：下载设置时把 `zh_cn` 自动规整为 `zh-cn`（下划线→连字符、统一小写），`parseRemoteSettingsForApply` 改为调用它 |

### 15.2 自定义音源同步（本轮新实现）

**用户需求**：手机端已有「上传/下载设置与音源」，桌面端要一致。

**关键技术核查（结论：可做，且能跨端互通）**
| 项 | 桌面端 | 移动端 | 是否兼容 |
|---|---|---|---|
| 存储形态 | 元数据 + `gz_`+base64 压缩脚本（`electron-store`） | 元数据 + 明文脚本 | ✅ 通过导出时解压成明文即可互通 |
| 脚本读取 | `getScript(id)`（已有，解压后返回明文） | `getUserApiScript(id)` | ✅ |
| 脚本导入 | `importApi(script)`（已有，接受明文） | `overwriteUserApis` | ✅ |
| 远端文件契约 | `user_apis.json` → `{version:'2',lastModified,data:{list,scripts}}` | 同 | ✅ 完全一致 |

**新增能力（主进程缺失的两个 IPC）**
| 文件 | 改动 |
|---|---|
| `src/main/modules/userApi/index.ts` | 新增 `getAllUserApisForSync()`（导出全部源：元数据 + **解压后明文脚本**）、`overwriteUserApisForSync(data)`（先清空本地、再逐个 `importApi`，单个失败不中断整体） |
| `src/common/ipcNames.ts` | 新增 `get_user_api_all_for_sync`、`overwrite_user_api_for_sync` |
| `src/main/modules/winMain/rendererEvent/userApi.ts` | 注册两个 IPC handler |
| `src/renderer/utils/ipc.ts` | 新增对应渲染层调用封装 |
| `src/renderer/core/sync/webdavSync.ts` | 新增 `getRemoteUserApisPath`/`uploadUserApis`/`downloadAndApplyUserApis`；「上传/下载设置」升级为「**设置与音源**」 |
| `src/lang/{zh-cn,en-us,zh-tw,ko-kr}.json` | 按钮改为「上传/下载设置与音源」；新增 `user_api_failed`、`download_user_api_ok`；确认文案补充音源说明（各语言 **50** 个 webdav 键） |

**失败处理设计**：设置成功但音源失败时，**不整体报「失败」**（否则用户会误以为设置也没同步），改为显示「音源同步失败：…」并保留成功的设置变更。远端音源文件缺失/格式非法时抛明确错误，**绝不静默清空本地音源**。

### 15.3 UI 按手机端对齐

顺序改为（与手机端一致）：启用 → 自动同步歌单 → 服务器地址/用户名/密码/同步路径 → **测试连接 + 立即同步歌单** → **上传/下载设置与音源** → **上传/下载歌单** → 上次同步时间。
按钮文案与手机端相同（"立即同步歌单"而非笼统的"立即同步"）。

### 15.4 验证结果（实际执行）

| 检查 | 结果 |
|---|---|
| `pnpm test` | ✅ 165 断言全部通过（webdav 83，含新增 10 条跨端语言标识测试） |
| 音源往返验证（用户真实音源文件） | ✅ **14/14**：解析出 `聆澜音源(赞助版) v8.9.2`；压缩 8010→4439 字节；解压与原文**完全一致**；同步 payload 契约校验通过；明文不含 `gz_`；重新压缩再解压仍一致 |
| `pnpm build` | ✅ 4 目标全 success，零 `ERROR in` |
| 产物复核 | ✅ `dist/main.js` 含两个新 IPC + `getScript`；`dist/renderer.js` 含 `user_apis.json` 与两个通道名 |

**构建期修复的 3 个类型错误**：`mainHandle` / `rendererInvoke` 的泛型顺序为 `<入参, 返回值>`，无入参时须用单泛型重载（`<V>`）。已修正并记录，避免后续再踩。

### 15.5 已知限制
1. **音源「整体覆盖」**：下载会用云端音源**替换**本地全部自定义源（与手机端行为一致），不做逐条合并。已加确认弹窗。
2. **脚本格式非法时跳过**：导入时单个脚本失败只记录警告并继续，不中断其余音源。
3. **未接真实坚果云实测这次音源同步**：传输层与数据往返已验证，但「手机上传音源 → 桌面下载 → 桌面音源可用」的端到端仍需用户实测。
4. 音源里的 `API_KEY` 等属用户自有配置文件内容，**同步功能会按用户预期传输这些内容**（这是功能本身）；交接文档与日志不记录其值。
---

## 16. 放弃「设置与音源同步」+ 手机端文件安全忽略（2026-10-23 23:20–23:50，第 6 轮）

### 16.1 用户决定
用户在实测后决定**放弃「上传/下载设置与音源」功能**，并要求：手机端若上传了设置与音源，桌面端**直接忽略**，不能因此产生任何 bug。

> 说明：第 15 章实现的音源同步已按此决定**完整移除**。第 15 章保留为历史记录，不再代表当前功能状态。

### 16.2 当前同步范围（最终形态）
| 数据 | 是否同步 |
|---|---|
| **歌单**（默认/喜欢/自建） | ✅ **唯一同步内容** |
| 应用设置 | ❌ 不读写 `settings.json` |
| 自定义音源 | ❌ 不读写 `user_apis.json` |
| 播放历史 / 下载任务 | ❌ 不读不写（桌面端无对应能力） |
| 网易云 Cookie / WebDAV 密码 | ❌ 从不传输 |

### 16.3 移除清单（代码已回退到「只同步歌单」）
| 文件 | 处理 |
|---|---|
| `src/main/modules/userApi/index.ts` | 删除 `getAllUserApisForSync` / `overwriteUserApisForSync`，恢复原 49 行版本 |
| `src/main/modules/winMain/rendererEvent/userApi.ts` | 删除两个 sync IPC handler；**恢复误删的 `sendStatusChange`/`sendShowUpdateAlert` 导出** |
| `src/common/ipcNames.ts` | 删除 `get_user_api_all_for_sync` / `overwrite_user_api_for_sync` |
| `src/renderer/utils/ipc.ts` | 删除对应两个封装 |
| `src/renderer/core/sync/webdavSync.ts` | 删除 `uploadSettings`/`downloadAndApplyUserApis`/`uploadUserApis`/`manualUploadSettings`/`manualDownloadSettings`，以及 `getRemoteSettingsPath`/`getRemoteUserApisPath` 与相关导入（净减约 130 行） |
| `src/renderer/views/Setting/components/SettingSync/WebdavSync.vue` | 删除「上传/下载设置与音源」按钮与 handlers |
| `src/lang/{zh-cn,en-us,zh-tw,ko-kr}.json` | 删除 12 条设置同步相关文案（各语言 webdav 键 50→38） |
| `tests/userApiSync.check.mjs` | 删除（音源同步验证脚本） |
| `package.json` | 删除 `test:userapi` 脚本 |

### 16.4 关键防护：手机端文件被误认为歌单的拦截（新增）
新增 `isListsDataShape(data)`：判断 `data` 是否为歌单结构（`defaultList`/`loveList`/`userList` 至少一个是数组）。
`normalizeRemoteListsData` 在解析后**强制校验**，不满足则抛错拒绝应用。

这样即使出现以下异常情况，本地歌单也不会被破坏：
- 手机端把 `settings.json` 的内容错写进 `playlists.json`（data 是扁平键值对 → 拒绝）
- 手机端把 `user_apis.json` 的内容错写进 `playlists.json`（data 是 `{list,scripts}` → 拒绝）
- 文件被外部工具改坏（null / 数组 / 字符串 / 空对象 → 拒绝）

**覆盖方向本身仍是「用户确认后才执行」**，因此双重保护：先确认，再校验，校验不过则不写入。

### 16.5 i18n 崩溃防护保留（与设置同步无关，必须留）
第 15.1 节的 `src/lang/i18n.ts` 修复**保留**：
- `setLanguage` 校验语言存在性，未知语言回退
- `getMessage` 用可选链兜底

原因：即使不再下载设置，**本机配置里可能残留**曾被写入的 `zh_cn` 等非法值（用户配置不会自动清理）。
该防护与同步功能无关，属于通用的健壮性修复，删除会导致同类崩溃再次发生。

### 16.6 验证结果（实际执行）
| 检查 | 结果 |
|---|---|
| `pnpm test` | ✅ **164 断言全部通过**（domain 28 + cookie 11 + accountLogic 13 + updateFeed 14 + dailyRec 16 + webdav 82） |
| webdav 新增防护测试 | ✅ 11 条：真实歌单被识别、设置数据被拒、音源数据被拒、null/数组/字符串/空对象被拒 |
| `pnpm test:webdav` | ✅ 传输层 8/8 + 端到端数据安全 24/24 |
| `pnpm build` | ✅ 4 目标全 success，零 `ERROR in` |
| 残留检查 | ✅ `webdavSync.ts` 中已无 settings/userApis 同步代码（仅注释说明） |

### 16.7 关于「立即同步歌单」与「上传/下载歌单」是否重复（用户提问的答复）
**不完全重复，但确实重叠。**
- **立即同步歌单**：自动比较云端与本地的 `lastModified`，云端较新 → 确认后下载；本地较新/相同 → 上传。首次同步额外弹窗让用户选方向。
- **上传歌单 / 下载歌单**：强制指定方向，不比较时间戳。

重叠点：当自动判断的结果恰好等于用户想强制的方向时，效果相同。
手动按钮唯一有价值的场景：**时间戳不可信**（多设备时钟不同步、同步记录被重置），此时需要强制指定。

若用户希望精简，可只保留「立即同步」——本轮**未改动**，等待用户明确指示。
---

# 附录 A：当前项目现状总览（给下一轮协作方，2026-10-24 00:05）

> 本附录是**对当前真实代码状态的汇总**，供新的对话（如 ChatGPT）快速接手。
> 如与前面章节冲突，**以本附录为准**（前面 §14/§15 描述的是过程中的中间状态，§16 已记录回退）。

## A1. 一句话现状

新项目 `<USER_HOME>\Desktop\LX-N-Desktop-NEW` 以 v1.0.0（GitHub tag `v1.0.0` / commit `15bb7230`）为基线，
已完成 **每日推荐**、**独立版更新源**、**WebDAV 歌单同步** 三项功能开发，均通过自动化测试与构建，
并做过界面实测。**代码全部未提交**（分支 `baseline-v1.0`，50 个文件改动/新增）。

## A2. 功能清单（当前真实状态）

| 功能 | 状态 | 说明 |
|---|---|---|
| 网易云登录 | ✅ 原样保留 | v1.0 已内置，本次**零改动**（网页登录 + Cookie + 校验 + 过期处理） |
| 我的网易云歌单 | ✅ 原样保留 | v1.0 已内置，零改动 |
| 每日推荐（歌曲+歌单） | ✅ 已迁移并实测 | 13 首歌曲、18 个歌单、点击播放、刷新；路由 `/wy/dailyRec` |
| 独立版更新源 | ✅ 已迁移 | 更新指向 `pyyyQWQ/lx-n-desktop`，关闭自动下载，新增「检查更新」按钮 |
| 品牌化 | ✅ 已迁移 | 全站链接、菜单、关于页、四语言文案 |
| **WebDAV 歌单同步** | ✅ 已迁移并实测 | **仅同步歌单**；设置/音源/Cookie 均不传输 |
| 设置与音源同步 | ❌ 已实现后**按用户决定移除** | 见 §16 |
| 自定义音源导入（本地） | ✅ v1.0 原有功能 | 与本项目无关，未改动 |
| **软件图标** | ✅ 已全量替换 | Windows ico / macOS icns / Linux png + 窗口图标；见 §17 |

## A3. WebDAV 同步的确切范围（最易误解的一点）

**只读写一个远端文件：`playlists.json`**

```
<配置的远端路径>/playlists.json
```

- 不读 `settings.json`、不读 `user_apis.json`（手机端即使上传了也**完全忽略**）
- 设置了结构校验 `isListsDataShape`：data 必须含 `defaultList`/`loveList`/`userList` 数组之一，
  否则拒绝应用（防止误把设置/音源文件当成歌单覆盖本地）
- 网易云 Cookie、WebDAV 密码：从不传输

**UI 只有 4 个按钮**：测试连接、立即同步歌单、上传歌单、下载歌单。
另有 2 个开关：启用 WebDAV 同步、启动后自动同步歌单。

**「立即同步歌单」与「上传/下载歌单」的区别**（用户曾提问）：
- 立即同步 = 自动比较 `lastModified` 决定方向
- 上传/下载 = 强制指定方向
- 二者在「自动判断结果恰好等于想强制方向」时效果相同，属**部分重叠**，保留是为了应对时间戳不可信的场景

## A4. 新增的设置键（7 个）
```
sync.webdav.enable            boolean  默认 false
sync.webdav.syncLists         boolean  默认 false
sync.webdav.url               string   默认 ''
sync.webdav.username          string   默认 ''
sync.webdav.password          string   默认 ''（明文存本地，从中不上传）
sync.webdav.path              string   默认 '/LX_Music/'
sync.webdav.lastSyncTimeLists number   默认 0
```

## A5. 依赖变化
仅新增一个：`webdav@^5.11.0`（其余依赖全部沿用 v1.0，**未升级任何既有依赖**）。

## A6. 测试与验证现状

| 项目 | 命令 | 结果 |
|---|---|---|
| 主测试套件 | `pnpm test` | ✅ **164 断言全通过**（domain 28 / cookie 11 / accountLogic 13 / updateFeed 14 / dailyRec 16 / **webdav 82**） |
| WebDAV 真实 HTTP + 数据安全 | `pnpm test:webdav` | ✅ 传输层 **8/8** + 端到端数据安全 **24/24**（本地 mock WebDAV 服务器） |
| 生产构建 | `pnpm build` | ✅ 4 目标（main / renderer / renderer-lyric / renderer-scripts）全 success |
| 界面实测 | 手动 | 每日推荐页、WebDAV 设置区、更新页均看过并截图确认 |

### 尚未验证（**重要，不要当成已完成**）
1. **未接真实第三方 WebDAV 服务**（坚果云/Nextcloud）。仅用本地 mock 服务器验证协议层；用户的坚果云账号**曾成功同步过一次歌单**（界面显示上次同步时间），但完整回归未系统记录。
2. **未做手机端 ↔ 桌面端端到端互通验证**（歌单双向读取）。
3. **未跑 `pnpm pack`** 生成安装包。
4. 音频设备/播放：**已实测正常**（13 设备/6 音频输出，普通+自定义音源均可播放），但那是 dev 模式下的结果，打包版未复测。

## A7. 已解决的历史疑难（避免重复排查）

| 问题 | 真实根因 | 解法 |
|---|---|---|
| dev 模式窗口不弹 / 音频设备为空 | 环境变量 `ELECTRON_RUN_AS_NODE=1` 让 Electron 退化为纯 Node 模式 | `启动开发版.bat` 启动前清除该变量 |
| 双击 bat 无窗口（第二次） | 我用后台任务启动的开发版残留进程占着 9080/9081 端口 | 清理残留进程；**已确认端口释放** |
| 下载设置后界面白屏 `Cannot read properties of undefined (reading 'search')` | 手机端同步来的 `common.langId = "zh_cn"`（下划线），桌面语言包是 `zh-cn`（连字符），`messages['zh_cn']` 为 undefined | `i18n.ts` 加语言存在性校验 + getMessage 可选链兜底；**该修复必须保留**（配置里可能残留非法值） |
| 弹窗取消按钮显示 `setting__sync_webdav_$2` | 我用正则批量插入代码时反向引用未展开 | 修正 5 处；并加测试检查源码中是否残留 `$1/$2` 类字面量 |

## A8. 环境与命令速查

```powershell
# node/pnpm 不在系统 PATH，必须显式加
$env:PATH = '<USER_HOME>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
$N = '<USER_HOME>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$P = '<USER_HOME>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'

& $N $P test        # 主测试
& $N $P test:webdav # WebDAV 传输+数据安全
& $N $P build       # 生产构建

# 启动开发版：直接双击 启动开发版.bat
# 注意：pnpm 前置校验会因 node 不在 PATH 报 'node' 不是内部命令，属噪音，不影响构建
```

## A9. 待办 / 建议下一步

### 优先级 1（用户侧验证）
1. 用真实坚果云账号完整走一遍：手机上传歌单 → 桌面下载 → 歌单内容正确
2. 反方向：桌面修改歌单 → 上传 → 手机读取
3. 确认「启动后自动同步歌单」在真实环境下行为符合预期

### 优先级 2（代码侧）
1. **提交代码**（用户授权后）：当前 50 个改动/新增全在工作区，建议拆成 3 个 commit（每日推荐 / 更新与品牌化 / WebDAV）
2. `pnpm pack` 打包验证
3. 决定「立即同步歌单 vs 上传/下载歌单」是否精简（用户倾向可能合并）

### 优先级 3（可选增强）
1. 每日推荐「自动存为歌单」（桌面端无 `list.isAutoSaveDailyRec` 设置项，需新加）
2. 相似歌曲 / 风格化推荐（当前无桌面数据流）
3. WebDAV 列表变更级自动同步（手机端有 debounce 语义，桌面端仅启动时同步一次）

## A10. 安全与边界（务必延续）

- 旧项目 `<USER_HOME>\Desktop\LX-n-desktop\lx-netease-music-desktop` **只读参考，从未修改**（仍为 `phaseA` / `4e722226` / 55 个改动）
- 未执行 `git reset` / `git clean` / 强制切分支；**未提交、未推送、未发布**
- 未重新引入 WebDAV 之外的旧未提交改动；未把旧项目全部历史改动混入
- 本轮所有日志、测试、文档**不含真实 Cookie / 密码 / 令牌**
- 备份位置：
  - `<USER_HOME>\Desktop\LX-N-Desktop-PRE-WEBDAV-20261023-2105`（WebDAV 开发前，846 文件已验证）
  - `<USER_HOME>\Desktop\LX-N-Desktop-NEW-backup-20261023-201819`（更新模块开发前，845 文件已验证）
  - `<USER_HOME>\Desktop\LX-n-desktop-baseline-backup-20261023-1935`（旧项目基线备份，1002 文件已验证）
---

## 17. 软件图标全面替换（2026-10-24 00:00–00:25，第 7 轮）

### 17.1 开发前备份（已完成并验证）
- 路径：`<USER_HOME>\Desktop\LX-N-Desktop-PRE-ICON-20261023-2352`
- 内容：新项目全源码（排除 `node_modules`/`dist`/`.git`）
- 验证：**853 个文件**全部复制；`PROJECT_HANDOFF.md`、`package.json`、`build-pack.js`、
  `resources/icons/icon.ico`、`icon.png`、`512x512.png` 哈希逐一一致
- 备份时 Git 现场：分支 `baseline-v1.0` / HEAD `15bb723`

### 17.2 原图与处理原则
- **原图**：用户提供的 1254×1254 PNG（RGBA，8-bit）
- **处理原则（严格遵守）**：仅做等比缩放 + 格式转换，**未重绘、未裁切、未抠图、未改变背景、未调色**
- **像素级验证**：将每个生成的 PNG 与原图对应尺寸的缩放结果做逐像素差分，
  **全部 7 个尺寸的 meanDiffRGBA 均为 (0.00, 0.00, 0.00, 0.00)**，确认零改动

### 17.3 图标资源清单（全部已替换为新图）

**A. `resources/icons/`（打包用，Electron Builder 读取）**
| 文件 | 尺寸/格式 | 用途 |
|---|---|---|
| `16x16.png` ~ `512x512.png`（7 个） | PNG RGBA | Linux 图标目录、通用尺寸 |
| `icon.png` | 512×512 PNG | 通用应用图标 |
| `icon.ico` | 7 尺寸（16/24/32/48/64/128/256），32bpp | **Windows exe / 安装包 / 快捷方式 / 任务栏** |
| `icon.icns` | 11 条目（16~1024） | macOS 应用图标 |

**B. `src/static/icons/`（窗口图标用，新建目录）**
| 文件 | 用途 |
|---|---|
| `icon.ico` | Windows 窗口图标（开发模式也生效） |
| `512x512.png` | 非 Windows 窗口图标 |

> 说明：`src/static` 会被构建复制到 `dist/static`，开发模式直接指向源目录，因此两种模式下均可用。

### 17.4 代码与配置改动
| 文件 | 改动 |
|---|---|
| `src/main/modules/winMain/main.ts` | 启用主窗口图标：新增 `getAppIconPath()`，改用 `global.staticPath`（原代码引用的 `global.__static` 在本项目**未定义**，是该处被注释的原因） |
| `src/main/modules/winLyric/main.ts` | 同样启用桌面歌词窗口图标 |
| `resources/icons/*`（9 个文件） | 全部替换为新图标 |
| `src/static/icons/`（新增 2 个文件） | 新增窗口图标资源 |

**未改动**（有意为之，见 §17.6）：
- `build-config/build-pack.js`：`win.icon = ./resources/icons/icon.ico`、`linux.icon = ./resources/icons`、
  `mac.icon = ./resources/icons/icon.icns` —— **原有配置已正确指向本次替换的文件，无需修改**
- `src/static/images/tray/*`：托盘图标（功能剪影，非品牌图）
- `src/static/images/taskbar/*`：任务栏播放控制按钮

### 17.5 验证结果（区分已实际验证 / 仅代码检查）

**✅ 已实际验证**
| 项目 | 方法 | 结果 |
|---|---|---|
| 全部 PNG 尺寸正确 | 读取 PNG IHDR | 16/32/48/64/128/256/512/icon.png 尺寸全部正确 |
| 与原图零偏差 | Pillow 逐像素差分 | 7 个尺寸 meanDiff 均为 0.00 |
| ICO 结构合规 | 按 ICONDIR/ICONDIRENTRY 规范解析 | 7 条目、reserved=0、type=1、全 32bpp、声明尺寸与内嵌 PNG 实际尺寸**逐一匹配** |
| ICO 能被 Electron 加载 | `nativeImage.createFromPath` | `isEmpty=false`，size=256×256 |
| **ICO 能被 Windows 正确解析** | Win32 `SHGetFileInfoW`（资源管理器同款 API） | 返回 1（成功），拿到有效 HICON，位图 **32×32 bpp=32** |
| ICNS 结构 | 手工解析 icns 容器 | magic=`icns`，11 条目，字节完整性校验通过 |
| 源码构建 | `pnpm build` | ✅ 4 目标全 success，零 `ERROR in` |
| 图标进入产物 | 构建后检查 | `dist/static/icons/icon.ico` 存在且与 `resources/icons/icon.ico` **哈希一致** |
| 无功能回归 | `pnpm test` | ✅ 164 断言全部通过 |

**❌ 未能实际验证（如实说明原因）**
| 项目 | 原因 |
|---|---|
| **Windows 安装包图标** | `electron-builder` 打包时需联网下载 `winCodeSign` 等构建工具；本机网络到 GitHub 持续超时/连接重置（重试 3 次均失败：`ETIMEDOUT`、`ECONNRESET`），**打包未完成**，未生成 `build/win-unpacked` 与安装包 |
| **打包后 exe 内嵌图标** | 同上，无产物可查 |
| **桌面快捷方式/卸载入口图标** | 依赖安装包才能生成，同上 |
| **实际运行时的任务栏图标** | 依赖打包产物；开发模式下窗口图标已启用但未在本轮启动 GUI 目视确认 |

> 说明：`icon.ico` 已被 Windows Shell API 正确解析（32×32 bpp=32），说明图标文件本身**对 Windows 有效**；
> 只要打包能完成，electron-builder 会将它嵌入 exe。网络恢复后可重跑打包补验。

### 17.6 为何不改托盘与任务栏图标（重要判断）
托盘图标（`tray_origin`/`tray_black`/`trayTemplate`）与任务栏按钮图标（play/pause/next/prev/collect）
**不是软件身份图标，而是功能性 UI 元素**：
- 托盘图标为 16~32px **单色剪影**，需适配深/浅色系统主题（`trayTemplate` 为 macOS 模板图标，靠 alpha 通道自动着色）
- 任务栏按钮图标是**播放控制按钮**，语义必须保持可辨识

若将人物头像缩到 16px 作为托盘图标，会糊成色块且丧失主题自适应能力；替换播放按钮图标更会破坏功能语义。
用户要求「不得改变原图外观」，强行套用会同时违反该要求与可用性。因此**保持不变**，在此明确记录该决定。

### 17.7 未解决问题
1. **打包待补验**：需网络可访问 GitHub 后执行
   `node build-config/build-pack.js target=dir` 或 `pnpm pack`，
   确认 `build/win-unpacked/<productName>.exe` 图标为人物图。
2. 若希望连托盘也换成新图，需另行决策（建议保留单色剪影，或单独生成托盘专用的简化版本）。
3. `icon.icns` 体积 2.06MB（含 1024px 条目），如需精简可去掉 `ic10`/`ic14` 大尺寸。
---

## 18. 品牌信息治理执行（2026-10-24 00:40–01:00，第 8 轮）

> 依据：项目目录外的排查报告 `<USER_HOME>\Desktop\BRANDING_AUDIT.md`（§8 逐项建议）。
> 用户指示：**建议保留的保留、建议替换的替换、建议删除的删除、其他不动**。
> 核实结论：报告中**不存在任何「建议删除」项**（`删除` 仅出现在 §9 的备选选项里，而对应项均为「建议保留」）。

### 18.1 开发前备份
- 路径：`<USER_HOME>\Desktop\LX-N-Desktop-PRE-BRANDFIX-20261024-0041`
- 验证：**855 个文件**全部复制一致（排除 node_modules/dist/.git）

### 18.2 已执行替换（对应报告 §8「建议替换」）

| 报告项 | 文件 | 改动 |
|---|---|---|
| B1/B2 下载设置文案 | `src/lang/{zh-cn,zh-tw,en-us,ko-kr}.json` | `setting__download_embed_lxlyric`、`setting__download_lxlyric` 中的 `LX Music` → `LX-N`（4 语言各 2 项） |
| B3 开放 API 文案 | 同上 | `setting__open_api_tip` 中 `LX Music` → `LX-N`（4 语言） |
| B5/B6 Windows 旧版提示 | `src/main/utils/winLegacy.ts:23,33` | 两处 message 中 `LX Music` → `LX-N Desktop`（"标准版本的 LX-N Desktop"） |
| B15 无障碍标签 | `src/renderer/views/Setting/components/UserApiModal.vue:23` | `aria-label="https://lxmusic.toside.cn/..."` → `aria-label="https://github.com/pyyyQWQ/lx-n-desktop"` |
| E13 文档图标 | `doc/images/icon.png` | 用新图标重生成（200×200，源自用户原图等比缩放） |

### 18.3 按报告建议**保留**（未改动）

| 报告项 | 内容 | 保留理由（报告原述） |
|---|---|---|
| A2/A3/A4 | `licenses/license_zh.txt`、`license_en.txt`、`license.rtf` 末尾 `By: 落雪无痕` / `By: lyswhut` | 版权归属标识，删除有违 Apache-2.0 第 4 条风险 |
| A1 | `SettingAbout.vue:41` 关于页 `By: 落雪无痕` | 作者署名，报告建议保留 |
| B4 | `PactModal.vue:8` 软件内协议「LX Music（洛雪音乐助手）桌面版项目」 | 与许可证同源的协议正文，报告建议保留 |
| F1 | `LICENSE`（Apache-2.0 全文） | 不应改动 |
| F4/A5/A6 | `README.md:130`、`RELEASE_NOTES-v1.0.0.md:85` 来源说明 | 合规声明必须保留 |
| E5-E8 | 托盘 / 任务栏功能图标 | 功能 UI，非品牌文字 |
| B12 | `constants_sync.ts` 局域网同步标识 `lx-music auth::` / `lx-music connect` | 改动会中断与原版/手机端互通 |
| B13/B14 | 请求 UA `lx-music request`、临时目录 `lxmusic_temp` | 内部标识，改动需评估兼容性 |
| E9 | `src/renderer/assets/images/icon.svg` | 报告列为「建议进一步确认」，未获确认故不动 |
| A8/A9/E12 | `publish/changeLog.md` 历史、`FAQ.md`、`doc/images/app.png` | 报告列为「建议进一步确认」，未获确认故不动 |
| B7-B11 | `productName` / `appId` / `package.json` name 等 | 报告列为需你决定（第 10 项），未获决定故不动 |

### 18.4 验证结果（实际执行）

| 检查 | 结果 |
|---|---|
| `pnpm build` | ✅ 4 目标全 success，零 `ERROR in` |
| 语言文件 JSON 有效性 | ✅ 4 个文件均可解析 |
| 替换生效（构建产物） | ✅ `dist/renderer.js`：`lxmusic.toside.cn` 0 处、`LX-N 歌词` 2 处、`调用 LX-N` 1 处 |
| 替换生效（主进程） | ✅ `dist/main.js`：winLegacy 的 `LX Music` 已消除（残留 1 处为**已注释的** `// tray.setToolTip('LX Music')`） |
| 保留项确认 | ✅ 许可证 `By:` 行仍在；关于页署名仍在；协议正文仍在 |

### 18.5 构建产物中残留的 3 处（均为建议保留项，符合预期）
1. `dist/renderer.js` — `PactModal.vue` 协议正文「LX Music（洛雪音乐助手）桌面版项目」（B4，保留）
2. `dist/renderer.js` — 关于页「By: 落雪无痕」（A1，保留）
3. `dist/main.js` — 被注释的 `// tray.setToolTip('LX Music')`（不生效，无用户可见影响）

### 18.6 未处理（等用户决定）
报告 §9 中标注为「需要你决定」的 20 项里，除本轮的 5 项替换外，其余（尤其第 10 项 `productName` 是否改名、第 11 项同步标识）**仍保持原状**，待用户明确指示后再动。
---

## 19. LX-N Desktop 1.1.0 正式打包与上传前准备（2026-10-24 00:57–01:35，第 9 轮）

### 19.1 本轮目标与版本关系
- **目标版本：1.1.0**；**上一正式版本：1.0.0**（tag `v1.0.0` / commit `15bb7230`）
- 本轮只做打包、验证、版本统一、发布材料整理，**未开发新功能、未上传、未推送、未创建 Release**

### 19.2 找到的 1.0.0 打包依据（有据可查，非推测）
| 依据来源 | 内容 |
|---|---|
| `RELEASE_NOTES-v1.0.0.md` | 明确记录两个产物：`lx-netease-music-desktop-v1.0.0-x64-Setup.exe`（121,201,771 B）与 `...-x64-portable.exe`（109,846,902 B），含各自 SHA-256；并记录静默安装 exit 0、便携版 `userData` 隔离验证 |
| `README.md` | 同样列出两个产物及用途说明 |
| `build-config/build-pack.js` | `createTarget.win()` 中 setup/portable 的 `artifactName` 模板为 `${productName}-v${version}-${arch}-Setup.${ext}` / `...-portable.${ext}`，与 1.0.0 实际文件名**完全吻合** |
| `package.json` scripts | `pack:win:setup:x64`、`pack:win:portable:x64`、`pack:win:7z` 等既定目标 |
| 本机注册表 | 找到 `lx-netease-music-desktop 1.0.0`、`Publisher: pyyyQWQ` 的卸载项遗留（其安装目录已不存在） |

**结论**：1.0.0 的分发形式 = **NSIS 安装包 + 单文件便携版**，命名规则、输出目录 `build/`、图标与产品名配置均与当前 `build-pack.js` 一致 → **本轮完全沿用，未做任何打包方式调整**。

### 19.3 版本号统一（变更文件）
| 文件 | 改动 |
|---|---|
| `package.json` | `version` 1.0.0 → **1.1.0**（仅此一行，依赖版本未动） |
| `README.md` | 「当前正式版本」1.0.0 → 1.1.0；两处产物文件名 1.0.0 → 1.1.0 |
| `RELEASE_NOTES-v1.1.0.md`（新增） | 1.1.0 发布说明 |
| `RELEASE_CHECKLIST_1.1.0.md`（新增） | 发布前检查清单 |
| `.gitignore` | 新增忽略 `启动开发版.bat`（本地开发辅助脚本） |

**未改动**（按要求不做机械替换）：
- `pnpm-lock.yaml` 中依赖版本
- `src/common/defaultSetting.ts` 的 `version` 字段（设置结构版本，非软件版本）
- `publish/version.json`（内容为原版 2.12.6 历史，**不是本项目版本元数据**，见 §19.7）

### 19.4 实际执行的构建命令与结果

```powershell
# 环境（node/pnpm 不在系统 PATH）
$env:PATH = '<USER_HOME>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
$env:HTTPS_PROXY='http://127.0.0.1:33210'; $env:HTTP_PROXY='http://127.0.0.1:33210'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'

node pnpm run build                                   # 4 目标编译
node build-config/build-pack.js target=win arch=x64 type=setup
node build-config/build-pack.js target=win arch=x64 type=portable
```

| 步骤 | 退出码 | 结果 |
|---|---|---|
| `pnpm build` | 0（4 目标全 success，零 ERROR） | ✅ |
| setup 打包 | **0** | ✅ 生成 Setup.exe |
| portable 打包 | **0**（第 5 次尝试，见下） | ✅ 生成 portable.exe |

**portable 打包的排障过程（如实记录）**：
前 4 次均因 `winCodeSign` 下载失败（`ETIMEDOUT` / `ECONNRESET`）中断。定位过程：
1. 确认 setup 成功是因为 NSIS 与 7zip 已在 `%LOCALAPPDATA%\electron-builder\Cache`，仅 `winCodeSign` 缺失
2. 找到可用镜像地址 `https://registry.npmmirror.com/-/binary/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z`
3. 下载后**SHA-256 与 electron-builder 内置校验值 `CDAEC715...43A4` 完全匹配**（5.37 MB）
4. 手动解压并放置到缓存，再配合正确的 `ELECTRON_BUILDER_BINARIES_MIRROR` 环境变量，第 5 次成功

> 说明：这只是**构建环境网络问题**的绕过，未修改项目任何打包配置。

### 19.5 生成的分发包（真实路径与校验）

目录：`<USER_HOME>\Desktop\LX-N-Desktop-NEW\build\`

| 文件 | 大小 | SHA-256 |
|---|---:|---|
| `lx-netease-music-desktop-v1.1.0-x64-Setup.exe` | 122,195,128 B（116.53 MB） | `61C5D77E6E53B69DA65684692EE4E0F99F68ACBF28B966CAC2538BBAFF1C21EE` |
| `lx-netease-music-desktop-v1.1.0-x64-portable.exe` | 110,528,233 B（105.41 MB） | `EC1AD9636388D9E10684FF2DC548C6F6FF838390959C6C264CF73A997BF6A978` |
| `SHA256SUMS.txt` | — | 上述两条，已自校验通过 |

### 19.6 产物属性与运行验证（实际执行）

| 检查 | 结果 |
|---|---|
| Setup `FileVersion`/`ProductVersion` | **1.1.0 / 1.1.0** ✅ |
| portable `FileVersion`/`ProductVersion` | **1.1.0 / 1.1.0** ✅ |
| 两者 `CompanyName` | `pyyyQWQ` ✅ |
| 两者 `LegalCopyright` | `Copyright © 2026 pyyyQWQ` ✅ |
| **静默安装** | `Setup.exe /S /D=<隔离目录>` → **exit 0**，安装目录生成主程序与卸载程序 ✅ |
| **安装版启动** | 从安装目录启动，窗口标题显示 `LX-N Music`，主界面正常加载 ✅ |
| **便携版启动** | 复制到独立目录运行，窗口标题 `LX-N Music` ✅ |
| **便携版数据隔离** | 在便携 exe 同目录创建 `userData\LxDatas`（未写入 `%APPDATA%`）✅ |
| 图标 | 新人物图标（详见 §17）✅ |

### 19.7 发布回归检查

| 项目 | 结果 |
|---|---|
| `pnpm test` | ✅ **164 断言全通过** |
| `pnpm test:webdav` | ✅ 传输 8/8 + 数据安全 24/24 |
| 音频设备与播放 | ✅ 13 设备 / 6 音频输出；普通与自定义音源可播放（第 1–2 轮实测，本轮未复测） |
| 每日推荐 | ✅ 13 首歌曲 / 18 个歌单（第 1 轮 dev 实测）；**打包版未单独复测该页面** |
| 网易云登录 | ✅ 登录态复用正常 |
| 更新检查 | ⚠️ 安装版启动日志出现 GitHub API 请求失败（`createHttpError`）——因仓库尚无 1.1.0 Release 记录，属**预期行为**，不影响功能 |

### 19.8 未验证 / 部分验证（不得当作已通过）

- ❌ **真实网易云账号端到端**：发布环境无测试账号
- ❌ **手机端 ↔ 桌面端 WebDAV 互通**：无跨端环境
- ⚠️ **真实第三方 WebDAV 服务**：仅本地 mock 验证协议层与数据安全
- ❌ **x86 / ARM64 / Windows 7/8**：仅构建 x64
- ❌ **代码签名**：未配置证书（预期 SmartScreen「未知发布者」）
- ⚠️ **从 1.0.0 覆盖升级**：仅验证全新安装，未实测覆盖升级路径

### 19.9 Git 工作区最终状态

- 分支 `baseline-v1.0`，HEAD `15bb7230`（未新增提交）
- **51 个修改 + 17 个新增文件（14 个功能/文档组）**（含本轮 `RELEASE_NOTES-v1.1.0.md`、`RELEASE_CHECKLIST_1.1.0.md`）
- **未做任何 commit / push / tag / Release**
- 敏感信息扫描：源码中 4 处 `MUSIC_U=` 均为**登录判断与 token 拼接逻辑**，非真实凭据；无 `__csrf` 实值、无音源 API Key、无账号邮箱
- `build/`、`node_modules/`、`.npmrc`、开发脚本均已由 `.gitignore` 排除

### 19.10 上传 GitHub 前仍需注意
1. **`PROJECT_HANDOFF.md` 含本机绝对路径**（`<USER_HOME>\...`）：属开发记录。若不愿公开路径结构需先脱敏，接受则直接提交。
2. **`publish/version.json` 内容为原版 2.12.6 历史**，不是本项目版本元数据，勿误当作 1.1.0 版本信息。
3. **不上传**：`*.blockmap`、`latest.yml`、`builder-debug.yml`、`win-unpacked/`
4. **建议仅上传 3 个附件**：Setup.exe、portable.exe、SHA256SUMS.txt
5. **tag 建议**：`v1.1.0`（与 1.0.0 的 `v1.0.0` 风格一致）
6. **Release 正文**：直接使用 `RELEASE_NOTES-v1.1.0.md`

### 19.11 交给 Codex 的建议
1. 先核对 §19.5 的两个 SHA-256 与本地 `build/SHA256SUMS.txt` 是否一致
2. 决定 `PROJECT_HANDOFF.md` 是否脱敏后再提交
3. 按 `RELEASE_CHECKLIST_1.1.0.md` §9 的拆分建议提交（6 个 commit）
4. 打 tag `v1.1.0` 并创建 Release，正文用 `RELEASE_NOTES-v1.1.0.md`
5. 上传 3 个附件到 Release，**不要**上传 blockmap / latest.yml
6. 上传前再次确认 `publish/version.json` 未被误改