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

  # Warn about subfolders Transmission uses that this user can't write to
  # (e.g. an 'incomplete' folder left by another app).
  for sub in complete incomplete; do
    if [ -d "$D/$sub" ] && ! s6-applyuidgid -u "$PUID" -g "$PGID" -G "$PGID" test -w "$D/$sub"; then
      log "WARNING: $D/$sub is owned by $(stat -c '%u:%g' "$D/$sub") and isn't writable as $PUID:$PGID."
      log "WARNING: rename or remove it, or pick another folder in Settings > Downloading."
    fi
  done
fi

exec /init "$@"
