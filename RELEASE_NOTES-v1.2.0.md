# LX-N 网易云音乐桌面版 v1.2.0

发布日期：2026-10-28
平台：Windows x64
版本：1.2.0（上一正式版：1.1.0）

本次为 LX-N Desktop 的第三个 Windows 正式构建。相对 1.1.0，本版整合了此前已修复但未发布的实机问题修复与开发版数据目录隔离，并新增「多音质选择」「音质自动回退」「下载高音质」三项能力。二进制仍未做代码签名。

## 下载文件

| 文件 | 大小 |
| --- | ---: |
| `lx-netease-music-desktop-v1.2.0-x64-Setup.exe` | 122,213,931 字节（116.55 MiB） |
| `lx-netease-music-desktop-v1.2.0-x64-portable.exe` | 110,540,066 字节（105.42 MiB） |

校验值以随附的 `SHA256SUMS.txt` 为准：

```
9F04C3EBDDEB80BD2A26DE7AAB59C1412E80A47C075BD0C239D87453B16AC552  lx-netease-music-desktop-v1.2.0-x64-Setup.exe
956064642B9290AC27678551F33717662404A3B303C1BCAC0B7C3F7E8F6A732D  lx-netease-music-desktop-v1.2.0-x64-portable.exe
```

安装版适合普通安装使用；便携版无需安装，用户数据保存在便携 exe 同目录的 `userData` 中，所在目录必须可写。

## 相对 1.1.0 的新增内容

### 多音质选择（7 档）

设置 → 播放 →「优先播放的音质（如果可用）」由 4 项扩展为 7 项：

`128K` / `320K` / `FLAC` / `Hires 无损24-Bit` / `臻品音质` / `臻品音质 2.0` / `臻品母带`

- 已与移动改良版（lx-netease-music-mobile）的音质标识体系完全对齐
- 原 `flac24bit` 标识统一归并为 `hires`，不再出现多档指向同一文件的情况
- 自定义音源脚本里声明的 `hires` / `atmos` / `atmos_plus` / `master` 均可正常使用
- 歌曲列表新增「臻品」徽标；下载窗口可选用新音质
- 四语言（简体 / 繁体 / 英文 / 韩文）文案已补齐

### 音质自动回退

选了最高音质但当前歌曲没有时，按优先级自动向下回退，取能拿到的最好音质：

```
臻品母带 → 臻品音质2.0 → 臻品音质 → Hires 无损24-Bit → FLAC → 320K → 128K
```

判定依据为歌曲自身的可用音质信息，不会对只有 128K 版权的歌曲错误地请求母带。

### 下载支持高音质

下载弹窗打开时会自动补齐该曲的完整音质列表，并显示**真实文件大小**：

- 网易云：额外请求官方音质详情接口，可拿到 `atmos` / `master` 等档位
- QQ 音乐：在搜索环节直接解析 `size_new`，无需额外请求
- 参考实测：《晴天》在网易云可下载 `master` 175.79 MiB、`atmos` 99.48 MiB；
  在 QQ 音乐可下载 `master` 178.32 MiB、`atmos_plus` 76.71 MiB

### 此前已修复但 1.1.0 未包含的问题

- **添加到歌单报错**：每日推荐右键「添加到歌单」报 `An object could not be cloned` 已修复
- **正在播放标识**：新增页面补齐「正在播放」三角标识与序号列样式
- **定位功能**：修复封面右键「回不到来源页」、播放详情页右击封面无定位、定位只滚到页面顶部、排行榜定位报错等问题
- **开发版数据目录隔离**：开发调试不再污染正式版的设置与数据（开发版使用 `-dev` 后缀目录）

## 构建与验证结果

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 自动化测试 | 通过 | 209 断言通过（domain 28 / cookie 11 / accountLogic 13 / updateFeed 14 / dailyRec 16 / quality 44 / webdav 82 等） |
| WebDAV 传输层与数据安全 | 通过 | 传输 8/8 + 数据安全 24/24 |
| 生产编译 | 通过 | main、renderer、renderer-lyric、renderer-scripts 全部成功 |
| NSIS 安装包 | 通过 | exit 0，产物 122.2 MB |
| 便携版 | 通过 | exit 0，产物 110.5 MB |
| exe 版本信息 | 通过 | Setup 与 portable 的 `FileVersion` / `ProductVersion` 均为 **1.2.0**，`CompanyName` 为 pyyyQWQ，`LegalCopyright` 为 `Copyright © 2026 pyyyQWQ` |
| 静默安装 | 通过 | `Setup.exe /S /D=<隔离目录>` → exit 0，安装目录生成主程序与卸载程序 |
| 安装版启动 | 通过 | 从安装目录启动，窗口标题 `LX-N Music`，8 个进程，响应正常 |
| 便携版启动 | 通过 | 独立目录中启动，窗口标题 `LX-N Music` |
| 便携数据隔离 | 通过 | 在便携 exe 同目录创建 `userData\LxDatas`，未写入 `%APPDATA%` |
| 打包内容校验 | 通过 | `app.asar` 内确认含音质详情接口、`master`/`atmos_plus` 档位、Hires 文案等 |
| 真实账号端到端 | 未验证 | 发布环境无可用测试账号 |
| 下载弹窗界面渲染 | 未验证 | 补齐逻辑已实测通过，但界面按钮渲染需用户实机确认 |
| 跨平台音质（kw/kg/mg） | 未验证 | 仅验证了网易云与 QQ 音乐两个平台 |
| x86 / ARM64 / Windows 7/8 | 未验证 | 本次仅构建和测试 Windows x64 |
| 代码签名 | 未做 | 未配置证书，可能出现 SmartScreen「未知发布者」 |

构建成功和静态检查不等同于真实账号功能已验证。本说明不会把未执行的项目报告为通过。

## 音质功能的已知限制

- **高音质依赖自定义音源**：内置音源不提供 `hires` / `atmos` / `master`，不接自定义音源时这些档位会回退到内置音源能提供的最高档
- **音源决定实际上限**：部分音源在部分平台只声明到 `hires`，此时选母带会回退
- **重复档位属音源行为**：实测某些音源对 `FLAC` / `Hires 无损24-Bit` / `臻品音质` 返回同一文件，听感不会有区别
- **QQ 音乐依赖搜索结果**：其详情接口当前返回业务错误（10006），因此高音质档位来自搜索结果的 `size_new` 字段；个别歌曲若搜索结果不含该字段，则拿不到高音质档
- **批量下载**按固定 7 档列出，个别歌曲点选后会自动降级到该曲可用档位

## 安装与首次启动

1. 运行 `Setup.exe`，接受许可协议并选择安装目录。
2. 从开始菜单或桌面快捷方式启动 `LX-N Music`。
3. 首次启动接受软件许可协议。
4. 打开「设置」→「网易云账号」→「网页登录」，在官方页面登录。
5. 登录后进入「我的网易云歌单」或「每日推荐」。

便携版直接双击 exe。不要放在 `Program Files` 等不可写目录；升级或迁移时请同时保留 `userData`。

## 从 1.1.0 升级

安装版直接覆盖安装即可，`%APPDATA%\lx-netease-music-desktop\LxDatas` 中的列表、设置与登录态会被保留。卸载程序不会自动删除该目录，需要时请手动清理。

便携版请用新的 exe 替换旧的 exe，并保留同目录的 `userData` 文件夹。

> 开发版的 `-dev` 数据目录独立，与正式版互不影响。

## 数据位置

- 安装版默认：`%APPDATA%\lx-netease-music-desktop\LxDatas`
- 开发版：`%APPDATA%\lx-netease-music-desktop-dev\LxDatas`
- 便携版：`<便携 exe 目录>\userData\LxDatas`
- 安装目录含 `portable` 子文件夹时：`<安装目录>\portable\userData\LxDatas`

数据库、设置和网易云 Cookie 均属于本地隐私数据。Cookie 按现有实现可能为明文保存，请勿上传数据目录或包含账号信息的截图。

## 已知问题与限制

- 安装包和便携版未签名，可能出现 SmartScreen「未知发布者」提示。
- 仅提供 Windows x64；不承诺 Windows 7/8、x86 或 ARM64。
- 自动更新检查已关闭，需手动下载后续版本。
- WebDAV 同步仅覆盖歌单；设置与自定义音源不同步。
- WebDAV 同步为「整体覆盖」语义，不做逐条合并；覆盖前有确认弹窗。
- 启动偶发 `operation ... aborted` 属原版既有的请求取消竞态，不影响功能。
- 源码与下载页：<https://github.com/pyyyQWQ/lx-n-desktop>

## 安全说明

请仅从你控制的发布页下载。下载后使用 `SHA256SUMS.txt` 核对文件。安装包与便携版不包含开发机的用户数据、Cookie、数据库或凭据。

## 许可证

本项目遵循 Apache License 2.0，基于 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop)。上游版权归原作者（落雪无痕 / lyswhut）及贡献者所有；LX-N 衍生修改由维护者 **pyyyQWQ** 负责。
