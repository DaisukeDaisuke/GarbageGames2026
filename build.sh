#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
site_root="$PWD/_site"
rm -rf -- "$site_root"
mkdir -p "$site_root"
printf '%s\n' '::group::Build arena'
bash arena/build.sh "$site_root"
printf '%s\n' '::endgroup::' '::group::Build RuleRPG'
bash RuleRPG/build.sh "$site_root/RuleRPG"
printf '%s\n' '::endgroup::' '::group::Build firework'
bash firework/build.sh --output-dir "$site_root/firework"
printf '%s\n' '::endgroup::' '::group::Build imgzip'
bash imgzip/build.sh "$site_root"
mv -- "$site_root/zip" "$site_root/imgzip"
printf '%s\n' '::endgroup::' '::group::Build jailbreakGame'
bash jailbreakGame/build.sh "$site_root/jailbreakGame"
printf '%s\n' '::endgroup::'
for app in arena RuleRPG firework imgzip jailbreakGame; do
  test -s "$site_root/$app/index.html"
done
touch "$site_root/.nojekyll"
