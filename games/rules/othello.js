// Cờ lật (Othello / Reversi) 8x8
const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function flips(board, i, seat) {
  if (board[i] !== null) return [];
  const r = Math.floor(i / N), c = i % N;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === 1 - seat) {
      line.push(rr * N + cc); rr += dr; cc += dc;
    }
    if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === seat) out.push(...line);
  }
  return out;
}
const legalMoves = (board, seat) => board.map((_, i) => i).filter((i) => flips(board, i, seat).length);
const count = (board, seat) => board.filter((v) => v === seat).length;

module.exports = {
  meta: {
    name: 'Cờ lật',
    desc: 'Othello cổ điển: kẹp quân đối thủ để lật thành màu của mình.',
    sides: [{ name: 'Đen', color: '#111827' }, { name: 'Trắng', color: '#f8fafc' }],
    rules: [
      'Đặt quân sao cho kẹp được ít nhất một dãy quân đối thủ giữa quân mới và một quân của mình (ngang, dọc, chéo).',
      'Các quân bị kẹp sẽ bị lật sang màu của bạn.',
      'Không có nước đi hợp lệ thì tự động mất lượt.',
      'Khi cả hai không thể đi, ai nhiều quân hơn thắng.',
    ],
  },

  init() {
    const board = Array(N * N).fill(null);
    board[27] = 1; board[36] = 1; board[28] = 0; board[35] = 0;
    return { board, turn: 0, last: null, flipped: [], passed: null, over: false };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const i = m?.i;
    if (!Number.isInteger(i) || i < 0 || i >= N * N) return 'Ô không hợp lệ.';
    const f = flips(s.board, i, seat);
    if (!f.length) return 'Nước đi này không lật được quân nào.';
    s.board[i] = seat;
    for (const k of f) s.board[k] = seat;
    s.last = i;
    s.flipped = f;
    s.passed = null;
    if (legalMoves(s.board, 1 - seat).length) s.turn = 1 - seat;
    else if (legalMoves(s.board, seat).length) s.passed = 1 - seat; // đối thủ mất lượt
    else s.over = true;
  },

  result(s) {
    if (!s.over) return null;
    const a = count(s.board, 0), b = count(s.board, 1);
    if (a === b) return { winner: -1, reason: `Bằng quân ${a} - ${b}` };
    return { winner: a > b ? 0 : 1, reason: `Nhiều quân hơn (${Math.max(a, b)} - ${Math.min(a, b)})` };
  },

  view(s) {
    return { ...s, legal: s.over ? [] : legalMoves(s.board, s.turn), counts: [count(s.board, 0), count(s.board, 1)] };
  },
};
