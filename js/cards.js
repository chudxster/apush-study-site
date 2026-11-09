// Trading cards: every term is a collectible card.
//
// Rarity: Common, or Uncommon for the big ideas (weight 8+). Rare and Legendary
// are earned: once you master a term (Teach Me Mastered, or mastery 5/5), packs
// can give its card as Rare, or Legendary for the biggest terms (weight 9-10).
// A card keeps the rarity it was pulled at; mastering a term you already own
// lets a pack upgrade it.
//
// Packs: every correct answer adds a pack point; 20 points = a pack of 3 cards
// from the unit you were studying. The more of that unit you know, the better
// the odds: Rare odds grow with how much you've mastered, Uncommon odds with
// how much you've learned.
//
// Finishes are earned per card and never lost: Foil at mastery 3/5, Holo at
// 5/5, Gilded after 3 correct answers on Hard, Prismatic = Holo + Gilded.
(function () {
  const { h, icon } = UI;
  const PACK_PTS = 20, PACK_SIZE = 3, HARD_FOR_GILD = 3;
  const FIN = ['Standard', 'Foil', 'Holo'];
  const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];
  const RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  const NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };
  let gains = { pts: 0, packs: 0, ready: [], ups: [] };

  const cards = () => Store.get('cards') || {};
  const pack = () => Object.assign({ pts: 0, q: [] }, Store.get('pack') || {});
  const save = (c, p) => { if (c) Store.set('cards', c); if (p) Store.set('pack', p); window.dispatchEvent(new Event('cardschange')); };
  const unitOf = (id) => String(id).split('/')[0];
  const itemOf = (id) => { const d = Engine.data(unitOf(id)); return d ? d.items.find((x) => x.id === id) : null; };
  const blank = () => ({ f: 0, g: false, hard: 0 });

  // ---------- rarity ----------
  const has = (id) => !!(cards()[id] && cards()[id].own);
  const baseRarity = (x) => ((x.weight ? x.weight >= 8 : Engine.tierOf(x) === 'must') ? 'uncommon' : 'common');
  const topRarity = (x) => ((x.weight || 0) >= 9 ? 'legendary' : 'rare');
  const mastered = (x) => (window.Modes && Modes.teach && Modes.teach.stage(x) === 4) || Store.mastery(x.id) >= 5;
  // The best rarity a pack can give this term right now.
  const earnable = (x) => (mastered(x) ? topRarity(x) : baseRarity(x));
  // An owned card's rarity is what it was pulled at; a locked one shows what a
  // pack would give now.
  const rarityOf = (x) => { const s = cards()[x.id]; return s && s.own ? (s.r || baseRarity(x)) : earnable(x); };
  const canUpgrade = (x) => has(x.id) && RANK[earnable(x)] > RANK[rarityOf(x)];

  // { f: 0 standard | 1 foil | 2 holo, g: gilded, hard: correct on Hard, r: rarity pulled }
  const stateOf = (id) => Object.assign(blank(), cards()[id] || {});
  function finishName(s) {
    if (s.f === 2 && s.g) return 'Prismatic';
    return ((s.g ? 'Gilded ' : '') + (s.f || !s.g ? FIN[s.f] : '')).trim();
  }
  // CSS classes for an owned card: rarity + finish.
  function classes(x) {
    const s = stateOf(x.id);
    return 'card-' + rarityOf(x) + (s.f === 2 && s.g ? ' fin-prismatic' : (s.f ? ' fin-' + FIN[s.f].toLowerCase() : '') + (s.g ? ' fin-gilded' : ''));
  }
  // What's left to unlock or upgrade for this card.
  function nextText(x) {
    const s = stateOf(x.id), m = Store.mastery(x.id), out = [], top = NAME[topRarity(x)];
    if (!has(x.id)) {
      return mastered(x) ? 'Mastered: packs can now give this card as ' + top + '.'
        : 'Locked: pull it from a pack. Master it to unlock its ' + top + ' version in packs.';
    }
    if (canUpgrade(x)) out.push('Mastered: a pack can upgrade it to ' + NAME[earnable(x)]);
    else if (RANK[rarityOf(x)] < RANK[topRarity(x)]) out.push('Master it for a ' + top + ' upgrade in packs');
    if (s.f < 1) out.push('Foil at mastery 3/5 (now ' + m + '/5)');
    else if (s.f < 2) out.push('Holo at mastery 5/5 (now ' + m + '/5)');
    if (!s.g) out.push((HARD_FOR_GILD - s.hard) + ' more correct on Hard for Gilded');
    return out.length ? out.join(' · ') : 'Fully upgraded.';
  }

  // ---------- odds: better the more of the unit you know ----------
  function odds(unit) {
    const d = Engine.data(unit);
    if (!d || !d.items.length) return { rare: 0, uncommon: 0.25, mastered: 0, learned: 0 };
    const T = window.Modes && Modes.teach;
    const n = d.items.length;
    const mast = d.items.filter(mastered).length;
    const learned = d.items.filter((x) => (T && T.stage(x) >= 2) || Store.mastery(x.id) >= 3).length;
    return {
      rare: mast ? Math.min(0.7, 0.2 + 0.8 * (mast / n)) : 0,
      uncommon: Math.min(0.6, 0.25 + 0.5 * (learned / n)),
      mastered: mast, learned
    };
  }
  const pct = (v) => Math.round(v * 100) + '%';
  function oddsText(unit) {
    const o = odds(unit);
    return 'Pack odds: Rare+ ' + pct(o.rare) + ' · Uncommon ' + pct(o.uncommon) + (o.rare ? '' : ' · master terms to unlock Rare');
  }

  // ---------- earning ----------
  // Called by Store.bump after every answer.
  function onBump(id, d, m) {
    if (!(d > 0)) return;
    const c = Object.assign({}, cards()), p = pack();
    const s = c[id] = Object.assign(blank(), c[id]);
    const before = finishName(s);
    if (Store.pref('diff') === 'hard') s.hard++;
    if (m >= 5) s.f = 2; else if (m >= 3) s.f = Math.max(s.f, 1);
    if (s.hard >= HARD_FOR_GILD) s.g = true;
    if (s.own && finishName(s) !== before) gains.ups.push(id);
    if (m >= 5) markReady(s, id);
    p.last = unitOf(id);
    addPoints(p, 1);
    save(c, p);
  }
  // A term was just mastered: its Rare/Legendary version is now in packs.
  function markReady(s, id) {
    if (s.rr) return;
    s.rr = true;
    if (!gains.ready.includes(id)) gains.ready.push(id);
  }
  function addPoints(p, n) {
    p.pts += n; gains.pts += n;
    while (p.pts >= PACK_PTS) { p.pts -= PACK_PTS; p.q = p.q.concat(p.last || p.q[p.q.length - 1] || ''); gains.packs++; }
  }
  // Teach Me mastered a term: its top rarity unlocks in packs, plus bonus points.
  function reward(id, pts) {
    const c = Object.assign({}, cards()), p = pack();
    markReady(c[id] = Object.assign(blank(), c[id]), id);
    p.last = unitOf(id);
    addPoints(p, pts || 0);
    save(c, p);
  }

  function takeSessionGains() { const g = gains; gains = { pts: 0, packs: 0, ready: [], ups: [] }; return g; }

  // ---------- opening packs ----------
  // Each of the 3 slots rolls for Rare+ (mastered terms you don't own at that
  // rarity yet), then Uncommon, then Common. Uses the pack's unit, else any unit.
  function draw(unit) {
    const units = (window.UNITS || []).map((u) => u.id);
    const order = [unit].concat(units.filter((u) => u !== unit));
    return Promise.all(order.map((u) => Engine.load(u).catch(() => null))).then(() => {
      for (const u of order) {
        const d = Engine.data(u);
        if (!d) continue;
        const pools = {
          rare: d.items.filter((x) => RANK[earnable(x)] >= 2 && (!has(x.id) || canUpgrade(x))),
          uncommon: d.items.filter((x) => !has(x.id) && earnable(x) === 'uncommon'),
          common: d.items.filter((x) => !has(x.id) && earnable(x) === 'common')
        };
        if (!pools.rare.length && !pools.uncommon.length && !pools.common.length) continue;
        const o = odds(u), got = [];
        const take = (k) => pools[k].splice(Math.floor(Math.random() * pools[k].length), 1)[0];
        while (got.length < PACK_SIZE && (pools.rare.length || pools.uncommon.length || pools.common.length)) {
          let k;
          if (pools.rare.length && Math.random() < o.rare) k = 'rare';
          else if (pools.uncommon.length && Math.random() < o.uncommon) k = 'uncommon';
          else k = pools.common.length ? 'common' : pools.uncommon.length ? 'uncommon' : 'rare';
          const x = take(k);
          got.push({ x, r: earnable(x), up: has(x.id) ? rarityOf(x) : null });
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
      got.forEach((g) => { c[g.x.id] = Object.assign(blank(), c[g.x.id], { own: true, r: g.r, at: Date.now() }); });
      save(c, p);
      if (!got.length) { UI.toast('You already own every card at its best rarity!'); return; }
      reveal(got, unit);
    });
  }

  // A card face, used by the pack overlay.
  function face(g) {
    const x = g.x, s = stateOf(x.id);
    return h('div', { class: 'tc ' + classes(x) },
      h('div', { class: 'tc-top' }, h('span', { class: 'tc-rar' }, NAME[g.r]), s.f || s.g ? h('span', { class: 'tc-fin' }, finishName(s)) : null),
      g.up ? h('span', { class: 'tc-up' }, icon('up', 12), 'Upgraded from ' + NAME[g.up]) : null,
      h('b', { class: 'tc-term' }, x.term),
      h('p', { class: 'tc-def' }, x.def));
  }

  function reveal(got, unit) {
    const best = got.reduce((m, g) => Math.max(m, RANK[g.r]), 0);
    const flips = got.map((g, i) => h('button', { type: 'button', class: 'tc-flip r-' + g.r, style: { '--i': i }, 'aria-label': 'Flip card', onclick: (e) => e.currentTarget.classList.add('open') },
      h('div', { class: 'tc-back' }, icon('cards', 34), RANK[g.r] >= 2 ? h('span', { class: 'tc-glint' }) : null), face(g)));
    const left = pack().q.length;
    const ov = h('div', { class: 'pack-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pack opened' },
      h('h2', null, best >= 3 ? 'Legendary pull!' : best === 2 ? 'Rare pull!' : 'New cards!'),
      h('div', { class: 'pack-row' }, flips),
      h('p', { class: 'muted small pack-odds' }, oddsText(unit)),
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

  // Results screen block: points, packs, Rare unlocks and upgrades from this session.
  function resultsBlock() {
    const g = takeSessionGains(), p = pack();
    if (!g.pts && !p.q.length) return null;
    const name = (id) => { const x = itemOf(id); return x ? x.term : id; };
    const unit = p.q[0] || p.last;
    return h('div', { class: 'tc-gains' },
      h('div', { class: 'tc-meter' },
        h('span', { class: 'small muted' }, (g.pts ? '+' + g.pts + ' pack points · ' : '') + p.pts + '/' + PACK_PTS + ' to next pack'),
        UI.bar(p.pts / PACK_PTS * 100)),
      g.packs ? h('div', { class: 'chip accent pop' }, icon('cards', 14), g.packs > 1 ? g.packs + ' packs earned!' : 'Pack earned!') : null,
      g.ready.length > 3
        ? h('div', { class: 'chip rare-chip pop', title: g.ready.map(name).join(', ') }, icon('spark', 14), g.ready.length + ' terms mastered: their Rare cards are now in packs')
        : g.ready.map((id) => { const x = itemOf(id); return h('div', { class: 'chip rare-chip pop' }, icon('spark', 14), 'Mastered ' + name(id) + ': ' + (x ? NAME[topRarity(x)] : 'Rare') + ' card now in packs'); }),
      g.ups.map((id) => h('div', { class: 'chip pop' }, icon('spark', 14), name(id) + ' → ' + finishName(stateOf(id)))),
      unit ? h('span', { class: 'small muted' }, oddsText(unit)) : null,
      p.q.length ? h('button', { class: 'btn primary', onclick: (e) => { e.currentTarget.remove(); openPack(); } }, icon('cards', 16), 'Open pack (' + p.q.length + ')') : null);
  }

  window.Cards = { RARITIES, NAME, RANK, rarityOf, earnable, canUpgrade, mastered, has, stateOf, finishName, classes, nextText,
    odds, oddsText, onBump, reward, openPack, resultsBlock, takeSessionGains,
    packs: () => pack().q.length, meter: () => pack().pts, PACK_PTS };
})();
