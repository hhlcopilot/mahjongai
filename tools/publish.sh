#!/usr/bin/env bash
# 一鍵發佈：測試 → 部署 NAS → 部署 Cloudflare Pages → push GitHub
#
# 用法：./tools/publish.sh "改動說明"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-更新}"
VER="$(node -e "console.log(require('./version.json').v)")"

echo "▶ 1/4 測試"
node tests/mahjong.test.js | tail -1
node tests/battle.test.js | tail -1
node tests/sw.test.js | tail -1

echo "▶ 2/4 部署 NAS（sltpm.com）"
if ./tools/deploy.sh; then
  echo "  ✓ NAS 已更新"
else
  echo "  ⚠️ NAS 連唔到（可能關咗機／SSH 唔通），跳過——Cloudflare 照樣會部署"
fi

echo "▶ 3/4 部署 Cloudflare Pages"
./tools/build.sh
npx -y wrangler@latest pages deploy dist \
  --project-name mahjongai --branch main --commit-dirty=true 2>&1 | tail -3

echo "▶ 4/4 push GitHub"
git add -A
git diff --cached --quiet || git -c user.name="RyuuSei" -c user.email="hhlokk@users.noreply.github.com" \
  commit -q -m "v${VER}：${MSG}

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push -q origin main
echo "✅ 完成：v${VER} · https://mahjongai-6nn.pages.dev/ · https://sltpm.com/mahjongai/"
