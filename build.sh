#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
# Copy the packaged public files without rebuilding or modifying them.
rm -rf -- _site
mkdir -p _site
while IFS=$'\t' read -r source destination; do
  test -f "$source" || { printf 'Missing public resource: %s\n' "$source" >&2; exit 1; }
  mkdir -p "_site/$(dirname -- "$destination")"
  cp -- "$source" "_site/$destination"
  cmp -- "$source" "_site/$destination"
done < deploy-files.tsv
touch _site/.nojekyll
