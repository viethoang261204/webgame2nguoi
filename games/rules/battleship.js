// Hải chiến (Battleship) 10x10: xếp tàu bí mật rồi bắn lần lượt, bắn trúng được bắn tiếp
const N = 10;
const FLEET = [
  { id: 'carrier', name: 'Tàu sân bay', size: 5 },
  { id: 'battleship', name: 'Thiết giáp hạm', size: 4 },
  { id: 'cruiser', name: 'Tuần dương hạm', size: 3 },
  { id: 'submarine', name: 'Tàu ngầm', size: 3 },
  { id: 'destroyer', name: 'Khu trục hạm', size: 2 },
];

function cellsOf(sh) {
  const out = [];
  for (let k = 0; k < sh.size; k++) {
    const r = sh.r + (sh.dir === 'v' ? k : 0), c = sh.c + (sh.dir === 'h' ? k : 0);
    if (r >= N || c >= N) return null;
    out.push(r * N + c);
  }
  return out;
}

module.exports = {
  meta: {
    name: 'Hải chiến',
    desc: 'Bí mật xếp hạm đội rồi đoán tọa độ để bắn chìm toàn bộ tàu đối thủ.',
    sides: [{ name: 'Hạm đội Xanh', color: '#38bdf8' }, { name: 'Hạm đội Cam', color: '#fb923c' }],
    rules: [
      'Mỗi bên xếp 5 tàu (dài 5, 4, 3, 3, 2 ô) theo hàng ngang hoặc dọc, không chồng lên nhau.',
      'Lần lượt chọn một ô trên bản đồ đối thủ để bắn. Bắn trúng được bắn tiếp, trượt thì mất lượt.',
      'Trúng hết các ô của một tàu thì tàu đó chìm.',
      'Bắn chìm toàn bộ hạm đội đối thủ trước là thắng.',
    ],
  },
  local: false,
  fleet: FLEET,

  init() {
    return {
      phase: 'place', ready: [false, false], ships: [[], []],
      shots: [Array(N * N).fill(null), Array(N * N).fill(null)], // shots[s] = các phát s đã bắn vào biển đối thủ
      turn: 0, last: null, sunk: [[], []],
    };
  },

  turn: (s) => (s.phase === 'place' ? 'both' : s.turn),

  move(s, seat, m) {
    if (s.phase === 'place') {
      if (s.ready[seat]) return 'Bạn đã xếp tàu xong, chờ đối thủ.';
      const list = m?.ships;
      if (!Array.isArray(list) || list.length !== FLEET.length) return 'Cần xếp đủ 5 tàu.';
      const used = new Set();
      const ships = [];
      for (let k = 0; k < FLEET.length; k++) {
        const sh = list[k];
        if (!sh || !Number.isInteger(sh.r) || !Number.isInteger(sh.c) || !['h', 'v'].includes(sh.dir) || sh.r < 0 || sh.c < 0) return 'Vị trí tàu không hợp lệ.';
        const cells = cellsOf({ ...sh, size: FLEET[k].size });
        if (!cells) return 'Tàu nằm ngoài bản đồ.';
        if (cells.some((i) => used.has(i))) return 'Các tàu không được chồng lên nhau.';
        cells.forEach((i) => used.add(i));
        ships.push({ id: FLEET[k].id, name: FLEET[k].name, size: FLEET[k].size, r: sh.r, c: sh.c, dir: sh.dir, cells, hits: 0 });
      }
      s.ships[seat] = ships;
      s.ready[seat] = true;
      if (s.ready[0] && s.ready[1]) s.phase = 'battle';
      return;
    }
    const i = m?.i;
    if (!Number.isInteger(i) || i < 0 || i >= N * N) return 'Ô không hợp lệ.';
    if (s.shots[seat][i] !== null) return 'Ô này đã bắn rồi.';
    const target = s.ships[1 - seat].find((sh) => sh.cells.includes(i));
    s.last = { seat, i, hit: !!target, sunk: null };
    if (!target) { s.shots[seat][i] = 'miss'; s.turn = 1 - seat; return; }
    s.shots[seat][i] = 'hit';
    target.hits++;
    if (target.hits === target.size) { s.sunk[1 - seat].push(target.id); s.last.sunk = target.name; }
  },

  result(s) {
    for (const seat of [0, 1]) {
      if (s.phase === 'battle' && s.sunk[1 - seat].length === FLEET.length) return { winner: seat, reason: 'Bắn chìm toàn bộ hạm đội' };
    }
    return null;
  },

  // ẩn vị trí tàu đối thủ, chỉ lộ tàu đã chìm
  view(s, seat) {
    const ships = [0, 1].map((k) => (k === seat ? s.ships[k] : s.ships[k].filter((sh) => s.sunk[k].includes(sh.id))));
    return { ...s, ships, fleet: FLEET };
  },
};
