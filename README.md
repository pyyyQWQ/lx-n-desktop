# LX-N 网易云音乐桌面版

LX-N 是 **LX Music 桌面版** 的独立 Windows 衍生构建，重点补充网易云音乐账号网页登录、用户歌单与歌曲喜欢/取消喜欢等能力。

当前正式版本：**1.2.0**（Windows x64，Electron 42.11.6）。

> 本项目仍是独立构建，不是 LX Music 官方的统一版本，也不代表上游项目的发布承诺。安装包目前未做代码签名，请从你信任的发布页下载并核对 SHA-256。

发布页：<https://github.com/pyyyQWQ/lx-n-desktop/releases>

## 下载与安装

正式版提供两个 Windows x64 产物：

| 文件 | 用途 |
| --- | --- |
| `lx-netease-music-desktop-v1.0.0-x64-Setup.exe` | 常规安装版，创建开始菜单和桌面快捷方式，可在“应用和功能”中卸载 |
| `lx-netease-music-desktop-v1.0.0-x64-portable.exe` | 单文件便携版，无需安装，适合放在可写的独立目录中使用 |

校验值见发布目录中的 `SHA256SUMS.txt` 或对应 Release 说明。

### 安装版

1. 双击 `Setup.exe`。
2. 阅读并接受许可协议，选择安装目录。
3. 安装完成后从开始菜单或桌面快捷方式启动 `LX-N Music`。
4. 普通用户无需安装 Node.js、pnpm，也无需执行 `pnpm dev`。

由于当前安装包未签名，Windows SmartScreen 可能显示“未知发布者”。在确认文件来源和 SHA-256 正确后，才应继续运行。

### 便携版

直接双击 `lx-netease-music-desktop-v1.0.0-x64-portable.exe`。程序会把运行文件解压到系统临时目录，但**用户数据保存在便携版 exe 同目录的 `userData` 文件夹**。因此：

- 便携版所在目录必须可写；
- 不建议把便携版直接放进 `Program Files`；
- 移动应用时，应同时移动 `userData` 文件夹；
- 不要在程序运行时删除 `userData`。

## 首次启动与网易云登录

1. 首次启动会出现许可协议，阅读后点击“接受”。
2. 打开“设置” → “网易云账号”。
3. 点击“网页登录”，在打开的网易云官方页面完成登录。
4. 登录成功后，可从左侧“我的网易云歌单”进入用户歌单。
5. 歌曲右键菜单提供“喜欢/取消喜欢”等操作。

网页登录只打开网易云官方登录页，应用不会直接收集账号密码。登录会话 Cookie 按现有设计保存在本地数据目录中，**属于敏感数据，请勿分享、截图或上传数据目录**。

如果已有有效的 Cookie，也可在设置中手动填写并使用“验证并保存”。

## 主要功能

- 独立桌面构建与独立数据目录，不与原版 LX Music 混用数据目录
- 网易云网页登录、登录状态恢复与用户歌单
- 我的网易云歌单刷新、歌曲播放
- 歌曲喜欢/取消喜欢
- 保留 LX Music 既有播放、列表、搜索、歌词、主题和设置能力
- 便携版数据跟随程序目录


## 数据存储位置

| 运行方式 | 用户数据目录 |
| --- | --- |
| 安装版（默认） | `%APPDATA%\lx-netease-music-desktop` |
| 便携版 | `<便携版 exe 所在目录>\userData` |
| 安装版且安装目录存在 `portable` 子文件夹 | `<安装目录>\portable\userData` |

数据库、设置和登录状态位于上述目录的 `LxDatas` 子目录中，例如：

- `config_v2.json`：应用设置；现有设计中网易云 Cookie 会保存在本地
- `lx.data.db`：本地数据库
- `user_api.json`、`hot_key.json` 等：其他本地配置



## 从源码构建

要求：

- Node.js 22 或更高版本
- pnpm 11 或兼容版本
- Windows x64 构建环境

常用命令：

```powershell
pnpm install
pnpm test
pnpm run build
pnpm run pack:win:setup:x64
pnpm run pack:win:portable:x64
```

构建产物位于 `build/`。生产打包使用项目已有 Electron Builder 配置；`npmRebuild: false` 表示复用仓库中已准备好的原生依赖，发布机无需安装 Visual Studio。若要更换 Electron/Node ABI 或架构，应重新准备对应的 `better-sqlite3`、`bufferutil`、`utf-8-validate` 等原生模块。

## 验证说明

本版本发布准备中实际执行并通过：

- 自动化测试：52/52 断言
- 主进程、渲染器、桌面歌词、渲染器脚本四套生产编译
- NSIS x64 安装包构建与静默安装
- 安装版启动、主界面、未登录歌单页、官方网页登录页打开
- 便携版启动、便携数据目录落盘
- 设置修改后重启保留




## 许可证与来源

本项目基于 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop) 的源码继续开发，遵循 [Apache License 2.0](LICENSE)。上游版权归原作者及贡献者所有；LX-N 的衍生修改由本发布版本的维护者负责。

项目内字体、图片、音频滤镜及其他第三方资源的许可证与归属信息见 `licenses/` 及对应源文件。使用本项目时请同时遵守上游项目协议与所在地法律法规，尊重音乐版权。
