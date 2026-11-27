FROM lscr.io/linuxserver/transmission:4.1.4-r0-ls371
# Never chown the user's NAS shares: ug-entrypoint.sh runs Transmission as the
# folder's owner instead, and root-owned UGOS shares rely on their ACLs.
RUN sed -i -E 's#lsiown abc:abc (/downloads|/watch)#: skip-chown \1#' /etc/s6-overlay/s6-rc.d/init-transmission-config/run \
 && ! grep -qE 'lsiown abc:abc /(downloads|watch)' /etc/s6-overlay/s6-rc.d/init-transmission-config/run
# Quiet startup noise: we serve our own UI, so skip the legacy theme symlinks
# ("ln: ... File exists" on every restart), and don't print stat errors for
# folders that don't exist yet.
RUN f=/etc/s6-overlay/s6-rc.d/init-transmission-config/run \
 && sed -i -E -e 's#^( *)(mkdir -p \{/transmissionic.*|echo /transmissionic.*xargs.*)$#\1: skip-legacy-themes#' \
              -e "s#stat -c '%U' (/[a-z/]+)\)#stat -c '%U' \1 2>/dev/null)#" "$f" \
 && ! grep -q 'xargs -n1 ln -s' "$f" \
 && ! grep -qE "stat -c '%U' /[a-z/]+\)" "$f"
# Front web server (nginx) on 9091; Transmission's own RPC moves to 9092.
RUN apk add --no-cache nginx
COPY nginx.conf /etc/ug-nginx.conf
COPY s6/svc-ug-proxy /etc/s6-overlay/s6-rc.d/svc-ug-proxy
RUN chmod 755 /etc/s6-overlay/s6-rc.d/svc-ug-proxy/run \
 && touch /etc/s6-overlay/s6-rc.d/user/contents.d/svc-ug-proxy \
 && nginx -t -c /etc/ug-nginx.conf
COPY --chmod=755 ug-entrypoint.sh /usr/local/bin/ug-entrypoint.sh
# Custom UGOS-style web UI (repo ui/, passed in as the "ui" build context).
COPY --from=ui . /ui
ENTRYPOINT ["/usr/local/bin/ug-entrypoint.sh"]
