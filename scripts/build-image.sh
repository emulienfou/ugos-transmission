#!/usr/bin/env bash
# Builds the UGOS wrapper image (linux/amd64) on top of linuxserver's Transmission
# image and saves it as the app's single image tar.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=davidsanchez/transmission:4.1.4-r0-ls370-ug7
OUT=rootfs_amd64/images/transmission-4.1.4-r0-ls370-ug7.tar
docker build --platform linux/amd64 --build-context ui=ui -t "$IMAGE" image
mkdir -p "$(dirname "$OUT")"
rm -f rootfs_amd64/images/*.tar
docker save --platform linux/amd64 -o "$OUT" "$IMAGE"
echo "tags in $OUT:"; tar -xOf "$OUT" manifest.json | python3 -I -c 'import json,sys; print([t for m in json.load(sys.stdin) for t in m["RepoTags"]])'
