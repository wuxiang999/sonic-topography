# Sonic Topography — Lanhu Plus

> 3D 音乐可视化播放器 · 网易云音乐增强版 · 全平台自适应

基于 Sonic Topography 深度改造，集成网易云音乐完整播放、3D 频谱可视化、多端适配、系统音频捕获，打造沉浸式听歌体验。

## 核心特性

- 🎵 **完整网易云播放** — 搜索、歌单、歌词、播放，无需 30 秒预览，无额外服务部署
- 🌊 **3D 音频响应地形** — Three.js + React Three Fiber 实时可视化，多场景切换
- 🔊 **系统音频捕获** — 捕获任意系统输出音频驱动动画（Spotify / YouTube / 本地播放器）
- 🎤 **三式歌词显示** — 3D 透视滚动 / 居中简洁 / 逐字 Karaoke 高亮，支持切换
- 🎨 **主题随歌自适应** — 智能风格分类（摇滚 / 民谣 / 电子 / 氛围 / 流行），色彩实时渐变
- ⚙️ **画质三档可调** — 低/中/高（影响分辨率 / 地形精细度 / 粒子数量）
- 🔲 **抗锯齿可调** — 自动 / 强制开启 / 强制关闭
- 🕶️ **无 UI 模式** — 按 `U` 键一键隐藏全部界面（含 Logo），专注 3D 场景
- 📊 **频段数值显隐** — 贝斯 / 中段 / 高音 / 能源 实时读数，设置中可隐藏
- 📱 **全端适配** — 桌面 / 平板 / 手机自动匹配 UI 布局与交互方式
- ⚡ **性能自适应** — CPU / GPU / 内存检测自动降级（高 / 中 / 低三档）
- 🎬 **视频渲染模式** — headless Chrome 录制可视化视频（WebM + 音频合成）
- 🔄 **歌曲平滑切换** — 渐入淡出（~1.2s）过渡，切换无突兀
- 💾 **播放记录与歌单** — 本地持久化存储，重启不丢失

## 界面预览

```
┌─────────────────────────────────────────────────────────┐
│  侧边栏（悬停）    │         3D 地形可视化               │
│  ─────────────     │                                     │
│  搜索              │     + 播放卡片（右下角毛玻璃）       │
│  播放列表          │     + 歌词显示（三样式）            │
│  播放历史          │     + 频段数值（可隐藏）            │
│  频率触发          │     + 水印（可点击隐藏）            │
│  ─────────────     │                                     │
│  示例 · 上传       │     U 键 → 无 UI 模式              │
│  系统音频(捕获)    │                                     │
│  ─────────────     │                                     │
│  设置 → 弹出面板   │                                     │
└─────────────────────────────────────────────────────────┘
```

## 安装与部署

### 前置条件

- [Node.js](https://nodejs.org/) v18+
- npm v9+

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/wuxiang999/sonic-topography.git
cd sonic-topography

# 2. 安装依赖
npm install

# 3. 开发模式（热重载）
npm run dev
# → 访问 http://localhost:3000

# 4. 生产构建并启动
npm run build
npm start
# → 访问 http://localhost:4173
```

### 一键启动（Windows）

双击 `start-sonic-topography.bat`，自动完成依赖安装、构建、启动。

## 配置

### 网易云 Cookie（可选，获取完整歌曲）

**无 Cookie**：搜索、歌词正常可用。
**有 Cookie**：可获取完整歌曲播放链接（无需 30 秒预览）。

```bash
# 方式一：环境变量（推荐）
NETEASE_COOKIE="MUSIC_U=xxx; JSESSIONID-WYYY=xxx" npm start

# 方式二：api/cookie.txt 文件
echo "MUSIC_U=xxx; JSESSIONID-WYYY=xxx" > api/cookie.txt
npm start
```

**获取 Cookie 步骤**：
1. 浏览器打开 https://music.163.com 并登录
2. F12 → Application → Cookies → https://music.163.com
3. 全选 Cookie 列表复制（每条以 `;` 分隔）
4. 粘贴到 `api/cookie.txt`，重启服务

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NETEASE_COOKIE` | 网易云 Cookie | 无 |
| `PORT` | 生产端口 | `4173` |
| `RENDER_BASE_URL` | 渲染模式基础 URL | `http://localhost:4173/music/` |
| `CHROME_PATH` | Chrome 路径（渲染用） | 自动检测 |
| `STATIC_AUDIO_PATH` | 内置演示音频 | `./static-audio/grey-track.mp3` |

## 快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 播放 / 暂停 |
| `←` / `→` | 后退 / 快进 5 秒 |
| `↑` / `↓` | 音量增减 |
| `F` | 全屏 / 退出全屏 |
| `M` | 静音 / 取消静音 |
| `U` | 隐藏 / 显示全部 UI（无 UI 模式） |
| `H` / `?` | 显示 / 隐藏快捷键帮助 |

## 侧边栏功能

悬停屏幕左侧边缘展开，分三类：

| 类别 | 入口 | 说明 |
|------|------|------|
| **功能** | 搜索 | 网易云搜索歌曲、过滤不可播放 |
| | 播放列表 | 管理收藏 / 视觉集歌单 |
| | 播放历史 | 最近播放记录（可设保留条数） |
| | 频率触发 | 频段触发脉冲 / 流星特效 |
| **工具** | 示例 | 加载内置演示曲目 |
| | 上传 | 上传本地音频 / .lrc 歌词 |
| | 系统音频 | 捕获系统输出音频驱动动画 |
| **设置** | 设置 → 面板 | 频段数值 / 画质 / 抗锯齿 / 歌词 / 记录 |

移动端点击右下角圆形 FAB 按钮展开同样功能菜单。

## 设置面板

点击侧边栏「设置」（移动端 FAB 菜单 → 设置）弹出面板：

| 分类 | 选项 | 说明 |
|------|------|------|
| **频段数值** | 显示 / 隐藏 | 贝斯 · 中段 · 高音 · 能源 四列读数 |
| **画质 & 抗锯齿** | 渲染质量 | 低 / 中 / 高（同档位再击返回自动检测） |
| | 抗锯齿 (AA) | 自动 / 开 / 关 |
| **无 UI 模式** | 隐藏全部 | 一键隐藏所有界面含 Logo（快捷键 `U`） |
| **歌词设置** | 显示歌词 | 开 / 关 |
| | 歌词样式 | 滚动（3D 透视）/ 居中简洁 / 逐字高亮 |
| **播放记录** | 保留条数 | 10–100（步长 10） |

## 视频渲染（高级）

录制可视化视频，自动合成音频：

```bash
cd scripts
npm install
node render-video.mjs [时长秒数] [输出路径]
```

需安装 Puppeteer + FFmpeg。

## 项目结构

```
sonic-topography/
├── src/
│   ├── components/
│   │   ├── AudioVisualizer/     # 3D 地形可视化（Three.js）
│   │   └── UI/                  # 播放器 UI 组件
│   │       ├── UI.tsx            # 主 UI（侧边栏 / 布局 / 状态）
│   │       ├── DesktopPlayerPanel.tsx  # 桌面播放卡片（毛玻璃）
│   │       ├── LyricsDisplay.tsx       # 三式歌词显示
│   │       ├── SettingsPanel.tsx       # 设置面板（画质/AA/频段/歌词/记录）
│   │       ├── FirstTimeTutorial.tsx   # 首次引导（桌面/移动端双版）
│   │       ├── KeyboardShortcutsHelp.tsx # 快捷键帮助
│   │       └── PlayHistory.tsx         # 播放历史
│   ├── lib/
│   │   ├── AudioEngine.ts       # 音频引擎（Web Audio API + 渐入淡出）
│   │   ├── themes.ts            # 主题色彩系统（随歌自适应）
│   │   ├── lyrics.ts            # LRC 歌词解析
│   │   ├── metadata.ts          # 音频元数据提取
│   │   └── performance.ts       # 设备性能检测
│   ├── App.tsx                  # 主应用（Canvas + 用户画质/AA 覆盖）
│   └── main.tsx                 # 入口
├── api/                        # 网易云 Cookie（可选，不提交）
├── scripts/                    # 视频渲染脚本
├── static-audio/               # 内置演示曲目
├── local-server.mjs            # Express 服务器 + 网易云 API
├── vite.config.ts              # Vite 构建配置
└── start-sonic-topography.bat  # Windows 一键启动
```

## API

所有接口通过本地服务器提供（默认 `http://localhost:4173`）。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/netease/search?keywords=xxx` | GET | 搜索歌曲（自动风格分类） |
| `/api/netease/lyric?id=xxx` | GET | 获取歌词 + 翻译 |
| `/api/netease/url?id=xxx` | GET | 获取播放链接 |
| `/api/netease/audio?id=xxx` | GET | 音频代理（防跨域） |
| `/api/netease/toplist` | GET | 热歌榜 |
| `/api/netease/playlist?id=xxx` | GET | 歌单详情 |

## 注意事项

- 网易云接口非官方，通过本地服务器代理请求
- 可播放状态因版权 / 会员 / 地区而异
- `data/` 目录运行时数据**不要提交 Git**
- 前端默认 `base: "/music/"`，需 nginx 反代配置

## License

MIT
