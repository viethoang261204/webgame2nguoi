// Lật hình: 36 thẻ, mặt thẻ là lá cờ (thư viện flag-icons)
const COLS = 6, ROWS = 6;
const NAMES = { vn: 'Việt Nam', jp: 'Nhật Bản', kr: 'Hàn Quốc', cn: 'Trung Quốc', th: 'Thái Lan', us: 'Mỹ', gb: 'Anh', fr: 'Pháp', de: 'Đức',
  it: 'Ý', es: 'Tây Ban Nha', br: 'Brazil', ar: 'Argentina', ca: 'Canada', au: 'Úc', in: 'Ấn Độ', ru: 'Nga', mx: 'Mexico', pt: 'Bồ Đào Nha',
  nl: 'Hà Lan', se: 'Thụy Điển', ch: 'Thụy Sĩ', tr: 'Thổ Nhĩ Kỳ', gr: 'Hy Lạp', eg: 'Ai Cập', za: 'Nam Phi', ng: 'Nigeria', sa: 'Ả Rập Xê Út',
  ae: 'UAE', sg: 'Singapore', my: 'Malaysia', id: 'Indonesia', ph: 'Philippines', la: 'Lào', kh: 'Campuchia', nz: 'New Zealand', no: 'Na Uy',
  fi: 'Phần Lan', dk: 'Đan Mạch', be: 'Bỉ', pl: 'Ba Lan', ua: 'Ukraina', il: 'Israel', cl: 'Chile', co: 'Colombia', pe: 'Peru', cu: 'Cuba', ie: 'Ireland' };

let api, cards = [];

export default {
  mount({ board }, a) {
    api = a;
    if (!document.querySelector('link[data-flags]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.flags = '1';
      l.href = 'https://cdn.jsdelivr.net/npm/flag-icons@7.6.0/css/flag-icons.min.css';
      document.head.appendChild(l);
    }
    api.setAspect((COLS * 4) / (ROWS * 3.25));
    board.innerHTML = `<div class="grid h-full w-full grid-cols-6 grid-rows-6 gap-[1.4%]">
      ${Array.from({ length: COLS * ROWS }, (_, i) => `
        <button class="perspective relative outline-none" data-i="${i}">
          <div class="inner preserve-3d relative h-full w-full transition-transform duration-500">
            <div class="backface-hidden absolute inset-0 grid place-items-center overflow-hidden rounded-[10%] border border-white/10
              bg-[repeating-linear-gradient(45deg,#2a2f55_0_6px,#232849_6px_12px)] shadow-md">
              <div class="h-[38%] w-[38%] rotate-45 rounded-[18%] border-2 border-primary/50 bg-primary/10"></div>
            </div>
            <div class="face backface-hidden rotate-y-180 absolute inset-0 overflow-hidden rounded-[10%] bg-white shadow-md ring-2 ring-transparent">
              <span class="flag fi block h-full w-full" style="background-size:cover;width:100%;line-height:normal"></span>
            </div>
          </div>
        </button>`).join('')}
    </div>`;
    cards = [...board.querySelectorAll('[data-i]')];
    board.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b && api.view?.canMove) api.move({ i: +b.dataset.i });
    });
  },

  render(v, prev) {
    const s = v.state;
    s.cards.forEach((code, i) => {
      const c = cards[i];
      const open = code !== null;
      c.querySelector('.inner').style.transform = open ? 'rotateY(180deg)' : '';
      const flag = c.querySelector('.flag');
      flag.className = `flag fi block h-full w-full ${open ? `fi-${code}` : ''}`;
      c.title = open ? NAMES[code] || code : '';
      const owner = s.taken[i];
      const face = c.querySelector('.face');
      face.style.boxShadow = owner !== null ? `0 0 0 3px ${api.sideColor(owner)}` : '';
      c.style.opacity = owner !== null ? '.55' : '';
      c.classList.toggle('cursor-pointer', !!v.canMove && owner === null && !open);
    });
    if (s.lastMatch && prev?.state?.lastMatch?.join() !== s.lastMatch.join()) {
      api.toast(`Trúng cặp ${NAMES[s.cards[s.lastMatch[0]]] || ''}!`, 'success');
    }
  },

  info(v, seat) { return `${v.state.score[seat]} cặp`; },
};
