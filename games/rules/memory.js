// Lật hình (Memory) 6x6 = 18 cặp lá cờ các nước
const FLAGS = ['vn', 'jp', 'kr', 'cn', 'th', 'us', 'gb', 'fr', 'de', 'it', 'es', 'br', 'ar', 'ca', 'au', 'in', 'ru', 'mx',
  'pt', 'nl', 'se', 'ch', 'tr', 'gr', 'eg', 'za', 'ng', 'sa', 'ae', 'sg', 'my', 'id', 'ph', 'la', 'kh', 'nz', 'no', 'fi',
  'dk', 'be', 'pl', 'ua', 'il', 'cl', 'co', 'pe', 'cu', 'ie'];
const PAIRS = 18;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

module.exports = {
  meta: {
    name: 'Lật hình',
    desc: 'Lật hai thẻ tìm cặp lá cờ giống nhau. Trúng thì được lật tiếp.',
    sides: [{ name: 'Người 1', color: '#a78bfa' }, { name: 'Người 2', color: '#2dd4bf' }],
    rules: [
      'Mỗi lượt lật 2 thẻ. Hai thẻ cùng lá cờ thì bạn giữ cặp đó và được lật tiếp.',
      'Khác nhau thì thẻ sẽ úp lại khi người kế tiếp lật thẻ đầu tiên, nhớ kỹ vị trí nhé.',
      'Hết thẻ, ai giữ nhiều cặp hơn thắng.',
    ],
  },

  init() {
    const codes = shuffle([...FLAGS]).slice(0, PAIRS);
    return {
      cards: shuffle([...codes, ...codes]), taken: Array(PAIRS * 2).fill(null),
      flips: [], reveal: [], score: [0, 0], turn: 0, lastMatch: null,
    };
  },

  turn: (s) => s.turn,

  move(s, seat, m) {
    const i = m?.i;
    if (!Number.isInteger(i) || i < 0 || i >= s.cards.length) return 'Thẻ không hợp lệ.';
    if (s.taken[i] !== null || s.flips.includes(i)) return 'Thẻ này đã lật.';
    if (!s.flips.length) s.reveal = [];
    s.flips.push(i);
    s.lastMatch = null;
    if (s.flips.length < 2) return;
    const [a, b] = s.flips;
    s.flips = [];
    if (s.cards[a] === s.cards[b]) {
      s.taken[a] = s.taken[b] = seat;
      s.score[seat]++;
      s.lastMatch = [a, b];
    } else {
      s.reveal = [a, b];
      s.turn = 1 - seat;
    }
  },

  result(s) {
    if (s.taken.some((t) => t === null)) return null;
    const [a, b] = s.score;
    if (a === b) return { winner: -1, reason: `Bằng nhau ${a} - ${b} cặp` };
    return { winner: a > b ? 0 : 1, reason: `Nhiều cặp hơn (${Math.max(a, b)} - ${Math.min(a, b)})` };
  },

  // chỉ gửi mặt thẻ đã lật, thẻ úp thì ẩn
  view(s) {
    const open = new Set([...s.flips, ...s.reveal]);
    return { ...s, cards: s.cards.map((c, i) => (s.taken[i] !== null || open.has(i) ? c : null)) };
  },
};
