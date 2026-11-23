/* Mapování – trénink · vanilla JS PWA */
'use strict';

/* ---------- Konstanty ---------- */
const STORE_KEY = 'mapovani_t3t5_v1';
const XP_PER_LEVEL = 120;
const DAILY_GOAL = 30;
const MAX_TESTS = 200;
const LEVELS = [
  'Čerstvý prvák', 'Nosič výtyčky', 'Figurant', 'Zapisovatel', 'Měřický pomocník',
  'Polygonář', 'Tachymetrista', 'Výpočtář', 'Mapér', 'Geodet', 'Zkušený geodet',
  'Úřední oprávněný', 'Mistr mapování'
];
const SET_NAMES = {
  'T3-ucitel': 'T3 učitel', 'T3-tip': 'T3 tipované',
  'T5-ucitel': 'T5 učitel', 'T5-tip': 'T5 tipované', 'T5-tip2': 'T5 další tip.'
};
const COUNT_OPTS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
const BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
const ALL_SETS = [...new Set(QUESTIONS.map(q => q.set))];

/* ---------- Pomocné ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (c, n) => n ? Math.round(c / n * 100) : 0;
const fmtTime = ms => { const s = Math.round(ms / 1000); const m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const fmtNum = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = ts => new Date(ts).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
// Ve výběru odpovědí sjednotíme jen koncovou tečku, aby neprozrazovala správnou možnost (znění se nemění).
const optText = s => String(s).replace(/\.\s*$/, '');
const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

/* ---------- Úložiště ---------- */
function defaultState() {
  return {
    v: 1,
    tests: [],        // {ts, tests:[..], n, c, ms, bySet:{set:[c,n]}}
    sims: [],         // {ts, test, score, n}
    q: {},            // id: [správně, pokusů, naposledy špatně (0/1)]
    leitner: {},      // id: krabička 0–4
    stars: {},        // id: true (uživatelem označené slabé místo)
    xp: 0,
    days: {},         // 'YYYY-MM-DD': počet zodpovězených
    rapidBest: 0,
    prefs: { tests: ['T3'], sets: null, topics: null, weakOnly: false, wrongOnly: false, count: 20, fast: false }
  };
}
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const d = JSON.parse(raw);
    const base = defaultState();
    return { ...base, ...d, prefs: { ...base.prefs, ...(d.prefs || {}) } };
  } catch (e) { return defaultState(); }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Nepodařilo se uložit data (úložiště je plné nebo zakázané).'); }
}

/* ---------- Motivace ---------- */
function levelInfo(xp = S.xp) {
  const lvl = Math.floor(xp / XP_PER_LEVEL);
  return { lvl: lvl + 1, name: LEVELS[Math.min(lvl, LEVELS.length - 1)], into: xp % XP_PER_LEVEL };
}
function addXp(n) {
  const before = levelInfo().lvl;
  S.xp += n;
  const after = levelInfo();
  if (after.lvl > before) toast(`🎉 Nová úroveň ${after.lvl}: ${after.name}`);
}
function countAnswer() {
  const k = todayKey();
  const before = S.days[k] || 0;
  S.days[k] = before + 1;
  if (before + 1 === DAILY_GOAL) toast('🎯 Denní cíl splněn!');
}
function streak() {
  let n = 0; const d = new Date();
  if (!S.days[todayKey(d)]) d.setDate(d.getDate() - 1); // dnešek ještě může přijít
  while (S.days[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function recordQ(id, correct, countAttempt = true) {
  const r = S.q[id] || [0, 0, 0];
  if (countAttempt) r[1]++;
  if (correct === true) { r[0]++; r[2] = 0; }
  else if (correct === false) r[2] = 1;
  S.q[id] = r;
}
const isWeak = q => q.weak || !!S.stars[q.id];

/* ---------- UI základ ---------- */
let cleanup = null;       // úklid aktuální obrazovky (timery)
let backTarget = null;
function setScreen(title, html, { back = 'home', right = '' } = {}) {
  if (cleanup) { cleanup(); cleanup = null; }
  $('#title').textContent = title;
  $('#topRight').textContent = right;
  backTarget = back;
  $('#backBtn').hidden = !back;
  const app = $('#app');
  app.innerHTML = html;
  window.scrollTo(0, 0);
  return app;
}
$('#backBtn').addEventListener('click', () => {
  if (typeof backTarget === 'function') backTarget();
  else if (backTarget && SCREENS[backTarget]) SCREENS[backTarget]();
});
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function confirmTap(btn, label, action) {
  // potvrzení dvojím klepnutím
  let armed = false, timer;
  const orig = btn.textContent;
  btn.addEventListener('click', () => {
    if (armed) { clearTimeout(timer); armed = false; btn.textContent = orig; action(); return; }
    armed = true; btn.textContent = label;
    timer = setTimeout(() => { armed = false; btn.textContent = orig; }, 3500);
  });
}

/* ---------- Domů ---------- */
function home() {
  const L = levelInfo();
  const today = S.days[todayKey()] || 0;
  const st = streak();
  const tests = S.tests.length;
  const avg = tests ? Math.round(S.tests.reduce((a, t) => a + pct(t.c, t.n), 0) / tests) : 0;
  const app = setScreen('Mapování – trénink', `
    <section class="card">
      <div class="level">
        <div class="badge">${L.lvl}</div>
        <div class="grow" style="flex:1">
          <b>${esc(L.name)}</b>
          <div class="muted small">${S.xp} XP · do další úrovně ${XP_PER_LEVEL - L.into} XP</div>
          <div class="bar"><i style="width:${L.into / XP_PER_LEVEL * 100}%"></i></div>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="small">Denní cíl: <b>${Math.min(today, DAILY_GOAL)}/${DAILY_GOAL}</b> ${today >= DAILY_GOAL ? '✅' : ''}</div>
      <div class="bar good"><i style="width:${Math.min(100, today / DAILY_GOAL * 100)}%"></i></div>
      <div class="stats-mini">
        <div><b>🔥 ${st}</b><span>${plural(st, 'den', 'dny', 'dní')} v řadě</span></div>
        <div><b>${tests}</b><span>testů</span></div>
        <div><b>${avg} %</b><span>průměr</span></div>
      </div>
    </section>
    <nav class="menu">
      <button class="menu-item wide" data-go="mc"><span class="ico">✅</span><b>Test s výběrem odpovědí</b><span class="d">Hlavní režim · 4 možnosti · stopky</span></button>
      <button class="menu-item" data-go="learn"><span class="ico">✍️</span><b>Učení s nápovědou</b><span class="d">Píšeš nebo diktuješ</span></button>
      <button class="menu-item" data-go="cards"><span class="ico">🗂️</span><b>Kartičky</b><span class="d">Leitnerův systém</span></button>
      <button class="menu-item" data-go="rapid"><span class="ico">⚡</span><b>Rychlovka</b><span class="d">60 s · rekord ${S.rapidBest}</span></button>
      <button class="menu-item" data-go="sim"><span class="ico">📝</span><b>Simulace testu</b><span class="d">10 otázek, bodování</span></button>
      <button class="menu-item" data-go="stats"><span class="ico">📊</span><b>Statistiky</b><span class="d">Výsledky a chyby</span></button>
      <button class="menu-item" data-go="backup"><span class="ico">💾</span><b>Záloha</b><span class="d">Export / import</span></button>
    </nav>
    <p class="muted small center">${QUESTIONS.length} otázek · Test 3: ${QUESTIONS.filter(q => q.test === 'T3').length} · Test 5: ${QUESTIONS.filter(q => q.test === 'T5').length}</p>
  `, { back: null });
  $$('[data-go]', app).forEach(b => b.addEventListener('click', () => {
    const g = b.dataset.go;
    if (['mc', 'learn', 'cards', 'rapid'].includes(g)) setup(g); else SCREENS[g]();
  }));
}

/* ---------- Výběr otázek (filtr) ---------- */
function filtered(p = S.prefs) {
  return QUESTIONS.filter(q =>
    p.tests.includes(q.test) &&
    (!p.sets || p.sets.includes(q.set)) &&
    (!p.topics || p.topics.includes(q.topic)) &&
    (!p.weakOnly || isWeak(q)) &&
    (!p.wrongOnly || (S.q[q.id] && S.q[q.id][2]))
  );
}
const MODE_INFO = {
  mc: { title: 'Test s výběrem', start: 'Spustit test', count: true },
  learn: { title: 'Učení s nápovědou', start: 'Začít učení', count: true },
  cards: { title: 'Kartičky', start: 'Začít kartičky', count: false },
  rapid: { title: 'Rychlovka', start: 'Start (60 s)', count: false }
};
function setup(mode) {
  const p = S.prefs;
  const info = MODE_INFO[mode];
  const app = setScreen(info.title, '<div id="setupBody"></div>');
  const body = $('#setupBody', app);

  function render() {
    const setsAvail = ALL_SETS.filter(s => p.tests.includes(s.slice(0, 2)));
    const activeSets = p.sets ? setsAvail.filter(s => p.sets.includes(s)) : setsAvail;
    const topicsAvail = [...new Set(QUESTIONS.filter(q => activeSets.includes(q.set)).map(q => q.topic))];
    const pool = filtered();
    const max = pool.length;
    const cnt = Math.min(p.count, max) || max;
    body.innerHTML = `
      <section class="card">
        <h2>Test</h2>
        <div class="chips" id="testChips">
          ${[['T3', 'Test 3'], ['T5', 'Test 5'], ['ALL', 'Oba']].map(([k, l]) => {
            const on = k === 'ALL' ? p.tests.length === 2 : (p.tests.length === 1 && p.tests[0] === k);
            return `<button class="chip" data-test="${k}" aria-pressed="${on}">${l}</button>`;
          }).join('')}
        </div>
        <h3>Sady</h3>
        <div class="chip-actions"><button class="linkbtn" data-all="sets">Vše</button><button class="linkbtn" data-none="sets">Nic</button></div>
        <div class="chips">
          ${setsAvail.map(s => `<button class="chip" data-set="${s}" aria-pressed="${activeSets.includes(s)}">${esc(SET_NAMES[s] || s)}<span class="cnt">${QUESTIONS.filter(q => q.set === s).length}</span></button>`).join('')}
        </div>
        <h3>Okruhy</h3>
        <div class="chip-actions"><button class="linkbtn" data-all="topics">Vše</button><button class="linkbtn" data-none="topics">Nic</button></div>
        <div class="chips">
          ${topicsAvail.map(t => `<button class="chip" data-topic="${esc(t)}" aria-pressed="${!p.topics || p.topics.includes(t)}">${esc(t)}<span class="cnt">${QUESTIONS.filter(q => q.topic === t && activeSets.includes(q.set)).length}</span></button>`).join('')}
        </div>
        <div class="spacer"></div>
        <label class="toggle"><span><span class="star">★</span> Jen slabá místa</span><input type="checkbox" id="weakOnly" ${p.weakOnly ? 'checked' : ''}></label>
        <label class="toggle"><span>Jen to, co jsem pokazil</span><input type="checkbox" id="wrongOnly" ${p.wrongOnly ? 'checked' : ''}></label>
        ${mode === 'mc' ? `<label class="toggle"><span>Rychlý režim <span class="muted small">(po správné odpovědi dál za 0,6 s)</span></span><input type="checkbox" id="fast" ${p.fast ? 'checked' : ''}></label>` : ''}
      </section>
      ${info.count ? `
      <section class="card">
        <div class="row"><h2 class="grow" style="margin:0">Počet otázek</h2><span class="count-big" id="cntLbl">${cnt}</span></div>
        <div class="spacer"></div>
        <div class="chips">
          ${COUNT_OPTS.filter(n => n < max).map(n => `<button class="chip" data-count="${n}" aria-pressed="${cnt === n}">${n}</button>`).join('')}
          <button class="chip" data-count="${max}" aria-pressed="${cnt === max}">Všechny (${max})</button>
        </div>
        ${max > 1 ? `<input type="range" id="countRange" min="1" max="${max}" value="${cnt}" aria-label="Počet otázek">` : ''}
      </section>` : `<p class="muted center">Vybráno otázek: <b>${max}</b></p>`}
      <button class="btn primary block" id="startBtn" ${max ? '' : 'disabled'}>${max ? info.start : 'Žádné otázky neodpovídají filtru'}</button>
    `;
    bind();
  }
  function bind() {
    $$('[data-test]', body).forEach(b => b.onclick = () => {
      p.tests = b.dataset.test === 'ALL' ? ['T3', 'T5'] : [b.dataset.test];
      p.sets = null; p.topics = null; save(); render();
    });
    $$('[data-set]', body).forEach(b => b.onclick = () => {
      const setsAvail = ALL_SETS.filter(s => p.tests.includes(s.slice(0, 2)));
      let cur = p.sets ? setsAvail.filter(s => p.sets.includes(s)) : setsAvail.slice();
      const s = b.dataset.set;
      cur = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
      p.sets = cur.length === setsAvail.length ? null : cur;
      p.topics = null; save(); render();
    });
    $$('[data-topic]', body).forEach(b => b.onclick = () => {
      const all = $$('[data-topic]', body).map(x => x.dataset.topic);
      let cur = p.topics ? all.filter(t => p.topics.includes(t)) : all.slice();
      const t = b.dataset.topic;
      cur = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
      p.topics = cur.length === all.length ? null : cur;
      save(); render();
    });
    $$('[data-all]', body).forEach(b => b.onclick = () => { if (b.dataset.all === 'sets') { p.sets = null; p.topics = null; } else p.topics = null; save(); render(); });
    $$('[data-none]', body).forEach(b => b.onclick = () => { if (b.dataset.none === 'sets') { p.sets = []; p.topics = null; } else p.topics = []; save(); render(); });
    $('#weakOnly', body).onchange = e => { p.weakOnly = e.target.checked; save(); render(); };
    $('#wrongOnly', body).onchange = e => { p.wrongOnly = e.target.checked; save(); render(); };
    const fast = $('#fast', body); if (fast) fast.onchange = e => { p.fast = e.target.checked; save(); };
    $$('[data-count]', body).forEach(b => b.onclick = () => { p.count = +b.dataset.count; save(); render(); });
    const r = $('#countRange', body);
    if (r) {
      r.oninput = () => {
        $('#cntLbl', body).textContent = r.value;
        $$('[data-count]', body).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.count === +r.value)));
      };
      r.onchange = () => { p.count = +r.value; save(); };
    }
    $('#startBtn', body).onclick = () => {
      const pool = filtered();
      if (!pool.length) return;
      if (mode === 'mc') startQuiz(shuffle(pool).slice(0, Math.min(p.count, pool.length) || pool.length));
      else if (mode === 'learn') startLearn(shuffle(pool).slice(0, Math.min(p.count, pool.length) || pool.length));
      else if (mode === 'cards') startCards(pool);
      else if (mode === 'rapid') startRapid(pool);
    };
  }
  render();
}

/* ---------- Test s výběrem ---------- */
function makeOptions(q) {
  return shuffle([{ t: q.a, ok: true }, ...q.wrong.map(w => ({ t: w, ok: false }))]);
}
function starBtn(q) {
  const on = !!S.stars[q.id];
  return `<button class="star-btn ${on || q.weak ? 'on' : ''}" data-star="${q.id}" ${q.weak ? 'disabled title="Slabé místo podle PDF"' : ''}>${on || q.weak ? '★ slabé místo' : '☆ označit jako slabé'}</button>`;
}
function bindStar(root) {
  $$('[data-star]', root).forEach(b => b.onclick = () => {
    const id = b.dataset.star;
    if (S.stars[id]) delete S.stars[id]; else S.stars[id] = true;
    save();
    b.classList.toggle('on', !!S.stars[id]);
    b.textContent = S.stars[id] ? '★ slabé místo' : '☆ označit jako slabé';
  });
}
function startQuiz(list) {
  const run = { list, i: 0, answers: [], start: Date.now(), tests: [...new Set(list.map(q => q.test))] };
  let tick = setInterval(() => { $('#topRight').textContent = '⏱ ' + fmtClock(Date.now() - run.start); }, 500);
  let autoTimer = null;
  const backToSetup = () => setup('mc');

  function show() {
    const q = run.list[run.i];
    const opts = makeOptions(q);
    const app = setScreen('Test s výběrem', `
      <div class="progress-line"><span>Otázka ${run.i + 1} / ${run.list.length}</span><span>✔ ${run.answers.filter(a => a.ok).length}</span></div>
      <div class="bar"><i style="width:${run.i / run.list.length * 100}%"></i></div>
      <div class="spacer"></div>
      <section class="card">
        <div class="qmeta"><span>${q.id}</span><span>·</span><span>${esc(SET_NAMES[q.set])}</span><span>·</span><span>${esc(q.topic)}</span>${isWeak(q) ? '<span class="star">★</span>' : ''}</div>
        <p class="qtext">${esc(q.q)}</p>
        <div class="options">
          ${opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(optText(o.t))}</span></button>`).join('')}
        </div>
        <div id="fb"></div>
      </section>
      <div id="nextWrap"></div>
    `, { back: backToSetup, right: '⏱ ' + fmtClock(Date.now() - run.start) });
    cleanup = () => { clearInterval(tick); clearTimeout(autoTimer); };

    $$('.opt', app).forEach(b => b.onclick = () => {
      const k = +b.dataset.k, chosen = opts[k], ok = chosen.ok;
      $$('.opt', app).forEach((x, j) => { x.disabled = true; if (opts[j].ok) x.classList.add('correct'); });
      if (!ok) b.classList.add('wrong');
      run.answers.push({ id: q.id, ok, chosen: chosen.t });
      recordQ(q.id, ok); countAnswer(); if (ok) addXp(2); save();
      $('#fb', app).innerHTML = `
        <div class="feedback ${ok ? 'ok' : 'ko'}">
          <div class="lbl">${ok ? '✔ Správně' : '✘ Špatně'}</div>
          <div><b>Odpověď:</b> ${esc(q.a)}</div>
          ${q.note ? `<div class="note"><b>Poznámka:</b> ${esc(q.note)}</div>` : ''}
          <div>${starBtn(q)}</div>
        </div>`;
      bindStar(app);
      const last = run.i === run.list.length - 1;
      $('#nextWrap', app).innerHTML = `<button class="btn primary block sticky-next" id="nextBtn">${last ? 'Vyhodnotit' : 'Další otázka ›'}</button>`;
      const next = () => { clearTimeout(autoTimer); run.i++; if (run.i < run.list.length) show(); else finish(); };
      $('#nextBtn', app).onclick = next;
      if (ok && S.prefs.fast) autoTimer = setTimeout(next, 600);
      else $('#nextBtn', app).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  function finish() {
    clearInterval(tick);
    const ms = Date.now() - run.start;
    const n = run.answers.length, c = run.answers.filter(a => a.ok).length;
    const bySet = {};
    run.answers.forEach(a => { const s = BY_ID[a.id].set; bySet[s] = bySet[s] || [0, 0]; bySet[s][1]++; if (a.ok) bySet[s][0]++; });
    const prevBest = bestPerfectPerQ();
    const rec = { ts: Date.now(), tests: run.tests, n, c, ms, bySet };
    S.tests.push(rec); if (S.tests.length > MAX_TESTS) S.tests = S.tests.slice(-MAX_TESTS);
    save();
    showResult(rec, run.answers, prevBest);
  }
  show();
}
function bestPerfectPerQ() {
  const p = S.tests.filter(t => t.c === t.n && t.n > 0).map(t => t.ms / 1000 / t.n);
  return p.length ? Math.min(...p) : null;
}
function showResult(rec, answers, prevBest) {
  const p = pct(rec.c, rec.n);
  const perQ = rec.ms / 1000 / rec.n;
  const wrong = answers.filter(a => !a.ok);
  let cmp = '';
  if (rec.c === rec.n) {
    if (prevBest == null) cmp = '🏁 První test na 100 %!';
    else if (perQ < prevBest) cmp = `🏆 Nový rekord! Předchozí nejlepší ${fmtNum(prevBest)} s/otázka.`;
    else cmp = `Nejlepší čas u 100% testů: ${fmtNum(prevBest)} s/otázka (o ${fmtNum(perQ - prevBest)} s pomalejší).`;
  } else if (prevBest != null) cmp = `Nejlepší čas u 100% testů: ${fmtNum(prevBest)} s/otázka.`;
  const app = setScreen('Výsledek testu', `
    <section class="card center">
      <div class="score-big ${p === 100 ? 'ok' : p >= 70 ? 'mid' : 'ko'}">${p} %</div>
      <div><b>${rec.c}</b> správně z <b>${rec.n}</b></div>
    </section>
    <section class="card">
      <div class="kv">
        <span>Celkový čas</span><span>${fmtTime(rec.ms)}</span>
        <span>Čas na otázku</span><span>${fmtNum(perQ)} s</span>
      </div>
      ${cmp ? `<p class="small muted" style="margin-bottom:0">${cmp}</p>` : ''}
    </section>
    <section class="card">
      <h2>Podle sad</h2>
      ${Object.entries(rec.bySet).map(([s, [c, n]]) => rateRow(SET_NAMES[s] || s, c, n)).join('')}
    </section>
    ${wrong.length ? `
    <section class="card">
      <h2>Chyby (${wrong.length})</h2>
      <ul class="list">
        ${wrong.map(a => { const q = BY_ID[a.id]; return `<li class="mistake"><div class="q">${esc(q.q)}</div><div class="mine">✘ ${esc(a.chosen)}</div><div class="right">✔ ${esc(q.a)}</div></li>`; }).join('')}
      </ul>
    </section>` : ''}
    <div class="btn-grid">
      <button class="btn bad" id="retryBtn" ${wrong.length ? '' : 'disabled'}>Opakovat jen chyby</button>
      <button class="btn primary" id="newBtn">Nový test</button>
    </div>
    <div class="spacer"></div>
    <button class="btn block" id="homeBtn">Domů</button>
  `, { back: 'home' });
  $('#retryBtn', app).onclick = () => startQuiz(shuffle(wrong.map(a => BY_ID[a.id])));
  $('#newBtn', app).onclick = () => setup('mc');
  $('#homeBtn', app).onclick = home;
}
function rateRow(label, c, n) {
  const p = pct(c, n);
  return `<div style="margin:8px 0">
    <div class="rate-row"><span class="lbl">${esc(label)}</span><span class="val">${c}/${n} · ${p} %</span></div>
    <div class="bar ${p >= 80 ? 'good' : ''}"><i style="width:${p}%"></i></div></div>`;
}

/* ---------- Učení s nápovědou ---------- */
function maskedHint(answer, words) {
  const parts = answer.split(/(\s+)/);
  let shown = 0;
  return parts.map(p => {
    if (/^\s+$/.test(p)) return p;
    shown++;
    return shown <= words ? esc(p) : '•'.repeat(Math.min(p.length, 8));
  }).join('');
}
function speechBtnHtml() {
  return (window.SpeechRecognition || window.webkitSpeechRecognition) ? '<button class="btn small" id="micBtn" type="button">🎤 Diktovat</button>' : '';
}
function bindSpeech(app, textarea) {
  const btn = $('#micBtn', app);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!btn || !SR) return () => {};
  let rec = null;
  btn.onclick = () => {
    if (rec) { rec.stop(); return; }
    try {
      rec = new SR(); rec.lang = 'cs-CZ'; rec.interimResults = false; rec.continuous = false;
      rec.onresult = e => { const t = [...e.results].map(r => r[0].transcript).join(' '); textarea.value = (textarea.value ? textarea.value.trimEnd() + ' ' : '') + t; };
      rec.onerror = () => toast('Diktování nefunguje – použij mikrofon na klávesnici.');
      rec.onend = () => { rec = null; btn.textContent = '🎤 Diktovat'; };
      rec.start(); btn.textContent = '⏹ Zastavit';
    } catch (e) { rec = null; toast('Diktování nefunguje – použij mikrofon na klávesnici.'); }
  };
  return () => { try { rec && rec.abort(); } catch (e) {} };
}
function startLearn(list) {
  const queue = list.slice();
  let done = 0, stats = { know: 0, almost: 0, no: 0 };
  const total = list.length;
  function show() {
    if (!queue.length) return finish();
    const q = queue[0];
    let hintWords = 0;
    const app = setScreen('Učení s nápovědou', `
      <div class="progress-line"><span>Hotovo ${done} / ${total}</span><span>Ve frontě ${queue.length}</span></div>
      <div class="bar"><i style="width:${done / total * 100}%"></i></div>
      <div class="spacer"></div>
      <section class="card">
        <div class="qmeta"><span>${q.id}</span><span>·</span><span>${esc(q.topic)}</span>${isWeak(q) ? '<span class="star">★</span>' : ''}</div>
        <p class="qtext">${esc(q.q)}</p>
        <textarea id="ans" lang="cs" placeholder="Napiš odpověď (nebo diktuj mikrofonem na klávesnici)…" autocapitalize="sentences" spellcheck="true"></textarea>
        <div class="row" style="margin-top:10px">${speechBtnHtml()}</div>
        <div id="hint"></div>
        <div id="reveal"></div>
      </section>
      <div id="actions" class="btn-grid">
        <button class="btn" id="hintBtn">💡 Nápověda</button>
        <button class="btn primary" id="showBtn">Ukázat odpověď</button>
      </div>
    `, { back: 'home' });
    const ta = $('#ans', app);
    cleanup = bindSpeech(app, ta);
    const nWords = q.a.split(/\s+/).filter(Boolean).length;
    $('#hintBtn', app).onclick = () => {
      hintWords = Math.min(nWords, hintWords + 3);
      $('#hint', app).innerHTML = `<div class="hint">${maskedHint(q.a, hintWords)}</div>`;
      if (hintWords >= nWords) $('#hintBtn', app).disabled = true;
    };
    $('#showBtn', app).onclick = () => {
      $('#hint', app).innerHTML = '';
      $('#reveal', app).innerHTML = `
        ${ta.value.trim() ? `<div class="mine-box"><b>Moje odpověď:</b>\n${esc(ta.value.trim())}</div>` : ''}
        <div class="answer-box"><b>Odpověď:</b> ${esc(q.a)}${q.note ? `<div class="note"><b>Poznámka:</b> ${esc(q.note)}</div>` : ''}</div>
        <div>${starBtn(q)}</div>`;
      bindStar(app);
      $('#actions', app).className = 'btn-grid three';
      $('#actions', app).innerHTML = `
        <button class="btn good" data-r="know">Umím</button>
        <button class="btn warn" data-r="almost">Skoro</button>
        <button class="btn bad" data-r="no">Neumím</button>`;
      $$('[data-r]', app).forEach(b => b.onclick = () => rate(b.dataset.r));
      $('#actions', app).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    function rate(r) {
      stats[r]++;
      queue.shift();
      if (r === 'know') { recordQ(q.id, true); addXp(4); done++; }
      else if (r === 'almost') { recordQ(q.id, null); done++; }
      else { recordQ(q.id, false); queue.push(q); }
      countAnswer(); save(); show();
    }
  }
  function finish() {
    const app = setScreen('Učení – hotovo', `
      <section class="card center">
        <div class="score-big ok">✔</div>
        <p>Prošel jsi všech <b>${total}</b> ${plural(total, 'otázku', 'otázky', 'otázek')}.</p>
        <div class="kv" style="text-align:left">
          <span>Umím</span><span>${stats.know}</span>
          <span>Skoro</span><span>${stats.almost}</span>
          <span>Neumím (vráceno do kola)</span><span>${stats.no}</span>
        </div>
      </section>
      <div class="btn-grid"><button class="btn primary" id="again">Další kolo</button><button class="btn" id="homeBtn">Domů</button></div>
    `, { back: 'home' });
    $('#again', app).onclick = () => setup('learn');
    $('#homeBtn', app).onclick = home;
  }
  show();
}

/* ---------- Kartičky (Leitner) ---------- */
function startCards(pool) {
  const box = id => S.leitner[id] ?? 0;
  let deck = [];
  function newRound() {
    // nižší krabičky dřív, uvnitř krabičky náhodně
    deck = shuffle(pool).sort((a, b) => box(a.id) - box(b.id));
  }
  newRound();
  let seen = 0;
  function boxesHtml() {
    const c = [0, 0, 0, 0, 0]; pool.forEach(q => c[box(q.id)]++);
    return `<div class="boxes">${c.map((n, i) => `<div><b>${n}</b>kr. ${i}</div>`).join('')}</div>`;
  }
  function show() {
    if (!deck.length) {
      const app = setScreen('Kartičky', `
        <section class="card center"><h2>Kolo dokončeno 🎉</h2><p>Prošel jsi ${seen} ${plural(seen, 'kartičku', 'kartičky', 'kartiček')}.</p>${boxesHtml()}</section>
        <div class="btn-grid"><button class="btn primary" id="again">Další kolo</button><button class="btn" id="homeBtn">Domů</button></div>`, { back: 'home' });
      $('#again', app).onclick = () => { newRound(); show(); };
      $('#homeBtn', app).onclick = home;
      return;
    }
    const q = deck[0];
    const app = setScreen('Kartičky', `
      ${boxesHtml()}
      <div class="spacer"></div>
      <div class="progress-line"><span>Krabička ${box(q.id)}</span><span>Zbývá ${deck.length}</span></div>
      <div class="flip" id="flip" role="button" tabindex="0" aria-label="Otočit kartičku">
        <div class="flip-inner">
          <div class="face front">
            <div class="qmeta"><span>${q.id}</span><span>·</span><span>${esc(q.topic)}</span>${isWeak(q) ? '<span class="star">★</span>' : ''}</div>
            <p class="qtext">${esc(q.q)}</p>
            <div class="tap">Klepni pro otočení</div>
          </div>
          <div class="face back">
            <div><b>Odpověď:</b> ${esc(q.a)}</div>
            ${q.note ? `<div class="note"><b>Poznámka:</b> ${esc(q.note)}</div>` : ''}
            <div class="tap">Klepni pro otočení zpět</div>
          </div>
        </div>
      </div>
      <div id="actions"><button class="btn primary block" id="flipBtn">Otočit</button></div>
    `, { back: 'home' });
    const flip = $('#flip', app);
    const inner = $('.flip-inner', app);
    // výška karty podle delší strany
    const h = Math.max(...$$('.face', app).map(f => f.scrollHeight), 280);
    inner.style.minHeight = h + 'px';
    const doFlip = () => {
      flip.classList.toggle('on');
      if (flip.classList.contains('on') && !$('[data-r]', app)) {
        $('#actions', app).innerHTML = `<div class="btn-grid three">
          <button class="btn good" data-r="know">Umím</button>
          <button class="btn warn" data-r="almost">Skoro</button>
          <button class="btn bad" data-r="no">Neumím</button></div>`;
        $$('[data-r]', app).forEach(b => b.onclick = () => rate(b.dataset.r));
      }
    };
    flip.onclick = doFlip;
    flip.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doFlip(); } };
    $('#flipBtn', app).onclick = doFlip;
    function rate(r) {
      const b = box(q.id);
      if (r === 'know') { S.leitner[q.id] = Math.min(4, b + 1); recordQ(q.id, true); addXp(4); }
      else if (r === 'almost') { S.leitner[q.id] = b; recordQ(q.id, null); }
      else { S.leitner[q.id] = 0; recordQ(q.id, false); }
      countAnswer(); save();
      deck.shift(); seen++; show();
    }
  }
  show();
}

/* ---------- Rychlovka ---------- */
function startRapid(pool) {
  const DURATION = 60000;
  let score = 0, combo = 0, maxCombo = 0, correct = 0, answered = 0;
  let order = shuffle(pool), idx = 0;
  const end = Date.now() + DURATION;
  let over = false;
  const app = setScreen('Rychlovka', `
    <div class="rapid-head"><span class="big" id="time">60</span><span class="combo" id="combo"></span><span class="big" id="score">0</span></div>
    <div class="bar"><i id="tbar" style="width:100%"></i></div>
    <div class="spacer"></div>
    <section class="card" id="rq"></section>
  `, { back: 'home', right: `🏆 ${S.rapidBest}` });
  const timer = setInterval(() => {
    const left = Math.max(0, end - Date.now());
    $('#time', app).textContent = Math.ceil(left / 1000);
    $('#tbar', app).style.width = (left / DURATION * 100) + '%';
    if (!left) finish();
  }, 100);
  let wait = null;
  cleanup = () => { clearInterval(timer); clearTimeout(wait); };
  function next() {
    if (over) return;
    if (idx >= order.length) { order = shuffle(pool); idx = 0; }
    const q = order[idx++];
    const opts = makeOptions(q);
    const box = $('#rq', app);
    box.className = 'card';
    box.innerHTML = `<p class="qtext">${esc(q.q)}</p><div class="options">
      ${opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(optText(o.t))}</span></button>`).join('')}</div>`;
    $$('.opt', box).forEach(b => b.onclick = () => {
      if (over) return;
      const ok = opts[+b.dataset.k].ok;
      answered++;
      $$('.opt', box).forEach((x, j) => { x.disabled = true; if (opts[j].ok) x.classList.add('correct'); });
      recordQ(q.id, ok); countAnswer();
      if (ok) {
        correct++; combo++; maxCombo = Math.max(maxCombo, combo);
        score += 10 + 5 * Math.min(combo - 1, 10);
        addXp(2);
        box.classList.add('flash-ok');
      } else {
        combo = 0; b.classList.add('wrong'); box.classList.add('flash-ko');
      }
      $('#score', app).textContent = score;
      $('#combo', app).textContent = combo > 1 ? `combo ×${combo}` : '';
      wait = setTimeout(next, ok ? 250 : 900);
    });
  }
  function finish() {
    if (over) return; over = true;
    clearInterval(timer); clearTimeout(wait);
    const record = score > S.rapidBest;
    if (record) S.rapidBest = score;
    save();
    const a2 = setScreen('Rychlovka – konec', `
      <section class="card center">
        <div class="score-big ${record ? 'ok' : 'mid'}">${score}</div>
        <p>${record ? '🏆 Nový rekord!' : `Rekord: ${S.rapidBest}`}</p>
        <div class="kv" style="text-align:left">
          <span>Správně</span><span>${correct} / ${answered}</span>
          <span>Nejdelší combo</span><span>${maxCombo}</span>
        </div>
        <p class="muted small">Body: 10 za správnou + 5 za každou další v řadě (max +50).</p>
      </section>
      <div class="btn-grid"><button class="btn primary" id="again">Znovu</button><button class="btn" id="homeBtn">Domů</button></div>`, { back: 'home' });
    $('#again', a2).onclick = () => startRapid(pool);
    $('#homeBtn', a2).onclick = home;
  }
  next();
}

/* ---------- Simulace testu ---------- */
function sim() {
  const app = setScreen('Simulace testu', `
    <section class="card">
      <h2>Jak to funguje</h2>
      <p>10 náhodných otázek z vybraného testu, vždy aspoň 5 učitelových. Odpovídáš písemně bez nápovědy, na konci porovnáš svou odpověď se vzorovou a ohodnotíš se 0 / 0,5 / 1 bodem.</p>
    </section>
    <div class="btn-grid">
      <button class="btn primary" data-t="T3">Test 3</button>
      <button class="btn primary" data-t="T5">Test 5</button>
    </div>
    ${S.sims.length ? `<div class="spacer"></div><section class="card"><h2>Poslední simulace</h2><ul class="list">${S.sims.slice(-5).reverse().map(s => `<li class="rate-row"><span class="lbl">${s.test === 'T3' ? 'Test 3' : 'Test 5'} · ${fmtDate(s.ts)}</span><span class="val">${fmtNum(s.score, 1)} / ${s.n}</span></li>`).join('')}</ul></section>` : ''}
  `);
  $$('[data-t]', app).forEach(b => b.onclick = () => runSim(b.dataset.t));
}
function runSim(test) {
  const teacherSet = test + '-ucitel';
  const teacher = shuffle(QUESTIONS.filter(q => q.set === teacherSet)).slice(0, 5);
  const rest = shuffle(QUESTIONS.filter(q => q.test === test && !teacher.includes(q))).slice(0, 10 - teacher.length);
  const list = shuffle([...teacher, ...rest]);
  const answers = Array(list.length).fill('');
  let i = 0;
  const start = Date.now();
  function show() {
    const q = list[i];
    const app = setScreen(`Simulace ${test === 'T3' ? 'Testu 3' : 'Testu 5'}`, `
      <div class="progress-line"><span>Otázka ${i + 1} / ${list.length}</span><span></span></div>
      <div class="bar"><i style="width:${i / list.length * 100}%"></i></div>
      <div class="spacer"></div>
      <section class="card">
        <p class="qtext">${esc(q.q)}</p>
        <textarea id="ans" lang="cs" placeholder="Tvoje odpověď…" autocapitalize="sentences" spellcheck="true">${esc(answers[i])}</textarea>
        <div class="row" style="margin-top:10px">${speechBtnHtml()}</div>
      </section>
      <div class="btn-grid">
        <button class="btn" id="prev" ${i ? '' : 'disabled'}>‹ Předchozí</button>
        <button class="btn primary" id="next">${i === list.length - 1 ? 'Odevzdat' : 'Další ›'}</button>
      </div>
    `, { back: () => { answers[i] = $('#ans').value; sim(); }, right: '' });
    const ta = $('#ans', app);
    const stopSpeech = bindSpeech(app, ta);
    const tick = setInterval(() => { $('#topRight').textContent = '⏱ ' + fmtClock(Date.now() - start); }, 500);
    cleanup = () => { clearInterval(tick); stopSpeech(); };
    $('#prev', app).onclick = () => { answers[i] = ta.value; i--; show(); };
    $('#next', app).onclick = () => { answers[i] = ta.value; if (i < list.length - 1) { i++; show(); } else review(); };
  }
  function review() {
    const grades = Array(list.length).fill(null);
    const ms = Date.now() - start;
    const app = setScreen('Simulace – vyhodnocení', `
      <p class="muted">Porovnej svou odpověď se vzorovou a dej si body. Čas: ${fmtTime(ms)}.</p>
      ${list.map((q, k) => `
        <section class="card">
          <div class="qmeta"><span>${k + 1}.</span><span>${q.id}</span><span>·</span><span>${esc(SET_NAMES[q.set])}</span></div>
          <p class="qtext" style="font-size:17px">${esc(q.q)}</p>
          <div class="mine-box"><b>Moje odpověď:</b>\n${answers[k].trim() ? esc(answers[k].trim()) : '<i class="muted">(bez odpovědi)</i>'}</div>
          <div class="answer-box"><b>Vzorová:</b> ${esc(q.a)}${q.note ? `<div class="note">${esc(q.note)}</div>` : ''}</div>
          <div class="sim-grade" data-q="${k}">
            <button class="btn" data-g="0">0</button><button class="btn" data-g="0.5">0,5</button><button class="btn" data-g="1">1</button>
          </div>
        </section>`).join('')}
      <section class="card center"><div class="score-big mid" id="total">0 / 10</div><div class="muted small" id="left">Ohodnoť všech ${list.length} otázek</div></section>
      <button class="btn primary block" id="saveSim" disabled>Uložit výsledek</button>
    `, { back: 'home' });
    const upd = () => {
      const sum = grades.reduce((a, g) => a + (g || 0), 0);
      const left = grades.filter(g => g === null).length;
      $('#total', app).textContent = `${fmtNum(sum, 1).replace(',0', '')} / ${list.length}`;
      $('#left', app).textContent = left ? `Zbývá ohodnotit ${left}` : 'Vše ohodnoceno';
      $('#saveSim', app).disabled = !!left;
    };
    $$('.sim-grade', app).forEach(row => $$('[data-g]', row).forEach(b => b.onclick = () => {
      grades[+row.dataset.q] = +b.dataset.g;
      $$('[data-g]', row).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      upd();
    }));
    $('#saveSim', app).onclick = () => {
      const score = grades.reduce((a, g) => a + g, 0);
      list.forEach((q, k) => { recordQ(q.id, grades[k] === 1 ? true : grades[k] === 0 ? false : null); countAnswer(); if (grades[k] === 1) addXp(4); });
      S.sims.push({ ts: Date.now(), test, score, n: list.length, ms });
      if (S.sims.length > MAX_TESTS) S.sims = S.sims.slice(-MAX_TESTS);
      save();
      toast(`Uloženo: ${fmtNum(score, 1)} / ${list.length}`);
      sim();
    };
  }
  show();
}

/* ---------- Statistiky ---------- */
function chartSvg(tests) {
  const W = 340, H = 160, pl = 30, pr = 8, pt = 10, pb = 22;
  const n = tests.length;
  const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1));
  const y = v => pt + (100 - v) / 100 * (H - pt - pb);
  const pts = tests.map((t, i) => [x(i), y(pct(t.c, t.n)), t.c === t.n]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf posledních ${n} výsledků">
    ${[0, 25, 50, 75, 100].map(v => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    <polyline class="line" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>
    ${pts.map((p, i) => `<circle class="dot ${p[2] ? 'full' : ''}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"><title>${pct(tests[i].c, tests[i].n)} % · ${fmtDate(tests[i].ts)}</title></circle>`).join('')}
    <text class="axis" x="${pl}" y="${H - 6}">starší</text><text class="axis" x="${W - pr}" y="${H - 6}" text-anchor="end">nejnovější</text>
  </svg>`;
}
function stats() {
  const T = S.tests;
  const n = T.length;
  const avg = n ? T.reduce((a, t) => a + pct(t.c, t.n), 0) / n : 0;
  const best = n ? Math.max(...T.map(t => pct(t.c, t.n))) : 0;
  const perfect = T.filter(t => t.c === t.n).length;
  const fastest = bestPerfectPerQ();
  const totQ = T.reduce((a, t) => a + t.n, 0);
  const avgPerQ = totQ ? T.reduce((a, t) => a + t.ms, 0) / 1000 / totQ : 0;
  // úspěšnost podle sad a okruhů (ze statistik otázek)
  const agg = key => {
    const m = {};
    QUESTIONS.forEach(q => { const r = S.q[q.id]; if (!r || !r[1]) return; const k = q[key]; m[k] = m[k] || [0, 0]; m[k][0] += r[0]; m[k][1] += r[1]; });
    return Object.entries(m);
  };
  const hardest = QUESTIONS.filter(q => S.q[q.id] && S.q[q.id][1])
    .map(q => ({ q, r: S.q[q.id], ratio: S.q[q.id][0] / S.q[q.id][1] }))
    .sort((a, b) => a.ratio - b.ratio || b.r[1] - a.r[1]).slice(0, 10);
  const totalAnswered = Object.values(S.days).reduce((a, b) => a + b, 0);
  const app = setScreen('Statistiky', `
    <section class="card">
      <h2>Testy s výběrem</h2>
      <div class="kv">
        <span>Počet testů</span><span>${n}</span>
        <span>Průměr</span><span>${Math.round(avg)} %</span>
        <span>Nejlepší</span><span>${best} %</span>
        <span>Kolikrát 100 %</span><span>${perfect}</span>
        <span>Nejrychlejší 100 %</span><span>${fastest != null ? fmtNum(fastest) + ' s/otázka' : '–'}</span>
        <span>Průměr na otázku</span><span>${totQ ? fmtNum(avgPerQ) + ' s' : '–'}</span>
        <span>Zodpovězeno celkem</span><span>${totalAnswered}</span>
        <span>Série dnů</span><span>🔥 ${streak()}</span>
        <span>Rekord rychlovky</span><span>${S.rapidBest}</span>
      </div>
    </section>
    ${n ? `<section class="card"><h2>Posledních ${Math.min(20, n)} výsledků</h2>${chartSvg(T.slice(-20))}</section>` : ''}
    ${agg('set').length ? `<section class="card"><h2>Úspěšnost podle sad</h2>${agg('set').map(([k, [c, t]]) => rateRow(SET_NAMES[k] || k, c, t)).join('')}</section>` : ''}
    ${agg('topic').length ? `<section class="card"><h2>Úspěšnost podle okruhů</h2>${agg('topic').sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([k, [c, t]]) => rateRow(k, c, t)).join('')}</section>` : ''}
    ${hardest.length ? `<section class="card"><h2>10 nejtěžších otázek</h2><ul class="list">${hardest.map(h => `<li><div class="rate-row"><span class="lbl">${esc(h.q.q)}</span><span class="val">${h.r[0]}/${h.r[1]}</span></div><div class="muted small">${h.q.id} · ${esc(h.q.a)}</div></li>`).join('')}</ul></section>` : ''}
    ${n ? `<section class="card"><h2>Posledních 10 testů</h2><ul class="list">${T.slice(-10).reverse().map(t => `<li class="rate-row"><span class="lbl">${fmtDate(t.ts)} · ${t.tests.join('+')}<br><span class="muted small">${fmtTime(t.ms)} · ${fmtNum(t.ms / 1000 / t.n)} s/ot.</span></span><span class="val">${t.c}/${t.n} · ${pct(t.c, t.n)} %</span></li>`).join('')}</ul></section>` : ''}
    ${!n && !hardest.length ? '<section class="card center muted">Zatím žádná data. Udělej první test!</section>' : ''}
    <button class="btn bad block" id="clearBtn">Smazat statistiky</button>
    <p class="muted small center">Smaže testy, simulace, úspěšnost otázek, kartičky, XP a dny. Pro potvrzení klepni dvakrát.</p>
  `);
  confirmTap($('#clearBtn', app), 'Opravdu smazat? Klepni znovu', () => {
    const prefs = S.prefs, stars = S.stars;
    S = defaultState(); S.prefs = prefs; S.stars = stars; save();
    toast('Statistiky smazány'); stats();
  });
}

/* ---------- Záloha ---------- */
function backup() {
  const app = setScreen('Záloha', `
    <section class="card">
      <h2>Exportovat zálohu</h2>
      <p class="small muted">Stáhne soubor JSON se všemi statistikami, kartičkami, XP a nastavením. Hodí se před přeinstalováním nebo pro přenos do jiného telefonu.</p>
      <button class="btn primary block" id="exp">⬇️ Exportovat zálohu</button>
    </section>
    <section class="card">
      <h2>Importovat zálohu</h2>
      <p class="small muted">Nahradí aktuální data obsahem zálohy.</p>
      <label class="btn block" for="impFile">⬆️ Importovat zálohu</label>
      <input type="file" id="impFile" accept="application/json,.json" hidden>
    </section>
    <section class="card small muted">
      Data se ukládají jen v tomto prohlížeči (localStorage, klíč <code>${STORE_KEY}</code>). Verze aplikace: <span id="ver">–</span>.
    </section>
  `);
  $('#exp', app).onclick = () => {
    try {
      const blob = new Blob([JSON.stringify({ app: 'mapovani-trenink', exported: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mapovani-zaloha-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Záloha stažena');
    } catch (e) { toast('Export se nepodařil'); }
  };
  $('#impFile', app).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        const d = j && j.data ? j.data : j;
        if (!d || typeof d !== 'object' || !Array.isArray(d.tests) || typeof d.q !== 'object') throw new Error('bad');
        const base = defaultState();
        S = { ...base, ...d, prefs: { ...base.prefs, ...(d.prefs || {}) } };
        save(); toast(`Záloha načtena (${S.tests.length} testů)`); home();
      } catch (err) { toast('Soubor není platná záloha'); }
    };
    r.readAsText(f);
  };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const ch = new MessageChannel();
    ch.port1.onmessage = ev => { const v = $('#ver'); if (v) v.textContent = ev.data; };
    navigator.serviceWorker.controller.postMessage({ type: 'version' }, [ch.port2]);
  }
}

const SCREENS = { home, stats, sim, backup };

/* ---------- Service worker + aktualizace ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = w => {
        $('#updateBar').hidden = false;
        $('#updateBtn').onclick = () => w.postMessage({ type: 'skipWaiting' });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // kontrola nové verze při návratu do aplikace
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  });
}

home();
