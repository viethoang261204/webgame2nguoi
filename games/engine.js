// Engine chung cho các game 2 người theo lượt (namespace /play)
// Mỗi game là 1 module luật trong ./rules: init / move / result / turn / view
const crypto = require('crypto');

const RULES = Object.fromEntries(
  ['chess', 'xiangqi', 'checkers', 'othello', 'connect4', 'battleship', 'dots', 'oanquan', 'memory', 'quoridor']
    .map((id) => [id, require(`./rules/${id}`)]),
);

// Khóa niêm phong trạng thái phòng (đặt SECRET trên Render để khôi phục được sau khi deploy)
const KEY = crypto.createHash('sha256').update(process.env.SECRET || crypto.randomBytes(32)).digest();
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}
function unseal(str) {
  try {
    const buf = Buffer.from(String(str), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
  } catch { return null; }
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function gameMeta(id) {
  const r = RULES[id];
  return r && { id, ...r.meta, settings: r.settings || {}, local: r.local !== false, clock: !!r.clock };
}

function pickSettings(rules, input) {
  const out = {};
  for (const [k, def] of Object.entries(rules.settings || {})) {
    const v = input?.[k];
    out[k] = def.options.some(([val]) => val === v) ? v : def.default;
  }
  return out;
}

module.exports = function engine(io, app) {
  const nsp = io.of('/play');
  const rooms = new Map();

  app.get('/api/games', (_, res) => res.json(Object.keys(RULES).map(gameMeta)));
  app.get('/api/room/:id', (req, res) => {
    const room = rooms.get(String(req.params.id).toLowerCase());
    if (!room) return res.status(404).json({ error: 'not found' });
    res.json({ game: room.game });
  });
  app.get('/api/games/:id', (req, res) => {
    const m = gameMeta(req.params.id);
    if (!m) return res.status(404).json({ error: 'not found' });
    res.json(m);
  });

  function genId() {
    let id;
    do id = Math.random().toString(36).slice(2, 8);
    while (rooms.has(id));
    return id;
  }

  function newRound(room) {
    const rules = RULES[room.game];
    room.state = rules.init(room.settings);
    room.result = null;
    room.drawOffer = null;
    room.rematch = [false, false];
    room.clockOn = false;
    room.clocks = rules.clock && room.settings.time ? [room.settings.time * 1000, room.settings.time * 1000] : null;
    room.turnStart = Date.now();
    clearTimeout(room.timer);
  }

  function makeRoom(id, game, settings, local) {
    const room = {
      id, game, settings, local,
      seats: [null, null], names: {}, online: {}, sids: {},
      round: 1, score: [0, 0], draws: 0,
      state: null, result: null, drawOffer: null, rematch: [false, false],
      clocks: null, clockOn: false, turnStart: 0, timer: null, cleanup: null,
    };
    newRound(room);
    return room;
  }

  const ready = (room) => room.seats[0] && room.seats[1];
  const turnOf = (room) => RULES[room.game].turn(room.state);

  function remaining(room) {
    if (!room.clocks) return null;
    const c = [...room.clocks];
    const t = turnOf(room);
    if (room.clockOn && !room.result && typeof t === 'number') c[t] = Math.max(0, c[t] - (Date.now() - room.turnStart));
    return c;
  }

  function finish(room, result) {
    room.result = result;
    clearTimeout(room.timer);
    if (room.clocks) { room.clocks = remaining(room); room.turnStart = Date.now(); }
    room.clockOn = false;
    if (result.winner === 0 || result.winner === 1) room.score[result.winner]++;
    else room.draws++;
  }

  function armClock(room) {
    clearTimeout(room.timer);
    const t = turnOf(room);
    if (!room.clocks || !room.clockOn || room.result || typeof t !== 'number') return;
    room.timer = setTimeout(() => {
      if (room.result) return;
      if (remaining(room)[t] <= 0) {
        finish(room, { winner: 1 - t, reason: 'Hết giờ' });
        emit(room);
      } else armClock(room);
    }, room.clocks[t] - (Date.now() - room.turnStart) + 30);
  }

  function core(room) {
    return {
      v: 1, game: room.game, settings: room.settings, local: room.local, seats: room.seats, names: room.names,
      round: room.round, score: room.score, draws: room.draws, state: room.state, result: room.result,
      clocks: remaining(room), clockOn: room.clockOn,
    };
  }

  function viewFor(room, pid, sealed) {
    const rules = RULES[room.game];
    let seat = room.seats.indexOf(pid);
    if (room.local && seat >= 0) seat = 'both';
    if (seat === -1) seat = null;
    return {
      id: room.id, game: room.game, settings: room.settings, local: room.local, seat,
      players: room.seats.map((p) => p && { name: room.names[p] || 'Khách', online: !!room.online[p] }),
      state: rules.view ? rules.view(room.state, seat === 'both' ? turnOf(room) : seat) : room.state,
      turn: turnOf(room), result: room.result, round: room.round, score: room.score, draws: room.draws,
      clocks: remaining(room), clockOn: room.clockOn && !room.result,
      drawOffer: room.drawOffer, rematch: room.rematch, ready: !!ready(room),
      serverNow: Date.now(), seal: sealed,
    };
  }

  function emit(room) {
    const sealed = seal(core(room));
    for (const [pid, sid] of Object.entries(room.sids)) {
      if (room.online[pid]) nsp.to(sid).emit('state', viewFor(room, pid, sealed));
    }
  }

  function restore(id, data) {
    const c = unseal(data);
    if (!c || c.v !== 1 || !RULES[c.game]) return null;
    const room = makeRoom(id, c.game, pickSettings(RULES[c.game], c.settings), !!c.local);
    Object.assign(room, {
      seats: c.seats, names: c.names || {}, round: c.round, score: c.score, draws: c.draws || 0,
      state: c.state, result: c.result, clocks: c.clocks, clockOn: !!c.clockOn, turnStart: Date.now(),
    });
    armClock(room);
    return room;
  }

  function seat(socket, room, pid, name) {
    clearTimeout(room.cleanup);
    if (name) room.names[pid] = clean(name, 24);
    room.online[pid] = true;
    room.sids[pid] = socket.id;
    socket.join(room.id);
    socket.data.room = room.id;
    socket.data.pid = pid;
  }

  const ctx = (socket) => {
    const room = rooms.get(socket.data.room);
    return room ? { room, pid: socket.data.pid, s: room.seats.indexOf(socket.data.pid) } : {};
  };

  nsp.on('connection', (socket) => {
    socket.on('create', (data, cb) => {
      const rules = RULES[data?.game];
      const pid = clean(data?.pid, 40);
      if (!rules || !pid) return cb?.({ error: 'Game không hợp lệ.' });
      const local = !!data.local && rules.local !== false;
      const room = makeRoom(genId(), data.game, pickSettings(rules, data.settings), local);
      room.seats[0] = pid;
      if (local) room.seats[1] = pid;
      rooms.set(room.id, room);
      seat(socket, room, pid, data.name);
      cb?.({ id: room.id });
      emit(room);
    });

    socket.on('join', (data, cb) => {
      const id = clean(data?.id, 16).toLowerCase();
      const pid = clean(data?.pid, 40);
      if (!/^[a-z0-9]+$/.test(id) || !pid) return cb?.({ error: 'Mã phòng không hợp lệ.' });
      let room = rooms.get(id);
      if (!room && data.seal) {
        room = restore(id, data.seal);
        if (room) rooms.set(id, room);
      }
      if (!room) return cb?.({ error: 'Phòng không tồn tại hoặc đã hết hạn.' });
      if (data.game && data.game !== room.game) return cb?.({ error: 'Link này là phòng của game khác.', game: room.game });
      if (!room.seats.includes(pid)) {
        const free = room.seats.indexOf(null);
        if (free >= 0 && !room.local) room.seats[free] = pid;
      }
      seat(socket, room, pid, data.name);
      cb?.({ id: room.id });
      emit(room);
    });

    socket.on('move', (m, cb) => {
      const { room, pid, s } = ctx(socket);
      if (!room) return cb?.({ error: 'Không ở trong phòng.' });
      if (room.result) return cb?.({ error: 'Ván đã kết thúc.' });
      if (!ready(room)) return cb?.({ error: 'Đang chờ đối thủ vào phòng.' });
      const rules = RULES[room.game];
      const t = turnOf(room);
      let seatNo = s;
      if (room.local) seatNo = typeof t === 'number' ? t : (m && Number.isInteger(m.seat) ? m.seat : 0);
      if (seatNo < 0) return cb?.({ error: 'Bạn đang xem, không thể đi.' });
      if (t !== 'both' && t !== seatNo) return cb?.({ error: 'Chưa tới lượt bạn.' });
      const before = remaining(room);
      const err = rules.move(room.state, seatNo, m);
      if (err) return cb?.({ error: err });
      // đồng hồ: trừ thời gian của người vừa đi, cộng thêm giây nếu có
      room.turnStart = Date.now();
      if (room.clocks) {
        if (room.clockOn && typeof t === 'number') {
          room.clocks = before;
          if (room.clocks[t] <= 0) finish(room, { winner: 1 - t, reason: 'Hết giờ' });
          else if (room.settings.inc) room.clocks[t] += room.settings.inc * 1000;
        }
        if (typeof turnOf(room) === 'number' && t !== turnOf(room)) room.clockOn = true;
      }
      room.drawOffer = null;
      if (!room.result) {
        const r = rules.result(room.state);
        if (r) finish(room, r);
      }
      armClock(room);
      cb?.({ ok: true });
      emit(room);
    });

    socket.on('resign', () => {
      const { room, s } = ctx(socket);
      if (!room || room.result || s < 0 || !ready(room)) return;
      const t = turnOf(room);
      const loser = room.local ? (typeof t === 'number' ? t : 0) : s;
      finish(room, { winner: 1 - loser, reason: 'Đầu hàng' });
      emit(room);
    });

    socket.on('draw', (action) => {
      const { room, s } = ctx(socket);
      if (!room || room.result || s < 0 || !ready(room)) return;
      if (room.local) { if (action === 'offer') finish(room, { winner: -1, reason: 'Hai bên đồng ý hòa' }); }
      else if (action === 'offer' && room.drawOffer === null) room.drawOffer = s;
      else if (action === 'accept' && room.drawOffer === 1 - s) finish(room, { winner: -1, reason: 'Hai bên đồng ý hòa' });
      else if (action === 'decline' && room.drawOffer !== null) room.drawOffer = null;
      emit(room);
    });

    socket.on('rematch', () => {
      const { room, s } = ctx(socket);
      if (!room || !room.result || s < 0) return;
      if (room.local) room.rematch = [true, true];
      else room.rematch[s] = true;
      if (room.rematch[0] && room.rematch[1]) {
        // đổi bên để người kia đi trước
        if (!room.local) { room.seats.reverse(); room.score.reverse(); }
        room.round++;
        newRound(room);
      }
      emit(room);
    });

    socket.on('rename', (name) => {
      const { room, pid } = ctx(socket);
      if (!room) return;
      room.names[pid] = clean(name, 24) || room.names[pid];
      emit(room);
    });

    socket.on('disconnect', () => {
      const { room, pid } = ctx(socket);
      if (!room || room.sids[pid] !== socket.id) return;
      room.online[pid] = false;
      emit(room);
      if (!Object.values(room.online).some(Boolean)) {
        room.cleanup = setTimeout(() => { clearTimeout(room.timer); rooms.delete(room.id); }, 30 * 60 * 1000);
      }
    });
  });
};

module.exports.RULES = RULES;
