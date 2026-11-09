// Word Bank: every term with its short definition. List view sorts A–Z (with a
// letter scroll tab on the right) or by relevancy. Graph view draws every term
// as a node linked to the terms it mentions and its causes/effects; more
// relevant terms are bigger and pulled to the middle. Pan, zoom, drag nodes,
// and pinch on touch screens. Opens from the button next to Session.
(function () {
  const { h, icon } = UI;
  const TIERS = [['must', 'Must Know'], ['good', 'Good to Know'], ['niche', 'Niche']];
  let panel = null, items = [], view = Store.pref('wbView') || 'list', sort = Store.pref('wbSort') || 'az', query = '';
  let graph = null;

  const pill = h('button', { class: 'session-pill bank-pill', type: 'button', 'aria-haspopup': 'dialog', onclick: open },
    icon('book', 16), h('span', { class: 'pill-text' }, 'Word Bank'));
  document.querySelector('.session-pill').before(pill);

  // Which terms: the unit you're in, else the subject's units, else everything.
  function scope() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    const units = window.UNITS || [];
    const ui = p.indexOf('u'), si = p.indexOf('s');
    if (ui >= 0 && units.some((u) => u.id === p[ui + 1])) { const u = units.find((x) => x.id === p[ui + 1]); return { label: u.name, units: [u] }; }
    if (si >= 0) { const s = (window.SUBJECTS || []).find((x) => x.id === p[si + 1]); if (s) return { label: s.name, units: units.filter((u) => u.subject === s.id) }; }
    return { label: 'All subjects', units };
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
    const sortSeg = UI.seg([{ value: 'az', label: 'A–Z' }, { value: 'rel', label: 'Relevance' }], sort, (v) => { sort = v; Store.setPref('wbSort', v); render(); });
    const viewSeg = UI.seg([{ value: 'list', label: 'List' }, { value: 'graph', label: 'Graph' }], view, (v) => { view = v; Store.setPref('wbView', v); render(); });
    panel = h('div', { class: 'wb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Word Bank' },
      h('div', { class: 'wb-head' },
        h('div', { class: 'wb-title' }, h('div', { class: 'eyebrow' }, label), h('h2', null, 'Word Bank'), h('span', { class: 'muted small' }, items.length + ' terms')),
        h('div', { class: 'wb-controls' }, viewSeg, h('span', { class: 'wb-sort' }, sortSeg), search),
        h('button', { class: 'icon-btn', 'aria-label': 'Close word bank', onclick: close }, icon('x', 20))),
      body);
    document.body.append(panel);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => panel.classList.add('show'));

    function render() {
      if (graph) { graph.stop(); graph = null; }
      panel.classList.toggle('graph-on', view === 'graph');
      const q = query.trim().toLowerCase();
      const shown = q ? items.filter((x) => (x.term + ' ' + x.def + ' ' + (x.aliases || []).join(' ')).toLowerCase().includes(q)) : items;
      if (view === 'graph') body.replaceChildren(graph = Graph(shown, q));
      else body.replaceChildren(List(shown));
    }
    render();
    if (view === 'list') setTimeout(() => search.focus({ preventScroll: true }), 50);
  }

  // ---------- list ----------
  function List(list) {
    const weight = (x) => x.weight || 5;
    let groups;
    if (sort === 'rel') {
      groups = TIERS.map(([t, name]) => ({ key: name[0], name, list: list.filter((x) => Engine.tierOf(x) === t)
        .sort((a, b) => weight(b) - weight(a) || a.term.localeCompare(b.term)) })).filter((g) => g.list.length);
    } else {
      const by = {};
      list.slice().sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' })).forEach((x) => {
        const c = x.term.replace(/^[^a-z0-9]+/i, '').charAt(0).toUpperCase();
        const k = /[A-Z]/.test(c) ? c : '#';
        (by[k] = by[k] || []).push(x);
      });
      groups = Object.keys(by).sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b)).map((k) => ({ key: k, name: k, list: by[k] }));
    }
    const scroller = h('div', { class: 'wb-list' });
    if (!groups.length) scroller.append(h('p', { class: 'muted wb-empty' }, 'No terms match.'));
    groups.forEach((g) => {
      const sec = h('section', { class: 'wb-group', 'data-key': g.key },
        h('h3', { class: 'wb-letter' }, g.name, h('span', { class: 'muted small' }, ' ' + g.list.length)));
      g.list.forEach((x) => sec.append(entry(x)));
      scroller.append(sec);
    });
    // Scroll tab: letters (or tiers) down the right side; tap or drag to jump.
    const keys = sort === 'rel' ? groups.map((g) => g.key) : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
    const have = new Set(groups.map((g) => g.key));
    const idx = h('div', { class: 'wb-index', 'aria-label': 'Jump to letter' }, keys.map((k) =>
      h('button', { type: 'button', class: 'wb-idx' + (have.has(k) ? '' : ' off'), 'data-key': k, tabindex: have.has(k) ? null : '-1' }, k)));
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
    const tier = Engine.tierOf(x);
    const more = h('div', { class: 'wb-more' });
    const el = h('button', { type: 'button', class: 'wb-item', 'aria-expanded': 'false', onclick: () => {
      const on = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(on));
      if (on && !more.childNodes.length) {
        if (x.detail) more.append(h('p', null, x.detail));
        if ((x.causedBy || []).length) more.append(h('p', null, h('b', null, 'Caused by: '), x.causedBy.map((y) => y.term).join(', ')));
        if ((x.ledTo || []).length) more.append(h('p', null, h('b', null, 'Led to: '), x.ledTo.map((y) => y.term).join(', ')));
        if (!more.childNodes.length) more.append(h('p', { class: 'muted' }, 'No extra details.'));
      }
    } },
      h('div', { class: 'wb-item-top' },
        h('b', { class: 'wb-term' }, x.term),
        h('span', { class: 'chip wb-tier ' + tier }, TIERS.find((t) => t[0] === tier)[1]),
        x.weight ? h('span', { class: 'wb-weight muted small mono' }, x.weight + '/10') : null),
      h('div', { class: 'wb-def' }, x.def),
      more);
    return el;
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
    const hint = h('div', { class: 'wb-hint muted small' }, 'Drag to move · scroll or pinch to zoom · click a term');
    const zoomBtns = h('div', { class: 'wb-zoom' },
      h('button', { class: 'icon-btn sm', 'aria-label': 'Zoom in', onclick: () => zoomAt(W / 2, H / 2, 1.3) }, '+'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Zoom out', onclick: () => zoomAt(W / 2, H / 2, 1 / 1.3) }, '−'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Fit to screen', onclick: () => fit() }, icon('target', 14)));
    wrap.append(cv, zoomBtns, hint, card);
    const ctx = cv.getContext('2d');
    const edges = edgesFor(list);
    const weight = (x) => x.weight || 5;
    const n = list.length;
    // Start on a spiral, heaviest terms in the middle.
    const order = list.map((x, i) => i).sort((a, b) => weight(list[b]) - weight(list[a]));
    const nodes = new Array(n);
    order.forEach((i, k) => {
      const a = k * 2.4, rad = 18 * Math.sqrt(k + 1);
      nodes[i] = { x: Math.cos(a) * rad, y: Math.sin(a) * rad, vx: 0, vy: 0, r: 3 + weight(list[i]) * 1.25, it: list[i], nb: new Set() };
    });
    edges.forEach((e) => { nodes[e.a].nb.add(e.b); nodes[e.b].nb.add(e.a); });

    let W = 0, H = 0, zoom = 1, panX = 0, panY = 0, alpha = 1, raf = 0, sel = -1, hover = -1, alive = true;
    let accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8B5CF6';
    const ptrs = new Map();
    let dragNode = -1, moved = false, pinch = null, panStart = null;

    function size() {
      const r = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      kick();
    }
    const ro = new ResizeObserver(size);

    // Forces: every node pushes the others away, links pull together, and a
    // center pull that's stronger for heavier (more relevant) terms.
    function tick() {
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > 90000) continue;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const f = ((900 + 40 * a.r * b.r) / d2) * alpha;
          a.vx += dx * f / 10; a.vy += dy * f / 10; b.vx -= dx * f / 10; b.vy -= dy * f / 10;
        }
      }
      edges.forEach((e) => {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - (e.cause ? 55 : 75)) * 0.012 * alpha;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      });
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        const g = (0.0012 + (weight(a.it) / 10) ** 2 * 0.009) * alpha;
        a.vx -= a.x * g; a.vy -= a.y * g;
        if (i === dragNode) { a.vx = a.vy = 0; continue; }
        a.vx *= 0.6; a.vy *= 0.6;
        a.x += a.vx; a.y += a.vy;
      }
      alpha = Math.max(alpha * 0.985, dragNode >= 0 ? 0.25 : 0);
    }

    const toScreen = (x, y) => [W / 2 + (x + panX) * zoom, H / 2 + (y + panY) * zoom];
    const toWorld = (sx, sy) => [(sx - W / 2) / zoom - panX, (sy - H / 2) / zoom - panY];

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const focus = sel >= 0 ? sel : hover;
      const lit = focus >= 0 ? nodes[focus].nb : null;
      ctx.lineWidth = 1;
      edges.forEach((e) => {
        const on = focus >= 0 && (e.a === focus || e.b === focus);
        if (focus >= 0 && !on && sel >= 0) return;
        const [x1, y1] = toScreen(nodes[e.a].x, nodes[e.a].y), [x2, y2] = toScreen(nodes[e.b].x, nodes[e.b].y);
        ctx.strokeStyle = on ? rgba(accent, 0.75) : e.cause ? rgba(accent, 0.22) : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = on ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      const match = q ? (x) => x.term.toLowerCase().includes(q) : null;
      for (let i = 0; i < n; i++) {
        const a = nodes[i], [x, y] = toScreen(a.x, a.y), r = a.r * Math.sqrt(zoom);
        if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
        const dim = focus >= 0 && i !== focus && !lit.has(i);
        const t = Engine.tierOf(a.it);
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.fillStyle = t === 'must' ? accent : t === 'good' ? rgba(accent, 0.55) : 'rgba(200,205,220,0.45)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
        if (i === focus || (match && match(a.it))) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        // Labels: big terms always, the rest once you zoom in, plus the focused term and its links.
        const w = weight(a.it);
        const show = i === focus || (lit && lit.has(i)) || w >= 10 || (zoom > 1 && w >= 9) || (zoom > 1.6 && w >= 7) || zoom > 2.6 || (match && match(a.it));
        if (show && !dim) {
          ctx.font = (i === focus ? '700 ' : '600 ') + Math.round(Math.min(15, 10 + r * 0.25)) + 'px Inter, system-ui, sans-serif';
          ctx.fillStyle = i === focus ? '#fff' : 'rgba(235,238,245,0.85)';
          ctx.textAlign = 'center';
          ctx.fillText(a.it.term, x, y + r + 12);
        }
      }
      ctx.globalAlpha = 1;
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

    function nodeAt(sx, sy) {
      const [wx, wy] = toWorld(sx, sy);
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const a = nodes[i], d = Math.hypot(a.x - wx, a.y - wy), r = Math.max(a.r, 8 / zoom);
        if (d < r && d < bd) { bd = d; best = i; }
      }
      return best;
    }
    function zoomAt(sx, sy, f) {
      const [wx, wy] = toWorld(sx, sy);
      zoom = Math.max(0.2, Math.min(5, zoom * f));
      panX = (sx - W / 2) / zoom - wx; panY = (sy - H / 2) / zoom - wy;
      kick();
    }
    function fit() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach((a) => { minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y); });
      if (!isFinite(minX)) return;
      zoom = Math.max(0.2, Math.min(2.5, Math.min(W / (maxX - minX + 120), H / (maxY - minY + 120))));
      panX = -(minX + maxX) / 2; panY = -(minY + maxY) / 2;
      kick();
    }

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
      const x = nodes[i].it, links = Array.from(nodes[i].nb).map((j) => nodes[j].it);
      card.hidden = false;
      card.replaceChildren(
        h('button', { class: 'icon-btn sm wb-card-x', 'aria-label': 'Close', onclick: () => select(-1) }, icon('x', 14)),
        h('div', { class: 'wb-item-top' }, h('b', { class: 'wb-term' }, x.term),
          h('span', { class: 'chip wb-tier ' + Engine.tierOf(x) }, TIERS.find((t) => t[0] === Engine.tierOf(x))[1]),
          x.weight ? h('span', { class: 'wb-weight muted small mono' }, x.weight + '/10') : null),
        h('p', { class: 'wb-def' }, x.def),
        x.detail ? h('p', { class: 'muted small' }, x.detail) : null,
        links.length ? h('div', { class: 'rec-terms' }, links.slice(0, 14).map((y) =>
          h('button', { type: 'button', class: 'chip wb-link', onclick: () => { const j = list.indexOf(y); select(j); centerOn(j); } }, y.term))) : null);
      kick();
    }
    function centerOn(i) { panX = -nodes[i].x; panY = -nodes[i].y; kick(); }

    // Settle the layout a bit before the first frame, then fit it on screen.
    for (let k = 0; k < 120; k++) tick();
    requestAnimationFrame(() => { size(); fit(); ro.observe(wrap); });
    wrap.stop = () => { alive = false; ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
    return wrap;
  }
})();
