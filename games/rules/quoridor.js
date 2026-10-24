// Bức tường (Quoridor) 9x9: đưa quân sang bờ bên kia, mỗi người có 10 bức tường để cản
const N = 9;
const WALLS = 10;

// tường ngang (r,c): chắn giữa hàng r và r+1 ở cột c, c+1. Tường dọc (r,c): chắn giữa cột c và c+1 ở hàng r, r+1
function blocked(s, r, c, r2, c2) {
  if (r2 === r + 1 || r2 === r - 1) {
    const rr = Math.min(r, r2);
    return s.walls.some((w) => w.t === 'h' && w.r === rr && (w.c === c || w.c === c - 1));
  }
  const cc = Math.min(c, c2);
  return s.walls.some((w) => w.t === 'v' && w.c === cc && (w.r === r || w.r === r - 1));
}

const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const pos = (i) => [Math.floor(i / N), i % N];

function steps(s, r, c) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dr, dc]) => [r + dr, c + dc, dr, dc])
    .filter(([rr, cc]) => inside(rr, cc) && !blocked(s, r, c, rr, cc));
}

function pawnMoves(s, seat) {
  const [r, c] = pos(s.pawns[seat]);
  const opp = s.pawns[1 - seat];
  const out = [];
  for (const [rr, cc, dr, dc] of steps(s, r, c)) {
    if (rr * N + cc !== opp) { out.push(rr * N + cc); continue; }
    // nhảy qua đối thủ, bị chắn thì đi chéo
    const jr = rr + dr, jc = cc + dc;
    if (inside(jr, jc) && !blocked(s, rr, cc, jr, jc)) out.push(jr * N + jc);
    else {
      for (const [sr, sc] of dr ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) {
        const tr = rr + sr, tc = cc + sc;
        if (inside(tr, tc) && !blocked(s, rr, cc, tr, tc)) out.push(tr * N + tc);
      }
    }
  }
  return out;
}

const goalRow = (seat) => (seat === 0 ? 0 : N - 1);

function hasPath(s, seat) {
  const seen = new Set([s.pawns[seat]]);
  const q = [s.pawns[seat]];
  while (q.length) {
    const [r, c] = pos(q.shift());
    if (r === goalRow(seat)) return true;
    for (const [rr, cc] of steps(s, r, c)) {
      const k = rr * N + cc;
      if (!seen.has(k)) { seen.add(k); q.push(k); }
    }
  }
  return false;
}

function wallError(s, w) {
  if (!['h', 'v'].includes(w.t) || !Number.isInteger(w.r) || !Number.isInteger(w.c) || w.r < 0 || w.r > N - 2 || w.c < 0 || w.c > N - 2) return 'Vị trí tường không hợp lệ.';
  for (const x of s.walls) {
    if (x.r === w.r && x.c === w.c) return 'Tường bị chồng lên tường khác.';
    if (x.t === w.t && w.t === 'h' && x.r === w.r && Math.abs(x.c - w.c) === 1) return 'Tường bị chồng lên tường khác.';
    if (x.t === w.t && w.t === 'v' && x.c === w.c && Math.abs(x.r - w.r) === 1) return 'Tường bị chồng lên tường khác.';
  }
  s.walls.push(w);
  const ok = hasPath(s, 0) && hasPath(s, 1);
  s.walls.pop();
  return ok ? null : 'Không được chặn kín đường của bất kỳ ai.';
}

module.exports = {
  meta: {
    name: 'Bức tường',
    desc: 'Quoridor: đua quân sang bờ đối diện, đặt tường khéo léo để chặn đường đối thủ.',
    sides: [{ name: 'Tím', color: '#8b5cf6' }, { name: 'Cam', color: '#f59e0b' }],
    rules: [
      'Mỗi lượt chọn một trong hai: đi quân 1 ô (lên, xuống, trái, phải) hoặc đặt 1 bức tường dài 2 ô.',
      'Quân đối thủ đứng cạnh thì được nhảy qua. Phía sau có tường thì nhảy chéo sang hai bên.',
      'Mỗi người có 10 bức tường. Không được đặt tường chặn kín hoàn toàn đường về đích của ai.',
      'Ai đưa quân tới hàng cuối phía đối diện trước là thắng.',
    ],
  },
  clock: true,
  settings: { time: { label: 'Thời gian mỗi bên', default: 0, options: [[0, 'Không giới hạn'], [180, '3 phút'], [300, '5 phút'], [600, '10 phút']] } },

  init() {
    return { pawns: [(N - 1) * N + 4, 4], walls: [], left: [WALLS, WALLS], turn: 0, last: null };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    if (m && Number.isInteger(m.to)) {
      if (!pawnMoves(s, seat).includes(m.to)) return 'Không đi được tới ô đó.';
      s.last = { seat, from: s.pawns[seat], to: m.to };
      s.pawns[seat] = m.to;
    } else if (m && m.wall) {
      if (!s.left[seat]) return 'Bạn đã hết tường.';
      const w = { t: m.wall.t, r: m.wall.r, c: m.wall.c };
      const err = wallError(s, w);
      if (err) return err;
      s.walls.push({ ...w, s: seat });
      s.left[seat]--;
      s.last = { seat, wall: w };
    } else return 'Nước đi không hợp lệ.';
    s.turn = 1 - seat;
  },

  result(s) {
    for (const seat of [0, 1]) if (pos(s.pawns[seat])[0] === goalRow(seat)) return { winner: seat, reason: 'Về đích trước' };
    return null;
  },

  view(s) {
    return { ...s, moves: pawnMoves(s, s.turn) };
  },
};
