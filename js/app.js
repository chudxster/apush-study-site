// Router + screens: Units → Topics → Methods → Mode.
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
    { id: 'everything', name: 'Everything', icon: 'layers', desc: 'The whole unit, mixed together' }
  ];
  const METHODS = ['flashcards', 'quiz', 'matching', 'learn', 'timeline', 'causeeffect'];
  const DIFFS = [
    { value: 'easy', label: 'Easy', tip: 'Must-know items, multiple choice, obvious wrong answers.' },
    { value: 'medium', label: 'Medium', tip: 'More detail and trickier wrong answers.' },
    { value: 'hard', label: 'Hard', tip: 'Everything: typed answers, dates, close-call distractors, small details.' },
    { value: 'adaptive', label: 'Adaptive', tip: 'Starts at Medium, levels up after 3 right in a row and down after 2 misses.' }
  ];

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
      if (!screen) { screen = NotFound(); }
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
    const topic = r.topic && TOPICS.find((t) => t.id === r.topic);
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
  const prefs = () => ({ ch: Store.pref('ch') || 'all', sub: Store.pref('sub') || 'all', diff: Store.pref('diff') || 'medium' });

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
    if (UI.reduced()) { container.replaceWith(next); return next; }
    next.classList.add('refresh');
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
              h('span', { class: 'go' }, icon('arrow', 18))),
            h('div', { class: 'card-title big' }, u.name),
            h('div', { class: 'meta' }, h('span', null, u.years), h('span', { class: 'dot' }), h('span', null, u.pages)),
            h('p', { class: 'muted' }, u.blurb),
            h('ul', { class: 'chapters' }, u.chapters.map((c) => h('li', null, h('b', null, c.n), h('span', null, c.title), h('small', null, c.years)))),
            h('div', { class: 'unit-foot' }, h('span', { class: 'muted small' }, items.length + ' items · ' + (d ? d.causeEffect.length : 0) + ' cause/effect · ' + (d ? d.frq.length : 0) + ' FRQs'), masteryRow(items)));
        }),
        h('div', { class: 'card ghost', style: { '--i': units.length } },
          h('div', { class: 'ghost-plus' }, '+'),
          h('div', { class: 'card-title' }, 'More units soon'),
          h('p', { class: 'muted small' }, 'New chapters get added here as notes come in.'))));
  }

  function UnitScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    if (!u || !d) return null;
    let grid = topicGrid();
    const chSeg = UI.seg(
      [{ value: 'all', label: 'Both chapters' }].concat(u.chapters.map((c) => ({ value: String(c.n), label: 'Ch. ' + c.n, title: c.title }))),
      prefs().ch, (v) => { Store.setPref('ch', v); grid = refresh(grid, topicGrid); });

    function topicGrid() {
      const { ch } = prefs();
      return h('div', { class: 'grid topics' }, TOPICS.map((t, i) => {
        const items = Engine.topicItems(d, t.id, ch, 'all');
        const extra = t.id === 'themes' ? Engine.byCh(d.causeEffect, ch).length + Engine.byCh(d.frq, ch).length : 0;
        return h('a', { class: 'card topic-card' + (t.id === 'everything' ? ' wide' : ''), href: link({ unit: u.id, topic: t.id }), style: { '--i': i },
          onclick: (e) => { e.preventDefault(); go({ unit: u.id, topic: t.id }, e.currentTarget); } },
          h('div', { class: 'card-icon' }, icon(t.icon, 22)),
          h('div', { class: 'card-body' },
            h('div', { class: 'card-title' }, t.name),
            h('p', { class: 'muted small' }, t.desc),
            h('div', { class: 'card-foot' },
              h('span', { class: 'count' }, items.length + ' items' + (extra ? ' + ' + extra + ' links/FRQs' : '')),
              masteryRow(items))),
          h('span', { class: 'go' }, icon('arrow', 18)));
      }));
    }

    return h('section', { class: 'screen' },
      head(u.years + ' · ' + u.pages, u.name, u.blurb, h('div', { class: 'controls' }, h('div', { class: 'control-label' }, 'Chapters'), chSeg)),
      h('div', { class: 'section-label' }, 'Choose a topic'),
      grid);
  }

  function TopicScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    const t = TOPICS.find((x) => x.id === r.topic);
    if (!u || !d || !t) return null;
    const tip = h('p', { class: 'muted small diff-tip' });
    const setTip = () => { tip.textContent = DIFFS.find((x) => x.value === prefs().diff).tip; };
    setTip();
    const countLine = h('span');
    let grid = methodGrid();

    const diffSeg = UI.seg(DIFFS, prefs().diff, (v) => { Store.setPref('diff', v); setTip(); grid = refresh(grid, methodGrid); });
    const subSeg = t.id === 'vocab' ? UI.seg(
      [{ value: 'all', label: 'All vocab' }, { value: 'terms', label: 'Terms & concepts' }, { value: 'laws', label: 'Laws & Acts' }],
      prefs().sub, (v) => { Store.setPref('sub', v); grid = refresh(grid, methodGrid); }) : null;

    function ctxFor(method) {
      const p = prefs();
      const sub = t.id === 'vocab' ? p.sub : 'all';
      return {
        unitId: u.id, unit: u, topicId: t.id, topic: t, ch: p.ch, sub, diff: p.diff,
        items: Engine.topicItems(d, t.id, p.ch, sub),
        all: Engine.byCh(d.items, p.ch),
        ce: Engine.byCh(d.causeEffect, p.ch),
        frq: Engine.byCh(d.frq, p.ch),
        key: [u.id, t.id, method, p.diff, p.ch, sub].join('|')
      };
    }

    function methodGrid() {
      const c0 = ctxFor('');
      countLine.textContent = c0.items.length + ' items · ' + (c0.ch === 'all' ? 'both chapters' : 'Ch. ' + c0.ch);
      return h('div', { class: 'grid methods' }, METHODS.map((id, i) => {
        const m = Modes[id], c = ctxFor(id);
        const reason = m.available(c);
        const best = id === 'causeeffect' ? Store.best(c.key + '|ce') : Store.best(c.key);
        const bestTxt = best == null ? null : id === 'matching' ? 'Best ' + UI.fmtTime(best) : 'Best ' + best + '%';
        return h('a', { class: 'card method-card' + (reason ? ' disabled' : ''), href: reason ? null : link({ unit: u.id, topic: t.id, method: id }),
          style: { '--i': i }, 'aria-disabled': reason ? 'true' : null, title: reason || null,
          onclick: (e) => { e.preventDefault(); if (!reason) go({ unit: u.id, topic: t.id, method: id }, e.currentTarget); } },
          h('div', { class: 'card-icon' }, icon(m.icon, 22)),
          h('div', { class: 'card-title' }, m.name),
          h('p', { class: 'muted small' }, reason || m.desc),
          h('div', { class: 'card-foot' }, bestTxt ? h('span', { class: 'chip accent' }, bestTxt) : h('span', { class: 'muted small' }, reason ? 'Unavailable' : 'Not tried yet'),
            reason ? null : h('span', { class: 'go' }, icon('arrow', 18))));
      }));
    }

    return h('section', { class: 'screen' },
      head(u.name, t.name, null, h('p', { class: 'sub' }, t.desc, ' · ', countLine)),
      h('div', { class: 'controls stack' },
        subSeg ? h('div', { class: 'control' }, h('div', { class: 'control-label' }, 'Show'), subSeg) : null,
        h('div', { class: 'control' }, h('div', { class: 'control-label' }, 'Difficulty'), diffSeg, tip)),
      h('div', { class: 'section-label' }, 'Choose a method'),
      grid);
  }

  function MethodScreen(r) {
    const u = getUnit(r.unit), d = Engine.data(r.unit);
    const t = TOPICS.find((x) => x.id === r.topic);
    const m = Modes[r.method];
    if (!u || !d || !t || !m) return null;
    const p = prefs();
    const sub = t.id === 'vocab' ? p.sub : 'all';
    const stage = h('div', { class: 'stage' });
    const c = {
      unitId: u.id, unit: u, topicId: t.id, topic: t, ch: p.ch, sub, diff: p.diff,
      items: Engine.topicItems(d, t.id, p.ch, sub),
      all: Engine.byCh(d.items, p.ch),
      ce: Engine.byCh(d.causeEffect, p.ch),
      frq: Engine.byCh(d.frq, p.ch),
      key: [u.id, t.id, r.method, p.diff, p.ch, sub].join('|'),
      exit: up,
      restart: () => {
        if (cleanup) { try { cleanup(); } catch (e) {} }
        stage.replaceChildren();
        stage.classList.remove('refresh'); void stage.offsetWidth; stage.classList.add('refresh');
        cleanup = m.start(stage, c) || null;
        window.scrollTo({ top: 0, behavior: UI.reduced() ? 'auto' : 'smooth' });
      }
    };
    const reason = m.available(c);
    const diffLabel = DIFFS.find((x) => x.value === p.diff).label;
    const section = h('section', { class: 'screen mode-screen' },
      head(t.name + ' · ' + diffLabel + (p.ch === 'all' ? '' : ' · Ch. ' + p.ch), m.name, null),
      stage);
    if (reason) stage.append(h('div', { class: 'card empty' }, h('p', null, reason), h('button', { class: 'btn primary', onclick: up }, 'Back to methods')));
    else cleanup = m.start(stage, c) || null;
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
    if (e.key !== 'Escape' || document.body.classList.contains('sheet-open')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') { e.target.blur(); return; }
    up();
  });
  render(true);
})();
