window.Modes = window.Modes || {};
// Practice Test: every Must Know term + a few less-relevant ones, graded like a
// real test (no feedback until the end). Two scores: Raw % and Weighted %.
Modes.practicetest = {
  name: 'Practice Test', icon: 'check',
  desc: 'Every Must Know term plus a few less-relevant ones, graded like a real test with Raw and Weighted scores.',
  WEIGHTS: { must: 7, good: 5, niche: 3 },   // fallback when a term has no weight of its own
  weightOf(x) { return x.weight || this.WEIGHTS[Engine.tierOf(x)]; },
  available(c) { return c.topicAll.filter(Engine.isMust).length >= 4 ? null : 'Needs at least 4 Must Know terms'; },
  start(root, c) {
    const { h, icon } = UI;
    const weightOf = (x) => this.weightOf(x);
    const must = c.topicAll.filter(Engine.isMust);
    const others = c.topicAll.filter((x) => !Engine.isMust(x));
    let extra = Store.pref('ptExtra'); if (extra == null) extra = 5;
    let diff = Store.pref('ptDiff') || 'medium';
    let off = () => {};

    // Weighted pick without replacement: terms with higher weight are likelier to be chosen.
    function weightedSample(arr, n) {
      return arr.map((x) => ({ x, k: Math.pow(Math.random(), 1 / weightOf(x)) }))
        .sort((a, b) => b.k - a.k).slice(0, n).map((o) => o.x);
    }

    function setup() {
      const num = h('output', { class: 'step-val mono' }, String(extra));
      const summary = h('p', { class: 'muted small' });
      const sync = () => {
        num.textContent = String(extra);
        const n = must.length + Math.min(extra, others.length);
        summary.textContent = n + ' questions: ' + must.length + ' Must Know + ' + Math.min(extra, others.length) + ' extra · about ' + Math.ceil(n * 0.4) + ' min';
      };
      const step = (d) => { extra = Math.max(0, Math.min(Math.min(40, others.length), extra + d)); Store.setPref('ptExtra', extra); sync(); };
      sync();
      root.replaceChildren(h('div', { class: 'setup card pt-setup' },
        h('div', { class: 'setup-icon' }, icon('check', 26)),
        h('h2', null, 'Practice Test'),
        h('p', { class: 'muted' }, 'Every Must Know term, plus extra terms picked by how likely they are to show up on a real test. No answers until the end.'),
        h('div', { class: 'pt-field' },
          h('div', { class: 'control-label' }, 'Extra less-relevant terms'),
          h('div', { class: 'stepper' },
            h('button', { class: 'icon-btn sm', 'aria-label': 'Fewer', onclick: () => step(-1) }, '−'),
            num,
            h('button', { class: 'icon-btn sm', 'aria-label': 'More', onclick: () => step(1) }, '+'))),
        h('div', { class: 'pt-field' },
          h('div', { class: 'control-label' }, 'Difficulty'),
          UI.seg([{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }], diff,
            (v) => { diff = v; Store.setPref('ptDiff', v); })),
        h('div', { class: 'pt-weights muted small' },
          'Weighted score counts each question by its term\'s weight (1–10): how likely it is to show up on a real test.'),
        summary,
        h('button', { class: 'btn primary big', onclick: run }, 'Start test', icon('arrow', 18))));
      off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    }

    function run() {
      off();
      const items = Engine.shuffle(must.concat(weightedSample(others, extra)));
      const level = Engine.levelOf(diff);
      const log = [];
      let i = 0, q = null, locked = false;
      const fill = h('i'), count = h('span', { class: 'mode-count' }), stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

      function next() {
        if (i >= items.length) return finish();
        const item = items[i];
        const ks = [-1].concat((item.qs || []).map((_, k) => k));
        q = Engine.question(item, level, c.all, Engine.pick(ks));
        locked = false;
        fill.style.width = (i / items.length) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + items.length;
        const body = h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, q.label),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt));
        if (q.type === 'mc') {
          const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
          q.options.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => answer(o.correct, o.text, e.currentTarget) },
            h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text))));
          body.append(list);
        } else {
          const input = h('input', { class: 'text-in', type: 'text', placeholder: 'Type your answer…', autocomplete: 'off', spellcheck: 'false' });
          body.append(h('form', { class: 'typed', onsubmit: (e) => {
            e.preventDefault();
            const v = input.value.trim(); if (!v) return;
            answer(Engine.isMatch(v, q.item), v, input);
          } }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Submit')));
          setTimeout(() => input.focus(), 60);
        }
        stage.replaceChildren(body);
      }

      // No right/wrong shown during the test; the choice is just marked and we move on.
      function answer(ok, your, el) {
        if (locked) return;
        locked = true;
        el.classList.add('picked');
        log.push({ item: q.item, ok, prompt: q.prompt, answer: q.answer, your });
        Store.bump(q.item.id, ok ? 1 : -1);
        setTimeout(() => { i++; next(); }, UI.reduced() ? 0 : 280);
      }

      off = UI.keys((e) => {
        if (!locked && q && q.type === 'mc' && /^[1-4]$/.test(e.key)) {
          const b = stage.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click();
        }
      });

      function finish() {
        off();
        const n = log.length, right = log.filter((x) => x.ok).length;
        let wSum = 0, wGot = 0;
        const by = { must: [0, 0], good: [0, 0], niche: [0, 0] };
        log.forEach((x) => {
          const t = Engine.tierOf(x.item), w = weightOf(x.item);
          wSum += w; if (x.ok) wGot += w;
          by[t][1]++; if (x.ok) by[t][0]++;
        });
        const raw = n ? (right / n) * 100 : 0, weighted = wSum ? (wGot / wSum) * 100 : 0;
        const tierStat = (t, label) => (by[t][1] ? [[label, by[t][0] + '/' + by[t][1]]] : []);
        UI.results(root, {
          pct: weighted,
          rings: [{ pct: raw, label: 'Raw' }, { pct: weighted, label: 'Weighted' }],
          stats: [['questions', n], ['correct', right]].concat(tierStat('must', 'Must Know'), tierStat('good', 'Good to Know'), tierStat('niche', 'Niche')),
          review: log.filter((x) => !x.ok).map((x) => ({ prompt: x.prompt, answer: x.answer, your: x.your })),
          bestKey: c.key, bestValue: Math.round(weighted),
          onRetry: c.restart, onBack: c.exit
        });
      }

      next();
    }

    setup();
    return () => off();
  }
};
