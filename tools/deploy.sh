#!/usr/bin/env bash
# 一鍵部署到 NAS（sltpm.com/mahjongai/）
#
# 用法：
#   tools/deploy.sh            # 部署
#   tools/deploy.sh --test     # 先跑測試，過咗先部署
#
# 做嘅事：安全檢查 → 打包 → scp → 解壓 → chmod → 時間戳備份 → 線上驗證
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE_USER="kwy"
REMOTE_HOST="sltpm.com"
REMOTE_PORT="29"
REMOTE_DIR="/volume1/web"
SITE_DIR="mahjongai"
PUBLIC_URL="https://sltpm.com/mahjongai/"
ASKPASS="$HOME/.ssh/sltpm_askpass.sh"
TAG="$(date +%Y%m%d-%H%M%S)"

export SSH_ASKPASS="$ASKPASS"
export SSH_ASKPASS_REQUIRE=force
export DISPLAY="${DISPLAY:-:0}"

ssh_run() { ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "$@"; }
scp_run() { scp -O -o StrictHostKeyChecking=no -P "$REMOTE_PORT" "$@"; }

# ---------- 1. 測試（可選） ----------
if [ "${1:-}" = "--test" ]; then
  echo "▶ 跑測試…"
  node tests/mahjong.test.js | tail -1
  node tests/battle.test.js | tail -1
  node tests/sw.test.js | tail -1
fi

# ---------- 2. 安全檢查（防空洞檔案／漏改版本） ----------
echo "▶ 檢查檔案…"
for f in index.html sw.js css/style.css js/mahjong.js js/ui-tiles.js js/app.js js/practice.js js/battle.js js/battle-ui.js version.json; do
  if [ ! -s "$f" ]; then
    echo "✗ $f 唔存在或者係空檔（0 bytes），停止部署" >&2
    exit 1
  fi
done
node --check sw.js
for f in js/*.js; do node --check "$f"; done

VER="$(node -e "console.log(require('./version.json').v)")"
HTML_VER="$(grep -o "var V = '[0-9]*'" index.html | head -1 | grep -o '[0-9]*')"
if [ "$VER" != "$HTML_VER" ]; then
  echo "✗ version.json ($VER) 同 index.html var V ($HTML_VER) 唔一致，用 tools/bump.py 升版本" >&2
  exit 1
fi
echo "  版本 v$VER"

# ---------- 3. 打包上載 ----------
TGZ="/tmp/mahjongai_upload_$TAG.tgz"
echo "▶ 打包…"
tar czf "$TGZ" -C "$ROOT/.." --no-xattrs --exclude='tests' --exclude='tools' --exclude='.git' "$SITE_DIR"

echo "▶ 上載到 NAS…"
scp_run "$TGZ" "$REMOTE_USER@$REMOTE_HOST:/tmp/mahjongai.tgz" >/dev/null

echo "▶ 解壓 + 備份…"
ssh_run "cd $REMOTE_DIR && tar xzf /tmp/mahjongai.tgz && chmod -R a+rX $SITE_DIR && mkdir -p ~/bak && tar czf ~/bak/$SITE_DIR-$(date +%Y%m%d-%H%M).tar.gz $SITE_DIR && echo  remote-version: \$(cat $SITE_DIR/version.json | tr -d '\n')"

# ---------- 4. 線上驗證 ----------
echo "▶ 線上驗證…"
fail=0
for f in index.html sw.js version.json "css/style.css?v=$VER" "js/app.js?v=$VER" "js/practice.js?v=$VER" \
         "js/battle.js?v=$VER" "js/battle-ui.js?v=$VER" "js/mahjong.js?v=$VER" "js/ui-tiles.js?v=$VER"; do
  code=$(curl -s -o /tmp/mj_$TAG.out -w '%{http_code}' "$PUBLIC_URL$f")
  size=$(wc -c < /tmp/mj_$TAG.out | tr -d ' ')
  if [ "$code" != "200" ] || [ "$size" -lt 8 ]; then
    echo "  ✗ $f → $code ($size bytes)" >&2
    fail=1
  fi
done
rm -f /tmp/mj_$TAG.out

LIVE_VER=$(curl -s "${PUBLIC_URL}version.json" | tr -d ' \n"{}' | sed 's/v://')
if [ "$fail" != "0" ]; then
  echo "✗ 線上驗證失敗" >&2
  exit 1
fi
if [ "$LIVE_VER" != "$VER" ]; then
  echo "✗ 線上版本 (${LIVE_VER}) 同本地 (${VER}) 唔一致" >&2
  exit 1
fi

rm -f "$TGZ"
echo "✅ 已部署：$PUBLIC_URL 版本 v${VER}（備份 ~/bak/$SITE_DIR-*.tar.gz）"
