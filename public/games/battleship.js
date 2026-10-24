// Hải chiến: xếp tàu bằng cách chạm (có xoay, xếp ngẫu nhiên), sau đó bắn vào biển đối thủ
const N = 10;
const LETTERS = 'ABCDEFGHIJ';

let api, boardEl, controls, side;
let placed = [];   // vị trí tàu đang xếp: {r,c,dir} | null
let pick = 0;      // tàu đang chọn để đặt
let dir = 'h';
let hover = null;
let lastShotKey = '';
let lastRound = 0;

const fleet = () => api.view.state.fleet;
function cellsOf(sh, size) {
  const out = [];
  for (let k = 0; k < size; k++) {
    const r = sh.r + (sh.dir === 'v' ? k : 0), c = sh.c + (sh.dir === 'h' ? k : 0);
    if (r >= N || c >= N) return null;
    out.push(r * N + c);
  }
  return out;
}
function occupied(except = -1) {
  const set = new Set();
  placed.forEach((p, k) => { if (p && k !== except) cellsOf(p, fleet()[k].size).forEach((i) => set.add(i)); });
  return set;
}
function canPlace(k, sh) {
  const cells = cellsOf(sh, fleet()[k].size);
  if (!cells) return false;
  const occ = occupied(k);
  return cells.every((i) => !occ.has(i));
}
function randomize() {
  for (let tries = 0; tries < 50; tries++) {
    placed = fleet().map(() => null);
    let ok = true;
    for (let k = 0; k < fleet().length && ok; k++) {
      ok = false;
      for (let t = 0; t < 200; t++) {
        const sh = { r: Math.floor(Math.random() * N), c: Math.floor(Math.random() * N), dir: Math.random() < 0.5 ? 'h' : 'v' };
        if (canPlace(k, sh)) { placed[k] = sh; ok = true; break; }
      }
    }
    if (ok) break;
  }
  pick = -1;
}

function gridHtml(id) {
  let h = `<div class="grid h-full w-full grid-cols-11 grid-rows-11 gap-[2px] text-[clamp(8px,1.6vw,12px)] font-semibold text-neutral-content/50">
    <div></div>${[...LETTERS].map((l) => `<div class="grid place-items-center">${l}</div>`).join('')}`;
  for (let r = 0; r < N; r++) {
    h += `<div class="grid place-items-center">${r + 1}</div>`;
    for (let c = 0; c < N; c++) h += `<button class="cell relative rounded-[3px] outline-none" data-${id}="${r * N + c}"></button>`;
  }
  return `${h}</div>`;
}

const WATER = 'bg-[linear-gradient(160deg,#16325c,#0f2547)]';
function hullClass(i, ship) {
  const k = ship.cells.indexOf(i);
  const end = ship.dir === 'h'
    ? `${k === 0 ? 'rounded-l-full' : ''} ${k === ship.size - 1 ? 'rounded-r-full' : ''}`
    : `${k === 0 ? 'rounded-t-full' : ''} ${k === ship.size - 1 ? 'rounded-b-full' : ''}`;
  return end;
}

export default {
  mount({ board, controls: ctl, side: sd }, a) {
    api = a;
    boardEl = board; controls = ctl; side = sd;
    api.setAspect(1);
    board.innerHTML = `<div class="h-full w-full rounded-2xl bg-base-100 p-[2.5%] shadow-board ring-1 ring-white/10">${gridHtml('t')}</div>`;
    board.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (b) onCell(+b.dataset.t);
    });
    board.addEventListener('pointermove', (e) => {
      const b = e.target.closest('[data-t]');
      const h = b ? +b.dataset.t : null;
      if (h !== hover) { hover = h; paint(); }
    });
    board.addEventListener('pointerleave', () => { hover = null; paint(); });
    controls.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'pick') pick = +b.dataset.k;
      if (act === 'rotate') dir = dir === 'h' ? 'v' : 'h';
      if (act === 'random') randomize();
      if (act === 'clear') { placed = fleet().map(() => null); pick = 0; }
      if (act === 'ready') {
        if (placed.some((p) => !p)) return api.toast('Cần xếp đủ 5 tàu', 'warning');
        api.move({ ships: placed });
        return;
      }
      paint();
    });
  },

  render(v) {
    if (v.round !== lastRound) { lastRound = v.round; placed = v.state.fleet.map(() => null); pick = 0; }
    const l = v.state.last;
    const key = l ? `${v.round}:${l.seat}:${l.i}` : '';
    if (l && key !== lastShotKey && lastShotKey) {
      const mine = l.seat === v.seat;
      if (l.sunk) api.toast(mine ? `Bắn chìm ${l.sunk}!` : `${l.sunk} của bạn đã chìm`, mine ? 'success' : 'error');
      else api.toast(l.hit ? (mine ? 'Trúng! Bắn tiếp' : 'Đối thủ bắn trúng') : (mine ? 'Trượt' : 'Đối thủ bắn trượt'), l.hit ? (mine ? 'success' : 'warning') : 'info');
    }
    lastShotKey = key;
    paint();
  },

  status(v) {
    const s = v.state;
    if (s.phase !== 'place' || v.seat === null) return null;
    const ready = s.ready[v.seat];
    return `<div class="flex items-center gap-3">${ready ? '<span class="loading loading-dots loading-md text-primary"></span>' : '<i data-lucide="anchor" class="h-5 w-5 text-primary"></i>'}
      <div><div class="font-semibold">${ready ? 'Chờ đối thủ xếp tàu' : 'Xếp hạm đội của bạn'}</div>
      <div class="text-sm text-neutral-content/60">${ready ? 'Hạm đội của bạn đã sẵn sàng' : 'Chọn tàu rồi chạm vào bản đồ để đặt'}</div></div></div>`;
  },

  info(v, seat) {
    if (v.state.phase === 'place') return v.state.ready[seat] ? 'Đã sẵn sàng' : 'Đang xếp tàu';
    return `Còn ${5 - v.state.sunk[seat].length} tàu`;
  },
};

function onCell(i) {
  const v = api.view;
  const s = v.state;
  if (v.seat === null) return;
  if (s.phase === 'place') {
    if (s.ready[v.seat]) return;
    const r = Math.floor(i / N), c = i % N;
    if (pick < 0) {
      // chạm vào tàu đã đặt để nhấc lên
      const k = placed.findIndex((p, k2) => p && cellsOf(p, fleet()[k2].size).includes(i));
      if (k >= 0) { pick = k; dir = placed[k].dir; placed[k] = null; }
      return paint();
    }
    const sh = { r, c, dir };
    if (!canPlace(pick, sh)) return api.toast('Không đặt được ở đây', 'warning');
    placed[pick] = sh;
    pick = placed.findIndex((p) => !p);
    return paint();
  }
  if (v.canMove) api.move({ i });
}

function shotMark(kind) {
  if (kind === 'miss') return '<span class="absolute inset-0 m-auto h-[26%] w-[26%] rounded-full bg-white/60 anim-pop"></span>';
  if (kind === 'hit') return '<span class="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,#fde68a,#f97316_45%,#b91c1c)] shadow-[0_0_10px_#f97316] anim-pop"></span>';
  return '';
}

function paint() {
  const v = api.view;
  if (!v) return;
  const s = v.state;
  const me = v.seat ?? 0;
  const opp = 1 - me;
  const placing = s.phase === 'place' && v.seat !== null && !s.ready[me];
  const cells = [...boardEl.querySelectorAll('[data-t]')];

  if (s.phase === 'place') {
    // bản đồ của mình để xếp tàu
    const ships = s.ready[me] ? s.ships[me] : placed.map((p, k) => p && { ...p, size: fleet()[k].size, cells: cellsOf(p, fleet()[k].size), k }).filter(Boolean);
    const shipAt = new Map();
    ships.forEach((sh) => sh.cells.forEach((i) => shipAt.set(i, sh)));
    let preview = new Set(), valid = false;
    if (placing && pick >= 0 && hover !== null) {
      const sh = { r: Math.floor(hover / N), c: hover % N, dir };
      const pc = cellsOf(sh, fleet()[pick].size);
      valid = canPlace(pick, sh);
      preview = new Set(pc || [hover]);
    }
    cells.forEach((el, i) => {
      const sh = shipAt.get(i);
      let cls = `cell relative rounded-[3px] outline-none ${WATER}`;
      if (sh) cls = `cell relative outline-none bg-[linear-gradient(180deg,#cbd5e1,#64748b)] shadow-[inset_0_-3px_0_rgba(0,0,0,.25)] ${hullClass(i, sh)}`;
      if (preview.has(i)) cls += valid ? ' !bg-emerald-400/70' : ' !bg-rose-500/70';
      el.className = cls;
      el.innerHTML = '';
    });
  } else {
    // bản đồ đối thủ để bắn
    const shots = s.shots[me];
    const sunkCells = new Map();
    s.ships[opp].forEach((sh) => sh.cells.forEach((i) => sunkCells.set(i, sh)));
    cells.forEach((el, i) => {
      const sh = sunkCells.get(i);
      const can = v.canMove && shots[i] === null;
      el.className = `cell relative outline-none ${sh ? `bg-[linear-gradient(180deg,#7f1d1d,#450a0a)] ${hullClass(i, sh)}` : `${WATER} rounded-[3px]`}
        ${can ? 'cursor-crosshair hover:brightness-150' : ''} ${s.last && s.last.seat === me && s.last.i === i ? 'ring-2 ring-amber-300' : ''}`;
      el.innerHTML = shotMark(shots[i]);
    });
  }

  // bảng điều khiển xếp tàu
  if (placing) {
    controls.innerHTML = `<div class="panel flex flex-col gap-2 p-3">
      <div class="flex items-center justify-between text-sm font-semibold"><span>Hạm đội</span>
        <button class="btn btn-ghost btn-xs" data-act="rotate"><i data-lucide="rotate-cw"></i> ${dir === 'h' ? 'Ngang' : 'Dọc'}</button></div>
      <div class="flex flex-col gap-1">${fleet().map((f, k) => `
        <button class="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${pick === k ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-white/5'}" data-act="pick" data-k="${k}">
          <span class="flex gap-0.5">${Array.from({ length: f.size }, () => `<span class="h-3 w-3 rounded-sm ${placed[k] ? 'bg-slate-400' : 'bg-white/15'}"></span>`).join('')}</span>
          <span class="flex-1">${f.name}</span>${placed[k] ? '<i data-lucide="check" class="text-success"></i>' : ''}</button>`).join('')}</div>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-sm" data-act="random"><i data-lucide="shuffle"></i> Ngẫu nhiên</button>
        <button class="btn btn-ghost btn-sm" data-act="clear"><i data-lucide="eraser"></i> Xếp lại</button></div>
      <button class="btn btn-primary" data-act="ready" ${placed.some((p) => !p) ? 'disabled' : ''}><i data-lucide="anchor"></i> Sẵn sàng</button>
      <p class="text-xs text-neutral-content/50">Mẹo: chạm vào tàu đã đặt để nhấc lên đặt lại.</p></div>`;
  } else controls.innerHTML = '';

  // bản đồ nhỏ: hạm đội của mình và các phát bắn của đối thủ
  if (s.phase === 'battle' && v.seat !== null) {
    const myShips = new Map();
    s.ships[me].forEach((sh) => sh.cells.forEach((i) => myShips.set(i, sh)));
    const inc = s.shots[opp];
    let g = '';
    for (let i = 0; i < N * N; i++) {
      const sh = myShips.get(i);
      g += `<div class="relative ${sh ? `${s.sunk[me].includes(sh.id) ? 'bg-rose-900' : 'bg-slate-400'} ${hullClass(i, sh)}` : `${WATER} rounded-[2px]`}">${shotMark(inc[i])}</div>`;
    }
    side.innerHTML = `<div class="panel p-3"><div class="mb-2 text-sm font-semibold">Hạm đội của bạn</div>
      <div class="mx-auto grid aspect-square w-full max-w-[260px] grid-cols-10 gap-[2px]">${g}</div></div>`;
  } else side.innerHTML = '';
  api.icons();
}
