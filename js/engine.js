// Item filtering, difficulty, distractors, fuzzy answers, adaptive level.
(function () {
  const LEVELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|a|an)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function isMatch(input, item) {
    const a = norm(input);
    if (!a) return false;
    const targets = [item.term, item.term.replace(/\(.*?\)/g, '')].concat(item.aliases || []);
    if (item.kind === 'person') {
      const parts = item.term.replace(/\(.*?\)/g, '').trim().split(/\s+/);
      if (parts.length > 1) targets.push(parts[parts.length - 1]);
    }
    return targets.map(norm).filter(Boolean).some((t) => {
      const tol = t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2;
      return lev(a, t) <= tol;
    });
  }

  // Item ids restart in every unit file (a-001...), so prefix them with the
  // unit id once; mastery is saved per item id.
  function data(id) {
    const d = (window.UNIT_DATA || {})[id];
    if (d && !d._ns) {
      d._ns = true;
      d.items.forEach((i) => { i.id = id + '/' + i.id; });
      // Cause → effect links: data lists causedBy; build ledTo from it.
      const byId = new Map(d.items.map((i) => [i.id, i]));
      d.items.forEach((i) => { i.causedBy = (i.causedBy || []).map((c) => byId.get(id + '/' + c)).filter(Boolean); i.ledTo = []; });
      d.items.forEach((i) => i.causedBy.forEach((c) => c.ledTo.push(i)));
      // Terms that name the same thing (e.g. Black Tuesday / Great Crash) are never wrong answers for each other.
      d.items.forEach((i) => { i.same = []; });
      (d.same || []).forEach((g) => { const its = g.map((c) => byId.get(id + '/' + c)).filter(Boolean); its.forEach((i) => { i.same = its.filter((x) => x !== i); }); });
      d.causeEffect = d.causeEffect || [];
      d.frq = d.frq || [];
    }
    return d;
  }

  // Load data/<id>.js on demand. Resolves even on failure (the screen shows 404).
  const loading = {};
  function load(id) {
    if ((window.UNIT_DATA || {})[id]) return Promise.resolve();
    return loading[id] || (loading[id] = new Promise((done) => {
      const s = document.createElement('script');
      s.src = 'data/' + encodeURIComponent(id) + '.js';
      s.onload = s.onerror = () => { delete loading[id]; done(); };
      document.head.append(s);
    }));
  }

  const byCh = (arr, ch) => (ch === 'all' ? arr : arr.filter((x) => String(x.chapter) === String(ch)));

  // topics: array of topic ids (several can be picked at once). 'everything' = all items.
  function topicItems(d, topics, ch, sub) {
    topics = [].concat(topics);
    let it = byCh(d.items, ch);
    if (!topics.includes('everything')) it = it.filter((i) => (i.topics || []).some((t) => topics.includes(t)));
    if (topics.length === 1 && topics[0] === 'vocab') {
      if (sub === 'laws') it = it.filter((i) => i.kind === 'law');
      if (sub === 'terms') it = it.filter((i) => i.kind !== 'law');
    }
    return it;
  }

  // Relevancy tiers (set per item in the data): must = what everyone should know and
  // what will be on a test; good = important supporting items (incl. all class vocab);
  // niche = small details. isClass = on the class calendar (yellow paper).
  const tierOf = (x) => x.rel || ((x.difficulty || 2) <= 2 ? 'good' : 'niche');
  const isMust = (x) => tierOf(x) === 'must';
  const isClass = (x) => (x.key || []).length > 0;
  const REL_RANK = { must: 1, good: 2, niche: 3 };
  // Cumulative: Good to Know includes Must Know; Niche includes everything.
  function byRelevancy(items, rel) {
    if (rel === 'expansive' || !REL_RANK[rel]) return items;
    return items.filter((x) => REL_RANK[tierOf(x)] <= REL_RANK[rel]);
  }

  const levelOf = (diff) => (diff === 'easy' ? 1 : diff === 'hard' ? 3 : 2);

  // Items at or below a difficulty level (Easy = must-know items only).
  // Widens only when a tier is too small to play.
  function byLevel(items, level, min) {
    min = min || 4;
    for (let l = level; l <= 3; l++) {
      const r = items.filter((i) => (i.difficulty || 2) <= l);
      if (r.length >= min || l === 3) return r.length ? r : items;
    }
    return items;
  }
  // Difficulty now controls question style only; Relevancy picks the items.
  const forDiff = (items) => items;

  // Low mastery first, with some randomness.
  const weighted = (items) => items
    .map((i) => ({ i, k: Store.mastery(i.id) + Math.random() * 2.5 }))
    .sort((a, b) => a.k - b.k).map((x) => x.i);

  function masteryPct(items) {
    if (!items.length) return 0;
    return Math.round(items.reduce((s, i) => s + Store.mastery(i.id), 0) / (items.length * 5) * 100);
  }

  // People only get wrong answers who held the same kind of role (a president's
  // question offers only presidents). If too few share the role, the closest
  // related roles fill in, in this order.
  const RELATED = {
    president: ['candidate', 'senator', 'cabinet'], candidate: ['senator', 'president', 'cabinet'],
    senator: ['candidate', 'cabinet', 'official'], cabinet: ['official', 'senator', 'justice'],
    official: ['cabinet', 'senator'], justice: ['cabinet', 'official'],
    writer: ['thinker'], thinker: ['writer', 'activist'], musician: ['celebrity'], celebrity: ['musician', 'business'],
    business: ['celebrity'], activist: ['thinker', 'trial'], trial: ['activist']
  };
  const lastName = (x) => norm(String(x.term).replace(/\(.*?\)/g, '')).split(' ').pop();
  // Every term in the item's own unit (pool may be cut down by relevancy or chapter).
  const unitItems = (item) => { const d = data(String(item.id).split('/')[0]); return d ? d.items : []; };

  // Plausible wrong answers. Higher level = more similar distractors.
  function distractors(item, pool, n, level, field) {
    field = field || 'term';
    const key = norm(item[field]);
    if (item.role) {
      const order = [item.role].concat(RELATED[item.role] || []);
      const ok = (x) => x.kind === 'person' && x.id !== item.id && x[field] && norm(x[field]) !== key && lastName(x) !== lastName(item) && !(item.same || []).includes(x);
      const out = [], seen = new Set([key]);
      for (const role of order) {
        // Prefer the current pool, then the rest of the unit.
        const cands = shuffle(pool.filter((x) => ok(x) && x.role === role))
          .concat(shuffle(unitItems(item).filter((x) => ok(x) && x.role === role && !pool.includes(x))));
        for (const x of cands) {
          const k = norm(x[field]);
          if (seen.has(k) || out.some((o) => (o.same || []).includes(x))) continue;
          seen.add(k); out.push(x);
          if (out.length === n) return out;
        }
      }
      pool = pool.filter((x) => !out.includes(x) && lastName(x) !== lastName(item));
      return out.concat(distractors(Object.assign({}, item, { role: null }), pool, n - out.length, level, field)
        .filter((x) => !seen.has(norm(x[field]))));
    }
    const scored = pool
      .filter((x) => x.id !== item.id && x[field] && norm(x[field]) !== key && !(item.same || []).includes(x))
      .map((x) => {
        let s = Math.random();
        if (x.kind === item.kind) s += level === 1 ? 0.6 : 2;
        if (level >= 2 && x.chapter === item.chapter) s += 0.5;
        if (level >= 3 && item.year && x.year) s += Math.max(0, 1.5 - Math.abs(item.year - x.year) / 4);
        if (level >= 3 && (x.topics || []).some((t) => (item.topics || []).includes(t))) s += 0.5;
        return { x, s };
      })
      .sort((a, b) => b.s - a.s);
    const out = [], seen = new Set([key]);
    for (const { x } of scored) {
      const k = norm(x[field]);
      if (seen.has(k) || out.some((o) => (o.same || []).includes(x))) continue;
      seen.add(k); out.push(x);
      if (out.length === n) break;
    }
    return out;
  }

  const ROLE_LABEL = { president: 'Which president is this?', candidate: 'Which presidential nominee is this?', senator: 'Which senator is this?',
    cabinet: 'Which cabinet member is this?', justice: 'Which Supreme Court justice is this?', writer: 'Which writer is this?', musician: 'Which musician is this?' };
  function promptLabel(item) {
    if (ROLE_LABEL[item.role]) return ROLE_LABEL[item.role];
    return { person: 'Who is this?', event: 'Which event is this?', law: 'Which law or act is this?' }[item.kind] || 'Which term matches?';
  }

  // Build one quiz question for an item at a level (1-3).
  // Every item contributes its definition question (k = -1) plus each extra
  // written question in item.qs (Must Know 3, Good to Know 2, Niche 1).
  function specs(items) {
    const out = [];
    items.forEach((item) => {
      out.push({ item, k: -1 });
      (item.qs || []).forEach((_, k) => out.push({ item, k }));
    });
    return out;
  }

  // Wrong answers come from the same pool (the chosen relevancy tier).
  // opts.noChrono: skip "Which came first?". opts.only: limit to these question types (e.g. ['causedBy', 'ledTo']).
  function question(item, level, pool, k, opts) {
    if (k != null && k >= 0 && item.qs && item.qs[k] && !(opts && opts.only)) {
      const prompt = item.qs[k];
      if (level >= 3 && Math.random() < 0.4) return { type: 'typed', item, label: 'Type the answer', prompt, answer: item.term };
      const ds = distractors(item, pool, 3, Math.max(level, 2), 'term');
      return { type: 'mc', item, label: promptLabel(item), prompt,
        options: shuffle([item].concat(ds)).map((x) => ({ text: x.term, correct: x === item })), answer: item.term };
    }
    let types = ['def2term'];
    if (level >= 2) types.push('term2def', 'def2term');
    if (level >= 3) {
      types.push('typed');
      // (No 'detail' questions: a side fact often doesn't single out one term.)
      if (item.year && !(opts && opts.noChrono)) types.push('first');
    }
    // Cause & effect questions show up often whenever a term has links.
    const nonPerson = (l) => item.kind !== 'person' && (l || []).some((x) => x.kind !== 'person');
    if (nonPerson(item.causedBy)) types.push('causedBy', 'causedBy');
    if (nonPerson(item.ledTo)) types.push('ledTo', 'ledTo');
    if (opts && opts.only) types = types.filter((x) => opts.only.includes(x));
    if (!types.length) types = ['def2term'];
    let t = pick(types);

    if (t === 'causedBy' || t === 'ledTo') {
      const q = causeQuestion(item, t, pool);
      if (q) return q;
      t = 'def2term';
    }

    if (t === 'first') {
      const others = pool.filter((x) => x.year && x.year !== item.year && x.id !== item.id);
      if (others.length) {
        const close = others.filter((x) => Math.abs(x.year - item.year) <= 5);
        const o = pick(close.length ? close : others);
        const first = item.year < o.year ? item : o, second = first === item ? o : item;
        return {
          type: 'mc', item, label: 'Which came first?', prompt: 'Put these in order: which happened earlier?',
          options: shuffle([item, o]).map((x) => ({ text: x.term, correct: x === first })),
          answer: first.term, explain: first.term + ' (' + first.year + ') came before ' + second.term + ' (' + second.year + ').'
        };
      }
      t = 'def2term';
    }
    if (t === 'typed') return { type: 'typed', item, label: 'Type the answer', prompt: item.def, answer: item.term };
    if (t === 'term2def') {
      const ds = distractors(item, pool, 3, level, 'def');
      if (ds.length === 3) {
        return { type: 'mc', item, label: 'What does this mean?', prompt: item.term,
          options: shuffle([item].concat(ds)).map((x) => ({ text: x.def, correct: x === item })), answer: item.def };
      }
    }
    const ds = distractors(item, pool, 3, level, 'term');
    const useDetail = t === 'detail';
    return {
      type: 'mc', item, label: useDetail ? 'Which does this describe?' : promptLabel(item),
      prompt: useDetail ? item.detail : item.def,
      options: shuffle([item].concat(ds)).map((x) => ({ text: x.term, correct: x === item })), answer: item.term
    };
  }

  // "X was caused by?" / "X led to?": one real link plus three terms that aren't
  // linked that way, preferring ones from around the right time.
  function causeQuestion(item, t, pool) {
    const linked = (t === 'causedBy' ? item.causedBy : item.ledTo).filter((x) => x.kind !== 'person');
    if (!linked.length || item.kind === 'person') return null;
    const answer = pick(linked);
    const all = unitItems(item);
    // Nothing within two cause/effect steps of the term, so no wrong option is secretly right.
    const related = new Set([item]);
    [item].concat(item.causedBy, item.ledTo).forEach((x) => [x].concat(x.causedBy || [], x.ledTo || [], x.same || []).forEach((y) => { related.add(y); (y.same || []).forEach((z) => related.add(z)); }));
    const yr = answer.year || item.year;
    const cands = shuffle(all.filter((x) => !related.has(x) && x.kind !== 'person' && norm(x.term) !== norm(answer.term)))
      .map((x) => ({ x, s: Math.random() + (x.kind === answer.kind ? 1 : 0) + (yr && x.year ? Math.max(0, 1.5 - Math.abs(x.year - yr) / 5) : 0)
        + (pool.includes(x) ? 0.5 : 0) }))
      .sort((a, b) => b.s - a.s).map((o) => o.x)
      .reduce((acc, x) => (acc.length < 3 && !acc.some((y) => (y.same || []).includes(x)) ? acc.concat(x) : acc), []);
    if (cands.length < 3) return null;
    const verb = t === 'causedBy' ? ' helped cause ' : ' led to ';
    return {
      type: 'mc', item, kind: t, label: t === 'causedBy' ? 'What caused this?' : 'What did this lead to?',
      prompt: t === 'causedBy' ? 'Which of these helped bring about ' + item.term + '?' : 'What did ' + item.term + ' lead to?',
      options: shuffle([answer].concat(cands)).map((x) => ({ text: x.term, correct: x === answer })),
      answer: answer.term,
      explain: (t === 'causedBy' ? answer.term + verb + item.term : item.term + verb + answer.term) + '. ' + answer.term + ': ' + answer.def
    };
  }

  // Adaptive: up after 3 right in a row, down after 2 misses in a row.
  function Adaptive() { this.level = 2; this.streak = 0; this.miss = 0; }
  Adaptive.prototype.record = function (ok) {
    if (ok) {
      this.streak++; this.miss = 0;
      if (this.streak >= 3 && this.level < 3) { this.level++; this.streak = 0; return 'up'; }
    } else {
      this.miss++; this.streak = 0;
      if (this.miss >= 2 && this.level > 1) { this.level--; this.miss = 0; return 'down'; }
    }
    return null;
  };

  window.Engine = {
    LEVELS, shuffle, pick, norm, lev, isMatch, data, load, byCh, topicItems, isMust, isClass, tierOf, byRelevancy, levelOf, byLevel, forDiff,
    weighted, masteryPct, distractors, question, specs, Adaptive
  };
})();
