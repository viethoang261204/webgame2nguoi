const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const { CATEGORIES } = window.WHOAMI_DATA;
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐷', '🐙', '🦄', '🐲', '👻', '🤖', '👽', '🎃', '🐧', '🦉', '🐢'];
const ANS = { yes: ['✅', 'Có'], no: ['❌', 'Không'], maybe: ['🤷', 'Có thể'], unknown: ['❓', 'Không biết'] };
const MEDALS = ['🥇', '🥈', '🥉'];
const QUESTIONS = ['Tôi là người thật?', 'Tôi là nam?', 'Tôi là nữ?', 'Tôi còn sống?', 'Tôi là người Việt Nam?', 'Tôi nổi tiếng trên mạng?',
  'Tôi là ca sĩ?', 'Tôi là diễn viên?', 'Tôi chơi thể thao?', 'Tôi là nhân vật hoạt hình?', 'Tôi có siêu năng lực?', 'Tôi là con vật?',
  'Tôi có 4 chân?', 'Tôi biết bay?', 'Tôi sống dưới nước?', 'Tôi ăn được?', 'Tôi là đồ vật?', 'Tôi dùng điện?', 'Tôi to hơn cái tủ lạnh?',
  'Tôi có màu vàng?', 'Tôi là một nghề?', 'Tôi có trong nhà bếp?'];

let socket = null;
let S = null;        // trạng thái phòng từ server
let roomId = null;
let logTab = 'mine';
let askMode = 'ask'; // 'ask' | 'guess'
let endShown = 0;
let lastLogKey = '';

function store(k, v) { try { localStorage.setItem(k, v); } catch {} }
function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function vibrate(p) { try { navigator.vibrate?.(p); } catch {} }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mỗi tab trình duyệt là 1 người chơi (giữ nguyên khi tải lại trang)
const pid = (() => {
  try {
    let v = sessionStorage.getItem('whoamiPid');
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('whoamiPid', v); }
    return v;
  } catch { return Math.random().toString(36).slice(2); }
})();
let profile = { name: load('whoamiName') || '', avatar: load('whoamiAvatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)] };

window.lucide?.createIcons();
const icons = () => window.lucide?.createIcons();

// ---------- Menu ----------
$('#nameInput').value = profile.name;
$('#avatarBtn').textContent = profile.avatar;
$('#avatarGrid').innerHTML = AVATARS.map((a) => `<button data-a="${a}">${a}</button>`).join('');
$('#avatarBtn').addEventListener('click', () => $('#avatarGrid').classList.toggle('hidden'));
$('#avatarGrid').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  profile.avatar = b.dataset.a;
  store('whoamiAvatar', profile.avatar);
  $('#avatarBtn').textContent = profile.avatar;
  $$('#avatarGrid button').forEach((x) => x.classList.toggle('on', x === b));
  $('#avatarGrid').classList.add('hidden');
});
$('#nameInput').addEventListener('input', (e) => { profile.name = e.target.value.trim(); store('whoamiName', profile.name); });

function needName() {
  if (profile.name) return false;
  $('#menuErr').textContent = 'Nhập tên của bạn trước nhé 👆';
  $('#nameInput').focus();
  return true;
}
$('#createBtn').addEventListener('click', () => {
  if (needName()) return;
  ensureSocket();
  socket.emit('create', { pid, ...profile }, (res) => {
    if (res.error) return ($('#menuErr').textContent = res.error);
    enterRoom(res.id);
  });
});
$('#joinBtn').addEventListener('click', () => {
  const id = $('#roomInput').value.trim().split('room=').pop().toLowerCase();
  if (!id || needName()) return;
  joinRoom(id);
});
$('#roomInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#joinBtn').click());

// ---------- Kết nối ----------
function saveSession() { try { sessionStorage.setItem('whoamiRoom', JSON.stringify({ id: roomId, snap: S })); } catch {} }
function loadSession(id) { try { const v = JSON.parse(sessionStorage.getItem('whoamiRoom')); return v?.id === id ? v.snap : null; } catch { return null; } }
function clearSession() { try { sessionStorage.removeItem('whoamiRoom'); } catch {} }

function ensureSocket() {
  if (socket) return;
  socket = io('/whoami');
  let connectedBefore = false;
  socket.on('connect', () => {
    if (connectedBefore && roomId) {
      socket.emit('join', { roomId, pid, ...profile, snap: S }, (res) => {
        if (res.error) toast(res.error); else toast('Đã kết nối lại ✅');
      });
    }
    connectedBefore = true;
  });
  socket.on('state', (st) => { S = st; saveSession(); render(); });
  socket.on('toast', toast);
  socket.on('kicked', () => { toast('Bạn đã bị mời ra khỏi phòng'); leave(); });
  socket.on('disconnect', () => roomId && toast('Mất kết nối, đang kết nối lại...'));
}
function joinRoom(id) {
  ensureSocket();
  socket.emit('join', { roomId: id, pid, ...profile, snap: loadSession(id) }, (res) => {
    if (res.error) {
      $('#menuErr').textContent = res.error;
      clearSession();
      history.replaceState(null, '', location.pathname);
      return;
    }
    enterRoom(res.id);
  });
}
function enterRoom(id) {
  roomId = id;
  history.replaceState(null, '', `?room=${id}`);
  $('#menuErr').textContent = '';
}
function leave() {
  if (socket) { socket.disconnect(); socket = null; }
  clearSession();
  roomId = null; S = null; endShown = 0;
  history.replaceState(null, '', location.pathname);
  hideModal();
  show('menu');
}
$$('[data-leave]').forEach((b) => b.addEventListener('click', leave));

// ---------- Hiển thị ----------
function show(id) {
  ['menu', 'lobby', 'writing', 'play'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
}
const me = () => S?.players.find((p) => p.pid === pid);
const byPid = (id) => S?.players.find((p) => p.pid === id);
const isHost = () => S?.hostPid === pid;
const shareUrl = () => `${location.origin}${location.pathname}?room=${roomId}`;

function render() {
  if (!S) return;
  if (S.state === 'lobby') { hideModal(); show('lobby'); renderLobby(); }
  else if (S.state === 'writing') { hideModal(); show('writing'); renderWriting(); }
  else { show('play'); renderPlay(); if (S.state === 'ended' && endShown !== S.round) { endShown = S.round; showEnd(); } }
}

function renderLobby() {
  $('#roomCode').textContent = roomId;
  $('#shareLink').value = shareUrl();
  const on = S.players.filter((p) => p.online).length;
  $('#playerCount').textContent = `(${S.players.length}/10)`;
  $('#lobbyPlayers').innerHTML = S.players.map((p) => `
    <div class="lp ${p.online ? '' : 'off'}" style="--c:${p.color}">
      <div class="av">${p.avatar}</div>
      <div class="nm">${esc(p.name)}${p.pid === pid ? ' (bạn)' : ''}
        <small>${p.pid === S.hostPid ? '👑 Chủ phòng' : p.online ? 'Sẵn sàng' : 'Mất kết nối'}${p.score ? ` · ${p.score} điểm` : ''}</small></div>
      ${isHost() && p.pid !== pid ? `<button class="kick" data-kick="${p.pid}" aria-label="Mời ra"><i data-lucide="x"></i></button>` : ''}
    </div>`).join('');
  const sel = $('#setCategory');
  if (!sel.options.length) sel.innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('');
  sel.value = S.settings.category;
  $('#setAssign').value = S.settings.assign;
  $('#setTime').value = String(S.settings.turnTime);
  [sel, $('#setAssign'), $('#setTime')].forEach((x) => (x.disabled = !isHost()));
  $('#hostOnly').textContent = isHost() ? '' : '(chủ phòng chỉnh)';
  $('#startBtn').classList.toggle('hidden', !isHost());
  $('#startBtn').disabled = on < 2;
  $('#waitHost').textContent = isHost()
    ? (on < 2 ? 'Cần ít nhất 2 người, gửi link cho bạn bè nhé!' : `${on} người đã sẵn sàng`)
    : `Chờ ${esc(byPid(S.hostPid)?.name || 'chủ phòng')} bắt đầu...`;
  icons();
}
$('#lobbyPlayers').addEventListener('click', (e) => { const k = e.target.closest('[data-kick]'); if (k) socket.emit('kick', k.dataset.kick); });
function sendSettings() {
  socket.emit('settings', { category: $('#setCategory').value, assign: $('#setAssign').value, turnTime: +$('#setTime').value });
}
['#setCategory', '#setAssign', '#setTime'].forEach((s) => $(s).addEventListener('change', sendSettings));
$('#startBtn').addEventListener('click', () => socket.emit('start'));

function renderWriting() {
  const w = S.writing;
  const target = byPid(w?.target);
  const done = target && w.done.includes(target.pid);
  $('#writeTarget').innerHTML = target ? `<span class="av">${target.avatar}</span> ${esc(target.name)}` : '...';
  $('#writeInput').disabled = $('#writeBtn').disabled = $('#suggestBtn').disabled = !!done;
  $('#writeBtn').innerHTML = done ? '<i data-lucide="check-check"></i> Đã dán!' : '<i data-lucide="check"></i> Dán lên trán!';
  $('#writeStatus').innerHTML = S.players.map((p) => {
    const ok = w.done.includes(w.map[p.pid]);
    return `<span class="${ok ? 'ok' : ''}">${p.avatar} ${esc(p.name)} ${ok ? '✓' : '...'}</span>`;
  }).join('');
  $('#fillBtn').classList.toggle('hidden', !isHost());
  icons();
}
$('#suggestBtn').addEventListener('click', () => {
  const items = CATEGORIES[S?.settings.category || 'mix'].items;
  $('#writeInput').value = items[Math.floor(Math.random() * items.length)].split('|')[0];
});
$('#writeBtn').addEventListener('click', () => {
  const text = $('#writeInput').value.trim();
  if (!text) return toast('Nhập nhân vật trước nhé');
  socket.emit('write', { text });
  $('#writeInput').value = '';
});
$('#writeInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#writeBtn').click());
$('#fillBtn').addEventListener('click', () => socket.emit('fillRandom'));

// ---------- Màn chơi ----------
function renderPlay() {
  const cat = CATEGORIES[S.settings.category];
  $('#roundInfo').textContent = `Ván ${S.round} · ${cat ? cat.name : ''}`;
  $$('.host-only').forEach((b) => b.classList.toggle('hidden', !isHost()));
  $('#giveupBtn').classList.toggle('hidden', !(S.state === 'playing' && me() && !me().solved && !me().gaveUp));
  renderPlayers();
  renderTurn();
  renderLog();
}

function renderPlayers() {
  const t = S.turn;
  $('#players').innerHTML = S.players.map((p, i) => {
    const mine = p.pid === pid;
    const hidden = p.character === '???';
    const badge = p.solved ? (MEDALS[p.solved - 1] || '🏅') : p.gaveUp ? '🏳️' : '';
    const voted = t && ((t.phase === 'answer' && t.votes[p.pid]) || (t.phase === 'judge' && p.pid in t.judge));
    return `<div class="pl ${mine ? 'me' : ''} ${!hidden && mine ? 'revealed' : ''} ${t?.pid === p.pid ? 'turn' : ''} ${p.online ? '' : 'off'}"
        style="--c:${p.color};--rot:${((i * 37) % 9) - 4}deg">
      <div class="postit">${hidden ? '???' : esc(p.character || '...')}</div>
      ${voted ? '<span class="vote">✔️</span>' : ''}
      <div class="av">${p.avatar}</div>
      ${badge ? `<span class="badge">${badge}</span>` : ''}
      <div class="nm">${esc(p.name)}${mine ? ' (bạn)' : ''}</div>
      <div class="meta">${p.asked} câu hỏi${p.score ? ` · ${p.score}đ` : ''}</div>
    </div>`;
  }).join('');
}

function timerHtml(t) {
  if (!t?.endsAt || t.phase !== 'ask') return '';
  return `<span class="timer" data-ends="${t.endsAt - S.serverNow + Date.now()}"><i data-lucide="timer"></i><b></b></span>`;
}

function lastEntry() { return S.log[S.log.length - 1]; }

function resultHtml(e) {
  if (!e) return '';
  const p = byPid(e.pid);
  if (e.type === 'q') {
    return `<div class="result ${e.result}">${ANS[e.result][0]} ${ANS[e.result][1]}!</div>
      <div class="tally">${Object.keys(ANS).filter((k) => e.tally[k]).map((k) => `${ANS[k][0]} ${e.tally[k]}`).join(' · ')}</div>`;
  }
  if (e.type === 'solved') return `<div class="result solved">🎉 ${esc(p?.name)} đoán đúng: ${esc(e.character)}!</div>`;
  if (e.type === 'wrong') return `<div class="result no">❌ ${esc(p?.name)} đoán sai: "${esc(e.guess)}"</div>`;
  return '';
}

function renderTurn() {
  const box = $('#turnBox');
  const t = S.turn;
  // giữ chữ đang gõ khi trạng thái cập nhật
  const prevInput = $('#askInput');
  const typed = prevInput?.value || '';
  const focused = document.activeElement === prevInput;

  if (S.state === 'ended') {
    box.innerHTML = `<div class="turn-head">🏁 Ván đã kết thúc</div>
      <button class="btn primary" id="showEndBtn"><i data-lucide="trophy"></i> Xem bảng xếp hạng</button>`;
    $('#showEndBtn').onclick = showEnd;
    return icons();
  }
  if (!t) {
    box.innerHTML = '<div class="turn-head">⏳ Đang chờ người chơi kết nối lại...</div>';
    return;
  }
  if (t.seq !== renderTurn.seq) { renderTurn.seq = t.seq; askMode = 'ask'; }
  const p = byPid(t.pid);
  const myTurn = t.pid === pid;
  const head = `<div class="turn-head"><span class="av">${p?.avatar || ''}</span>${myTurn ? 'Lượt của bạn!' : `Lượt của ${esc(p?.name)}`}${timerHtml(t)}</div>`;
  let html = head;

  if (t.phase === 'ask') {
    const last = lastEntry();
    const cont = last?.type === 'q' && last.pid === t.pid && last.result === 'yes';
    if (myTurn) {
      if (cont) html += `<div class="result yes">✅ Đa số trả lời Có, hỏi tiếp đi!</div>`;
      html += askMode === 'ask'
        ? `<div class="chips">${QUESTIONS.map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
           <div class="ask-row"><input id="askInput" maxlength="150" placeholder="Hỏi câu có / không..." autocomplete="off">
             <button class="btn primary sq" id="askBtn" aria-label="Hỏi"><i data-lucide="send"></i></button></div>
           <div class="actions"><button class="btn guess" id="guessMode"><i data-lucide="lightbulb"></i> Tôi biết rồi, đoán!</button>
             <button class="btn" id="passBtn"><i data-lucide="skip-forward"></i> Qua lượt</button></div>`
        : `<div class="qbig">Tôi là...?</div>
           <div class="ask-row"><input id="askInput" maxlength="60" placeholder="Nhập nhân vật bạn đoán..." autocomplete="off">
             <button class="btn guess sq" id="guessBtn" aria-label="Chốt"><i data-lucide="check"></i></button></div>
           <div class="actions"><button class="btn" id="askMode"><i data-lucide="message-circle-question"></i> Quay lại hỏi</button></div>`;
    } else {
      if (cont) html += `<div class="result yes">✅ Đa số Có, ${esc(p?.name)} được hỏi tiếp</div>`;
      html += `<p class="muted" style="margin:0">💭 ${esc(p?.name)} đang nghĩ câu hỏi...</p>`;
    }
  } else if (t.phase === 'answer') {
    const vs = S.players.filter((x) => x.online && x.pid !== t.pid);
    const n = Object.keys(t.votes).length;
    html += `<div class="qbig">${esc(t.question)}</div>`;
    if (myTurn) {
      html += `<div class="progress"><span>Đang chờ mọi người trả lời (${n}/${vs.length})...</span>
        ${n ? '<button class="btn" id="finalBtn">Chốt luôn</button>' : ''}</div>`;
    } else {
      const mv = t.votes[pid];
      html += `<p class="muted small" style="margin:0;text-align:center">Nhìn tờ giấy trên trán ${esc(p?.name)}: <b style="color:var(--text)">${esc(p?.character)}</b></p>
        <div class="vote-btns">${Object.entries(ANS).map(([k, [e, l]]) => `<button class="${k} ${mv === k ? 'on' : ''}" data-v="${k}"><span>${e}</span>${l}</button>`).join('')}</div>
        <div class="progress"><span>${n}/${vs.length} đã trả lời</span>${isHost() && n ? '<button class="btn" id="finalBtn">Chốt luôn</button>' : ''}</div>`;
    }
  } else if (t.phase === 'judge') {
    const vs = S.players.filter((x) => x.online && x.pid !== t.pid);
    const n = Object.keys(t.judge).length;
    html += `<div class="qbig">"${esc(t.guess)}"</div>`;
    if (myTurn) {
      html += `<div class="progress"><span>Mọi người đang chấm câu đoán của bạn (${n}/${vs.length})...</span>
        ${n ? '<button class="btn" id="finalBtn">Chốt luôn</button>' : ''}</div>`;
    } else {
      const mj = t.judge[pid];
      html += `<p class="muted small" style="margin:0;text-align:center">${esc(p?.name)} đoán vậy, đáp án là <b style="color:var(--text)">${esc(p?.character)}</b>. Tính đúng không?</p>
        <div class="vote-btns judge-btns"><button class="yes ${mj === true ? 'on' : ''}" data-j="1"><span>👍</span>Đúng</button>
          <button class="no ${mj === false ? 'on' : ''}" data-j="0"><span>👎</span>Sai</button></div>
        <div class="progress"><span>${n}/${vs.length} đã chấm</span></div>`;
    }
  } else if (t.phase === 'result') {
    html += resultHtml(lastEntry());
  }

  box.innerHTML = html;
  const inp = $('#askInput');
  if (inp && typed && prevInput?.placeholder === inp.placeholder) inp.value = typed;
  if (inp && focused) inp.focus();
  tickTimer();
  icons();
}

$('#turnBox').addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) { const inp = $('#askInput'); inp.value = q.dataset.q; inp.focus(); return; }
  const v = e.target.closest('[data-v]');
  if (v) { socket.emit('answer', { v: v.dataset.v }); vibrate(10); return; }
  const j = e.target.closest('[data-j]');
  if (j) { socket.emit('judge', { ok: j.dataset.j === '1' }); vibrate(10); return; }
  const id = e.target.closest('button')?.id;
  if (id === 'askBtn') submitAsk();
  else if (id === 'guessBtn') submitGuess();
  else if (id === 'guessMode') { askMode = 'guess'; renderTurn(); $('#askInput')?.focus(); }
  else if (id === 'askMode') { askMode = 'ask'; renderTurn(); }
  else if (id === 'passBtn') socket.emit('pass');
  else if (id === 'finalBtn') socket.emit('finalize');
});
$('#turnBox').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.id !== 'askInput') return;
  askMode === 'ask' ? submitAsk() : submitGuess();
});
function submitAsk() {
  const text = $('#askInput')?.value.trim();
  if (!text) return toast('Nhập câu hỏi trước nhé');
  socket.emit('ask', { text });
}
function submitGuess() {
  const text = $('#askInput')?.value.trim();
  if (!text) return toast('Nhập nhân vật bạn đoán');
  askMode = 'ask';
  socket.emit('guess', { text });
}

function tickTimer() {
  const el = document.querySelector('.timer[data-ends]');
  if (!el) return;
  const left = Math.max(0, Math.ceil((+el.dataset.ends - Date.now()) / 1000));
  el.querySelector('b').textContent = `${left}s`;
  el.classList.toggle('low', left <= 10);
}
setInterval(tickTimer, 250);

// ---------- Nhật ký ----------
$$('.log-tabs button').forEach((b) => b.addEventListener('click', () => {
  logTab = b.dataset.tab;
  $$('.log-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  lastLogKey = '';
  renderLog();
}));

function logItem(e) {
  const p = byPid(e.pid);
  const av = p ? `<div class="av" style="--c:${p.color}">${p.avatar}</div>` : '';
  const name = p ? esc(p.name) + (p.pid === pid ? ' (bạn)' : '') : '';
  switch (e.type) {
    case 'start': return `<div class="le sys">🎬 Ván ${e.round} bắt đầu!</div>`;
    case 'q': {
      const tl = Object.keys(ANS).filter((k) => e.tally[k]).map((k) => `${ANS[k][0]}${e.tally[k]}`).join(' ');
      return `<div class="le">${av}<div class="body"><div class="who">${name}</div><div class="q">${esc(e.text)}</div>
        <span class="ans ${e.result}">${ANS[e.result][0]} ${ANS[e.result][1]}</span><span class="tl">${tl}</span></div></div>`;
    }
    case 'solved': return `<div class="le big">${av}<div class="body"><div class="who">${name}</div><div class="q">🎉 Đoán đúng: ${esc(e.character)} ${MEDALS[e.rank - 1] || '🏅'}</div></div></div>`;
    case 'wrong': return `<div class="le">${av}<div class="body"><div class="who">${name}</div><div class="q">❌ Đoán sai: "${esc(e.guess)}"</div></div></div>`;
    case 'pass': return `<div class="le sys"><b>${name}</b>&nbsp;qua lượt</div>`;
    case 'timeout': return `<div class="le sys">⏰ <b>${name}</b>&nbsp;hết giờ</div>`;
    case 'skip': return `<div class="le sys"><b>${name}</b>&nbsp;mất kết nối, bỏ qua lượt</div>`;
    case 'giveup': return `<div class="le sys">🏳️ <b>${name}</b>&nbsp;bỏ cuộc (là ${esc(e.character)})</div>`;
    case 'join': return `<div class="le sys">👋 <b>${name}</b>&nbsp;vào phòng</div>`;
    case 'end': return '<div class="le sys">🏁 Kết thúc ván</div>';
    default: return '';
  }
}

function renderLog() {
  const list = logTab === 'mine'
    ? S.log.filter((e) => e.pid === pid && ['q', 'wrong', 'solved'].includes(e.type))
    : S.log;
  const key = `${logTab}:${list.length}:${S.log.at(-1)?.t || 0}:${S.players.map((p) => p.name + p.avatar).join()}`;
  if (key === lastLogKey) return;
  lastLogKey = key;
  const el = $('#log');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  el.innerHTML = list.length
    ? list.map(logItem).join('')
    : `<div class="empty">${logTab === 'mine' ? '📝 Các câu bạn hỏi và câu trả lời sẽ được ghi lại ở đây để bạn suy luận.' : 'Chưa có gì...'}</div>`;
  if (atBottom || list.length <= 3) el.scrollTop = el.scrollHeight;
}

// ---------- Menu trong ván ----------
$('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#menuPop').classList.toggle('hidden'); });
document.addEventListener('click', () => $('#menuPop').classList.add('hidden'));
$('#giveupBtn').addEventListener('click', () => { if (confirm('Bỏ cuộc và xem nhân vật của bạn?')) socket.emit('giveup'); });
$('#endBtn').addEventListener('click', () => { if (confirm('Kết thúc ván này và xem kết quả?')) socket.emit('end'); });
$('#lobbyBtn').addEventListener('click', () => socket.emit('toLobby'));

// ---------- Kết quả ----------
function showEnd() {
  const ps = [...S.players].sort((a, b) => (a.solved || 99) - (b.solved || 99) || b.score - a.score);
  const my = me();
  let emoji = '🏁', title = 'Kết thúc ván!', sub = '';
  if (my?.solved === 1) { emoji = '🏆'; title = 'Bạn về nhất!'; }
  else if (my?.solved) { emoji = '🎉'; title = `Bạn về thứ ${my.solved}!`; }
  else if (my) { emoji = '😅'; title = 'Bạn chưa đoán ra!'; }
  if (my) sub = `Bạn là: ${my.character}`;
  $('#mEmoji').textContent = emoji;
  $('#mTitle').textContent = title;
  $('#mSub').textContent = sub;
  $('#mBody').innerHTML = `<div class="rank">${ps.map((p) => `
    <div class="rk ${p.pid === pid ? 'me' : ''}">
      <div class="pos">${p.solved ? (MEDALS[p.solved - 1] || p.solved) : p.gaveUp ? '🏳️' : '—'}</div>
      <div class="av">${p.avatar}</div>
      <div class="info"><b>${esc(p.name)}${p.pid === pid ? ' (bạn)' : ''}</b>
        <span class="ch">${esc(p.character || '?')}</span>
        <span> · ${p.asked} câu hỏi${p.wrong ? ` · ${p.wrong} lần sai` : ''}</span></div>
      <div class="pts">${p.lastPoints ? `+${p.lastPoints}` : '0'}<small>tổng ${p.score}đ</small></div>
    </div>`).join('')}</div>`;
  $('#mActions').innerHTML = isHost()
    ? `<button class="btn" id="mLobby"><i data-lucide="home"></i> Phòng chờ</button>
       <button class="btn primary" id="mAgain"><i data-lucide="rotate-ccw"></i> Ván mới</button>`
    : `<button class="btn" id="mClose"><i data-lucide="eye"></i> Xem lại</button>
       <button class="btn primary" disabled>Chờ chủ phòng...</button>`;
  $('#mLobby')?.addEventListener('click', () => socket.emit('toLobby'));
  $('#mAgain')?.addEventListener('click', () => socket.emit('start'));
  $('#mClose')?.addEventListener('click', hideModal);
  icons();
  $('#modal').classList.remove('hidden');
  if (my?.solved && window.confetti) {
    const colors = ['#ffe45c', '#ff922b', '#ff6b6b', '#7c5cff', '#3ddcff'];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
  }
}
function hideModal() { $('#modal').classList.add('hidden'); }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(shareUrl()); } catch { $('#shareLink').select(); document.execCommand('copy'); }
  toast('Đã copy link! ✅');
}));
if (navigator.share) {
  $$('[data-share]').forEach((b) => {
    b.classList.remove('hidden');
    b.addEventListener('click', () => navigator.share({ title: 'Tôi Là Ai?', text: 'Vào chơi Tôi Là Ai? với mình nè!', url: shareUrl() }).catch(() => {}));
  });
}

// ---------- Vào phòng từ link ----------
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) {
  $('#roomInput').value = roomParam;
  if (profile.name) joinRoom(roomParam.toLowerCase());
  else { $('#menuErr').textContent = 'Nhập tên rồi bấm Vào phòng nhé 👇'; $('#nameInput').focus(); }
}
