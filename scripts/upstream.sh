#!/usr/bin/env bash
# Upstream linuxserver/transmission tag handling.
#   scripts/upstream.sh current         tag in image/Dockerfile
#   scripts/upstream.sh latest          newest stable <x.y.z>-r<rev>-ls<build> GitHub release
#   scripts/upstream.sh apply <tag>     point Dockerfile, build script, compose and project.yaml at <tag>
# Never uses "latest": only explicit, fully versioned tags.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG_RE='^[0-9]+\.[0-9]+\.[0-9]+-r[0-9]+-ls[0-9]+$'

current() {
  sed -nE 's#^FROM lscr\.io/linuxserver/transmission:([^ ]+).*#\1#p' image/Dockerfile | head -1
}

latest() {
  # Stable (non-draft, non-prerelease) releases, newest version first.
  curl -fsSL ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
    'https://api.github.com/repos/linuxserver/docker-transmission/releases?per_page=50' |
    python3 -I -c '
import json, re, sys
tags = [r["tag_name"] for r in json.load(sys.stdin) if not r["draft"] and not r["prerelease"]]
tags = [t for t in tags if re.match(r"'"$TAG_RE"'", t)]
key = lambda t: [int(x) for x in re.findall(r"\d+", t)]
print(max(tags, key=key) if tags else "")'
}

# Exit 0 if $1 is a strictly newer tag than $2.
newer() {
  python3 -I -c '
import re, sys
k = lambda t: [int(x) for x in re.findall(r"\d+", t)]
sys.exit(0 if k(sys.argv[1]) > k(sys.argv[2]) else 1)' "$1" "$2"
}

apply() {
  local tag=$1 ver wrapper
  [[ $tag =~ $TAG_RE ]] || { echo "bad tag: $tag" >&2; exit 1; }
  ver=${tag%%-*}
  wrapper="$tag-ug1"   # new base image => fresh wrapper suffix
  sed -i.bak -E "s#^(FROM lscr\.io/linuxserver/transmission:)[^ ]+#\1$tag#" image/Dockerfile
  sed -i.bak -E "s#^IMAGE=davidsanchez/transmission:.*#IMAGE=davidsanchez/transmission:$wrapper#; s#^OUT=rootfs_amd64/images/.*#OUT=rootfs_amd64/images/transmission-$wrapper.tar#" scripts/build-image.sh
  sed -i.bak -E "s#^( *image: davidsanchez/transmission:).*#\1$wrapper#" rootfs_common/docker-compose.yaml
  sed -i.bak -E "s#^version: .*#version: $ver#" project.yaml
  rm -f image/Dockerfile.bak scripts/build-image.sh.bak rootfs_common/docker-compose.yaml.bak project.yaml.bak
  grep -q "transmission:$tag\$" image/Dockerfile
  grep -q "IMAGE=davidsanchez/transmission:$wrapper\$" scripts/build-image.sh
  grep -q "image: davidsanchez/transmission:$wrapper\$" rootfs_common/docker-compose.yaml
  grep -q "^version: $ver\$" project.yaml
  echo "now on $tag (wrapper $wrapper, version $ver)"
}

case ${1:-} in
  current) current ;;
  latest) latest ;;
  newer) newer "$2" "$3" ;;
  apply) apply "$2" ;;
  *) echo "usage: $0 current|latest|newer <a> <b>|apply <tag>" >&2; exit 2 ;;
esac
