/* Adab School · Tarix — Telegram Mini App */
const tg = window.Telegram && Telegram.WebApp;
const qs = new URLSearchParams(location.search);
const INIT = (tg && tg.initData) || (qs.get('dev') ? 'dev:' + qs.get('dev') : '');
const app = document.getElementById('app');
const S = { me: null, tab: 'home', topics: null, timer: null };
const BK = { jahon: 'Jahon', uzb: 'O‘zb', tarix: 'Tarix' };
const bookName = b => SUBJ[b.subj] + ' · ' + b.grade + '-sinf darsligi';
const bookShort = b => BK[b.subj] + ' ' + b.grade;
const SUBJ = { jahon: 'Jahon tarixi', uzb: "O‘zbekiston tarixi", tarix: 'Tarix' };
const BICON = { first: '🚀', streak3: '🔥', streak7: '📆', streak30: '🏆', perfect: '💯', c100: '🎯', c500: '⭐', c2000: '🧠', duel1: '⚔️', duel10: '🛡️', clean: '✨' };

const IC = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  user: 'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  timer: 'M12 9v4l2.5 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9.5 2h5',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  check: 'M5 12l5 5 9-10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  flame: 'M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z',
};
function ic(name, size) {
  const e = document.createElement('span'); e.className = 'ic-svg';
  e.innerHTML = '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[name] + '"/></svg>';
  return e;
}
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
async function api(path, body, method) {
  const r = await fetch('/api' + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'X-Init-Data': INIT, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Xatolik yuz berdi'); e.status = r.status; throw e; }
  return j;
}
function toast(t) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const e = h('div', { class: 'toast' }, t); document.body.append(e); setTimeout(() => e.remove(), 2800);
}
const haptic = k => { try { tg && tg.HapticFeedback && (k === 'ok' || k === 'bad' ? tg.HapticFeedback.notificationOccurred(k === 'ok' ? 'success' : 'error') : tg.HapticFeedback.impactOccurred('light')); } catch (e) {} };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function show(node, nav, view) {
  clearInterval(S.timer); clearTimeout(S.auto); S.view = view || null;
  app.replaceChildren(node);
  document.querySelectorAll('.nav').forEach(x => x.remove());
  document.body.classList.toggle('noscroll-pad', !nav);
  if (nav) document.body.append(navBar());
  window.scrollTo(0, 0);
}
function back(fn) {
  if (!tg || !tg.BackButton) return;
  tg.BackButton.offClick(S.backFn || (() => {}));
  if (fn) { S.backFn = fn; tg.BackButton.onClick(fn); tg.BackButton.show(); } else tg.BackButton.hide();
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
function header(title, sub, onBack) {
  back(onBack);
  return h('div', { class: 'top' },
    h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png', alt: 'Adab School' }),
      onBack && !(tg && tg.initData) ? h('button', { class: 'pill', onclick: onBack }, '← Orqaga') : null),
    h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null);
}
function navBar() {
  const items = [['home', 'home', 'Asosiy'], ['top', 'trophy', 'Reyting'], ['duel', 'zap', 'Bellashuv'], ['profile', 'user', 'Profil']];
  return h('div', { class: 'nav' }, h('div', null, items.map(([k, i, t]) =>
    h('button', { class: S.tab === k ? 'on' : '', onclick: () => go(k) }, h('i', null, ic(i, 22)), t))));
}
// keshdagi ma’lumot darhol ko‘rsatiladi, yangisi fonda olinadi
function refreshMe(view, redraw) {
  if (S.fresh) { S.fresh = false; return; }
  api('/me').then(m => { const ch = JSON.stringify(m) !== JSON.stringify(S.me); S.me = m; if (ch && S.view === view) redraw(); }).catch(() => {});
}
const go = guard(async tab => {
  S.tab = tab;
  if (tab === 'home') await home();
  else if (tab === 'top') await topView();
  else if (tab === 'duel') await duelHome();
  else await profile();
});

/* ---------------- boshlash ---------------- */
async function boot() {
  if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#1F3CE8'); tg.setBackgroundColor('#F8F6F1'); } catch (e) {} }
  if (!INIT) return show(h('div', { class: 'hero' }, h('img', { src: '/static/logo-white.png', style: 'height:44px;align-self:flex-start' }),
    h('h1', null, 'Tarix fanidan ', h('span', { class: 'hl' }, 'bilimingizni'), ' mustahkamlang'),
    h('p', null, 'Bu ilova Telegram ichida ishlaydi. Botni oching va «Ilovani ochish» tugmasini bosing.')));
  try { S.me = await api('/me'); S.fresh = true; } catch (e) { return show(h('div', { class: 'load' }, e.message)); }
  loadTopics().catch(() => {});   // mavzular ro‘yxati oldindan yuklanadi
  const jc = (qs.get('join') || '').replace(/\W/g, '');
  if (jc) {   // guruh havolasi/QR orqali kirgan o‘quvchi: darslik tanlash oynasi ko‘rsatilmaydi
    try { const r = await api('/join', { code: jc }); S.topics = null; S.me = await api('/me'); setTimeout(() => toast('«' + r.name + '» guruhiga qo‘shildingiz'), 400); }
    catch (e) { setTimeout(() => toast(e.message), 400); }
  }
  if (!S.me.user.ready) return onboarding();
  const dc = (qs.get('duel') || '').replace(/\W/g, '');
  if (dc) { S.tab = 'duel'; return guard(duelView)(dc); }
  go('home');
}
async function onboarding(change) {
  const T = await loadTopics();
  let b = S.me.user.book;
  const subs = [...new Set(T.books.map(x => x.subj))];
  const note = { tarix: 'Qadimgi dunyo tarixi', jahon: 'O‘rta asrlardan hozirgi kungacha', uzb: 'Vatanimiz tarixi' };
  const draw = () => {
    const y = window.scrollY;
    back(change ? () => go('profile') : null);
    show(h('div', null,
      h('div', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }), change && !(tg && tg.initData) ? h('button', { class: 'pill', onclick: () => go('profile') }, '← Orqaga') : null),
        h('h1', null, 'Qaysi darslikdan ', h('span', { class: 'mark', style: 'color:var(--navy)' }, 'boshlaymiz?')),
        h('div', { class: 'sub', style: 'margin-top:8px' }, 'Bittasini tanlang — keyin istalgan payt o‘zgartirasiz.')),
      h('div', { class: 'wrap' },
        subs.map(sb => h('div', { class: 'pick' },
          h('div', { class: 'row' }, h('div', { class: 'em ' + ({ tarix: 'y', jahon: 'b', uzb: 'g' }[sb] || 'b') }, ic('book', 20)),
            h('div', { class: 'f' }, h('b', null, SUBJ[sb]), h('small', null, note[sb] || ''))),
          h('div', { class: 'nums' }, T.books.filter(x => x.subj === sb).map(x =>
            h('button', { class: b === x.id ? 'on' : '', onclick: () => { b = x.id; haptic(); draw(); } }, x.grade, h('small', null, 'sinf')))))),
        h('div', { class: 'limit sm mute', style: 'margin-top:14px' }, 'O‘quv markazida o‘qiysizmi? O‘qituvchingizdan guruh havolasini oling — savollar darsda o‘tilgan mavzulardan keladi va cheklov bo‘lmaydi.')),
      h('div', { class: 'foot' }, h('button', { class: 'btn y', disabled: !b, onclick: guard(async () => { await api('/me', { book: b }); S.me = await api('/me'); S.fresh = true; go(change ? 'profile' : 'home'); }) }, b ? 'Davom etish →' : 'Darslikni tanlang'))));
    window.scrollTo(0, y);
  };
  draw();
}

/* ---------------- asosiy sahifa ---------------- */
async function home() {
  back(null);
  const draw = keep => {
    const { user: u, level: L, free } = S.me;
    const y = keep ? window.scrollY : 0;
    const pct = L.next ? Math.round(100 * (u.xp - L.from) / (L.next - L.from)) : 100;
    const hw = S.me.homework.filter(x => !x.done);
    const days = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'], now = new Date();
    const week = (S.me.week || []).map((d, i) => { const dt = new Date(now); dt.setDate(now.getDate() - (6 - i)); return { d, l: days[dt.getDay()], today: i === 6 }; });
    show(h('div', null,
      h('div', { class: 'top home' },
        h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }),
          h('button', { class: 'pill', onclick: () => go('profile') }, S.me.groups.length ? S.me.groups[0].name : 'Tarix')),
        h('div', { class: 'hello' }, 'Salom, ' + u.name.split(' ')[0] + '!'),
        h('div', { class: 'lvlrow' }, h('span', { class: 'lvlb' }, L.idx), h('div', { class: 'f' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, L.name), h('span', null, L.next ? u.xp + ' / ' + L.next + ' ball' : u.xp + ' ball')),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.max(pct, 3) + '%' }))))),
      h('div', { class: 'wrap', style: 'padding-top:0' },
        h('div', { class: 'hero-card' + (S.me.daily_done ? ' done' : '') },
          h('div', { class: 'row' }, h('div', { class: 'f' }, h('div', { class: 'kicker' }, 'Bugungi topshiriq'),
            h('div', { class: 'hd', style: 'font-size:20px;line-height:1.2' }, S.me.daily_done ? 'Bajarildi. Barakalla!' : ['15 ta savol ', h('span', { class: 'mark' }, '+30 ball')])),
            h('div', { class: 'streak' }, ic('flame', 18), h('b', null, u.streak), h('small', null, 'kun'))),
          h('div', { class: 'week' }, week.map(w => h('div', { class: (w.d ? 'on' : '') + (w.today ? ' today' : '') }, h('i', null, w.d ? ic('check', 14) : ''), h('span', null, w.l)))),
          S.me.daily_done ? h('div', { class: 'sm mute', style: 'margin-top:12px;font-weight:700' }, 'Ertaga yangi savollar. Hozircha quyidagi mashqlar bilan davom eting.')
            : h('button', { class: 'btn y', style: 'margin-top:14px', onclick: () => startSession({ mode: 'daily' }) }, 'Boshlash →')),
        hw.length ? [h('div', { class: 'sec' }, 'Uyga vazifa'), h('div', { class: 'list' }, hw.map(x =>
          h('button', { class: 'li', onclick: () => startSession({ mode: 'hw', hw: x.id }) }, h('div', { class: 'n' }, ic('book', 17)),
            h('div', { class: 't' }, h('b', null, x.title), h('small', null, x.count + ' ta savol' + (x.deadline ? ' · muddat: ' + x.deadline : ''))),
            x.late ? h('span', { class: 'badge' }, 'kechikdi') : h('span', { class: 'badge b' }, 'yangi'))))] : null,
        h('div', { class: 'sec' }, 'Mashq qilish'),
        h('div', { class: 'grid' },
          tile('timer', 'b', 'Imtihon', 'Vaqtga qarshi test', () => setup('exam')),
          tile('repeat', 'r', 'Xatolarim', S.me.mistakes_all ? S.me.mistakes_all + ' ta savol' : 'Hozircha yo‘q', () => S.me.mistakes_due ? startSession({ mode: 'mistakes' }) : toast(S.me.mistakes_all ? 'Bugun takrorlanadigan xato yo‘q — ertaga qayting' : 'Xatolar ro‘yxati bo‘sh. Zo‘r!'), S.me.mistakes_due),
          tile('link', 'g', 'Moslashtirish', 'Juftini toping', () => setup('match')),
          tile('layers', 'y', 'Savol-javob', 'O‘zini sinash', () => setup('cards'))),
        h('button', { class: 'duel-card', onclick: () => go('duel') }, h('div', { class: 'f' }, h('b', null, 'Bellashuv'), h('small', null, 'Do‘stingizni chaqiring — g‘olibga +50 ball')), h('span', { class: 'go' }, ic('arrow', 18))),
        free ? h('div', { class: 'limit' },
          h('div', { class: 'row sm bold' }, h('span', { class: 'f' }, 'Bugungi bepul limit'), h('span', null, Math.min(free.used, free.limit) + ' / ' + free.limit + ' savol')),
          h('div', { class: 'bar g' }, h('i', { style: 'width:' + Math.min(100, 100 * free.used / free.limit) + '%' })),
          h('div', { class: 'sm mute', style: 'margin-top:6px' }, 'Guruhga qo‘shilgan o‘quvchilarda cheklov yo‘q. O‘qituvchingizdan guruh havolasini so‘rang.')) : null,
        h('div', { class: 'mt2 c sm mute' }, '© Adab School o‘quv markazi · @adabschooluz'))), true, 'home');
    window.scrollTo(0, y);
  };
  draw();
  refreshMe('home', () => draw(true));
}
function tile(icon, tone, t, s, fn, n) {
  return h('button', { class: 'tile', onclick: () => { haptic(); fn(); } }, n ? h('span', { class: 'badge' }, n) : null, h('div', { class: 'em ' + tone }, ic(icon, 22)), h('b', null, t), h('small', null, s));
}

/* ---------------- mavzu tanlash ---------------- */
async function loadTopics() { if (!S.topics) S.topics = await api('/topics'); return S.topics; }
const setup = guard(async (mode, onPick) => {
  const T = await loadTopics();
  const cov = new Set(mode === 'hw' ? [] : (S.me.covered || []));   // guruhda o‘tilgan mavzular
  const st = { book: cov.size ? 'cov' : (S.me.user.book || T.books[0].id), sel: new Set(), count: mode === 'exam' ? 20 : mode === 'cards' ? 15 : mode === 'match' ? 5 : 15 };
  if (st.book !== 'cov' && !T.books.some(b => b.id === st.book)) st.book = T.books[0].id;
  const title = { exam: 'Imtihon rejimi', match: 'Moslashtirish', cards: 'Savol-javob kartochkalari', hw: 'Vazifa uchun mavzular' }[mode];
  const key = { exam: 'tests', hw: 'tests', match: 'matches', cards: 'cards' }[mode];
  const counts = { exam: [10, 20, 30], hw: [10, 15, 20, 30], match: [3, 5, 10], cards: [10, 15, 30] }[mode];
  const draw = () => {
    const list = T.topics.filter(t => (st.book === 'cov' ? cov.has(t.id) : t.subj + t.grade === st.book) && t[key] > 0);
    const y = window.scrollY;
    show(h('div', null, header(title, mode === 'exam' ? 'Har savolga 15 soniya. Bitta urinish — natija oxirida.' : 'Mavzularni belgilang yoki barchasidan aralash oling', () => onPick ? onPick(null) : go('home')),
      h('div', { class: 'wrap' },
        h('div', { class: 'sec', style: 'margin-top:4px' }, 'Darslik'),
        h('div', { class: 'chips' }, cov.size ? h('button', { class: 'chip' + (st.book === 'cov' ? ' on' : ''), onclick: () => { st.book = 'cov'; st.sel.clear(); draw(); } }, '✓ O‘tilgan mavzular') : null,
          T.books.map(b => h('button', { class: 'chip' + (b.id === st.book ? ' on' : ''), onclick: () => { st.book = b.id; st.sel.clear(); draw(); } }, bookShort(b)))),
        h('div', { class: 'sec' }, 'Savollar soni'),
        h('div', { class: 'chips' }, counts.map(n => h('button', { class: 'chip' + (n === st.count ? ' on' : ''), onclick: () => { st.count = n; draw(); } }, n + ' ta'))),
        h('div', { class: 'sec' }, 'Mavzular', h('span', { class: 'mute sm', style: 'margin-left:auto;font-family:Nunito' }, st.sel.size ? st.sel.size + ' ta tanlandi' : 'barchasidan aralash')),
        list.length ? h('div', { class: 'list' }, list.map(t => h('button', { class: 'li' + (st.sel.has(t.id) ? ' on' : ''), onclick: () => { st.sel.has(t.id) ? st.sel.delete(t.id) : st.sel.add(t.id); haptic(); draw(); } },
          h('div', { class: 'check' }, st.sel.has(t.id) ? '✓' : ''),
          h('div', { class: 't' }, h('b', null, t.num + '. ' + t.title), h('small', null, bookName(t) + ' · ' + t[key] + ' ta')))))
          : h('div', { class: 'card c mute' }, 'Bu yerda savollar yo‘q')),
      h('div', { class: 'foot' }, h('button', { class: 'btn y', disabled: !list.length, onclick: () => {
        const topics = st.sel.size ? [...st.sel] : list.map(t => t.id);
        onPick ? onPick({ topics, count: st.count, names: list.filter(t => topics.includes(t.id)).map(t => t.title) }) : startSession({ mode, topics, count: st.count });
      } }, onPick ? 'Tanlash' : 'Boshlash →'))));
    window.scrollTo(0, y);
  };
  draw();
});

/* ---------------- test o'yini ---------------- */
const startSession = guard(async params => {
  let s;
  try { s = await api('/start', params); } catch (e) { if (e.status === 402) return limitView(e.message); throw e; }
  play(s);
});
function limitView(msg) {
  show(h('div', null, header('Bugunga yetarli 🙂', null, () => go('home')), h('div', { class: 'wrap' },
    h('div', { class: 'card' }, h('p', { class: 'bold', style: 'margin-top:0' }, msg),
      h('p', { class: 'mute sm' }, 'Raqamni tasdiqlash: botga /start yuboring va «📱 Raqamni yuborish» tugmasini bosing.')),
    h('button', { class: 'btn mt2', onclick: () => go('home') }, 'Asosiy sahifaga'))));
}
function play(s) {
  const Q = s.questions;
  // kunlik topshiriqda (s.repeat) xato qilingan savol to‘g‘ri topilguncha navbatga qaytadi
  const pend = q => s.repeat ? q.ok !== true : q.your === undefined;
  const queue = Q.filter(pend);
  let cur = null, done = false, left = s.per_q ? null : s.left_sec, qleft = null, onTimeout = null;
  const names = { exam: 'Imtihon', daily: 'Kunlik topshiriq', mistakes: 'Xatolar ustida ishlash', match: 'Moslashtirish', cards: 'Savol-javob', hw: 'Uyga vazifa', duel: 'Bellashuv' };
  // javoblar serverga fonda, navbat bilan yuboriladi — o‘quvchi kutib qolmaydi
  let sendQ = Promise.resolve(), limitMsg = null;
  const post = async (body, again) => {
    try { await api('/answer', body); }
    catch (e) { if (e.status === 402) limitMsg = e.message; else if (!e.status && !again) { await new Promise(r => setTimeout(r, 1500)); return post(body, true); } }
  };
  const send = body => { sendQ = sendQ.then(() => post(body)); };
  const finish = guard(async () => {
    if (done) return; done = true; clearInterval(S.timer);
    app.replaceChildren(h('div', { class: 'load' }, 'Natija hisoblanmoqda…'));
    await sendQ;
    if (limitMsg) return limitView(limitMsg);
    try { result(await api('/finish', { sid: s.sid })); }
    catch (e) { if (e.status === 409 && s.mode === 'daily') return play(await api('/start', { mode: 'daily' })); go('home'); throw e; }
  });
  const quit = () => {
    if (s.mode === 'daily') { if (confirm('Chiqasizmi? Keyinroq davom ettirishingiz mumkin.')) { clearInterval(S.timer); go('home'); } return; }
    if (s.reveal || confirm('Yakunlaysizmi? Javob berilmagan savollar xato hisoblanadi.')) finish();
  };
  back(quit);
  // javobdan keyin keyingi savolga o‘zi o‘tadi (natijani o‘qib olishga yetarli vaqt bilan)
  const auto = ms => { clearTimeout(S.auto); S.auto = setTimeout(next, ms); };
  const hint = () => h('button', { class: 'btn ghost', onclick: next }, 'Keyingi savolga o‘tilmoqda… bosib tezlatish mumkin');
  const next = () => {
    clearTimeout(S.auto);
    if (cur && pend(cur)) { cur._o = null; queue.push(cur); }
    cur = queue.shift();
    cur ? draw() : finish();
  };
  const timerEl = h('span', { class: 'timer' });
  const paint = v => { timerEl.textContent = '⏱ ' + mmss(Math.max(0, v)); timerEl.classList.toggle('hot', v <= (left != null ? 30 : 5)); };
  const tick = () => {
    if (left != null) { paint(left); if (left <= 0) finish(); left--; }
    else if (qleft != null) { paint(qleft); if (qleft <= 0) { qleft = null; const f = onTimeout; onTimeout = null; f && f(); } else qleft--; }
  };
  function frame(body, foot) {
    const q = cur, n = Q.length - Q.filter(pend).length;
    const y = window.scrollY, same = frame.last === q; frame.last = q;
    app.replaceChildren(h('div', null,
      h('div', { class: 'qtop' },
        h('div', { class: 'row' }, h('button', { class: 'x', onclick: quit }, '✕'), h('span', { class: 'f' }, names[s.mode] + ' · ' + Math.min(n + 1, Q.length) + ' / ' + Q.length),
          left != null || (s.per_q && s.per_q[q.kind]) ? timerEl : null,
          h('button', { class: 'x', title: 'Xato haqida xabar', onclick: () => reportQ(q) }, '⚑')),
        h('div', { class: 'bar g', style: 'margin-top:10px' }, h('i', { style: 'width:' + (100 * n / Q.length) + '%;background:var(--blue)' }))),
      h('div', { class: 'wrap', style: 'padding-top:8px' }, body), foot ? h('div', { class: 'foot' }, foot) : null));
    window.scrollTo(0, same ? y : 0);
  }
  const tag = (q, t) => h('div', { class: 'tag', style: q._retry ? 'background:var(--red-l);color:#b3261e' : '' }, q._retry ? 'Qayta urinish' : t);
  const more = q => queue.length > 0 || pend(q);
  function draw() {
    document.querySelectorAll('.nav').forEach(x => x.remove()); document.body.classList.add('noscroll-pad');
    const q = cur; q._retry = (q.tries || 0) > 0;
    onTimeout = null; qleft = s.per_q && s.per_q[q.kind] ? s.per_q[q.kind] : null;
    if (qleft != null) paint(qleft);
    if (q.kind === 'test') drawTest(q); else if (q.kind === 'match') drawMatch(q); else drawCard(q);
  }
  function drawTest(q) {
    // "A va B javoblar to‘g‘ri", "barchasi" kabi variantlar bo‘lsa, tartib aralashtirilmaydi
    const fixed = q.o.some(o => /javob|barcha|hammasi|yuqoridagi|\b[A-D] va [A-D]\b/i.test(o));
    const order = q._o || (q._o = fixed ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]));
    let st = { sel: null, res: null };
    const render = () => frame([
      h('div', { class: 'qcard' }, tag(q, 'Test'), h('div', { class: 'q' }, q.q), q.img ? h('img', { src: '/media/' + q.img }) : null),
      order.map((oi, k) => {
        let cls = 'opt';
        if (st.res) { cls += ' lock'; if (oi === st.res.right) cls += ' ok'; else if (oi === st.sel) cls += ' bad'; }
        else if (st.sel === oi) cls += ' sel lock'; else if (st.sel != null) cls += ' lock';
        return h('button', { class: cls, onclick: () => choose(oi) }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', null, q.o[oi]));
      }),
      st.res ? h('div', { class: 'fb ' + (st.res.ok ? 'ok' : 'bad') }, st.res.ok ? '✓ To‘g‘ri! +' + st.res.pts + ' ball'
        : (st.sel === -1 ? '⏱ Vaqt tugadi. ' : '✕ Noto‘g‘ri. ') + 'To‘g‘ri javob: ' + q.o[st.res.right] + (s.repeat ? ' — bu savol yana so‘raladi' : '')) : null,
    ], st.res ? hint() : null);
    const choose = oi => {
      if (st.sel != null) return; st.sel = oi; qleft = null; onTimeout = null;
      const retry = q.tries > 0; q.your = oi; q.tries = (q.tries || 0) + 1;
      send({ sid: s.sid, qid: q.id, a: oi });
      if (s.reveal) { const ok = oi === q.right; q.ok = ok; st.res = { ok, right: q.right, pts: ok ? (retry ? 3 : 10) : 0 }; haptic(ok ? 'ok' : 'bad'); render(); auto(ok ? 900 : 2600); }
      else { haptic(); render(); setTimeout(next, 160); }
    };
    onTimeout = () => choose(-1);
    render();
  }
  function drawMatch(q) {
    const st = { pick: Array(q.l.length).fill(null), act: 0, res: null, busy: false };
    const L = 'abcdefgh';
    const submit = () => {
      if (st.busy || st.res) return; st.busy = true; qleft = null; onTimeout = null;
      const retry = q.tries > 0; q.your = st.pick.slice(); q.tries = (q.tries || 0) + 1;
      send({ sid: s.sid, qid: q.id, a: st.pick });
      if (s.reveal) {
        const good = st.pick.filter((p, k) => p === q.right[k]).length, ok = good === q.right.length;
        q.ok = ok; st.res = { ok, right: q.right, pts: retry ? Math.floor(good * 5 / 3) : good * 5 }; haptic(ok ? 'ok' : 'bad'); render(); auto(ok ? 1500 : 4500);
      } else next();
    };
    const render = () => frame([
      h('div', { class: 'qcard' }, tag(q, 'Moslashtirish'), h('div', { class: 'q' }, q.t),
        h('div', { class: 'sm mute mt' }, 'Chapdagi qatorni tanlang, so‘ng unga mos javobni bosing. Bitta javob ortiqcha.')),
      h('div', { class: 'mcol' }, q.lh || 'Savol'),
      q.l.map((t, k) => {
        let cls = 'mitem' + (!st.res && st.act === k ? ' act' : '');
        if (st.res) cls += st.pick[k] === st.res.right[k] ? ' ok' : ' bad';
        return h('button', { class: cls, onclick: () => { if (!st.res) { st.act = k; render(); } } }, h('span', { class: 'k' }, k + 1),
          q.li && q.li[k] ? h('img', { src: '/media/' + q.li[k] }) : null, h('span', null, t),
          h('span', { class: 'slot' + (st.pick[k] != null ? ' f' : '') }, st.pick[k] != null ? L[st.pick[k]] : '?', st.res && st.pick[k] !== st.res.right[k] ? ' → ' + L[st.res.right[k]] : ''));
      }),
      h('div', { class: 'mcol' }, q.rh || 'Javob'),
      q.r.map((t, k) => h('button', { class: 'mitem' + (st.pick.includes(k) ? ' used' : ''), onclick: () => {
        if (st.res) return;
        const was = st.pick.indexOf(k); if (was >= 0) st.pick[was] = null;
        st.pick[st.act] = k; haptic();
        const nx = st.pick.findIndex(x => x == null); if (nx >= 0) st.act = nx;
        render();
      } }, h('span', { class: 'k l' }, L[k]), q.ri && q.ri[k] ? h('img', { src: '/media/' + q.ri[k] }) : null, h('span', null, t))),
      st.res ? h('div', { class: 'fb ' + (st.res.ok ? 'ok' : 'bad') }, st.res.ok ? '✓ Hammasi to‘g‘ri! +' + st.res.pts + ' ball' : 'To‘g‘ri juftliklar: ' + st.pick.filter((p, k) => p === st.res.right[k]).length + ' / ' + q.l.length + ' · +' + st.res.pts + ' ball' + (s.repeat ? ' — yana so‘raladi' : '')) : null,
    ], st.res ? hint()
      : h('button', { class: 'btn y', disabled: st.pick.includes(null) || st.busy, onclick: submit }, 'Tekshirish'));
    onTimeout = submit;
    render();
  }
  function drawCard(q) {
    let open = false;
    const rate = k => () => { send({ sid: s.sid, qid: q.id, a: k }); q.your = k; haptic(k ? 'ok' : 'bad'); next(); };
    const render = () => frame([
      h('div', { class: 'qcard flip' }, h('div', null, h('div', { class: 'tag' }, 'Savol'), h('div', { class: 'q' }, q.q),
        open ? h('div', { class: 'ansbox' }, h('div', { class: 'sm mute bold', style: 'margin-bottom:4px' }, 'JAVOB'), q.a) : null)),
      h('div', { class: 'sm mute c mt' }, open ? 'O‘zingizga rost javob bering: «Bilmadim» desangiz, savol keyinroq qayta chiqadi. Kartochkalar uchun ball berilmaydi.' : 'Avval javobni o‘zingiz ayting yoki yozib ko‘ring, so‘ng tekshiring'),
    ], open ? h('div', { class: 'row' }, h('button', { class: 'btn w f', onclick: rate(0) }, '✕ Bilmadim'), h('button', { class: 'btn g f', onclick: rate(1) }, '✓ Bildim'))
      : h('button', { class: 'btn', onclick: () => { open = true; render(); } }, 'Javobni ko‘rish'));
    render();
  }
  if (left != null || s.per_q) S.timer = setInterval(tick, 1000);
  if (left != null) tick();
  next();
}
function reportQ(q) {
  const t = prompt('Bu savolda qanday xato bor? (qisqacha yozing)');
  if (t && t.trim()) api('/report', { qid: q.id, text: t.trim() }).then(() => toast('Rahmat! Xabaringiz adminga yuborildi.')).catch(e => toast(e.message));
}

/* ---------------- natija ---------------- */
function result(r) {
  const pct = r.total ? Math.round(100 * r.score / r.total) : 0;
  const L = 'abcdefgh';
  const msg = pct >= 90 ? 'Ajoyib natija!' : pct >= 70 ? 'Yaxshi!' : pct >= 50 ? 'Yomon emas, davom eting' : 'Mashq qilishda davom eting';
  const ans = q => {
    if (q.kind === 'test') return [q.your != null && !q.ok ? h('div', { class: 'a wrong' }, '✕ Sizning javob: ' + q.o[q.your]) : null,
      h('div', { class: 'a good' }, '✓ ' + q.o[q.right]), q.your == null ? h('div', { class: 'a mute' }, 'Javob berilmagan') : null];
    if (q.kind === 'match') return q.l.map((t, k) => h('div', { class: 'a ' + (q.your && q.your[k] === q.right[k] ? 'good' : 'wrong') }, (k + 1) + '. ' + (t || 'rasm') + ' → ' + q.r[q.right[k]]));
    return h('div', { class: 'a ' + (q.ok ? 'good' : 'wrong') }, q.a);
  };
  show(h('div', null, header(r.mode === 'duel' ? 'Bellashuv' : 'Natija', msg, () => go('home')),
    h('div', { class: 'wrap' },
      h('div', { class: 'ring', style: '--p:' + pct + '%' }, h('div', null, h('span', null, h('b', null, r.score + '/' + r.total), h('small', null, r.mode === 'daily' ? 'birinchi urinishda' : pct + '% to‘g‘ri')))),
      h('div', { class: 'row mt2', style: 'justify-content:center' }, h('span', { class: 'badge y' }, '+' + r.xp + ' ball'), h('span', { class: 'badge m' }, '⏱ ' + mmss(r.secs || 0)),
        r.streak ? h('span', { class: 'badge' }, '🔥 ' + r.streak + ' kun') : null),
      r.duel ? duelCard(r.duel) : null,
      r.badges.length ? [h('div', { class: 'sec' }, 'Yangi yutuq!'), h('div', { class: 'list' }, r.badges.map(b => h('div', { class: 'li' }, h('div', { class: 'n', style: 'font-size:18px' }, BICON[b.code] || '🏅'), h('div', { class: 't' }, h('b', null, b.name), h('small', null, b.desc)))))] : null,
      h('button', { class: 'btn mt2', onclick: () => go(r.mode === 'duel' ? 'duel' : 'home') }, 'Davom etish'),
      h('div', { class: 'sec' }, 'Javoblar tahlili'),
      h('div', { class: 'list' }, r.review.map((q, k) => h('div', { class: 'rev' }, h('div', { class: 'q' }, (k + 1) + '. ' + (q.q || q.t)), ans(q)))))));
  if (pct >= 70) haptic('ok');
}

/* ---------------- reyting ---------------- */
async function topView(period = 'week', scope = 'all') {
  const r = await api('/top?period=' + period + '&scope=' + scope);
  back(null);
  const scopes = [['all', 'Hamma'], ...S.me.groups.map(g => ['g' + g.id, g.name])];
  show(h('div', null, h('div', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }), h('span', { class: 'pill' }, r.me.rank ? 'Siz: ' + r.me.rank + '-o‘rin' : 'Hali reytingda yo‘qsiz')),
    h('h1', null, 'Reyting'), h('div', { class: 'sub' }, 'Eng faol va bilimdon o‘quvchilar')),
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs' }, [['week', 'Hafta'], ['month', 'Oy'], ['all', 'Umumiy']].map(([k, t]) => h('button', { class: k === period ? 'on' : '', onclick: guard(() => topView(k, scope)) }, t))),
      h('div', { class: 'chips mt' }, scopes.map(([k, t]) => h('button', { class: 'chip' + (k === scope ? ' on' : ''), onclick: guard(() => topView(period, k)) }, t))),
      h('div', { class: 'mt' }),
      r.rows.length ? h('div', { class: 'list' }, r.rows.map(x => h('div', { class: 'li' + (x.me ? ' me' : '') },
        h('div', { class: 'n', style: x.rank <= 3 ? 'background:none;font-size:22px' : '' }, x.rank <= 3 ? '🥇🥈🥉'.slice((x.rank - 1) * 2, x.rank * 2) : x.rank),
        h('div', { class: 't' }, h('b', null, x.name), x.level ? h('small', null, x.level) : null),
        h('div', { class: 'v' }, x.pts))))
        : h('div', { class: 'card c mute' }, 'Bu davrda hali hech kim ball to‘plamagan. Birinchi bo‘ling!'))), true);
}

/* ---------------- bellashuv ---------------- */
function duelCard(d) {
  const you = d.me, o = d.other;
  return h('div', { class: 'mt2' }, h('div', { class: 'vs' },
    h('div', { class: 'p' + (d.win === 'me' ? ' win' : '') }, h('b', null, you.score == null ? '—' : you.score), h('span', null, 'Siz'), h('small', { class: 'mute' }, you.secs != null ? mmss(you.secs) : '')),
    h('i', null, 'VS'),
    h('div', { class: 'p' + (d.win === 'other' ? ' win' : '') }, h('b', null, o.score == null ? (o.played ? '✓' : '—') : o.score), h('span', null, o.name || 'Raqib kutilmoqda'), h('small', { class: 'mute' }, o.secs != null ? mmss(o.secs) : ''))),
    h('div', { class: 'c bold mt' }, d.status === 'done' ? (d.win === 'me' ? '🏆 Siz g‘olibsiz! +50 ball' : d.win === 'other' ? 'Bu safar raqib kuchli chiqdi' : 'Durang!') : d.played ? 'Raqib javobini kutyapmiz…' : ''));
}
async function duelHome() {
  const list = await api('/duels');
  back(null);
  const mk = rnd => guard(async () => { const d = await api('/duel', { random: rnd }); duelView(d.code); });
  show(h('div', null, h('div', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' })), h('h1', null, 'Bellashuv'), h('div', { class: 'sub' }, '10 ta savol · kim ko‘p va tez topsa — g‘olib (+50 ball)')),
    h('div', { class: 'wrap' },
      h('button', { class: 'cta y', onclick: mk(false) }, h('div', { class: 'ic' }, '🤝'), h('div', null, h('b', null, 'Do‘stni chaqirish'), h('small', null, 'Havola yuboring va bellashing')), h('div', { class: 'go' }, '→')),
      h('div', { class: 'mt' }),
      h('button', { class: 'cta', onclick: mk(true) }, h('div', { class: 'ic' }, '🎲'), h('div', null, h('b', null, 'Tasodifiy raqib'), h('small', null, 'Navbatdagi o‘quvchi bilan')), h('div', { class: 'go' }, '→')),
      list.length ? [h('div', { class: 'sec' }, 'Bellashuvlarim'), h('div', { class: 'list' }, list.map(d => h('button', { class: 'li', onclick: guard(() => duelView(d.code)) },
        h('div', { class: 'n' }, d.status === 'done' ? (d.win === 'me' ? '🏆' : d.win === 'draw' ? '🤝' : '·') : '⏳'),
        h('div', { class: 't' }, h('b', null, d.other.name || 'Raqib kutilmoqda'), h('small', null, d.status === 'done' ? 'Yakunlangan' : d.played ? 'Raqib navbati' : 'Sizning navbatingiz')),
        h('div', { class: 'v' }, (d.me.score == null ? '—' : d.me.score) + ' : ' + (d.other.score == null ? '—' : d.other.score)))))] : null)), true);
}
async function duelView(code) {
  const d = await api('/duel/' + code);
  const share = () => { const url = 'https://t.me/share/url?url=' + encodeURIComponent(d.link) + '&text=' + encodeURIComponent('Tarixdan bellashamizmi? ⚔️ Adab School'); tg && tg.openTelegramLink ? tg.openTelegramLink(url) : window.open(url); };
  show(h('div', null, header('Bellashuv', d.is_member ? d.total + ' ta savol · har biriga 15 soniya · bitta urinish' : (d.host || 'O‘quvchi') + ' sizni bellashuvga chaqirdi', () => go('duel')),
    h('div', { class: 'wrap' },
      d.is_member ? duelCard(d) : h('div', { class: 'card c' }, h('div', { style: 'font-size:44px' }, '⚔️'), h('p', { class: 'bold' }, d.can_join ? d.total + ' ta savol. Tayyormisiz?' : 'Bu bellashuvda joy qolmagan')),
      (d.is_member && !d.played) || (!d.is_member && d.can_join) ? h('button', { class: 'btn y mt2', onclick: () => startSession({ mode: 'duel', duel: code }) }, 'Boshlash →') : null,
      d.is_member && !d.other.name ? h('button', { class: 'btn w mt', onclick: share }, '📨 Do‘stga havola yuborish') : null,
      h('button', { class: 'btn ghost mt', onclick: () => go('duel') }, 'Orqaga'))), false);
}

/* ---------------- profil ---------------- */
async function profile(keep) {
  if (!keep) refreshMe('profile', () => profile(true));
  const { user: u, level: L } = S.me;
  back(null);
  const role = { user: 'Mehmon', student: 'Adab School o‘quvchisi', teacher: 'O‘qituvchi', admin: 'Administrator' }[u.role];
  const join = guard(async () => { const c = prompt('O‘qituvchi bergan guruh kodini kiriting:'); if (!c) return; const r = await api('/join', { code: c }); toast('«' + r.name + '» guruhiga qo‘shildingiz'); S.me = await api('/me'); profile(true); });
  show(h('div', null, h('div', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }), h('span', { class: 'pill' }, role)),
    h('h1', null, u.name), h('div', { class: 'sub' }, L.idx + '-daraja · ' + L.name + ' · ' + u.xp + ' ball')),
    h('div', { class: 'wrap' },
      u.role === 'teacher' || u.role === 'admin' ? h('button', { class: 'cta', onclick: guard(teacherHome) }, h('div', { class: 'ic' }, '👩‍🏫'), h('div', null, h('b', null, 'O‘qituvchi paneli'), h('small', null, 'Guruhlar, vazifalar, natijalar')), h('div', { class: 'go' }, '→')) : null,
      u.role === 'admin' ? [h('div', { class: 'mt' }), h('button', { class: 'cta', onclick: guard(adminHome) }, h('div', { class: 'ic' }, '⚙️'), h('div', null, h('b', null, 'Admin paneli'), h('small', null, 'Savollar, foydalanuvchilar, shikoyatlar')), h('div', { class: 'go' }, '→'))] : null,
      h('div', { class: 'sec' }, 'Ko‘rsatkichlar'),
      h('div', { class: 'grid' },
        h('div', { class: 'card c' }, h('div', { class: 'hd', style: 'font-size:22px' }, S.me.stats.ok), h('div', { class: 'sm mute bold' }, 'to‘g‘ri javob')),
        h('div', { class: 'card c' }, h('div', { class: 'hd', style: 'font-size:22px' }, '🔥 ' + u.best_streak), h('div', { class: 'sm mute bold' }, 'eng uzun seriya'))),
      h('div', { class: 'sec' }, 'Yutuqlar'),
      h('div', { class: 'bdg' }, S.me.all_badges.map(b => h('div', { class: S.me.badges.includes(b.code) ? '' : 'off', title: b.desc }, h('i', null, BICON[b.code] || '🏅'), b.name))),
      h('div', { class: 'sec' }, 'Sozlamalar'),
      h('div', { class: 'list' },
        h('button', { class: 'li', onclick: () => guard(onboarding)(true) }, h('div', { class: 'n' }, '📘'), h('div', { class: 't' }, h('b', null, 'Darslik'), h('small', null, S.me.groups.length ? 'Guruhda o‘tilgan mavzular bo‘yicha' : (u.book ? u.book.replace(/([a-z]+)(\d+)/, (m, sb, g) => SUBJ[sb] + ' · ' + g + '-sinf darsligi') : 'tanlanmagan'))), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: join }, h('div', { class: 'n' }, '👥'), h('div', { class: 't' }, h('b', null, 'Guruhga qo‘shilish'), h('small', null, S.me.groups.length ? S.me.groups.map(g => g.name).join(', ') : 'O‘qituvchi kodi orqali')), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: guard(async () => { await api('/me', { remind: !u.remind }); S.me = await api('/me'); profile(true); }) }, h('div', { class: 'n' }, '🔔'), h('div', { class: 't' }, h('b', null, 'Kunlik eslatma'), h('small', null, 'Har kuni kechqurun bot eslatadi')), h('span', { class: 'badge ' + (u.remind ? 'g' : 'm') }, u.remind ? 'yoqilgan' : 'o‘chiq'))),
      h('div', { class: 'mt2 c sm mute' }, 'ID: ' + u.id))), true, 'profile');
}

/* ---------------- o'qituvchi ---------------- */
async function teacherHome() {
  const gs = await api('/t/groups');
  const add = guard(async () => {
    const n = prompt('Yangi guruh nomi (masalan: Tarix 1-daraja, dush-chor 15:00):'); if (!n) return;
    await api('/t/group', { name: n }); teacherHome();
  });
  show(h('div', null, header('O‘qituvchi paneli', 'Guruh yarating va kodini o‘quvchilarga bering', () => go('profile')),
    h('div', { class: 'wrap' },
      gs.length ? h('div', { class: 'list' }, gs.map(g => h('button', { class: 'li', onclick: guard(() => groupView(g.id)) }, h('div', { class: 'n' }, '👥'),
        h('div', { class: 't' }, h('b', null, g.name), h('small', null, g.members + ' o‘quvchi · ' + g.homework + ' vazifa · kod: ' + g.code)), h('span', { class: 'mute' }, '›'))))
        : h('div', { class: 'card c mute' }, 'Hali guruh yo‘q'),
      h('button', { class: 'btn mt2', onclick: add }, '+ Guruh yaratish'))));
}
async function groupView(gid) {
  const g = await api('/t/group/' + gid);
  const newHw = () => setup('hw', guard(async pick => {
    if (!pick) return groupView(gid);
    const title = prompt('Vazifa nomi:', pick.names.length === 1 ? pick.names[0].slice(0, 60) : 'Uyga vazifa') || 'Uyga vazifa';
    const dl = prompt('Topshirish muddati (YYYY-OO-KK), bo‘sh qoldirish mumkin:', '') || null;
    const r = await api('/t/hw', { group_id: gid, title, topics: pick.topics, count: pick.count, deadline: dl });
    toast('Vazifa yuborildi: ' + r.count + ' ta savol'); groupView(gid);
  }));
  show(h('div', null, header(g.name, 'kod: ' + g.code + ' · ' + g.members.length + ' o‘quvchi', () => teacherHome()),
    h('div', { class: 'wrap' },
      h('button', { class: 'btn y', onclick: newHw }, '+ Uyga vazifa berish'),
      h('div', { class: 'sec' }, 'O‘quvchilarni taklif qilish'),
      h('div', { class: 'card c' }, h('img', { src: g.qr, alt: 'QR', style: 'width:190px;height:190px' }),
        h('div', { class: 'sm mute' }, 'O‘quvchi QR kodni skanerlaydi yoki havolani bosadi — guruhga o‘zi qo‘shiladi'),
        h('div', { class: 'row mt', style: 'justify-content:center' },
          h('button', { class: 'btn sm', onclick: () => { const url = 'https://t.me/share/url?url=' + encodeURIComponent(g.link) + '&text=' + encodeURIComponent('«' + g.name + '» guruhiga qo‘shiling — Adab School tarix boti'); tg && tg.openTelegramLink ? tg.openTelegramLink(url) : window.open(url); } }, '📨 Havolani ulashish'),
          h('button', { class: 'btn sm w', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(g.link); toast('Havola nusxalandi'); } }, 'Nusxalash'))),
      h('div', { class: 'sec' }, 'O‘tilgan mavzular'),
      h('button', { class: 'cta', style: 'box-shadow:none;border:1.5px solid var(--line)', onclick: () => guard(progressView)(g) }, h('div', { class: 'ic', style: 'background:var(--blue)' }, '📍'),
        h('div', null, h('b', null, g.progress.length ? g.progress.length + ' ta mavzu o‘tilgan' : 'Belgilanmagan'),
          h('small', null, g.progress.length ? 'Oxirgisi: ' + (t => bookShort(t) + ' — ' + t.num + '. ' + t.title)(g.progress[g.progress.length - 1]) : 'Belgilasangiz, o‘quvchilarga faqat o‘tilgan mavzulardan savol chiqadi')), h('div', { class: 'go' }, '→')),
      h('div', { class: 'sec' }, 'Vazifalar'),
      g.homework.length ? h('div', { class: 'list' }, g.homework.map(x => h('button', { class: 'li', onclick: guard(() => hwView(x.id, gid)) }, h('div', { class: 'n' }, '📚'),
        h('div', { class: 't' }, h('b', null, x.title), h('small', null, x.count + ' ta savol' + (x.deadline ? ' · muddat ' + x.deadline : ''))), h('div', { class: 'v' }, x.done + '/' + g.members.length))))
        : h('div', { class: 'card c mute sm' }, 'Hali vazifa berilmagan'),
      h('div', { class: 'sec' }, 'O‘quvchilar (oxirgi 7 kun)'),
      g.members.length ? h('div', { class: 'card', style: 'padding:6px 10px' }, h('table', { class: 't' }, h('tr', null, h('th', null, 'O‘quvchi'), h('th', { class: 'r' }, 'Savol'), h('th', { class: 'r' }, 'Aniqlik'), h('th', { class: 'r' }, '🔥')),
        g.members.map(m => h('tr', null, h('td', null, m.name), h('td', { class: 'r' }, m.week_total), h('td', { class: 'r' }, m.week_total ? Math.round(100 * m.week_ok / m.week_total) + '%' : '—'), h('td', { class: 'r' }, m.streak)))))
        : h('div', { class: 'card c mute sm' }, 'O‘quvchilar Profil → «Guruhga qo‘shilish» orqali ' + g.code + ' kodini kiritadi'),
      g.hard.length ? [h('div', { class: 'sec' }, 'Eng qiyin savollar'), h('div', { class: 'list' }, g.hard.map(x => h('div', { class: 'rev' }, h('div', { class: 'q' }, x.q), h('div', { class: 'a wrong' }, x.pct + '% to‘g‘ri (' + x.n + ' ta javob) · ' + x.topic))))] : null)));
}
async function progressView(g) {
  const T = await loadTopics();
  const sel = new Set(g.progress.map(t => t.id));
  let book = g.progress.length ? (t => t.subj + t.grade)(g.progress[g.progress.length - 1]) : T.books[0].id;
  const draw = () => {
    const y = window.scrollY;
    const list = T.topics.filter(t => t.subj + t.grade === book);
    const cnt = b => T.topics.filter(t => t.subj + t.grade === b.id && sel.has(t.id)).length;
    show(h('div', null, header('O‘tilgan mavzular', g.name + ' · jami ' + sel.size + ' ta mavzu belgilangan', () => guard(groupView)(g.id)),
      h('div', { class: 'wrap' },
        h('div', { class: 'sm mute', style: 'margin-bottom:10px' }, 'Istalgan darslikdan o‘tilgan mavzularni belgilang. Mavzuni bossangiz, undan oldingilari ham belgilanadi; belgini olib tashlash uchun yana bosing.'),
        h('div', { class: 'chips' }, T.books.map(b => h('button', { class: 'chip' + (b.id === book ? ' on' : ''), onclick: () => { book = b.id; draw(); } }, bookShort(b) + (cnt(b) ? ' · ' + cnt(b) : '')))),
        h('div', { class: 'list mt' }, list.map((t, k) => h('button', { class: 'li' + (sel.has(t.id) ? ' on' : ''), onclick: () => {
          if (sel.has(t.id)) sel.delete(t.id); else list.slice(0, k + 1).forEach(x => sel.add(x.id));
          haptic(); draw();
        } }, h('div', { class: 'check' }, sel.has(t.id) ? '✓' : ''), h('div', { class: 't' }, h('b', null, t.num + '. ' + t.title)))))),
      h('div', { class: 'foot' }, h('button', { class: 'btn y', onclick: guard(async () => { await api('/t/progress', { group_id: g.id, topics: [...sel] }); S.me = await api('/me'); toast('Saqlandi'); groupView(g.id); }) }, 'Saqlash'))));
    window.scrollTo(0, y);
  };
  draw();
}
async function hwView(hid, gid) {
  const r = await api('/t/hw/' + hid);
  show(h('div', null, header(r.title, r.total + ' ta savol' + (r.deadline ? ' · muddat ' + r.deadline : ''), () => guard(groupView)(gid)),
    h('div', { class: 'wrap' },
      h('div', { class: 'card', style: 'padding:6px 10px' }, h('table', { class: 't' }, h('tr', null, h('th', null, 'O‘quvchi'), h('th', { class: 'r' }, 'Natija'), h('th', { class: 'r' }, 'Vaqt'), h('th', { class: 'r' }, 'Sana')),
        r.rows.map(m => h('tr', null, h('td', null, m.name), h('td', { class: 'r ' + (m.done ? '' : 'wrong') }, m.done ? m.score + '/' + r.total : 'bajarmagan'), h('td', { class: 'r' }, m.done ? mmss(m.secs) : ''), h('td', { class: 'r' }, m.date ? m.date.slice(5) : ''))))),
      h('div', { class: 'sec' }, 'Savollar bo‘yicha'),
      h('div', { class: 'list' }, r.questions.map(q => h('div', { class: 'rev' }, h('div', { class: 'q' }, q.q), h('div', { class: 'a ' + (q.n && q.ok / q.n < .5 ? 'wrong' : 'good') }, q.ok + '/' + q.n + ' to‘g‘ri · javob: ' + q.right)))))));
}

/* ---------------- admin ---------------- */
async function adminHome() {
  const s = await api('/a/stats');
  const st = (v, t) => h('div', { class: 'card c' }, h('div', { class: 'hd', style: 'font-size:20px' }, v), h('div', { class: 'sm mute bold' }, t));
  show(h('div', null, header('Admin paneli', null, () => go('profile')),
    h('div', { class: 'wrap' },
      h('div', { class: 'grid' }, st(s.users, 'foydalanuvchi'), st(s.students, 'o‘quvchi'), st(s.active_today, 'bugun faol'), st(s.answers_today, 'bugungi javoblar'), st(s.questions, 'savol'), st(s.topics, 'mavzu')),
      h('div', { class: 'sec' }, 'Boshqaruv'),
      h('div', { class: 'list' },
        h('button', { class: 'li', onclick: guard(adminReports) }, h('div', { class: 'n' }, '⚑'), h('div', { class: 't' }, h('b', null, 'Savoldagi xatolar haqida xabarlar')), s.reports_new ? h('span', { class: 'badge' }, s.reports_new) : h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: () => guard(adminTopics)() }, h('div', { class: 'n' }, '✏️'), h('div', { class: 't' }, h('b', null, 'Savollarni tahrirlash')), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: () => adminUsers() }, h('div', { class: 'n' }, '👤'), h('div', { class: 't' }, h('b', null, 'Foydalanuvchilar va rollar')), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: adminWhitelist }, h('div', { class: 'n' }, '📱'), h('div', { class: 't' }, h('b', null, 'O‘quvchilar ro‘yxati (telefon)'), h('small', null, s.whitelist + ' ta raqam')), h('span', { class: 'mute' }, '›'))))));
}
function qEditor(q, after) {
  const d = JSON.parse(JSON.stringify(q.data)); let active = q.active;
  const inp = (v, on, ta) => h(ta ? 'textarea' : 'input', { class: 'field mt', value: ta ? null : v, oninput: e => on(e.target.value) }, ta ? v : null);
  const draw = () => show(h('div', null, header('Savolni tahrirlash', '#' + q.id, after),
    h('div', { class: 'wrap' },
      q.kind === 'match' ? h('div', { class: 'card' }, h('b', null, d.t), h('p', { class: 'sm mute' }, 'Moslashtirish topshiriqlarini bu yerda faqat o‘chirib qo‘yish mumkin.'))
        : [h('div', { class: 'sm bold mute' }, 'Savol'), inp(d.q, v => d.q = v, true),
          q.kind === 'test' ? [h('div', { class: 'sm bold mute mt2' }, 'Variantlar (to‘g‘risini belgilang)'), d.o.map((o, k) => h('div', { class: 'row' },
            h('button', { class: 'check mt' + (d.a === k ? ' on' : ''), onclick: () => { d.a = k; draw(); } }, d.a === k ? '✓' : ''), h('div', { class: 'f' }, inp(o, v => d.o[k] = v))))]
            : [h('div', { class: 'sm bold mute mt2' }, 'Javob'), inp(d.a, v => d.a = v, true)]],
      h('button', { class: 'li mt2', style: 'border:1.5px solid var(--line);border-radius:14px;background:#fff', onclick: () => { active = !active; draw(); } }, h('div', { class: 'check' + (active ? ' on' : '') }, active ? '✓' : ''), h('div', { class: 't' }, h('b', null, 'Savol faol'), h('small', null, 'O‘chirilsa, o‘quvchilarga chiqmaydi'))),
      h('button', { class: 'btn mt2', onclick: guard(async () => { await api('/a/question/' + q.id, { data: d, active }, 'PUT'); toast('Saqlandi'); after(); }) }, 'Saqlash'))));
  draw();
}
async function adminReports() {
  const rs = await api('/a/reports');
  show(h('div', null, header('Xabarlar', rs.length + ' ta yangi', () => guard(adminHome)()),
    h('div', { class: 'wrap' }, rs.length ? rs.map(r => h('div', { class: 'card', style: 'margin-bottom:12px' },
      h('div', { class: 'sm mute bold' }, r.by + ' yozdi:'), h('div', { class: 'bold' }, r.text),
      r.q ? h('div', { class: 'sm mt', style: 'padding:10px;background:var(--cream);border-radius:12px' }, r.q.data.q || r.q.data.t, r.q.kind === 'test' ? h('div', { class: 'good bold' }, '✓ ' + r.q.data.o[r.q.data.a]) : null) : null,
      h('div', { class: 'row mt' }, r.q ? h('button', { class: 'btn sm', onclick: () => qEditor(r.q, guard(adminReports)) }, 'Tahrirlash') : null,
        h('button', { class: 'btn sm w', onclick: guard(async () => { await api('/a/report/' + r.id, {}); adminReports(); }) }, 'Yopish'))))
      : h('div', { class: 'card c mute' }, 'Yangi xabarlar yo‘q 🎉'))));
}
async function adminTopics(book) {
  const T = await loadTopics(); book = typeof book === 'string' ? book : T.books[0].id;
  show(h('div', null, header('Savollar', 'Mavzuni tanlang', () => guard(adminHome)()),
    h('div', { class: 'wrap' }, h('div', { class: 'chips' }, T.books.map(b => h('button', { class: 'chip' + (b.id === book ? ' on' : ''), onclick: () => adminTopics(b.id) }, bookShort(b)))),
      h('div', { class: 'list mt' }, T.topics.filter(t => t.subj + t.grade === book).map(t => h('button', { class: 'li', onclick: guard(() => adminQuestions(t, 'test')) },
        h('div', { class: 't' }, h('b', null, t.num + '. ' + t.title), h('small', null, t.tests + ' test · ' + t.matches + ' moslashtirish · ' + t.cards + ' savol')), h('span', { class: 'mute' }, '›')))))));
}
async function adminQuestions(t, kind) {
  const qsn = await api('/a/questions?topic=' + t.id + '&kind=' + kind);
  show(h('div', null, header(t.title, bookName(t), () => adminTopics(t.subj + t.grade)),
    h('div', { class: 'wrap' }, h('div', { class: 'tabs' }, [['test', 'Testlar'], ['match', 'Moslashtirish'], ['card', 'Savol-javob']].map(([k, n]) => h('button', { class: k === kind ? 'on' : '', onclick: guard(() => adminQuestions(t, k)) }, n))),
      h('div', { class: 'list mt' }, qsn.map(q => h('button', { class: 'li', style: q.active ? '' : 'opacity:.45', onclick: () => qEditor(q, guard(() => adminQuestions(t, kind))) },
        h('div', { class: 'n' }, q.n), h('div', { class: 't' }, h('b', null, q.data.q || q.data.t), h('small', null, kind === 'test' ? '✓ ' + q.data.o[q.data.a] : kind === 'card' ? q.data.a : q.data.l.length + ' juftlik')), q.data.img ? h('span', null, '🖼') : null))))));
}
function adminUsers(q) {
  let box;
  const load = guard(async () => {
    const us = await api('/a/users?q=' + encodeURIComponent(q || ''));
    box.replaceChildren(...us.map(u => h('div', { class: 'li' }, h('div', { class: 't' }, h('b', null, u.name + (u.username ? ' · @' + u.username : '')), h('small', null, u.xp + ' ball' + (u.phone ? ' · ' + u.phone : ''))),
      h('select', { class: 'field', style: 'width:auto;padding:6px 8px', onchange: guard(async e => { await api('/a/user/' + u.id, { role: e.target.value }); toast('Rol o‘zgartirildi'); }) },
        [['user', 'Mehmon'], ['student', 'O‘quvchi'], ['teacher', 'O‘qituvchi'], ['admin', 'Admin']].map(([k, n]) => h('option', { value: k, selected: k === u.role }, n))))));
    if (!us.length) box.replaceChildren(h('div', { class: 'li mute' }, 'Topilmadi'));
  });
  show(h('div', null, header('Foydalanuvchilar', 'Ism, @username yoki telefon bo‘yicha qidiring', () => guard(adminHome)()),
    h('div', { class: 'wrap' }, h('input', { class: 'field', placeholder: 'Qidirish…', oninput: e => { q = e.target.value; clearTimeout(adminUsers.t); adminUsers.t = setTimeout(load, 350); } }),
      box = h('div', { class: 'list mt' }))));
  load();
}
function adminWhitelist() {
  let ta;
  show(h('div', null, header('O‘quvchilar ro‘yxati', 'Shu raqamlar egasi botda cheklovsiz foydalanadi', () => guard(adminHome)()),
    h('div', { class: 'wrap' }, h('div', { class: 'sm mute' }, 'Har qatorga bitta telefon raqami (ism yozish ixtiyoriy). EduTizim’dan eksport qilingan ro‘yxatni shu yerga joylashtiring.'),
      ta = h('textarea', { class: 'field mt', style: 'min-height:220px', placeholder: '+998 90 123 45 67 Aliyev Vali\n901234568' }),
      h('button', { class: 'btn mt', onclick: guard(async () => { const r = await api('/a/whitelist', { text: ta.value }); toast(r.added + ' ta raqam qo‘shildi, ' + r.upgraded + ' kishi o‘quvchiga aylandi. Jami: ' + r.total); ta.value = ''; }) }, 'Ro‘yxatga qo‘shish'))));
}

boot();
