window.Modes = window.Modes || {};
Modes.matching = {
  name: 'Matching', icon: 'match',
  desc: 'Pair each term with its definition against the clock.',
  available: (c) => (c.items.length >= 4 ? null : 'Needs at least 4 items'),
  start(root, c) {
    const { h, icon } = UI;
    const n = { easy: 6, medium: 8, hard: 10, adaptive: 8 }[c.diff];
    const src = c.diff === 'adaptive' ? Engine.weighted(c.items) : Engine.shuffle(Engine.forDiff(c.items, c.diff));
    const seen = new Set(), set = [];
    for (const it of src) {
      const k = Engine.norm(it.term);
      if (seen.has(k)) continue;
      seen.add(k); set.push(it);
      if (set.length === n) break;
    }
    const penalty = c.diff === 'hard' ? 3000 : 0;
    let sel = null, matched = 0, mistakes = 0, extra = 0, done = false;
    const missedIds = new Set();
    const t0 = performance.now();

    const clock = h('span', { class: 'mode-count mono' }, '0:00');
    const fill = h('i');
    const left = h('div', { class: 'match-col' });
    const right = h('div', { class: 'match-col' });

    function tile(item, side, k) {
      const t = h('button', { class: 'tile ' + side, style: { '--i': k }, onclick: () => tap(t) },
        side === 'term' ? item.term : item.def);
      t.dataset.id = item.id; t.dataset.side = side;
      return t;
    }
    Engine.shuffle(set).forEach((it, k) => left.append(tile(it, 'term', k)));
    Engine.shuffle(set).forEach((it, k) => right.append(tile(it, 'def', k)));

    root.append(
      h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), h('span', { class: 'mode-count' }, icon('clock', 15)), clock),
      penalty ? h('p', { class: 'muted small center' }, 'Hard: each wrong pair adds 3 seconds.') : '',
      h('div', { class: 'match-grid' }, left, right));

    const timer = setInterval(() => { clock.textContent = UI.fmtTime(performance.now() - t0 + extra); }, 250);

    function tap(t) {
      if (done || t.classList.contains('ok')) return;
      if (!sel) { sel = t; t.classList.add('sel'); return; }
      if (sel === t) { t.classList.remove('sel'); sel = null; return; }
      if (sel.dataset.side === t.dataset.side) { sel.classList.remove('sel'); sel = t; t.classList.add('sel'); return; }
      const a = sel, b = t; sel = null;
      a.classList.remove('sel');
      if (a.dataset.id === b.dataset.id) {
        [a, b].forEach((x) => { x.classList.add('ok'); x.disabled = true; });
        matched++;
        Store.bump(a.dataset.id, missedIds.has(a.dataset.id) ? 0 : 1);
        fill.style.width = (matched / set.length) * 100 + '%';
        if (matched === set.length) setTimeout(finish, UI.reduced() ? 0 : 450);
      } else {
        mistakes++; extra += penalty;
        missedIds.add(a.dataset.id); missedIds.add(b.dataset.id);
        [a, b].forEach((x) => { x.classList.remove('no'); void x.offsetWidth; x.classList.add('no'); });
        if (penalty) UI.toast('+3s');
      }
    }

    function finish() {
      done = true; clearInterval(timer);
      const ms = performance.now() - t0 + extra;
      const acc = Math.round((set.length / (set.length + mistakes)) * 100);
      const prev = Store.best(c.key);
      UI.results(root, {
        pct: acc, big: UI.fmtTime(ms), label: 'time',
        stats: [['pairs', set.length], ['wrong tries', mistakes], ['best', UI.fmtTime(Math.min(prev == null ? ms : prev, ms))]],
        review: set.filter((i) => missedIds.has(i.id)).map((i) => ({ prompt: i.def, answer: i.term })),
        bestKey: c.key, bestValue: Math.round(ms), lower: true,
        onRetry: c.restart, onBack: c.exit
      });
    }

    return () => clearInterval(timer);
  }
};
