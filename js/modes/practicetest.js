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
    const mini = !!this.mini;
    const must = c.topicAll.filter(Engine.isMust);
    const others = c.topicAll.filter((x) => !Engine.isMust(x));
    let extra = Store.pref('ptExtra'); if (extra == null) extra = 5;
    let diff = Store.pref('ptDiff') || 'medium';
    let off = () => {}, nav = null;

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
      if (mini) {
        const n = Math.min(Modes.minitest.SIZE, must.length + others.length);
        root.replaceChildren(h('div', { class: 'setup card pt-setup' },
          h('div', { class: 'setup-icon' }, icon('target', 26)),
          h('h2', null, 'Mini Test'),
          h('p', { class: 'muted' }, n + ' quick questions on Must Know terms, picked by how likely they are to show up on a real test. At the end you get a list of what to study next.'),
          h('div', { class: 'pt-field' },
            h('div', { class: 'control-label' }, 'Difficulty'),
            UI.seg([{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }], diff,
              (v) => { diff = v; Store.setPref('ptDiff', v); })),
          h('p', { class: 'muted small' }, n + ' questions · about ' + Math.ceil(n * 0.4) + ' min'),
          h('button', { class: 'btn primary big', onclick: run }, 'Start mini test', icon('arrow', 18))));
        off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
        return;
      }
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
      const size = Modes.minitest.SIZE;
      const items = Engine.shuffle(mini
        ? weightedSample(must, size).concat(weightedSample(others, Math.max(0, size - must.length)))
        : must.concat(weightedSample(others, extra)));
      const level = Engine.levelOf(diff);
      // Every question is built up front so you can move around, flag, and change answers.
      const S = items.map((item) => {
        const ks = [-1].concat((item.qs || []).map((_, k) => k));
        return { item, q: Engine.question(item, level, c.all, Engine.pick(ks), { noChrono: true }), pick: null, text: '', flag: false };
      });
      const isAnswered = (s) => (s.q.type === 'mc' ? s.pick != null : !!s.text.trim());
      let i = 0, inputEl = null, armed = false;
      const fill = h('i'), count = h('span', { class: 'mode-count' }), stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);
      nav = UI.navigator(S.length, (k) => go(k), root);

      function saveTyped() { if (inputEl && S[i].q.type !== 'mc') S[i].text = inputEl.value; }
      function go(k) { if (k < 0 || k >= S.length) return; saveTyped(); i = k; armed = false; render(); }
      function nextOpen() {
        for (let d = 1; d < S.length; d++) { const k = (i + d) % S.length; if (!isAnswered(S[k])) return k; }
        return -1;
      }

      function render(keep) {
        const st = S[i], q = st.q;
        const done = S.filter(isAnswered).length;
        fill.style.width = (done / S.length) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + S.length + ' · ' + done + ' answered';
        const body = h('div', { class: 'q-card card' + (keep ? '' : ' swap-in') },
          h('div', { class: 'q-head' }, h('div', { class: 'q-label' }, q.label),
            UI.flagBtn(st.flag, () => { st.flag = !st.flag; saveTyped(); render(true); if (st.flag) UI.flagPulse(); })),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt));
        inputEl = null;
        if (q.type === 'mc') {
          const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
          q.options.forEach((o, k) => list.append(UI.crossable(h('button', { class: 'opt' + (st.pick === k ? ' picked' : ''), style: { '--i': k }, onclick: () => pick(k) },
            h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text)), st, k)));
          body.append(list);
        } else {
          inputEl = h('input', { class: 'text-in', type: 'text', placeholder: 'Type your answer…', autocomplete: 'off', spellcheck: 'false', value: st.text });
          inputEl.addEventListener('input', () => { st.text = inputEl.value; syncNav(); });
          body.append(h('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); saveTyped(); forward(); } },
            inputEl, h('button', { class: 'btn primary', type: 'submit' }, 'Save')));
          setTimeout(() => inputEl && inputEl.focus(), 60);
        }
        const all = done === S.length;
        const submitBtn = h('button', { class: 'btn ' + (all ? 'primary' : 'ghost'), onclick: submit },
          armed ? (S.length - done) + ' unanswered: submit anyway?' : all ? 'Submit test' : 'Submit (' + (S.length - done) + ' left)');
        body.append(h('div', { class: 'pt-foot' },
          h('button', { class: 'btn ghost sm', disabled: i === 0 || null, onclick: () => go(i - 1) }, icon('back', 14), 'Back'),
          h('button', { class: 'btn ghost sm', disabled: i === S.length - 1 || null, onclick: () => go(i + 1) }, 'Next', icon('arrow', 14)),
          h('span', { class: 'pt-spacer' }), submitBtn));
        stage.replaceChildren(body);
        syncNav();
      }
      function syncNav() { nav.update(S.map((s) => ({ done: isAnswered(s), flag: s.flag })), i); }

      // No right/wrong during the test. A first answer moves you on; changing an answer stays put.
      function pick(k) {
        const st = S[i], first = st.pick == null;
        st.pick = k;
        if (st.cross) st.cross[k] = false;   // picking a crossed-out choice un-crosses it
        render(true);
        if (first) setTimeout(() => { if (S[i] === st) forward(); }, UI.reduced() ? 0 : 260);
      }
      function forward() { const k = nextOpen(); if (k !== -1) go(k); else render(true); }

      function submit() {
        saveTyped();
        const left = S.filter((s) => !isAnswered(s)).length;
        if (left && !armed) { armed = true; render(true); return; }
        finish();
      }

      off = UI.keys((e) => {
        const st = S[i]; if (!st) return;
        const typing = (e.target.tagName || '').toLowerCase() === 'input';
        if (st.q.type === 'mc' && /^[1-4]$/.test(e.key)) pick(+e.key - 1);
        else if (!typing && (e.key === 'f' || e.key === 'F')) { st.flag = !st.flag; render(true); if (st.flag) UI.flagPulse(); }
        else if (!typing && e.key === 'ArrowRight') go(i + 1);
        else if (!typing && e.key === 'ArrowLeft') go(i - 1);
      });

      function finish() {
        off();
        nav.destroy(); nav = null;
        const log = S.map((s) => {
          const ok = s.q.type === 'mc' ? s.pick != null && s.q.options[s.pick].correct : Engine.isMatch(s.text, s.item);
          const your = s.q.type === 'mc' ? (s.pick != null ? s.q.options[s.pick].text : '(no answer)') : (s.text.trim() || '(no answer)');
          Store.bump(s.item.id, ok ? 1 : -1);
          return { item: s.item, ok, prompt: s.q.prompt, answer: s.q.answer, your, flag: s.flag, explain: s.q.explain };
        });
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
        const flagged = log.filter((x) => x.flag).length;
        UI.results(root, {
          pct: weighted,
          rings: [{ pct: raw, label: 'Raw' }, { pct: weighted, label: 'Weighted' }],
          stats: [['questions', n], ['correct', right]].concat(tierStat('must', 'Must Know'), tierStat('good', 'Good to Know'), tierStat('niche', 'Niche'), flagged ? [['flagged', flagged]] : []),
          // Missed questions first, then flagged ones you got right.
          review: log.filter((x) => !x.ok).concat(log.filter((x) => x.ok && x.flag))
            .map((x) => ({ prompt: (x.flag ? '⚑ ' : '') + x.prompt, answer: x.answer, your: x.ok ? null : x.your, why: x.ok ? null : whyText(x) })),
          extra: recommend(log),
          bestKey: c.key, bestValue: Math.round(weighted),
          onRetry: c.restart, onBack: c.exit
        });
      }

      // Why the right answer is right, and what the choice you picked actually was.
      function whyText(x) {
        const it = x.item;
        let s = x.explain || (it.term + ': ' + it.def + (it.detail ? ' ' + it.detail : ''));
        const mine = x.your && (c.all.concat(c.topicAll)).find((y) => y.term === x.your || y.def === x.your);
        if (mine && mine !== it) s += ' (You picked ' + mine.term + ': ' + mine.def + ')';
        return s;
      }

      // What to study next: topics ranked by how much test weight you missed there.
      function recommend(log) {
        const missed = log.filter((x) => !x.ok).map((x) => x.item);
        const u = c.unit;
        const route = (t, m) => '#/u/' + encodeURIComponent(u.id) + '/t/' + t + (m ? '/m/' + m : '');
        const subj = (window.SUBJECTS || []).find((s) => s.id === u.subject) || {};
        const topics = (subj.topics || window.DEFAULT_TOPICS || []).filter((t) => t.id !== 'everything');
        const byWeight = (a, b) => weightOf(b) - weightOf(a);
        const recs = [];
        const mustMissed = missed.filter(Engine.isMust);
        if (mini || mustMissed.length) recs.push({ icon: 'flag', title: 'Go to Checkpoint Mode',
          why: (mustMissed.length ? 'You missed ' + mustMissed.length + ' Must Know term' + (mustMissed.length === 1 ? '' : 's') + '. ' : '') + 'Mixed rounds across every topic, with a checkpoint every 3 rounds to track what is sticking.',
          terms: mustMissed.sort(byWeight).slice(0, 4), href: route('everything', 'checkpoint') });
        topics.map((t) => {
          const items = missed.filter((x) => (x.topics || []).includes(t.id));
          return { t, items, score: items.reduce((s, x) => s + weightOf(x), 0) };
        }).filter((r) => r.items.length).sort((a, b) => b.score - a.score).slice(0, 3).forEach((r) => recs.push({
          icon: r.t.icon || 'book', title: 'Study ' + r.t.name,
          why: 'Missed ' + r.items.length + ' here. Teach Me walks them up to mastery, from reading each card to writing it from memory.',
          terms: r.items.sort(byWeight), href: route(r.t.id, 'teach') }));
        // Show each term once: a card lists its top terms not already shown above it.
        const shown = new Set();
        recs.forEach((r) => {
          const fresh = r.terms.filter((x) => !shown.has(x.id));
          r.terms = (fresh.length ? fresh : r.terms).slice(0, 4);
          r.terms.forEach((x) => shown.add(x.id));
        });
        if (!recs.length) recs.push({ icon: 'check', title: 'Raise the bar',
          why: 'Nothing missed. Add more extra terms to the next practice test, or study Niche terms on Hard.',
          terms: [], href: route('everything') });
        return UI.h('div', { class: 'review recs' },
          UI.h('div', { class: 'section-label' }, 'Recommended'),
          recs.map((r, k) => UI.h('a', { class: 'review-item rec', href: r.href, style: { '--i': k } },
            UI.h('div', { class: 'rec-head' }, UI.icon(r.icon, 18), UI.h('b', null, r.title), UI.h('span', { class: 'go' }, UI.icon('arrow', 16))),
            UI.h('div', { class: 'review-prompt' }, r.why),
            r.terms.length ? UI.h('div', { class: 'rec-terms' }, r.terms.map((x) => UI.h('span', { class: 'chip' }, x.term))) : null)));
      }

      render();
    }

    setup();
    return () => { off(); if (nav) nav.destroy(); };
  }
};