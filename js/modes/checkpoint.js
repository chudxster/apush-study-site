window.Modes = window.Modes || {};
// Checkpoint Mode: an endless mix of short segments (quiz, matching, typed
// recall, cause & effect) drawn from different topics. Every 3 segments a
// checkpoint shows your scores and what to study next, and lets you change
// difficulty, relevancy and topics before continuing.
Modes.checkpoint = {
  name: 'Checkpoint Mode', icon: 'flag',
  desc: 'A nonstop mix of question styles across topics, with a checkpoint every 3 rounds to see how you are doing.',
  EVERY: 3,
  VARIETIES: [
    { id: 'quiz', name: 'Quick quiz', icon: 'quiz', n: 6, len: 5 },
    { id: 'matching', name: 'Matching', icon: 'match', n: 5 },
    { id: 'learn', name: 'Typed recall', icon: 'pen', n: 4 },
    { id: 'cause', name: 'Cause & effect', icon: 'branch', n: 6, len: 4, mode: 'quiz', only: ['causedBy', 'ledTo'] }
  ],
  available(c) { return c.topicAll.length >= 8 ? null : 'Needs at least 8 terms'; },
  start(root, c) {
    const { h, icon } = UI;
    const self = this;
    const d = Engine.data(c.unitId);
    const subj = (window.SUBJECTS || []).find((s) => s.id === c.unit.subject) || {};
    const TOPICS = (subj.topics || window.DEFAULT_TOPICS || []).filter((t) => t.id !== 'everything');
    // Settings: start from the route's topics, last-used difficulty and relevancy.
    const cfg = {
      topics: c.topicIds.includes('everything') ? [] : c.topicIds.slice(),   // [] = all topics
      rel: Store.pref('cpRel') || 'good',
      diff: Store.pref('cpDiff') || 'medium'
    };
    const segs = [];                // every finished segment this session
    let sub = null, lastVariety = null, lastTopic = null;

    const pool = () => {
      const items = Engine.topicItems(d, cfg.topics.length ? cfg.topics : ['everything'], c.ch, 'all');
      return Engine.byRelevancy(items, cfg.rel);
    };

    // Pick the next segment: a different style than last time, focused on one
    // topic (rotating) so a session covers many topics.
    function nextSegment() {
      const all = pool();
      const linked = all.filter((x) => x.kind !== 'person' && (x.causedBy || []).concat(x.ledTo || []).some((y) => y.kind !== 'person'));
      const options = self.VARIETIES.filter((v) => v.id !== lastVariety && (v.id !== 'cause' || linked.length >= 4));
      const v = Engine.pick(options.length ? options : self.VARIETIES.slice(0, 1));
      const topicChoices = (cfg.topics.length ? TOPICS.filter((t) => cfg.topics.includes(t.id)) : TOPICS)
        .filter((t) => t.id !== lastTopic && all.some((x) => (x.topics || []).includes(t.id)));
      const topic = topicChoices.length ? Engine.pick(topicChoices) : null;
      let src = v.id === 'cause' ? linked : topic ? all.filter((x) => (x.topics || []).includes(topic.id)) : all;
      if (src.length < v.n) src = v.id === 'cause' ? linked : all;    // too few in that topic: widen
      // Weak terms first (low mastery), with some randomness.
      const items = Engine.weighted(src).slice(0, v.n);
      lastVariety = v.id; lastTopic = topic && topic.id;
      return { v, topic: v.id === 'cause' ? null : topic, items };
    }

    function runSegment() {
      if (sub) { try { sub(); } catch (e) {} sub = null; }
      const seg = nextSegment();
      const k = segs.length % self.EVERY;
      const holder = h('div', { class: 'refresh' });
      root.replaceChildren(
        h('div', { class: 'step-strip' },
          h('span', { class: 'step-num' }, 'Round ' + (k + 1) + ' / ' + self.EVERY),
          h('span', { class: 'step-title' }, icon(seg.v.icon, 15), seg.v.name + (seg.topic ? ' · ' + seg.topic.name : '')),
          h('span', { class: 'step-right' }, h('span', { class: 'muted small' }, 'Checkpoint ' + (Math.floor(segs.length / self.EVERY) + 1)))),
        h('div', { class: 'bar exp-bar' }, h('i', { style: { width: (k / self.EVERY) * 100 + '%' } })),
        holder);
      const m = Modes[seg.v.mode || seg.v.id];
      const ctx = Object.assign({}, c, {
        items: seg.items, topicAll: seg.items, all: pool().length >= 12 ? pool() : d.items,
        diff: cfg.diff, autoLen: seg.v.len || Math.min(10, seg.items.length),
        qOpts: seg.v.only ? { only: seg.v.only } : undefined,
        onComplete: (s) => {
          segs.push({ name: seg.v.name, topic: seg.topic, items: seg.items, correct: s.correct, total: s.total, review: s.review || [] });
          if (segs.length % self.EVERY === 0) checkpoint(); else runSegment();
        }
      });
      sub = m.start(holder, ctx);
    }

    const pct = (list) => {
      const t = list.reduce((a, s) => a + s.total, 0);
      return t ? Math.round((list.reduce((a, s) => a + s.correct, 0) / t) * 100) : 0;
    };

    // Topics ranked by how weak you are on the terms you've seen this session.
    function recommendations() {
      const seen = new Map();
      segs.forEach((s) => s.items.forEach((x) => seen.set(x.id, x)));
      const items = Array.from(seen.values());
      const recs = TOPICS.map((t) => {
        const its = items.filter((x) => (x.topics || []).includes(t.id));
        const m = its.length ? its.reduce((a, x) => a + Store.mastery(x.id), 0) / its.length : 5;
        return { t, its, m };
      }).filter((r) => r.its.length).sort((a, b) => a.m - b.m).slice(0, 2);
      const weakTerms = items.slice().sort((a, b) => Store.mastery(a.id) - Store.mastery(b.id)).slice(0, 6);
      return h('div', { class: 'review recs' },
        h('div', { class: 'section-label' }, 'Recommended'),
        recs.map((r, k) => h('a', { class: 'review-item rec', style: { '--i': k },
          href: '#/u/' + encodeURIComponent(c.unitId) + '/t/' + r.t.id + '/m/learn' },
          h('div', { class: 'rec-head' }, icon(r.t.icon || 'book', 18), h('b', null, 'Study ' + r.t.name), h('span', { class: 'go' }, icon('arrow', 16))),
          h('div', { class: 'review-prompt' }, 'Your weakest topic so far (' + Math.round((r.m / 5) * 100) + '% mastered). Learn / Write drills it.'),
          h('div', { class: 'rec-terms' }, r.its.sort((a, b) => Store.mastery(a.id) - Store.mastery(b.id)).slice(0, 4).map((x) => h('span', { class: 'chip' }, x.term))))),
        weakTerms.length ? h('div', { class: 'review-item rec static', style: { '--i': recs.length } },
          h('div', { class: 'rec-head' }, icon('target', 18), h('b', null, 'Terms to watch')),
          h('div', { class: 'rec-terms' }, weakTerms.map((x) => h('span', { class: 'chip' }, x.term)))) : null);
    }

    function checkpoint() {
      if (sub) { try { sub(); } catch (e) {} sub = null; }
      const n = segs.length / self.EVERY;
      const recent = segs.slice(-self.EVERY);
      const now = pct(recent), overall = pct(segs);
      const prev = segs.length > self.EVERY ? pct(segs.slice(-2 * self.EVERY, -self.EVERY)) : null;

      const topicChips = h('div', { class: 'cp-topics' }, TOPICS.map((t) => {
        const b = h('button', { type: 'button', class: 'chip cp-topic', 'aria-pressed': String(cfg.topics.includes(t.id)),
          onclick: () => {
            const i = cfg.topics.indexOf(t.id);
            if (i >= 0) cfg.topics.splice(i, 1); else cfg.topics.push(t.id);
            b.setAttribute('aria-pressed', String(cfg.topics.includes(t.id)));
            allBtn.setAttribute('aria-pressed', String(!cfg.topics.length));
            count();
          } }, icon(t.icon || 'book', 13), t.name);
        return b;
      }));
      const allBtn = h('button', { type: 'button', class: 'chip cp-topic', 'aria-pressed': String(!cfg.topics.length),
        onclick: () => { cfg.topics = []; topicChips.querySelectorAll('.cp-topic').forEach((x) => x.setAttribute('aria-pressed', 'false')); allBtn.setAttribute('aria-pressed', 'true'); count(); } }, 'All topics');
      topicChips.prepend(allBtn);
      const countLine = h('p', { class: 'muted small' });
      const count = () => { const p = pool().length; countLine.textContent = p + ' terms in the mix' + (p < 8 ? ': add topics or widen relevancy' : ''); goBtn.disabled = p < 8; };
      const goBtn = h('button', { class: 'btn primary big', onclick: runSegment }, 'Continue', icon('arrow', 18));

      root.replaceChildren(h('div', { class: 'results cp' },
        h('div', { class: 'results-card card' },
          h('div', { class: 'eyebrow' }, 'Checkpoint ' + n),
          h('div', { class: 'ring-pair' }, ring(now, 'Last 3 rounds'), ring(overall, 'Session')),
          h('h2', { class: 'results-title' }, now >= 90 ? 'On fire' : now >= 75 ? 'Strong' : now >= 50 ? 'Getting there' : 'Keep at it'),
          prev != null ? h('p', { class: 'muted small' }, (now >= prev ? '▲ ' : '▼ ') + Math.abs(now - prev) + ' points vs. the checkpoint before') : null,
          h('div', { class: 'stats' }, recent.map((s) => h('div', { class: 'stat' }, h('b', null, (s.total ? Math.round((s.correct / s.total) * 100) : 0) + '%'),
            h('span', null, s.name + (s.topic ? ' · ' + s.topic.name : ''))))),
          h('div', { class: 'actions' },
            h('button', { class: 'btn ghost', onclick: finish }, 'End session'),
            goBtn)),
        recommendations(),
        h('div', { class: 'card cp-settings' },
          h('div', { class: 'section-label' }, 'Adjust before you continue'),
          h('div', { class: 'pt-field' }, h('div', { class: 'control-label' }, 'Difficulty'),
            UI.seg([{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }], cfg.diff,
              (v) => { cfg.diff = v; Store.setPref('cpDiff', v); })),
          h('div', { class: 'pt-field' }, h('div', { class: 'control-label' }, 'Relevancy'),
            UI.seg([{ value: 'must', label: 'Must Know' }, { value: 'good', label: 'Good to Know' }, { value: 'niche', label: 'Everything' }], cfg.rel,
              (v) => { cfg.rel = v; Store.setPref('cpRel', v); count(); })),
          h('div', { class: 'pt-field' }, h('div', { class: 'control-label' }, 'Topics'), topicChips),
          countLine)));
      count();
      requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('.ring').forEach((r) => r._play && r._play())));
    }

    function ring(p, label) {
      const C = 2 * Math.PI * 54;
      const el = h('div', { class: 'ring', html: '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="ring-bg"/>' +
        '<circle cx="60" cy="60" r="54" class="ring-fg" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + C + '"/></svg>' });
      el.append(h('div', { class: 'ring-center' }, h('div', { class: 'ring-num' }, p + '%'), h('div', { class: 'ring-label' }, label)));
      el._play = () => { el.querySelector('.ring-fg').style.strokeDashoffset = String(C * (1 - p / 100)); };
      return el;
    }

    function finish() {
      const review = [];
      segs.forEach((s) => s.review.forEach((r) => review.push(r)));
      UI.results(root, {
        pct: pct(segs), label: 'Session',
        stats: [['rounds', segs.length], ['checkpoints', Math.floor(segs.length / self.EVERY)], ['right', segs.reduce((a, s) => a + s.correct, 0)]],
        extra: segs.length ? recommendations() : null,
        review: review.slice(0, 40), bestKey: c.key, bestValue: pct(segs),
        onRetry: c.restart, onBack: c.exit
      });
    }

    // Setup: choose the starting mix, then go.
    function setup() {
      const tl = TOPICS.filter((t) => !cfg.topics.length || cfg.topics.includes(t.id)).map((t) => t.name);
      root.replaceChildren(h('div', { class: 'setup card pt-setup' },
        h('div', { class: 'setup-icon' }, icon('flag', 26)),
        h('h2', null, 'Checkpoint Mode'),
        h('p', { class: 'muted' }, 'Short rounds that keep switching styles (quiz, matching, typed recall, cause & effect) and topics. Every ' + self.EVERY +
          ' rounds you hit a checkpoint with your scores, what to study next, and a chance to change the mix.'),
        h('div', { class: 'pt-field' }, h('div', { class: 'control-label' }, 'Difficulty'),
          UI.seg([{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }], cfg.diff,
            (v) => { cfg.diff = v; Store.setPref('cpDiff', v); })),
        h('div', { class: 'pt-field' }, h('div', { class: 'control-label' }, 'Relevancy'),
          UI.seg([{ value: 'must', label: 'Must Know' }, { value: 'good', label: 'Good to Know' }, { value: 'niche', label: 'Everything' }], cfg.rel,
            (v) => { cfg.rel = v; Store.setPref('cpRel', v); })),
        h('p', { class: 'muted small' }, 'Topics: ' + (tl.length === TOPICS.length ? 'all' : tl.join(', ')) + ' (change them at any checkpoint)'),
        h('button', { class: 'btn primary big', onclick: runSegment }, 'Start', icon('arrow', 18))));
    }

    setup();
    return () => { if (sub) { try { sub(); } catch (e) {} } };
  }
};
