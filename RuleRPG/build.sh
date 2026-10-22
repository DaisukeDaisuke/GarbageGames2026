#!/usr/bin/env bash
set -euo pipefail
RPG_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RPG_OUTPUT="${1:-$RPG_DIR}"
command -v node >/dev/null 2>&1 || { echo 'Node.js 22以上が必要です。' >&2; exit 1; }
if [ "${RPG_BACKGROUNDS:-0}" = 1 ]; then
  node "$RPG_DIR/tools/make-backgrounds.mjs"
fi
if [ "${RPG_RECOMPRESS:-0}" = 1 ]; then
  bash "$RPG_DIR/tools/compress-images.sh"
fi
node "$RPG_DIR/tools/build.mjs" "$RPG_OUTPUT"
