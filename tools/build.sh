#!/usr/bin/env bash
# 建立可公開發佈嘅 dist/（只包網站需要嘅檔案）
#
# 用法：./tools/build.sh
# Cloudflare Pages 設定：Build command = bash tools/build.sh ／ Output directory = dist
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf dist
mkdir -p dist

# 網站檔案（tests / tools / README / .htaccess 唔會公開）
for f in index.html practice.html sw.js version.json manifest.webmanifest favicon.svg; do
  cp "$f" dist/
done
cp -R css js tiles icons dist/

# Cloudflare Pages / Netlify 用嘅 cache 規則（入口檔唔可以 cache，否則更新唔到）
cat > dist/_headers <<'HEADERS'
/index.html
  Cache-Control: no-cache, must-revalidate

/practice.html
  Cache-Control: no-cache, must-revalidate

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/version.json
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache, must-revalidate

/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/tiles/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS

: > dist/.nojekyll  # GitHub Pages 用（唔會影響 Cloudflare）

echo "✅ dist/ 已建立：$(find dist -type f | wc -l | tr -d ' ') 個檔案、$(du -sh dist | cut -f1)"
