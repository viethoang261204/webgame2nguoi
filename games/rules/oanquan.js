// Ô ăn quan: 10 ô dân + 2 ô quan. Ô 0 = quan trái, 1..5 = dân bên 0 (hàng dưới, trái → phải),
// ô 6 = quan phải, 7..11 = dân bên 1 (hàng trên, phải → trái). Đi theo vòng 0→1→...→11→0.
const QUAN = 10; // 1 quan = 10 dân
const isQuan = (i) => i === 0 || i === 6;
const sideOf = (i) => (i >= 1 && i <= 5 ? 0 : i >= 7 && i <= 11 ? 1 : null);
const next = (i, d) => (i + d + 12) % 12;
const empty = (cell) => cell.d === 0 && cell.q === 0;

module.exports = {
  meta: {
    name: 'Ô ăn quan',
    desc: 'Trò chơi dân gian Việt Nam: rải quân, ăn dân, ăn quan, ai nhiều điểm hơn thắng.',
    sides: [{ name: 'Bên dưới', color: '#22c55e' }, { name: 'Bên trên', color: '#eab308' }],
    rules: [
      'Mỗi lượt chọn một ô dân bên mình còn quân và chọn hướng rải. Bốc hết quân trong ô, rải lần lượt mỗi ô một viên.',
      'Rải hết mà ô kế tiếp còn quân thì bốc ô đó rải tiếp. Ô kế tiếp là ô quan thì mất lượt.',
      'Ô kế tiếp trống mà ô sau nó có quân thì ăn hết ô đó, và có thể ăn liên tiếp theo kiểu cách một ô trống.',
      'Hai ô trống liền nhau thì mất lượt. Đến lượt mà 5 ô dân bên mình đều trống thì phải lấy 5 dân đã ăn ra rải lại.',
      'Hết cả hai ô quan thì kết thúc, mỗi bên thu dân còn lại bên mình. Quan tính 10 điểm, dân 1 điểm.',
    ],
  },

  init() {
    const cells = Array.from({ length: 12 }, (_, i) => (isQuan(i) ? { d: 0, q: 1 } : { d: 5, q: 0 }));
    return { cells, turn: 0, caps: [{ d: 0, q: 0 }, { d: 0, q: 0 }], steps: [], last: null, over: false, scatter: null };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const { i, dir } = m || {};
    if (sideOf(i) !== seat) return 'Chỉ được bốc ô dân bên mình.';
    if (dir !== 1 && dir !== -1) return 'Hướng rải không hợp lệ.';
    if (!s.cells[i].d) return 'Ô này không còn quân.';
    const steps = [];
    let pos = i;
    let hand = s.cells[i].d;
    s.cells[i].d = 0;
    steps.push({ t: 'pick', i, n: hand });
    for (let guard = 0; guard < 200; guard++) {
      while (hand > 0) { pos = next(pos, dir); s.cells[pos].d++; hand--; steps.push({ t: 'drop', i: pos }); }
      const n1 = next(pos, dir);
      if (isQuan(n1)) break; // gặp ô quan: mất lượt
      if (!empty(s.cells[n1])) { hand = s.cells[n1].d; s.cells[n1].d = 0; pos = n1; steps.push({ t: 'pick', i: n1, n: hand }); continue; }
      // ô trống: ăn ô kế tiếp, có thể ăn liên tiếp
      let cur = n1;
      for (;;) {
        const target = next(cur, dir);
        if (empty(s.cells[target])) break;
        const got = { ...s.cells[target] };
        s.caps[seat].d += got.d; s.caps[seat].q += got.q;
        s.cells[target] = { d: 0, q: 0 };
        steps.push({ t: 'eat', i: target, d: got.d, q: got.q });
        const gap = next(target, dir);
        if (!empty(s.cells[gap])) break;
        cur = gap;
      }
      break;
    }
    s.steps = steps;
    s.last = { seat, i, dir };
    s.n = (s.n || 0) + 1;
    s.scatter = null;
    // hết quan hai bên: thu dân về và kết thúc
    if (empty(s.cells[0]) && empty(s.cells[6])) {
      for (let k = 1; k <= 11; k++) {
        const side = sideOf(k);
        if (side === null) continue;
        s.caps[side].d += s.cells[k].d; s.cells[k].d = 0;
      }
      s.over = true;
      return;
    }
    s.turn = 1 - seat;
    // bên tới lượt hết dân: lấy 5 dân đã ăn rải lại (thiếu thì vay, điểm có thể âm)
    const own = s.turn === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11];
    if (own.every((k) => !s.cells[k].d)) {
      own.forEach((k) => (s.cells[k].d = 1));
      s.caps[s.turn].d -= 5;
      s.scatter = s.turn;
    }
  },

  result(s) {
    if (!s.over) return null;
    const pts = s.caps.map((c) => c.d + c.q * QUAN);
    if (pts[0] === pts[1]) return { winner: -1, reason: `Bằng điểm ${pts[0]} - ${pts[1]}` };
    return { winner: pts[0] > pts[1] ? 0 : 1, reason: `Nhiều điểm hơn (${Math.max(...pts)} - ${Math.min(...pts)})` };
  },

  view(s) {
    return { ...s, points: s.caps.map((c) => c.d + c.q * QUAN) };
  },
};
