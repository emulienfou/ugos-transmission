#!/bin/sh
# UGOS wrapper: run Transmission as a user that can actually write to the
# download folder, so there are no PUID/PGID questions at install.
# Explicit PUID/PGID env vars still win.
#
# UGOS shares often have a root-owned, read-only-looking top folder with
# extra ACL entries that only allow specific users to write, so ownership
# alone isn't enough. We try candidates in order and keep the first one
# that passes a real write test:
#   1. the owner of /downloads, if it isn't root
#   2. the owners of what's already inside /downloads, most common first
#      (whoever wrote there before is allowed to write there)
#   3. 1000:100 (first UGOS user, "users" group)
# Ownership and permissions of the share are never changed.
FALLBACK="1000:100"
D=/downloads
log() { echo "[ug-entrypoint] $*"; }

can_write() { # uid gid
  f="$D/.ug-write-test-$$"
  s6-applyuidgid -u "$1" -g "$2" -G "$2" sh -c "touch \"$f\"" 2>/dev/null || return 1
  rm -f "$f"
}

candidates() {
  [ -d "$D" ] || return 0
  owner=$(stat -c '%u:%g' "$D")
  case "$owner" in 0:*) ;; *) echo "$owner" ;; esac
  find "$D" -mindepth 1 -maxdepth 1 -exec stat -c '%u:%g' {} + 2>/dev/null \
    | grep -v '^0:' | sort | uniq -c | sort -rn | awk '{print $2}'
  echo "$FALLBACK"
}

if [ -z "${PUID:-}" ] || [ -z "${PGID:-}" ]; then
  chosen=""
  tried=""
  for c in $(candidates | awk '!seen[$0]++'); do
    tried="$tried $c"
    if can_write "${c%:*}" "${c#*:}"; then chosen="$c"; break; fi
  done
  if [ -n "$chosen" ]; then
    log "$D is writable as $chosen -> PUID=${chosen%:*} PGID=${chosen#*:}"
  else
    chosen="$FALLBACK"
    [ -d "$D" ] && first=$(candidates | head -1) && [ -n "$first" ] && chosen="$first"
    log "WARNING: none of these users can write to $D:$tried"
    log "WARNING: downloads will fail with 'Permission denied'. In UGOS, give the user"
    log "WARNING: ${chosen%:*} (or group ${chosen#*:}) read/write access to the download folder."
  fi
  : "${PUID:=${chosen%:*}}"
  : "${PGID:=${chosen#*:}}"
  export PUID PGID
fi

# --- Settings fixes (before Transmission starts) -----------------------------
# The linuxserver defaults assume /downloads/incomplete, /downloads/complete and
# /watch can be used. On a shared UGOS folder they may belong to another app or
# not exist, which leads to "No data found!" errors and log noise.
S=/config/settings.json
umask "${UMASK:-022}"
as_user() { s6-applyuidgid -u "$PUID" -g "$PGID" -G "$PGID" "$@"; }
jset() { # key json-value
  jq --argjson v "$2" --arg k "$1" '.[$k] = $v' "$S" > "$S.ug-tmp" && mv "$S.ug-tmp" "$S"
}
jget() { jq -r --arg k "$1" '.[$k] // empty' "$S"; }

if [ -d /config ]; then
  [ -f "$S" ] || cp /defaults/settings.json "$S"

  # Incomplete folder: must be writable, or downloads fail with "No data found!".
  if [ "$(jget incomplete-dir-enabled)" = "true" ]; then
    inc=$(jget incomplete-dir)
    if [ -n "$inc" ] && [ -d "$inc" ] && ! as_user test -w "$inc"; then
      alt="$D/incomplete-transmission"
      if as_user mkdir -p "$alt" 2>/dev/null && as_user test -w "$alt"; then
        log "$inc is owned by $(stat -c '%u:%g' "$inc") and isn't writable as $PUID:$PGID; using $alt for unfinished downloads instead."
        jset incomplete-dir "\"$alt\""
      else
        log "$inc isn't writable as $PUID:$PGID; turning off the incomplete folder."
        jset incomplete-dir-enabled false
      fi
    fi
  fi

  # Download folder: create it up front so startup checks don't complain.
  dl=$(jget download-dir)
  if [ -n "$dl" ] && [ ! -d "$dl" ]; then
    as_user mkdir -p "$dl" 2>/dev/null && log "created $dl"
  fi

  # Watch folder: the package doesn't mount one, so turn it off if it's missing.
  if [ "$(jget watch-dir-enabled)" = "true" ] && [ ! -d "$(jget watch-dir)" ]; then
    jset watch-dir-enabled false
  fi
fi

# Never expose the web UI / RPC without a login (UGREEN review rule).
if [ -z "${USER:-}" ] || [ -z "${PASS:-}" ]; then
  log "ERROR: the web UI username and password are required. Set them in App Center and restart."
  exit 1
fi

exec /init "$@"
