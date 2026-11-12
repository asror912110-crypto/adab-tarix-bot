/* Adab School · Tarix — Telegram Mini App */
const tg = window.Telegram && Telegram.WebApp;
const qs = new URLSearchParams(location.search);
const INIT = (tg && tg.initData) || (qs.get('dev') ? 'dev:' + qs.get('dev') : '');
const app = document.getElementById('app');
const S = { me: null, tab: 'home', topics: null, timer: null };
const SUBJ = { jahon: 'Jahon tarixi', uzb: "O‘zbekiston tarixi", tarix: 'Tarix' };
const BICON = { first: '🚀', streak3: '🔥', streak7: '📆', streak30: '🏆', perfect: '💯', c100: '🎯', c500: '⭐', c2000: '🧠', duel1: '⚔️', duel10: '🛡️', clean: '✨' };

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
function show(node, nav) {
  clearInterval(S.timer);
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
  const items = [['home', '🏠', 'Asosiy'], ['top', '🏆', 'Reyting'], ['duel', '⚔️', 'Bellashuv'], ['profile', '👤', 'Profil']];
  return h('div', { class: 'nav' }, h('div', null, items.map(([k, i, t]) =>
    h('button', { class: S.tab === k ? 'on' : '', onclick: () => go(k) }, h('i', null, i), t))));
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
  try { S.me = await api('/me'); } catch (e) { return show(h('div', { class: 'load' }, e.message)); }
  if (!S.me.user.grade) return onboarding();
  const dc = (qs.get('duel') || '').replace(/\W/g, '');
  if (dc) { S.tab = 'duel'; return guard(duelView)(dc); }
  go('home');
}
function onboarding(change) {
  let g = S.me.user.grade;
  const draw = () => show(h('div', { class: 'hero' },
    h('img', { src: '/static/logo-white.png', style: 'height:44px;align-self:flex-start' }),
    h('h1', null, 'Tarixni ', h('span', { class: 'hl' }, 'o‘ynab'), ' o‘rganamiz!'),
    h('p', { style: 'opacity:.9;font-weight:600' }, 'Nechanchi sinfda o‘qiysiz? Savollar shunga qarab tanlanadi.'),
    h('div', { class: 'gradegrid' }, [6, 7, 8, 9, 10, 11].map(x =>
      h('button', { class: g === x ? 'on' : '', onclick: () => { g = x; haptic(); draw(); } }, x, h('small', null, 'sinf')))),
    h('div', { style: 'flex:1;min-height:24px' }),
    h('button', { class: 'btn y', disabled: !g, onclick: guard(async () => { await api('/me', { grade: g }); S.me = await api('/me'); go(change ? 'profile' : 'home'); }) }, 'Davom etish →')));
  draw();
}

/* ---------------- asosiy sahifa ---------------- */
async function home() {
  S.me = await api('/me');
  const { user: u, level: L, free } = S.me;
  back(null);
  const pct = L.next ? Math.round(100 * (u.xp - L.from) / (L.next - L.from)) : 100;
  const hw = S.me.homework.filter(x => !x.done);
  show(h('div', null,
    h('div', { class: 'top' },
      h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }), h('span', { class: 'pill' }, u.grade + '-sinf · Tarix')),
      h('h1', null, 'Salom, ' + u.name.split(' ')[0] + '!'),
      h('div', { class: 'lvl' }, h('div', { class: 'row' }, h('span', { class: 'f' }, L.idx + '-daraja · ' + L.name), h('span', null, L.next ? u.xp + ' / ' + L.next + ' ball' : u.xp + ' ball')),
        h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' }))),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', null, '🔥 ' + u.streak), h('span', null, 'kun ketma-ket')),
        h('div', { class: 'stat' }, h('b', null, u.xp), h('span', null, 'ball')),
        h('div', { class: 'stat' }, h('b', null, S.me.stats.total ? Math.round(100 * S.me.stats.ok / S.me.stats.total) + '%' : '—'), h('span', null, 'aniqlik')))),
    h('div', { class: 'wrap' },
      free ? h('div', { class: 'card', style: 'margin-bottom:14px' },
        h('div', { class: 'row sm bold' }, h('span', { class: 'f' }, 'Bugungi bepul limit'), h('span', null, Math.min(free.used, free.limit) + ' / ' + free.limit)),
        h('div', { class: 'bar g' }, h('i', { style: 'width:' + Math.min(100, 100 * free.used / free.limit) + '%' })),
        h('div', { class: 'sm mute mt' }, u.phone ? 'Adab School o‘quvchilari uchun cheklov yo‘q. Ro‘yxatga qo‘shilish uchun administratorga murojaat qiling.'
          : 'Adab School o‘quvchisimisiz? Botga /start yuborib, telefon raqamingizni tasdiqlang — cheklov olib tashlanadi.')) : null,
      S.me.daily_done
        ? h('div', { class: 'cta done' }, h('div', { class: 'ic', style: 'background:var(--green)' }, '✓'), h('div', null, h('b', null, 'Kunlik topshiriq bajarildi'), h('small', null, 'Ertaga yangi savollar kutmoqda')))
        : h('button', { class: 'cta y', onclick: () => startSession({ mode: 'daily' }) }, h('div', { class: 'ic' }, '📅'), h('div', null, h('b', null, 'Kunlik topshiriq'), h('small', null, '15 ta savol · +30 bonus ball')), h('div', { class: 'go' }, '→')),
      hw.length ? [h('div', { class: 'sec' }, 'Uyga vazifa'), h('div', { class: 'list' }, hw.map(x =>
        h('button', { class: 'li', onclick: () => startSession({ mode: 'hw', hw: x.id }) }, h('div', { class: 'n' }, '📚'),
          h('div', { class: 't' }, h('b', null, x.title), h('small', null, x.group + ' · ' + x.count + ' ta savol' + (x.deadline ? ' · muddat: ' + x.deadline : ''))),
          x.late ? h('span', { class: 'badge' }, 'kechikdi') : h('span', { class: 'badge b' }, 'yangi'))))] : null,
      h('div', { class: 'sec' }, 'Mashq rejimlari'),
      h('div', { class: 'grid' },
        tile('📝', 'Imtihon rejimi', 'Vaqtga qarshi test', () => setup('exam')),
        tile('🔁', 'Xatolarim', S.me.mistakes_all ? S.me.mistakes_all + ' ta savol saqlangan' : 'Hozircha xato yo‘q', () => S.me.mistakes_due ? startSession({ mode: 'mistakes' }) : toast(S.me.mistakes_all ? 'Bugun takrorlanadigan xato yo‘q — ertaga qayting' : 'Xatolar ro‘yxati bo‘sh. Zo‘r!'), S.me.mistakes_due),
        tile('🧩', 'Moslashtirish', 'Juftini toping', () => setup('match')),
        tile('🃏', 'Savol-javob', 'Kartochkalar', () => setup('cards'))),
      h('div', { class: 'mt2 c sm mute' }, '© Adab School o‘quv markazi · @adabschooluz'))), true);
}
function tile(em, t, s, fn, n) {
  return h('button', { class: 'tile', onclick: () => { haptic(); fn(); } }, n ? h('span', { class: 'badge' }, n) : null, h('div', { class: 'em' }, em), h('b', null, t), h('small', null, s));
}

/* ---------------- mavzu tanlash ---------------- */
async function loadTopics() { if (!S.topics) S.topics = await api('/topics'); return S.topics; }
const setup = guard(async (mode, onPick) => {
  const T = await loadTopics();
  const st = { grade: S.me.user.grade, subj: null, sel: new Set(), count: mode === 'exam' ? 20 : mode === 'cards' ? 15 : mode === 'match' ? 5 : 15 };
  if (!T.grades.includes(st.grade)) st.grade = T.grades[0];
  const title = { exam: 'Imtihon rejimi', match: 'Moslashtirish', cards: 'Savol-javob kartochkalari', hw: 'Vazifa uchun mavzular' }[mode];
  const key = { exam: 'tests', hw: 'tests', match: 'matches', cards: 'cards' }[mode];
  const counts = { exam: [10, 20, 30], hw: [10, 15, 20, 30], match: [3, 5, 10], cards: [10, 15, 30] }[mode];
  const draw = () => {
    const list = T.topics.filter(t => t.grade === st.grade && (!st.subj || t.subj === st.subj) && t[key] > 0);
    const subs = [...new Set(T.topics.filter(t => t.grade === st.grade).map(t => t.subj))];
    const y = window.scrollY;
    show(h('div', null, header(title, mode === 'exam' ? 'Har bir savolga 1 daqiqa. Natija oxirida ko‘rsatiladi.' : 'Mavzularni belgilang yoki barchasidan aralash oling', () => onPick ? onPick(null) : go('home')),
      h('div', { class: 'wrap' },
        h('div', { class: 'chips' }, T.grades.map(g => h('button', { class: 'chip' + (g === st.grade ? ' on' : ''), onclick: () => { st.grade = g; st.subj = null; st.sel.clear(); draw(); } }, g + '-sinf'))),
        subs.length > 1 ? h('div', { class: 'chips mt' }, [null, ...subs].map(s => h('button', { class: 'chip' + (s === st.subj ? ' on' : ''), onclick: () => { st.subj = s; st.sel.clear(); draw(); } }, s ? SUBJ[s] : 'Barchasi'))) : null,
        h('div', { class: 'sec' }, 'Savollar soni'),
        h('div', { class: 'chips' }, counts.map(n => h('button', { class: 'chip' + (n === st.count ? ' on' : ''), onclick: () => { st.count = n; draw(); } }, n + ' ta'))),
        h('div', { class: 'sec' }, 'Mavzular', h('span', { class: 'mute sm', style: 'margin-left:auto;font-family:Nunito' }, st.sel.size ? st.sel.size + ' ta tanlandi' : 'barchasi')),
        list.length ? h('div', { class: 'list' }, list.map(t => h('button', { class: 'li' + (st.sel.has(t.id) ? ' on' : ''), onclick: () => { st.sel.has(t.id) ? st.sel.delete(t.id) : st.sel.add(t.id); haptic(); draw(); } },
          h('div', { class: 'check' }, st.sel.has(t.id) ? '✓' : ''),
          h('div', { class: 't' }, h('b', null, t.num + '. ' + t.title), h('small', null, SUBJ[t.subj] + ' · ' + t[key] + ' ta')))))
          : h('div', { class: 'card c mute' }, 'Bu sinf uchun savollar hali yuklanmagan')),
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
  let i = Q.findIndex(q => q.your === undefined); if (i < 0) i = Q.length;
  let left = s.left_sec, done = false;
  const names = { exam: 'Imtihon', daily: 'Kunlik topshiriq', mistakes: 'Xatolar ustida ishlash', match: 'Moslashtirish', cards: 'Savol-javob', hw: 'Uyga vazifa', duel: 'Bellashuv' };
  const finish = guard(async () => { if (done) return; done = true; clearInterval(S.timer); result(await api('/finish', { sid: s.sid })); });
  const quit = () => { if (s.reveal && s.mode !== 'daily' ? true : confirm(s.mode === 'daily' ? 'Chiqasizmi? Keyinroq davom ettirishingiz mumkin.' : 'Yakunlaysizmi? Javob berilmagan savollar xato hisoblanadi.')) { s.mode === 'daily' ? (clearInterval(S.timer), go('home')) : finish(); } };
  back(quit);
  const next = () => { i++; i >= Q.length ? finish() : draw(); };
  const timerEl = h('span', { class: 'timer' });
  const tick = () => { if (left == null) return; timerEl.textContent = '⏱ ' + mmss(Math.max(0, left)); timerEl.classList.toggle('hot', left <= 30); if (left <= 0) finish(); left--; };
  function frame(body, foot) {
    const q = Q[i];
    const y = window.scrollY, same = frame.last === i; frame.last = i;
    app.replaceChildren(h('div', null,
      h('div', { class: 'qtop' },
        h('div', { class: 'row' }, h('button', { class: 'x', onclick: quit }, '✕'), h('span', { class: 'f' }, names[s.mode] + ' · ' + (i + 1) + ' / ' + Q.length), left != null ? timerEl : null,
          h('button', { class: 'x', title: 'Xato haqida xabar', onclick: () => reportQ(q) }, '⚑')),
        h('div', { class: 'bar g', style: 'margin-top:10px' }, h('i', { style: 'width:' + (100 * i / Q.length) + '%;background:var(--blue)' }))),
      h('div', { class: 'wrap', style: 'padding-top:8px' }, body), foot ? h('div', { class: 'foot' }, foot) : null));
    window.scrollTo(0, same ? y : 0);
  }
  function draw() {
    document.querySelectorAll('.nav').forEach(x => x.remove()); document.body.classList.add('noscroll-pad');
    const q = Q[i];
    if (q.kind === 'test') drawTest(q); else if (q.kind === 'match') drawMatch(q); else drawCard(q);
  }
  function drawTest(q) {
    // "A va B javoblar to‘g‘ri", "barchasi" kabi variantlar bo‘lsa, tartib aralashtirilmaydi
    const fixed = q.o.some(o => /javob|barcha|hammasi|yuqoridagi|\b[A-D] va [A-D]\b/i.test(o));
    const order = q._o || (q._o = fixed ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]));
    let st = { sel: null, res: null };
    const render = () => frame([
      h('div', { class: 'qcard' }, h('div', { class: 'tag' }, 'Test'), h('div', { class: 'q' }, q.q), q.img ? h('img', { src: '/media/' + q.img }) : null),
      order.map((oi, k) => {
        let cls = 'opt';
        if (st.res) { cls += ' lock'; if (oi === st.res.right) cls += ' ok'; else if (oi === st.sel) cls += ' bad'; }
        else if (st.sel === oi) cls += ' sel lock'; else if (st.sel != null) cls += ' lock';
        return h('button', { class: cls, onclick: () => choose(oi) }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', null, q.o[oi]));
      }),
      st.res ? h('div', { class: 'fb ' + (st.res.ok ? 'ok' : 'bad') }, st.res.ok ? '✓ To‘g‘ri! +' + st.res.pts + ' ball' : '✕ Noto‘g‘ri. To‘g‘ri javob: ' + q.o[st.res.right]) : null,
    ], st.res ? h('button', { class: 'btn', onclick: next }, i + 1 < Q.length ? 'Keyingi savol →' : 'Yakunlash') : null);
    const choose = guard(async oi => {
      if (st.sel != null) return; st.sel = oi; haptic(); render();
      try {
        const r = await api('/answer', { sid: s.sid, qid: q.id, a: oi });
        if (s.reveal) { st.res = r; haptic(r.ok ? 'ok' : 'bad'); render(); } else setTimeout(next, 220);
      } catch (e) { if (e.status === 402) { clearInterval(S.timer); done = true; return limitView(e.message); } if (e.status === 410) return finish(); st.sel = null; render(); throw e; }
    });
    render();
  }
  function drawMatch(q) {
    const st = { pick: Array(q.l.length).fill(null), act: 0, res: null, busy: false };
    const L = 'abcdefgh';
    const render = () => frame([
      h('div', { class: 'qcard' }, h('div', { class: 'tag' }, 'Moslashtirish'), h('div', { class: 'q' }, q.t),
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
      st.res ? h('div', { class: 'fb ' + (st.res.ok ? 'ok' : 'bad') }, st.res.ok ? '✓ Hammasi to‘g‘ri! +' + st.res.pts + ' ball' : 'To‘g‘ri juftliklar: ' + st.pick.filter((p, k) => p === st.res.right[k]).length + ' / ' + q.l.length + ' · +' + st.res.pts + ' ball') : null,
    ], st.res ? h('button', { class: 'btn', onclick: next }, i + 1 < Q.length ? 'Keyingi →' : 'Yakunlash')
      : h('button', { class: 'btn y', disabled: st.pick.includes(null) || st.busy, onclick: guard(async () => {
        st.busy = true;
        const r = await api('/answer', { sid: s.sid, qid: q.id, a: st.pick });
        if (s.reveal) { st.res = r; haptic(r.ok ? 'ok' : 'bad'); render(); } else next();
      }) }, 'Tekshirish'));
    render();
  }
  function drawCard(q) {
    let open = false;
    const send = k => guard(async () => { await api('/answer', { sid: s.sid, qid: q.id, a: k }); haptic(k ? 'ok' : 'bad'); next(); });
    const render = () => frame([
      h('div', { class: 'qcard flip' }, h('div', null, h('div', { class: 'tag' }, 'Savol'), h('div', { class: 'q' }, q.q),
        open ? h('div', { class: 'ansbox' }, h('div', { class: 'sm mute bold', style: 'margin-bottom:4px' }, 'JAVOB'), q.a) : null)),
      !open ? h('div', { class: 'sm mute c mt' }, 'Avval javobni o‘zingiz ayting yoki yozib ko‘ring, so‘ng tekshiring') : null,
    ], open ? h('div', { class: 'row' }, h('button', { class: 'btn w f', onclick: send(0) }, '✕ Bilmadim'), h('button', { class: 'btn g f', onclick: send(1) }, '✓ Bildim'))
      : h('button', { class: 'btn', onclick: () => { open = true; render(); } }, 'Javobni ko‘rish'));
    render();
  }
  if (left != null) { tick(); S.timer = setInterval(tick, 1000); }
  i >= Q.length ? finish() : draw();
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
      h('div', { class: 'ring', style: '--p:' + pct + '%' }, h('div', null, h('span', null, h('b', null, r.score + '/' + r.total), h('small', null, pct + '% to‘g‘ri')))),
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
  const scopes = [['all', 'Hamma'], ['grade', S.me.user.grade + '-sinf'], ...S.me.groups.map(g => ['g' + g.id, g.name])];
  show(h('div', null, h('div', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/static/logo-white.png' }), h('span', { class: 'pill' }, r.me.rank ? 'Siz: ' + r.me.rank + '-o‘rin' : 'Hali reytingda yo‘qsiz')),
    h('h1', null, 'Reyting'), h('div', { class: 'sub' }, 'Eng faol va bilimdon o‘quvchilar')),
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs' }, [['week', 'Hafta'], ['month', 'Oy'], ['all', 'Umumiy']].map(([k, t]) => h('button', { class: k === period ? 'on' : '', onclick: guard(() => topView(k, scope)) }, t))),
      h('div', { class: 'chips mt' }, scopes.map(([k, t]) => h('button', { class: 'chip' + (k === scope ? ' on' : ''), onclick: guard(() => topView(period, k)) }, t))),
      h('div', { class: 'mt' }),
      r.rows.length ? h('div', { class: 'list' }, r.rows.map(x => h('div', { class: 'li' + (x.me ? ' me' : '') },
        h('div', { class: 'n', style: x.rank <= 3 ? 'background:none;font-size:22px' : '' }, x.rank <= 3 ? '🥇🥈🥉'.slice((x.rank - 1) * 2, x.rank * 2) : x.rank),
        h('div', { class: 't' }, h('b', null, x.name), h('small', null, (x.grade ? x.grade + '-sinf' : '') + (x.level ? ' · ' + x.level : ''))),
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
  show(h('div', null, header('Bellashuv', d.is_member ? d.total + ' ta savol · har biriga 30 soniya' : (d.host || 'O‘quvchi') + ' sizni bellashuvga chaqirdi', () => go('duel')),
    h('div', { class: 'wrap' },
      d.is_member ? duelCard(d) : h('div', { class: 'card c' }, h('div', { style: 'font-size:44px' }, '⚔️'), h('p', { class: 'bold' }, d.can_join ? d.total + ' ta savol. Tayyormisiz?' : 'Bu bellashuvda joy qolmagan')),
      (d.is_member && !d.played) || (!d.is_member && d.can_join) ? h('button', { class: 'btn y mt2', onclick: () => startSession({ mode: 'duel', duel: code }) }, 'Boshlash →') : null,
      d.is_member && !d.other.name ? h('button', { class: 'btn w mt', onclick: share }, '📨 Do‘stga havola yuborish') : null,
      h('button', { class: 'btn ghost mt', onclick: () => go('duel') }, 'Orqaga'))), false);
}

/* ---------------- profil ---------------- */
async function profile() {
  S.me = await api('/me');
  const { user: u, level: L } = S.me;
  back(null);
  const role = { user: 'Mehmon', student: 'Adab School o‘quvchisi', teacher: 'O‘qituvchi', admin: 'Administrator' }[u.role];
  const join = guard(async () => { const c = prompt('O‘qituvchi bergan guruh kodini kiriting:'); if (!c) return; const r = await api('/join', { code: c }); toast('«' + r.name + '» guruhiga qo‘shildingiz'); profile(); });
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
        h('button', { class: 'li', onclick: () => onboarding(true) }, h('div', { class: 'n' }, '🎓'), h('div', { class: 't' }, h('b', null, 'Sinf'), h('small', null, u.grade + '-sinf')), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: join }, h('div', { class: 'n' }, '👥'), h('div', { class: 't' }, h('b', null, 'Guruhga qo‘shilish'), h('small', null, S.me.groups.length ? S.me.groups.map(g => g.name).join(', ') : 'O‘qituvchi kodi orqali')), h('span', { class: 'mute' }, '›')),
        h('button', { class: 'li', onclick: guard(async () => { await api('/me', { remind: !u.remind }); profile(); }) }, h('div', { class: 'n' }, '🔔'), h('div', { class: 't' }, h('b', null, 'Kunlik eslatma'), h('small', null, 'Har kuni kechqurun bot eslatadi')), h('span', { class: 'badge ' + (u.remind ? 'g' : 'm') }, u.remind ? 'yoqilgan' : 'o‘chiq'))),
      h('div', { class: 'mt2 c sm mute' }, 'ID: ' + u.id))), true);
}

/* ---------------- o'qituvchi ---------------- */
async function teacherHome() {
  const gs = await api('/t/groups');
  const add = guard(async () => { const n = prompt('Yangi guruh nomi (masalan: 8-A tarix):'); if (!n) return; await api('/t/group', { name: n }); teacherHome(); });
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
  show(h('div', null, header(g.name, 'Guruh kodi: ' + g.code + ' · ' + g.members.length + ' o‘quvchi', () => teacherHome()),
    h('div', { class: 'wrap' },
      h('button', { class: 'btn y', onclick: newHw }, '+ Uyga vazifa berish'),
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
async function adminTopics(grade) {
  const T = await loadTopics(); grade = grade || T.grades[0];
  show(h('div', null, header('Savollar', 'Mavzuni tanlang', () => guard(adminHome)()),
    h('div', { class: 'wrap' }, h('div', { class: 'chips' }, T.grades.map(g => h('button', { class: 'chip' + (g === grade ? ' on' : ''), onclick: () => adminTopics(g) }, g + '-sinf'))),
      h('div', { class: 'list mt' }, T.topics.filter(t => t.grade === grade).map(t => h('button', { class: 'li', onclick: guard(() => adminQuestions(t, 'test')) },
        h('div', { class: 't' }, h('b', null, t.num + '. ' + t.title), h('small', null, SUBJ[t.subj] + ' · ' + t.tests + ' test · ' + t.matches + ' moslashtirish · ' + t.cards + ' savol')), h('span', { class: 'mute' }, '›')))))));
}
async function adminQuestions(t, kind) {
  const qsn = await api('/a/questions?topic=' + t.id + '&kind=' + kind);
  show(h('div', null, header(t.title, t.grade + '-sinf · ' + SUBJ[t.subj], () => adminTopics(t.grade)),
    h('div', { class: 'wrap' }, h('div', { class: 'tabs' }, [['test', 'Testlar'], ['match', 'Moslashtirish'], ['card', 'Savol-javob']].map(([k, n]) => h('button', { class: k === kind ? 'on' : '', onclick: guard(() => adminQuestions(t, k)) }, n))),
      h('div', { class: 'list mt' }, qsn.map(q => h('button', { class: 'li', style: q.active ? '' : 'opacity:.45', onclick: () => qEditor(q, guard(() => adminQuestions(t, kind))) },
        h('div', { class: 'n' }, q.n), h('div', { class: 't' }, h('b', null, q.data.q || q.data.t), h('small', null, kind === 'test' ? '✓ ' + q.data.o[q.data.a] : kind === 'card' ? q.data.a : q.data.l.length + ' juftlik')), q.data.img ? h('span', null, '🖼') : null))))));
}
function adminUsers(q) {
  let box;
  const load = guard(async () => {
    const us = await api('/a/users?q=' + encodeURIComponent(q || ''));
    box.replaceChildren(...us.map(u => h('div', { class: 'li' }, h('div', { class: 't' }, h('b', null, u.name + (u.username ? ' · @' + u.username : '')), h('small', null, (u.grade ? u.grade + '-sinf · ' : '') + u.xp + ' ball' + (u.phone ? ' · ' + u.phone : ''))),
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
