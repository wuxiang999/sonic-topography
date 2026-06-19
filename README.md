# Sonic Topography — Lanhu Plus 🎵🌊

> 基于 Sonic Topography 的增强版，3D 音乐可视化 + 完整网易云音乐播放器

## ✨ 新特性（Lanhu Plus）

- 🎵 **PHP API 代理** — 完整歌曲播放，无30秒预览限制（需自建 `music.php` API）
- 🎨 **智能风格分类** — 根据歌手/歌名/时长自动匹配视觉风格（摇滚、民谣、电子、氛围等）
- 🎬 **视频渲染模式** — 支持 headless Chrome 录制可视化视频（WebM + FFmpeg 合成音频）
- 🇨🇳 **全面汉化** — 中文界面、中文歌单名称
- 📊 **性能自适应** — 检测设备性能自动调整画质（低/中/高三档）
- 📝 **歌词翻译** — 支持显示网易云翻译歌词
- 💾 **歌单持久化** — 本地 `data/playlists.json` 存储，重启不丢失
- 🎮 **自定义 Demo** — 内置 `grey-track.mp3` 演示曲

## 功能

- 3D 音频响应式地形可视化（Three.js + React Three Fiber）
- 内置 Demo 音频播放
- 支持上传音频文件和 `.lrc` 歌词
- 网易云音乐搜索、过滤不可播放结果
- 歌词加载、翻译歌词显示
- 歌单管理（收藏/视觉集）、新增/删除/排序
- 上一首/下一首、顺序播放/随机播放
- Windows 一键启动脚本

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) (v18+)
- （可选）自建 PHP API 代理，用于完整歌曲播放

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/wuxiang999/sonic-topography.git
cd sonic-topography

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

打开浏览器访问 `http://localhost:4173`（生产）或 `http://localhost:3000`（开发）。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 生产服务器端口 | `4173` |
| `PHP_API_URL` | 音乐 API 代理地址 | `http://localhost:8080/api/music.php` |
| `RENDER_BASE_URL` | 视频渲染模式的基础 URL | `http://localhost:4173/music/` |
| `CHROME_PATH` | 视频渲染用的 Chrome 路径 | 自动检测 |

### Windows 一键启动

双击 `start-sonic-topography.bat`，自动安装依赖、构建、启动服务。

## 视频渲染

```bash
cd scripts
npm install
node render-video.mjs [时长秒数] [输出路径]
```

需要安装 Puppeteer 和 FFmpeg。

## 项目结构

```
sonic-topography/
├── src/              # React 前端源码
│   ├── components/   # UI 组件 + 3D 可视化
│   ├── lib/          # 工具库（AudioEngine、主题、性能检测等）
│   ├── App.tsx       # 主应用组件
│   └── main.tsx      # 入口
├── scripts/          # 工具脚本（视频渲染等）
├── static-audio/     # 内置音频文件
├── data/             # 运行时数据（歌单等，不提交）
├── local-server.mjs  # 生产服务器（含 API 代理）
└── vite.config.ts    # Vite 配置
```

## 注意事项

- 网易云音乐功能使用的是非官方网页接口，通过本地服务器代理请求
- 可播放状态可能因版权、会员、地区或登录限制发生变化
- `data/` 目录下的歌单文件是本地数据，**不要提交到 Git**

## License

MIT
