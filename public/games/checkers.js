// Cờ đam: chọn quân, server gửi sẵn các chuỗi nước hợp lệ để gợi ý từng bước nhảy
const N = 8;
const PIECE = [
  'bg-[radial-gradient(circle_at_35%_30%,#fca5a5,#dc2626_55%,#7f1d1d)]',
  'bg-[radial-gradient(circle_at_35%_30%,#6b7280,#1f2937_55%,#030712)]',
];
const CROWN = '<svg viewBox="0 0 24 24" class="h-1/2 w-1/2 text-amber-300 drop-shadow" fill="currentColor"><path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4z"/></svg>';

let api, cells = [], prefix = [];

export default {
  mount({ board }, a) {
    api = a;
    api.setAspect(1);
    board.innerHTML = `<div class="h-full w-full rounded-[2.5%] bg-[#5b3a1e] p-[2.5%] shadow-board">
      <div class="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[1%]">
        ${Array.from({ length: N * N }, (_, k) => `<button class="sq relative outline-none" data-k="${k}"></button>`).join('')}
      </div></div>`;
    cells = [...board.querySelectorAll('[data-k]')];
    board.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) onClick(+b.dataset.i);
    });
  },

  render(v, prev) {
    if (prev?.state?.last !== v.state.last || !v.canMove) prefix = [];
    paint();
  },

  info(v, seat) { return `${v.state.counts[seat]} quân`; },
};

// ô hiển thị k -> chỉ số thật i (lật bàn cho bên 1)
const toIdx = (k) => (api.view?.flip ? N * N - 1 - k : k);

function matching() {
  const legal = api.view.state.legal;
  return legal.filter((p) => prefix.every((x, j) => p[j] === x));
}

function onClick(i) {
  const v = api.view;
  if (!v?.canMove) return;
  const s = v.state;
  const piece = s.board[i];
  const mySeat = v.seat === 'both' ? v.turn : v.seat;
  if (piece && piece.s === mySeat) {
    const starts = s.legal.some((p) => p[0] === i);
    prefix = starts ? [i] : [];
    if (!starts) api.toast(s.legal.some((p) => Math.abs(p[1] - p[0]) > 9) ? 'Có quân khác bắt buộc phải ăn' : 'Quân này không đi được', 'warning');
    return paint();
  }
  if (!prefix.length) return;
  const next = matching().filter((p) => p[prefix.length] === i);
  if (!next.length) { prefix = []; return paint(); }
  prefix = [...prefix, i];
  const full = next.find((p) => p.length === prefix.length);
  if (full && next.every((p) => p.length === prefix.length)) {
    const path = prefix;
    prefix = [];
    api.move({ path });
  }
  paint();
}

function paint() {
  const v = api.view;
  if (!v) return;
  const s = v.state;
  const nextSteps = new Set(prefix.length ? matching().map((p) => p[prefix.length]).filter((x) => x !== undefined) : []);
  const mustJump = v.canMove && s.legal.length && Math.abs(Math.floor(s.legal[0][1] / N) - Math.floor(s.legal[0][0] / N)) === 2;
  const jumpers = new Set(mustJump ? s.legal.map((p) => p[0]) : []);
  const last = new Set(s.last || []);
  cells.forEach((c, k) => {
    const i = toIdx(k);
    c.dataset.i = i;
    const dark = (Math.floor(i / N) + (i % N)) % 2 === 1;
    const p = s.board[i];
    const sel = prefix.includes(i);
    c.className = `sq relative outline-none ${dark ? 'bg-[#8b5a2b]' : 'bg-[#e8cfa0]'} ${last.has(i) ? 'after:absolute after:inset-0 after:bg-amber-300/25' : ''}`;
    c.innerHTML = `${p ? `<span class="absolute inset-[10%] grid place-items-center rounded-full ${PIECE[p.s]} shadow-[0_4px_6px_rgba(0,0,0,.5),inset_0_-3px_6px_rgba(0,0,0,.35)]
        ${sel ? 'ring-4 ring-amber-300' : jumpers.has(i) ? 'ring-2 ring-amber-300/70 anim-pulse-ring' : ''}">
        <span class="absolute inset-[18%] rounded-full border-2 border-white/15"></span>${p.k ? CROWN : ''}</span>` : ''}
      ${nextSteps.has(i) ? '<span class="hint-dot bg-amber-300/70"></span>' : ''}`;
  });
}
