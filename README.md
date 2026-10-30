# 塞壬唱片 音乐下载器 · Monster Siren Music Downloader

> 在[塞壬唱片官网](https://monster-siren.hypergryph.com/)一键下载当前歌曲原音质的**用户脚本**。
> 一套代码，Chrome / Edge / Firefox / Safari 全平台可用。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](monster-siren-downloader.user.js)
[![Userscript](https://img.shields.io/badge/userscript-Tampermonkey%20%7C%20Violentmonkey-orange.svg)](monster-siren-downloader.user.js)

---

## ✨ 功能特性

- **一键下载**：页面右侧出现悬浮「下载」按钮，点击即保存当前歌曲。
- **自动识别曲目**：三级识别策略 ——「正在播放的媒体元素」→「页面 URL 中的歌曲 ID」→「播放器标题匹配」。
- **绕过跨域限制**：使用 `GM_xmlhttpRequest` 请求音频，即使 CDN 未开放 CORS 也能正常下载。
- **原音质下载**：直接读取官方接口返回的 `sourceUrl`，不经过二次转码。
- **文件名规范化**：自动清理 Windows / macOS 非法字符，命名为「歌曲名.扩展名」（扩展名跟随官方音频格式）。
- **轻量无依赖**：单文件脚本，无后端、无数据库、无追踪。

## 📦 安装

### 前置：安装一个用户脚本管理器

| 浏览器 | 推荐管理器 | 下载地址 |
| --- | --- | --- |
| Chrome | Tampermonkey | [Chrome 应用商店](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | Tampermonkey | [Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadafooahdfbaleijojkfpic) |
| Firefox | Tampermonkey / Violentmonkey | [Firefox 附加组件](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Safari | Userscripts（App Store 免费） | [App Store](https://apps.apple.com/app/userscripts/id1463298887) |
| 全平台 | Violentmonkey | [violentmonkey.github.io](https://violentmonkey.github.io/get-it/) |

### 方式一：一键安装（推荐）

安装好管理器的浏览器直接打开下面的链接，脚本管理器会自动弹出安装页，点「安装」即可：

```
https://raw.githubusercontent.com/<你的GitHub用户名>/monster-siren-downloader/main/monster-siren-downloader.user.js
```

> 把 `<你的GitHub用户名>` 替换成你自己的 GitHub 用户名。

### 方式二：手动安装

1. 打开脚本管理器面板 → 「添加新脚本」。
2. 打开本仓库的 [`monster-siren-downloader.user.js`](monster-siren-downloader.user.js)，全选复制。
3. 粘贴覆盖编辑器中默认内容，`Ctrl + S` 保存。

### 方式三：GreasyFork 安装（便于被更多人发现）

把本仓库发布到 [GreasyFork](https://greasyfork.org/) 后，用户可直接在脚本页点击「安装此脚本」。

## 🚀 使用方法

1. 打开 [塞壬唱片官网](https://monster-siren.hypergryph.com/)。
2. 进入任意歌曲详情页（地址形如 `/music/xxxx`），或直接在首页播放一首歌。
3. 点击页面右侧的悬浮「下载」按钮，等待提示「已开始下载」即可在浏览器下载目录找到文件。

按钮位置、文案可在脚本顶部的 `CONFIG` 中自定义：

```js
const CONFIG = {
  buttonText: "下载",
  buttonSide: "right", // "right" | "left"
  buttonTop: "40%",
};
```

## 🧠 工作原理

```
点击按钮
   │
   ├─ 1. 捕获页面 <audio>/<video>，找出未暂停的媒体元素 → 直接取其 currentSrc
   │
   ├─ 2. 无播放中的媒体 → 从 location.pathname 提取 /music/{cid}
   │      → 请求 GET /api/song/{cid} → 取 data.sourceUrl
   │
   └─ 3. 兜底 → 请求 GET /api/songs 建立「歌名 → cid」索引
          → 扫描播放器区域文本，匹配到歌名后回到步骤 2
                     │
                     └─ GM_xmlhttpRequest 下载音频为 Blob → a[download] 触发保存
```

## ❓ 常见问题

**Q：点击按钮提示「未识别到当前歌曲」？**
请先进入歌曲详情页（`/music/xxx`），或先点击播放再运行脚本。

**Q：提示「音频返回 HTTP 403/404」？**
官方接口或 CDN 地址可能已变更。请在 Issues 里附上歌曲页面链接，我会跟进修复。

**Q：为什么不用网页自带的下载？**
官网不提供下载入口，本脚本只是把官方接口返回的音频地址交给浏览器的下载能力。

**Q：会被封号吗？**
脚本仅在本地读取公开接口、以单次请求下载单个文件，不进行批量爬取。但**请勿高频批量下载**，避免给官方服务器造成压力。

## ⚠️ 免责声明

- 本项目仅供**个人学习、技术研究与本地备份**使用。
- 建议仅下载你已经通过官方渠道购买 / 授权的音乐。
- **所有音乐版权归上海鹰角网络科技有限公司（Hypergryph）及塞壬唱片所有**，请勿将下载内容用于任何商业用途或二次分发。
- 使用本脚本产生的任何后果由使用者自行承担。如有侵权，请联系删除。

## 📄 许可证

[MIT](LICENSE) © 2026 Junxi-cs

## 🔗 相关链接

- 塞壬唱片官网：<https://monster-siren.hypergryph.com/>
- 问题反馈：<https://github.com/Junxi-cs/monster-siren-downloader/issues>
