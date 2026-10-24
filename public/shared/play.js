// Khung chung cho mọi game 2 người: phòng, người chơi, đồng hồ, kết quả. Mỗi game là module /games/<id>.js
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => window.lucide?.createIcons();

const gameId = location.pathname.split('/').filter(Boolean)[1];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  sget: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
};
const pid = store.sget('playPid') || (() => { const v = crypto.randomUUID?.() || String(Math.random()).slice(2); store.sset('playPid', v); return v; })();
let name = store.get('playName') || `Khách ${Math.floor(1000 + Math.random() * 9000)}`;

let meta = null;
let mod = null;
let socket = null;
let roomId = null;
let view = null;
let aspect = 1;
let lastResultRound = 0;
let clockBase = 0;

// ---------- Tiện ích giao diện ----------
export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `alert alert-${type} py-2 text-sm shadow-lg`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function initials(n) {
  const parts = String(n || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
// băm FNV-1a để tên gần giống nhau vẫn ra màu khác hẳn
function hue(n) {
  let h = 2166136261;
  for (const ch of String(n)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
function fmtClock(ms) {
  if (ms == null) return '';
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Khởi động ----------
async function boot() {
  try {
    meta = await (await fetch(`/api/games/${gameId}`)).json();
    if (meta.error) throw new Error();
  } catch {
    document.body.innerHTML = '<div class="grid min-h-dvh place-items-center text-center"><div><p class="text-lg font-bold">Không tìm thấy game</p><a class="btn btn-primary mt-4" href="/">Về trang chủ</a></div></div>';
    return;
  }
  document.title = `${meta.name} · Game Cùng Bạn`;
  $('#gTitle').textContent = meta.name;
  $('#gSub').textContent = meta.desc;
  $('#setupTitle').textContent = meta.name;
  $('#setupDesc').textContent = meta.desc;
  $('#setupThumb').src = `/assets/thumbs/${gameId}.webp`;
  $('#rulesName').textContent = meta.name;
  $('#rulesList').innerHTML = meta.rules.map((r) => `<li>${esc(r)}</li>`).join('');
  $('#createLocal').classList.toggle('hidden', !meta.local);
  $('#nameInput').value = name;
  renderSettings();

  mod = (await import(`/games/${gameId}.js`)).default;
  mod.mount?.({ board: $('#board'), controls: $('#controls'), side: $('#side') }, api);

  const room = new URLSearchParams(location.search).get('room');
  if (room) join(room.toLowerCase());
  else show('setup');
  icons();
}

function show(which) {
  $('#setup').classList.toggle('hidden', which !== 'setup');
  $('#game').classList.toggle('hidden', which !== 'game');
  if (which === 'game') requestAnimationFrame(fit);
}

function renderSettings() {
  const saved = JSON.parse(store.get(`settings:${gameId}`) || '{}');
  $('#settingsForm').innerHTML = Object.entries(meta.settings).map(([k, def]) => `
    <label class="form-control">
      <div class="label py-1"><span class="label-text text-neutral-content/80">${esc(def.label)}</span></div>
      <select class="select select-bordered" data-setting="${k}">
        ${def.options.map(([v, l]) => `<option value="${v}" ${(saved[k] ?? def.default) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </label>`).join('');
}
function readSettings() {
  const out = {};
  document.querySelectorAll('[data-setting]').forEach((el) => { out[el.dataset.setting] = Number(el.value); });
  store.set(`settings:${gameId}`, JSON.stringify(out));
  return out;
}

// ---------- Kết nối ----------
function ensureSocket() {
  if (socket) return;
  socket = io('/play');
  let connectedBefore = false;
  socket.on('connect', () => {
    if (connectedBefore && roomId) {
      socket.emit('join', { id: roomId, pid, name, game: gameId, seal: store.sget(`seal:${roomId}`) }, (res) => {
        if (res?.error) toast(res.error, 'error'); else toast('Đã kết nối lại', 'success');
      });
    }
    connectedBefore = true;
  });
  socket.on('state', onState);
  socket.on('disconnect', () => roomId && toast('Mất kết nối, đang thử lại...', 'warning'));
}

function saveName() {
  name = $('#nameInput').value.trim() || name;
  store.set('playName', name);
}

function create(local) {
  saveName();
  ensureSocket();
  socket.emit('create', { game: gameId, pid, name, local, settings: readSettings() }, (res) => {
    if (res?.error) return ($('#setupErr').textContent = res.error);
    enter(res.id);
  });
}

function join(id) {
  ensureSocket();
  socket.emit('join', { id, pid, name, game: gameId, seal: store.sget(`seal:${id}`) }, (res) => {
    if (res?.error) {
      if (res.game) { location.href = `/g/${res.game}/?room=${id}`; return; }
      show('setup');
      $('#setupErr').textContent = res.error;
      history.replaceState(null, '', location.pathname);
      return;
    }
    enter(res.id);
  });
}

function enter(id) {
  roomId = id;
  history.replaceState(null, '', `?room=${id}`);
  $('#roomChip').textContent = id;
  $('#roomChip').classList.remove('hidden');
  show('game');
}

$('#createOnline').addEventListener('click', () => create(false));
$('#createLocal').addEventListener('click', () => create(true));
$('#joinBtn').addEventListener('click', () => {
  const id = $('#joinInput').value.trim().split('room=').pop().toLowerCase();
  if (id) { saveName(); join(id); }
});
$('#joinInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#joinBtn').click());

// ---------- API cho module game ----------
const api = {
  toast,
  icons,
  esc,
  get view() { return view; },
  get meta() { return meta; },
  move(m) {
    return new Promise((resolve) => {
      socket.emit('move', m, (res) => {
        if (res?.error) toast(res.error, 'error');
        resolve(!res?.error);
      });
    });
  },
  setAspect(a) { aspect = a; fit(); },
  sideColor: (seat) => meta.sides[seat]?.color,
  sideName: (seat) => meta.sides[seat]?.name,
};

// ---------- Trạng thái ----------
function mySeatNum() {
  if (!view) return 0;
  return view.seat === 'both' || view.seat === null ? 0 : view.seat;
}
function canMove(v) {
  if (!v || v.result || !v.ready) return false;
  if (v.seat === 'both') return true;
  if (v.seat === null) return false;
  return v.turn === v.seat || v.turn === 'both';
}

function onState(v) {
  const prev = view;
  view = v;
  view.canMove = canMove(v);
  view.flip = v.seat === 1;
  view.me = mySeatNum();
  clockBase = Date.now();
  if (v.seal) store.sset(`seal:${v.id}`, v.seal);
  if (prev && !prev.ready && v.ready && !v.local) toast('Đối thủ đã vào phòng', 'success');
  renderPlayers();
  renderStatus();
  renderWaiting();
  mod.render(view, prev);
  if (v.result && lastResultRound !== v.round) {
    lastResultRound = v.round;
    setTimeout(showResult, 700);
  }
  if (!v.result && $('#resultDlg').open) $('#resultDlg').close();
  icons();
}

function playerHtml(seat) {
  const p = view.players[seat];
  const side = meta.sides[seat];
  const isMe = view.seat === seat;
  const active = !view.result && view.ready && (view.turn === seat || view.turn === 'both');
  const nm = view.local ? `Người chơi ${side.name}` : p ? p.name : 'Đang chờ...';
  const clock = view.clocks ? `<div class="clock ${view.clockOn && view.turn === seat ? 'running' : ''}" data-clock="${seat}">${fmtClock(view.clocks[seat])}</div>` : '';
  const extra = mod.info ? mod.info(view, seat) : '';
  return `
    <div class="avatar-ini" style="background:hsl(${hue(nm)} 55% 42%)">${esc(initials(nm))}</div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="truncate font-semibold">${esc(nm)}</span>
        ${isMe && !view.local ? '<span class="badge badge-primary badge-sm">Bạn</span>' : ''}
        ${p && !p.online && !view.local ? '<span class="badge badge-ghost badge-sm">Mất kết nối</span>' : ''}
      </div>
      <div class="flex items-center gap-2 text-xs text-neutral-content/70">
        <span class="inline-block h-3 w-3 rounded-full ring-1 ring-white/30" style="background:${side.color}"></span>${esc(side.name)}
        ${extra ? `<span class="text-neutral-content/40">·</span>${extra}` : ''}
      </div>
    </div>
    <div class="text-right text-xs text-neutral-content/60"><div class="text-lg font-bold text-base-content num">${view.score[seat]}</div>thắng</div>
    ${clock}`;
}

function renderPlayers() {
  const bottom = view.flip ? 1 : 0;
  for (const [el, seat] of [[$('#pBottom'), bottom], [$('#pTop'), 1 - bottom]]) {
    el.innerHTML = playerHtml(seat);
    el.classList.toggle('active', !view.result && view.ready && (view.turn === seat || view.turn === 'both'));
  }
}

function seatLabel(seat) {
  if (view.local) return meta.sides[seat].name;
  if (view.seat === seat) return 'Bạn';
  return view.players[seat]?.name || meta.sides[seat].name;
}

function renderStatus() {
  const v = view;
  let html;
  if (!v.ready) {
    html = `<div class="flex items-center gap-3"><span class="loading loading-dots loading-md text-primary"></span><div><div class="font-semibold">Đang chờ đối thủ</div><div class="text-sm text-neutral-content/60">Gửi link phòng cho bạn bè</div></div></div>`;
  } else if (v.result) {
    const w = v.result.winner;
    const title = w === -1 ? 'Hòa' : v.local ? `${meta.sides[w].name} thắng` : w === v.seat ? 'Bạn thắng' : v.seat === null ? `${seatLabel(w)} thắng` : 'Bạn thua';
    const reb = v.rematch.filter(Boolean).length;
    html = `<div class="font-bold text-lg">${esc(title)}</div><div class="text-sm text-neutral-content/70">${esc(v.result.reason)}</div>
      ${!v.local && reb === 1 ? `<div class="mt-2 text-sm text-primary">${v.rematch[v.seat] ? 'Đang chờ đối thủ đồng ý chơi lại...' : 'Đối thủ muốn chơi ván mới'}</div>` : ''}`;
  } else {
    const custom = mod.status?.(v);
    const t = v.turn;
    const who = t === 'both' ? 'Cả hai bên' : seatLabel(t);
    const mine = v.canMove && v.seat !== 'both';
    html = custom || `<div class="flex items-center gap-3">
      <span class="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white/30" style="background:${t === 'both' ? '#94a3b8' : meta.sides[t].color}"></span>
      <div><div class="font-semibold">${mine ? 'Đến lượt bạn' : v.local ? `Lượt của ${esc(who)}` : `Lượt của ${esc(who)}`}</div>
      <div class="text-sm text-neutral-content/60">Ván ${v.round}${v.draws ? ` · ${v.draws} ván hòa` : ''}</div></div></div>`;
    if (v.drawOffer !== null && !v.local) {
      html += v.drawOffer === v.seat
        ? '<div class="mt-3 text-sm text-neutral-content/70">Đã gửi lời xin hòa...</div>'
        : `<div class="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-sm"><span class="flex-1">Đối thủ xin hòa</span>
            <button class="btn btn-primary btn-xs" data-draw="accept">Đồng ý</button><button class="btn btn-ghost btn-xs" data-draw="decline">Từ chối</button></div>`;
    }
  }
  $('#status').innerHTML = html;
  const playing = v.ready && !v.result && v.seat !== null;
  $('#drawBtn').disabled = !playing || (v.drawOffer !== null && !v.local);
  $('#resignBtn').disabled = !playing;
  $('#rematchBtn').disabled = !v.result || v.seat === null;
  $('#rematchBtn').classList.toggle('btn-primary', !!v.result);
  $('#rematchBtn').classList.toggle('btn-ghost', !v.result);
}

function renderWaiting() {
  const waiting = !view.ready && !view.local;
  $('#waiting').classList.toggle('hidden', !waiting);
  $('#waiting').classList.toggle('grid', waiting);
  if (!waiting) return;
  const url = `${location.origin}${location.pathname}?room=${roomId}`;
  if ($('#shareLink').value !== url) {
    $('#shareLink').value = url;
    $('#qr').innerHTML = '';
    if (window.QRCode) new window.QRCode($('#qr'), { text: url, width: 148, height: 148, correctLevel: window.QRCode.CorrectLevel.M });
  }
}

function showResult() {
  const v = view;
  if (!v?.result) return;
  const w = v.result.winner;
  let title, tone;
  if (w === -1) { title = 'Hòa cờ'; tone = 'bg-neutral text-neutral-content'; }
  else if (v.local || v.seat === null) { title = `${v.local ? meta.sides[w].name : seatLabel(w)} thắng`; tone = 'bg-primary/20 text-primary'; }
  else if (w === v.seat) { title = 'Chiến thắng'; tone = 'bg-success/20 text-success'; }
  else { title = 'Thất bại'; tone = 'bg-error/20 text-error'; }
  $('#resIcon').className = `mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl ${tone}`;
  $('#resIcon').innerHTML = `<i data-lucide="${w === -1 ? 'equal' : (w === v.seat || v.local) ? 'trophy' : 'shield-x'}" class="h-8 w-8"></i>`;
  $('#resTitle').textContent = title;
  $('#resReason').textContent = v.result.reason;
  const bottom = v.flip ? 1 : 0;
  const cell = (seat) => `<div class="text-center"><div class="text-3xl font-extrabold num">${v.score[seat]}</div><div class="max-w-28 truncate text-xs text-neutral-content/60">${esc(seatLabel(seat))}</div></div>`;
  $('#resScore').innerHTML = `${cell(bottom)}<div class="text-2xl text-neutral-content/30">:</div>${cell(1 - bottom)}`;
  $('#resRematch').classList.toggle('hidden', v.seat === null);
  icons();
  $('#resultDlg').showModal();
}

// ---------- Nút chung ----------
$('#status').addEventListener('click', (e) => { const b = e.target.closest('[data-draw]'); if (b) socket.emit('draw', b.dataset.draw); });
$('#drawBtn').addEventListener('click', () => {
  if (view?.local && !confirm('Xác nhận hai bên đồng ý hòa?')) return;
  socket.emit('draw', 'offer');
  if (!view?.local) toast('Đã gửi lời xin hòa');
});
$('#resignBtn').addEventListener('click', () => { if (confirm('Bạn chắc chắn muốn đầu hàng?')) socket.emit('resign'); });
const rematch = () => { socket.emit('rematch'); $('#resultDlg').close(); };
$('#rematchBtn').addEventListener('click', rematch);
$('#resRematch').addEventListener('click', rematch);
$('#rulesBtn').addEventListener('click', () => $('#rulesDlg').showModal());
const shareUrl = () => `${location.origin}${location.pathname}?room=${roomId}`;
async function copyLink() {
  try { await navigator.clipboard.writeText(shareUrl()); toast('Đã copy link phòng', 'success'); } catch { toast(shareUrl()); }
}
$('#roomChip').addEventListener('click', copyLink);
document.querySelector('[data-copy]').addEventListener('click', copyLink);
if (navigator.share) {
  const b = document.querySelector('[data-share]');
  b.classList.remove('hidden');
  b.addEventListener('click', () => navigator.share({ title: meta.name, text: `Vào chơi ${meta.name} với mình nhé`, url: shareUrl() }).catch(() => {}));
}

// ---------- Đồng hồ chạy ----------
setInterval(() => {
  if (!view?.clocks || !view.clockOn) return;
  const el = document.querySelector(`[data-clock="${view.turn}"]`);
  if (!el) return;
  const ms = view.clocks[view.turn] - (Date.now() - clockBase);
  el.textContent = fmtClock(ms);
  el.classList.toggle('low', ms < 20000);
}, 200);

// ---------- Co giãn bàn cờ vừa màn hình ----------
function fit() {
  const wrap = $('#boardWrap');
  if (!wrap || $('#game').classList.contains('hidden')) return;
  const w = wrap.clientWidth;
  const desktop = window.innerWidth >= 1024;
  const reserved = desktop ? 64 + 2 * 64 + 40 : 56 + 2 * 60 + 36;
  const h = Math.max(240, window.innerHeight - reserved);
  const width = Math.floor(Math.min(w, h * aspect));
  const b = $('#board');
  b.style.width = `${width}px`;
  b.style.height = `${Math.floor(width / aspect)}px`;
  mod?.resize?.(width, Math.floor(width / aspect));
}
window.addEventListener('resize', fit);

boot();
