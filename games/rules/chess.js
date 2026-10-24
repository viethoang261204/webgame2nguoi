// Cờ vua: luật đầy đủ dùng chess.js (nhập thành, bắt tốt qua đường, phong cấp, hòa 3 lần lặp...)
const { Chess } = require('chess.js');

// giữ sẵn đối tượng Chess theo từng ván để khỏi phải đi lại từ đầu mỗi nước
const cache = new WeakMap();
function replay(s) {
  const hit = cache.get(s);
  if (hit && hit.n === s.moves.length) return hit.c;
  const c = new Chess();
  for (const m of s.moves) c.move(m);
  cache.set(s, { c, n: s.moves.length });
  return c;
}

const TIME = { label: 'Thời gian mỗi bên', default: 600, options: [[0, 'Không giới hạn'], [180, '3 phút'], [300, '5 phút'], [600, '10 phút'], [900, '15 phút'], [1800, '30 phút']] };
const INC = { label: 'Cộng giây mỗi nước', default: 0, options: [[0, 'Không'], [2, '+2 giây'], [5, '+5 giây'], [10, '+10 giây']] };

module.exports = {
  meta: {
    name: 'Cờ vua',
    desc: 'Cờ vua chuẩn quốc tế với đồng hồ, bàn cờ kéo thả mượt như lichess.',
    sides: [{ name: 'Trắng', color: '#f8fafc' }, { name: 'Đen', color: '#111827' }],
    rules: [
      'Luật cờ vua quốc tế đầy đủ: nhập thành, bắt tốt qua đường, phong cấp.',
      'Chiếu hết vua đối phương để thắng. Hết giờ là thua.',
      'Hòa khi hết nước đi (pat), lặp lại 3 lần, không đủ quân chiếu hết, luật 50 nước hoặc hai bên đồng ý.',
      'Kéo thả hoặc bấm quân rồi bấm ô đích để đi.',
    ],
  },
  clock: true,
  settings: { time: TIME, inc: INC },

  init() {
    return { moves: [], fen: new Chess().fen(), last: null, san: [] };
  },

  turn: (s) => (s.fen.split(' ')[1] === 'w' ? 0 : 1),

  move(s, seat, m) {
    const c = replay(s);
    if ((c.turn() === 'w' ? 0 : 1) !== seat) return 'Chưa tới lượt bạn.';
    let r;
    try {
      r = c.move({ from: String(m?.from), to: String(m?.to), promotion: m?.promotion ? String(m.promotion) : 'q' });
    } catch { return 'Nước đi không hợp lệ.'; }
    s.moves.push(r.lan);
    cache.set(s, { c, n: s.moves.length });
    s.san.push(r.san);
    s.fen = c.fen();
    s.last = [r.from, r.to];
    s.check = c.inCheck();
    s.end = c.isCheckmate() ? 'mate' : c.isStalemate() ? 'stalemate' : c.isInsufficientMaterial() ? 'material'
      : c.isThreefoldRepetition() ? 'threefold' : c.isDraw() ? 'fifty' : null;
  },

  result(s) {
    const mover = s.fen.split(' ')[1] === 'w' ? 1 : 0;
    switch (s.end) {
      case 'mate': return { winner: mover, reason: 'Chiếu hết' };
      case 'stalemate': return { winner: -1, reason: 'Hết nước đi (pat)' };
      case 'material': return { winner: -1, reason: 'Không đủ quân để chiếu hết' };
      case 'threefold': return { winner: -1, reason: 'Lặp lại thế cờ 3 lần' };
      case 'fifty': return { winner: -1, reason: 'Luật 50 nước' };
      default: return null;
    }
  },
};
