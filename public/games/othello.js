// Cờ lật: bàn nỉ xanh 8x8, quân hai mặt đen/trắng lật có hiệu ứng
const N = 8;
const DISC = [
  'bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_60%,#030712)]',
  'bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e5e7eb_60%,#9ca3af)]',
];

let api, el, cells = [];

export default {
  mount({ board }, a) {
    api = a;
    api.setAspect(1);
    el = board;
    el.innerHTML = `
      <div class="h-full w-full rounded-[3%] bg-[#0b3d2a] p-[2.5%] shadow-board ring-1 ring-black/40">
        <div class="grid h-full w-full grid-cols-8 grid-rows-8 gap-px overflow-hidden rounded-[1.5%] bg-black/50">
          ${Array.from({ length: N * N }, (_, i) => `
            <button class="relative bg-gradient-to-br from-[#1b7a4f] to-[#156b44] outline-none" data-i="${i}">
              <span class="disc absolute inset-[9%] hidden rounded-full shadow-[0_3px_5px_rgba(0,0,0,.5)]"></span>
              <span class="hint hint-dot hidden bg-black/30"></span>
            </button>`).join('')}
        </div>
      </div>`;
    cells = [...el.querySelectorAll('[data-i]')];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b && api.view?.canMove) api.move({ i: +b.dataset.i });
    });
  },

  render(v, prev) {
    const s = v.state;
    const legal = new Set(v.canMove ? s.legal : []);
    const flipped = new Set(prev?.state?.last !== s.last ? s.flipped : []);
    s.board.forEach((p, i) => {
      const c = cells[i];
      const d = c.querySelector('.disc');
      d.className = `disc absolute inset-[9%] rounded-full shadow-[0_3px_5px_rgba(0,0,0,.5)] ${p === null ? 'hidden' : DISC[p]}`;
      if (i === s.last && prev?.state?.last !== s.last) d.classList.add('anim-pop');
      if (flipped.has(i)) d.classList.add('anim-flip');
      c.querySelector('.hint').classList.toggle('hidden', !legal.has(i));
      c.classList.toggle('cursor-pointer', legal.has(i));
      c.classList.toggle('ring-2', i === s.last);
      c.classList.toggle('ring-inset', i === s.last);
      c.classList.toggle('ring-amber-300/80', i === s.last);
    });
    if (s.passed !== null && s.passed !== undefined && prev?.state?.last !== s.last) {
      api.toast(`${api.sideName(s.passed)} không có nước đi, mất lượt`, 'warning');
    }
  },

  info(v, seat) { return `${v.state.counts[seat]} quân`; },
};
