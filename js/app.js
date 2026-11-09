// Router + screens: Units → Topics (pick one or several) → Methods → Mode.
(function () {
  const { h, icon } = UI;
  const view = document.getElementById('view');
  const crumbs = document.getElementById('crumbs');
  const backBtn = document.getElementById('back');

  const TOPICS = [
    { id: 'vocab', name: 'Vocab', icon: 'book', desc: 'Key terms, concepts, laws & acts' },
    { id: 'events', name: 'Events', icon: 'calendar', desc: 'What happened, and when' },
    { id: 'people', name: 'People', icon: 'user', desc: 'Who they were and why they matter' },
    { id: 'economy', name: 'Economy', icon: 'chart', desc: 'Booms, busts, banks, tariffs, relief' },
    { id: 'culture', name: 'Culture & Society', icon: 'music', desc: 'Jazz Age, Prohibition, Harlem Renaissance' },
    { id: 'themes', name: 'Themes & Cause/Effect', icon: 'link', desc: 'Big ideas, connections, FRQ practice' },
    { id: 'essay', name: 'Good for Essays', icon: 'pen', desc: 'Terms that fit almost any short-answer or essay prompt, each with the themes it supports' },
    { id: 'everything', name: 'Everything', icon: 'layers', desc: 'The whole unit, mixed together' }
  ];
  const METHODS = ['necessities', 'flashcards', 'quiz', 'matching', 'learn', 'timeline', 'causeeffect'];
  const DIFFS = [
    { value: 'easy', label: 'Easy', tip: 'Multiple choice with clearly different wrong answers.' },
    { value: 'medium', label: 'Medium', tip: 'Both directions (term → definition too) and trickier wrong answers.' },
    { value: 'hard', label: 'Hard', tip: 'Typed answers, "which came first?", detail questions, close-call distractors.' },
    { value: 'adaptive', label: 'Adaptive', tip: 'Starts at Medium, levels up after 3 right in a row and down after 2 misses.' }
  ];
  const RELS = [
    { value: 'must', label: 'Must Know', tip: 'What every person should know and what WILL be on the test: presidents, decade-defining events, huge controversies.' },
    { value: 'good', label: 'Good to Know', tip: 'Must Know plus important supporting names, laws and events, including all of your class-calendar vocab.' },
    { value: 'niche', label: 'Niche', tip: 'Everything, down to the small details.' },
    { value: 'expansive', label: 'Expansive', tip: 'Builds up in 6 rounds: Must Know ×2 → Good to Know ×2 → Everything ×2.' }
  ];
  // Modes that run in rounds when Relevancy is Expansive.
  const STAGED = ['flashcards', 'quiz', 'matching', 'learn'];
  const EXPANSIVE = [['must', 'Must Know'], ['must', 'Must Know'], ['good', 'Good to Know'], ['good', 'Good to Know'], ['niche', 'Everything'], ['niche', 'Everything']];

  let cleanup = null, lastDepth = -1, vt = null;

  // ---------- routing ----------
  function parse() {
    const p = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
    const r = {};
    for (let i = 0; i + 1 < p.length; i += 2) {
      const k = { u: 'unit', t: 'topic', m: 'method' }[p[i]];
      if (k) r[k] = p[i + 1];
    }
    return r;
  }
  const depth = (r) => (r.method ? 3 : r.topic ? 2 : r.unit ? 1 : 0);
  function link(r) {
    let s = '#/';
    if (r.unit) s += 'u/' + r.unit;
    if (r.topic) s += '/t/' + r.topic;
    if (r.method) s += '/m/' + r.method;
    return s;
  }
  function go(r, srcEl) {
    if (srcEl) markHero(srcEl);
    const target = link(r);
    if (location.hash === target) render(); else location.hash = target;
  }
  function up() {
    const r = parse();
    if (r.method) go({ unit: r.unit, topic: r.topic });
    else if (r.topic) go({ unit: r.unit });
    else if (r.unit) go({});
  }

  // The clicked card's title morphs into the next page's heading.
  function markHero(el) {
    document.querySelectorAll('.vt-hero, .page-title').forEach((x) => { x.style.viewTransitionName = ''; x.classList.remove('vt-hero'); });
    const t = el.querySelector('.card-title') || el;
    t.style.viewTransitionName = 'hero';
    t.classList.add('vt-hero');
  }

  function render(first) {
    const r = parse();
    const d = depth(r);
    document.documentElement.dataset.dir = d < lastDepth ? 'back' : 'fwd';
    lastDepth = d;
    const swap = () => {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      let screen;
      try {
        screen = d === 0 ? Home() : d === 1 ? UnitScreen(r) : d === 2 ? TopicScreen(r) : MethodScreen(r);
      } catch (e) { console.error(e); screen = null; }
      if (!screen) screen = NotFound();
      view.replaceChildren(screen);
      chrome(r);
      window.scrollTo(0, 0);
    };
    if (!first && document.startViewTransition && !UI.reduced()) {
      if (vt) { try { vt.skipTransition(); } catch (e) {} }
      vt = document.startViewTransition(swap);
      vt.finished.finally(() => { vt = null; });
    } else {
      swap();
      if (!UI.reduced()) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    }
  }

  function chrome(r) {
    const unit = r.unit && getUnit(r.unit);
    const topic = r.topic && topicInfo(r.topic);
    const mode = r.method && Modes[r.method];
    const parts = [{ label: 'Units', r: {} }];
    if (unit) parts.push({ label: unit.name, r: { unit: unit.id } });
    if (unit && topic) parts.push({ label: topic.name, r: { unit: unit.id, topic: topic.id } });
    if (unit && topic && mode) parts.push({ label: mode.name, r: { unit: unit.id, topic: topic.id, method: r.method } });
    crumbs.replaceChildren(...parts.map((p, i) => i === parts.length - 1
      ? h('span', { class: 'crumb current', 'aria-current': 'page' }, p.label)
      : h('a', { class: 'crumb', href: link(p.r) }, p.label)));
    backBtn.hidden = depth(r) === 0;
    document.title = (parts.length > 1 ? parts[parts.length - 1].label + ' · ' : '') + 'APUSH Study';
  }

  // ---------- helpers ----------
  const getUnit = (id) => (window.UNITS || []).find((u) => u.id === id);
  const prefs = () => ({
    ch: Store.pref('ch') || 'all', sub: Store.pref('sub') || 'all',
    diff: Store.pref('diff') || 'medium', rel: Store.pref('rel') || 'must'
  });

  // A topic route can combine several topics: "people+events".
  function topicInfo(routeId) {
    const ids = String(routeId).split('+').filter((id) => TOPICS.some((t) => t.id === id));
    if (!ids.length) return null;
    if (ids.length === 1) return Object.assign({ ids }, TOPICS.find((t) => t.id === ids[0]));
    const list = ids.map((id) => TOPICS.find((t) => t.id === id));
    const SHORT = { culture: 'Culture', themes: 'Themes', essay: 'Essay Terms' };
    return { id: ids.join('+'), ids, icon: 'layers', name: list.map((t) => SHORT[t.id] || t.name).join(' + '),
      desc: 'Combined: ' + list.map((t) => t.name).join(', ') };
  }

  // Necessities ignores difficulty and relevancy, so it gets one shared best score.
  const keyFor = (u, t, method, p, sub) => [u, t, method,
    method === 'necessities' ? 'nec' : p.diff + '/' + p.rel, p.ch, sub].join('|');

  function buildCtx(u, d, t, method, p) {
    const sub = t.ids.length === 1 && t.ids[0] === 'vocab' ? p.sub : 'all';
    const topicAll = Engine.topicItems(d, t.ids, p.ch, sub);
    const rel = method === 'necessities' ? 'niche' : p.rel;
    const usesThemes = t.ids.some((id) => ['themes', 'essay', 'everything', 'economy', 'events', 'culture'].includes(id));
    return {
      unitId: u.id, unit: u, topicId: t.id, topicIds: t.ids, topic: t, ch: p.ch, sub, diff: p.diff, rel,
      topicAll,
      items: Engine.byRelevancy(topicAll, rel),
      all: Engine.byRelevancy(Engine.byCh(d.items, p.ch), rel === 'expansive' ? 'niche' : rel),
      ce: usesThemes ? Engine.byCh(d.causeEffect, p.ch) : [],
      frq: usesThemes ? Engine.byCh(d.frq, p.ch) : [],
      key: keyFor(u.id, t.id, method, p, sub)
    };
  }

  function head(eyebrow, title, sub, extra) {
    return h('header', { class: 'page-head' },
      eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null,
      h('h1', { class: 'page-title', style: { viewTransitionName: 'hero' } }, title),
      sub ? h('p', { class: 'sub' }, sub) : null,
      extra || null);
  }

  function masteryRow(items) {
    const pct = Engine.masteryPct(items);
    return h('div', { class: 'mastery' }, UI.bar(pct), h('span', null, pct + '% mastered'));
  }

  function refresh(container, build) {
    const next = build();
    if (!UI.reduced()) next.classList.add('refresh');
    container.replaceWith(next);
    return next;
  }

  // ---------- screens ----------
  function Home() {
    const units = window.UNITS || [];
    return h('section', { class: 'screen' },
      head('AP United States History', 'Pick a unit', 'Flashcards, quizzes, matching, timelines and FRQ practice built from your textbook notes.'),
      h('div', { class: 'grid units' },
        units.map((u, i) => {
          const d = Engine.data(u.id);
          const items = d ? d.items : [];
          return h('a', { class: 'card unit-card', href: link({ unit: u.id }), style: { '--i': i },
            onclick: (e) => { e.preventDefault(); go({ unit: u.id }, e.currentTarget); } },
            h('div', { class: 'unit-top' },
              h('span', { class: 'chip accent' }, 'Ch. ' + u.chapters.map((c) => c.n).join('–')),
              u.assessment ? h('span', { class: 'chip' }, icon('calendar', 13), 'Test ' + u.assessment) : null,
              h('span', { class: 'go' }, icon('arrow', 18))),
            h('div', { class: 'card-title big' }, u.name),
            h('div', { class: 'meta' }, h('span', null, u.years), h('span', { class: 'dot' }), h('span', null, u.pages)),
            h('p', { class: 'muted' }, u.blurb),
            h('ul', { class: 'chapters' }, u.chapters.map((c) => h('li', null, h('b', null, c.n), h('span', null, c.title), h('small', null, c.years)))),
            h('div', { class: 'unit-foot' }, h('span', { class: 'muted small' },
              items.length + ' items · ' + items.filter(Engine.isMust).length + ' Must Know · ' + (d ? d.frq.length : 0) + ' FRQs'), masteryRow(items)));
        }),
        h('div', { class: 'card ghost', style: { '--i': units.length } },
          h('div', { class: 'ghost-plus' }, '+'),
          h('div', { class: 'card-title' }, 'More units soon'),
          h('p', { class: 'muted small' }, 'New chapters get added here as notes come in.'))));
  }

  function UnitScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    if (!u || !d) return null;
    const sel = new Set();
    let grid = topicGrid(), nec = necCard();
    const chSeg = UI.seg(
      [{ value: 'all', label: 'Both chapters' }].concat(u.chapters.map((c) => ({ value: String(c.n), label: 'Ch. ' + c.n, title: c.title }))),
      prefs().ch, (v) => { Store.setPref('ch', v); grid = refresh(grid, topicGrid); nec = refresh(nec, necCard); syncBar(); });

    // Sticky bar that appears once topics are selected.
    const barText = h('span', { class: 'pick-text' });
    const barBtn = h('button', { class: 'btn primary', onclick: (e) => { if (sel.size) go({ unit: u.id, topic: Array.from(sel).join('+') }, e.currentTarget); } },
      'Continue', icon('arrow', 16));
    const bar = h('div', { class: 'pick-bar', 'aria-live': 'polite' },
      h('div', { class: 'pick-inner' }, barText,
        h('button', { class: 'btn ghost sm', onclick: () => { sel.clear(); grid = refresh(grid, topicGrid); syncBar(); } }, 'Clear'),
        barBtn));
    function syncBar() {
      bar.classList.toggle('show', sel.size > 0);
      if (!sel.size) return;
      const t = topicInfo(Array.from(sel).join('+'));
      const n = Engine.topicItems(d, t.ids, prefs().ch, 'all').length;
      barText.replaceChildren(h('b', null, t.name), h('span', { class: 'muted' }, ' · ' + n + ' items'));
    }

    function toggle(id, card) {
      if (id === 'everything') sel.clear();
      else sel.delete('everything');
      sel.has(id) ? sel.delete(id) : sel.add(id);
      grid.querySelectorAll('.topic-card').forEach((c) => c.setAttribute('aria-pressed', String(sel.has(c.dataset.id))));
      syncBar();
    }

    function topicGrid() {
      const { ch } = prefs();
      return h('div', { class: 'grid topics' }, TOPICS.map((t, i) => {
        const items = Engine.topicItems(d, [t.id], ch, 'all');
        const must = items.filter(Engine.isMust).length;
        const card = h('button', { type: 'button', class: 'card topic-card' + (t.id === 'everything' ? ' wide' : ''), style: { '--i': i },
          'aria-pressed': String(sel.has(t.id)), onclick: () => toggle(t.id, card) },
          h('div', { class: 'card-icon' }, icon(t.icon, 22)),
          h('div', { class: 'card-body' },
            h('div', { class: 'card-title' }, t.name),
            h('p', { class: 'muted small' }, t.desc),
            h('div', { class: 'card-foot' },
              h('span', { class: 'count' }, items.length + ' items · ' + must + ' Must Know'),
              masteryRow(items))),
          h('span', { class: 'check-box' }, icon('check', 15)));
        card.dataset.id = t.id;
        return card;
      }));
    }

    function necCard() {
      const all = Engine.byCh(d.items, prefs().ch);
      const n = all.filter(Engine.isMust).length;
      const extra = all.filter((x) => !Engine.isMust(x) && Engine.isClass(x)).length;
      const best = Store.best(keyFor(u.id, 'everything', 'necessities', prefs(), 'all'));
      return h('a', { class: 'card nec-card', href: link({ unit: u.id, topic: 'everything', method: 'necessities' }), style: { '--i': 0 },
        onclick: (e) => { e.preventDefault(); go({ unit: u.id, topic: 'everything', method: 'necessities' }, e.currentTarget); } },
        h('div', { class: 'card-icon' }, icon('spark', 22)),
        h('div', { class: 'nec-body' },
          h('div', { class: 'eyebrow' }, 'Short on time?' + (u.assessment ? ' Test is ' + u.assessment : '')),
          h('div', { class: 'card-title' }, 'Necessities'),
          h('p', { class: 'muted small' }, (Modes.necessities.FLASH_MS / 60000) + ' minutes of Easy flashcards on the ' + n + ' Must Know terms (+ ' + extra + ' more from your class calendar), then a test.')),
        h('div', { class: 'nec-side' },
          best != null ? h('span', { class: 'chip accent' }, 'Best ' + best + '%') : null,
          h('span', { class: 'go' }, icon('arrow', 18))));
    }

    // Fixed bar lives on <body> so page animations can't offset it.
    document.body.append(bar);
    cleanup = () => bar.remove();
    return h('section', { class: 'screen' },
      head(u.years + ' · ' + u.pages, u.name, u.blurb, h('div', { class: 'controls' }, h('div', { class: 'control-label' }, 'Chapters'), chSeg)),
      nec,
      h('div', { class: 'section-label' }, 'Or pick topics: select one or several'),
      grid);
  }

  function TopicScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    const t = topicInfo(r.topic);
    if (!u || !d || !t) return null;
    const relTip = h('p', { class: 'muted small diff-tip' });
    const diffTip = h('p', { class: 'muted small diff-tip' });
    const setTips = () => {
      relTip.textContent = RELS.find((x) => x.value === prefs().rel).tip;
      diffTip.textContent = DIFFS.find((x) => x.value === prefs().diff).tip;
    };
    setTips();
    const countLine = h('span');
    let grid = methodGrid();
    const redo = () => { setTips(); grid = refresh(grid, methodGrid); };

    const relSeg = UI.seg(RELS, prefs().rel, (v) => { Store.setPref('rel', v); redo(); });
    const diffSeg = UI.seg(DIFFS, prefs().diff, (v) => { Store.setPref('diff', v); redo(); });
    const subSeg = t.ids.length === 1 && t.ids[0] === 'vocab' ? UI.seg(
      [{ value: 'all', label: 'All vocab' }, { value: 'terms', label: 'Terms & concepts' }, { value: 'laws', label: 'Laws & Acts' }],
      prefs().sub, (v) => { Store.setPref('sub', v); redo(); }) : null;

    function methodGrid() {
      const p = prefs();
      const c0 = buildCtx(u, d, t, '', p);
      const tiers = { must: 0, good: 0, niche: 0 };
      c0.topicAll.forEach((x) => tiers[Engine.tierOf(x)]++);
      countLine.textContent = c0.items.length + ' items at this relevancy (' + tiers.must + ' Must Know · ' + tiers.good + ' Good to Know · ' + tiers.niche + ' Niche)';
      return h('div', { class: 'grid methods' }, METHODS.map((id, i) => {
        const m = Modes[id], c = buildCtx(u, d, t, id, p);
        const reason = m.available(c);
        const best = id === 'causeeffect' ? Store.best(c.key + '|ce') : Store.best(c.key);
        const bestTxt = best == null ? null : id === 'matching' && p.rel !== 'expansive' ? 'Best ' + UI.fmtTime(best) : 'Best ' + best + '%';
        const desc = p.rel === 'expansive' && STAGED.includes(id) ? m.desc + ' Runs as 6 expanding rounds.' : m.desc;
        return h('a', { class: 'card method-card' + (reason ? ' disabled' : '') + (id === 'necessities' ? ' featured' : ''), href: reason ? null : link({ unit: u.id, topic: t.id, method: id }),
          style: { '--i': i }, 'aria-disabled': reason ? 'true' : null, title: reason || null,
          onclick: (e) => { e.preventDefault(); if (!reason) go({ unit: u.id, topic: t.id, method: id }, e.currentTarget); } },
          h('div', { class: 'card-icon' }, icon(m.icon, 22)),
          h('div', { class: 'card-title' }, m.name),
          h('p', { class: 'muted small' }, reason || desc),
          h('div', { class: 'card-foot' }, bestTxt ? h('span', { class: 'chip accent' }, bestTxt) : h('span', { class: 'muted small' }, reason ? 'Unavailable' : 'Not tried yet'),
            reason ? null : h('span', { class: 'go' }, icon('arrow', 18))));
      }));
    }

    return h('section', { class: 'screen' },
      head(u.name, t.name, null, h('p', { class: 'sub' }, t.desc, ' · ', countLine)),
      h('div', { class: 'controls stack' },
        subSeg ? h('div', { class: 'control' }, h('div', { class: 'control-label' }, 'Show'), subSeg) : null,
        h('div', { class: 'control' }, h('div', { class: 'control-label' }, 'Relevancy: which terms'), relSeg, relTip),
        h('div', { class: 'control' }, h('div', { class: 'control-label' }, 'Difficulty: how you are tested'), diffSeg, diffTip)),
      h('div', { class: 'section-label' }, 'Choose a method'),
      grid);
  }

  // Expansive: run a mode as 6 rounds over a growing pool, then show combined results.
  function runExpansive(stage, m, c) {
    const rounds = EXPANSIVE.map(([rel, label]) => ({ rel, label, items: Engine.byRelevancy(c.topicAll, rel) }))
      .filter((rd) => rd.items.length >= (c.methodId === 'matching' ? 4 : 2));
    let k = 0, sub = null, correct = 0, total = 0;
    const review = [];
    const fill = h('i');
    function next() {
      if (sub) { try { sub(); } catch (e) {} sub = null; }
      if (k >= rounds.length) return finish();
      const rd = rounds[k];
      const pass = rounds.slice(0, k + 1).filter((x) => x.rel === rd.rel).length;
      fill.style.width = (k / rounds.length) * 100 + '%';
      const holder = h('div', { class: 'refresh' });
      stage.replaceChildren(
        h('div', { class: 'step-strip' },
          h('span', { class: 'step-num' }, 'Round ' + (k + 1) + ' / ' + rounds.length),
          h('span', { class: 'step-title' }, rd.label + ' · pass ' + pass + ' of 2'),
          h('span', { class: 'step-right' }, h('span', { class: 'muted small' }, rd.items.length + ' items'))),
        h('div', { class: 'bar exp-bar' }, fill),
        holder);
      if (k > 0) UI.toast('Round ' + (k + 1) + ': ' + rd.label);
      sub = m.start(holder, Object.assign({}, c, {
        items: rd.items, all: Engine.byRelevancy(c.all, rd.rel === 'niche' ? 'niche' : rd.rel).length >= 12 ? Engine.byRelevancy(c.all, rd.rel) : c.all,
        autoLen: Math.min(10, rd.items.length),
        onComplete: (s) => { correct += s.correct; total += s.total; (s.review || []).forEach((x) => review.push(x)); k++; next(); }
      }));
    }
    function finish() {
      UI.results(stage, {
        pct: total ? (correct / total) * 100 : 0, label: correct + ' of ' + total + ' right',
        stats: [['rounds', rounds.length], ['right', correct], ['missed', total - correct]],
        review: review.slice(0, 40), bestKey: c.key, bestValue: total ? Math.round((correct / total) * 100) : 0,
        onRetry: c.restart, onBack: c.exit
      });
    }
    next();
    return () => { if (sub) { try { sub(); } catch (e) {} } };
  }

  function MethodScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    const t = topicInfo(r.topic);
    const m = Modes[r.method];
    if (!u || !d || !t || !m) return null;
    const p = prefs();
    const stage = h('div', { class: 'stage' });
    const c = Object.assign(buildCtx(u, d, t, r.method, p), { methodId: r.method, exit: up });
    const staged = p.rel === 'expansive' && STAGED.includes(r.method);
    const launch = () => (staged ? runExpansive(stage, m, c) : m.start(stage, c)) || null;
    c.restart = () => {
      if (cleanup) { try { cleanup(); } catch (e) {} }
      stage.replaceChildren();
      stage.classList.remove('refresh'); void stage.offsetWidth; stage.classList.add('refresh');
      cleanup = launch();
      window.scrollTo({ top: 0, behavior: UI.reduced() ? 'auto' : 'smooth' });
    };
    const reason = m.available(c);
    const relLabel = r.method === 'necessities' ? 'Must Know' : RELS.find((x) => x.value === p.rel).label;
    const diffLabel = r.method === 'necessities' ? 'Easy' : DIFFS.find((x) => x.value === p.diff).label;
    const section = h('section', { class: 'screen mode-screen' },
      head(t.name + ' · ' + relLabel + ' · ' + diffLabel + (p.ch === 'all' ? '' : ' · Ch. ' + p.ch), m.name, null),
      stage);
    if (reason) stage.append(h('div', { class: 'card empty' }, h('p', null, reason), h('button', { class: 'btn primary', onclick: up }, 'Back to methods')));
    else {
      // Offer a study session timer before the first mode starts.
      let cancelled = false;
      cleanup = () => { cancelled = true; };
      Session.prompt().then(() => {
        if (cancelled || !stage.isConnected) return;
        stage.classList.remove('refresh'); void stage.offsetWidth; stage.classList.add('refresh');
        cleanup = launch();
      });
    }
    return section;
  }

  function NotFound() {
    return h('section', { class: 'screen' },
      head('404', 'Page not found', 'That page does not exist.'),
      h('button', { class: 'btn primary', onclick: () => go({}) }, 'Go home'));
  }

  // ---------- init ----------
  backBtn.append(icon('back', 20));
  backBtn.addEventListener('click', up);
  document.querySelector('.brand-mark').append(icon('spark', 16));
  Theme.buildSheet();
  window.addEventListener('hashchange', () => render(false));
  document.addEventListener('keydown', (e) => {
    const b = document.body.classList;
    if (e.key !== 'Escape' || b.contains('sheet-open') || b.contains('modal-open') || b.contains('on-break')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') { e.target.blur(); return; }
    up();
  });
  render(true);
})();
