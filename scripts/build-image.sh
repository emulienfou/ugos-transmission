#!/usr/bin/env bash
# Saves the linuxserver.io Transmission image (linux/amd64) as the app's single image tar.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=lscr.io/linuxserver/transmission:4.1.4-r0-ls370
OUT=rootfs_amd64/images/transmission-4.1.4-r0-ls370.tar
docker pull --platform linux/amd64 "$IMAGE"
mkdir -p "$(dirname "$OUT")"
rm -f rootfs_amd64/images/*.tar
docker save --platform linux/amd64 -o "$OUT" "$IMAGE"
echo "tags in $OUT:"; tar -xOf "$OUT" manifest.json | python3 -I -c 'import json,sys; print([t for m in json.load(sys.stdin) for t in m["RepoTags"]])'
