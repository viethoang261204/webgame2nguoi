// Cờ tướng (Xiangqi) 9 cột x 10 hàng. Bên 0 = Đỏ ở dưới, đi trước.
// Quân: k tướng, a sĩ, e tượng, h mã, r xe, c pháo, p tốt
const W = 9, H = 10;
const at = (r, c) => r * W + c;
const inside = (r, c) => r >= 0 && r < H && c >= 0 && c < W;
const inPalace = (s, r, c) => c >= 3 && c <= 5 && (s === 0 ? r >= 7 : r <= 2);
const ownSide = (s, r) => (s === 0 ? r >= 5 : r <= 4);

function pseudo(board, i) {
  const p = board[i];
  const r = Math.floor(i / W), c = i % W;
  const out = [];
  const add = (rr, cc) => {
    if (!inside(rr, cc)) return;
    const q = board[at(rr, cc)];
    if (!q || q.s !== p.s) out.push(at(rr, cc));
  };
  switch (p.t) {
    case 'k':
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inPalace(p.s, r + dr, c + dc)) add(r + dr, c + dc);
      break;
    case 'a':
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (inPalace(p.s, r + dr, c + dc)) add(r + dr, c + dc);
      break;
    case 'e':
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
        const rr = r + dr, cc = c + dc;
        if (inside(rr, cc) && ownSide(p.s, rr) && !board[at(r + dr / 2, c + dc / 2)]) add(rr, cc);
      }
      break;
    case 'h':
      for (const [dr, dc, lr, lc] of [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]]) {
        if (inside(r + lr, c + lc) && !board[at(r + lr, c + lc)]) add(r + dr, c + dc);
      }
      break;
    case 'r':
    case 'c':
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let rr = r + dr, cc = c + dc, screen = false;
        while (inside(rr, cc)) {
          const q = board[at(rr, cc)];
          if (p.t === 'r') {
            if (!q) out.push(at(rr, cc));
            else { if (q.s !== p.s) out.push(at(rr, cc)); break; }
          } else if (!screen) {
            if (!q) out.push(at(rr, cc)); else screen = true;
          } else if (q) { if (q.s !== p.s) out.push(at(rr, cc)); break; }
          rr += dr; cc += dc;
        }
      }
      break;
    case 'p': {
      const f = p.s === 0 ? -1 : 1;
      add(r + f, c);
      if (!ownSide(p.s, r)) { add(r, c - 1); add(r, c + 1); }
      break;
    }
  }
  return out;
}

function kingPos(board, s) { return board.findIndex((p) => p && p.t === 'k' && p.s === s); }

function attacked(board, s) {
  const k = kingPos(board, s);
  if (k < 0) return true;
  // hai tướng đối mặt không có quân chắn
  const ok = kingPos(board, 1 - s);
  if (ok >= 0 && ok % W === k % W) {
    let blocked = false;
    for (let i = Math.min(k, ok) + W; i < Math.max(k, ok); i += W) if (board[i]) { blocked = true; break; }
    if (!blocked) return true;
  }
  return board.some((p, i) => p && p.s !== s && p.t !== 'k' && pseudo(board, i).includes(k));
}

function legalMoves(board, s) {
  const out = [];
  board.forEach((p, i) => {
    if (!p || p.s !== s) return;
    for (const to of pseudo(board, i)) {
      const b = board.slice();
      b[to] = p; b[i] = null;
      if (!attacked(b, s)) out.push([i, to]);
    }
  });
  return out;
}

const BACK = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];

module.exports = {
  meta: {
    name: 'Cờ tướng',
    desc: 'Cờ tướng truyền thống với bàn cờ và quân chữ Hán, đầy đủ luật tướng không đối mặt.',
    sides: [{ name: 'Đỏ', color: '#dc2626' }, { name: 'Đen', color: '#111827' }],
    rules: [
      'Tướng và Sĩ chỉ đi trong cung. Tượng đi chéo 2 ô, không qua sông, bị cản nếu có quân ở giữa.',
      'Mã đi hình chữ L, bị cản chân. Xe đi thẳng không giới hạn. Pháo đi như Xe nhưng ăn quân phải nhảy qua đúng 1 quân.',
      'Tốt đi thẳng 1 ô, qua sông được đi ngang.',
      'Hai tướng không được đối mặt trên cùng một cột mà không có quân chắn.',
      'Chiếu bí hoặc làm đối phương hết nước đi là thắng.',
    ],
  },
  clock: true,
  settings: { time: { label: 'Thời gian mỗi bên', default: 900, options: [[0, 'Không giới hạn'], [300, '5 phút'], [600, '10 phút'], [900, '15 phút'], [1800, '30 phút']] } },

  init() {
    const board = Array(W * H).fill(null);
    BACK.forEach((t, c) => { board[at(0, c)] = { s: 1, t }; board[at(9, c)] = { s: 0, t }; });
    for (const c of [1, 7]) { board[at(2, c)] = { s: 1, t: 'c' }; board[at(7, c)] = { s: 0, t: 'c' }; }
    for (const c of [0, 2, 4, 6, 8]) { board[at(3, c)] = { s: 1, t: 'p' }; board[at(6, c)] = { s: 0, t: 'p' }; }
    return { board, turn: 0, last: null, quiet: 0, plies: 0, check: false, captured: [[], []] };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const { from, to } = m || {};
    if (!legalMoves(s.board, seat).some(([a, b]) => a === from && b === to)) return 'Nước đi không hợp lệ.';
    const victim = s.board[to];
    if (victim) s.captured[seat].push(victim.t);
    s.board[to] = s.board[from];
    s.board[from] = null;
    s.last = [from, to];
    s.quiet = victim ? 0 : s.quiet + 1;
    s.plies++;
    s.turn = 1 - seat;
    s.check = attacked(s.board, s.turn);
  },

  result(s) {
    if (!legalMoves(s.board, s.turn).length) return { winner: 1 - s.turn, reason: s.check ? 'Chiếu bí' : 'Đối phương hết nước đi' };
    if (s.quiet >= 120) return { winner: -1, reason: '60 nước liền không ăn quân' };
    return null;
  },

  view(s) {
    return { ...s, legal: legalMoves(s.board, s.turn) };
  },
};
