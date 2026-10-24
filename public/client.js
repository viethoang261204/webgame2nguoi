const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const ctx = canvas.getContext('2d');
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const COLORS = { X: '#ff5a6e', O: '#4cc9f0' };

let socket = null;
let S = null; // game state
let cam = { x: 20, y: 20, s: 40 }; // world pixel at screen center, cell size
let W = 0, H = 0, dirty = true;

function newState(mode, winLen) {
  return {
    mode, winLen,
    board: new Map(), moves: [],
    turn: 'X', winner: null, line: null,
    myMark: null, roomId: null,
    players: { X: true, O: true },
    score: { X: 0, O: 0, draw: 0 },
    starter: 'X',
  };
}

// ---------- Menu ----------
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
  resize();
  centerView();
}

function start(mode) {
  const winLen = +$('#winLen').value;
  S = newState(mode, winLen);
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
  showGame();
  render();
}

function joinRoom(id) {
  ensureSocket();
  socket.emit('join', id, (res) => {
    if (res.error) {
      $('#menuErr').textContent = res.error;
      history.replaceState(null, '', location.pathname);
      return;
    }
    S = newState('online', res.state.winLen);
    S.myMark = res.mark;
    S.roomId = res.id;
    history.replaceState(null, '', `?room=${res.id}`);
    applyServer(res.state);
    showGame();
  });
}

function ensureSocket() {
  if (socket) return;
  socket = io();
  socket.on('state', applyServer);
  socket.on('chat', (m) => toast(`${m.from}: ${m.text}`));
  socket.on('disconnect', () => S?.mode === 'online' && toast('Mất kết nối server...'));
}

function applyServer(st) {
  if (!S || S.mode !== 'online') return;
  const prevMoves = S.moves.length;
  S.board = new Map();
  S.moves = st.moves.map(([x, y, p]) => { S.board.set(`${x},${y}`, p); return [x, y, p]; });
  S.turn = st.turn;
  S.winner = st.winner;
  S.line = st.line;
  S.winLen = st.winLen;
  S.players = st.players;
  S.score = st.score;
  if (prevMoves > 0 && S.moves.length === 0) centerView();
  render();
}

$('#backBtn').addEventListener('click', () => {
  if (S?.mode === 'online' && socket) { socket.disconnect(); socket = null; }
  S = null;
  history.replaceState(null, '', location.pathname);
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  $('#menuErr').textContent = '';
});

$('#centerBtn').addEventListener('click', centerView);
$('#rematchBtn').addEventListener('click', () => {
  if (!S) return;
  if (S.mode === 'online') return socket.emit('rematch');
  if (!S.winner && S.moves.length) S.score.draw++;
  const { mode, winLen, score, starter } = S;
  S = newState(mode, winLen);
  S.score = score;
  // local: alternate who starts; bot: player always X, alternate starter
  S.starter = starter === 'X' ? 'O' : 'X';
  S.turn = S.starter;
  centerView();
  render();
  if (mode === 'bot' && S.turn === 'O') setTimeout(botMove, 300);
});
$('#undoBtn').addEventListener('click', () => {
  if (!S || S.mode === 'online' || !S.moves.length) return;
  const n = S.mode === 'bot' ? (S.moves.at(-1)[2] === 'O' ? 2 : 1) : 1;
  for (let i = 0; i < n && S.moves.length; i++) {
    const [x, y] = S.moves.pop();
    S.board.delete(`${x},${y}`);
  }
  if (S.winner) { S.score[S.winner]--; S.winner = null; S.line = null; }
  S.turn = S.moves.length ? (S.moves.at(-1)[2] === 'X' ? 'O' : 'X') : S.starter;
  if (S.mode === 'bot' && S.turn === 'O') setTimeout(botMove, 300);
  render();
});
$('#copyBtn').addEventListener('click', async () => {
  const inp = $('#shareLink');
  try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); }
  toast('Đã copy link!');
});

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

function tryPlace(x, y) {
  if (!S || S.winner || S.board.has(`${x},${y}`)) return;
  if (S.mode === 'online') {
    if (!S.players.X || !S.players.O) return toast('Đang chờ đối thủ vào phòng...');
    if (S.turn !== S.myMark) return toast('Chưa tới lượt bạn!');
    socket.emit('move', { x, y });
    return;
  }
  if (S.mode === 'bot' && S.turn !== 'X') return;
  place(x, y);
  if (S.mode === 'bot' && !S.winner) setTimeout(botMove, 250);
}

function place(x, y) {
  const p = S.turn;
  S.board.set(`${x},${y}`, p);
  S.moves.push([x, y, p]);
  const line = checkWin(S.board, x, y, p, S.winLen);
  if (line) { S.winner = p; S.line = line; S.score[p]++; }
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
function mark(p) { return `<span class="${p.toLowerCase()}">${p}</span>`; }

function updateUI() {
  if (!S) return;
  const st = $('#status');
  const sc = S.score;
  $('#score').innerHTML = `${mark('X')} ${sc.X} : ${sc.O} ${mark('O')}`;
  $('#undoBtn').classList.toggle('hidden', S.mode === 'online');

  const share = $('#share');
  if (S.mode === 'online' && (!S.players.X || !S.players.O)) {
    share.classList.remove('hidden');
    $('#shareLink').value = `${location.origin}${location.pathname}?room=${S.roomId}`;
  } else share.classList.add('hidden');

  let text;
  if (S.mode === 'online') {
    const me = S.myMark;
    if (S.winner) text = S.winner === me ? `🎉 Bạn thắng! (${mark(me)})` : `😢 Bạn thua! ${mark(S.winner)} thắng`;
    else if (!S.players.X || !S.players.O) text = S.moves.length ? 'Đối thủ đã thoát, chờ vào lại...' : `Bạn là ${mark(me)} · Chờ đối thủ...`;
    else text = S.turn === me ? `Lượt bạn ${mark(me)}` : `Lượt đối thủ ${mark(S.turn)}`;
  } else if (S.mode === 'bot') {
    if (S.winner) text = S.winner === 'X' ? '🎉 Bạn thắng máy!' : '🤖 Máy thắng!';
    else text = S.turn === 'X' ? `Lượt bạn ${mark('X')}` : '🤖 Máy đang nghĩ...';
  } else {
    text = S.winner ? `🎉 ${mark(S.winner)} thắng!` : `Lượt ${mark(S.turn)}`;
  }
  st.innerHTML = text + ` <small style="color:var(--muted);font-weight:400">· ${S.winLen} ô</small>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
}

// ---------- Rendering ----------
function resize() {
  const dpr = window.devicePixelRatio || 1;
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

function draw() {
  requestAnimationFrame(draw);
  if (!dirty || !S) return;
  dirty = false;
  const s = cam.s;
  const ox = W / 2 - cam.x, oy = H / 2 - cam.y; // screen pos of world origin
  ctx.fillStyle = '#0f1220';
  ctx.fillRect(0, 0, W, H);

  // grid
  const x0 = Math.floor(-ox / s), x1 = Math.ceil((W - ox) / s);
  const y0 = Math.floor(-oy / s), y1 = Math.ceil((H - oy) / s);
  ctx.beginPath();
  ctx.strokeStyle = '#232945';
  ctx.lineWidth = 1;
  for (let i = x0; i <= x1; i++) { const X = Math.round(ox + i * s) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, H); }
  for (let j = y0; j <= y1; j++) { const Y = Math.round(oy + j * s) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); }
  ctx.stroke();

  // last move highlight
  const last = S.moves.at(-1);
  if (last) {
    ctx.fillStyle = 'rgba(124,92,255,0.22)';
    ctx.fillRect(ox + last[0] * s + 1, oy + last[1] * s + 1, s - 1, s - 1);
  }

  // win line cells
  if (S.line) {
    ctx.fillStyle = 'rgba(255,215,0,0.18)';
    for (const [x, y] of S.line) ctx.fillRect(ox + x * s + 1, oy + y * s + 1, s - 1, s - 1);
  }

  // marks
  const pad = s * 0.22;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.1);
  for (const [x, y, p] of S.moves) {
    const cx = ox + x * s, cy = oy + y * s;
    if (cx < -s || cy < -s || cx > W || cy > H) continue;
    ctx.strokeStyle = COLORS[p];
    ctx.beginPath();
    if (p === 'X') {
      ctx.moveTo(cx + pad, cy + pad); ctx.lineTo(cx + s - pad, cy + s - pad);
      ctx.moveTo(cx + s - pad, cy + pad); ctx.lineTo(cx + pad, cy + s - pad);
    } else {
      ctx.arc(cx + s / 2, cy + s / 2, s / 2 - pad, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  // win stroke
  if (S.line) {
    const a = S.line[0], b = S.line.at(-1);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = Math.max(3, s * 0.12);
    ctx.beginPath();
    ctx.moveTo(ox + (a[0] + 0.5) * s, oy + (a[1] + 0.5) * s);
    ctx.lineTo(ox + (b[0] + 0.5) * s, oy + (b[1] + 0.5) * s);
    ctx.stroke();
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
  if (!pts.has(e.pointerId)) return;
  const p = local(e);
  pts.set(e.pointerId, p);
  if (pinch && pts.size === 2) {
    const info = pinchInfo();
    zoomAt(info.mx, info.my, pinch.s * info.d / pinch.d);
  } else if (drag) {
    const dx = p.x - drag.sx, dy = p.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved) { cam.x = drag.cx - dx; cam.y = drag.cy - dy; dirty = true; }
  }
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (drag && !drag.moved && pts.size === 0 && e.type === 'pointerup') {
    const p = local(e);
    const x = Math.floor((p.x - W / 2 + cam.x) / cam.s);
    const y = Math.floor((p.y - H / 2 + cam.y) / cam.s);
    tryPlace(x, y);
  }
  if (pts.size < 2) pinch = null;
  if (pts.size === 0) drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = local(e);
  zoomAt(p.x, p.y, cam.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
}, { passive: false });

// ---------- Auto-join from link ----------
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) joinRoom(roomParam);
