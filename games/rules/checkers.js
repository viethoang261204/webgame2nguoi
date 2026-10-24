// Cờ đam (Checkers kiểu Mỹ) 8x8: bắt buộc ăn, ăn liên tiếp, phong vua ở hàng cuối
const N = 8;
const rc = (i) => [Math.floor(i / N), i % N];
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

// hướng đi: quân 0 ở dưới đi lên (r giảm), quân 1 ở trên đi xuống
const dirsFor = (p) => (p.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : p.s === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const promoteRow = (s) => (s === 0 ? 0 : N - 1);

// tất cả chuỗi ăn quân bắt đầu từ ô i (DFS)
function jumpPaths(board, i, piece) {
  const out = [];
  const walk = (pos, path, taken) => {
    const [r, c] = rc(pos);
    let extended = false;
    for (const [dr, dc] of dirsFor(piece)) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!inside(tr, tc)) continue;
      const mid = mr * N + mc, to = tr * N + tc;
      const victim = board[mid];
      if (!victim || victim.s === piece.s || taken.includes(mid)) continue;
      if (board[to] && to !== i) continue;
      extended = true;
      // tới hàng phong vua thì kết thúc lượt
      if (!piece.k && tr === promoteRow(piece.s)) out.push([...path, to]);
      else walk(to, [...path, to], [...taken, mid]);
    }
    if (!extended && path.length > 1) out.push(path);
  };
  walk(i, [i], []);
  return out;
}

function legalPaths(board, seat) {
  const jumps = [], steps = [];
  board.forEach((p, i) => {
    if (!p || p.s !== seat) return;
    jumps.push(...jumpPaths(board, i, p));
    const [r, c] = rc(i);
    for (const [dr, dc] of dirsFor(p)) {
      const tr = r + dr, tc = c + dc;
      if (inside(tr, tc) && !board[tr * N + tc]) steps.push([i, tr * N + tc]);
    }
  });
  return jumps.length ? jumps : steps;
}

module.exports = {
  meta: {
    name: 'Cờ đam',
    desc: 'Checkers 8x8: bắt buộc ăn quân, ăn liên tiếp nhiều quân trong một lượt.',
    sides: [{ name: 'Đỏ', color: '#dc2626' }, { name: 'Đen', color: '#1f2937' }],
    rules: [
      'Quân đi chéo một ô về phía trước trên ô tối màu.',
      'Ăn quân bằng cách nhảy qua quân đối thủ đứng chéo cạnh mình. Có nước ăn thì bắt buộc phải ăn, và phải ăn tiếp nếu còn ăn được.',
      'Quân tới hàng cuối cùng được phong vua, vua đi được cả tiến và lùi.',
      'Đối thủ hết quân hoặc không còn nước đi thì bạn thắng. 40 nước không ai ăn quân thì hòa.',
    ],
  },
  clock: true,
  settings: { time: { label: 'Thời gian mỗi bên', default: 0, options: [[0, 'Không giới hạn'], [180, '3 phút'], [300, '5 phút'], [600, '10 phút']] } },

  init() {
    const board = Array(N * N).fill(null);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) board[r * N + c] = { s: 1, k: false };
      if (r > 4) board[r * N + c] = { s: 0, k: false };
    }
    return { board, turn: 0, last: null, captured: [], quiet: 0 };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const path = m?.path;
    if (!Array.isArray(path) || path.length < 2 || !path.every((x) => Number.isInteger(x))) return 'Nước đi không hợp lệ.';
    const legal = legalPaths(s.board, seat);
    if (!legal.some((p) => p.length === path.length && p.every((x, k) => x === path[k]))) {
      return legal.some((p) => Math.abs(rc(p[1])[0] - rc(p[0])[0]) === 2) ? 'Bắt buộc phải ăn quân (và ăn hết chuỗi).' : 'Nước đi không hợp lệ.';
    }
    const piece = s.board[path[0]];
    s.board[path[0]] = null;
    const captured = [];
    for (let k = 1; k < path.length; k++) {
      const [r1, c1] = rc(path[k - 1]), [r2, c2] = rc(path[k]);
      if (Math.abs(r2 - r1) === 2) {
        const mid = ((r1 + r2) / 2) * N + (c1 + c2) / 2;
        captured.push(mid);
        s.board[mid] = null;
      }
    }
    const end = path[path.length - 1];
    if (rc(end)[0] === promoteRow(seat)) piece.k = true;
    s.board[end] = piece;
    s.last = path;
    s.captured = captured;
    s.quiet = captured.length ? 0 : s.quiet + 1;
    s.turn = 1 - seat;
  },

  result(s) {
    if (!legalPaths(s.board, s.turn).length) {
      const left = s.board.some((p) => p && p.s === s.turn);
      return { winner: 1 - s.turn, reason: left ? 'Đối thủ hết nước đi' : 'Ăn hết quân đối thủ' };
    }
    if (s.quiet >= 80) return { winner: -1, reason: '40 nước liền không ai ăn quân' };
    return null;
  },

  view(s) {
    const count = (seat) => s.board.filter((p) => p && p.s === seat).length;
    return { ...s, legal: legalPaths(s.board, s.turn), counts: [count(0), count(1)] };
  },
};
