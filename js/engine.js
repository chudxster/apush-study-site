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

  const data = (id) => (window.UNIT_DATA || {})[id];
  const byCh = (arr, ch) => (ch === 'all' ? arr : arr.filter((x) => String(x.chapter) === String(ch)));

  function topicItems(d, topic, ch, sub) {
    let it = byCh(d.items, ch);
    if (topic !== 'everything') it = it.filter((i) => (i.topics || []).includes(topic));
    if (topic === 'vocab' && sub === 'laws') it = it.filter((i) => i.kind === 'law');
    if (topic === 'vocab' && sub === 'terms') it = it.filter((i) => i.kind !== 'law');
    return it;
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
  const forDiff = (items, diff) => (diff === 'hard' || diff === 'adaptive' ? items : byLevel(items, levelOf(diff)));

  // Low mastery first, with some randomness.
  const weighted = (items) => items
    .map((i) => ({ i, k: Store.mastery(i.id) + Math.random() * 2.5 }))
    .sort((a, b) => a.k - b.k).map((x) => x.i);

  function masteryPct(items) {
    if (!items.length) return 0;
    return Math.round(items.reduce((s, i) => s + Store.mastery(i.id), 0) / (items.length * 5) * 100);
  }

  // Plausible wrong answers. Higher level = more similar distractors.
  function distractors(item, pool, n, level, field) {
    field = field || 'term';
    const key = norm(item[field]);
    const scored = pool
      .filter((x) => x.id !== item.id && x[field] && norm(x[field]) !== key)
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
      if (seen.has(k)) continue;
      seen.add(k); out.push(x);
      if (out.length === n) break;
    }
    return out;
  }

  function promptLabel(item) {
    return { person: 'Who is this?', event: 'Which event is this?', law: 'Which law or act is this?' }[item.kind] || 'Which term matches?';
  }

  // Build one quiz question for an item at a level (1-3).
  // Wrong answers come from the same tier, so Easy never shows minor details.
  function question(item, level, pool) {
    if (level < 3) pool = byLevel(pool, level, 12);
    const types = ['def2term'];
    if (level >= 2) types.push('term2def', 'def2term');
    if (level >= 3) {
      types.push('typed');
      if (item.detail) types.push('detail');
      if (item.year) types.push('first');
    }
    let t = pick(types);

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
    LEVELS, shuffle, pick, norm, lev, isMatch, data, byCh, topicItems, levelOf, byLevel, forDiff,
    weighted, masteryPct, distractors, question, Adaptive
  };
})();
