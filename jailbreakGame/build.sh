#!/usr/bin/env bash
set -euo pipefail
game_root="$(cd -- "$(dirname -- "$0")" && pwd)"
if [ "$#" -gt 1 ]; then
  printf '%s\n' 'Usage: bash jailbreakGame/build.sh [exact-output-directory]' >&2
  exit 2
fi
cd -- "$game_root"
output_dir="${1:-$game_root/dist}"
output_dir="$(node -e 'process.stdout.write(require("node:path").resolve(process.argv[1]))' "$output_dir")"
case "$output_dir" in
  /|"$game_root"|"$game_root/src"|"$game_root/content"|"$game_root/data"|"$game_root/assets"|"$game_root/docs"|"$game_root/tools"|"$game_root/tests"|"$game_root/art-source")
    printf '%s\n' 'Output must be a separate deployment directory.' >&2
    exit 2
    ;;
esac
node tools/compile-content.mjs
node --test tests/*.test.mjs
test -s index.html
test -s src/ui.mjs
build_stage="$(mktemp -d "$game_root/.build-XXXXXX")"
trap 'rm -rf -- "$build_stage"' EXIT
mkdir -p "$build_stage/src" "$build_stage/assets" "$build_stage/data" "$output_dir"
cp index.html "$build_stage/index.html"
cp -R src/. "$build_stage/src/"
cp -R assets/. "$build_stage/assets/"
cp -R data/. "$build_stage/data/"
cp docs/THIRD_PARTY_NOTICES.md "$build_stage/THIRD_PARTY_NOTICES.md"
touch "$build_stage/.nojekyll"
cp -R "$build_stage/." "$output_dir/"
printf 'Built jailbreakGame -> %s\n' "$output_dir"
