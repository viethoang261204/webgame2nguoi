// Pikachu (Onet) solo 2 người: cùng 1 map, ai ăn hết trước thắng
const ROWS = 8;
const COLS = 14;
const TOTAL = (ROWS * COLS) / 2; // số cặp
const GRID_LEN = (ROWS + 2) * (COLS + 2);
const TIME_LIMIT = 10 * 60 * 1000;
const COUNTDOWN = 3500;

module.exports = function pikachu(io) {
  const nsp = io.of('/pikachu');
  const rooms = new Map();

  function genId() {
    let id;
    do id = Math.random().toString(36).slice(2, 8);
    while (rooms.has(id));
    return id;
  }

  const blankProg = () => ({ cleared: 0, finishedAt: null, grid: null });

  function makeRoom(id) {
    return {
      id,
      players: [null, null],
      round: 0, state: 'waiting',
      seed: 0, startAt: 0, endedAt: 0,
      prog: [blankProg(), blankProg()],
      history: [], wins: [0, 0],
      timer: null, cleanup: null,
    };
  }

  function publicState(room) {
    return {
      id: room.id,
      players: room.players.map(Boolean),
      round: room.round, state: room.state,
      seed: room.seed, startAt: room.startAt, endedAt: room.endedAt,
      rows: ROWS, cols: COLS, total: TOTAL, timeLimit: TIME_LIMIT,
      prog: room.prog,
      history: room.history, wins: room.wins,
      serverNow: Date.now(),
    };
  }

  const emit = (room) => nsp.to(room.id).emit('state', publicState(room));

  function armTimer(room) {
    clearTimeout(room.timer);
    if (room.state !== 'playing') return;
    room.timer = setTimeout(() => endRound(room), Math.max(0, room.startAt + TIME_LIMIT - Date.now()));
  }

  function startRound(room) {
    room.round++;
    room.seed = Math.floor(Math.random() * 2 ** 31);
    room.startAt = Date.now() + COUNTDOWN;
    room.endedAt = 0;
    room.prog = [blankProg(), blankProg()];
    room.state = 'playing';
    armTimer(room);
    emit(room);
  }

  function endRound(room) {
    if (room.state !== 'playing') return;
    clearTimeout(room.timer);
    room.state = 'over';
    room.endedAt = Date.now();
    const [a, b] = room.prog;
    let winner = -1;
    if (a.finishedAt || b.finishedAt) {
      if (a.finishedAt && b.finishedAt) winner = a.finishedAt <= b.finishedAt ? 0 : 1;
      else winner = a.finishedAt ? 0 : 1;
    } else if (a.cleared !== b.cleared) {
      winner = a.cleared > b.cleared ? 0 : 1;
    }
    if (winner >= 0) room.wins[winner]++;
    room.history.push({
      round: room.round,
      times: room.prog.map((p) => (p.finishedAt ? p.finishedAt - room.startAt : null)),
      cleared: room.prog.map((p) => p.cleared),
      winner,
    });
    if (room.history.length > 50) room.history.shift();
    emit(room);
  }

  const validGrid = (g) => Array.isArray(g) && g.length === GRID_LEN && g.every((v) => Number.isInteger(v) && v >= 0 && v < 100);
  const int = (v, max = 1e9) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

  // Dựng lại phòng từ dữ liệu client (khi server restart / redeploy)
  function restoreRoom(id, snap) {
    const room = makeRoom(id);
    room.round = int(snap?.round, 1e6);
    room.seed = int(snap?.seed, 2 ** 31);
    room.startAt = int(snap?.startAt, 1e14);
    room.endedAt = int(snap?.endedAt, 1e14);
    room.state = ['waiting', 'playing', 'over'].includes(snap?.state) ? snap.state : 'waiting';
    if (!room.round) room.state = 'waiting';
    room.wins = [int(snap?.wins?.[0], 1e6), int(snap?.wins?.[1], 1e6)];
    room.history = (Array.isArray(snap?.history) ? snap.history.slice(-50) : []).map((h) => ({
      round: int(h?.round, 1e6),
      times: [0, 1].map((i) => (Number.isFinite(h?.times?.[i]) ? h.times[i] : null)),
      cleared: [int(h?.cleared?.[0], TOTAL), int(h?.cleared?.[1], TOTAL)],
      winner: [0, 1].includes(h?.winner) ? h.winner : -1,
    }));
    if (room.state === 'playing' && Date.now() > room.startAt + TIME_LIMIT) room.state = 'over';
    armTimer(room);
    return room;
  }

  function seat(socket, room, slot) {
    clearTimeout(room.cleanup);
    room.players[slot] = socket.id;
    socket.join(room.id);
    socket.data.room = room.id;
    socket.data.slot = slot;
  }

  nsp.on('connection', (socket) => {
    socket.on('create', (_, cb) => {
      const room = makeRoom(genId());
      rooms.set(room.id, room);
      seat(socket, room, 0);
      cb?.({ id: room.id, slot: 0, state: publicState(room) });
    });

    socket.on('join', (id, cb) => {
      const room = rooms.get(String(id));
      if (!room) return cb?.({ error: 'Phòng không tồn tại hoặc đã hết hạn.' });
      const slot = room.players[0] ? (room.players[1] ? -1 : 1) : 0;
      if (slot < 0) return cb?.({ error: 'Phòng đã đủ 2 người.' });
      seat(socket, room, slot);
      cb?.({ id: room.id, slot, state: publicState(room) });
      if (room.state === 'waiting' && room.players[0] && room.players[1]) startRound(room);
      else emit(room);
    });

    socket.on('resume', (data, cb) => {
      const id = String(data?.id || '').slice(0, 16);
      if (!/^[a-z0-9]+$/.test(id)) return cb?.({ error: 'Mã phòng không hợp lệ.' });
      let room = rooms.get(id);
      if (!room) { room = restoreRoom(id, data.snap); rooms.set(id, room); }
      const live = (sid) => sid && nsp.sockets.has(sid);
      let slot = data.slot === 1 ? 1 : 0;
      if (live(room.players[slot]) && room.players[slot] !== socket.id) {
        if (live(room.players[1 - slot])) return cb?.({ error: 'Phòng đã đủ 2 người.' });
        slot = 1 - slot;
      }
      seat(socket, room, slot);
      const snap = data.snap;
      if (snap && snap.round === room.round && !room.prog[slot].grid && validGrid(snap.grid)) {
        room.prog[slot] = { cleared: int(snap.cleared, TOTAL), finishedAt: null, grid: snap.grid };
      }
      cb?.({ id: room.id, slot, state: publicState(room) });
      if (room.state === 'waiting' && room.players[0] && room.players[1]) startRound(room);
      else emit(room);
    });

    socket.on('progress', (data) => {
      const room = rooms.get(socket.data.room);
      if (!room || room.state !== 'playing' || Date.now() < room.startAt) return;
      const p = room.prog[socket.data.slot];
      if (!validGrid(data?.grid)) return;
      p.grid = data.grid;
      p.cleared = int(data.cleared, TOTAL);
      if (p.cleared >= TOTAL && data.grid.every((v) => v === 0)) {
        p.finishedAt = Date.now();
        endRound(room);
        return;
      }
      emit(room);
    });

    socket.on('rematch', () => {
      const room = rooms.get(socket.data.room);
      if (!room || room.state === 'playing') return;
      if (!room.players[0] || !room.players[1]) {
        room.state = 'waiting';
        return emit(room);
      }
      startRound(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.room);
      if (!room) return;
      if (room.players[socket.data.slot] === socket.id) room.players[socket.data.slot] = null;
      emit(room);
      if (!room.players[0] && !room.players[1]) {
        room.cleanup = setTimeout(() => { clearTimeout(room.timer); rooms.delete(room.id); }, 10 * 60 * 1000);
      }
    });
  });
};
