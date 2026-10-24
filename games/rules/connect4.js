// Thả 4 (Connect Four): bàn 7 cột x 6 hàng, thả quân xuống cột, 4 quân liên tiếp thắng
const W = 7, H = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

module.exports = {
  meta: {
    name: 'Thả 4',
    desc: 'Thả quân xuống cột, ai xếp được 4 quân liên tiếp trước sẽ thắng.',
    sides: [{ name: 'Đỏ', color: '#f43f5e' }, { name: 'Vàng', color: '#facc15' }],
    rules: [
      'Hai người lần lượt chọn một cột để thả quân, quân rơi xuống ô trống thấp nhất.',
      'Xếp được 4 quân liên tiếp theo hàng ngang, dọc hoặc chéo là thắng.',
      'Bàn đầy mà chưa ai thắng thì hòa.',
    ],
  },

  init() {
    return { board: Array(W * H).fill(null), turn: 0, last: null, win: null, full: false };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const c = m?.col;
    if (!Number.isInteger(c) || c < 0 || c >= W) return 'Cột không hợp lệ.';
    let r = H - 1;
    while (r >= 0 && s.board[r * W + c] !== null) r--;
    if (r < 0) return 'Cột này đã đầy.';
    const i = r * W + c;
    s.board[i] = seat;
    s.last = i;
    for (const [dr, dc] of DIRS) {
      const line = [i];
      for (const k of [1, -1]) {
        let rr = r + dr * k, cc = c + dc * k;
        while (rr >= 0 && rr < H && cc >= 0 && cc < W && s.board[rr * W + cc] === seat) {
          line.push(rr * W + cc); rr += dr * k; cc += dc * k;
        }
      }
      if (line.length >= 4) { s.win = { seat, cells: line }; return; }
    }
    if (s.board.every((v) => v !== null)) { s.full = true; return; }
    s.turn = 1 - seat;
  },

  result(s) {
    if (s.win) return { winner: s.win.seat, reason: 'Xếp được 4 quân liên tiếp' };
    if (s.full) return { winner: -1, reason: 'Bàn cờ đã đầy' };
    return null;
  },
};
