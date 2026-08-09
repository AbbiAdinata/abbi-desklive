#!/bin/bash
# ============================================================
# ABBI DeskLive — Deploy Script
# Build frontend lalu sync ke folder yang benar-benar di-serve Nginx
# ============================================================
set -e

echo "🔨 Building frontend..."
cd ~/abbi-desklive
npm run build

echo "📦 Syncing build ke /var/www/abbi-desklive/dist..."
sudo cp -rv ~/abbi-desklive/dist/. /var/www/abbi-desklive/dist/

echo "🔐 Fixing permissions..."
sudo chown -R www-data:www-data /var/www/abbi-desklive/dist
sudo chmod -R 755 /var/www/abbi-desklive/dist

echo "🔄 Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Verifikasi:"
curl -s http://103.31.38.154 | grep -o 'index-[a-zA-Z0-9]*\.js'

echo "✅ Deploy selesai."
