// Ô ăn quan: bàn gỗ, sỏi rải từng viên có hiệu ứng
const isQuan = (i) => i === 0 || i === 6;
const next = (i, d) => (i + d + 12) % 12;
const STONE = ['#9ca3af', '#d6d3d1', '#a8a29e', '#cbd5e1', '#e7e5e4', '#94a3b8'];

let api, root, side;
let selected = null;
let animating = false;
let shown = null;   // trạng thái ô đang hiển thị (khi chạy hiệu ứng)
let active = null;

function layout() {
  // [quan trái, hàng trên trái→phải, hàng dưới trái→phải, quan phải]
  return api.view.flip
    ? { L: 6, R: 0, top: [5, 4, 3, 2, 1], bottom: [7, 8, 9, 10, 11] }
    : { L: 0, R: 6, top: [11, 10, 9, 8, 7], bottom: [1, 2, 3, 4, 5] };
}

function stones(cell, big) {
  let h = '';
  if (cell.q) h += '<span class="absolute left-1/2 top-1/2 h-[34%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-[radial-gradient(circle_at_35%_30%,#78716c,#292524)] shadow-[0_3px_6px_rgba(0,0,0,.6)]"></span>';
  const n = Math.min(cell.d, 24);
  for (let k = 0; k < n; k++) {
    const a = k * 2.399 + (big ? 1 : 0);
    const rad = Math.sqrt((k + 0.5) / Math.max(n, 7)) * (big ? 30 : 32);
    const x = 50 + rad * Math.cos(a) * (big ? 0.7 : 1), y = 50 + rad * Math.sin(a) * (big ? 1.1 : 1);
    h += `<span class="absolute w-[17%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_2px_rgba(0,0,0,.5)]"
      style="left:${x}%;top:${y}%;aspect-ratio:1;height:auto;background:radial-gradient(circle at 35% 30%,#fff9,${STONE[k % STONE.length]})"></span>`;
  }
  return h;
}

function cellHtml(i, cells, cls, round) {
  const cell = cells[i];
  const v = api.view;
  const own = v.canMove && !animating && !isQuan(i) && cell.d > 0 && ownerOf(i) === (v.seat === 'both' ? v.turn : v.seat);
  const count = cell.d + (cell.q ? ' + Q' : '');
  return `<div class="relative ${cls} ${round} border border-black/30 bg-[linear-gradient(145deg,#c58b52,#a26a35)] shadow-[inset_0_2px_6px_rgba(0,0,0,.35)]
      ${own ? 'cursor-pointer hover:brightness-110' : ''} ${active === i ? 'ring-4 ring-amber-300 z-10' : ''} ${selected === i ? 'ring-4 ring-primary z-10' : ''}"
      data-i="${i}">
    ${stones(cell, isQuan(i))}
    <span class="absolute left-1.5 top-1 text-[clamp(10px,1.8vw,14px)] font-bold text-amber-50 drop-shadow">${count}</span>
    ${selected === i ? `<div class="absolute inset-x-0 bottom-1 z-20 flex justify-center gap-1">
      <button class="btn btn-circle btn-primary btn-xs" data-dir="left" aria-label="Rải sang trái"><i data-lucide="arrow-left"></i></button>
      <button class="btn btn-circle btn-primary btn-xs" data-dir="right" aria-label="Rải sang phải"><i data-lucide="arrow-right"></i></button></div>` : ''}
  </div>`;
}

const ownerOf = (i) => (i >= 1 && i <= 5 ? 0 : i >= 7 && i <= 11 ? 1 : null);

export default {
  mount({ board, side: sd }, a) {
    api = a;
    side = sd;
    api.setAspect(7 / 2.7);
    board.innerHTML = '<div class="h-full w-full rounded-[3%] bg-[#3a2513] p-[1.6%] shadow-board"><div class="oq flex h-full w-full"></div></div>';
    root = board.querySelector('.oq');
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-dir]');
      if (d && selected !== null) return sow(selected, d.dataset.dir);
      const c = e.target.closest('[data-i]');
      if (!c) return;
      const i = +c.dataset.i;
      const v = api.view;
      if (!v.canMove || animating || isQuan(i) || !v.state.cells[i].d) return;
      if (ownerOf(i) !== (v.seat === 'both' ? v.turn : v.seat)) return;
      selected = selected === i ? null : i;
      paint();
    });
  },

  render(v, prev) {
    selected = null;
    if (prev && prev.state.n !== v.state.n && v.state.steps.length && prev.state.cells) animate(prev.state.cells, v.state.steps);
    else { shown = null; paint(); }
  },

  info(v, seat) { return `${v.state.points[seat]} điểm`; },
};

function sow(i, visualDir) {
  const { top, bottom, L, R } = layout();
  const row = top.includes(i) ? top : bottom;
  const k = row.indexOf(i);
  const rightNeighbor = k === row.length - 1 ? (row === top ? R : R) : row[k + 1];
  const leftNeighbor = k === 0 ? L : row[k - 1];
  const target = visualDir === 'right' ? rightNeighbor : leftNeighbor;
  const dir = next(i, 1) === target ? 1 : -1;
  selected = null;
  api.move({ i, dir });
}

function animate(from, steps) {
  animating = true;
  shown = from.map((c) => ({ ...c }));
  let k = 0;
  const tick = () => {
    if (k >= steps.length) { animating = false; shown = null; active = null; paint(); return; }
    const st = steps[k++];
    if (st.t === 'pick') shown[st.i].d = 0;
    if (st.t === 'drop') shown[st.i].d++;
    if (st.t === 'eat') shown[st.i] = { d: 0, q: 0 };
    active = st.i;
    paint();
    setTimeout(tick, st.t === 'drop' ? 170 : 380);
  };
  tick();
}

function paint() {
  const v = api.view;
  if (!v) return;
  const cells = shown || v.state.cells;
  const { L, R, top, bottom } = layout();
  root.innerHTML = `
    ${cellHtml(L, cells, 'w-[14.3%] shrink-0', 'rounded-l-full')}
    <div class="grid flex-1 grid-cols-5 grid-rows-2">
      ${top.map((i) => cellHtml(i, cells, '', '')).join('')}
      ${bottom.map((i) => cellHtml(i, cells, '', '')).join('')}
    </div>
    ${cellHtml(R, cells, 'w-[14.3%] shrink-0', 'rounded-r-full')}`;
  const caps = v.state.caps;
  side.innerHTML = `<div class="panel p-3 text-sm"><div class="mb-2 font-semibold">Đã ăn</div>
    ${[0, 1].map((s) => `<div class="flex items-center justify-between py-1"><span class="flex items-center gap-2">
      <span class="h-3 w-3 rounded-full" style="background:${api.sideColor(s)}"></span>${api.sideName(s)}</span>
      <span class="text-neutral-content/70">${caps[s].q} quan · ${caps[s].d} dân · <b class="text-base-content">${v.state.points[s]} điểm</b></span></div>`).join('')}
    ${v.state.scatter !== null && v.state.scatter !== undefined ? `<div class="mt-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">${api.sideName(v.state.scatter)} hết dân, đã lấy 5 dân rải lại.</div>` : ''}
  </div>`;
  api.icons();
}
