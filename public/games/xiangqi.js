// Cờ tướng: bàn vẽ SVG, quân chữ Hán truyền thống
const W = 9, H = 10;
const S = 60;          // khoảng cách giao điểm
const M = 40;          // lề
const VW = M * 2 + S * (W - 1), VH = M * 2 + S * (H - 1);
const CH = [
  { k: '帥', a: '仕', e: '相', h: '傌', r: '俥', c: '炮', p: '兵' },
  { k: '將', a: '士', e: '象', h: '馬', r: '車', c: '砲', p: '卒' },
];
const NAME = { k: 'Tướng', a: 'Sĩ', e: 'Tượng', h: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt' };

let api, svg, side, sel = null;

const font = 'font-family="\'Noto Serif SC\',\'KaiTi\',\'STKaiti\',serif"';

function boardLines() {
  let g = '';
  const X = (c) => M + c * S, Y = (r) => M + r * S;
  for (let r = 0; r < H; r++) g += `<line x1="${X(0)}" y1="${Y(r)}" x2="${X(8)}" y2="${Y(r)}"/>`;
  for (let c = 0; c < W; c++) {
    if (c === 0 || c === 8) g += `<line x1="${X(c)}" y1="${Y(0)}" x2="${X(c)}" y2="${Y(9)}"/>`;
    else g += `<line x1="${X(c)}" y1="${Y(0)}" x2="${X(c)}" y2="${Y(4)}"/><line x1="${X(c)}" y1="${Y(5)}" x2="${X(c)}" y2="${Y(9)}"/>`;
  }
  for (const [r1, r2] of [[0, 2], [7, 9]]) {
    g += `<line x1="${X(3)}" y1="${Y(r1)}" x2="${X(5)}" y2="${Y(r2)}"/><line x1="${X(5)}" y1="${Y(r1)}" x2="${X(3)}" y2="${Y(r2)}"/>`;
  }
  // dấu vị trí pháo và tốt
  const mark = (r, c) => {
    const d = 5, l = 12;
    let s = '';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if ((c === 0 && sx < 0) || (c === 8 && sx > 0)) continue;
      const x = X(c) + sx * d, y = Y(r) + sy * d;
      s += `<polyline fill="none" points="${x + sx * l},${y} ${x},${y} ${x},${y + sy * l}"/>`;
    }
    return s;
  };
  for (const [r, c] of [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]]) g += mark(r, c);
  return `<g stroke="#5a3b17" stroke-width="2" stroke-linecap="square">${g}
    <rect x="${X(0) - 6}" y="${Y(0) - 6}" width="${S * 8 + 12}" height="${S * 9 + 12}" fill="none" stroke-width="3.5"/></g>
    <g ${font} font-size="30" fill="#6b4419" opacity=".85" text-anchor="middle">
      <text x="${X(2)}" y="${Y(4.5) + 11}">楚 河</text><text x="${X(6)}" y="${Y(4.5) + 11}">漢 界</text></g>`;
}

export default {
  mount({ board, side: sideEl }, a) {
    api = a;
    side = sideEl;
    if (!document.querySelector('link[data-xq]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.xq = '1';
      l.href = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700&display=swap&text=${encodeURIComponent('帥仕相傌俥炮兵將士象馬車砲卒楚河漢界')}`;
      document.head.appendChild(l);
    }
    api.setAspect(VW / VH);
    board.innerHTML = `<div class="h-full w-full overflow-hidden rounded-[2%] bg-[linear-gradient(135deg,#f3d39b,#e2b56c)] shadow-board ring-1 ring-black/30">
      <svg viewBox="0 0 ${VW} ${VH}" class="h-full w-full select-none"><g class="lines">${boardLines()}</g><g class="marks"></g><g class="pieces"></g><g class="hints"></g></svg></div>`;
    svg = board.querySelector('svg');
    svg.addEventListener('click', onClick);
    side.innerHTML = '<div class="panel p-3"><div class="mb-2 text-sm font-semibold">Quân đã ăn</div><div class="caps flex flex-col gap-2"></div></div>';
  },

  render(v, prev) {
    if (!v.canMove || prev?.state?.plies !== v.state.plies) sel = null;
    paint();
    if (v.state.check && prev && prev.state.plies !== v.state.plies && !v.result) api.toast('Chiếu tướng!', 'warning');
  },

  info(v, seat) {
    const n = v.state.captured[seat].length;
    return n ? `Ăn ${n} quân` : '';
  },
};

// tọa độ hiển thị (lật bàn khi chơi bên Đen)
function xy(i) {
  let r = Math.floor(i / W), c = i % W;
  if (api.view.flip) { r = H - 1 - r; c = W - 1 - c; }
  return [M + c * S, M + r * S];
}

function onClick(e) {
  const v = api.view;
  if (!v?.canMove) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let c = Math.round((p.x - M) / S), r = Math.round((p.y - M) / S);
  if (c < 0 || c >= W || r < 0 || r >= H) return;
  if (v.flip) { r = H - 1 - r; c = W - 1 - c; }
  const i = r * W + c;
  const s = v.state;
  const mySeat = v.seat === 'both' ? v.turn : v.seat;
  if (sel !== null && s.legal.some(([a, b]) => a === sel && b === i)) {
    const from = sel;
    sel = null;
    api.move({ from, to: i });
    return paint();
  }
  sel = s.board[i]?.s === mySeat && s.legal.some(([a]) => a === i) ? i : null;
  paint();
}

function pieceSvg(p, x, y, extra = '') {
  const red = p.s === 0;
  const ink = red ? '#c0262d' : '#1f2328';
  return `<g transform="translate(${x},${y})" ${extra}>
    <circle r="26" fill="#000" opacity=".25" cy="3"/>
    <circle r="26" fill="url(#pc)" stroke="#8a5a26" stroke-width="1.5"/>
    <circle r="21" fill="none" stroke="${ink}" stroke-width="1.8"/>
    <text y="10" text-anchor="middle" ${font} font-size="27" font-weight="700" fill="${ink}">${CH[p.s][p.t]}</text></g>`;
}

function paint() {
  const v = api.view;
  if (!v) return;
  const s = v.state;
  const defs = '<defs><radialGradient id="pc" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff8e6"/><stop offset="1" stop-color="#e8c98f"/></radialGradient></defs>';
  let marks = '';
  for (const i of s.last || []) {
    const [x, y] = xy(i);
    marks += `<rect x="${x - 29}" y="${y - 29}" width="58" height="58" rx="8" fill="#2563eb" fill-opacity=".14" stroke="#2563eb" stroke-opacity=".55" stroke-width="2" stroke-dasharray="10 6"/>`;
  }
  let pieces = defs;
  s.board.forEach((p, i) => {
    if (!p) return;
    const [x, y] = xy(i);
    const isSel = sel === i;
    const inCheck = s.check && p.t === 'k' && p.s === s.turn;
    pieces += pieceSvg(p, x, y, `class="${isSel ? '' : ''}" style="${isSel ? 'filter:drop-shadow(0 0 6px #facc15)' : inCheck ? 'filter:drop-shadow(0 0 8px #ef4444)' : ''}"`);
  });
  let hints = '';
  if (sel !== null) {
    for (const [a, b] of s.legal) {
      if (a !== sel) continue;
      const [x, y] = xy(b);
      hints += s.board[b]
        ? `<circle cx="${x}" cy="${y}" r="28" fill="none" stroke="#16a34a" stroke-width="4"/>`
        : `<circle cx="${x}" cy="${y}" r="9" fill="#16a34a" fill-opacity=".75"/>`;
    }
  }
  svg.querySelector('.marks').innerHTML = marks;
  svg.querySelector('.pieces').innerHTML = pieces;
  svg.querySelector('.hints').innerHTML = hints;
  svg.style.cursor = v.canMove ? 'pointer' : 'default';
  side.querySelector('.caps').innerHTML = [0, 1].map((seat) => `
    <div class="flex items-center gap-2 text-xs"><span class="w-10 text-neutral-content/60">${api.sideName(seat)}</span>
      <div class="flex flex-wrap gap-1">${s.captured[seat].map((t) => `<span title="${NAME[t]}" class="grid h-6 w-6 place-items-center rounded-full bg-[#f3dcae] text-[13px] font-bold"
        style="font-family:'Noto Serif SC',serif;color:${seat === 0 ? '#1f2328' : '#c0262d'}">${CH[1 - seat][t]}</span>`).join('') || '<span class="text-neutral-content/40">-</span>'}</div></div>`).join('');
}
