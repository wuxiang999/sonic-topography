#!/usr/bin/env bash
set -e

# Sonic Topography — 一键部署脚本
# 使用: bash deploy.sh
# 前置条件: git, node >=18, npm

echo "🚀 Sonic Topography 部署开始"

# 1. 拉取最新代码
echo "📦 拉取最新代码..."
git pull origin master

# 2. 安装依赖
echo "📦 安装依赖..."
npm install

# 3. 编译前端
echo "🔨 编译前端 (vite build)..."
npm run build

# 4. 验证编译产物
if [ ! -f dist/index.html ]; then
  echo "❌ 编译失败: dist/index.html 不存在"
  exit 1
fi
echo "✅ 编译成功: $(wc -c dist/index.html | awk '{print $1}') bytes"

# 5. 启动服务
echo "🌐 启动服务..."
echo ""
echo "┌──────────────────────────────────────────┐"
echo "│  Sonic Topography 已就绪                 │"
echo "│                                          │"
echo "│  访问地址: http://localhost:4173          │"
echo "│  端口可通过 PORT 环境变量修改             │"
echo "│                                          │"
echo "│  管理命令:                               │"
echo "│    npm start         启动服务             │"
echo "│    npm stop          停止服务             │"
echo "│    npm run build     重新编译             │"
echo "│                                          │"
echo "│  网易云 Cookie 配置:                     │"
echo "│    1. 环境变量: NETEASE_COOKIE           │"
echo "│    2. 文件: api/cookie.txt               │"
echo "└──────────────────────────────────────────┘"

# 可选: 使用 PM2 守护进程
if command -v pm2 &> /dev/null; then
  echo ""
  echo "🔄 检测到 PM2，建议使用: pm2 start local-server.mjs --name sonic-topography"
fi
