const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const ctx = canvas.getContext('2d');
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const COARSE = matchMedia('(pointer: coarse)').matches;

// Mỗi ván mới đổi 1 theme
const THEMES = [
  { name: 'Neon', bg: ['#12152b', '#090b16'], grid: 'rgba(140,150,255,0.07)', x: '#ff4d6d', o: '#3ddcff', a1: '#7c5cff', a2: '#b14dff', win: '#ffd166', glow: true },
  { name: 'Sakura', bg: ['#2a1622', '#12080f'], grid: 'rgba(255,170,210,0.08)', x: '#ff6fa5', o: '#8ff0c8', a1: '#ff5c9d', a2: '#ff9a8b', win: '#fff1a8', glow: true },
  { name: 'Ocean', bg: ['#0b2640', '#03101d'], grid: 'rgba(120,200,255,0.08)', x: '#ffb347', o: '#4fd1ff', a1: '#1e7bff', a2: '#00c6ff', win: '#ffffff', glow: true },
  { name: 'Forest', bg: ['#14291c', '#07120b'], grid: 'rgba(160,230,170,0.08)', x: '#ff7b54', o: '#9be564', a1: '#25a35a', a2: '#8bd450', win: '#ffe066', glow: true },
  { name: 'Sunset', bg: ['#2e1531', '#120713'], grid: 'rgba(255,170,140,0.08)', x: '#ffd23f', o: '#ff5e99', a1: '#ff6b3d', a2: '#ff2e8a', win: '#ffffff', glow: true },
  { name: 'Cyberpunk', bg: ['#14051f', '#030008'], grid: 'rgba(255,43,214,0.10)', x: '#ff2bd6', o: '#00f0ff', a1: '#ff2bd6', a2: '#7a00ff', win: '#f5ff3b', glow: true },
  { name: 'Giấy kẻ ô', bg: ['#f7f2e6', '#e6dcc7'], grid: 'rgba(70,90,140,0.20)', x: '#d7263d', o: '#1b4f9c', a1: '#c47b2b', a2: '#e0a458', win: '#2a9d4b', glow: false },
  { name: 'Matrix', bg: ['#04180b', '#000000'], grid: 'rgba(57,255,20,0.09)', x: '#39ff14', o: '#e8fff0', a1: '#16a34a', a2: '#22c55e', win: '#39ff14', glow: true },
  { name: 'Lava', bg: ['#2a0e06', '#0d0402'], grid: 'rgba(255,120,60,0.09)', x: '#ff4500', o: '#ffc04d', a1: '#e63e00', a2: '#ff8c1a', win: '#ffffff', glow: true },
  { name: 'Băng giá', bg: ['#1a2a3f', '#0a1220'], grid: 'rgba(200,230,255,0.10)', x: '#a78bfa', o: '#e0f7ff', a1: '#60a5fa', a2: '#a78bfa', win: '#7dd3fc', glow: true },
];
const COLORS = { X: THEMES[0].x, O: THEMES[0].o };
let T = THEMES[0];
let themeIdx = 0;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function applyTheme(i, announce) {
  themeIdx = i;
  T = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
  COLORS.X = T.x; COLORS.O = T.o;
  const r = document.documentElement.style;
  r.setProperty('--x', T.x);
  r.setProperty('--o', T.o);
  r.setProperty('--accent', T.a1);
  r.setProperty('--accent2', T.a2);
  r.setProperty('--gold', T.win);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', T.bg[1]);
  dirty = true;
  if (announce) toast(`Theme mới: ${T.name}`);
}

let socket = null;
let S = null; // game state
let cam = { x: 0, y: 0, s: COARSE ? 44 : 40 }; // world pixel at screen center, cell size
let W = 0, H = 0, dirty = true;
let winLen = 5;
let pending = null; // cell waiting for second tap (confirm mode)
let hover = null;   // mouse hover cell
const anims = new Map(); // "x,y" -> placement time
let winAnimStart = 0;
let modalTimer = null;
let confirmTap = load('confirmTap', COARSE);

function load(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch {} }
function vibrate(p) { try { navigator.vibrate?.(p); } catch {} }

window.lucide?.createIcons();

function newState(mode, winLen) {
  return {
    mode, winLen,
    board: new Map(), moves: [],
    turn: 'X', winner: null, line: null,
    myMark: null, roomId: null,
    players: { X: true, O: true },
    score: { X: 0, O: 0, draw: 0 },
    starter: 'X',
    theme: 0,
  };
}

// Lưu phòng online để reload trang / server restart vẫn vào lại được
function saveSession() {
  if (!S || S.mode !== 'online' || !S.roomId) return;
  try {
    sessionStorage.setItem('caroRoom', JSON.stringify({
      id: S.roomId, mark: S.myMark,
      state: { moves: S.moves, turn: S.turn, winLen: S.winLen, score: S.score, starter: S.starter, theme: S.theme },
    }));
  } catch {}
}
function loadSession(id) {
  try { const v = JSON.parse(sessionStorage.getItem('caroRoom')); return v && v.id === id ? v : null; } catch { return null; }
}
function clearSession() { try { sessionStorage.removeItem('caroRoom'); } catch {} }

// ---------- Menu ----------
document.querySelectorAll('#winLen button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#winLen button').forEach((x) => x.classList.toggle('on', x === b));
  winLen = +b.dataset.v;
}));
document.querySelectorAll('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => start(b.dataset.mode)));
$('#joinBtn').addEventListener('click', () => {
  const id = $('#roomInput').value.trim().split('room=').pop();
  if (id) joinRoom(id);
});
$('#roomInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#joinBtn').click());

function showGame() {
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
  document.body.classList.add('playing');
  hideModal();
  resize();
  centerView();
}

function start(mode) {
  S = newState(mode, winLen);
  anims.clear();
  if (mode === 'online') {
    ensureSocket();
    socket.emit('create', { winLen }, (res) => {
      S.myMark = res.mark;
      S.roomId = res.id;
      history.replaceState(null, '', `?room=${res.id}`);
      applyServer(res.state);
      showGame();
    });
    return;
  }
  applyTheme(S.theme);
  showGame();
  render();
}

function joinRoom(id) {
  ensureSocket();
  const saved = loadSession(id);
  socket.emit(saved ? 'resume' : 'join', saved || id, (res) => {
    if (res.error) {
      $('#menuErr').textContent = res.error;
      clearSession();
      history.replaceState(null, '', location.pathname);
      return;
    }
    S = newState('online', res.state.winLen);
    S.myMark = res.mark;
    S.roomId = res.id;
    anims.clear();
    history.replaceState(null, '', `?room=${res.id}`);
    applyServer(res.state);
    showGame();
  });
}

function ensureSocket() {
  if (socket) return;
  socket = io();
  let connectedBefore = false;
  socket.on('connect', () => {
    // Mất mạng / server deploy lại -> tự vào lại phòng cũ, giữ nguyên bàn cờ
    if (connectedBefore && S?.mode === 'online' && S.roomId) {
      socket.emit('resume', {
        id: S.roomId, mark: S.myMark,
        state: { moves: S.moves, turn: S.turn, winLen: S.winLen, score: S.score, starter: S.starter, theme: S.theme },
      }, (res) => {
        if (res.error) return toast(res.error);
        S.myMark = res.mark;
        applyServer(res.state);
        toast('Đã kết nối lại');
      });
    }
    connectedBefore = true;
  });
  socket.on('state', applyServer);
  socket.on('chat', (m) => toast(`${m.from}: ${m.text}`));
  socket.on('disconnect', () => S?.mode === 'online' && toast('Mất kết nối, đang kết nối lại...'));
}

function applyServer(st) {
  if (!S || S.mode !== 'online') return;
  const prevMoves = S.moves.length;
  const hadWinner = S.winner;
  const hadOpponent = S.players.X && S.players.O;
  S.board = new Map();
  S.moves = st.moves.map(([x, y, p]) => { S.board.set(`${x},${y}`, p); return [x, y, p]; });
  S.turn = st.turn;
  S.winner = st.winner;
  S.line = st.line;
  S.winLen = st.winLen;
  S.players = st.players;
  S.score = st.score;
  if (st.starter) S.starter = st.starter;
  const firstSync = !S.synced;
  S.synced = true;
  if (firstSync || (st.theme ?? 0) !== S.theme) {
    S.theme = st.theme ?? 0;
    applyTheme(S.theme, !firstSync);
  }
  pending = null;
  if (S.moves.length > prevMoves) {
    const [x, y, p] = S.moves.at(-1);
    anims.set(`${x},${y}`, performance.now());
    if (p !== S.myMark) vibrate(15);
  }
  if (prevMoves > 0 && S.moves.length === 0) { anims.clear(); hideModal(); centerView(); }
  if (!hadOpponent && S.players.X && S.players.O && S.roomId) toast('Đối thủ đã vào phòng');
  if (S.winner && !hadWinner) onWin();
  saveSession();
  render();
}

function leaveGame() {
  if (S?.mode === 'online' && socket) { socket.disconnect(); socket = null; }
  clearSession();
  S = null;
  hideModal();
  history.replaceState(null, '', location.pathname);
  document.body.classList.remove('playing');
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  $('#menuErr').textContent = '';
}
$('#backBtn').addEventListener('click', leaveGame);

$('#centerBtn').addEventListener('click', centerView);
$('#confirmBtn').addEventListener('click', () => {
  confirmTap = !confirmTap;
  save('confirmTap', confirmTap);
  pending = null;
  toast(confirmTap ? 'Chạm 2 lần vào ô để đánh' : 'Chạm 1 lần là đánh luôn');
  render();
});
if (!COARSE) $('#confirmBtn').classList.add('hidden');

function rematch() {
  if (!S) return;
  hideModal();
  pending = null;
  if (S.mode === 'online') return socket.emit('rematch');
  if (!S.winner && S.moves.length) S.score.draw++;
  const { mode, winLen, score, starter, theme } = S;
  S = newState(mode, winLen);
  S.score = score;
  S.starter = starter === 'X' ? 'O' : 'X';
  S.turn = S.starter;
  S.theme = theme + 1;
  applyTheme(S.theme, true);
  anims.clear();
  centerView();
  render();
  if (mode === 'bot' && S.turn === 'O') setTimeout(botMove, 400);
}
$('#rematchBtn').addEventListener('click', rematch);
$('#modalRematch').addEventListener('click', rematch);
$('#viewBtn').addEventListener('click', hideModal);

$('#undoBtn').addEventListener('click', () => {
  if (!S || S.mode === 'online' || !S.moves.length) return;
  const n = S.mode === 'bot' ? (S.moves.at(-1)[2] === 'O' ? 2 : 1) : 1;
  for (let i = 0; i < n && S.moves.length; i++) {
    const [x, y] = S.moves.pop();
    S.board.delete(`${x},${y}`);
  }
  if (S.winner) { S.score[S.winner]--; S.winner = null; S.line = null; hideModal(); }
  S.turn = S.moves.length ? (S.moves.at(-1)[2] === 'X' ? 'O' : 'X') : S.starter;
  pending = null;
  if (S.mode === 'bot' && S.turn === 'O') setTimeout(botMove, 300);
  render();
});

function shareUrl() { return `${location.origin}${location.pathname}?room=${S.roomId}`; }
$('#copyBtn').addEventListener('click', async () => {
  const inp = $('#shareLink');
  try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); }
  toast('Đã copy link');
});
if (navigator.share) {
  $('#nativeShareBtn').classList.remove('hidden');
  $('#nativeShareBtn').addEventListener('click', () => {
    navigator.share({ title: 'Caro Vô Hạn', text: 'Vào solo caro với mình nè!', url: shareUrl() }).catch(() => {});
  });
}

// ---------- Win ----------
function onWin() {
  winAnimStart = performance.now();
  const iWon = S.mode === 'online' ? S.winner === S.myMark : S.mode === 'bot' ? S.winner === 'X' : true;
  vibrate(iWon ? [40, 60, 40, 60, 80] : 200);
  let emoji, title, sub;
  if (S.mode === 'local') { emoji = 'trophy'; title = `${S.winner} thắng!`; sub = `${S.winLen} quân liên tiếp`; }
  else if (iWon) { emoji = 'trophy'; title = 'Bạn thắng!'; sub = S.mode === 'bot' ? 'Máy cũng phải chịu thua' : 'Quá đỉnh, đối thủ bó tay'; }
  else { emoji = S.mode === 'bot' ? 'bot' : 'frown'; title = 'Bạn thua!'; sub = S.mode === 'bot' ? 'Máy thắng rồi, gỡ lại không?' : 'Làm ván nữa gỡ lại nào'; }
  $('#modalEmoji').innerHTML = `<i data-lucide="${emoji}"></i>`;
  window.lucide?.createIcons();
  $('#modalTitle').textContent = title;
  $('#modalSub').textContent = sub;
  if (iWon && window.confetti) {
    const c = S.mode === 'local' ? [COLORS[S.winner], T.win, '#ffffff'] : [T.a1, T.a2, T.win, T.x, T.o];
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: c });
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: c });
      confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: c });
    }, 250);
  }
  clearTimeout(modalTimer);
  modalTimer = setTimeout(() => $('#modal').classList.remove('hidden'), 900);
}
function hideModal() { clearTimeout(modalTimer); $('#modal').classList.add('hidden'); }

// ---------- Game logic ----------
function checkWin(board, x, y, p, n) {
  for (const [dx, dy] of DIRS) {
    const line = [[x, y]];
    for (let s = 1; board.get(`${x + dx * s},${y + dy * s}`) === p; s++) line.push([x + dx * s, y + dy * s]);
    for (let s = 1; board.get(`${x - dx * s},${y - dy * s}`) === p; s++) line.unshift([x - dx * s, y - dy * s]);
    if (line.length >= n) return line;
  }
  return null;
}

// '' = can move, 'skip' = silently ignore, other = message
function moveError(x, y) {
  if (!S || S.winner || S.board.has(`${x},${y}`)) return 'skip';
  if (S.mode === 'online') {
    if (!S.players.X || !S.players.O) return 'Đang chờ đối thủ vào phòng...';
    if (S.turn !== S.myMark) return 'Chưa tới lượt bạn!';
  }
  if (S.mode === 'bot' && S.turn !== 'X') return 'skip';
  return '';
}

function myTurnMark() {
  if (!S || S.winner) return null;
  if (S.mode === 'online') return S.players.X && S.players.O && S.turn === S.myMark ? S.myMark : null;
  if (S.mode === 'bot') return S.turn === 'X' ? 'X' : null;
  return S.turn;
}

function tapCell(x, y) {
  const err = moveError(x, y);
  if (err) { if (err !== 'skip') toast(err); return; }
  if (confirmTap && !(pending && pending.x === x && pending.y === y)) {
    pending = { x, y };
    vibrate(8);
    dirty = true;
    return;
  }
  pending = null;
  if (S.mode === 'online') return socket.emit('move', { x, y });
  place(x, y);
  if (S.mode === 'bot' && !S.winner) setTimeout(botMove, 350);
}

function place(x, y) {
  const p = S.turn;
  S.board.set(`${x},${y}`, p);
  S.moves.push([x, y, p]);
  anims.set(`${x},${y}`, performance.now());
  vibrate(12);
  pending = null;
  const line = checkWin(S.board, x, y, p, S.winLen);
  if (line) { S.winner = p; S.line = line; S.score[p]++; onWin(); }
  else S.turn = p === 'X' ? 'O' : 'X';
  render();
}

// ---------- Bot ----------
function lineScore(board, x, y, p, n) {
  let total = 0;
  for (const [dx, dy] of DIRS) {
    let count = 1, open = 0;
    let s = 1;
    while (board.get(`${x + dx * s},${y + dy * s}`) === p) { count++; s++; }
    if (!board.has(`${x + dx * s},${y + dy * s}`)) open++;
    s = 1;
    while (board.get(`${x - dx * s},${y - dy * s}`) === p) { count++; s++; }
    if (!board.has(`${x - dx * s},${y - dy * s}`)) open++;

    if (count >= n) total += 1e9;
    else if (count === n - 1) total += open === 2 ? 1e7 : open === 1 ? 1e5 : 0;
    else if (count === n - 2) total += open === 2 ? 5e4 : open === 1 ? 500 : 0;
    else if (open > 0) total += Math.pow(10, count) * open;
  }
  return total;
}

function botMove() {
  if (!S || S.mode !== 'bot' || S.winner || S.turn !== 'O') return;
  if (!S.moves.length) return place(0, 0);
  const cand = new Set();
  for (const [x, y] of S.moves)
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const k = `${x + dx},${y + dy}`;
        if (!S.board.has(k)) cand.add(k);
      }
  let best = null, bestScore = -1;
  for (const k of cand) {
    const [x, y] = k.split(',').map(Number);
    const sc = lineScore(S.board, x, y, 'O', S.winLen) * 1.1 + lineScore(S.board, x, y, 'X', S.winLen) + Math.random();
    if (sc > bestScore) { bestScore = sc; best = [x, y]; }
  }
  place(best[0], best[1]);
}

// ---------- UI ----------
const pill = (p) => `<span class="pill ${p.toLowerCase()}">${p}</span>`;

function updateUI() {
  if (!S) return;
  const st = $('#status');
  const sc = S.score;
  $('#score').innerHTML = `${pill('X')} ${sc.X}<span style="color:var(--muted)">:</span>${sc.O} ${pill('O')}`;
  $('#undoBtn').classList.toggle('hidden', S.mode === 'online');
  $('#confirmBtn').classList.toggle('on', confirmTap);
  $('#rematchBtn').classList.toggle('pulse', !!S.winner);

  const share = $('#share');
  const waiting = S.mode === 'online' && (!S.players.X || !S.players.O);
  if (waiting && !S.moves.length) {
    share.classList.remove('hidden');
    $('#shareLink').value = shareUrl();
  } else share.classList.add('hidden');

  let text;
  if (S.mode === 'online') {
    const me = S.myMark;
    if (S.winner) text = S.winner === me ? 'Bạn thắng!' : `${pill(S.winner)} thắng`;
    else if (waiting) text = S.moves.length ? `<span class="thinking">Đối thủ đã thoát</span>` : `Bạn là ${pill(me)} <small>· chờ đối thủ</small>`;
    else text = S.turn === me ? `${pill(me)} Lượt của bạn` : `${pill(S.turn)} <span class="thinking">Đối thủ đang nghĩ</span>`;
  } else if (S.mode === 'bot') {
    if (S.winner) text = S.winner === 'X' ? 'Bạn thắng máy!' : 'Máy thắng!';
    else text = S.turn === 'X' ? `${pill('X')} Lượt của bạn` : `${pill('O')} <span class="thinking">Máy đang nghĩ</span>`;
  } else {
    text = S.winner ? `${pill(S.winner)} thắng!` : `${pill(S.turn)} Lượt ${S.turn}`;
  }
  st.innerHTML = text + ` <small>· ${S.winLen} ô</small>`;
  st.classList.toggle('win', !!S.winner);
  st.classList.toggle('myturn', !S.winner && !!myTurnMark() && S.mode !== 'local');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
}

// ---------- Rendering ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
window.addEventListener('resize', resize);

function centerView() {
  if (S && S.moves.length) {
    let sx = 0, sy = 0;
    for (const [x, y] of S.moves) { sx += x; sy += y; }
    cam.x = (sx / S.moves.length + 0.5) * cam.s;
    cam.y = (sy / S.moves.length + 0.5) * cam.s;
  } else {
    cam.x = cam.s / 2; cam.y = cam.s / 2;
  }
  render();
}

function render() { dirty = true; updateUI(); }

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

function drawMark(cx, cy, s, p, scale = 1, alpha = 1, glow = true) {
  const r = (s / 2 - s * 0.22) * scale;
  const mx = cx + s / 2, my = cy + s / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS[p];
  ctx.lineWidth = Math.max(2.5, s * 0.11);
  ctx.lineCap = 'round';
  if (glow && s >= 18) { ctx.shadowColor = COLORS[p]; ctx.shadowBlur = s * 0.35; }
  ctx.beginPath();
  if (p === 'X') {
    ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r);
    ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r);
  } else {
    ctx.arc(mx, my, r, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!S) return;
  let animating = now - winAnimStart < 700;
  for (const [k, t] of anims) { if (now - t < 350) animating = true; else anims.delete(k); }
  if (pending) animating = true;
  if (!dirty && !animating) return;
  dirty = false;

  const s = cam.s;
  const ox = W / 2 - cam.x, oy = H / 2 - cam.y; // screen pos of world origin

  // background with soft vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, T.bg[0]);
  g.addColorStop(1, T.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // grid
  const x0 = Math.floor(-ox / s), x1 = Math.ceil((W - ox) / s);
  const y0 = Math.floor(-oy / s), y1 = Math.ceil((H - oy) / s);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.strokeStyle = T.grid;
  for (let i = x0; i <= x1; i++) { const X = Math.round(ox + i * s) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, H); }
  for (let j = y0; j <= y1; j++) { const Y = Math.round(oy + j * s) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); }
  ctx.stroke();
  // origin marker
  ctx.fillStyle = rgba(T.a1, 0.5);
  ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();

  // last move highlight
  const last = S.moves.at(-1);
  if (last && !S.winner) {
    roundRect(ox + last[0] * s + 3, oy + last[1] * s + 3, s - 5, s - 5, s * 0.18);
    ctx.fillStyle = rgba(COLORS[last[2]], 0.12);
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS[last[2]], 0.45);
    ctx.stroke();
  }

  // win cells
  if (S.line) {
    ctx.fillStyle = rgba(T.win, 0.16);
    for (const [x, y] of S.line) { roundRect(ox + x * s + 3, oy + y * s + 3, s - 5, s - 5, s * 0.18); ctx.fill(); }
  }

  // marks
  const glow = T.glow && S.moves.length < 400;
  for (const [x, y, p] of S.moves) {
    const cx = ox + x * s, cy = oy + y * s;
    if (cx < -s || cy < -s || cx > W || cy > H) continue;
    const t0 = anims.get(`${x},${y}`);
    const k = t0 === undefined ? 1 : Math.min(1, (now - t0) / 300);
    drawMark(cx, cy, s, p, easeOutBack(k), Math.min(1, k * 2), glow);
  }

  // hover / pending preview
  const mine = myTurnMark();
  if (mine) {
    if (pending && !S.board.has(`${pending.x},${pending.y}`)) {
      const cx = ox + pending.x * s, cy = oy + pending.y * s;
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      roundRect(cx + 2, cy + 2, s - 3, s - 3, s * 0.2);
      ctx.strokeStyle = COLORS[mine];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.4 * pulse;
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawMark(cx, cy, s, mine, 0.9, 0.45, false);
    } else if (hover && !S.board.has(`${hover.x},${hover.y}`)) {
      drawMark(ox + hover.x * s, oy + hover.y * s, s, mine, 0.85, 0.25, false);
    }
  }

  // win stroke
  if (S.line) {
    const a = S.line[0], b = S.line.at(-1);
    const t = Math.min(1, (now - winAnimStart) / 600);
    const ax = ox + (a[0] + 0.5) * s, ay = oy + (a[1] + 0.5) * s;
    const bx = ox + (b[0] + 0.5) * s, by = oy + (b[1] + 0.5) * s;
    ctx.save();
    ctx.strokeStyle = T.win;
    ctx.shadowColor = T.win;
    ctx.shadowBlur = 18;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(4, s * 0.13);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t);
    ctx.stroke();
    ctx.restore();
  }
}
requestAnimationFrame(draw);

// ---------- Input: pan / zoom / click ----------
const pts = new Map();
let drag = null, pinch = null;

function zoomAt(px, py, newS) {
  newS = Math.min(120, Math.max(12, newS));
  const wx = (px - W / 2 + cam.x) / cam.s;
  const wy = (py - H / 2 + cam.y) / cam.s;
  cam.s = newS;
  cam.x = wx * newS - (px - W / 2);
  cam.y = wy * newS - (py - H / 2);
  dirty = true;
}
function pinchInfo() {
  const [a, b] = [...pts.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}
function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function cellAt(p) { return { x: Math.floor((p.x - W / 2 + cam.x) / cam.s), y: Math.floor((p.y - H / 2 + cam.y) / cam.s) }; }

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, local(e));
  if (pts.size === 1) {
    const p = local(e);
    drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false };
  } else if (pts.size === 2) {
    drag = null;
    pinch = { ...pinchInfo(), s: cam.s };
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (e.pointerType === 'mouse' && !pts.size) {
    const c = cellAt(p);
    if (!hover || hover.x !== c.x || hover.y !== c.y) { hover = c; dirty = true; }
    return;
  }
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, p);
  if (pinch && pts.size === 2) {
    const info = pinchInfo();
    zoomAt(info.mx, info.my, pinch.s * info.d / pinch.d);
  } else if (drag) {
    const dx = p.x - drag.sx, dy = p.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > (e.pointerType === 'mouse' ? 5 : 10)) { drag.moved = true; hover = null; }
    if (drag.moved) { cam.x = drag.cx - dx; cam.y = drag.cy - dy; dirty = true; }
  }
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (drag && !drag.moved && pts.size === 0 && e.type === 'pointerup') {
    const c = cellAt(local(e));
    tapCell(c.x, c.y);
  }
  if (pts.size < 2) pinch = null;
  if (pts.size === 0) drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = null; dirty = true; } });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = local(e);
  zoomAt(p.x, p.y, cam.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
}, { passive: false });

// ---------- Auto-join from link ----------
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) joinRoom(roomParam);
