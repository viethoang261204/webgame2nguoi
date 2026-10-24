const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));

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
  };
}

function resetRoom(room) {
  room.board = new Map();
  room.moves = [];
  room.winner = null;
  room.line = null;
  room.starter = room.starter === 'X' ? 'O' : 'X';
  room.turn = room.starter;
}

io.on('connection', (socket) => {
  socket.on('create', (opts, cb) => {
    const winLen = [3, 4, 5, 6].includes(opts?.winLen) ? opts.winLen : 5;
    const id = genId();
    const room = {
      id, winLen,
      players: { X: socket.id, O: null },
      board: new Map(), moves: [],
      turn: 'X', starter: 'X',
      winner: null, line: null,
      score: { X: 0, O: 0, draw: 0 },
      cleanup: null,
    };
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
