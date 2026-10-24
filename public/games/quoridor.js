// Bức tường (Quoridor): chế độ đi quân / đặt tường, chạm 2 lần để xác nhận tường trên điện thoại
const N = 9;
const CS = 100 / N;
const TH = 2.2; // độ dày tường (%)

let api, root, controls;
let mode = 'move';
let orient = 'h';
let preview = null; // {t,r,c} theo tọa độ thật

const flipRC = (r, c) => (api.view.flip ? [N - 1 - r, N - 1 - c] : [r, c]);

// từ ô trên màn hình -> tường ở khe dưới/phải của ô đó (tọa độ thật)
function wallFromScreen(R, C) {
  const ar = Math.min(R, N - 2), ac = Math.min(C, N - 2);
  if (!api.view.flip) return { t: orient, r: ar, c: ac };
  return { t: orient, r: N - 2 - ar, c: N - 2 - ac };
}
// tường thật -> vị trí trên màn hình
function wallScreen(w) {
  const [r, c] = api.view.flip ? [N - 2 - w.r, N - 2 - w.c] : [w.r, w.c];
  return w.t === 'h'
    ? `left:${c * CS + 0.6}%;top:${(r + 1) * CS - TH / 2}%;width:${2 * CS - 1.2}%;height:${TH}%`
    : `left:${(c + 1) * CS - TH / 2}%;top:${r * CS + 0.6}%;width:${TH}%;height:${2 * CS - 1.2}%`;
}

export default {
  mount({ board, controls: ctl }, a) {
    api = a;
    controls = ctl;
    api.setAspect(1);
    board.innerHTML = `<div class="h-full w-full rounded-2xl bg-[#2b2118] p-[3%] shadow-board ring-1 ring-black/40"><div class="q relative h-full w-full"></div></div>`;
    root = board.querySelector('.q');
    root.addEventListener('click', onClick);
    root.addEventListener('pointermove', (e) => {
      if (mode !== 'wall' || e.pointerType !== 'mouse') return;
      const cell = e.target.closest('[data-rc]');
      if (!cell) return;
      const [R, C] = cell.dataset.rc.split(',').map(Number);
      const w = wallFromScreen(R, C);
      if (!preview || preview.r !== w.r || preview.c !== w.c || preview.t !== w.t) { preview = w; paint(); }
    });
    root.addEventListener('pointerleave', () => { if (preview) { preview = null; paint(); } });
    controls.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m],[data-o]');
      if (!b) return;
      if (b.dataset.m) mode = b.dataset.m;
      if (b.dataset.o) orient = b.dataset.o;
      preview = null;
      paint();
    });
  },

  render(v, prev) {
    if (prev?.state?.last !== v.state.last) preview = null;
    paint();
  },

  info(v, seat) { return `${v.state.left[seat]} tường`; },
};

function onClick(e) {
  const v = api.view;
  if (!v?.canMove) return;
  const cell = e.target.closest('[data-rc]');
  if (!cell) return;
  const [R, C] = cell.dataset.rc.split(',').map(Number);
  if (mode === 'move') {
    const [r, c] = flipRC(R, C);
    if (v.state.moves.includes(r * N + c)) api.move({ to: r * N + c });
    return;
  }
  const w = wallFromScreen(R, C);
  // chuột: bấm là đặt; cảm ứng: chạm lần 1 xem trước, lần 2 xác nhận
  if (e.pointerType === 'mouse' || (preview && preview.r === w.r && preview.c === w.c && preview.t === w.t)) {
    preview = null;
    api.move({ wall: w }).then(() => paint());
  } else { preview = w; paint(); }
}

function paint() {
  const v = api.view;
  if (!v) return;
  const s = v.state;
  const mySeat = v.seat === 'both' ? v.turn : v.seat;
  const moves = new Set(v.canMove && mode === 'move' ? s.moves : []);
  let h = '';
  for (let R = 0; R < N; R++) {
    for (let C = 0; C < N; C++) {
      const [r, c] = flipRC(R, C);
      const goal = r === 0 ? 0 : r === N - 1 ? 1 : null;
      const tint = goal !== null ? `box-shadow:inset 0 0 0 2px ${api.sideColor(goal)}55` : '';
      h += `<button data-rc="${R},${C}" class="absolute rounded-[12%] bg-[linear-gradient(145deg,#c8955c,#a87440)] outline-none
        ${moves.has(r * N + c) ? 'cursor-pointer' : ''}" style="left:${C * CS + 0.9}%;top:${R * CS + 0.9}%;width:${CS - 1.8}%;height:${CS - 1.8}%;${tint}">
        ${moves.has(r * N + c) ? `<span class="hint-dot" style="background:${api.sideColor(mySeat)}aa"></span>` : ''}</button>`;
    }
  }
  s.walls.forEach((w) => {
    h += `<div class="pointer-events-none absolute rounded-full shadow-[0_2px_4px_rgba(0,0,0,.6)]" style="${wallScreen(w)};background:linear-gradient(180deg,#f8e7c8,#d6b47f)"></div>`;
  });
  if (preview && v.canMove) {
    h += `<div class="pointer-events-none absolute rounded-full opacity-70" style="${wallScreen(preview)};background:${api.sideColor(mySeat)}"></div>`;
  }
  s.pawns.forEach((p, seat) => {
    const [R, C] = flipRC(Math.floor(p / N), p % N);
    h += `<div class="pointer-events-none absolute grid place-items-center transition-all duration-300" style="left:${C * CS}%;top:${R * CS}%;width:${CS}%;height:${CS}%">
      <span class="block h-[64%] w-[64%] rounded-full shadow-[0_4px_8px_rgba(0,0,0,.55),inset_0_-4px_6px_rgba(0,0,0,.3)] ring-2 ring-white/70
      ${v.turn === seat && !v.result ? 'anim-pulse-ring' : ''}" style="background:radial-gradient(circle at 35% 30%,#fff7,${api.sideColor(seat)} 55%)"></span></div>`;
  });
  root.innerHTML = h;

  const left = mySeat !== null && mySeat !== undefined ? s.left[mySeat] : 0;
  controls.innerHTML = v.seat === null ? '' : `<div class="panel flex flex-col gap-2 p-3">
    <div class="join w-full">
      <button class="btn join-item btn-sm flex-1 ${mode === 'move' ? 'btn-primary' : ''}" data-m="move"><i data-lucide="footprints"></i> Đi quân</button>
      <button class="btn join-item btn-sm flex-1 ${mode === 'wall' ? 'btn-primary' : ''}" data-m="wall" ${left ? '' : 'disabled'}><i data-lucide="brick-wall"></i> Đặt tường (${left})</button>
    </div>
    ${mode === 'wall' ? `<div class="join w-full">
      <button class="btn join-item btn-xs flex-1 ${orient === 'h' ? 'btn-active' : ''}" data-o="h">Ngang</button>
      <button class="btn join-item btn-xs flex-1 ${orient === 'v' ? 'btn-active' : ''}" data-o="v">Dọc</button></div>
      <p class="text-xs text-neutral-content/50">Chạm vào ô: tường nằm ở cạnh dưới (ngang) hoặc cạnh phải (dọc) của ô đó. Chạm lần nữa để xác nhận.</p>` : ''}
  </div>`;
  api.icons();
}
