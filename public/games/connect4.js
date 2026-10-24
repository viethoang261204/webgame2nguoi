// Thả 4: bàn 7x6 kiểu khung nhựa, đĩa rơi có hiệu ứng
const W = 7, H = 6;
const DISC = [
  'bg-[radial-gradient(circle_at_35%_30%,#fda4af,#e11d48_55%,#9f1239)]',
  'bg-[radial-gradient(circle_at_35%_30%,#fef9c3,#facc15_55%,#a16207)]',
];

let api, el, cells = [], hoverCol = -1;

export default {
  mount({ board }, a) {
    api = a;
    api.setAspect(W / (H + 0.15));
    el = board;
    el.innerHTML = `
      <div class="grid h-full w-full grid-cols-7 gap-[1.6%] rounded-[4%] bg-gradient-to-b from-[#3443c4] to-[#1f2a86] p-[2.2%] shadow-board ring-1 ring-white/10">
        ${Array.from({ length: W * H }, (_, i) => `
          <button class="relative aspect-square rounded-full bg-base-300 shadow-[inset_0_4px_8px_rgba(0,0,0,.6)] outline-none" data-i="${i}" aria-label="Cột ${(i % W) + 1}">
            <span class="disc absolute inset-[7%] hidden rounded-full shadow-[inset_0_-4px_8px_rgba(0,0,0,.35),0_2px_4px_rgba(0,0,0,.4)]"></span>
          </button>`).join('')}
      </div>`;
    cells = [...el.querySelectorAll('[data-i]')];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b || !api.view?.canMove) return;
      api.move({ col: +b.dataset.i % W });
    });
    el.addEventListener('pointermove', (e) => {
      const b = e.target.closest('[data-i]');
      const c = b ? +b.dataset.i % W : -1;
      if (c !== hoverCol) { hoverCol = c; paintHover(); }
    });
    el.addEventListener('pointerleave', () => { hoverCol = -1; paintHover(); });
  },

  render(v, prev) {
    const s = v.state;
    const win = new Set(s.win?.cells || []);
    s.board.forEach((p, i) => {
      const d = cells[i].querySelector('.disc');
      d.className = `disc absolute inset-[7%] rounded-full shadow-[inset_0_-4px_8px_rgba(0,0,0,.35),0_2px_4px_rgba(0,0,0,.4)] ${p === null ? 'hidden' : DISC[p]}`;
      if (win.has(i)) d.classList.add('ring-4', 'ring-white', 'anim-pulse-ring');
      if (i === s.last && prev?.state?.last !== s.last) {
        d.style.setProperty('--drop-from', `${-(Math.floor(i / W) + 1) * 118}%`);
        d.classList.add('anim-drop');
      }
    });
    paintHover();
  },
};

function paintHover() {
  const v = api.view;
  cells.forEach((c, i) => {
    const on = v?.canMove && hoverCol === i % W;
    c.classList.toggle('bg-base-100', !!on);
    c.classList.toggle('bg-base-300', !on);
  });
}
