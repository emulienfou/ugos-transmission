// Transmission web UI for UGOS Pro. Plain ES module, no build step.
// Talks to Transmission's RPC on the same origin (legacy method names, which
// Transmission 4.x still accepts).

const RPC_URL = '/transmission/rpc';
const BASE_DIR = '/downloads';
let pollMs = (() => { try { const r = Number(localStorage.getItem('ug-refresh')); return r >= 1000 ? r : 2000; } catch { return 2000; } })();

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
  gear: '<circle cx="12" cy="12" r="2.8"/><path d="M10.3 3.5h3.4l.5 2.4 1.7 1 2.3-.8 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.8-1.7 1-.5 2.4h-3.4l-.5-2.4-1.7-1-2.3.8-1.7-2.9 1.8-1.6v-2L3.9 9l1.7-2.9 2.3.8 1.7-1z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
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
  pollTimer = setTimeout(refresh, pollMs);
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

/* ---------- settings dialog ----------
   Mirrors the Transmission desktop preferences (Speed, Downloading, Seeding,
   Privacy, Network) plus UI-only options, like flood-for-transmission.
   Edits are kept per field across pages; Save sends only changed keys. */
const KBS = 'kB/s';
const DAYS = [[127, 'Every day'], [62, 'Weekdays'], [65, 'Weekends'], [1, 'Sunday'], [2, 'Monday'],
  [4, 'Tuesday'], [8, 'Wednesday'], [16, 'Thursday'], [32, 'Friday'], [64, 'Saturday']]; // tr_sched_day bits
const UI_DEFAULTS = { theme: 'auto', refresh: 2000 };
const SETTINGS_PAGES = [
  { id: 'speed', title: 'Speed', icon: 'gauge', sections: [
    { title: 'Speed limits', fields: [
      { kind: 'num', on: 'speed-limit-down-enabled', key: 'speed-limit-down', label: 'Download', unit: KBS, min: 0 },
      { kind: 'num', on: 'speed-limit-up-enabled', key: 'speed-limit-up', label: 'Upload', unit: KBS, min: 0 },
    ] },
    { title: 'Turtle mode', icon: 'turtle', hint: 'Alternative limits you can turn on from the sidebar or on a schedule.', fields: [
      { kind: 'switch', key: 'alt-speed-enabled', label: 'Turtle mode is on' },
      { kind: 'num', key: 'alt-speed-down', label: 'Download', unit: KBS, min: 0 },
      { kind: 'num', key: 'alt-speed-up', label: 'Upload', unit: KBS, min: 0 },
      { kind: 'switch', key: 'alt-speed-time-enabled', label: 'Turn on at scheduled times' },
      { kind: 'time', key: 'alt-speed-time-begin', label: 'From', dep: 'alt-speed-time-enabled' },
      { kind: 'time', key: 'alt-speed-time-end', label: 'To', dep: 'alt-speed-time-enabled' },
      { kind: 'select', key: 'alt-speed-time-day', label: 'On days', options: DAYS, num: true, dep: 'alt-speed-time-enabled' },
    ] },
  ] },
  { id: 'downloading', title: 'Downloading', icon: 'down', sections: [
    { title: 'Adding', fields: [
      { kind: 'dir', key: 'download-dir', label: 'Save to', freeSpace: true },
      { kind: 'switch', key: 'start-added-torrents', label: 'Start added torrents' },
    ] },
    { title: 'Download queue', fields: [
      { kind: 'num', on: 'download-queue-enabled', key: 'download-queue-size', label: 'Maximum active downloads', min: 1 },
      { kind: 'num', on: 'queue-stalled-enabled', key: 'queue-stalled-minutes', label: 'Inactive if no data shared for', unit: 'min', min: 1 },
    ] },
    { title: 'Incomplete', fields: [
      { kind: 'switch', key: 'rename-partial-files', label: 'Append ".part" to incomplete files’ names' },
      { kind: 'dir', on: 'incomplete-dir-enabled', key: 'incomplete-dir', label: 'Keep incomplete files in' },
    ] },
  ] },
  { id: 'seeding', title: 'Seeding', icon: 'up', sections: [
    { title: 'Limits', fields: [
      { kind: 'num', on: 'seedRatioLimited', key: 'seedRatioLimit', label: 'Stop seeding at ratio', min: 0, step: 0.1, float: true },
      { kind: 'num', on: 'idle-seeding-limit-enabled', key: 'idle-seeding-limit', label: 'Stop seeding if idle for', unit: 'min', min: 1 },
    ] },
    { title: 'Seeding queue', fields: [
      { kind: 'num', on: 'seed-queue-enabled', key: 'seed-queue-size', label: 'Maximum active uploads', min: 1 },
    ] },
  ] },
  { id: 'privacy', title: 'Privacy', icon: 'verify', sections: [
    { title: 'Encryption', fields: [
      { kind: 'select', key: 'encryption', label: 'Encryption mode',
        options: [['tolerated', 'Allow encryption'], ['preferred', 'Prefer encryption'], ['required', 'Require encryption']] },
    ] },
    { title: 'Blocklist', fields: [
      { kind: 'switch', key: 'blocklist-enabled', label: 'Enable blocklist' },
      { kind: 'text', key: 'blocklist-url', label: 'Blocklist URL', type: 'url', placeholder: 'https://…', dep: 'blocklist-enabled' },
      { kind: 'custom', render: () => blocklistHtml() },
    ] },
  ] },
  { id: 'network', title: 'Network', icon: 'globe', sections: [
    { title: 'Incoming peers', fields: [
      { kind: 'custom', render: () => portHtml() },
      { kind: 'switch', key: 'port-forwarding-enabled', label: 'Use UPnP or NAT-PMP port forwarding from my router' },
    ] },
    { title: 'Peer limits', fields: [
      { kind: 'num', key: 'peer-limit-per-torrent', label: 'Maximum peers per torrent', min: 1, max: 1024 },
      { kind: 'num', key: 'peer-limit-global', label: 'Maximum peers overall', min: 1, max: 1024 },
    ] },
    { title: 'Options', fields: [
      { kind: 'switch', key: 'utp-enabled', label: 'Enable µTP for peer connections' },
      { kind: 'switch', key: 'pex-enabled', label: 'Use PEX to find more peers' },
      { kind: 'switch', key: 'dht-enabled', label: 'Use DHT to find more peers' },
      { kind: 'switch', key: 'lpd-enabled', label: 'Use Local Peer Discovery to find more peers' },
    ] },
    { title: 'Default public trackers', hint: 'Added to every public torrent. One per line, with a blank line between tiers.', fields: [
      { kind: 'textarea', key: 'default-trackers', placeholder: 'udp://tracker.example.org:1337/announce' },
    ] },
  ] },
  { id: 'interface', title: 'Interface', icon: 'theme', sections: [
    { title: 'Appearance', hint: 'Saved in this browser only.', fields: [
      { kind: 'select', ui: 'theme', label: 'Theme', options: [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']] },
      { kind: 'select', ui: 'refresh', label: 'Refresh every', num: true,
        options: [[1000, '1 second'], [2000, '2 seconds'], [5000, '5 seconds'], [10000, '10 seconds']] },
    ] },
  ] },
  { id: 'about', title: 'About', icon: 'info', sections: [{ fields: [{ kind: 'custom', render: () => aboutHtml() }] }] },
];
const SET_FIELDS = SETTINGS_PAGES.flatMap((p) => p.sections.flatMap((s) => s.fields)).filter((f) => f.kind !== 'custom');
const fieldId = (f) => f.key || `ui:${f.ui}`;
const FIELD_BY_ID = new Map();
for (const f of SET_FIELDS) {
  FIELD_BY_ID.set(fieldId(f), f);
  if (f.on) FIELD_BY_ID.set(f.on, { kind: 'switch', key: f.on, label: f.label });
}
const SET = { page: 'speed', orig: {}, draft: {}, portResult: null, blocklistBusy: false };

const minToTime = (m) => `${String(Math.floor((m || 0) / 60)).padStart(2, '0')}:${String((m || 0) % 60).padStart(2, '0')}`;
const timeToMin = (t) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function toSubdir(path) {
  const p = String(path || '');
  if (p === BASE_DIR) return '';
  return p.startsWith(`${BASE_DIR}/`) ? p.slice(BASE_DIR.length + 1) : p;
}
function readUiPrefs() {
  const ui = { ...UI_DEFAULTS, theme: currentTheme() };
  try { const r = Number(localStorage.getItem('ug-refresh')); if (r >= 1000) ui.refresh = r; } catch {}
  return ui;
}

async function openSettings(page) {
  try { S.session = await rpc('session-get'); } catch (err) { toast(err.message, true); return; }
  const s = S.session, ui = readUiPrefs();
  SET.orig = {};
  for (const [id, f] of FIELD_BY_ID) {
    if (f.ui) SET.orig[id] = ui[f.ui];
    else if (f.kind === 'dir') SET.orig[id] = toSubdir(s[f.key]);
    else SET.orig[id] = s[f.key];
  }
  SET.draft = { ...SET.orig };
  SET.portResult = null;
  SET.page = typeof page === 'string' ? page : SET.page;
  $('#setMenu').innerHTML = '<div class="set-menu-title">Settings</div>' + SETTINGS_PAGES.map((p) =>
    `<button type="button" class="nav-item" data-page="${p.id}"><span class="ic">${svg(p.icon)}</span><span>${esc(p.title)}</span></button>`).join('');
  renderSettings();
  $('#settingsDlg').showModal();
}

function renderSettings() {
  const page = SETTINGS_PAGES.find((p) => p.id === SET.page) || SETTINGS_PAGES[0];
  $('#setMenu').querySelectorAll('[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === page.id));
  $('#setTitle').textContent = page.title;
  $('#setBody').innerHTML = page.sections.map((sec) => `<section class="set-section">
      ${sec.title ? `<div class="section-title">${sec.icon ? `<span class="ic">${svg(sec.icon)}</span>` : ''}${esc(sec.title)}</div>` : ''}
      ${sec.hint ? `<p class="hint set-hint">${esc(sec.hint)}</p>` : ''}
      ${sec.fields.map(fieldHtml).join('')}
    </section>`).join('');
  $('#setBody').scrollTop = 0;
  if (page.sections.some((sec) => sec.fields.some((f) => f.freeSpace))) updateSetFree();
  renderDirty();
}

function fieldHtml(f) {
  if (f.kind === 'custom') return f.render();
  const id = fieldId(f), v = SET.draft[id];
  const off = (f.dep && !SET.draft[f.dep]) || (f.on && !SET.draft[f.on]);
  const dis = off ? ' disabled' : '';
  const label = f.on
    ? `<label class="set-label check-row"><input type="checkbox" class="switch" data-k="${f.on}" aria-label="${esc(f.label)}"${SET.draft[f.on] ? ' checked' : ''}><span>${esc(f.label)}</span></label>`
    : `<span class="set-label">${esc(f.label || '')}</span>`;
  let ctl = '';
  switch (f.kind) {
    case 'switch':
      return `<label class="set-row set-click"><span class="set-label">${esc(f.label)}</span><input type="checkbox" class="switch" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}"${v ? ' checked' : ''}${dis}></label>`;
    case 'num':
      ctl = `<div class="unit-input"><input type="number" class="input" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}" value="${esc(v ?? '')}" min="${f.min ?? 0}"${f.max ? ` max="${f.max}"` : ''} step="${f.step ?? 1}" inputmode="${f.float ? 'decimal' : 'numeric'}"${dis}>${f.unit ? `<span>${f.unit}</span>` : '<span></span>'}</div>`;
      break;
    case 'select': {
      let opts = f.options;
      if (v != null && !opts.some(([o]) => String(o) === String(v))) opts = [...opts, [v, `Custom (${v})`]];
      ctl = `<select class="input set-select" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}"${dis}>${opts.map(([o, l]) => `<option value="${esc(o)}"${String(o) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      break;
    }
    case 'time':
      ctl = `<input type="time" class="input set-time" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}" value="${minToTime(v)}"${dis}>`;
      break;
    case 'text':
      ctl = `<input type="${f.type || 'text'}" class="input set-text" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}" spellcheck="false" autocomplete="off"${dis}>`;
      break;
    case 'textarea':
      return `<textarea class="input set-area" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}" rows="4" placeholder="${esc(f.placeholder || '')}" spellcheck="false"${dis}>${esc(v ?? '')}</textarea>`;
    case 'dir':
      ctl = `<div class="dir-field set-dir${off ? ' is-off' : ''}"><span class="dir-prefix">${BASE_DIR}/</span><input class="input" data-k="${id}" aria-label="${esc(f.label || 'Default public trackers')}" value="${esc(v ?? '')}" placeholder="(top level)" spellcheck="false" autocomplete="off"${dis}></div>`;
      if (f.freeSpace) return `<div class="set-row">${label}${ctl}</div><p class="hint set-sub" id="setFree">&nbsp;</p>`;
      break;
  }
  return `<div class="set-row">${label}${ctl}</div>`;
}

function portHtml() {
  const port = S.session['peer-port'] ?? '';
  const r = SET.portResult;
  const res = r == null ? '' : r === 'busy' ? 'Testing…'
    : r.error ? `<span class="bad-text">Couldn’t test the port: ${esc(r.error)}</span>`
    : r.open ? '<span class="ok-text">Port is open: other peers can connect to you.</span>'
    : `<span class="bad-text">Port is closed. Forward TCP and UDP ${esc(port)} on your router to the NAS for faster downloads.</span>`;
  return `<div class="set-row"><span class="set-label">Port for incoming connections</span>
      <div class="set-inline"><b class="set-mono">${esc(port)}</b><button type="button" class="btn sm" id="portTest"${r === 'busy' ? ' disabled' : ''}>Test port</button></div></div>
    <p class="hint set-sub">Fixed by the app so it always matches the port UGOS opens for the container.${res ? `<br>${res}` : ''}</p>`;
}

function blocklistHtml() {
  const n = S.session['blocklist-size'] ?? 0;
  return `<div class="set-row"><span class="set-label set-muted">Blocklist contains ${n.toLocaleString()} rule${n === 1 ? '' : 's'}</span>
    <button type="button" class="btn sm" id="blUpdate"${SET.blocklistBusy || !SET.draft['blocklist-url'] ? ' disabled' : ''}>${SET.blocklistBusy ? 'Updating…' : 'Update'}</button></div>`;
}

function aboutHtml() {
  const s = S.session;
  return `<dl class="kv set-kv">
      <dt>Transmission</dt><dd>${esc(s.version || '—')}</dd>
      <dt>RPC version</dt><dd>${esc(s['rpc-version-semver'] || s['rpc-version'] || '—')}</dd>
      <dt>Settings folder</dt><dd class="set-mono">${esc(s['config-dir'] || '—')}</dd>
      <dt>Download folder</dt><dd class="set-mono">${BASE_DIR}</dd>
      <dt>Peer port</dt><dd>${esc(s['peer-port'] ?? '—')}</dd>
    </dl>
    <div class="section-title">Web UI login</div>
    <p class="set-p">The username and password are set when you install the app in App Center (<i>Web UI username</i> and <i>Web UI password</i>). They can’t be changed from here.</p>
    <div class="section-title">Not available on the NAS</div>
    <p class="set-p">Desktop-only options (tray icon, notifications, sounds, watch folder, clipboard detection) don’t apply to a NAS service. Scripts that run when a download finishes aren’t offered either, because they would run inside the container.</p>
    <p class="set-p"><a href="https://transmissionbt.com/" target="_blank" rel="noopener">transmissionbt.com</a></p>`;
}

function changedIds() {
  return [...FIELD_BY_ID.keys()].filter((id) => String(SET.draft[id] ?? '') !== String(SET.orig[id] ?? ''));
}
function renderDirty() {
  const n = changedIds().length;
  $('#setDirty').textContent = n ? `${n} unsaved change${n === 1 ? '' : 's'}` : '';
  SETTINGS_PAGES.forEach((p) => {
    const ids = p.sections.flatMap((s) => s.fields).filter((f) => f.kind !== 'custom').flatMap((f) => [fieldId(f), f.on].filter(Boolean));
    const dirty = ids.some((id) => String(SET.draft[id] ?? '') !== String(SET.orig[id] ?? ''));
    $(`#setMenu [data-page="${p.id}"]`)?.classList.toggle('dirty', dirty);
  });
}

let setFreeTimer = null;
function updateSetFree() {
  clearTimeout(setFreeTimer);
  setFreeTimer = setTimeout(async () => {
    const el = $('#setFree');
    if (!el) return;
    const sub = cleanSubdir(SET.draft['download-dir'] || '');
    if (!validSubdir(sub)) { el.textContent = 'The folder must be inside /downloads.'; return; }
    try { el.textContent = `${fmtBytes((await rpc('free-space', { path: fullDir(sub) }))['size-bytes'])} free`; }
    catch {
      let text = 'New folder: Transmission will create it';
      try { text += ` · ${fmtBytes((await rpc('free-space', { path: BASE_DIR }))['size-bytes'])} free`; } catch {}
      el.textContent = text;
    }
  }, 250);
}

function onSettingInput(e) {
  const el = e.target.closest('[data-k]');
  if (!el) return;
  const id = el.dataset.k, f = FIELD_BY_ID.get(id);
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (f?.kind === 'time') v = timeToMin(el.value);
  else if (f?.kind === 'select' && f.num) v = Number(el.value);
  else v = el.value;
  SET.draft[id] = v;
  // A switch can enable other fields on the page: re-render, keeping focus simple.
  if (el.type === 'checkbox' && e.type === 'change') renderSettings();
  else {
    if (id === 'download-dir') updateSetFree();
    if (id === 'blocklist-url') { const b = $('#blUpdate'); if (b) b.disabled = SET.blocklistBusy || !v; }
    renderDirty();
  }
}

function settingValue(id) {
  const f = FIELD_BY_ID.get(id), v = SET.draft[id];
  if (f.kind === 'num') {
    const n = f.float ? parseFloat(v) : Number(v);
    if (String(v).trim() === '' || !Number.isFinite(n) || (!f.float && !Number.isInteger(n))) throw new Error(`${f.label}: enter a ${f.float ? 'number' : 'whole number'}`);
    if (n < (f.min ?? 0) || (f.max && n > f.max)) throw new Error(`${f.label}: enter a value from ${f.min ?? 0}${f.max ? ` to ${f.max}` : ''}`);
    return n;
  }
  if (f.kind === 'dir') {
    const sub = cleanSubdir(String(v || ''));
    if (!validSubdir(sub)) throw new Error(`${f.label}: the folder must be inside ${BASE_DIR}`);
    return fullDir(sub);
  }
  if (f.kind === 'text' && f.type === 'url' && v && !/^https?:\/\//i.test(v)) throw new Error(`${f.label}: enter an http:// or https:// address`);
  return v;
}

async function saveSettings(e) {
  e.preventDefault();
  const ids = changedIds();
  if (!ids.length) { $('#settingsDlg').close(); return; }
  const args = {}, ui = {};
  try {
    for (const id of ids) {
      const f = FIELD_BY_ID.get(id);
      if (f.ui) ui[f.ui] = SET.draft[id];
      else args[f.key] = settingValue(id);
    }
  } catch (err) {
    const f = FIELD_BY_ID.get(ids.find((id) => { try { settingValue(id); return false; } catch { return !FIELD_BY_ID.get(id).ui; } }));
    const page = f && SETTINGS_PAGES.find((p) => p.sections.some((s) => s.fields.some((x) => fieldId(x) === fieldId(f) || x.on === f.key)));
    if (page && page.id !== SET.page) { SET.page = page.id; renderSettings(); }
    toast(err.message, true);
    return;
  }
  $('#setSave').disabled = true;
  try {
    if (Object.keys(args).length) await rpc('session-set', args);
    if (ui.theme) setTheme(ui.theme);
    if (ui.refresh) { pollMs = ui.refresh; try { localStorage.setItem('ug-refresh', String(ui.refresh)); } catch {} }
    S.session = await rpc('session-get');
    $('#settingsDlg').close();
    toast('Settings saved');
    refresh();
  } catch (err) { toast(`Couldn’t save settings: ${err.message}`, true); }
  finally { $('#setSave').disabled = false; }
}

async function testPort() {
  SET.portResult = 'busy';
  renderSettings();
  try { SET.portResult = { open: !!(await rpc('port-test'))['port-is-open'] }; }
  catch (err) { SET.portResult = { error: err.message }; }
  if ($('#settingsDlg').open && SET.page === 'network') renderSettings();
}

async function updateBlocklist() {
  const url = SET.draft['blocklist-url'];
  if (url && !/^https?:\/\//i.test(url)) { toast('Blocklist URL: enter an http:// or https:// address', true); return; }
  SET.blocklistBusy = true;
  renderSettings();
  try {
    if (url !== SET.orig['blocklist-url']) { await rpc('session-set', { 'blocklist-url': url }); SET.orig['blocklist-url'] = url; }
    const r = await rpc('blocklist-update');
    S.session = { ...S.session, 'blocklist-size': r['blocklist-size'] };
    toast(`Blocklist updated: ${(r['blocklist-size'] ?? 0).toLocaleString()} rules`);
  } catch (err) { toast(`Couldn’t update the blocklist: ${err.message}`, true); }
  SET.blocklistBusy = false;
  if ($('#settingsDlg').open && SET.page === 'privacy') renderSettings();
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

  $('#openLimits').onclick = () => openSettings('speed');
  $('#openSettings').onclick = () => openSettings();
  $('#setMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (b) { SET.page = b.dataset.page; renderSettings(); }
  });
  $('#setBody').addEventListener('input', onSettingInput);
  $('#setBody').addEventListener('change', onSettingInput);
  $('#setBody').addEventListener('click', (e) => {
    if (e.target.closest('#portTest')) testPort();
    if (e.target.closest('#blUpdate')) updateBlocklist();
  });
  $('#settingsForm').addEventListener('submit', saveSettings);
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
  setTheme(currentTheme()); // sync the label with the theme index.html restored

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
