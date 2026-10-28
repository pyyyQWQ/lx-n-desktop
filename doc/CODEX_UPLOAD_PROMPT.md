# 给 Codex 的任务：提交、推送并发布 LX-N Desktop v1.2.0

> 本文件是为 Codex 准备的一次性工作说明。完成后请删除本文件，或把它移入 `doc/` 留档。

---

## 0. 一句话目标

把当前工作区的改动**按逻辑拆成若干提交**推送到 `pyyyQWQ/lx-n-desktop`，打 tag `v1.2.0`，
创建 GitHub Release，并上传**已打好的两个安装包**。

**打包已经完成，不需要你重新构建。** 产物在项目外的独立目录里。

---

## 1. 环境准备（每个新终端都要）

```powershell
$env:PATH = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
$N = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$P = 'C:\Users\PY\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
Set-Location 'C:\Users\PY\Desktop\LX-N-Desktop-NEW'
```

⚠️ **打包时的网络坑（已踩过，别再试第一种）**：
- 设 `HTTPS_PROXY=127.0.0.1:33210` → `ECONNREFUSED`
- 移除代理 → `unable to verify the first certificate`
- **可用方案**：`$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; $env:NO_PROXY='*'`

---

## 2. 产物位置（**不要重新打包**）

```
C:\Users\PY\Desktop\LX-N-Release-1.2.0\
├── lx-netease-music-desktop-v1.2.0-x64-Setup.exe      122,213,931 字节
├── lx-netease-music-desktop-v1.2.0-x64-portable.exe   110,540,066 字节
├── SHA256SUMS.txt
└── RELEASE_NOTES-v1.2.0.md
```

SHA-256（与 `SHA256SUMS.txt` 一致，已自校验）：
```
9F04C3EBDDEB80BD2A26DE7AAB59C1412E80A47C075BD0C239D87453B16AC552  Setup.exe
956064642B9290AC27678551F33717662404A3B303C1BCAC0B7C3F7E8F6A732D  portable.exe
```

🚨 **绝对不要运行 `pnpm build`**：它会执行 `del.sync(['dist/**','build/**'])`，
而安装包也输出到 `build/`。项目内 `build/` 里的副本可以丢，项目外那份不能动。

---

## 3. 当前 Git 状态

- 分支：`baseline-v1.0`
- 本地 HEAD：`d0f117e`（`docs: 交接文档新增「当前状态速览」入口`）
- **本地领先远端 4 个提交**（`43611c4`、`a42a4b0`、`849da9e`、`d0f117e` 均未推送）
- 远端 `baseline-v1.0` 分支头仍是 `a25f976`；远端 tag 只有 `v1.0.0`、`v1.1.0`
- **工作区有 40+ 个未提交改动**（本轮新功能 + 前几轮未打包的修复）

---

## 4. 提交拆分建议

按功能分组提交，便于回溯。可参考以下顺序（文件清单见 §5）：

1. `fix: 修复实机使用问题（定位/播放标识/添加到歌单）` —— 第 11 轮内容
2. `fix: 开发版使用独立数据目录 + 修复 dev 启动环境变量继承`
   - 含 `src/main/app.ts`、`build-config/runner-dev.js`
3. `feat: 多音质选择与自动回退（对齐移动改良版）`
   - 音质类型、constants、quality.ts、tools.ts 别名迁移、SDK 音质解析、i18n、列表徽标
4. `feat: 下载支持高音质（复用移动版音质详情接口）`
   - 两个 `qualityDetail.js`、`fillFullQuality`、DownloadModal 等
5. `fix: 修复下载弹窗 DataCloneError（响应式 Proxy 传入 Worker）`
   - `toRaw` 相关改动
6. `chore: 交接文档与发布材料`
   - `PROJECT_HANDOFF.md`、`RELEASE_NOTES-v1.2.0.md`、`PACK-PREP-CHECKLIST.md`

> 拆分粒度可自行判断，但**不要把所有改动塞进一个 commit**。

### 提交前必做检查

```powershell
& $N $P test          # 必须 209 断言全通过
& $N $P build         # 必须 4 目标全 success
```

> 注意：如果为了跑上面的 `build` 而重新构建，**先确认项目外那份产物还在**。
> 更保险的做法是：**提交前不要再跑 build**，因为产物已经验证过了。

---

## 5. 不要提交的东西

已被 `.gitignore` 忽略（无需手动处理，但请确认）：

- `build/`、`dist/`、`node_modules/`
- `启动开发版.bat`
- 各种 `.tmp-*.log`

**另外请确认不提交**：
- 任何含真实 Cookie / API Key / 密码的文件
- `src` 与 `tests` 里已扫描过，**无敏感实值**（已验证）

---

## 6. 需要上传的 Release 附件（**只 3 个**）

| 附件 | 来源 |
|---|---|
| `lx-netease-music-desktop-v1.2.0-x64-Setup.exe` | `LX-N-Release-1.2.0\` |
| `lx-netease-music-desktop-v1.2.0-x64-portable.exe` | `LX-N-Release-1.2.0\` |
| `SHA256SUMS.txt` | `LX-N-Release-1.2.0\` |

🚫 **不要上传**：`*.blockmap`、`latest.yml`、`builder-debug.yml`、`win-unpacked/`

---

## 7. 发布信息

- **tag**：`v1.2.0`（与 `v1.0.0`/`v1.1.0` 风格一致）
- **Release 标题**：`LX-N 网易云音乐桌面版 v1.2.0`
- **Release 正文**：直接使用 `RELEASE_NOTES-v1.2.0.md` 的完整内容
- **仓库**：`https://github.com/pyyyQWQ/lx-n-desktop`

---

## 8. 已验证 / 未验证（**发布说明里不要夸大**）

### 已实际验证通过
- `pnpm test`：209 断言
- `pnpm test:webdav`：传输 8/8 + 数据安全 24/24
- `pnpm build`：4 目标
- Setup 静默安装 exit 0 + 安装版启动（窗口 `LX-N Music`）
- 便携版启动 + `userData` 隔离
- exe 版本属性：`1.2.0` / `pyyyQWQ`
- `app.asar` 内含音质功能代码

### 未验证（**不要在 Release 里声称已验证**）
- 真实网易云账号端到端（发布环境无账号）
- 下载弹窗界面按钮渲染（需用户实机确认）
- kw/kg/mg 三平台的音质补全
- x86 / ARM64 / Windows 7/8
- 代码签名（未配置证书）

---

## 9. 已知限制（可写进 Release，属音源侧行为）

- 高音质依赖**自定义音源**；内置音源不提供 `hires`/`atmos`/`master`
- 部分音源对 `FLAC`/`Hires 无损24-Bit`/`臻品音质` 下发**同一文件**，切换听感无区别
- QQ 音乐详情接口返回业务错误 `10006`，其高音质档位来自搜索结果的 `size_new` 字段
- 批量下载按固定 7 档列出，个别歌曲会自动降级到可用档位

---

## 10. 铁律（务必遵守）

1. **禁止** `git reset --hard` / `git clean` / 强制切分支
2. **旧项目只读**：`C:\Users\PY\Desktop\LX-n-desktop\lx-netease-music-desktop` 绝对不要修改
3. 文档、日志、代码、commit message 中**不得出现真实 Cookie / 密码 / Token / API Key**
4. **不要重新引入** WebDAV 之外的旧未提交改动
5. 不要重复开发网易云登录（v1.0.0 已内置，从未改动）
6. 未实际执行的测试**不得声称通过**

---

## 11. 完成后

请在 `PROJECT_HANDOFF.md` 末尾追加一节「第 23 轮：v1.2.0 发布」，记录：
- 实际的提交列表（commit hash + message）
- tag 与 Release 的地址
- 上传了哪些附件
- 遇到的任何问题

然后把本文件（`CODEX_UPLOAD_PROMPT.md`）删除或移入 `doc/`。
