// Nối ô (Dots and Boxes): lưới 6x6 điểm = 5x5 ô
const N = 5; // số ô mỗi cạnh

module.exports = {
  meta: {
    name: 'Nối ô',
    desc: 'Lần lượt nối hai điểm, khép kín ô vuông để ghi điểm và được đi tiếp.',
    sides: [{ name: 'Xanh', color: '#38bdf8' }, { name: 'Hồng', color: '#f472b6' }],
    rules: [
      'Mỗi lượt vẽ một đoạn thẳng nối hai điểm cạnh nhau.',
      'Vẽ cạnh cuối cùng khép kín một ô thì ô đó thuộc về bạn và bạn được đi tiếp.',
      'Hết ô, ai chiếm nhiều ô hơn thắng.',
    ],
  },

  init() {
    return {
      n: N,
      h: Array((N + 1) * N).fill(null), // cạnh ngang: hàng 0..N, cột 0..N-1
      v: Array(N * (N + 1)).fill(null), // cạnh dọc: hàng 0..N-1, cột 0..N
      boxes: Array(N * N).fill(null),
      score: [0, 0], turn: 0, last: null,
    };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const { t, r, c } = m || {};
    if (!Number.isInteger(r) || !Number.isInteger(c)) return 'Cạnh không hợp lệ.';
    let arr, idx;
    if (t === 'h' && r >= 0 && r <= N && c >= 0 && c < N) { arr = s.h; idx = r * N + c; }
    else if (t === 'v' && r >= 0 && r < N && c >= 0 && c <= N) { arr = s.v; idx = r * (N + 1) + c; }
    else return 'Cạnh không hợp lệ.';
    if (arr[idx] !== null) return 'Cạnh này đã được nối.';
    arr[idx] = seat;
    s.last = { t, r, c };
    const near = t === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    let made = 0;
    for (const [br, bc] of near) {
      if (br < 0 || br >= N || bc < 0 || bc >= N || s.boxes[br * N + bc] !== null) continue;
      const done = s.h[br * N + bc] !== null && s.h[(br + 1) * N + bc] !== null
        && s.v[br * (N + 1) + bc] !== null && s.v[br * (N + 1) + bc + 1] !== null;
      if (done) { s.boxes[br * N + bc] = seat; s.score[seat]++; made++; }
    }
    if (!made) s.turn = 1 - seat;
  },

  result(s) {
    if (s.boxes.some((b) => b === null)) return null;
    const [a, b] = s.score;
    if (a === b) return { winner: -1, reason: `Bằng điểm ${a} - ${b}` };
    return { winner: a > b ? 0 : 1, reason: `Chiếm nhiều ô hơn (${Math.max(a, b)} - ${Math.min(a, b)})` };
  },
};
