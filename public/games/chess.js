// Cờ vua: bàn cờ chessground (lichess) + chess.js tính nước hợp lệ
import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@9.2.1/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const CSS = ['chessground.base.css', 'chessground.brown.css', 'chessground.cburnett.css'];
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PROMO = [['q', 'Hậu'], ['r', 'Xe'], ['b', 'Tượng'], ['n', 'Mã']];

let api, cg, wrap, side, promoDlg;

function dests(chess) {
  const m = new Map();
  for (const mv of chess.moves({ verbose: true })) {
    if (!m.has(mv.from)) m.set(mv.from, []);
    m.get(mv.from).push(mv.to);
  }
  return m;
}

function material(fen) {
  const board = fen.split(' ')[0];
  let w = 0, b = 0;
  for (const ch of board) {
    const v = VAL[ch.toLowerCase()];
    if (v === undefined) continue;
    if (ch === ch.toUpperCase()) w += v; else b += v;
  }
  return [w - b, b - w];
}

function askPromotion(color) {
  return new Promise((resolve) => {
    const pieces = PROMO.map(([p, n]) => `<button class="btn btn-ghost h-20 flex-col gap-1" data-p="${p}">
      <span class="cg-wrap block h-12 w-12"><piece class="${color} ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[p]}" style="position:static;width:48px;height:48px;display:block"></piece></span>
      <span class="text-xs">${n}</span></button>`).join('');
    promoDlg.querySelector('.choices').innerHTML = pieces;
    promoDlg.showModal();
    promoDlg.querySelector('.choices').onclick = (e) => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      promoDlg.close();
      resolve(b.dataset.p);
    };
    promoDlg.onclose = () => resolve(null);
  });
}

export default {
  mount({ board, side: sideEl }, a) {
    api = a;
    side = sideEl;
    for (const f of CSS) {
      if (document.querySelector(`link[data-cg="${f}"]`)) continue;
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.cg = f;
      l.href = `https://cdn.jsdelivr.net/npm/chessground@9.2.1/assets/${f}`;
      document.head.appendChild(l);
    }
    if (!document.querySelector('style[data-cg-board]')) {
      const st = document.createElement('style');
      st.dataset.cgBoard = '1';
      // màu bàn gỗ kinh điển của lichess
      st.textContent = 'cg-board{background-color:#f0d9b5;background-image:repeating-conic-gradient(#b58863 0 25%,#f0d9b5 0 50%);background-size:25% 25%}'
        + 'cg-board square.last-move{background-color:rgba(155,199,0,.41)}cg-board square.move-dest{background:radial-gradient(rgba(20,85,30,.5) 19%,rgba(0,0,0,0) 20%)}'
        + 'cg-board square.oc.move-dest{background:radial-gradient(transparent 0%,transparent 79%,rgba(20,85,0,.3) 80%)}cg-board square.selected{background-color:rgba(20,85,30,.5)}';
      document.head.appendChild(st);
    }
    api.setAspect(1);
    board.innerHTML = '<div class="h-full w-full overflow-hidden rounded-lg shadow-board"><div class="cg h-full w-full"></div></div>';
    wrap = board.querySelector('.cg');
    promoDlg = document.createElement('dialog');
    promoDlg.className = 'modal';
    promoDlg.innerHTML = `<div class="modal-box max-w-sm border border-white/10 text-center"><h3 class="mb-3 font-bold">Phong cấp thành</h3>
      <div class="choices grid grid-cols-4 gap-2"></div></div><form method="dialog" class="modal-backdrop"><button>close</button></form>`;
    document.body.appendChild(promoDlg);
    side.innerHTML = `<div class="panel p-3"><div class="mb-2 flex items-center justify-between text-sm font-semibold"><span>Biên bản</span><span class="moves-count text-xs text-neutral-content/50"></span></div>
      <div class="moves grid max-h-56 grid-cols-[2rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto font-mono text-sm lg:max-h-[40vh]"></div></div>`;
    cg = Chessground(wrap, {
      coordinates: true,
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      events: {
        move: async (from, to) => {
          const v = api.view;
          const chess = new Chess(v.state.fen);
          const piece = chess.get(from);
          let promotion;
          if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
            promotion = await askPromotion(piece.color === 'w' ? 'white' : 'black');
            if (!promotion) return render(api.view);
          }
          const ok = await api.move({ from, to, promotion });
          if (!ok) render(api.view);
        },
      },
    });
  },

  render(v) { render(v); },

  resize() { cg?.redrawAll(); },

  info(v, seat) {
    const d = material(v.state.fen)[seat];
    return d > 0 ? `+${d}` : '';
  },
};

function render(v) {
  const s = v.state;
  const chess = new Chess(s.fen);
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  const myColor = v.seat === 'both' ? turnColor : v.seat === 1 ? 'black' : 'white';
  cg.set({
    fen: s.fen,
    orientation: v.seat === 1 ? 'black' : 'white',
    turnColor,
    lastMove: s.last || undefined,
    check: chess.inCheck() ? turnColor : false,
    movable: { color: v.canMove ? myColor : undefined, dests: v.canMove ? dests(chess) : new Map() },
  });
  const rows = [];
  for (let i = 0; i < s.san.length; i += 2) {
    rows.push(`<span class="text-neutral-content/40">${i / 2 + 1}.</span><span>${s.san[i]}</span><span>${s.san[i + 1] || ''}</span>`);
  }
  const mv = side.querySelector('.moves');
  mv.innerHTML = rows.join('') || '<span class="col-span-3 text-neutral-content/50">Chưa có nước đi</span>';
  mv.scrollTop = mv.scrollHeight;
  side.querySelector('.moves-count').textContent = s.san.length ? `${s.san.length} nước` : '';
}
