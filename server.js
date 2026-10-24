const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));

require('./games/pikachu')(io);

// ---------- Các game 2 người dùng engine chung: /g/<game>/ ----------
const { RULES } = require('./games/engine');
require('./games/engine')(io, app);
app.get('/g/:game', (req, res, next) => {
  if (!RULES[req.params.game]) return next();
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

// ---------- Caro (namespace mặc định) ----------
const rooms = new Map();
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

function genId() {
  let id;
  do id = Math.random().toString(36).slice(2, 8);
  while (rooms.has(id));
  return id;
}

function checkWin(board, x, y, p, n) {
  for (const [dx, dy] of DIRS) {
    const line = [[x, y]];
    for (let s = 1; board.get(`${x + dx * s},${y + dy * s}`) === p; s++) line.push([x + dx * s, y + dy * s]);
    for (let s = 1; board.get(`${x - dx * s},${y - dy * s}`) === p; s++) line.unshift([x - dx * s, y - dy * s]);
    if (line.length >= n) return line;
  }
  return null;
}

function publicState(room) {
  return {
    id: room.id,
    moves: room.moves,
    turn: room.turn,
    winLen: room.winLen,
    winner: room.winner,
    line: room.line,
    players: { X: !!room.players.X, O: !!room.players.O },
    score: room.score,
    starter: room.starter,
    theme: room.theme,
  };
}

function makeRoom(id, winLen) {
  return {
    id, winLen,
    players: { X: null, O: null },
    board: new Map(), moves: [],
    turn: 'X', starter: 'X',
    winner: null, line: null,
    score: { X: 0, O: 0, draw: 0 },
    theme: 0,
    cleanup: null,
  };
}

// Rebuild a room from a client's copy (after a server restart / redeploy)
function restoreRoom(id, st) {
  const winLen = [3, 4, 5, 6].includes(st?.winLen) ? st.winLen : 5;
  const room = makeRoom(id, winLen);
  const isMark = (p) => p === 'X' || p === 'O';
  for (const m of Array.isArray(st?.moves) ? st.moves.slice(0, 20000) : []) {
    if (!Array.isArray(m) || !Number.isInteger(m[0]) || !Number.isInteger(m[1]) || !isMark(m[2])) continue;
    const key = `${m[0]},${m[1]}`;
    if (room.board.has(key)) continue;
    room.board.set(key, m[2]);
    room.moves.push([m[0], m[1], m[2]]);
  }
  if (isMark(st?.turn)) room.turn = st.turn;
  if (isMark(st?.starter)) room.starter = st.starter;
  const last = room.moves.at(-1);
  if (last) {
    const line = checkWin(room.board, last[0], last[1], last[2], winLen);
    if (line) { room.winner = last[2]; room.line = line; }
  }
  const n = (v) => (Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0);
  room.score = { X: n(st?.score?.X), O: n(st?.score?.O), draw: n(st?.score?.draw) };
  room.theme = n(st?.theme);
  return room;
}

function resetRoom(room) {
  room.board = new Map();
  room.moves = [];
  room.winner = null;
  room.line = null;
  room.starter = room.starter === 'X' ? 'O' : 'X';
  room.turn = room.starter;
  room.theme++;
}

io.on('connection', (socket) => {
  socket.on('create', (opts, cb) => {
    const winLen = [3, 4, 5, 6].includes(opts?.winLen) ? opts.winLen : 5;
    const id = genId();
    const room = makeRoom(id, winLen);
    room.players.X = socket.id;
    rooms.set(id, room);
    socket.join(id);
    socket.data.room = id;
    socket.data.mark = 'X';
    cb?.({ id, mark: 'X', state: publicState(room) });
  });

  socket.on('join', (id, cb) => {
    const room = rooms.get(String(id));
    if (!room) return cb?.({ error: 'Phòng không tồn tại hoặc đã hết hạn.' });
    let mark = null;
    if (!room.players.X) mark = 'X';
    else if (!room.players.O) mark = 'O';
    if (!mark) return cb?.({ error: 'Phòng đã đủ 2 người.' });
    clearTimeout(room.cleanup);
    room.players[mark] = socket.id;
    socket.join(room.id);
    socket.data.room = room.id;
    socket.data.mark = mark;
    cb?.({ id: room.id, mark, state: publicState(room) });
    io.to(room.id).emit('state', publicState(room));
  });

  // Client reconnecting with its saved room (server may have restarted)
  socket.on('resume', (data, cb) => {
    const id = String(data?.id || '').slice(0, 16);
    if (!/^[a-z0-9]+$/.test(id)) return cb?.({ error: 'Mã phòng không hợp lệ.' });
    let room = rooms.get(id);
    if (!room) { room = restoreRoom(id, data.state); rooms.set(id, room); }
    const live = (sid) => sid && io.sockets.sockets.has(sid);
    let mark = data.mark === 'O' ? 'O' : 'X';
    if (live(room.players[mark]) && room.players[mark] !== socket.id) {
      const other = mark === 'X' ? 'O' : 'X';
      if (live(room.players[other])) return cb?.({ error: 'Phòng đã đủ 2 người.' });
      mark = other;
    }
    clearTimeout(room.cleanup);
    room.players[mark] = socket.id;
    socket.join(room.id);
    socket.data.room = room.id;
    socket.data.mark = mark;
    cb?.({ id: room.id, mark, state: publicState(room) });
    io.to(room.id).emit('state', publicState(room));
  });

  socket.on('move', (pos) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.winner) return;
    const mark = socket.data.mark;
    const x = pos?.x, y = pos?.y;
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return;
    if (room.turn !== mark || !room.players.X || !room.players.O) return;
    const key = `${x},${y}`;
    if (room.board.has(key)) return;
    room.board.set(key, mark);
    room.moves.push([x, y, mark]);
    const line = checkWin(room.board, x, y, mark, room.winLen);
    if (line) {
      room.winner = mark;
      room.line = line;
      room.score[mark]++;
    } else {
      room.turn = mark === 'X' ? 'O' : 'X';
    }
    io.to(room.id).emit('state', publicState(room));
  });

  socket.on('rematch', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (!room.winner && room.moves.length) room.score.draw++;
    resetRoom(room);
    io.to(room.id).emit('state', publicState(room));
  });

  socket.on('chat', (msg) => {
    const room = rooms.get(socket.data.room);
    if (!room || typeof msg !== 'string') return;
    io.to(room.id).emit('chat', { from: socket.data.mark, text: msg.slice(0, 200) });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (room.players[socket.data.mark] === socket.id) room.players[socket.data.mark] = null;
    io.to(room.id).emit('state', publicState(room));
    if (!room.players.X && !room.players.O) {
      room.cleanup = setTimeout(() => rooms.delete(room.id), 10 * 60 * 1000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
