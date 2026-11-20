#!/usr/bin/env bash
# Renders assets/transmission.svg (from transmission/transmission@4.1.4, icons/) to rootfs_common/icon.png at 128x128.
set -euo pipefail
cd "$(dirname "$0")/.."
docker run --rm -v "$PWD":/w alpine:3.22 sh -c 'apk add -q --no-cache rsvg-convert >/dev/null 2>&1 || apk add -q --no-cache librsvg >/dev/null; rsvg-convert -w 128 -h 128 -o /w/rootfs_common/icon.png /w/assets/transmission.svg'
