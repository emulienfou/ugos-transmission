#!/bin/sh
# UGOS wrapper: run Transmission as the owner of the download folder, so no
# PUID/PGID questions at install. Explicit PUID/PGID env vars still win.
#   - /downloads owned by a normal user (e.g. 1024:100) -> use that uid:gid
#   - owned by root (UGOS ACL shares, e.g. Photos)      -> fall back to 1000:100
FALLBACK_UID=1000
FALLBACK_GID=100

if [ -z "${PUID:-}" ] || [ -z "${PGID:-}" ]; then
  if [ -d /downloads ]; then
    uid=$(stat -c %u /downloads)
    gid=$(stat -c %g /downloads)
  else
    uid=0; gid=0
  fi
  [ "$uid" = 0 ] && uid=$FALLBACK_UID
  [ "$gid" = 0 ] && gid=$FALLBACK_GID
  : "${PUID:=$uid}"
  : "${PGID:=$gid}"
  export PUID PGID
  echo "[ug-entrypoint] /downloads owner -> PUID=$PUID PGID=$PGID"
fi

exec /init "$@"
