// Word Bank: every term with its short definition. List view sorts A–Z (with a
// letter scroll tab on the right) or by relevancy. Graph view draws every term
// as a node linked to the terms it mentions and its causes/effects; more
// relevant terms are bigger and pulled to the middle. Pan, zoom, drag nodes,
// and pinch on touch screens. Opens from the button next to Session.
(function () {
  const { h, icon } = UI;
  const TIERS = [['must', 'Must Know'], ['good', 'Good to Know'], ['niche', 'Niche']];
  let panel = null, items = [], view = Store.pref('wbView') || 'list', query = '';
  let graph = null, optsOpen = false;
  // View options (saved): which unit, what to show, how to sort, how entries look.
  const DEF = { unit: 'auto', coll: 'all', tiers: ['must', 'good', 'niche'], stage: 'all', sort: 'az', rev: false, defs: true, badges: true, reveal: false };
  const o = Object.assign({}, DEF, Store.pref('wbOpts') || {});
  if (Store.pref('wbSort') && !Store.pref('wbOpts')) o.sort = Store.pref('wbSort');   // older saved sort
  if (Store.pref('wbCards') && !Store.pref('wbOpts')) o.coll = Store.pref('wbCards');
  const saveOpts = () => Store.setPref('wbOpts', o);
  const SORTS = [
    ['az', 'A–Z'], ['rel', 'Relevance'], ['year', 'Year'], ['page', 'Textbook order'],
    ['mastery', 'Weakest first'], ['stage', 'Teach Me ladder'], ['rarity', 'Card rarity'], ['recent', 'Recently unlocked']
  ];
  const STAGES = [['all', 'Any'], ['new', 'Not started'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['due', 'Due for review']];
  const stageOf = (x) => (Modes.teach ? Modes.teach.stage(x) : 0);
  // A locked card's name shows once you've met the term in Teach Me, or with "Reveal locked names".
  const shownName = (x) => Cards.has(x.id) || o.reveal || stageOf(x) > 0;

  const pill = h('button', { class: 'session-pill bank-pill', type: 'button', 'aria-haspopup': 'dialog', onclick: open },
    icon('book', 16), h('span', { class: 'pill-text' }, 'Word Bank'));
  const badge = h('span', { class: 'pack-badge', 'aria-label': 'Unopened card packs' });
  pill.append(badge);
  document.querySelector('.session-pill').before(pill);
  function syncBadge() { const n = Cards.packs(); badge.textContent = n || ''; badge.hidden = !n; }
  syncBadge();
  window.addEventListener('cardschange', () => { syncBadge(); if (panel && panel.refresh) panel.refresh(); });

  // Which terms. 'auto': the unit you're in, else the subject's units, else
  // everything. Or a picked unit id, or 'all'.
  function scope() {
    const units = window.UNITS || [];
    if (o.unit === 'all') return { label: 'All units', units };
    const picked = units.find((u) => u.id === o.unit);
    if (picked) return { label: picked.name, units: [picked] };
    const p = location.hash.replace(/^#\/?/, '').split('/');
    const ui = p.indexOf('u'), si = p.indexOf('s');
    if (ui >= 0 && units.some((u) => u.id === p[ui + 1])) { const u = units.find((x) => x.id === p[ui + 1]); return { label: u.name, units: [u] }; }
    if (si >= 0) { const s = (window.SUBJECTS || []).find((x) => x.id === p[si + 1]); if (s) return { label: s.name, units: units.filter((u) => u.subject === s.id) }; }
    return { label: 'All units', units };
  }

  function open() {
    const sc = scope();
    Promise.all(sc.units.map((u) => Engine.load(u.id))).then(() => {
      items = [];
      sc.units.forEach((u) => { const d = Engine.data(u.id); if (d) items = items.concat(d.items); });
      build(sc.label);
    });
  }
  function close() {
    if (!panel) return;
    if (graph) { graph.stop(); graph = null; }
    panel.classList.remove('show');
    document.body.classList.remove('modal-open');
    const p = panel; panel = null;
    setTimeout(() => p.remove(), 350);
    pill.focus();
  }
  document.addEventListener('keydown', (e) => { if (panel && e.key === 'Escape') { e.preventDefault(); close(); } });

  function build(label) {
    if (panel) panel.remove();
    const body = h('div', { class: 'wb-body' });
    const search = h('input', { class: 'wb-search', type: 'search', placeholder: 'Search terms…', value: query, 'aria-label': 'Search terms' });
    search.addEventListener('input', () => { query = search.value; render(); });
    const viewSeg = UI.seg([{ value: 'list', label: 'List' }, { value: 'graph', label: 'Graph' }, { value: 'timeline', label: 'Timeline' }], view, (v) => { view = v; Store.setPref('wbView', v); render(); });
    const count = h('span', { class: 'muted small' });
    const packBtn = h('button', { type: 'button', class: 'btn primary sm wb-pack', onclick: () => Cards.openPack() }, icon('cards', 15), h('span'));
    const optsBadge = h('span', { class: 'wb-opts-n' });
    const optsBtn = h('button', { type: 'button', class: 'btn ghost sm wb-opts-btn', 'aria-expanded': String(optsOpen), onclick: () => {
      optsOpen = !optsOpen; optsBtn.setAttribute('aria-expanded', String(optsOpen)); opts.hidden = !optsOpen;
    } }, icon('gear', 15), 'View options', optsBadge);
    const opts = Options();
    opts.hidden = !optsOpen;
    function syncHead() {
      const owned = items.filter((x) => Cards.has(x.id)).length, n = Cards.packs();
      const units = new Set(items.map((x) => String(x.id).split('/')[0]));
      count.textContent = items.length + ' terms · ' + owned + '/' + items.length + ' cards collected' + (units.size === 1 ? ' · ' + Cards.oddsText(Array.from(units)[0]) : '');
      packBtn.hidden = !n; packBtn.lastChild.textContent = 'Open pack (' + n + ')';
      // How many options differ from the defaults (unit and sort don't count as filters).
      const nChanged = ['coll', 'stage', 'reveal'].filter((k) => o[k] !== DEF[k]).length + (o.tiers.length < 3 ? 1 : 0) + (!o.defs || !o.badges ? 1 : 0);
      optsBadge.textContent = nChanged ? String(nChanged) : '';
    }
    syncHead();
    panel = h('div', { class: 'wb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Word Bank' },
      h('div', { class: 'wb-head' },
        h('div', { class: 'wb-title' }, h('div', { class: 'eyebrow' }, label), h('h2', null, 'Word Bank'), count),
        h('div', { class: 'wb-controls' }, packBtn, viewSeg, optsBtn, search),
        h('button', { class: 'icon-btn', 'aria-label': 'Close word bank', onclick: close }, icon('x', 20))),
      opts, body);
    document.body.append(panel);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => panel.classList.add('show'));

    function filtered() {
      const q = query.trim().toLowerCase(), now = Date.now(), L = Store.get('learned') || {};
      return items.filter((x) => {
        if (q && !(x.term + ' ' + x.def + ' ' + (x.aliases || []).join(' ')).toLowerCase().includes(q)) return false;
        if (o.coll !== 'all' && Cards.has(x.id) !== (o.coll === 'own')) return false;
        if (!o.tiers.includes(Engine.tierOf(x))) return false;
        const s = stageOf(x);
        if (o.stage === 'new' && s !== 0) return false;
        if (o.stage === 'learning' && !(s > 0 && s < 4)) return false;
        if (o.stage === 'mastered' && s !== 4) return false;
        if (o.stage === 'due' && !(s === 4 && L[x.id] && L[x.id].due <= now)) return false;
        return true;
      });
    }
    function render() {
      if (graph) { graph.stop(); graph = null; }
      panel.classList.toggle('graph-on', view !== 'list');
      panel.classList.toggle('wb-compact', !o.defs);
      panel.classList.toggle('wb-nobadges', !o.badges);
      const shown = filtered();
      if (view === 'graph') body.replaceChildren(graph = Graph(shown, query.trim().toLowerCase()));
      else if (view === 'timeline') body.replaceChildren(graph = Timeline(shown, query.trim().toLowerCase()));
      else body.replaceChildren(List(shown));
      syncHead();
    }
    const changed = (reload) => { saveOpts(); if (reload) { open(); } else render(); };

    // ---------- view options panel ----------
    function Options() {
      const units = window.UNITS || [], subj = (id) => ((window.SUBJECTS || []).find((s) => s.id === id) || {}).name || '';
      const unitSel = h('select', { class: 'wb-select', 'aria-label': 'Unit', onchange: () => { o.unit = unitSel.value; changed(true); } },
        h('option', { value: 'auto' }, 'This page’s unit'),
        h('option', { value: 'all' }, 'All units'),
        units.map((u) => h('option', { value: u.id }, (subj(u.subject) ? subj(u.subject) + ' · ' : '') + u.name)));
      unitSel.value = o.unit;
      const sortSel = h('select', { class: 'wb-select', 'aria-label': 'Sort by', onchange: () => { o.sort = sortSel.value; changed(); } },
        SORTS.map(([v, l]) => h('option', { value: v }, l)));
      sortSel.value = o.sort;
      const stageSel = h('select', { class: 'wb-select', 'aria-label': 'Teach Me progress', onchange: () => { o.stage = stageSel.value; changed(); } },
        STAGES.map(([v, l]) => h('option', { value: v }, v === 'all' ? 'Any progress' : l)));
      stageSel.value = o.stage;
      const check = (label, get, set) => {
        const box = h('input', { type: 'checkbox', checked: get() || null, onchange: () => { set(box.checked); changed(); } });
        return h('label', { class: 'wb-check' }, box, label);
      };
      const row = (name, ...kids) => h('div', { class: 'wb-opt-row' }, h('span', { class: 'wb-opt-k' }, name), h('div', { class: 'wb-opt-v' }, kids));
      return h('div', { class: 'wb-opts' },
        row('Unit', unitSel),
        row('Show', UI.seg([{ value: 'all', label: 'All terms' }, { value: 'own', label: 'Unlocked' }, { value: 'locked', label: 'Locked' }], o.coll, (v) => { o.coll = v; changed(); })),
        row('Relevance', TIERS.map(([t, name]) => check(name, () => o.tiers.includes(t), (on) => {
          o.tiers = on ? o.tiers.concat(t) : o.tiers.filter((x) => x !== t);
          if (!o.tiers.length) o.tiers = [t];
        }))),
        row('Teach Me', stageSel),
        row('Sort', h('span', { class: 'wb-sort' }, sortSel, check('Reverse', () => o.rev, (v) => { o.rev = v; }))),
        row('Display',
          check('Definitions', () => o.defs, (v) => { o.defs = v; }),
          check('Badges', () => o.badges, (v) => { o.badges = v; }),
          check('Reveal locked names', () => o.reveal, (v) => { o.reveal = v; })),
        h('div', { class: 'wb-opt-foot' }, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => {
          Object.assign(o, JSON.parse(JSON.stringify(DEF))); saveOpts(); open();
        } }, 'Reset view options')));
    }

    render();
    // A pack was opened or a card upgraded while the Word Bank is open.
    panel.refresh = () => { syncHead(); if (view !== 'graph') render(); };
    if (view === 'list') setTimeout(() => search.focus({ preventScroll: true }), 50);
  }

  // ---------- grouping for each sort ----------
  // Returns [{key, name, short, list}] in display order. Reverse flips both the
  // group order and the order inside each group.
  function groupsFor(list) {
    const weight = (x) => x.weight || 5;
    const alpha = (a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
    const L = Modes.teach ? Modes.teach.LADDER : ['New', 'Seen', 'Recognized', 'Understood', 'Mastered'];
    let defs, keyOf, inner = alpha;
    switch (o.sort) {
      case 'rel':
        defs = TIERS.map(([t, name]) => [t, name, name[0]]); keyOf = (x) => Engine.tierOf(x);
        inner = (a, b) => weight(b) - weight(a) || alpha(a, b); break;
      case 'year': {
        const dec = (x) => (x.year ? Math.floor(x.year / 10) * 10 : null);
        const ds = Array.from(new Set(list.map(dec))).sort((a, b) => (a == null) - (b == null) || a - b);
        defs = ds.map((d) => [String(d), d == null ? 'No year' : d + 's', d == null ? '–' : "'" + String(d).slice(2)]);
        keyOf = (x) => String(dec(x)); inner = (a, b) => (a.year || 0) - (b.year || 0) || alpha(a, b); break;
      }
      case 'page': {
        const ch = (x) => x.chapter || null;
        const cs = Array.from(new Set(list.map(ch))).sort((a, b) => (a == null) - (b == null) || a - b);
        defs = cs.map((c) => [String(c), c == null ? 'Other' : 'Chapter ' + c, c == null ? '–' : String(c)]);
        keyOf = (x) => String(ch(x)); inner = (a, b) => (a.page || 0) - (b.page || 0) || alpha(a, b); break;
      }
      case 'mastery':
        defs = [0, 1, 2, 3, 4, 5].map((m) => [String(m), m === 0 ? 'Never practiced' : m === 5 ? 'Mastery 5/5' : 'Mastery ' + m + '/5', String(m)]);
        keyOf = (x) => String(Store.mastery(x.id)); inner = (a, b) => weight(b) - weight(a) || alpha(a, b); break;
      case 'stage':
        defs = L.map((n, s) => [String(s), n, n[0]]); keyOf = (x) => String(stageOf(x)); break;
      case 'rarity':
        defs = Cards.RARITIES.slice().reverse().map((r) => [r, Cards.NAME[r], Cards.NAME[r][0]]); keyOf = (x) => Cards.rarityOf(x);
        inner = (a, b) => Cards.has(b.id) - Cards.has(a.id) || alpha(a, b); break;
      case 'recent': {
        const at = (x) => (Cards.has(x.id) && Cards.stateOf(x.id).at) || 0;
        defs = [['own', 'Unlocked, newest first', '★'], ['locked', 'Locked', '?']]; keyOf = (x) => (Cards.has(x.id) ? 'own' : 'locked');
        inner = (a, b) => at(b) - at(a) || alpha(a, b); break;
      }
      default: {   // A–Z
        const letter = (x) => { const c = x.term.replace(/^[^a-z0-9]+/i, '').charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
        const ls = Array.from(new Set(list.map(letter))).sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
        defs = ls.map((k) => [k, k, k]); keyOf = letter;
      }
    }
    const by = new Map(defs.map((d) => [d[0], []]));
    list.forEach((x) => { const k = keyOf(x); if (by.has(k)) by.get(k).push(x); });
    let groups = defs.map(([k, name, short]) => ({ key: k, name, short, list: by.get(k).sort(inner) })).filter((g) => g.list.length);
    if (o.rev) groups = groups.reverse().map((g) => Object.assign(g, { list: g.list.reverse() }));
    // A–Z keys are the letters themselves (the scroll tab lists A–Z).
    return groups;
  }

  // ---------- list ----------
  function List(list) {
    const groups = groupsFor(list);
    const az = o.sort === 'az';
    const scroller = h('div', { class: 'wb-list' });
    if (!groups.length) scroller.append(h('p', { class: 'muted wb-empty' }, 'No terms match.'));
    groups.forEach((g) => {
      const sec = h('section', { class: 'wb-group', 'data-key': g.key },
        h('h3', { class: 'wb-letter' }, g.name, h('span', { class: 'muted small' }, ' ' + g.list.length)));
      g.list.forEach((x) => sec.append(entry(x)));
      scroller.append(sec);
    });
    // Scroll tab: letters (or group labels) down the right side; tap or drag to jump.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
    const keys = az ? (o.rev ? letters.slice().reverse() : letters) : groups.map((g) => g.key);
    const have = new Set(groups.map((g) => g.key));
    const short = new Map(groups.map((g) => [g.key, g.short || g.key]));
    const idx = h('div', { class: 'wb-index', 'aria-label': 'Jump to group' }, keys.map((k) =>
      h('button', { type: 'button', class: 'wb-idx' + (have.has(k) ? '' : ' off'), 'data-key': k, title: k, tabindex: have.has(k) ? null : '-1' }, short.get(k) || k)));
    let dragging = false;
    const jump = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const b = el && el.closest && el.closest('.wb-idx');
      if (!b || b.classList.contains('off')) return;
      idx.querySelectorAll('.wb-idx.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      const sec = scroller.querySelector('.wb-group[data-key="' + b.dataset.key + '"]');
      if (sec) scroller.scrollTop = sec.offsetTop - scroller.offsetTop;
    };
    idx.addEventListener('pointerdown', (e) => { dragging = true; idx.setPointerCapture(e.pointerId); jump(e); e.preventDefault(); });
    idx.addEventListener('pointermove', (e) => { if (dragging) jump(e); });
    idx.addEventListener('pointerup', () => { dragging = false; idx.querySelectorAll('.wb-idx.on').forEach((x) => x.classList.remove('on')); });
    idx.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.getBoundingClientRect(); jump({ clientX: r.left + 4, clientY: r.top + 4 }); } });
    return h('div', { class: 'wb-listwrap' }, scroller, idx);
  }

  function entry(x) {
    const tier = Engine.tierOf(x), own = Cards.has(x.id), rar = Cards.rarityOf(x), st = Cards.stateOf(x.id);
    const more = h('div', { class: 'wb-more' });
    const el = h('button', { type: 'button', class: 'wb-item ' + (own ? 'owned ' + Cards.classes(x) : 'locked card-' + rar), 'aria-expanded': 'false', onclick: () => {
      const on = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(on));
      if (on && !more.childNodes.length) {
        if (!shownName(x)) more.append(h('p', null, h('b', null, 'Term: '), x.term));
        if (x.detail) more.append(h('p', null, x.detail));
        if ((x.causedBy || []).length) more.append(h('p', null, h('b', null, 'Caused by: '), x.causedBy.map((y) => y.term).join(', ')));
        if ((x.ledTo || []).length) more.append(h('p', null, h('b', null, 'Led to: '), x.ledTo.map((y) => y.term).join(', ')));
        more.append(h('p', { class: 'muted small wb-next' }, icon('cards', 13), Cards.nextText(x)));
      }
    } },
      h('div', { class: 'wb-item-top' },
        own ? h('b', { class: 'wb-term' }, x.term) : h('b', { class: 'wb-term ' + (shownName(x) ? 'wb-locked-name' : 'wb-hidden'), title: 'Locked card' }, icon('lock', 14), shownName(x) ? x.term : '???'),
        h('span', { class: 'chip wb-tier ' + tier }, TIERS.find((t) => t[0] === tier)[1]),
        h('span', { class: 'chip wb-rar ' + rar }, rar),
        own && (st.f || st.g) ? h('span', { class: 'chip wb-fin' }, Cards.finishName(st)) : null,
        x.weight ? h('span', { class: 'wb-weight muted small mono' }, x.weight + '/10') : null),
      h('div', { class: 'wb-def' }, x.def),
      more);
    return el;
  }

  // ---------- timeline ----------
  // Terms in year columns (≈ = year estimated from the textbook page), colored by
  // Teach Me mastery, with the cause → effect tree drawn between them. Hover a
  // term to light up its links; click it for details.
  function Timeline(list, q) {
    const T = Modes.teach, L = T.LADDER;
    const wrap = h('div', { class: 'wt' });
    const card = h('div', { class: 'wb-card wt-card', hidden: true });
    const scroller = h('div', { class: 'wt-scroll' });
    const content = h('div', { class: 'wt-content' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wt-svg');
    const mastered = list.filter((x) => T.stage(x) === 4).length;
    wrap.append(h('div', { class: 'wt-head' },
      h('div', { class: 'wt-sum' }, h('b', null, mastered + '/' + list.length + ' mastered'), T.ladderBar(list)),
      h('span', { class: 'muted small' }, 'Columns are years (≈ estimated from the textbook page). Lines show cause → effect. Hover or click a term.')),
      scroller, card);
    scroller.append(content);
    content.append(svg);

    const by = new Map(), none = [];
    list.forEach((x) => { const t = T.timeOf(x); if (!t) none.push(x); else { if (!by.has(t.y)) by.set(t.y, []); by.get(t.y).push(x); } });
    const order = (a, b) => T.stage(b) - T.stage(a) || (b.weight || 0) - (a.weight || 0) || a.term.localeCompare(b.term);
    const nodes = new Map();
    const node = (x) => {
      const st = T.stage(x), t = T.timeOf(x);
      const el = h('button', { type: 'button', class: 'wt-node st-' + st + (t && t.est ? ' est' : '') + (q && x.term.toLowerCase().includes(q) ? ' hit' : ''),
        title: L[st] + (t && t.est ? ' · year estimated' : ''), onclick: () => select(x) },
        h('span', { class: 'pips' }, [1, 2, 3, 4].map((k) => h('i', { class: k <= st ? 'on' : '' }))),
        h('span', { class: 'wt-term' }, shownName(x) ? x.term : '???'));
      el.addEventListener('mouseenter', () => light(x));
      el.addEventListener('mouseleave', () => light(sel));
      nodes.set(x, el);
      return el;
    };
    let prev = null;
    Array.from(by.keys()).sort((a, b) => a - b).forEach((y) => {
      if (prev != null && y - prev > 1) content.append(h('div', { class: 'wt-gap', title: (y - prev - 1) + ' year' + (y - prev > 2 ? 's' : '') + ' with no terms' }, '⋯'));
      const items = by.get(y).sort(order);
      content.append(h('div', { class: 'wt-col' }, h('div', { class: 'wt-year' }, String(y), h('span', { class: 'muted small' }, ' ' + items.length)), items.map(node)));
      prev = y;
    });
    if (none.length) content.append(h('div', { class: 'wt-col' }, h('div', { class: 'wt-year' }, 'No date', h('span', { class: 'muted small' }, ' ' + none.length)), none.sort(order).map(node)));
    if (!list.length) content.append(h('p', { class: 'muted wb-empty' }, 'No terms match.'));

    // Cause → effect links between shown terms.
    const links = [];
    list.forEach((a) => (a.ledTo || []).forEach((b) => { if (nodes.has(b)) links.push([a, b]); }));
    list.forEach((b) => (b.causedBy || []).forEach((a) => { if (nodes.has(a) && !(a.ledTo || []).includes(b)) links.push([a, b]); }));
    let paths = [];
    function draw() {
      const r0 = content.getBoundingClientRect();
      svg.setAttribute('width', content.scrollWidth); svg.setAttribute('height', content.scrollHeight);
      svg.innerHTML = '<defs><marker id="wt-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="wt-ah"/></marker></defs>';
      paths = links.map(([a, b]) => {
        const ra = nodes.get(a).getBoundingClientRect(), rb = nodes.get(b).getBoundingClientRect();
        const ya = ra.top - r0.top + ra.height / 2, yb = rb.top - r0.top + rb.height / 2;
        let x1, x2, d;
        if (Math.abs(ra.left - rb.left) < 4) {   // same column: loop out to the right
          x1 = ra.right - r0.left; x2 = rb.right - r0.left;
          d = 'M' + x1 + ' ' + ya + ' C' + (x1 + 40) + ' ' + ya + ' ' + (x2 + 40) + ' ' + yb + ' ' + (x2 + 2) + ' ' + yb;
        } else {
          const fwd = rb.left > ra.left;
          x1 = (fwd ? ra.right : ra.left) - r0.left; x2 = (fwd ? rb.left : rb.right) - r0.left;
          const mx = (x1 + x2) / 2;
          d = 'M' + x1 + ' ' + ya + ' C' + mx + ' ' + ya + ' ' + mx + ' ' + yb + ' ' + (x2 + (fwd ? -2 : 2)) + ' ' + yb;
        }
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d); p.setAttribute('class', 'wt-link' + (T.stage(a) && T.stage(b) ? ' known' : '')); p.setAttribute('marker-end', 'url(#wt-a)');
        svg.append(p);
        return { a, b, p };
      });
      light(sel);
    }
    let sel = null;
    function light(x) {
      content.classList.toggle('focusing', !!x);
      nodes.forEach((el) => el.classList.remove('lit', 'on'));
      paths.forEach((o) => {
        const on = x && (o.a === x || o.b === x);
        o.p.classList.toggle('lit', !!on);
        if (on) { nodes.get(o.a).classList.add('lit'); nodes.get(o.b).classList.add('lit'); }
      });
      if (x && nodes.has(x)) nodes.get(x).classList.add('lit', 'on');
    }
    function select(x) {
      sel = x; light(x);
      if (!x) { card.hidden = true; return; }
      const st = T.stage(x), t = T.timeOf(x);
      const chips = (title, l) => (l || []).filter((y) => nodes.has(y)).length ? h('div', { class: 'teach-links' }, h('span', { class: 'teach-links-k' }, title),
        l.filter((y) => nodes.has(y)).map((y) => h('button', { type: 'button', class: 'chip wb-link', onclick: () => { nodes.get(y).scrollIntoView({ block: 'center', inline: 'center', behavior: UI.reduced() ? 'auto' : 'smooth' }); select(y); } }, shownName(y) ? y.term : '???'))) : null;
      card.hidden = false;
      card.replaceChildren(
        h('button', { class: 'icon-btn sm wb-card-x', 'aria-label': 'Close', onclick: () => select(null) }, icon('x', 14)),
        h('div', { class: 'wb-item-top' }, h('b', { class: 'wb-term' }, shownName(x) ? x.term : '???'),
          h('span', { class: 'chip' }, L[st]), t ? h('span', { class: 'muted small' }, (t.est ? '≈ ' : '') + t.y) : null),
        h('span', { class: 'pips' }, [1, 2, 3, 4].map((k) => h('i', { class: k <= st ? 'on' : '' }))),
        h('p', { class: 'wb-def' }, x.def),
        x.detail ? h('p', { class: 'muted small' }, x.detail) : null,
        chips('Caused by', x.causedBy), chips('Led to', x.ledTo));
    }
    const ro = new ResizeObserver(() => requestAnimationFrame(draw));
    ro.observe(content);
    requestAnimationFrame(() => {
      draw();
      const hit = content.querySelector('.wt-node.hit');
      if (hit) hit.scrollIntoView({ block: 'center', inline: 'center' });
    });
    wrap.stop = () => ro.disconnect();
    return wrap;
  }

  // ---------- graph ----------
  // Links: a term's definition/detail mentions another term, or a cause → effect link.
  const edgeCache = new WeakMap();
  function edgesFor(list) {
    if (edgeCache.has(list)) return edgeCache.get(list);
    const names = list.map((x) => [x].concat(x.aliases || []).map((n) => (typeof n === 'string' ? n : n.term))
      .map((n) => String(n).replace(/\(.*?\)/g, '').trim().toLowerCase()).filter((n) => n.length >= 4));
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const res = names.map((ns) => ns.length ? new RegExp('\\b(' + ns.map(esc).join('|') + ')\\b', 'i') : null);
    const seen = new Set(), out = [];
    const add = (a, b, cause) => {
      if (a === b) return;
      const k = a < b ? a + ',' + b : b + ',' + a;
      if (seen.has(k)) { if (cause) out.find((e) => e.k === k).cause = true; return; }
      seen.add(k); out.push({ a, b, k, cause });
    };
    const index = new Map(list.map((x, i) => [x, i]));
    list.forEach((x, i) => {
      const text = x.def + ' ' + (x.detail || '');
      res.forEach((re, j) => { if (re && j !== i && re.test(text)) add(i, j, false); });
      (x.causedBy || []).forEach((y) => { if (index.has(y)) add(index.get(y), i, true); });
    });
    edgeCache.set(list, out);
    return out;
  }

  function Graph(list, q) {
    const wrap = h('div', { class: 'wb-graph' });
    const cv = h('canvas', { class: 'wb-canvas' });
    const card = h('div', { class: 'wb-card', hidden: true });
    const hint = h('div', { class: 'wb-hint muted small' }, 'Drag to move · scroll or pinch to zoom · click a card');
    const zoomBtns = h('div', { class: 'wb-zoom' },
      h('button', { class: 'icon-btn sm', 'aria-label': 'Zoom in', onclick: () => zoomAt(W / 2, H / 2, 1.3) }, '+'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Zoom out', onclick: () => zoomAt(W / 2, H / 2, 1 / 1.3) }, '−'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Fit to screen', onclick: () => fit() }, icon('target', 14)));
    wrap.append(cv, zoomBtns, hint, card);
    const ctx = cv.getContext('2d');
    const edges = edgesFor(list);
    const weight = (x) => x.weight || 5;
    const n = list.length;
    // Each term is a little card: its name and a few lines of its definition.
    // More relevant terms get bigger cards. Sizes are in world units.
    const FONT = 'Inter, system-ui, sans-serif';
    const PAD = 8, LINE = 11.5, MAXL = 3;
    function wrap3(text, width, font) {
      ctx.font = font;
      const words = String(text).split(/\s+/), lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width <= width || !cur) cur = t;
        else { lines.push(cur); cur = w; if (lines.length === MAXL) break; }
      }
      if (lines.length < MAXL && cur) lines.push(cur);
      if (lines.length === MAXL && words.join(' ').length > lines.join(' ').length) {
        let last = lines[MAXL - 1];
        while (last.length > 1 && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
        lines[MAXL - 1] = last.replace(/[\s,;:.]+$/, '') + '…';
      }
      return lines;
    }
    function cardFor(it) {
      const w = weight(it), cw = 118 + w * 9;                    // 127–208 wide
      const tsize = 10.5 + w * 0.35;                              // title 10.9–14
      const tfont = '700 ' + tsize + 'px ' + FONT, dfont = '500 9.5px ' + FONT;
      const title = wrap3(shownName(it) ? it.term : '???', cw - PAD * 2, tfont).slice(0, 2);
      const def = wrap3(it.def, cw - PAD * 2, dfont);
      const ch = PAD * 2 + title.length * (tsize + 2) + 4 + def.length * LINE;
      return { w: cw, h: ch, tsize, tfont, dfont, title, def };
    }
    // Start on a spiral, heaviest terms in the middle.
    const order = list.map((x, i) => i).sort((a, b) => weight(list[b]) - weight(list[a]));
    const nodes = new Array(n);
    order.forEach((i, k) => {
      const a = k * 2.4, rad = 60 * Math.sqrt(k + 1);
      const c = cardFor(list[i]);
      nodes[i] = { x: Math.cos(a) * rad, y: Math.sin(a) * rad, vx: 0, vy: 0, c, r: Math.hypot(c.w, c.h) / 2, it: list[i], nb: new Set() };
    });
    edges.forEach((e) => { nodes[e.a].nb.add(e.b); nodes[e.b].nb.add(e.a); });

    let W = 0, H = 0, dpr = 1, zoom = 1, panX = 0, panY = 0, alpha = 1, raf = 0, sel = -1, hover = -1, alive = true;
    let accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8B5CF6';
    const ptrs = new Map();
    let dragNode = -1, moved = false, pinch = null, panStart = null;

    function size() {
      const r = wrap.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      kick();
    }
    const ro = new ResizeObserver(size);

    // Forces: cards push each other away and never overlap, links pull
    // together, and a center pull that's stronger for more relevant terms.
    function tick() {
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          // Collision: keep a gap between the two card rectangles.
          const ox = (a.c.w + b.c.w) / 2 + 14 - Math.abs(dx), oy = (a.c.h + b.c.h) / 2 + 14 - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            const sa = i === dragNode ? 0 : j === dragNode ? 1 : 0.5, sb = 1 - sa;
            if (ox / (a.c.w + b.c.w) < oy / (a.c.h + b.c.h)) { const p = ox * (dx < 0 ? -1 : 1) * 0.5; a.x += p * sa * 2; b.x -= p * sb * 2; }
            else { const p = oy * (dy < 0 ? -1 : 1) * 0.5; a.y += p * sa * 2; b.y -= p * sb * 2; }
            continue;
          }
          const d2 = dx * dx + dy * dy;
          if (d2 > 640000) continue;
          const f = (600 / Math.max(d2, 100)) * alpha;
          a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      edges.forEach((e) => {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - (e.cause ? 210 : 260)) * 0.006 * alpha;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      });
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        const g = (0.0005 + (weight(a.it) / 10) ** 2 * 0.004) * alpha;
        a.vx -= a.x * g; a.vy -= a.y * g;
        if (i === dragNode) { a.vx = a.vy = 0; continue; }
        a.vx *= 0.6; a.vy *= 0.6;
        a.x += a.vx; a.y += a.vy;
      }
      alpha = Math.max(alpha * 0.985, dragNode >= 0 ? 0.25 : 0);
    }

    const toScreen = (x, y) => [W / 2 + (x + panX) * zoom, H / 2 + (y + panY) * zoom];
    const toWorld = (sx, sy) => [(sx - W / 2) / zoom - panX, (sy - H / 2) / zoom - panY];

    function rrect(x, y, w, hh, r) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, hh, r); else ctx.rect(x, y, w, hh);
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const focus = sel >= 0 ? sel : hover;
      const lit = focus >= 0 ? nodes[focus].nb : null;
      const match = q ? (x) => x.term.toLowerCase().includes(q) : null;
      // Draw in world units, so card text scales with zoom.
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (W / 2 + panX * zoom), dpr * (H / 2 + panY * zoom));
      edges.forEach((e) => {
        const on = focus >= 0 && (e.a === focus || e.b === focus);
        if (focus >= 0 && !on && sel >= 0) return;
        ctx.strokeStyle = on ? rgba(accent, 0.8) : e.cause ? rgba(accent, 0.3) : 'rgba(255,255,255,0.09)';
        ctx.lineWidth = (on ? 1.8 : 1) / zoom;
        ctx.beginPath(); ctx.moveTo(nodes[e.a].x, nodes[e.a].y); ctx.lineTo(nodes[e.b].x, nodes[e.b].y); ctx.stroke();
      });
      const showDef = zoom >= 0.62, showTitle = zoom >= 0.38;
      const labels = [];
      for (let i = 0; i < n; i++) {
        const a = nodes[i], c = a.c;
        const [sx, sy] = toScreen(a.x, a.y);
        const hw = (c.w / 2) * zoom, hh = (c.h / 2) * zoom;
        if (sx + hw < 0 || sy + hh < 0 || sx - hw > W || sy - hh > H) continue;
        const dim = focus >= 0 && i !== focus && !lit.has(i);
        const t = Engine.tierOf(a.it), own = Cards.has(a.it.id), cs = own ? Cards.stateOf(a.it.id) : null;
        const x0 = a.x - c.w / 2, y0 = a.y - c.h / 2;
        ctx.globalAlpha = dim ? 0.2 : own ? 1 : 0.45;
        rrect(x0, y0, c.w, c.h, 9);
        ctx.fillStyle = 'rgba(20,21,27,0.94)';
        ctx.fill();
        ctx.lineWidth = (i === focus ? 2.2 : 1.2) / zoom;
        ctx.strokeStyle = i === focus || (match && match(a.it)) ? '#fff' : t === 'must' ? accent : t === 'good' ? rgba(accent, 0.5) : 'rgba(200,205,220,0.28)';
        if (cs && i !== focus && (cs.f || cs.g)) {
          if (cs.f === 2) {   // Holo / Prismatic: a rainbow edge
            const g = ctx.createLinearGradient(x0, y0, x0 + c.w, y0 + c.h);
            ['#ff6b9d', '#ffd166', '#5eead4', '#60a5fa', '#c084fc'].forEach((col, k) => g.addColorStop(k / 4, col));
            ctx.strokeStyle = g;
          } else if (cs.g) ctx.strokeStyle = '#E8B93E';   // Gilded
          else ctx.strokeStyle = '#cfd6e4';                // Foil
          ctx.lineWidth = 2 / zoom;
        }
        ctx.stroke();
        if (cs && cs.f === 2 && cs.g) { ctx.strokeStyle = '#E8B93E'; ctx.lineWidth = 1 / zoom; rrect(x0 + 3, y0 + 3, c.w - 6, c.h - 6, 7); ctx.stroke(); }
        if (t === 'must') { ctx.fillStyle = accent; rrect(x0, y0 + 7, 3, c.h - 14, 1.5); ctx.fill(); }
        if (showTitle) {
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.font = c.tfont; ctx.fillStyle = 'rgba(245,247,252,0.96)';
          c.title.forEach((ln, k) => ctx.fillText(ln, x0 + PAD, y0 + PAD + k * (c.tsize + 2)));
          if (showDef) {
            ctx.font = c.dfont; ctx.fillStyle = 'rgba(190,196,212,0.82)';
            const top = y0 + PAD + c.title.length * (c.tsize + 2) + 4;
            c.def.forEach((ln, k) => ctx.fillText(ln, x0 + PAD, top + k * LINE));
          } else {
            ctx.fillStyle = 'rgba(190,196,212,0.22)';
            const top = y0 + PAD + c.title.length * (c.tsize + 2) + 6;
            c.def.forEach((ln, k) => { rrect(x0 + PAD, top + k * LINE, (c.w - PAD * 2) * (k === c.def.length - 1 ? 0.6 : 1), 4, 2); ctx.fill(); });
          }
        } else if (!dim && (weight(a.it) >= 9 || i === focus || (lit && lit.has(i)) || (match && match(a.it)))) {
          labels.push([a.it.term, sx, sy - hh - 6, i === focus]);
        }
      }
      ctx.globalAlpha = 1;
      // Zoomed far out: the important terms keep a readable name above their card.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      labels.forEach(([txt, x, y, f]) => {
        ctx.font = (f ? '700 ' : '600 ') + '11.5px ' + FONT;
        ctx.fillStyle = f ? '#fff' : 'rgba(235,238,245,0.88)';
        ctx.fillText(txt, x, y);
      });
    }
    function rgba(hex, a) {
      const v = parseInt(String(hex).replace('#', ''), 16) || 0x8B5CF6;
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
    }

    function frame() {
      raf = 0;
      if (!alive) return;
      if (alpha > 0.003) { tick(); tick(); }
      draw();
      if (alpha > 0.003 || dragNode >= 0) raf = requestAnimationFrame(frame);
    }
    function kick(heat) { if (heat) alpha = Math.max(alpha, heat); if (!raf && alive) raf = requestAnimationFrame(frame); }

    // The card under the pointer (the one drawn on top wins).
    function nodeAt(sx, sy) {
      const [wx, wy] = toWorld(sx, sy);
      for (let i = n - 1; i >= 0; i--) {
        const a = nodes[i];
        if (Math.abs(wx - a.x) <= a.c.w / 2 && Math.abs(wy - a.y) <= a.c.h / 2) return i;
      }
      return -1;
    }
    function zoomAt(sx, sy, f) {
      const [wx, wy] = toWorld(sx, sy);
      zoom = Math.max(0.12, Math.min(4, zoom * f));
      panX = (sx - W / 2) / zoom - wx; panY = (sy - H / 2) / zoom - wy;
      kick();
    }
    function fit() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach((a) => {
        minX = Math.min(minX, a.x - a.c.w / 2); maxX = Math.max(maxX, a.x + a.c.w / 2);
        minY = Math.min(minY, a.y - a.c.h / 2); maxY = Math.max(maxY, a.y + a.c.h / 2);
      });
      if (!isFinite(minX)) return;
      zoom = Math.max(0.12, Math.min(1.2, Math.min(W / (maxX - minX + 80), H / (maxY - minY + 80))));
      panX = -(minX + maxX) / 2; panY = -(minY + maxY) / 2;
      kick();
    }
    // Start zoomed in on the middle, where the most relevant cards are.
    function home() { zoom = 0.8; panX = 0; panY = 0; kick(); }

    function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      ptrs.set(e.pointerId, p);
      moved = false;
      if (ptrs.size === 2) {   // pinch: zoom and pan with two fingers
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], panX, panY };
        dragNode = -1; panStart = null;
        return;
      }
      const i = nodeAt(p[0], p[1]);
      if (i >= 0) { dragNode = i; kick(0.3); } else panStart = { p, panX, panY };
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!ptrs.has(e.pointerId)) {   // hover
        const i = nodeAt(p[0], p[1]);
        if (i !== hover) { hover = i; cv.style.cursor = i >= 0 ? 'pointer' : 'grab'; kick(); }
        return;
      }
      const prev = ptrs.get(e.pointerId);
      if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 3) moved = true;
      ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        zoom = Math.max(0.2, Math.min(5, pinch.zoom * (d / pinch.d)));
        panX = pinch.panX + (mid[0] - pinch.mid[0]) / zoom; panY = pinch.panY + (mid[1] - pinch.mid[1]) / zoom;
        kick(); return;
      }
      if (dragNode >= 0) {
        const [wx, wy] = toWorld(p[0], p[1]);
        nodes[dragNode].x = wx; nodes[dragNode].y = wy;
        kick(0.3);
      } else if (panStart) {
        panX = panStart.panX + (p[0] - panStart.p[0]) / zoom; panY = panStart.panY + (p[1] - panStart.p[1]) / zoom;
        cv.style.cursor = 'grabbing';
        kick();
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (pinch) { if (ptrs.size < 2) pinch = null; return; }
      if (!moved) select(dragNode >= 0 ? dragNode : -1);
      dragNode = -1; panStart = null; cv.style.cursor = 'grab';
      kick();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

    function select(i) {
      sel = i;
      if (i < 0) { card.hidden = true; kick(); return; }
      const x = nodes[i].it, links = Array.from(nodes[i].nb).map((j) => nodes[j].it), own = Cards.has(x.id), cst = Cards.stateOf(x.id);
      card.hidden = false;
      card.replaceChildren(
        h('button', { class: 'icon-btn sm wb-card-x', 'aria-label': 'Close', onclick: () => select(-1) }, icon('x', 14)),
        h('div', { class: 'wb-item-top' }, h('b', { class: 'wb-term' }, shownName(x) ? x.term : '???'),
          h('span', { class: 'chip wb-tier ' + Engine.tierOf(x) }, TIERS.find((t) => t[0] === Engine.tierOf(x))[1]),
          h('span', { class: 'chip wb-rar ' + Cards.rarityOf(x) }, Cards.rarityOf(x)),
          own && (cst.f || cst.g) ? h('span', { class: 'chip wb-fin' }, Cards.finishName(cst)) : null,
          x.weight ? h('span', { class: 'wb-weight muted small mono' }, x.weight + '/10') : null),
        h('p', { class: 'wb-def' }, x.def),
        h('p', { class: 'muted small' }, Cards.nextText(x)),
        x.detail ? h('p', { class: 'muted small' }, x.detail) : null,
        links.length ? h('div', { class: 'rec-terms' }, links.slice(0, 14).map((y) =>
          h('button', { type: 'button', class: 'chip wb-link', onclick: () => { const j = list.indexOf(y); select(j); centerOn(j); } }, shownName(y) ? y.term : '???'))) : null);
      kick();
    }
    function centerOn(i) { panX = -nodes[i].x; panY = -nodes[i].y; kick(); }

    // Settle the layout a bit before the first frame, then fit it on screen.
    for (let k = 0; k < 260; k++) tick();
    requestAnimationFrame(() => { size(); home(); ro.observe(wrap); });
    wrap.stop = () => { alive = false; ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
    return wrap;
  }
})();
