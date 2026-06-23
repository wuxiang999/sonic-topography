#!/usr/bin/env bash
set -e

echo "=== 1. 安装依赖 ==="
npm install

echo "=== 2. 构建前端 ==="
npm run build

echo "=== 3. 创建数据目录 ==="
mkdir -p data

echo ""
echo "✅ 构建完成!"
echo ""
echo "启动方式:"
echo "  npm start              # 前台运行"
echo "  PORT=8080 npm start    # 自定义端口 (默认 4173)"
echo ""
echo "后台运行:"
echo "  nohup npm start > server.log 2>&1 &"
echo ""
echo "访问地址:"
echo "  http://localhost:4173"
