// Tree: a Teach Me style. Picks about 12 terms that caused and led to each other,
//   1. Learn: read each term's card (its causes/effects are hidden).
//   2. Connect: drag from a cause's dot onto what it led to (or tap the dot, then
//      tap the effect). Right links stay drawn; wrong ones flash red.
//   3. Quiz: one question per term, cause & effect where it has links; misses
//      come back until they are right.
// Answers climb terms up the Teach Me ladder (Modes.teach.climb).
window.Modes = window.Modes || {};
Modes.tree = {
  SIZE: 12, MIN_LINKS: 4,

  // Cause → effect links between the given terms, with no duplicates.
  edges(items) {
    const set = new Set(items), seen = new Set(), out = [];
    const add = (a, b) => { const k = a.id + '>' + b.id; if (a !== b && set.has(a) && set.has(b) && !seen.has(k)) { seen.add(k); out.push({ a, b, k }); } };
    items.forEach((x) => { (x.ledTo || []).forEach((y) => add(x, y)); (x.causedBy || []).forEach((y) => add(y, x)); });
    return out;
  },

  // Grow a connected set from a well-linked term you haven't mastered yet.
  // Uses the chosen Relevancy first; if that can't fill a set, linked terms from
  // the whole topic fill it out.
  pickSet(c) {
    const a = this.grow(c.items);
    if (a.items.length >= this.SIZE || !c.topicAll || c.topicAll.length === c.items.length) return a;
    const b = this.grow(c.topicAll, new Set(c.items));
    return b.items.length > a.items.length ? b : a;
  },
  grow(uni, prefer) {
    const T = Modes.teach;
    const inUni = new Set(uni);
    const nb = new Map(uni.map((x) => [x, []]));
    this.edges(uni).forEach((e) => { nb.get(e.a).push(e.b); nb.get(e.b).push(e.a); });
    const score = (x) => (T.stage(x) === 4 ? 0 : 10) + (prefer && prefer.has(x) ? 6 : 0) + Math.min(nb.get(x).length, 5) + Math.random() * 2;
    const seeds = uni.filter((x) => nb.get(x).length).map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).map((o) => o.x);
    const set = [], inSet = new Set();
    for (const seed of seeds) {
      if (set.length >= this.SIZE) break;
      if (inSet.has(seed)) continue;
      const queue = [seed];
      while (queue.length && set.length < this.SIZE) {
        const x = queue.shift();
        if (inSet.has(x) || !inUni.has(x)) continue;
        inSet.add(x); set.push(x);
        // Prefer neighbors close in time to where the set started.
        const fit = new Map(nb.get(x).map((y) => [y, score(y) - T.distance(y, seed)]));
        nb.get(x).filter((y) => !inSet.has(y)).sort((a, b) => fit.get(b) - fit.get(a)).forEach((y) => queue.push(y));
      }
    }
    return { items: set, edges: this.edges(set) };
  },

  available(c) {
    const s = this.pickSet(c);
    return s.items.length >= 5 && s.edges.length >= this.MIN_LINKS ? null : 'Tree needs terms with cause & effect links. Try a wider Relevancy or topic.';
  },

  start(root, c, set) {
    const { h, icon } = UI, T = Modes.teach;
    const items = set.items, edges = set.edges;
    const pool = c.all && c.all.length >= 8 ? c.all : c.items;
    let off = () => {}, ro = null;
    const strip = h('div', { class: 'step-strip' });
    const fill = h('i'), count = h('span', { class: 'mode-count' });
    const stageEl = h('div', { class: 'q-stage tree-stage' });
    root.replaceChildren(strip, h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stageEl);
    const header = (kind, title, right) => strip.replaceChildren(h('span', { class: 'step-num' }, kind), h('span', { class: 'step-title' }, title),
      h('span', { class: 'step-right' }, h('span', { class: 'muted small' }, right || '')));
    // Overall progress: learn 12 + connect + quiz 12.
    const progress = (part, frac) => { fill.style.width = Math.round(((part + frac) / 3) * 100) + '%'; };
    const stats = { found: 0, hinted: 0, mistakes: 0, quizRight: 0, quizAsked: 0, up: 0 };
    const missed = new Map();

    // ---------- 1. learn ----------
    function learn() {
      let k = 0;
      function show() {
        if (k >= items.length) return connect();
        const it = items[k];
        header('Learn', 'Term ' + (k + 1) + ' of ' + items.length, 'Remember how they might connect');
        count.textContent = (k + 1) + ' / ' + items.length;
        progress(0, k / items.length);
        const seen = (list) => {
          const all = Object.assign({}, Store.get('learned') || {});
          list.forEach((x) => { if (T.stage(x) === 0) all[x.id] = { stage: 1 }; });
          Store.set('learned', all);
        };
        const go = () => { seen([it]); k++; show(); };
        stageEl.replaceChildren(T.card(it, h('span', { class: 'tree-learn-btns' },
          h('button', { class: 'btn ghost sm', onclick: () => { seen(items); k = items.length; show(); } }, 'Skip to connecting'),
          h('button', { class: 'btn primary', onclick: go }, k + 1 < items.length ? 'Next' : 'Start connecting', icon('arrow', 16))), { noLinks: true }));
        stageEl.querySelector('.btn.primary').focus({ preventScroll: true });
        off(); off = UI.keys((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      show();
    }

    // ---------- 2. connect ----------
    function connect() {
      off();
      root.classList.add('tree-wide');
      header('Connect', 'Drag from a cause’s dot to what it led to', edges.length + ' links to find');
      progress(1, 0);
      const want = new Map(edges.map((e) => [e.k, e]));
      const found = new Set(), shown = new Set();   // shown: revealed by hint / give up
      let armed = null, done = false;

      // Columns in time order, so causes tend to sit left of their effects.
      const order = items.slice().sort((a, b) => (a.year || 9999) - (b.year || 9999) || (a.page || 0) - (b.page || 0));
      const perCol = items.length > 9 ? 3 : 2;
      const cols = [];
      for (let i = 0; i < order.length; i += perCol) cols.push(order.slice(i, i + perCol));
      const nodeOf = new Map();
      const board = h('div', { class: 'tree-board' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tree-svg');
      svg.innerHTML = '<defs>' + ['ok', 'bad', 'warn', 'hint', 'temp'].map((k) =>
        '<marker id="ta-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ta-' + k + '"/></marker>').join('') + '</defs><g class="tree-lines"></g><line class="tree-temp" marker-end="url(#ta-temp)" style="display:none"/>';
      const lines = svg.querySelector('.tree-lines'), temp = svg.querySelector('.tree-temp');
      const colsEl = h('div', { class: 'tree-cols' }, cols.map((col) => h('div', { class: 'tree-col' }, col.map((it) => {
        const dot = h('button', { type: 'button', class: 'tree-dot', 'aria-label': 'Link ' + it.term + ' to what it led to' });
        const el = h('div', { class: 'tree-node', 'data-id': it.id },
          h('b', null, it.term), h('span', { class: 'tree-def' }, it.def), dot);
        nodeOf.set(it.id, el);
        el.addEventListener('click', (e) => { if (e.target === dot) return; if (armed) { tryLink(armed, it); disarm(); } else info(it); });
        dot.addEventListener('pointerdown', (e) => startDrag(e, it, dot));
        dot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); armed === it ? disarm() : arm(it); } });
        return el;
      }))));
      board.append(colsEl, svg);
      const status = h('div', { class: 'tree-status' });
      const infoEl = h('div', { class: 'tree-info muted small' }, 'Tip: click a term to read its definition again. Tap a dot, then tap another term, if dragging is awkward.');
      const hintBtn = h('button', { class: 'btn ghost sm', onclick: hint }, icon('bulb', 15), 'Hint');
      const giveBtn = h('button', { class: 'btn ghost sm', onclick: reveal }, 'Show the rest');
      const nextBtn = h('button', { class: 'btn primary', onclick: () => quiz() }, 'Quiz me', icon('arrow', 16));
      nextBtn.hidden = true;
      stageEl.replaceChildren(h('div', { class: 'card tree-card swap-in' }, board,
        h('div', { class: 'tree-foot' }, status, h('span', { class: 'tree-btns' }, hintBtn, giveBtn, nextBtn)), infoEl));

      function info(it) {
        infoEl.replaceChildren(h('b', null, it.term), ' — ' + it.def + (it.year ? ' (' + it.year + ')' : ''));
        infoEl.classList.remove('muted');
      }
      function sync() {
        status.textContent = found.size + ' / ' + edges.length + ' links found' + (stats.mistakes ? ' · ' + stats.mistakes + ' wrong' : '');
        count.textContent = found.size + ' / ' + edges.length;
        progress(1, (found.size + shown.size) / edges.length);
        const complete = found.size + shown.size >= edges.length;
        if (complete && !done) {
          done = true; nextBtn.hidden = false; hintBtn.hidden = true; giveBtn.hidden = true;
          nextBtn.focus({ preventScroll: true });
          UI.toast(shown.size ? 'All links shown' : 'Every link found!');
          off(); off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); quiz(); } });
        }
      }

      // Geometry: where a line leaves/enters a node's box, in board coordinates.
      function box(it) {
        const b = board.getBoundingClientRect(), r = nodeOf.get(it.id).getBoundingClientRect();
        return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, hw: r.width / 2 + 4, hh: r.height / 2 + 4 };
      }
      function edgePt(bx, tx, ty) {
        const dx = tx - bx.x, dy = ty - bx.y;
        if (!dx && !dy) return [bx.x, bx.y];
        const t = Math.min(bx.hw / Math.abs(dx || 1e-9), bx.hh / Math.abs(dy || 1e-9));
        return [bx.x + dx * Math.min(t, 1), bx.y + dy * Math.min(t, 1)];
      }
      function line(a, b, cls) {
        const A = box(a), B = box(b);
        const [x1, y1] = edgePt(A, B.x, B.y), [x2, y2] = edgePt(B, A.x, A.y);
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'tl tl-' + cls); l.setAttribute('marker-end', 'url(#ta-' + cls + ')');
        return l;
      }
      function draw() {
        svg.setAttribute('width', board.clientWidth); svg.setAttribute('height', board.clientHeight);
        lines.replaceChildren(...edges.filter((e) => found.has(e.k) || shown.has(e.k)).map((e) => line(e.a, e.b, found.has(e.k) ? 'ok' : 'hint')));
      }
      function flash(a, b, cls) {
        const l = line(a, b, cls);
        lines.append(l);
        setTimeout(() => l.classList.add('fade'), 500);
        setTimeout(() => l.remove(), 1100);
      }
      ro = new ResizeObserver(draw); ro.observe(board);

      function tryLink(a, b) {
        if (done || a === b) return;
        const k = a.id + '>' + b.id, rev = b.id + '>' + a.id;
        if (found.has(k) || shown.has(k)) return;
        const n1 = nodeOf.get(a.id), n2 = nodeOf.get(b.id);
        if (want.has(k)) {
          found.add(k); stats.found++;
          [n1, n2].forEach((n) => { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop', 'linked'); });
          infoEl.replaceChildren(icon('check', 14), ' ', h('b', null, a.term), ' led to ', h('b', null, b.term), '.');
          infoEl.classList.remove('muted');
          draw();
        } else {
          stats.mistakes++;
          missed.set(a.id, a); missed.set(b.id, b);
          const reversed = want.has(rev) && !found.has(rev);
          flash(a, b, reversed ? 'warn' : 'bad');
          [n1, n2].forEach((n) => { n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); });
          infoEl.replaceChildren(icon('x', 14), ' ', reversed
            ? 'Right pair, wrong direction: ' + b.term + ' came first and led to ' + a.term + '.'
            : a.term + ' didn’t lead to ' + b.term + '.');
          infoEl.classList.remove('muted');
        }
        sync();
      }
      function arm(it) { disarm(); armed = it; nodeOf.get(it.id).classList.add('armed'); board.classList.add('arming'); }
      function disarm() { if (armed) nodeOf.get(armed.id).classList.remove('armed'); armed = null; board.classList.remove('arming'); }

      // Drag from a dot; a press without moving arms tap-to-link instead.
      function startDrag(e, it, dot) {
        if (done) return;
        e.preventDefault();
        dot.setPointerCapture(e.pointerId);
        const A = box(it), b0 = board.getBoundingClientRect();
        let moved = false;
        const move = (ev) => {
          const x = ev.clientX - b0.left, y = ev.clientY - b0.top;
          if (!moved && Math.hypot(x - A.x, y - A.y) < 8) return;
          moved = true;
          const [sx, sy] = edgePt(A, x, y);
          temp.setAttribute('x1', sx); temp.setAttribute('y1', sy); temp.setAttribute('x2', x); temp.setAttribute('y2', y);
          temp.style.display = '';
          const over = document.elementFromPoint(ev.clientX, ev.clientY);
          board.querySelectorAll('.tree-node.target').forEach((n) => n.classList.remove('target'));
          const n = over && over.closest && over.closest('.tree-node');
          if (n && n.dataset.id !== it.id) n.classList.add('target');
        };
        const up = (ev) => {
          dot.removeEventListener('pointermove', move); dot.removeEventListener('pointerup', up); dot.removeEventListener('pointercancel', up);
          temp.style.display = 'none';
          board.querySelectorAll('.tree-node.target').forEach((n) => n.classList.remove('target'));
          if (!moved) { armed === it ? disarm() : arm(it); return; }
          const over = document.elementFromPoint(ev.clientX, ev.clientY);
          const n = over && over.closest && over.closest('.tree-node');
          const to = n && items.find((x) => x.id === n.dataset.id);
          disarm();
          if (to) tryLink(it, to);
        };
        dot.addEventListener('pointermove', move); dot.addEventListener('pointerup', up); dot.addEventListener('pointercancel', up);
      }

      function hint() {
        const e = edges.find((x) => !found.has(x.k) && !shown.has(x.k));
        if (!e) return;
        shown.add(e.k); stats.hinted++;
        missed.set(e.a.id, e.a); missed.set(e.b.id, e.b);
        infoEl.replaceChildren(icon('bulb', 14), ' ', h('b', null, e.a.term), ' led to ', h('b', null, e.b.term), '. (Shown dashed.)');
        infoEl.classList.remove('muted');
        draw(); sync();
      }
      function reveal() {
        edges.forEach((e) => { if (!found.has(e.k) && !shown.has(e.k)) { shown.add(e.k); missed.set(e.a.id, e.a); missed.set(e.b.id, e.b); } });
        draw(); sync();
      }

      off(); off = UI.keys((e) => { if (e.key === 'Escape') disarm(); });
      requestAnimationFrame(() => { draw(); sync(); });
    }

    // ---------- 3. quiz ----------
    function quiz() {
      off(); if (ro) { ro.disconnect(); ro = null; }
      root.classList.remove('tree-wide');
      const queue = Engine.shuffle(items.slice());
      const tried = new Set();
      const linked = new Set(edges.flatMap((e) => [e.a.id, e.b.id]));
      let state = 'ask';
      function ask() {
        const it = queue[0];
        if (!it) return finish();
        state = 'ask';
        header('Quiz', 'Every term from your tree', queue.length + ' left');
        count.textContent = (items.length - queue.length) + ' / ' + items.length;
        progress(2, (items.length - new Set(queue).size) / items.length);
        let q = null;
        if (linked.has(it.id) && Math.random() < 0.7) {
          q = Engine.question(it, 3, pool, -1, { only: ['causedBy', 'ledTo'] });
          if (!q.kind) q = null;
        }
        if (!q) {
          const s = T.stage(it);
          q = s >= 3 ? Engine.question(it, 2, pool, -1, { only: ['term2def'] }) : Engine.question(it, s >= 2 ? 2 : 1, pool, -1, { only: ['def2term'] });
        }
        if (q.type !== 'mc') q = Engine.question(it, 2, pool, -1, { only: ['def2term'] });
        const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
        q.options.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => choose(o, e.currentTarget) },
          h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text))));
        const body = h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, q.label),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt), list);
        stageEl.replaceChildren(body);

        function choose(o, btn) {
          if (state !== 'ask') return;
          state = 'shown';
          list.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (q.options[j].correct) b.classList.add('correct'); });
          if (!o.correct) btn.classList.add('wrong');
          const first = !tried.has(it.id);
          tried.add(it.id);
          if (first) { stats.quizAsked++; if (o.correct) stats.quizRight++; }
          if (!o.correct) missed.set(it.id, it);
          // Only the first try moves the ladder; a retry just has to be right to finish.
          const mv = first ? T.climb(it, o.correct) : null;
          if (mv && mv.after > mv.before) stats.up++;
          const L = T.LADDER;
          const box = h('div', { class: 'explain ' + (o.correct ? 'ok' : 'bad') },
            h('div', { class: 'explain-head' }, icon(o.correct ? 'check' : 'x', 16), o.correct ? 'Correct' : 'Not quite: it will come back',
              mv && mv.after !== mv.before ? h('span', { class: 'ladder-move ' + (mv.after > mv.before ? 'up' : 'down') },
                icon(mv.after > mv.before ? 'up' : 'down', 14), (mv.after > mv.before ? '' : 'Back to ') + L[mv.after]) : null),
            q.explain ? h('p', null, q.explain) : h('p', null, h('b', null, it.term), ' — ', it.def),
            h('div', { class: 'explain-foot' }, h('span'), h('button', { class: 'btn primary', onclick: advance }, 'Next', icon('arrow', 16))));
          body.append(box);
          box.querySelector('.btn.primary').focus({ preventScroll: true });
          box.scrollIntoView({ block: 'nearest', behavior: UI.reduced() ? 'auto' : 'smooth' });
          function advance() { queue.shift(); if (!o.correct) queue.push(it); ask(); }
        }
        off(); off = UI.keys((e) => {
          if (state === 'ask' && /^[1-4]$/.test(e.key)) { const b = list.children[+e.key - 1]; if (b) b.click(); }
          else if (state === 'shown' && e.key === 'Enter') { e.preventDefault(); const b = body.querySelector('.explain .btn.primary'); if (b) b.click(); }
        });
      }
      ask();
    }

    function finish() {
      off();
      progress(3, 0);
      const pct = stats.quizAsked ? (stats.quizRight / stats.quizAsked) * 100 : 0;
      UI.results(root, {
        pct, label: 'quiz first try',
        stats: [['links found', stats.found + '/' + edges.length], ['wrong links', stats.mistakes], ['hints', stats.hinted], ['moved up', stats.up]],
        review: Array.from(missed.values()).map((i) => ({ prompt: i.def, answer: i.term })),
        bestKey: c.key + '|tree', bestValue: Math.round(pct),
        extra: h('div', { class: 'teach-after' }, h('div', { class: 'section-label' }, 'Your ladder here'), T.ladderBar(c.items)),
        onRetry: c.restart, onBack: c.exit
      });
    }

    learn();
    return () => { off(); if (ro) ro.disconnect(); root.classList.remove('tree-wide'); };
  }
};
