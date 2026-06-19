# Sonic Topography — Lanhu Plus 🎵🌊

> 基于 Sonic Topography 的增强版，3D 音乐可视化 + 完整网易云音乐播放器

## ✨ 新特性（Lanhu Plus）

- 🎵 **PHP API 代理** — 完整歌曲播放，无30秒预览限制
- 🎨 **智能风格分类** — 根据歌手/歌名/时长自动匹配视觉风格（摇滚、民谣、电子、氛围等）
- 🎬 **视频渲染模式** — 支持 headless Chrome 录制可视化视频（WebM + FFmpeg 合成音频）
- 🇨🇳 **全面汉化** — 中文界面、中文歌单名称
- 📱 **多端适配** — 手机/平板/桌面端自动匹配 UI 布局和画质
- 📊 **性能自适应** — 检测 CPU/GPU/内存自动调整画质（低/中/高三档）
- 📝 **歌词翻译** — 支持显示网易云歌词与翻译歌词
- 💾 **歌单持久化** — 本地 `data/playlists.json` 存储，重启不丢失
- 🎮 **内置 Demo** — 默认演示曲 `grey-track.mp3`

## 功能

- 3D 音频响应式地形可视化（Three.js + React Three Fiber）
- 内置 Demo 音频播放
- 支持上传音频文件和 `.lrc` 歌词
- 网易云音乐搜索、过滤不可播放结果
- 歌词加载与翻译歌词显示
- 歌单管理（收藏/视觉集）：新增、删除、排序
- 上一首 / 下一首、顺序播放 / 随机播放
- Windows 一键启动脚本

---

## 📱 多端适配

前端基于响应式设计，自动适配不同屏幕尺寸：

| 设备 | UI 布局 | 3D 画质 | 自动调整 |
|------|---------|---------|----------|
| 🖥️ 桌面端 | 全屏完整 UI | 高画质（抗锯齿、大网格） | 硬件检测自动降级 |
| 📱 手机端 | 精简移动端 UI | 低画质（小网格、降低粒子） | dpr 缩放优化 |
| 📟 平板端 | 中等 UI | 中等画质 | 自适应平衡 |

### 性能自适应系统

根据设备硬件信息自动分级：

- **CPU 核心数**（≥8 核心加分，≤4 核心降级）
- **Device Memory**（≥8GB 高分，≤4GB 降级）
- **GPU 型号**（低端 GPU 如 Mali、Adreno 5/6 自动降级）
- **用户代理检测**（移动端自动降级）

分三级：`high` / `medium` / `low`，分别控制：
- Canvas DPR
- 地形网格密度
- 流星数量
- 粒子数量
- 帧跳过策略
- 抗锯齿开关
- 功耗模式

---

## 🎵 音乐 API

本项目的后端依赖一个独立的网易云音乐 API 服务（PHP）。`Sonic Topography` 通过本地服务器代理与之通信。

### API 地址

默认：`http://localhost:8080/api/music.php`（可通过 `PHP_API_URL` 环境变量配置）

### 接口文档

基础地址：`https://your-domain.com/api/music.php`

**全部接口返回格式：**
```json
{
  "code": 200,
  "msg": "success",
  "data": { ... }
}
```

#### 1️⃣ 搜索歌曲

```
GET ?type=search&keywords={关键词}&limit={数量}&offset={偏移量}
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `keywords` | ✅ | — | 搜索关键词（歌手/歌名） |
| `limit` | ❌ | 10 | 返回数量，最大 100 |
| `offset` | ❌ | 0 | 分页偏移量 |

**示例：**
```
GET ?type=search&keywords=周杰伦&limit=5
```

**响应示例：**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "songs": [
      {
        "id": 1315196858,
        "name": "七里香",
        "artists": "周杰伦",
        "album": "七里香",
        "duration": 297000,
        "picUrl": "https://..."
      }
    ],
    "total": 100
  }
}
```

#### 2️⃣ 获取歌曲播放链接

```
GET ?type=url&id={歌曲ID}&level={音质}
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `id` | ✅ | — | 歌曲 ID（网易云） |
| `level` | ❌ | `standard` | 音质：`standard`/`exhigh`/`lossless`/`hires` |

**示例：**
```
GET ?type=url&id=1315196858&level=lossless
```

**响应示例：**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "data": [{
      "id": 1315196858,
      "url": "https://...",
      "br": 320000,
      "size": 12345678,
      "type": "mp3"
    }]
  }
}
```

#### 3️⃣ 获取歌曲详情

```
GET ?type=detail&id={歌曲ID}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 歌曲 ID |

#### 4️⃣ 获取歌词

```
GET ?type=lyric&id={歌曲ID}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 歌曲 ID |

**响应示例：**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "lrc": { "lyric": "[00:00.00] 七里香..." },
    "tlyric": { "lyric": "" }
  }
}
```

#### 5️⃣ 获取歌单

```
GET ?type=playlist&id={歌单ID}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 网易云歌单 ID |

#### 6️⃣ 获取专辑

```
GET ?type=album&id={专辑ID}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 网易云专辑 ID |

---

## 📦 安装与部署

### 前置条件

- [Node.js](https://nodejs.org/) v18+
- （推荐）npm v9+
- （可选）自建 PHP API 服务器（用于网易云音乐完整播放）
- （可选）FFmpeg（用于视频渲染音频合成）

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/wuxiang999/sonic-topography.git
cd sonic-topography

# 2. 安装依赖
npm install

# 3. 开发模式运行（热重载）
npm run dev
# -> 访问 http://localhost:3000

# 4. 生产构建并启动
npm run build
npm start
# -> 访问 http://localhost:4173
```

### Windows 用户

双击 `start-sonic-topography.bat`，自动完成：
1. 检测 Node.js 是否安装
2. 自动 `npm install` 安装依赖
3. 自动 `npm run build` 构建
4. 打开浏览器 `http://127.0.0.1:4173`
5. 启动本地服务器

### 配置 PHP API

项目需要后端 API 才能播放完整歌曲。部署 PHP API：

```bash
# 以 Nginx + PHP 为例，将 api/ 目录部署到你的服务器
# 然后在启动 Sonic Topography 时设置环境变量：
PHP_API_URL=https://your-domain.com/api/music.php npm start
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 生产服务器端口 | `4173` |
| `PHP_API_URL` | 音乐 API 代理地址 | `http://localhost:8080/api/music.php` |
| `RENDER_BASE_URL` | 视频渲染模式的基础 URL | `http://localhost:4173/music/` |
| `CHROME_PATH` | 视频渲染用的 Chrome 路径 | 自动检测 Puppeteer |
| `STATIC_AUDIO_PATH` | 静态音频文件路径 | `./static-audio/grey-track.mp3` |

---

## 🎬 视频渲染

可视化视频录制功能，将 3D 音乐可视化录制成 WebM 视频（可合成音频）。

```bash
cd scripts
npm install
node render-video.mjs [时长秒数] [输出路径]
```

默认录制 30 秒，输出到 `./render-output.webm`。

需要安装：
- Puppeteer（Chrome 浏览器自动化）
- FFmpeg（音频合成）

---

## 项目结构

```
sonic-topography/
├── src/                    # React 前端源码
│   ├── components/         # UI + 3D 可视化组件
│   │   ├── AudioVisualizer/  # 3D 地形可视化（Three.js）
│   │   └── UI/               # 播放器 UI（搜索、歌词、歌单）
│   ├── lib/
│   │   ├── AudioEngine.ts    # 音频引擎（Web Audio API）
│   │   ├── performance.ts    # 设备性能检测系统
│   │   ├── themes.ts         # 主题色彩系统
│   │   ├── lyrics.ts         # 歌词解析
│   │   └── metadata.ts       # 音乐元数据处理
│   ├── App.tsx               # 主应用组件（响应式 + 渲染模式）
│   └── main.tsx              # 入口文件
├── scripts/                 # 工具脚本
│   └── render-video.mjs     # 视频渲染脚本（Puppeteer）
├── public/                  # 静态资源
├── static-audio/            # 内置演示音频
├── data/                    # 运行时数据（歌单等，不提交 Git）
├── local-server.mjs         # 生产服务器（Express + API 代理）
├── vite.config.ts           # Vite 构建配置
└── start-sonic-topography.bat  # Windows 一键启动
```

---

## 注意事项

- 🎵 网易云音乐功能使用的是非官方网页接口，通过本地服务器代理请求
- ⚠️ 可播放状态可能因版权、会员、地区或登录限制发生变化
- 📁 `data/` 目录下的歌单文件是本地数据，**不要提交到 Git**
- 🌐 前端播放器默认 `base: "/music/"`，如需修改请在 `vite.config.ts` 中更改
- 🔊 视频渲染模式需要 Chrome/Chromium 和 FFmpeg 环境

## License

MIT
