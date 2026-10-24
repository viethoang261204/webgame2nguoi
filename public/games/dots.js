// Nối ô: vẽ bằng SVG, chạm vào khe giữa hai điểm để nối
const N = 5;
const SP = 100;            // khoảng cách giữa 2 điểm (đơn vị SVG)
const PAD = 40;
const SIZE = N * SP + PAD * 2;

let api, svg;

const x = (c) => PAD + c * SP;
const y = (r) => PAD + r * SP;

export default {
  mount({ board }, a) {
    api = a;
    api.setAspect(1);
    board.innerHTML = `<div class="h-full w-full rounded-[4%] bg-base-100 shadow-board ring-1 ring-white/10">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" class="h-full w-full select-none"></svg></div>`;
    svg = board.querySelector('svg');
    svg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-edge]');
      if (!t || !api.view?.canMove) return;
      const [type, r, c] = t.dataset.edge.split(',');
      api.move({ t: type, r: +r, c: +c });
    });
  },

  render(v) {
    const s = v.state;
    const col = (seat) => api.sideColor(seat);
    let out = '';
    // ô đã chiếm
    s.boxes.forEach((o, i) => {
      if (o === null) return;
      const r = Math.floor(i / N), c = i % N;
      out += `<rect x="${x(c) + 6}" y="${y(r) + 6}" width="${SP - 12}" height="${SP - 12}" rx="10" fill="${col(o)}" fill-opacity=".22" class="anim-fade"/>
        <text x="${x(c) + SP / 2}" y="${y(r) + SP / 2 + 9}" text-anchor="middle" font-size="26" font-weight="800" fill="${col(o)}">${o === 0 ? 'A' : 'B'}</text>`;
    });
    const edge = (type, r, c, owner) => {
      const [x1, y1, x2, y2] = type === 'h' ? [x(c), y(r), x(c + 1), y(r)] : [x(c), y(r), x(c), y(r + 1)];
      const isLast = s.last && s.last.t === type && s.last.r === r && s.last.c === c;
      if (owner !== null) {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(owner)}" stroke-width="${isLast ? 12 : 9}" stroke-linecap="round"/>`;
      }
      const can = v.canMove;
      return `<g data-edge="${type},${r},${c}" class="${can ? 'cursor-pointer group' : ''}">
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="34"/>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-opacity=".07" stroke-width="7" stroke-linecap="round"
          class="${can ? 'transition group-hover:stroke-[#6d5dfc] group-hover:[stroke-opacity:.9]' : ''}"/></g>`;
    };
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) out += edge('h', r, c, s.h[r * N + c]);
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) out += edge('v', r, c, s.v[r * (N + 1) + c]);
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) out += `<circle cx="${x(c)}" cy="${y(r)}" r="8" fill="#e7e9f6"/>`;
    svg.innerHTML = out;
  },

  info(v, seat) { return `${v.state.score[seat]} ô`; },
};
