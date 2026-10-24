// Tôi Là Ai? (Who Am I?) — 2-10 người, hỏi có/không để đoán nhân vật trên trán mình
const { CATEGORIES } = require('../public/whoami/data.js');

const MAX_PLAYERS = 10;
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b', '#38d9a9', '#f783ac', '#a9e34b', '#748ffc'];
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐷', '🐙', '🦄', '🐲', '👻', '🤖', '👽', '🎃', '🐧', '🦉', '🐢'];
const VOTES = ['yes', 'no', 'maybe', 'unknown'];
const RESULT_DELAY = 2500;

// Tra tên gọi khác của nhân vật có trong bộ dữ liệu
const ALIASES = new Map();
for (const cat of Object.values(CATEGORIES)) {
  for (const item of cat.items) {
    const [name, ...alias] = item.split('|');
    ALIASES.set(name, [name, ...alias]);
  }
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
// Đoán đúng chắc chắn? (sai chính tả nhẹ / thiếu dấu vẫn tính)
function isMatch(guess, character) {
  if (!character) return false;
  let g = norm(guess).replace(/^(toila|toi|la|con|cai)/, '');
  if (!g) return false;
  const cands = (ALIASES.get(character) || [character]).map(norm).filter(Boolean);
  return cands.some((c) => {
    const c2 = c.replace(/^(con|cai|qua|doi)/, '');
    return c === g || c2 === g
      || (c.length >= 6 && lev(c, g) <= Math.floor(c.length / 7) + 1)
      || (c2.length >= 4 && g.includes(c2) && g.length <= c2.length + 6);
  });
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

module.exports = function whoami(io) {
  const nsp = io.of('/whoami');
  const rooms = new Map();

  function genId() {
    let id;
    do id = Math.random().toString(36).slice(2, 8);
    while (rooms.has(id));
    return id;
  }

  function makeRoom(id) {
    return {
      id, hostPid: null, players: [], state: 'lobby',
      settings: { category: 'mix', assign: 'random', turnTime: 0 },
      round: 0, turn: null, turnSeq: 0, log: [], rankNext: 1, writeMap: {},
      timer: null, resultTimer: null, leaveTimers: {}, cleanup: null,
    };
  }

  const findP = (room, pid) => room.players.find((p) => p.pid === pid);
  const online = (room) => room.players.filter((p) => p.online);
  const active = (p) => !p.solved && !p.gaveUp;

  function viewFor(room, pid) {
    const reveal = room.state === 'ended';
    return {
      id: room.id, me: pid, hostPid: room.hostPid, state: room.state, settings: room.settings,
      round: room.round,
      players: room.players.map((p) => ({
        pid: p.pid, name: p.name, avatar: p.avatar, color: p.color, online: p.online,
        solved: p.solved, gaveUp: p.gaveUp, asked: p.asked, wrong: p.wrong, score: p.score, lastPoints: p.lastPoints,
        character: p.pid === pid && !reveal && active(p) ? (p.character ? '???' : null) : p.character,
      })),
      turn: room.turn && {
        pid: room.turn.pid, phase: room.turn.phase, question: room.turn.question, votes: room.turn.votes,
        guess: room.turn.guess, judge: room.turn.judge, endsAt: room.turn.endsAt, seq: room.turn.seq,
      },
      log: room.log.slice(-150),
      writing: room.state === 'writing'
        ? { target: room.writeMap[pid] || null, done: room.players.filter((p) => p.character).map((p) => p.pid), map: room.writeMap }
        : null,
      serverNow: Date.now(),
    };
  }

  function emit(room) {
    for (const p of room.players) if (p.online && p.sid) nsp.to(p.sid).emit('state', viewFor(room, p.pid));
  }

  function addLog(room, entry) {
    room.log.push({ t: Date.now(), ...entry });
    if (room.log.length > 300) room.log.shift();
  }

  function addPlayer(room, pid, name, avatar, sid) {
    const used = new Set(room.players.map((p) => p.color));
    const p = {
      pid, sid, online: true,
      name: clean(name, 20) || 'Người chơi',
      avatar: AVATARS.includes(avatar) ? avatar : pick(AVATARS),
      color: COLORS.find((c) => !used.has(c)) || pick(COLORS),
      character: null, solved: 0, gaveUp: false, asked: 0, wrong: 0, score: 0, lastPoints: 0,
    };
    room.players.push(p);
    if (!room.hostPid) room.hostPid = pid;
    return p;
  }

  function randomCharacters(room, n, exclude = []) {
    const used = new Set(exclude);
    const pool = shuffle(CATEGORIES[room.settings.category].items.map((s) => s.split('|')[0]).filter((s) => !used.has(s)));
    return pool.slice(0, n);
  }

  // ---------- Luồng ván ----------
  function startGame(room) {
    clearTimeout(room.timer); clearTimeout(room.resultTimer);
    room.round++;
    room.log = [];
    room.rankNext = 1;
    room.turn = null;
    room.writeMap = {};
    // người offline lúc bắt đầu thì bỏ khỏi phòng
    room.players = room.players.filter((p) => p.online);
    for (const p of room.players) Object.assign(p, { character: null, solved: 0, gaveUp: false, asked: 0, wrong: 0, lastPoints: 0 });
    if (room.settings.assign === 'random') {
      const chars = randomCharacters(room, room.players.length);
      room.players.forEach((p, i) => (p.character = chars[i % chars.length]));
      beginPlay(room);
    } else {
      const order = shuffle(room.players.map((p) => p.pid));
      order.forEach((pid, i) => (room.writeMap[pid] = order[(i + 1) % order.length]));
      room.state = 'writing';
      emit(room);
    }
  }

  function checkWritingDone(room) {
    if (room.state !== 'writing') return;
    if (room.players.every((p) => p.character)) beginPlay(room);
    else emit(room);
  }

  function beginPlay(room) {
    room.state = 'playing';
    addLog(room, { type: 'start', round: room.round });
    const startIdx = Math.floor(Math.random() * room.players.length);
    const first = room.players[startIdx];
    startTurn(room, first.online ? first.pid : null) || nextTurn(room, first.pid);
  }

  function startTurn(room, pid) {
    const p = pid && findP(room, pid);
    if (!p || !p.online || !active(p)) return false;
    clearTimeout(room.timer); clearTimeout(room.resultTimer);
    const tt = room.settings.turnTime;
    room.turn = { pid, phase: 'ask', question: null, votes: {}, guess: null, judge: {}, seq: ++room.turnSeq, endsAt: tt ? Date.now() + tt * 1000 : 0 };
    armTurnTimer(room);
    emit(room);
    return true;
  }

  function armTurnTimer(room) {
    clearTimeout(room.timer);
    const t = room.turn;
    if (!t || !t.endsAt || t.phase !== 'ask') return;
    const seq = t.seq;
    room.timer = setTimeout(() => {
      if (room.turn?.seq !== seq || room.turn.phase !== 'ask') return;
      addLog(room, { type: 'timeout', pid: room.turn.pid });
      nextTurn(room);
    }, Math.max(0, t.endsAt - Date.now()));
  }

  function nextTurn(room, fromPid) {
    clearTimeout(room.timer); clearTimeout(room.resultTimer);
    if (room.state !== 'playing') return;
    if (!room.players.some(active)) return endGame(room);
    const list = room.players;
    const cur = Math.max(0, list.findIndex((p) => p.pid === (fromPid || room.turn?.pid)));
    for (let k = 1; k <= list.length; k++) {
      const p = list[(cur + k) % list.length];
      if (p.online && active(p)) return startTurn(room, p.pid);
    }
    // chưa ai đoán xong nhưng đang offline hết -> chờ
    room.turn = null;
    emit(room);
  }

  function afterResult(room) {
    const seq = room.turn?.seq;
    room.turn.phase = 'result';
    clearTimeout(room.timer);
    room.resultTimer = setTimeout(() => { if (room.turn?.seq === seq) nextTurn(room); }, RESULT_DELAY);
    emit(room);
  }

  // Người cần trả lời câu hỏi / chấm đoán: mọi người online trừ người đang hỏi
  const voters = (room) => room.players.filter((p) => p.online && p.pid !== room.turn?.pid);

  function tally(votes) {
    const c = { yes: 0, no: 0, maybe: 0, unknown: 0 };
    for (const v of Object.values(votes)) c[v]++;
    return c;
  }

  function finalizeAnswer(room) {
    const t = room.turn;
    const c = tally(t.votes);
    const max = Math.max(c.yes, c.no, c.maybe, c.unknown);
    const winners = VOTES.filter((v) => c[v] === max);
    const result = winners.length === 1 ? winners[0] : (winners.includes('yes') && winners.includes('no') ? 'maybe' : winners[0]);
    addLog(room, { type: 'q', pid: t.pid, text: t.question, tally: c, result, votes: { ...t.votes } });
    if (result === 'yes') {
      // trả lời "Có" thì được hỏi tiếp
      t.phase = 'ask'; t.question = null; t.votes = {};
      if (room.settings.turnTime) t.endsAt = Date.now() + room.settings.turnTime * 1000;
      armTurnTimer(room);
      emit(room);
    } else {
      afterResult(room);
    }
  }

  function solve(room, p, guess) {
    p.solved = room.rankNext++;
    addLog(room, { type: 'solved', pid: p.pid, guess, character: p.character, rank: p.solved });
    if (!room.players.some(active)) {
      room.turn.phase = 'result';
      emit(room);
      room.resultTimer = setTimeout(() => endGame(room), RESULT_DELAY);
    } else afterResult(room);
  }

  function wrongGuess(room, p, guess) {
    p.wrong++;
    addLog(room, { type: 'wrong', pid: p.pid, guess });
    afterResult(room);
  }

  function finalizeJudge(room) {
    const t = room.turn;
    const p = findP(room, t.pid);
    const yes = Object.values(t.judge).filter(Boolean).length;
    const no = Object.values(t.judge).length - yes;
    if (yes > no) solve(room, p, t.guess);
    else wrongGuess(room, p, t.guess);
  }

  function checkVotesDone(room) {
    const t = room.turn;
    if (!t || room.state !== 'playing') return;
    const vs = voters(room);
    if (t.phase === 'answer' && vs.length && vs.every((v) => t.votes[v.pid])) finalizeAnswer(room);
    else if (t.phase === 'judge' && vs.length && vs.every((v) => v.pid in t.judge)) finalizeJudge(room);
  }

  function endGame(room) {
    clearTimeout(room.timer); clearTimeout(room.resultTimer);
    if (room.state !== 'playing') return;
    room.state = 'ended';
    const n = room.players.length;
    for (const p of room.players) {
      p.lastPoints = p.solved ? Math.max(1, n - p.solved + 1) : 0;
      p.score += p.lastPoints;
    }
    addLog(room, { type: 'end' });
    room.turn = null;
    emit(room);
  }

  function setHostIfNeeded(room) {
    const h = findP(room, room.hostPid);
    if (!h || !h.online) {
      const next = room.players.find((p) => p.online);
      if (next) room.hostPid = next.pid;
    }
  }

  // Dựng lại phòng từ dữ liệu client sau khi server restart
  function restoreRoom(id, snap) {
    const room = makeRoom(id);
    const s = snap?.settings || {};
    room.settings = {
      category: CATEGORIES[s.category] ? s.category : 'mix',
      assign: s.assign === 'custom' ? 'custom' : 'random',
      turnTime: [0, 30, 60, 90, 120].includes(s.turnTime) ? s.turnTime : 0,
    };
    room.round = Number.isInteger(snap?.round) ? snap.round : 0;
    room.hostPid = typeof snap?.hostPid === 'string' ? snap.hostPid.slice(0, 40) : null;
    const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0);
    for (const sp of Array.isArray(snap?.players) ? snap.players.slice(0, MAX_PLAYERS) : []) {
      if (typeof sp?.pid !== 'string') continue;
      const p = addPlayer(room, sp.pid.slice(0, 40), sp.name, sp.avatar, null);
      p.online = false;
      if (COLORS.includes(sp.color)) p.color = sp.color;
      p.character = sp.character && sp.character !== '???' ? clean(sp.character, 40) : null;
      Object.assign(p, { solved: int(sp.solved), gaveUp: !!sp.gaveUp, asked: int(sp.asked), wrong: int(sp.wrong), score: int(sp.score), lastPoints: int(sp.lastPoints) });
    }
    room.rankNext = Math.max(0, ...room.players.map((p) => p.solved)) + 1;
    room.log = (Array.isArray(snap?.log) ? snap.log.slice(-150) : []).filter((e) => e && typeof e.type === 'string');
    room.state = ['lobby', 'playing', 'ended'].includes(snap?.state) ? snap.state : 'lobby';
    if (room.state === 'playing') room.turn = null; // lượt sẽ bắt đầu lại khi có người vào
    return room;
  }

  function mergeSnap(room, snap) {
    for (const sp of Array.isArray(snap?.players) ? snap.players : []) {
      const p = findP(room, sp?.pid);
      if (p && !p.character && sp.character && sp.character !== '???') p.character = clean(sp.character, 40);
    }
  }

  function seat(socket, room, p) {
    clearTimeout(room.cleanup);
    clearTimeout(room.leaveTimers[p.pid]);
    p.sid = socket.id;
    p.online = true;
    socket.join(room.id);
    socket.data.room = room.id;
    socket.data.pid = p.pid;
    setHostIfNeeded(room);
  }

  function joinRoom(socket, room, data) {
    const pid = clean(data?.pid, 40);
    if (!pid) return { error: 'Thiếu mã người chơi.' };
    let p = findP(room, pid);
    if (p) {
      if (data.name) p.name = clean(data.name, 20) || p.name;
      if (AVATARS.includes(data.avatar)) p.avatar = data.avatar;
    } else {
      if (room.players.length >= MAX_PLAYERS) return { error: `Phòng đã đủ ${MAX_PLAYERS} người.` };
      p = addPlayer(room, pid, data.name, data.avatar, socket.id);
      if (room.state === 'playing' || room.state === 'writing') {
        // vào giữa ván: nhận nhân vật ngẫu nhiên
        p.character = randomCharacters(room, 1, room.players.map((x) => x.character))[0];
        if (room.state === 'playing') addLog(room, { type: 'join', pid: p.pid });
      }
    }
    seat(socket, room, p);
    if (room.state === 'playing' && !room.turn) nextTurn(room, p.pid);
    return { ok: true };
  }

  const getCtx = (socket) => {
    const room = rooms.get(socket.data.room);
    const p = room && findP(room, socket.data.pid);
    return p ? { room, p } : {};
  };

  nsp.on('connection', (socket) => {
    socket.on('create', (data, cb) => {
      const room = makeRoom(genId());
      rooms.set(room.id, room);
      const r = joinRoom(socket, room, data);
      if (r.error) return cb?.(r);
      cb?.({ id: room.id });
      emit(room);
    });

    socket.on('join', (data, cb) => {
      const id = clean(data?.roomId, 16).toLowerCase();
      if (!/^[a-z0-9]+$/.test(id)) return cb?.({ error: 'Mã phòng không hợp lệ.' });
      let room = rooms.get(id);
      if (!room) {
        if (!data.snap) return cb?.({ error: 'Phòng không tồn tại hoặc đã hết hạn.' });
        room = restoreRoom(id, data.snap);
        rooms.set(id, room);
      } else if (data.snap) mergeSnap(room, data.snap);
      const r = joinRoom(socket, room, data);
      if (r.error) return cb?.(r);
      cb?.({ id: room.id });
      emit(room);
    });

    socket.on('profile', (data) => {
      const { room, p } = getCtx(socket);
      if (!p) return;
      p.name = clean(data?.name, 20) || p.name;
      if (AVATARS.includes(data?.avatar)) p.avatar = data.avatar;
      emit(room);
    });

    socket.on('settings', (data) => {
      const { room, p } = getCtx(socket);
      if (!p || room.hostPid !== p.pid || room.state === 'playing' || room.state === 'writing') return;
      if (CATEGORIES[data?.category]) room.settings.category = data.category;
      if (['random', 'custom'].includes(data?.assign)) room.settings.assign = data.assign;
      if ([0, 30, 60, 90, 120].includes(data?.turnTime)) room.settings.turnTime = data.turnTime;
      emit(room);
    });

    socket.on('start', () => {
      const { room, p } = getCtx(socket);
      if (!p || room.hostPid !== p.pid || room.state === 'playing' || room.state === 'writing') return;
      if (online(room).length < 2) return socket.emit('toast', 'Cần ít nhất 2 người để bắt đầu.');
      startGame(room);
    });

    socket.on('toLobby', () => {
      const { room, p } = getCtx(socket);
      if (!p || room.hostPid !== p.pid) return;
      clearTimeout(room.timer); clearTimeout(room.resultTimer);
      room.state = 'lobby';
      room.turn = null;
      emit(room);
    });

    socket.on('write', (data) => {
      const { room, p } = getCtx(socket);
      if (!p || room.state !== 'writing') return;
      const target = findP(room, room.writeMap[p.pid]);
      const text = clean(data?.text, 40);
      if (!target || !text) return;
      target.character = text;
      checkWritingDone(room);
    });

    socket.on('fillRandom', () => {
      const { room, p } = getCtx(socket);
      if (!p || room.hostPid !== p.pid || room.state !== 'writing') return;
      const missing = room.players.filter((x) => !x.character);
      const chars = randomCharacters(room, missing.length, room.players.map((x) => x.character));
      missing.forEach((x, i) => (x.character = chars[i % chars.length]));
      checkWritingDone(room);
    });

    socket.on('ask', (data) => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || room.state !== 'playing' || !t || t.pid !== p.pid || t.phase !== 'ask') return;
      const text = clean(data?.text, 150);
      if (!text) return;
      clearTimeout(room.timer);
      t.phase = 'answer';
      t.question = text;
      t.votes = {};
      p.asked++;
      if (!voters(room).length) return finalizeAnswer(room);
      emit(room);
    });

    socket.on('answer', (data) => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || !t || t.phase !== 'answer' || t.pid === p.pid || !VOTES.includes(data?.v)) return;
      t.votes[p.pid] = data.v;
      emit(room);
      checkVotesDone(room);
    });

    socket.on('guess', (data) => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || room.state !== 'playing' || !t || t.pid !== p.pid || t.phase !== 'ask') return;
      const text = clean(data?.text, 60);
      if (!text) return;
      clearTimeout(room.timer);
      if (isMatch(text, p.character)) return solve(room, p, text);
      if (!voters(room).length) return wrongGuess(room, p, text);
      t.phase = 'judge';
      t.guess = text;
      t.judge = {};
      emit(room);
    });

    socket.on('judge', (data) => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || !t || t.phase !== 'judge' || t.pid === p.pid) return;
      t.judge[p.pid] = !!data?.ok;
      emit(room);
      checkVotesDone(room);
    });

    // Chốt với số phiếu hiện có (người hỏi hoặc chủ phòng, khi có người treo máy)
    socket.on('finalize', () => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || !t || (p.pid !== t.pid && p.pid !== room.hostPid)) return;
      if (t.phase === 'answer' && Object.keys(t.votes).length) finalizeAnswer(room);
      else if (t.phase === 'judge' && Object.keys(t.judge).length) finalizeJudge(room);
    });

    socket.on('pass', () => {
      const { room, p } = getCtx(socket);
      const t = room?.turn;
      if (!p || !t || t.pid !== p.pid || t.phase !== 'ask') return;
      addLog(room, { type: 'pass', pid: p.pid });
      nextTurn(room);
    });

    socket.on('giveup', () => {
      const { room, p } = getCtx(socket);
      if (!p || room.state !== 'playing' || !active(p)) return;
      p.gaveUp = true;
      addLog(room, { type: 'giveup', pid: p.pid, character: p.character });
      if (room.turn?.pid === p.pid) nextTurn(room);
      else if (!room.players.some(active)) endGame(room);
      else emit(room);
    });

    socket.on('end', () => {
      const { room, p } = getCtx(socket);
      if (p && room.hostPid === p.pid) endGame(room);
    });

    socket.on('kick', (pid) => {
      const { room, p } = getCtx(socket);
      if (!p || room.hostPid !== p.pid || pid === p.pid || room.state !== 'lobby') return;
      const k = findP(room, pid);
      if (!k) return;
      room.players = room.players.filter((x) => x !== k);
      if (k.sid) nsp.to(k.sid).emit('kicked');
      emit(room);
    });

    socket.on('disconnect', () => {
      const { room, p } = getCtx(socket);
      if (!p || p.sid !== socket.id) return;
      p.online = false;
      p.sid = null;
      setHostIfNeeded(room);
      if (room.state === 'lobby') {
        // ở phòng chờ: thoát quá 60s thì xóa khỏi danh sách
        room.leaveTimers[p.pid] = setTimeout(() => {
          if (!p.online && room.state === 'lobby') { room.players = room.players.filter((x) => x !== p); setHostIfNeeded(room); emit(room); }
        }, 60000);
      } else if (room.state === 'playing') {
        checkVotesDone(room);
        if (room.turn?.pid === p.pid) {
          // mất mạng thoáng qua thì giữ lượt 15s
          const seq = room.turn.seq;
          room.leaveTimers[p.pid] = setTimeout(() => {
            if (!p.online && room.turn?.seq === seq) { addLog(room, { type: 'skip', pid: p.pid }); nextTurn(room); }
          }, 15000);
        }
      }
      emit(room);
      if (!online(room).length) {
        room.cleanup = setTimeout(() => { clearTimeout(room.timer); clearTimeout(room.resultTimer); rooms.delete(room.id); }, 30 * 60 * 1000);
      }
    });
  });
};

module.exports.isMatch = isMatch;
