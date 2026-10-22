#!/usr/bin/env bash
set -euo pipefail
RPG_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPG_IMAGES="$RPG_ROOT/assets/display"
if command -v magick >/dev/null 2>&1; then
  RPG_MOGRIFY=(magick mogrify)
elif command -v mogrify >/dev/null 2>&1; then
  RPG_MOGRIFY=(mogrify)
else
  echo '画像の再圧縮にはImageMagickが必要です。' >&2
  exit 1
fi
mkdir -p "$RPG_IMAGES"
# Originals remain untouched; only the separate display directory is written.
for id in appeal_office document_archive museum_gate refund_counter terms_throne border_checkpoint forest_path moon_bridge last_train_platform home_door dialogue_frame; do
  matched=0
  for quality in $(seq 99 -1 1); do
    "${RPG_MOGRIFY[@]}" -path "$RPG_IMAGES" -format jpg -sampling-factor 4:4:4 -quality "$quality" -strip "$RPG_ROOT/assets/$id.png"
    bytes=$(wc -c < "$RPG_IMAGES/$id.jpg")
    if [ "$bytes" -le 80000 ]; then
      printf '%s: JPEG quality=%s, %s bytes\n' "$id" "$quality" "$bytes"
      matched=1
      break
    fi
  done
  [ "$matched" -eq 1 ] || { echo "$id を80KB以下にできませんでした。" >&2; exit 1; }
done
# Encode display copies only. Every PNG source remains untouched.
for id in exception_slime refund_mimic invalid_golem reply_ghost revision_king permit_crab echo_machine infinity_hermit last_train_crow home_lock; do
  "${RPG_MOGRIFY[@]}" -path "$RPG_IMAGES" -format webp -quality 100 -define webp:lossless=true -define webp:method=6 -define webp:exact=true "$RPG_ROOT/assets/$id.png"
  bytes=$(wc -c < "$RPG_IMAGES/$id.webp")
  [ "$bytes" -le 80000 ] || { echo "$id のロスレスWebPが80KBを超えています。" >&2; exit 1; }
  printf '%s: lossless WebP, %s bytes\n' "$id" "$bytes"
done
