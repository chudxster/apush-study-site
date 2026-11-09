// Shared UI helpers: element builder, icons, toast, results screen.
(function () {
  const ICONS = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    cards: '<rect x="2" y="6" width="15" height="15" rx="2"/><path d="M7 2h13a2 2 0 0 1 2 2v13"/>',
    quiz: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    match: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 6v4M18 6v4M12 14v4"/>',
    branch: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a6 6 0 0 0 6 6h3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    flip: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    spark: '<path d="M12 2.5l2.4 6.1L20.5 11l-6.1 2.4L12 19.5l-2.4-6.1L3.5 11l6.1-2.4z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>'
  };

  function icon(name, size) {
    size = size || 20;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]);
        } else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    const kids = Array.prototype.slice.call(arguments, 2).flat(Infinity);
    for (const c of kids) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const reduced = () =>
    document.documentElement.classList.contains('reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function countUp(el, to, fmt, dur) {
    fmt = fmt || ((v) => Math.round(v));
    dur = dur || 900;
    if (reduced()) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // Keyboard handler that ignores typing in inputs and the open settings sheet.
  function keys(handler) {
    const fn = (e) => {
      const b = document.body.classList;
      if (b.contains('sheet-open') || b.contains('modal-open') || b.contains('on-break')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if ((tag === 'input' || tag === 'textarea') && e.key !== 'Enter') return;
      handler(e);
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }

  function seg(options, value, onChange, cls) {
    const wrap = h('div', { class: 'seg ' + (cls || ''), role: 'tablist' });
    const pill = h('span', { class: 'seg-pill', 'aria-hidden': 'true' });
    wrap.append(pill);
    const btns = options.map((o) => {
      const b = h('button', {
        type: 'button', role: 'tab', class: 'seg-btn', title: o.title || null,
        'aria-selected': String(o.value === value),
        onclick: () => { if (o.value === value) return; value = o.value; sync(); onChange(o.value); }
      }, o.label);
      b.dataset.value = o.value;
      wrap.append(b);
      return b;
    });
    function sync() {
      btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.value === String(value))));
      const on = btns.find((b) => b.dataset.value === String(value));
      if (on) {
        pill.style.width = on.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + (on.offsetLeft - 4) + 'px)';
        pill.style.opacity = on.offsetWidth ? '1' : '0';
      }
    }
    requestAnimationFrame(() => { wrap.classList.add('no-anim'); sync(); requestAnimationFrame(() => wrap.classList.remove('no-anim')); });
    window.addEventListener('resize', sync);
    return wrap;
  }

  function bar(pct) {
    return h('div', { class: 'bar' }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
  }

  // Shared results screen.
  // o: {pct, big, label, stats:[[k,v]], bestKey, bestValue, lower, bestFmt, review:[{prompt, answer, your}], onRetry, onBack}
  function results(root, o) {
    unwave();
    const pct = Math.max(0, Math.min(100, Math.round(o.pct || 0)));
    let isBest = false, prev;
    if (o.bestKey != null && o.bestValue != null) {
      prev = Store.best(o.bestKey);
      isBest = Store.setBest(o.bestKey, o.bestValue, o.lower);
    }
    const title = pct >= 90 ? 'Outstanding' : pct >= 75 ? 'Great work' : pct >= 50 ? 'Getting there' : 'Keep practicing';
    const C = 2 * Math.PI * 54;
    function makeRing(p, label, big) {
      p = Math.max(0, Math.min(100, Math.round(p || 0)));
      const el = h('div', { class: 'ring', html:
        '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="ring-bg"/>' +
        '<circle cx="60" cy="60" r="54" class="ring-fg" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + C + '"/></svg>' });
      const num = h('div', { class: 'ring-num' }, big != null ? '' : '0%');
      el.append(h('div', { class: 'ring-center' }, num, h('div', { class: 'ring-label' }, label || '')));
      return { el, play() {
        el.querySelector('.ring-fg').style.strokeDashoffset = String(C * (1 - p / 100));
        if (big != null) { num.textContent = big; num.classList.add('fade-in'); }
        else countUp(num, p, (v) => Math.round(v) + '%');
      } };
    }
    // One ring by default; o.rings = [{pct, label}, ...] shows several (e.g. Raw + Weighted).
    const rings = o.rings ? o.rings.map((r) => makeRing(r.pct, r.label)) : [makeRing(pct, o.label, o.big)];
    const ring = rings.length > 1 ? h('div', { class: 'ring-pair' }, rings.map((r) => r.el)) : rings[0].el;

    const reviewList = (o.review || []).length
      ? h('div', { class: 'review' },
          h('div', { class: 'section-label' }, 'Review these'),
          o.review.map((r, i) => h('div', { class: 'review-item', style: { '--i': i } },
            h('div', { class: 'review-prompt' }, r.prompt),
            h('div', { class: 'review-answer' }, icon('check', 15), r.answer),
            r.your ? h('div', { class: 'review-your' }, icon('x', 15), r.your) : null,
            r.why ? h('div', { class: 'review-why' }, icon('bulb', 15), h('span', null, r.why)) : null)))
      : null;

    root.replaceChildren(h('div', { class: 'results' },
      h('div', { class: 'results-card card' },
        ring,
        h('h2', { class: 'results-title' }, title),
        isBest && prev != null ? h('div', { class: 'chip accent pop' }, icon('spark', 14), 'New best') : null,
        o.stats ? h('div', { class: 'stats' }, o.stats.map(([k, v]) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, k)))) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', onclick: o.onBack }, 'Change method'),
          h('button', { class: 'btn primary', onclick: o.onRetry }, icon('flip', 16), 'Go again'))),
      o.extra || null,
      reviewList));

    requestAnimationFrame(() => requestAnimationFrame(() => rings.forEach((r) => r.play())));
  }

  // Cursor-following glow on cards (and the texture spotlight on answer choices).
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.opt, .card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // Answer feedback: a ripple travels through the background grid from the answer,
  // plus a soft color flash. (No page scaling: the site ripples, it does not pop.)
  // Full-screen color flash (green = right, red = wrong): an edge glow plus a bloom from the answer.
  const flash = h('div', { class: 'answer-flash', 'aria-hidden': 'true' });
  document.body.append(flash);

  function wave(fromEl, ok, hold) {   // hold: keep a soft glow until unwave()
    if (reduced()) return;
    const r = fromEl.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (window.Bg && Bg.ripple) Bg.ripple(x, y, !!ok);
    flash.style.setProperty('--fx', x + 'px'); flash.style.setProperty('--fy', y + 'px');
    flash.className = 'answer-flash';
    void flash.offsetWidth;
    flash.className = 'answer-flash ' + (ok ? 'ok' : 'bad') + (hold ? ' hold' : '');
  }
  function unwave() { flash.className = 'answer-flash'; }
  window.addEventListener('hashchange', unwave);

  // Cross out an answer choice (like the AP exam's eliminator): the ✕ button next
  // to it, or right-click the choice. st.cross remembers it per question.
  function crossable(btn, st, k) {
    st.cross = st.cross || {};
    const x = h('button', { type: 'button', class: 'opt-x', onclick: (e) => { e.stopPropagation(); set(!st.cross[k]); } }, icon('x', 14));
    function set(on) {
      if (btn.disabled) return;
      st.cross[k] = on;
      btn.classList.toggle('crossed', on);
      x.setAttribute('aria-pressed', String(on));
      x.setAttribute('aria-label', (on ? 'Undo cross-out of' : 'Cross out') + ' choice ' + (k + 1));
      x.title = on ? 'Undo cross-out' : 'Cross out (or right-click the choice)';
    }
    btn.addEventListener('contextmenu', (e) => { if (btn.disabled) return; e.preventDefault(); set(!st.cross[k]); });
    set(!!st.cross[k]);
    if (st.cross[k]) btn.classList.add('crossed');   // keep showing it after the question is answered
    texture(btn, st, k);
    return h('div', { class: 'opt-row' }, btn, x);
  }

  // Faint textures on answer choices: invisible until hovered (lit around the
  // cursor), faintly visible once selected, and they shift when clicked.
  // Each choice keeps its texture (picked from its text) across re-renders.
  const TEXTURES = [
    ['quilt', 28, '<path d="M0 14L14 0L28 14L14 28Z" fill="none" stroke="black" stroke-width="1.2" stroke-dasharray="2.5 2"/><path d="M14 0v28M0 14h28" stroke="black" stroke-width=".6" opacity=".45"/><circle cx="14" cy="14" r="1.4"/>'],
    ['grass', 44, '<path d="M4 44Q7 30 3 16M10 44Q9 32 14 20M17 44Q20 28 16 12M24 44Q23 33 28 22M31 44Q34 29 30 14M38 44Q37 34 41 24" stroke="black" fill="none" stroke-width="1.4" stroke-linecap="round"/>'],
    ['cow spots', 90, '<path d="M10 12c9-7 23-2 20 9s-16 11-22 4-6-9 2-13zM56 8c11-2 20 7 13 15s-18 4-18-4 1-10 5-11zM38 48c13-4 25 4 20 15s-22 11-27 2-2-15 7-17zM6 62c7-4 16 0 13 9s-13 7-16 0 1-7 3-9zM74 56c7 0 11 7 7 11s-11 2-11-4 2-7 4-7z"/>'],
    ['polka dots', 20, '<circle cx="5" cy="5" r="2.6"/><circle cx="15" cy="15" r="2.6"/>'],
    ['waves', 40, '<path d="M0 10Q10 2 20 10T40 10M0 30Q10 22 20 30T40 30" fill="none" stroke="black" stroke-width="1.3"/>'],
    ['honeycomb', 42, '<path d="M21 2L38 12V32L21 42M21 2L4 12V32L21 42M21 42V44M21 0V2" fill="none" stroke="black" stroke-width="1.2"/>'],
    ['plaid', 36, '<rect x="0" y="14" width="36" height="8" opacity=".35"/><rect x="14" y="0" width="8" height="36" opacity=".35"/><path d="M0 4h36M0 32h36M4 0v36M32 0v36" stroke="black" stroke-width="1" opacity=".7"/>'],
    ['wood grain', 120, '<path d="M0 8C30 3 60 13 120 8M0 22C40 17 70 28 120 22M0 36C25 31 75 42 120 36M0 50C35 46 65 54 120 50M60 60C70 58 80 62 90 60" fill="none" stroke="black" stroke-width="1"/><ellipse cx="78" cy="29" rx="9" ry="3.5" fill="none" stroke="black" stroke-width="1"/>'],
    ['topographic', 100, '<g fill="none" stroke="black" stroke-width="1"><ellipse cx="30" cy="35" rx="26" ry="18" transform="rotate(-15 30 35)"/><ellipse cx="30" cy="35" rx="17" ry="11" transform="rotate(-15 30 35)"/><ellipse cx="30" cy="35" rx="8" ry="5" transform="rotate(-15 30 35)"/><ellipse cx="75" cy="78" rx="22" ry="14" transform="rotate(20 75 78)"/><ellipse cx="75" cy="78" rx="12" ry="7" transform="rotate(20 75 78)"/></g>'],
    ['brick', 36, '<path d="M0 .5h36M0 18.5h36M9 0v18M27 18v18" fill="none" stroke="black" stroke-width="1.2"/>'],
    ['terrazzo', 70, '<path d="M8 10l6-3 3 6-7 2zM40 6l7 2-2 6-6-2zM58 30l6 4-5 4-4-5zM22 34l8-1 1 6-7 2zM10 58l5-5 4 5-5 3zM46 52l7 1-2 7-6-3zM34 20l3-1 1 3-3 1zM62 62l3 1-1 3-3-1zM4 38l3 0 0 3-3 0z"/>']
  ];
  const texURL = TEXTURES.map(([, s, body]) =>
    'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' + body + '</svg>') + '")');
  function texture(btn, st, k) {
    const text = (btn.querySelector('.opt-text') || btn).textContent;
    let n = 0;
    for (let j = 0; j < text.length; j++) n = (n * 31 + text.charCodeAt(j)) | 0;
    const t = Math.abs(n) % TEXTURES.length;
    btn.classList.add('tex');
    btn.dataset.tex = TEXTURES[t][0];
    btn.style.setProperty('--tex', texURL[t]);
    btn.style.setProperty('--tex-size', TEXTURES[t][1] + 'px');
    // Shift: animate from the last offset to the new one, even if the choice was re-rendered.
    st.texShift = st.texShift || {};
    const sh = st.texShift[k] || (st.texShift[k] = { from: [0, 0], to: [0, 0] });
    const put = (p) => btn.style.setProperty('--tex-pos', p[0] + 'px ' + p[1] + 'px');
    put(sh.from);
    if (sh.from !== sh.to) requestAnimationFrame(() => requestAnimationFrame(() => { put(sh.to); sh.from = sh.to; }));
    btn.addEventListener('pointerdown', () => {
      if (btn.disabled) return;
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 14;
      sh.from = sh.to;
      sh.to = [Math.round(sh.to[0] + Math.cos(a) * d), Math.round(sh.to[1] + Math.sin(a) * d)];
      put(sh.to);   // from stays put, so a re-rendered choice animates the shift too
    });
  }

  // Flagging a question: a slight yellow pulse from the flag button and the card.
  function flagPulse() {
    if (reduced()) return;
    const b = document.querySelector('.flag-btn.on'), card = document.querySelector('.q-card');
    if (b && window.Bg && Bg.ripple) { const r = b.getBoundingClientRect(); Bg.ripple(r.left + r.width / 2, r.top + r.height / 2, '#fbbf24', true); }
    if (card) { card.classList.remove('flag-pulse'); void card.offsetWidth; card.classList.add('flag-pulse'); }
    if (b) b.classList.add('flag-pop');
  }

  // Any click on a control sends a small ripple through the background grid.
  let lastBreath = 0;
  document.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const t = e.target.closest && e.target.closest('button, a, .card, .seg-btn, input[type=checkbox], input[type=range]');
    if (!t || t.closest('.qnav')) return;
    const now = performance.now();
    if (now - lastBreath < 250) return;
    lastBreath = now;
    if (window.Bg && Bg.ripple) Bg.ripple(e.clientX, e.clientY, null, true);
  }, { passive: true });

  // Question navigator: a dot timeline that sits right under the question card.
  // Dots magnify (dock-style) and show their number as the cursor gets near; click to jump.
  // Flagged = bold amber. states[i] = { done, ok (true/false/undefined), flag }
  function navigator(count, onJump, parent) {
    const track = h('div', { class: 'qnav-track' });
    const dots = [];
    for (let i = 0; i < count; i++) {
      const d = h('button', { class: 'qnav-dot', type: 'button', 'aria-label': 'Question ' + (i + 1), onclick: () => onJump(i) },
        h('span', { class: 'qnav-num' }, String(i + 1)));
      dots.push(d); track.append(d);
    }
    const flagCount = h('span', { class: 'qnav-flags' });
    const el = h('div', { class: 'qnav', role: 'navigation', 'aria-label': 'Question navigator' },
      h('div', { class: 'qnav-inner' }, track, flagCount));
    const RANGE = 70;
    track.addEventListener('pointermove', (e) => {
      if (reduced()) return;
      for (const d of dots) {
        const r = d.getBoundingClientRect();
        const dist = Math.abs(e.clientX - (r.left + r.width / 2));
        const s = 1 + 1.3 * Math.max(0, 1 - dist / RANGE);
        d.style.setProperty('--s', s.toFixed(3));
        d.classList.toggle('near', s > 1.75);
      }
    });
    track.addEventListener('pointerleave', () => dots.forEach((d) => { d.style.setProperty('--s', 1); d.classList.remove('near'); }));
    (parent || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    return {
      update(states, cur) {
        let flags = 0;
        dots.forEach((d, i) => {
          const s = states[i] || {};
          d.classList.toggle('cur', i === cur);
          d.classList.toggle('done', !!s.done);
          d.classList.toggle('ok', s.ok === true);
          d.classList.toggle('bad', s.ok === false);
          d.classList.toggle('flag', !!s.flag);
          if (s.flag) flags++;
        });
        flagCount.textContent = flags ? '⚑ ' + flags : '';
        const c = dots[cur];
        if (c) {
          const tr = track.getBoundingClientRect(), cr = c.getBoundingClientRect();
          if (cr.left < tr.left + 20 || cr.right > tr.right - 20) track.scrollLeft += cr.left - tr.left - tr.width / 2;
        }
      },
      destroy() { el.remove(); }
    };
  }

  // "Wikipedia ↗" link for a term (item.wiki = { t: article title, d: short description }).
  function wikiLink(item) {
    if (!item.wiki || !item.wiki.t) return null;
    const a = h('a', { class: 'wiki-link', href: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(item.wiki.t.replace(/ /g, '_')),
      target: '_blank', rel: 'noopener', title: item.wiki.d ? item.wiki.t + ': ' + item.wiki.d : item.wiki.t },
      'Wikipedia: ' + item.wiki.t + ' ↗');
    ['pointerdown', 'pointerup', 'click'].forEach((ev) => a.addEventListener(ev, (e) => e.stopPropagation()));
    return a;
  }

  function flagBtn(on, onToggle) {
    const b = h('button', { class: 'btn ghost sm flag-btn' + (on ? ' on' : ''), type: 'button', title: 'Flag for review (F)', onclick: () => onToggle() },
      h('span', { class: 'flag-ico' }, '⚑'), on ? 'Flagged' : 'Flag');
    return b;
  }

  window.UI = { h, icon, toast, fmtTime, countUp, keys, seg, bar, results, reduced, wave, navigator, flagBtn, wikiLink, crossable, flagPulse, unwave };
})();
