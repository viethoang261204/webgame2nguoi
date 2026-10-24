const $ = (s) => document.querySelector(s);
const ROWS = 8, COLS = 14;
const R = ROWS + 2, C = COLS + 2; // lưới có viền trống để đường nối đi vòng ngoài
const TOTAL = (ROWS * COLS) / 2;
const TIME_LIMIT = 10 * 60 * 1000;
const ICONS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐤',
  '🦄', '🐝', '🐞', '🦋', '🐢', '🐙', '🦀', '🐬', '🐳', '🦒', '🦓', '🐘', '🦔', '🦜', '🦩', '🐌'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

let mode = null;   // 'online' | 'solo'
let socket = null;
let slot = 0;      // 0 | 1 (online)
let roomId = null;
let room = null;   // trạng thái phòng (server gửi, hoặc tự tạo khi luyện tập)
let grid = null;   // mảng R*C, 0 = trống
let icons = [];
let roundCur = 0;
let cleared = 0;
let selected = -1;
let hintsLeft = 3, shufflesLeft = 2;
let hintPair = null;
let clockOffset = 0;
let L = null;      // layout
let tileEls = {};
let lastCd = '';

const now = () => Date.now() + clockOffset;
function vibrate(p) { try { navigator.vibrate?.(p); } catch {} }
function fmt(ms) {
  if (ms == null) return '—';
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), d = Math.floor((ms % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}
function fmtShort(ms) {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000), s = Math.ceil((ms % 60000) / 1000);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
function getBest() { try { return +localStorage.getItem('pikaBest') || null; } catch { return null; } }
function setBest(v) { try { localStorage.setItem('pikaBest', v); } catch {} }

window.lucide?.createIcons();

// ---------- Map: sinh ngẫu nhiên theo seed để 2 người cùng 1 map ----------
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleArr(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function genGrid(seed) {
  const rand = rng(seed);
  const tiles = [];
  for (let t = 1; t <= (ROWS * COLS) / 4; t++) for (let k = 0; k < 4; k++) tiles.push(t);
  shuffleArr(tiles, rand);
  const g = new Array(R * C).fill(0);
  let i = 0;
  for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) g[r * C + c] = tiles[i++];
  if (!findAnyMove(g)) shuffleGrid(g, rand);
  return g;
}
function shuffleGrid(g, rand = Math.random) {
  const idx = [];
  for (let i = 0; i < g.length; i++) if (g[i]) idx.push(i);
  if (!idx.length) return;
  const vals = idx.map((i) => g[i]);
  for (let tries = 0; tries < 200; tries++) {
    shuffleArr(vals, rand);
    idx.forEach((i, k) => (g[i] = vals[k]));
    if (findAnyMove(g)) return;
  }
}

// ---------- Tìm đường nối (tối đa 2 lần rẽ) ----------
function clearLine(g, r1, c1, r2, c2) {
  if (r1 === r2) {
    const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
    for (let c = a + 1; c < b; c++) if (g[r1 * C + c]) return false;
    return true;
  }
  if (c1 === c2) {
    const [a, b] = r1 < r2 ? [r1, r2] : [r2, r1];
    for (let r = a + 1; r < b; r++) if (g[r * C + c1]) return false;
    return true;
  }
  return false;
}
function findPath(g, a, b) {
  const ar = Math.floor(a / C), ac = a % C, br = Math.floor(b / C), bc = b % C;
  if (clearLine(g, ar, ac, br, bc)) return [[ar, ac], [br, bc]];
  const oneTurn = (r1, c1) => {
    for (const [r, c] of [[r1, bc], [br, c1]]) {
      if ((r === br && c === bc) || (r === r1 && c === c1)) continue;
      if (g[r * C + c] === 0 && clearLine(g, r1, c1, r, c) && clearLine(g, r, c, br, bc)) return [r, c];
    }
    return null;
  };
  let k = oneTurn(ar, ac);
  if (k) return [[ar, ac], k, [br, bc]];
  let best = null;
  for (const [dr, dc] of DIRS) {
    let r = ar + dr, c = ac + dc;
    while (r >= 0 && r < R && c >= 0 && c < C && g[r * C + c] === 0) {
      k = oneTurn(r, c);
      if (k) {
        const p = [[ar, ac], [r, c], k, [br, bc]];
        const len = Math.abs(r - ar) + Math.abs(c - ac) + Math.abs(k[0] - r) + Math.abs(k[1] - c) + Math.abs(br - k[0]) + Math.abs(bc - k[1]);
        if (!best || len < best.len) best = { p, len };
        break;
      }
      r += dr; c += dc;
    }
  }
  return best ? best.p : null;
}
function findAnyMove(g) {
  const byType = {};
  for (let i = 0; i < g.length; i++) if (g[i]) (byType[g[i]] ||= []).push(i);
  for (const list of Object.values(byType))
    for (let x = 0; x < list.length; x++)
      for (let y = x + 1; y < list.length; y++)
        if (findPath(g, list[x], list[y])) return [list[x], list[y]];
  return null;
}

// ---------- Menu ----------
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mode === 'solo') startSolo();
  else createOnline();
}));
$('#joinBtn').addEventListener('click', () => {
  const id = $('#roomInput').value.trim().split('room=').pop();
  if (id) joinOnline(id);
});
$('#roomInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#joinBtn').click());

function showGame() {
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
  document.body.classList.add('playing');
  requestAnimationFrame(() => { layout(); renderBoard(); });
}
function leaveGame() {
  if (socket) { socket.disconnect(); socket = null; }
  clearSession();
  mode = null; room = null; grid = null; roundCur = 0;
  hideModal();
  history.replaceState(null, '', location.pathname);
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  $('#menuErr').textContent = '';
}
$('#backBtn').addEventListener('click', leaveGame);

// ---------- Luyện tập ----------
function startSolo() {
  mode = 'solo';
  slot = 0;
  clockOffset = 0;
  const prev = room && room.solo ? room : null;
  room = {
    solo: true, state: 'playing',
    round: (prev?.round || 0) + 1,
    seed: Math.floor(Math.random() * 2 ** 31),
    startAt: Date.now() + 3200, endedAt: 0,
    players: [true, false],
    prog: [{ cleared: 0, finishedAt: null, grid: null }, { cleared: 0, finishedAt: null, grid: null }],
    history: prev?.history || [], wins: [0, 0],
  };
  newRound(room, null);
  showGame();
  updateUI();
}
function endSolo(finished) {
  if (room.state !== 'playing') return;
  room.state = 'over';
  room.endedAt = Date.now();
  const t = finished ? room.endedAt - room.startAt : null;
  if (finished) room.prog[0].finishedAt = room.endedAt;
  const best = getBest();
  const record = finished && (!best || t < best);
  if (record) setBest(t);
  room.history.push({ round: room.round, times: [t, null], cleared: [cleared, 0], winner: finished ? 0 : -1, record });
  showResult();
  updateUI();
}

// ---------- Online ----------
function sessionSnap() {
  return {
    round: room?.round, seed: room?.seed, startAt: room?.startAt, endedAt: room?.endedAt, state: room?.state,
    history: room?.history, wins: room?.wins, cleared, grid,
  };
}
function saveSession() {
  if (mode !== 'online' || !roomId) return;
  try { sessionStorage.setItem('pikaRoom', JSON.stringify({ id: roomId, slot, snap: sessionSnap() })); } catch {}
}
function loadSession(id) {
  try { const v = JSON.parse(sessionStorage.getItem('pikaRoom')); return v && v.id === id ? v : null; } catch { return null; }
}
function clearSession() { try { sessionStorage.removeItem('pikaRoom'); } catch {} }

function ensureSocket() {
  if (socket) return;
  socket = io('/pikachu');
  let connectedBefore = false;
  socket.on('connect', () => {
    if (connectedBefore && mode === 'online' && roomId) {
      socket.emit('resume', { id: roomId, slot, snap: sessionSnap() }, (res) => {
        if (res.error) return toast(res.error);
        slot = res.slot;
        onState(res.state);
        toast('Đã kết nối lại ✅');
      });
    }
    connectedBefore = true;
  });
  socket.on('state', onState);
  socket.on('disconnect', () => mode === 'online' && toast('Mất kết nối, đang kết nối lại...'));
}
function enterRoom(res) {
  mode = 'online';
  slot = res.slot;
  roomId = res.id;
  room = null;
  roundCur = 0;
  history.replaceState(null, '', `?room=${res.id}`);
  showGame();
  onState(res.state);
}
function createOnline() {
  ensureSocket();
  socket.emit('create', null, enterRoom);
}
function joinOnline(id) {
  ensureSocket();
  const saved = loadSession(id);
  socket.emit(saved ? 'resume' : 'join', saved || id, (res) => {
    if (res.error) {
      $('#menuErr').textContent = res.error;
      clearSession();
      history.replaceState(null, '', location.pathname);
      return;
    }
    enterRoom(res);
  });
}

function onState(st) {
  if (mode !== 'online') return;
  clockOffset = st.serverNow - Date.now();
  const prev = room;
  room = st;
  if (st.round > 0 && st.round !== roundCur) {
    const saved = st.prog[slot]?.grid;
    newRound(st, saved);
  }
  const opp = 1 - slot;
  if (prev && prev.players[opp] && !st.players[opp]) toast('Đối thủ đã thoát 😢');
  if (prev && !prev.players[opp] && st.players[opp] && st.state !== 'waiting') toast('Đối thủ đã vào lại 🔥');
  if (st.state === 'over' && (!prev || prev.state !== 'over' || prev.round !== st.round)) showResult();
  drawMini();
  updateUI();
  saveSession();
}

function sendProgress() {
  room.prog[slot] = { ...room.prog[slot], cleared, grid: [...grid] };
  if (mode === 'online') socket?.emit('progress', { cleared, grid });
  saveSession();
}

// ---------- Vòng chơi ----------
function newRound(st, savedGrid) {
  roundCur = st.round;
  icons = shuffleArr([...ICONS], rng(st.seed ^ 0x5bd1e995));
  grid = savedGrid ? [...savedGrid] : genGrid(st.seed);
  cleared = (ROWS * COLS - grid.filter(Boolean).length) / 2;
  selected = -1;
  hintPair = null;
  hintsLeft = 3;
  shufflesLeft = 2;
  lastCd = '';
  hideModal();
  if (L) renderBoard();
}

function canPlay() {
  if (!room || !grid || room.state !== 'playing') return false;
  const t = now();
  return t >= room.startAt && t < room.startAt + TIME_LIMIT && cleared < TOTAL;
}

$('#board').addEventListener('click', (e) => {
  const el = e.target.closest('.tile');
  if (!el || !canPlay()) return;
  const i = +el.dataset.i;
  if (!grid[i]) return;
  if (selected === -1) return select(i);
  if (selected === i) return select(-1);
  if (grid[selected] !== grid[i]) return select(i);
  const path = findPath(grid, selected, i);
  if (!path) {
    [selected, i].forEach((k) => {
      const t = tileEls[k];
      t?.classList.remove('wrong'); void t?.offsetWidth; t?.classList.add('wrong');
    });
    vibrate(40);
    return select(i);
  }
  const a = selected;
  select(-1);
  removePair(a, i, path);
});

function select(i) {
  if (selected >= 0) tileEls[selected]?.classList.remove('sel');
  selected = i;
  if (i >= 0) { tileEls[i]?.classList.add('sel'); vibrate(8); }
}

function clearHint() {
  if (!hintPair) return;
  hintPair.forEach((k) => tileEls[k]?.classList.remove('hint'));
  hintPair = null;
}

function removePair(a, b, path) {
  grid[a] = 0; grid[b] = 0;
  cleared++;
  if (hintPair && (hintPair.includes(a) || hintPair.includes(b))) clearHint();
  tileEls[a]?.classList.add('gone');
  tileEls[b]?.classList.add('gone');
  delete tileEls[a]; delete tileEls[b];
  drawPath(path);
  vibrate(15);
  if (cleared >= TOTAL) {
    if (mode === 'solo') endSolo(true);
    else room.prog[slot].finishedAt = now();
  } else if (!findAnyMove(grid)) {
    clearHint();
    shuffleGrid(grid);
    setTimeout(renderBoard, 320);
    toast('Hết nước đi, tự động đảo bài 🔀');
  }
  sendProgress();
  updateUI();
}

$('#hintBtn').addEventListener('click', () => {
  if (!canPlay() || hintsLeft <= 0) return;
  clearHint();
  const m = findAnyMove(grid);
  if (!m) return;
  hintsLeft--;
  hintPair = m;
  m.forEach((k) => tileEls[k]?.classList.add('hint'));
  updateUI();
});
$('#shuffleBtn').addEventListener('click', () => {
  if (!canPlay() || shufflesLeft <= 0) return;
  shufflesLeft--;
  clearHint();
  select(-1);
  shuffleGrid(grid);
  renderBoard();
  sendProgress();
  updateUI();
  toast('Đã đảo bài 🔀');
});

function rematch() {
  hideModal();
  if (mode === 'solo') return startSolo();
  if (mode === 'online' && room?.state !== 'playing') socket?.emit('rematch');
}
$('#rematchBtn').addEventListener('click', rematch);
$('#mRematch').addEventListener('click', rematch);
$('#mClose').addEventListener('click', hideModal);
$('#historyBtn').addEventListener('click', () => showResult(true));

// ---------- Vẽ bàn ----------
function layout() {
  const wrap = $('#boardWrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const tr = h > w * 1.05; // màn dọc: xoay bàn cho to hơn
  const nx = tr ? ROWS : COLS, ny = tr ? COLS : ROWS;
  const tile = Math.max(16, Math.floor(Math.min(w / (nx + 0.8), h / (ny + 0.8))));
  const border = tile * 0.4;
  L = { tr, tile, border, nx, ny, W: nx * tile + border * 2, H: ny * tile + border * 2 };
  const b = $('#board');
  b.style.width = L.W + 'px';
  b.style.height = L.H + 'px';
}
function centerPx(r, c) {
  const x = L.tr ? r : c, y = L.tr ? c : r;
  const f = (v, n) => (v === 0 ? L.border / 2 : v === n + 1 ? L.border + n * L.tile + L.border / 2 : L.border + (v - 1) * L.tile + L.tile / 2);
  return [f(x, L.nx), f(y, L.ny)];
}
function renderBoard() {
  if (!L || !grid) return;
  const b = $('#board');
  b.innerHTML = '';
  tileEls = {};
  const gap = Math.max(1.5, L.tile * 0.05);
  const size = L.tile - gap * 2;
  const frag = document.createDocumentFragment();
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const i = r * C + c;
      if (!grid[i]) continue;
      const [cx, cy] = centerPx(r, c);
      const el = document.createElement('div');
      el.className = 'tile';
      if (i === selected) el.classList.add('sel');
      if (hintPair?.includes(i)) el.classList.add('hint');
      el.dataset.i = i;
      el.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;font-size:${size * 0.66}px`;
      el.innerHTML = `<span>${icons[grid[i] - 1]}</span>`;
      tileEls[i] = el;
      frag.appendChild(el);
    }
  }
  b.appendChild(frag);
}
function drawPath(path) {
  const pts = path.map(([r, c]) => centerPx(r, c).join(',')).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pathsvg');
  svg.setAttribute('width', L.W);
  svg.setAttribute('height', L.H);
  svg.innerHTML = `<polyline points="${pts}" stroke-width="${Math.max(3, L.tile * 0.12)}"/>`;
  $('#board').appendChild(svg);
  setTimeout(() => svg.remove(), 500);
}
window.addEventListener('resize', () => { if (mode) { layout(); renderBoard(); } });

// Bản đồ thu nhỏ của đối thủ
function drawMini() {
  const cv = document.querySelector('#cardOpp .mini');
  if (mode !== 'online' || !room) return;
  const g = room.prog[1 - slot]?.grid || (room.round ? genGrid(room.seed) : null);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!g) return;
  const cw = cv.width / COLS, ch = cv.height / ROWS;
  ctx.fillStyle = 'rgba(255,77,109,0.85)';
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (g[r * C + c]) ctx.fillRect((c - 1) * cw + 0.5, (r - 1) * ch + 0.5, cw - 1, ch - 1);
}

// ---------- UI ----------
function playerTime(i) {
  if (!room || !room.round) return 0;
  const p = room.prog[i];
  if (p?.finishedAt) return p.finishedAt - room.startAt;
  const end = room.state === 'over' ? (room.endedAt || now()) : now();
  return Math.min(TIME_LIMIT, Math.max(0, end - room.startAt));
}

function updateUI() {
  if (!room) return;
  const opp = 1 - slot;
  const me = $('#cardMe'), op = $('#cardOpp');
  const over = room.state === 'over';
  const lastH = over ? room.history.at(-1) : null;

  $('#roundLbl').textContent = room.round ? `Ván ${room.round}` : 'Phòng chờ';
  me.querySelector('.pc-pairs').textContent = `${cleared}/${TOTAL} cặp`;
  me.querySelector('.pc-bar i').style.width = `${(cleared / TOTAL) * 100}%`;
  me.classList.toggle('done', cleared >= TOTAL);
  me.classList.toggle('winner', !!lastH && lastH.winner === slot);

  if (mode === 'solo') {
    me.querySelector('.pc-wins').textContent = '';
    op.querySelector('.pc-name b').textContent = 'Kỷ lục';
    op.querySelector('.pc-wins').textContent = '🏆';
    op.querySelector('.pc-time').textContent = fmt(getBest());
    op.querySelector('.pc-pairs').textContent = 'thời gian tốt nhất';
    op.querySelector('.pc-bar').classList.add('hidden');
    op.querySelector('.mini').classList.add('hidden');
    op.classList.remove('offline', 'done', 'winner');
  } else {
    const p = room.prog[opp] || { cleared: 0 };
    me.querySelector('.pc-wins').textContent = `🏆 ${room.wins[slot]}`;
    op.querySelector('.pc-name b').textContent = 'Đối thủ';
    op.querySelector('.pc-wins').textContent = `🏆 ${room.wins[opp]}`;
    op.querySelector('.pc-pairs').textContent = `${p.cleared}/${TOTAL} cặp`;
    op.querySelector('.pc-bar').classList.remove('hidden');
    op.querySelector('.mini').classList.remove('hidden');
    op.querySelector('.pc-bar i').style.width = `${(p.cleared / TOTAL) * 100}%`;
    op.classList.toggle('offline', !room.players[opp]);
    op.classList.toggle('done', p.cleared >= TOTAL);
    op.classList.toggle('winner', !!lastH && lastH.winner === opp);
  }

  const playing = room.state === 'playing';
  $('#hintCount').textContent = hintsLeft;
  $('#shuffleCount').textContent = shufflesLeft;
  $('#hintBtn').disabled = !playing || hintsLeft <= 0;
  $('#shuffleBtn').disabled = !playing || shufflesLeft <= 0;
  $('#rematchBtn').disabled = playing && mode === 'online';
  $('#rematchBtn').classList.toggle('pulse', over);

  const waiting = mode === 'online' && room.state === 'waiting';
  $('#waiting').classList.toggle('hidden', !waiting);
  if (waiting) $('#shareLink').value = `${location.origin}${location.pathname}?room=${roomId}`;
  $('#board').classList.toggle('locked', !playing);
  tick();
}

function tick() {
  if (!room) return;
  const t = now();
  const opp = 1 - slot;
  $('#cardMe .pc-time').textContent = fmt(playerTime(slot));
  if (mode === 'online') $('#cardOpp .pc-time').textContent = fmt(playerTime(opp));

  const lim = $('#limitLbl');
  const remain = room.round ? (room.state === 'over' ? Math.max(0, TIME_LIMIT - playerTime(slot)) : TIME_LIMIT - Math.max(0, t - room.startAt)) : TIME_LIMIT;
  lim.lastChild.textContent = ' ' + fmtShort(Math.max(0, remain));
  lim.classList.toggle('low', room.state === 'playing' && remain < 30000);

  // đếm ngược 3-2-1
  const cd = $('#countdown');
  const pre = room.state === 'playing' && t < room.startAt;
  $('#board').classList.toggle('pre', pre);
  let label = '';
  if (pre) label = String(Math.ceil((room.startAt - t) / 1000));
  else if (room.state === 'playing' && t - room.startAt < 700) label = 'GO!';
  if (label !== lastCd) {
    lastCd = label;
    cd.classList.toggle('hidden', !label);
    if (label) {
      cd.innerHTML = `<span class="${label === 'GO!' ? 'go' : ''}">${label}</span>`;
      vibrate(label === 'GO!' ? 60 : 20);
    }
  }

  if (mode === 'solo' && room.state === 'playing' && t > room.startAt + TIME_LIMIT) endSolo(false);
}
setInterval(tick, 100);

// ---------- Kết quả / bảng giờ ----------
function confettiBurst() {
  if (!window.confetti) return;
  const colors = ['#ffd60a', '#ff9f1c', '#3ddcff', '#ff4d6d', '#7c5cff'];
  confetti({ particleCount: 130, spread: 85, origin: { y: 0.6 }, colors });
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
  }, 250);
}

function cellResult(h, i) {
  return h.times[i] != null ? fmt(h.times[i]) : `${h.cleared[i]}/${TOTAL} cặp`;
}

function showResult(manual = false) {
  if (!room) return;
  const opp = 1 - slot;
  const h = room.history.at(-1);
  let emoji = '📊', title = 'Bảng thành tích', sub = '';
  if (!manual && h) {
    if (mode === 'solo') {
      if (h.winner === 0) { emoji = h.record ? '🥇' : '🎉'; title = h.record ? 'Kỷ lục mới!' : 'Hoàn thành!'; sub = `Thời gian: ${fmt(h.times[0])}`; }
      else { emoji = '⏰'; title = 'Hết giờ!'; sub = `Ăn được ${h.cleared[0]}/${TOTAL} cặp`; }
    } else if (h.winner === slot) { emoji = '🏆'; title = 'Bạn thắng!'; sub = h.times[slot] != null ? `Ăn hết trong ${fmt(h.times[slot])}` : 'Ăn nhiều cặp hơn khi hết giờ'; }
    else if (h.winner === opp) { emoji = '😵'; title = 'Bạn thua!'; sub = h.times[opp] != null ? `Đối thủ ăn hết trong ${fmt(h.times[opp])}` : 'Đối thủ ăn nhiều cặp hơn'; }
    else { emoji = '🤝'; title = 'Hòa!'; sub = 'Bằng số cặp khi hết giờ'; }
  }
  $('#mEmoji').textContent = emoji;
  $('#mTitle').textContent = title;
  $('#mSub').textContent = sub;

  let html = '';
  if (mode === 'online') {
    html += `<div class="big-score"><div class="me">${room.wins[slot]}<small>Bạn</small></div><span style="color:var(--muted)">–</span><div class="opp">${room.wins[opp]}<small>Đối thủ</small></div></div>`;
  }
  if (h && !manual) {
    html += `<div class="sec-title">Ván ${h.round}</div><table class="rtable"><tr><th>Người chơi</th><th>Thời gian</th><th>Số cặp</th></tr>`;
    const rows = mode === 'solo' ? [[0, 'Bạn', 'me']] : [[slot, 'Bạn', 'me'], [opp, 'Đối thủ', 'opp']];
    for (const [i, name, cls] of rows) {
      const win = h.winner === i;
      html += `<tr><td><span class="tag ${cls}"></span>${name}${win ? ' 👑' : ''}</td><td class="${win ? 'win' : ''}">${h.times[i] != null ? fmt(h.times[i]) : '—'}</td><td>${h.cleared[i]}/${TOTAL}</td></tr>`;
    }
    html += '</table>';
  }
  if (room.history.length) {
    html += `<div class="sec-title">Lịch sử các ván</div><div class="hist-wrap"><table class="rtable">`;
    if (mode === 'solo') {
      html += '<tr><th>Ván</th><th>Kết quả</th><th></th></tr>';
      for (const x of [...room.history].reverse())
        html += `<tr><td>#${x.round}</td><td class="${x.winner === 0 ? 'win' : ''}">${cellResult(x, 0)}</td><td>${x.record ? '🥇 Kỷ lục' : ''}</td></tr>`;
    } else {
      html += '<tr><th>Ván</th><th><span class="tag me"></span>Bạn</th><th><span class="tag opp"></span>Đối thủ</th></tr>';
      for (const x of [...room.history].reverse())
        html += `<tr><td>#${x.round}</td><td class="${x.winner === slot ? 'win' : ''}">${cellResult(x, slot)}</td><td class="${x.winner === opp ? 'win' : ''}">${cellResult(x, opp)}</td></tr>`;
    }
    html += '</table></div>';
  } else if (manual) {
    html += '<p style="margin:8px 0 0">Chưa có ván nào kết thúc.</p>';
  }
  $('#mBody').innerHTML = html;
  $('#mRematch').disabled = room.state === 'playing' && mode === 'online';
  $('#mClose').lastChild.textContent = manual ? ' Đóng' : ' Xem bàn';
  if (!manual && h && ((mode === 'solo' && h.winner === 0) || (mode === 'online' && h.winner === slot))) confettiBurst();
  $('#modal').classList.remove('hidden');
}
function hideModal() { $('#modal').classList.add('hidden'); }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

$('#copyBtn').addEventListener('click', async () => {
  const inp = $('#shareLink');
  try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); }
  toast('Đã copy link! ✅');
});
if (navigator.share) {
  $('#nativeShareBtn').classList.remove('hidden');
  $('#nativeShareBtn').addEventListener('click', () => {
    navigator.share({ title: 'Pikachu Solo', text: 'Vào solo Pikachu với mình nè!', url: $('#shareLink').value }).catch(() => {});
  });
}

// ---------- Vào phòng từ link ----------
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) joinOnline(roomParam);
