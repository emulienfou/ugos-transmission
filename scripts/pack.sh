#!/usr/bin/env bash
# Packs the amd64 UPK with the next build number and records it in BUILD.
# UGOS only upgrades in place when the build number is higher, so it must
# strictly increase on every release. Pass a minimum to never go below it
# (CI passes the latest GitHub release's build):  scripts/pack.sh [min_last_build]
# Run scripts/build-image.sh first. UGCLI overrides the ugcli binary path.
set -euo pipefail
cd "$(dirname "$0")/.."
UGCLI=${UGCLI:-ugcli}
last=$(tr -dc 0-9 < BUILD)
min=${1:-0}
(( min > last )) && last=$min
build=$((last + 1))
ls rootfs_amd64/images/*.tar >/dev/null
"$UGCLI" check
"$UGCLI" pack --arch amd64 --build "$build"
echo "$build" > BUILD
version=$(sed -nE 's/^version: *//p' project.yaml)
upk=$(ls build_dir/pkgs/upk/amd64_*_"$version.$(printf %04d "$build")".upk)
echo "packed $upk"
if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  { echo "build=$build"; echo "version=$version"; echo "upk=$upk"; } >> "$GITHUB_OUTPUT"
fi
