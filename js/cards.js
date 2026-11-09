// Trading cards: every term is a collectible card.
// Rarity is fixed per term: Common, or Uncommon for the big ideas (weight 8+).
// Finishes are earned per card and never lost: Foil at mastery 3/5, Holo at 5/5,
// Gilded after 3 correct answers on Hard, Prismatic = Holo + Gilded.
// Earning: every correct answer adds a pack point; 20 points = a pack of 3 cards
// you don't own yet, from the unit you were studying. Mastering a term (5/5)
// unlocks its card even without a pack.
(function () {
  const { h, icon } = UI;
  const PACK_PTS = 20, PACK_SIZE = 3, HARD_FOR_GILD = 3, UNCOMMON_ODDS = 0.3;
  const FIN = ['Standard', 'Foil', 'Holo'];
  let gains = { pts: 0, packs: 0, unlocks: [], ups: [] };

  const cards = () => Store.get('cards') || {};
  const pack = () => Object.assign({ pts: 0, q: [] }, Store.get('pack') || {});
  const save = (c, p) => { if (c) Store.set('cards', c); if (p) Store.set('pack', p); window.dispatchEvent(new Event('cardschange')); };
  const unitOf = (id) => String(id).split('/')[0];
  const itemOf = (id) => { const d = Engine.data(unitOf(id)); return d ? d.items.find((x) => x.id === id) : null; };

  const rarityOf = (x) => ((x.weight ? x.weight >= 8 : Engine.tierOf(x) === 'must') ? 'uncommon' : 'common');
  const has = (id) => !!(cards()[id] && cards()[id].own);
  // { f: 0 standard | 1 foil | 2 holo, g: gilded, hard: correct on Hard }
  const stateOf = (id) => Object.assign({ f: 0, g: false, hard: 0 }, cards()[id] || {});
  function finishName(s) {
    if (s.f === 2 && s.g) return 'Prismatic';
    return ((s.g ? 'Gilded ' : '') + (s.f || !s.g ? FIN[s.f] : '')).trim();
  }
  // CSS classes for an owned card: rarity + finish.
  function classes(x) {
    const s = stateOf(x.id);
    return 'card-' + rarityOf(x) + (s.f === 2 && s.g ? ' fin-prismatic' : (s.f ? ' fin-' + FIN[s.f].toLowerCase() : '') + (s.g ? ' fin-gilded' : ''));
  }
  // What's left to upgrade this card.
  function nextText(x) {
    const s = stateOf(x.id), m = Store.mastery(x.id), out = [];
    if (!has(x.id)) return 'Locked: earn it from a pack, or master it (5/5) to unlock.';
    if (s.f < 1) out.push('Foil at mastery 3/5 (now ' + m + '/5)');
    else if (s.f < 2) out.push('Holo at mastery 5/5 (now ' + m + '/5)');
    if (!s.g) out.push((HARD_FOR_GILD - s.hard) + ' more correct on Hard for Gilded');
    return out.length ? out.join(' · ') : 'Fully upgraded.';
  }

  // Called by Store.bump after every answer.
  function onBump(id, d, m) {
    if (!(d > 0)) return;
    const c = Object.assign({}, cards()), p = pack();
    const s = c[id] = Object.assign({ f: 0, g: false, hard: 0 }, c[id]);
    const before = finishName(s), wasOwn = !!s.own;
    if (Store.pref('diff') === 'hard') s.hard++;
    if (m >= 5) s.f = 2; else if (m >= 3) s.f = Math.max(s.f, 1);
    if (s.hard >= HARD_FOR_GILD) s.g = true;
    if (m >= 5 && !s.own) { s.own = true; s.at = Date.now(); gains.unlocks.push(id); }
    else if (wasOwn && finishName(s) !== before) gains.ups.push(id);
    p.last = unitOf(id);
    addPoints(p, 1);
    save(c, p);
  }

  function addPoints(p, n) {
    p.pts += n; gains.pts += n;
    while (p.pts >= PACK_PTS) { p.pts -= PACK_PTS; p.q = p.q.concat(p.last || p.q[p.q.length - 1] || ''); gains.packs++; }
  }
  // Teach Me mastered a term: unlock its card and give bonus pack points.
  function reward(id, pts) {
    const c = Object.assign({}, cards()), p = pack();
    const s = c[id] = Object.assign({ f: 0, g: false, hard: 0 }, c[id]);
    if (!s.own) { s.own = true; s.at = Date.now(); if (!gains.unlocks.includes(id)) gains.unlocks.push(id); }
    p.last = unitOf(id);
    addPoints(p, pts || 0);
    save(c, p);
  }

  function takeSessionGains() { const g = gains; gains = { pts: 0, packs: 0, unlocks: [], ups: [] }; return g; }

  // Pick up to 3 locked cards: from the pack's unit, else any unit.
  function draw(unit) {
    const units = (window.UNITS || []).map((u) => u.id);
    const order = [unit].concat(units.filter((u) => u !== unit));
    return Promise.all(order.map((u) => Engine.load(u).catch(() => null))).then(() => {
      for (const u of order) {
        const d = Engine.data(u);
        const locked = d ? d.items.filter((x) => !has(x.id)) : [];
        if (!locked.length) continue;
        const pool = { uncommon: locked.filter((x) => rarityOf(x) === 'uncommon'), common: locked.filter((x) => rarityOf(x) === 'common') };
        const got = [];
        while (got.length < PACK_SIZE && (pool.uncommon.length || pool.common.length)) {
          const r = (Math.random() < UNCOMMON_ODDS && pool.uncommon.length) || !pool.common.length ? pool.uncommon : pool.common;
          got.push(r.splice(Math.floor(Math.random() * r.length), 1)[0]);
        }
        return got;
      }
      return [];
    });
  }

  function openPack() {
    const p = pack();
    if (!p.q.length) return Promise.resolve();
    const unit = p.q[0];
    return draw(unit).then((got) => {
      p.q = p.q.slice(1);
      const c = Object.assign({}, cards());
      got.forEach((x) => { c[x.id] = Object.assign({ f: 0, g: false, hard: 0 }, c[x.id], { own: true, at: Date.now() }); });
      save(c, p);
      if (!got.length) { UI.toast('You already own every card!'); return; }
      reveal(got);
    });
  }

  // A card face, used by the pack overlay.
  function face(x) {
    const s = stateOf(x.id);
    return h('div', { class: 'tc ' + classes(x) },
      h('div', { class: 'tc-top' }, h('span', { class: 'tc-rar' }, rarityOf(x)), s.f || s.g ? h('span', { class: 'tc-fin' }, finishName(s)) : null),
      h('b', { class: 'tc-term' }, x.term),
      h('p', { class: 'tc-def' }, x.def));
  }

  function reveal(got) {
    const flips = got.map((x, i) => h('button', { type: 'button', class: 'tc-flip', style: { '--i': i }, 'aria-label': 'Flip card', onclick: (e) => e.currentTarget.classList.add('open') },
      h('div', { class: 'tc-back' }, icon('cards', 34)), face(x)));
    const left = pack().q.length;
    const ov = h('div', { class: 'pack-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pack opened' },
      h('h2', null, 'New cards!'),
      h('div', { class: 'pack-row' }, flips),
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', onclick: () => flips.forEach((f) => f.classList.add('open')) }, 'Flip all'),
        left ? h('button', { class: 'btn ghost', onclick: () => { close(); openPack(); } }, 'Open next (' + left + ')') : null,
        h('button', { class: 'btn primary', onclick: close }, 'Done')));
    function close() { document.removeEventListener('keydown', esc, true); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300); }
    function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', esc, true);
    document.body.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    if (UI.reduced()) flips.forEach((f) => f.classList.add('open'));
  }

  // Results screen block: points, packs, unlocks and upgrades from this session.
  function resultsBlock() {
    const g = takeSessionGains(), p = pack();
    if (!g.pts && !p.q.length) return null;
    const name = (id) => { const x = itemOf(id); return x ? x.term : id; };
    return h('div', { class: 'tc-gains' },
      h('div', { class: 'tc-meter' },
        h('span', { class: 'small muted' }, (g.pts ? '+' + g.pts + ' pack points · ' : '') + p.pts + '/' + PACK_PTS + ' to next pack'),
        UI.bar(p.pts / PACK_PTS * 100)),
      g.packs ? h('div', { class: 'chip accent pop' }, icon('cards', 14), g.packs > 1 ? g.packs + ' packs earned!' : 'Pack earned!') : null,
      g.unlocks.length > 3
        ? h('div', { class: 'chip pop', title: g.unlocks.map(name).join(', ') }, icon('spark', 14), g.unlocks.length + ' cards unlocked by mastering them')
        : g.unlocks.map((id) => h('div', { class: 'chip pop' }, icon('spark', 14), 'Mastered & unlocked: ' + name(id))),
      g.ups.map((id) => h('div', { class: 'chip pop' }, icon('spark', 14), name(id) + ' → ' + finishName(stateOf(id)))),
      p.q.length ? h('button', { class: 'btn primary', onclick: (e) => { e.currentTarget.remove(); openPack(); } }, icon('cards', 16), 'Open pack (' + p.q.length + ')') : null);
  }

  window.Cards = { rarityOf, has, stateOf, finishName, classes, nextText, onBump, reward, openPack, resultsBlock, takeSessionGains,
    packs: () => pack().q.length, meter: () => pack().pts, PACK_PTS };
})();
