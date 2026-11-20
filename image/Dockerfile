FROM lscr.io/linuxserver/transmission:4.1.4-r0-ls370
# Never chown the user's NAS shares: ug-entrypoint.sh runs Transmission as the
# folder's owner instead, and root-owned UGOS shares rely on their ACLs.
RUN sed -i -E 's#lsiown abc:abc (/downloads|/watch)#: skip-chown \1#' /etc/s6-overlay/s6-rc.d/init-transmission-config/run \
 && ! grep -qE 'lsiown abc:abc /(downloads|watch)' /etc/s6-overlay/s6-rc.d/init-transmission-config/run
COPY --chmod=755 ug-entrypoint.sh /usr/local/bin/ug-entrypoint.sh
# Custom UGOS-style web UI (repo ui/, passed in as the "ui" build context).
COPY --from=ui . /ui
ENTRYPOINT ["/usr/local/bin/ug-entrypoint.sh"]
