// Transmission web UI for UGOS Pro. Plain ES module, no build step.
// Talks to Transmission's RPC on the same origin (legacy method names, which
// Transmission 4.x still accepts).

const RPC_URL = '/transmission/rpc';
const BASE_DIR = '/downloads';
const POLL_MS = 2000;

/* ---------- icons (24px line icons) ---------- */
const ICONS = {
  all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  down: '<path d="M12 4v13M6 11l6 6 6-6M5 20.5h14"/>',
  up: '<path d="M12 20V7M6 13l6-6 6 6M5 3.5h14"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10.5v6M14 10.5v6"/>',
  verify: '<path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6.5z"/><path d="M8.7 12.2l2.3 2.3 4.4-4.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  turtle: '<path d="M4 15.5c0-4 3.4-7.5 7.5-7.5S19 11.5 19 15.5z"/><path d="M19 13.5h1.6a1.6 1.6 0 0 0 0-3.2H19.2M7 15.5l-1 3M16 15.5l1 3M2.5 15.5h1.5M8.5 9l1.8 3.2h3.4L15.5 9M10.3 12.2l-1.4 3.3M13.7 12.2l1.4 3.3"/>',
  gauge: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l4-4.5"/><circle cx="12" cy="13.5" r="1.3"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>',
  inbox: '<path d="M3.5 13.5l2.6-7.3A1.5 1.5 0 0 1 7.5 5.2h9a1.5 1.5 0 0 1 1.4 1L20.5 13.5v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.5h5l1 2h5l1-2h5"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.4 2.4 5-5"/>',
  folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.3l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = svg(el.dataset.icon);
  });
}

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1);
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${UNITS[i]}`;
}
const fmtSpeed = (n) => `${fmtBytes(n)}/s`;
function fmtEta(s) {
  if (s == null || s < 0) return '∞';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
const fmtDate = (t) => (t > 0 ? new Date(t * 1000).toLocaleString() : '—');
const pct = (x) => `${(Math.floor(x * 1000) / 10).toFixed(x >= 1 ? 0 : 1)}%`;

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = `toast${isErr ? ' err' : ''}`;
  el.innerHTML = `<span class="ic">${svg(isErr ? 'alert' : 'check')}</span><span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), isErr ? 6000 : 3000);
}

/* ---------- RPC ---------- */
let sessionId = null;
let authHeader = null;

async function rpc(method, args = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Transmission-Session-Id'] = sessionId;
    if (authHeader) headers.Authorization = authHeader;
    const res = await fetch(RPC_URL, {
      method: 'POST', headers, credentials: 'same-origin', body: JSON.stringify({ method, arguments: args }),
    });
    if (res.status === 409) { sessionId = res.headers.get('X-Transmission-Session-Id'); continue; }
    if (res.status === 401) { await login(attempt > 0 && authHeader != null); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.result !== 'success') throw new Error(body.result);
    return body.arguments || {};
  }
  throw new Error('Could not reach Transmission');
}

let loginPromise = null;
function login(failed) {
  if (loginPromise) return loginPromise;
  const dlg = $('#loginDlg');
  $('#loginErr').hidden = !failed;
  loginPromise = new Promise((resolve) => {
    $('#loginForm').onsubmit = (e) => {
      e.preventDefault();
      const u = $('#lUser').value, p = $('#lPass').value;
      authHeader = 'Basic ' + btoa(unescape(encodeURIComponent(`${u}:${p}`)));
      dlg.close();
      loginPromise = null;
      resolve();
    };
    dlg.addEventListener('cancel', (e) => e.preventDefault(), { once: true });
    dlg.showModal();
  });
  return loginPromise;
}

/* ---------- state ---------- */
const S = {
  torrents: [],
  byId: new Map(),
  filter: 'all',
  query: '',
  sort: { key: 'added', desc: true },
  selected: new Set(),
  detailId: null,
  detailTab: 'general',
  detail: null,
  session: {},
  stats: {},
  connected: true,
};

const FILTERS = [
  { key: 'all', label: 'All', icon: 'all' },
  { key: 'downloading', label: 'Downloading', icon: 'down' },
  { key: 'seeding', label: 'Seeding', icon: 'up' },
  { key: 'paused', label: 'Paused', icon: 'pause' },
  { key: 'errors', label: 'Errors', icon: 'alert' },
];

// Transmission status codes
const ST = { STOPPED: 0, CHECK_WAIT: 1, CHECK: 2, DL_WAIT: 3, DL: 4, SEED_WAIT: 5, SEED: 6 };
const matches = {
  all: () => true,
  downloading: (t) => t.status === ST.DL || t.status === ST.DL_WAIT,
  seeding: (t) => t.status === ST.SEED || t.status === ST.SEED_WAIT,
  paused: (t) => t.status === ST.STOPPED,
  errors: (t) => t.error > 0,
};

function statusInfo(t) {
  if (t.error > 0) return { label: 'Error', cls: 'error' };
  switch (t.status) {
    case ST.STOPPED: return { label: t.percentDone >= 1 ? 'Finished' : 'Paused', cls: 'paused' };
    case ST.CHECK_WAIT: return { label: 'Queued check', cls: 'queued' };
    case ST.CHECK: return { label: `Verifying ${pct(t.recheckProgress)}`, cls: 'check' };
    case ST.DL_WAIT: return { label: 'Queued', cls: 'queued' };
    case ST.DL: return { label: t.metadataPercentComplete < 1 ? 'Getting info' : 'Downloading', cls: 'dl' };
    case ST.SEED_WAIT: return { label: 'Queued seed', cls: 'queued' };
    case ST.SEED: return { label: 'Seeding', cls: 'seed' };
    default: return { label: '—', cls: 'paused' };
  }
}

/* ---------- data loading ---------- */
const LIST_FIELDS = ['id', 'name', 'status', 'error', 'errorString', 'percentDone', 'rateDownload', 'rateUpload', 'eta',
  'totalSize', 'sizeWhenDone', 'leftUntilDone', 'uploadedEver', 'downloadedEver', 'uploadRatio', 'downloadDir', 'addedDate',
  'metadataPercentComplete', 'recheckProgress', 'peersConnected', 'peersSendingToUs', 'peersGettingFromUs', 'hashString'];
const DETAIL_FIELDS = ['id', 'files', 'fileStats', 'peers', 'trackerStats', 'comment', 'creator', 'dateCreated', 'pieceCount',
  'pieceSize', 'magnetLink', 'doneDate', 'activityDate', 'corruptEver', 'haveValid', 'isPrivate', 'secondsDownloading', 'secondsSeeding'];

let pollTimer = null;
let sessionTick = 0;
async function refresh() {
  clearTimeout(pollTimer);
  try {
    const [list, stats, sess, det] = await Promise.all([
      rpc('torrent-get', { fields: LIST_FIELDS }),
      rpc('session-stats'),
      sessionTick++ % 5 === 0 ? rpc('session-get') : null,
      S.detailId != null ? rpc('torrent-get', { ids: [S.detailId], fields: DETAIL_FIELDS }) : null,
    ]);
    S.torrents = list.torrents;
    S.byId = new Map(S.torrents.map((t) => [t.id, t]));
    for (const id of S.selected) if (!S.byId.has(id)) S.selected.delete(id);
    S.stats = stats;
    if (sess) S.session = sess;
    if (S.detailId != null) {
      if (!S.byId.has(S.detailId)) closeDetail();
      else if (det && det.torrents[0]) S.detail = det.torrents[0];
    }
    S.connected = true;
    render();
  } catch (err) {
    if (S.connected) toast(`Lost connection to Transmission: ${err.message}`, true);
    S.connected = false;
    renderStatusbar();
  }
  pollTimer = setTimeout(refresh, POLL_MS);
}

/* ---------- rendering ---------- */
function visibleTorrents() {
  const q = S.query.trim().toLowerCase();
  const list = S.torrents.filter((t) => matches[S.filter](t) && (!q || t.name.toLowerCase().includes(q)));
  const { key, desc } = S.sort;
  const val = {
    name: (t) => t.name.toLowerCase(), size: (t) => t.sizeWhenDone, progress: (t) => t.percentDone,
    status: (t) => (t.error > 0 ? -1 : t.status), down: (t) => t.rateDownload, up: (t) => t.rateUpload,
    eta: (t) => (t.eta < 0 ? Infinity : t.eta), added: (t) => t.addedDate,
  }[key];
  list.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : a.id - b.id) * (desc ? -1 : 1); });
  return list;
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = FILTERS.map((f) => {
    const n = S.torrents.filter(matches[f.key]).length;
    return `<button class="nav-item${S.filter === f.key ? ' active' : ''}" data-filter="${f.key}">
      <span class="ic">${svg(f.icon)}</span><span>${f.label}</span><span class="count">${n}</span></button>`;
  }).join('');
}

function rowHtml(t) {
  const st = statusInfo(t);
  const barCls = st.cls === 'seed' ? 'seed' : st.cls === 'paused' ? (t.percentDone >= 1 ? 'seed' : 'paused') : st.cls === 'error' ? 'error' : st.cls === 'check' ? 'check' : '';
  const prog = t.status === ST.CHECK ? t.recheckProgress : t.metadataPercentComplete < 1 ? t.metadataPercentComplete : t.percentDone;
  const sub = t.error > 0
    ? `<span class="sub err" title="${esc(t.errorString)}">${esc(t.errorString)}</span>`
    : `<span class="sub">${esc(t.downloadDir)}</span>`;
  const done = fmtBytes(t.sizeWhenDone - t.leftUntilDone);
  const active = t.status === ST.DL || t.status === ST.SEED;
  const mobileMeta = [
    t.percentDone < 1 ? `${done} of ${fmtBytes(t.sizeWhenDone)}` : fmtBytes(t.sizeWhenDone),
    active ? `↓ ${fmtSpeed(t.rateDownload)}  ↑ ${fmtSpeed(t.rateUpload)}` : '',
    t.status === ST.DL && t.eta >= 0 ? `ETA ${fmtEta(t.eta)}` : '',
  ].filter(Boolean).join(' · ');
  return `<tr data-id="${t.id}" class="${S.selected.has(t.id) ? 'sel' : ''}">
    <td class="c-check"><input type="checkbox" class="cb row-cb" ${S.selected.has(t.id) ? 'checked' : ''} aria-label="Select"></td>
    <td class="c-name"><div class="name-cell"><span class="t" title="${esc(t.name)}">${esc(t.name)}</span>${sub}</div></td>
    <td class="c-size dim">${fmtBytes(t.sizeWhenDone)}</td>
    <td class="c-prog"><div class="prog"><div class="bar ${barCls}"><i style="width:${(prog * 100).toFixed(1)}%"></i></div><span class="pct">${pct(prog)}</span></div></td>
    <td class="c-status"><span class="badge ${st.cls}">${esc(st.label)}</span></td>
    <td class="c-num num">${active && t.rateDownload > 0 ? fmtSpeed(t.rateDownload) : '—'}</td>
    <td class="c-num c-up num">${active && t.rateUpload > 0 ? fmtSpeed(t.rateUpload) : '—'}</td>
    <td class="c-num num">${t.status === ST.DL ? fmtEta(t.eta) : '—'}</td>
    <td class="m-only">${esc(mobileMeta)}</td>
  </tr>`;
}

function renderTable() {
  const list = visibleTorrents();
  $('#rows').innerHTML = list.map(rowHtml).join('');
  const empty = list.length === 0;
  $('#empty').hidden = !empty;
  if (empty) {
    $('#emptyText').textContent = S.torrents.length === 0 ? 'No torrents yet. Click Add to start a download.'
      : S.query ? 'No torrents match your search' : 'No torrents in this list';
  }
  const visIds = list.map((t) => t.id);
  const nSel = visIds.filter((id) => S.selected.has(id)).length;
  const all = $('#checkAll');
  all.checked = nSel > 0 && nSel === visIds.length;
  all.indeterminate = nSel > 0 && nSel < visIds.length;
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === S.sort.key);
    th.classList.toggle('desc', th.dataset.sort === S.sort.key && S.sort.desc);
  });
  renderToolbar();
}

function renderToolbar() {
  const sel = [...S.selected].map((id) => S.byId.get(id)).filter(Boolean);
  $('#startBtn').disabled = !sel.some((t) => t.status === ST.STOPPED);
  $('#stopBtn').disabled = !sel.some((t) => t.status !== ST.STOPPED);
  $('#verifyBtn').disabled = sel.length === 0;
  $('#removeBtn').disabled = sel.length === 0;
}

function renderSpeeds() {
  $('#totDown').textContent = fmtSpeed(S.stats.downloadSpeed || 0);
  $('#totUp').textContent = fmtSpeed(S.stats.uploadSpeed || 0);
  const alt = !!S.session['alt-speed-enabled'];
  $('#turtle').checked = alt;
  $('.turtle-row').classList.toggle('on', alt);
}

function renderStatusbar() {
  const bar = $('#statusbar');
  if (!S.connected) { bar.innerHTML = '<span class="hint warn">Not connected — retrying…</span>'; return; }
  const n = S.torrents.length;
  const parts = [`${n} torrent${n === 1 ? '' : 's'}`];
  if (S.selected.size) parts.push(`${S.selected.size} selected`);
  const s = S.session;
  if (s['alt-speed-enabled']) parts.push(`Turtle mode: ↓ ${s['alt-speed-down']} KB/s ↑ ${s['alt-speed-up']} KB/s`);
  else {
    if (s['speed-limit-down-enabled']) parts.push(`Download limit ${s['speed-limit-down']} KB/s`);
    if (s['speed-limit-up-enabled']) parts.push(`Upload limit ${s['speed-limit-up']} KB/s`);
  }
  if (s.version) parts.push(`Transmission ${String(s.version).split(' ')[0]}`);
  bar.innerHTML = parts.map((p) => `<span>${esc(p)}</span>`).join('');
}

function render() {
  renderNav();
  renderTable();
  renderSpeeds();
  renderStatusbar();
  renderDetail();
}

/* ---------- detail panel ---------- */
function openDetail(id) {
  if (S.detailId !== id) { S.detail = null; }
  S.detailId = id;
  $('#detail').hidden = false;
  renderDetail();
  refresh();
}
function closeDetail() {
  S.detailId = null; S.detail = null;
  $('#detail').hidden = true;
}

function renderDetail() {
  if (S.detailId == null) return;
  const t = S.byId.get(S.detailId);
  if (!t) return;
  $('#detailTitle').textContent = t.name;
  document.querySelectorAll('#detailTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === S.detailTab));
  const d = S.detail;
  const body = $('#detailBody');
  // Don't clobber a scrolled list or a checkbox mid-click more than needed.
  const html = !d ? '<p class="muted">Loading…</p>' : ({ general: generalHtml, files: filesHtml, peers: peersHtml, trackers: trackersHtml })[S.detailTab](t, d);
  if (body.dataset.html !== html) { body.innerHTML = html; body.dataset.html = html; }
}

function generalHtml(t, d) {
  const st = statusInfo(t);
  const kv = (rows) => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  return `<div class="section-title">Transfer</div>${kv([
    ['Status', `<span class="badge ${st.cls}">${esc(st.label)}</span>`],
    t.error > 0 && ['Error', `<span class="hint warn" style="margin:0">${esc(t.errorString)}</span>`],
    ['Progress', `${pct(t.percentDone)} (${fmtBytes(t.sizeWhenDone - t.leftUntilDone)} of ${fmtBytes(t.sizeWhenDone)})`],
    ['Download speed', fmtSpeed(t.rateDownload)],
    ['Upload speed', fmtSpeed(t.rateUpload)],
    ['ETA', t.status === ST.DL ? fmtEta(t.eta) : '—'],
    ['Downloaded', fmtBytes(t.downloadedEver)],
    ['Uploaded', `${fmtBytes(t.uploadedEver)} (ratio ${t.uploadRatio >= 0 ? t.uploadRatio.toFixed(2) : '—'})`],
    ['Peers', `${t.peersConnected} connected · ${t.peersSendingToUs} sending · ${t.peersGettingFromUs} receiving`],
    d.corruptEver > 0 && ['Corrupt', fmtBytes(d.corruptEver)],
  ])}
  <div class="section-title">Details</div>${kv([
    ['Location', esc(t.downloadDir)],
    ['Size', `${fmtBytes(t.totalSize)} · ${d.pieceCount} pieces of ${fmtBytes(d.pieceSize)}`],
    ['Hash', `<code>${esc(t.hashString)}</code>`],
    ['Added', fmtDate(t.addedDate)],
    ['Completed', fmtDate(d.doneDate)],
    ['Last activity', fmtDate(d.activityDate)],
    ['Created', `${fmtDate(d.dateCreated)}${d.creator ? ` by ${esc(d.creator)}` : ''}`],
    ['Private', d.isPrivate ? 'Yes' : 'No'],
    d.comment && ['Comment', esc(d.comment)],
  ])}`;
}

function filesHtml(t, d) {
  if (!d.files || d.files.length === 0) return '<p class="muted">The file list appears once the torrent’s info has been downloaded.</p>';
  const rows = d.files.map((f, i) => {
    const s = d.fileStats[i] || {};
    const p = f.length > 0 ? f.bytesCompleted / f.length : 1;
    const name = f.name.includes('/') && d.files.length > 1 ? f.name.slice(f.name.indexOf('/') + 1) : f.name;
    return `<tr><td><div class="file-name"><input type="checkbox" class="cb file-cb" data-idx="${i}" ${s.wanted ? 'checked' : ''} title="Download this file"><span title="${esc(f.name)}">${esc(name)}</span></div>
      <div class="file-prog ${p >= 1 ? 'done' : ''}"><i style="width:${(p * 100).toFixed(1)}%"></i></div></td>
      <td class="r">${fmtBytes(f.length)}</td><td class="r">${pct(p)}</td></tr>`;
  }).join('');
  return `<table class="mini-table"><colgroup><col><col style="width:80px"><col style="width:60px"></colgroup>
    <thead><tr><th>Name</th><th class="r">Size</th><th class="r">Done</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function peersHtml(t, d) {
  if (!d.peers || d.peers.length === 0) return '<p class="muted">Not connected to any peers.</p>';
  const peers = [...d.peers].sort((a, b) => (b.rateToClient + b.rateToPeer) - (a.rateToClient + a.rateToPeer));
  const rows = peers.map((p) => `<tr><td title="${esc(p.address)}">${esc(p.address)}</td>
    <td title="${esc(p.clientName)}">${esc(p.clientName)}</td><td class="r">${pct(p.progress)}</td>
    <td class="r">${p.rateToClient ? fmtSpeed(p.rateToClient) : '—'}</td><td class="r">${p.rateToPeer ? fmtSpeed(p.rateToPeer) : '—'}</td></tr>`).join('');
  return `<table class="mini-table"><colgroup><col><col><col style="width:60px"><col style="width:76px"><col style="width:76px"></colgroup>
    <thead><tr><th>Address</th><th>Client</th><th class="r">Has</th><th class="r">↓</th><th class="r">↑</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function trackersHtml(t, d) {
  if (!d.trackerStats || d.trackerStats.length === 0) return '<p class="muted">No trackers (this torrent uses DHT and peer exchange only).</p>';
  const ann = (tr) => {
    if (tr.lastAnnounceSucceeded) return `Last announce OK ${tr.lastAnnounceTime > 0 ? `at ${new Date(tr.lastAnnounceTime * 1000).toLocaleTimeString()}` : ''}`;
    if (tr.hasAnnounced) return `<span class="err">${esc(tr.lastAnnounceResult || 'Announce failed')}</span>`;
    return 'Not announced yet';
  };
  return d.trackerStats.map((tr) => `<div class="tracker">
    <div class="host"><span class="badge ${tr.tier === 0 ? '' : 'paused'}">Tier ${tr.tier + 1}</span>${esc(tr.host || tr.announce)}</div>
    <div class="meta"><span>${ann(tr)}</span>
      <span>Seeders ${tr.seederCount >= 0 ? tr.seederCount : '—'}</span><span>Leechers ${tr.leecherCount >= 0 ? tr.leecherCount : '—'}</span>
      ${tr.nextAnnounceTime > 0 ? `<span>Next ${new Date(tr.nextAnnounceTime * 1000).toLocaleTimeString()}</span>` : ''}</div></div>`).join('');
}

/* ---------- actions ---------- */
async function act(method, ids, extra = {}, okMsg) {
  try {
    await rpc(method, { ids, ...extra });
    if (okMsg) toast(okMsg);
  } catch (e) { toast(e.message, true); }
  refresh();
}
const selIds = () => [...S.selected];

/* add dialog */
let pendingFiles = [];
function cleanSubdir(v) {
  return v.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^downloads\/?/, '').replace(/\/+$/, '');
}
function fullDir(sub) { return sub ? `${BASE_DIR}/${sub}` : BASE_DIR; }
function validSubdir(sub) { return !sub.split('/').some((p) => p === '..' || p === '.'); }

let freeTimer = null;
function updateFreeSpace() {
  clearTimeout(freeTimer);
  freeTimer = setTimeout(async () => {
    const sub = cleanSubdir($('#dir').value);
    if (!validSubdir(sub)) { $('#freeSpace').textContent = 'The folder must be inside /downloads.'; return; }
    const free = (r) => `${fmtBytes(r['size-bytes'])} free`;
    try {
      $('#freeSpace').textContent = free(await rpc('free-space', { path: fullDir(sub) }));
    } catch {
      let text = 'New folder — Transmission will create it';
      try { text += ` · ${free(await rpc('free-space', { path: BASE_DIR }))}`; } catch {}
      $('#freeSpace').textContent = text;
    }
  }, 250);
}

function openAdd(files) {
  const def = (S.session['download-dir'] || `${BASE_DIR}/complete`);
  const dirs = new Set([def, ...S.torrents.map((t) => t.downloadDir)]);
  $('#dirList').innerHTML = [...dirs].filter((d) => d === BASE_DIR || d.startsWith(BASE_DIR + '/'))
    .map((d) => `<option value="${esc(d.slice(BASE_DIR.length + 1))}">`).join('');
  if (!$('#dir').value) $('#dir').value = def.startsWith(BASE_DIR + '/') ? def.slice(BASE_DIR.length + 1) : '';
  pendingFiles = files || [];
  setAddTab(files && files.length ? 'file' : 'magnet');
  updateDropText();
  updateFreeSpace();
  $('#addDlg').showModal();
  if (!files) $('#magnet').focus();
}
function setAddTab(tab) {
  document.querySelectorAll('#addTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.add-pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  $('#addDlg').dataset.tab = tab;
}
function updateDropText() {
  $('#dropText').innerHTML = pendingFiles.length
    ? pendingFiles.map((f) => esc(f.name)).join('<br>') + '<br><u>Choose other files</u>'
    : 'Drop .torrent files here, or <u>browse</u>';
}
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

async function submitAdd(e) {
  e.preventDefault();
  const sub = cleanSubdir($('#dir').value);
  if (!validSubdir(sub)) { toast('The download folder must be inside /downloads.', true); return; }
  const base = { 'download-dir': fullDir(sub), paused: !$('#startNow').checked };
  const items = [];
  if ($('#addDlg').dataset.tab === 'file') {
    if (!pendingFiles.length) { toast('Choose a .torrent file first.', true); return; }
    for (const f of pendingFiles) items.push({ label: f.name, args: { ...base, metainfo: await fileToBase64(f) } });
  } else {
    const links = $('#magnet').value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (!links.length) { toast('Paste a magnet link first.', true); return; }
    for (const l of links) items.push({ label: l, args: { ...base, filename: l } });
  }
  $('#addSubmit').disabled = true;
  let ok = 0;
  for (const it of items) {
    try {
      const r = await rpc('torrent-add', it.args);
      if (r['torrent-duplicate']) toast(`Already added: ${r['torrent-duplicate'].name}`, true);
      else ok++;
    } catch (err) { toast(`Couldn't add ${it.label.slice(0, 60)}: ${err.message}`, true); }
  }
  $('#addSubmit').disabled = false;
  if (ok) {
    toast(ok === 1 ? 'Torrent added' : `${ok} torrents added`);
    $('#magnet').value = ''; pendingFiles = [];
    $('#addDlg').close();
  }
  refresh();
}

/* remove dialog */
function openRemove() {
  const ts = selIds().map((id) => S.byId.get(id)).filter(Boolean);
  if (!ts.length) return;
  $('#removeText').innerHTML = ts.length === 1
    ? `Remove <b>${esc(ts[0].name)}</b> from the list?`
    : `Remove <b>${ts.length} torrents</b> from the list?`;
  $('#removeData').checked = false;
  $('#removeWarn').hidden = true;
  $('#removeDlg').showModal();
}

/* limits dialog */
function openLimits() {
  const s = S.session;
  $('#limDownOn').checked = !!s['speed-limit-down-enabled'];
  $('#limUpOn').checked = !!s['speed-limit-up-enabled'];
  $('#limDown').value = s['speed-limit-down'] ?? 100;
  $('#limUp').value = s['speed-limit-up'] ?? 100;
  $('#altDown').value = s['alt-speed-down'] ?? 50;
  $('#altUp').value = s['alt-speed-up'] ?? 50;
  $('#limitsDlg').showModal();
}
async function saveLimits(e) {
  e.preventDefault();
  const n = (id) => Math.max(0, parseInt($(id).value, 10) || 0);
  try {
    await rpc('session-set', {
      'speed-limit-down-enabled': $('#limDownOn').checked, 'speed-limit-down': n('#limDown'),
      'speed-limit-up-enabled': $('#limUpOn').checked, 'speed-limit-up': n('#limUp'),
      'alt-speed-down': n('#altDown'), 'alt-speed-up': n('#altUp'),
    });
    S.session = await rpc('session-get');
    $('#limitsDlg').close();
    toast('Speed limits saved');
    render();
  } catch (err) { toast(err.message, true); }
}

/* theme */
const THEMES = ['auto', 'light', 'dark'];
function currentTheme() { return document.documentElement.dataset.theme || 'auto'; }
function setTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('ug-theme', t); } catch {}
  $('#themeLabel').textContent = `Theme: ${t[0].toUpperCase()}${t.slice(1)}`;
}

/* ---------- events ---------- */
function bind() {
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    S.filter = b.dataset.filter;
    render();
  });
  $('#search').addEventListener('input', (e) => { S.query = e.target.value; renderTable(); });

  document.querySelectorAll('th.sortable').forEach((th) => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    S.sort = S.sort.key === k ? { key: k, desc: !S.sort.desc } : { key: k, desc: k !== 'name' };
    renderTable();
  }));

  $('#rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.classList.contains('row-cb')) {
      e.target.checked ? S.selected.add(id) : S.selected.delete(id);
    } else if (e.metaKey || e.ctrlKey) {
      S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
    } else {
      S.selected = new Set([id]);
      openDetail(id);
    }
    renderTable(); renderStatusbar();
  });
  $('#checkAll').addEventListener('change', (e) => {
    const ids = visibleTorrents().map((t) => t.id);
    ids.forEach((id) => (e.target.checked ? S.selected.add(id) : S.selected.delete(id)));
    renderTable(); renderStatusbar();
  });

  $('#addBtn').onclick = () => openAdd();
  $('#startBtn').onclick = () => act('torrent-start', selIds());
  $('#stopBtn').onclick = () => act('torrent-stop', selIds());
  $('#verifyBtn').onclick = () => act('torrent-verify', selIds(), {}, 'Verifying local data');
  $('#removeBtn').onclick = openRemove;

  $('#detailClose').onclick = closeDetail;
  $('#detailTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    S.detailTab = b.dataset.tab;
    renderDetail();
  });
  $('#detailBody').addEventListener('change', async (e) => {
    if (!e.target.classList.contains('file-cb') || S.detailId == null) return;
    const idx = Number(e.target.dataset.idx);
    try { await rpc('torrent-set', { ids: [S.detailId], [e.target.checked ? 'files-wanted' : 'files-unwanted']: [idx] }); }
    catch (err) { toast(err.message, true); }
    refresh();
  });

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#addTabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) setAddTab(b.dataset.tab); });
  $('#addForm').addEventListener('submit', submitAdd);
  $('#dir').addEventListener('input', updateFreeSpace);
  $('#fileInput').addEventListener('change', (e) => { pendingFiles = [...e.target.files]; updateDropText(); });
  const drop = $('#drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
    pendingFiles = [...e.dataTransfer.files].filter((f) => f.name.endsWith('.torrent'));
    updateDropText();
  });

  $('#removeData').addEventListener('change', (e) => { $('#removeWarn').hidden = !e.target.checked; });
  $('#removeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ids = selIds();
    const withData = $('#removeData').checked;
    $('#removeDlg').close();
    if (ids.includes(S.detailId)) closeDetail();
    ids.forEach((id) => S.selected.delete(id));
    act('torrent-remove', ids, { 'delete-local-data': withData }, withData ? 'Removed torrents and their files' : 'Removed torrents');
  });

  $('#openLimits').onclick = openLimits;
  $('#limitsForm').addEventListener('submit', saveLimits);
  $('#turtle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    try {
      await rpc('session-set', { 'alt-speed-enabled': on });
      S.session = { ...S.session, 'alt-speed-enabled': on };
      toast(on ? 'Turtle mode on' : 'Turtle mode off');
    } catch (err) { toast(err.message, true); }
    render();
  });
  $('#themeBtn').onclick = () => setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);

  // Drag .torrent files anywhere on the page
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e) && !$('#addDlg').open) { dragDepth++; $('#dropOverlay').hidden = false; } });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; $('#dropOverlay').hidden = true;
    const files = [...e.dataTransfer.files].filter((f) => f.name.endsWith('.torrent'));
    if (files.length) openAdd(files);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]') && S.detailId != null) closeDetail();
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected.size && !e.target.closest('input,textarea') && !document.querySelector('dialog[open]')) openRemove();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

paintIcons();
setTheme(currentTheme());
bind();
refresh();
