window.Modes = window.Modes || {};
Modes.quiz = {
  name: 'Quiz', icon: 'quiz',
  desc: 'Multiple choice. Hard mode mixes in typed answers, "which came first?", and detail questions.',
  available: (c) => (c.items.length >= 4 ? null : 'Needs at least 4 items'),
  start(root, c) {
    const { h, icon } = UI;
    const adaptive = c.diff === 'adaptive';
    // Each term contributes several questions (definition + its written questions).
    const base = Engine.specs(c.items);
    const mustItems = c.items.filter(Engine.isMust);
    let off = () => {}, nav = null;

    function setup() {
      let len = Store.pref('quizLen') || '10';
      let custom = +Store.pref('quizCustom') || 15;
      if (len === 'must' && !mustItems.length) len = '10';
      const opts = [{ value: '10', label: '10' }, { value: '20', label: '20' }];
      if (mustItems.length) opts.push({ value: 'must', label: 'All Must Know (' + mustItems.length + ')', title: 'One question for every Must Know term here' });
      opts.push({ value: 'all', label: 'All ' + base.length }, { value: 'custom', label: 'Custom' });
      const num = h('input', { type: 'number', class: 'num-in', min: '1', max: String(base.length), value: String(custom), 'aria-label': 'Number of questions' });
      const customRow = h('label', { class: 'custom-num' + (len === 'custom' ? '' : ' hidden') }, num, h('span', null, 'questions'));
      num.addEventListener('input', () => { custom = Math.max(1, Math.min(base.length, Math.round(+num.value) || 1)); Store.setPref('quizCustom', custom); });
      const start = () => run(len, custom);
      root.replaceChildren(h('div', { class: 'setup card' },
        h('div', { class: 'setup-icon' }, icon('quiz', 26)),
        h('h2', null, 'How many questions?'),
        UI.seg(opts, len, (v) => {
          len = v; Store.setPref('quizLen', v);
          customRow.classList.toggle('hidden', v !== 'custom');
          if (v === 'custom') setTimeout(() => num.select(), 30);
        }),
        customRow,
        h('p', { class: 'muted small' }, base.length + ' questions available' + (adaptive ? ' · difficulty adjusts as you go' : '')),
        h('button', { class: 'btn primary big', onclick: start }, 'Start quiz', icon('arrow', 18))));
      off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } });
    }

    function run(lenPref, custom) {
      off();
      // "All Must Know" = one question (random angle) for every Must Know term.
      const mustOrder = lenPref === 'must'
        ? Engine.shuffle(mustItems).map((item) => Engine.pick(base.filter((s) => s.item === item)))
        : null;
      const len = mustOrder ? mustOrder.length
        : lenPref === 'all' ? base.length
        : lenPref === 'custom' ? Math.min(base.length, custom || 15)
        : Math.min(base.length, +lenPref);
      // Shuffle, then avoid asking about the same term twice in a row.
      const spread = (a) => {
        for (let x = 1; x < a.length; x++) {
          if (a[x].item.id !== a[x - 1].item.id) continue;
          const y = a.findIndex((s, z) => z > x && s.item.id !== a[x - 1].item.id);
          if (y > 0) [a[x], a[y]] = [a[y], a[x]];
        }
        return a;
      };
      const order = mustOrder || (adaptive ? null : spread(Engine.shuffle(base)).slice(0, len));
      const A = adaptive ? new Engine.Adaptive() : null;
      const used = new Set();
      const S = [];   // per question: { q, done, ok, your, pick, flag }
      let i = 0, lastId = null;

      const fill = h('i');
      const count = h('span', { class: 'mode-count' });
      const lvlChip = A ? h('span', { class: 'chip accent' }) : null;
      const stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), lvlChip, count), stage);
      nav = UI.navigator(len, (k) => go(k), root);

      function adaptiveSpec() {
        const rem = base.filter((s) => !used.has(s.item.id + ':' + s.k));
        let at = rem.filter((s) => (s.item.difficulty || 2) <= A.level);
        if (!at.length) at = rem;
        const fresh = at.filter((s) => s.item.id !== lastId);
        const pickFrom = fresh.length ? fresh : at;
        const item = Engine.weighted(Array.from(new Set(pickFrom.map((s) => s.item))))[0];
        return Engine.pick(pickFrom.filter((s) => s.item === item));
      }
      // Questions are built when first reached (Adaptive needs your earlier answers).
      function ensure(k) {
        while (S.length <= k) {
          const spec = order ? order[S.length] : adaptiveSpec();
          used.add(spec.item.id + ':' + spec.k); lastId = spec.item.id;
          const lvl = A ? A.level : Engine.levelOf(c.diff);
          S.push({ q: Engine.question(spec.item, lvl, c.all, spec.k, c.qOpts), lvl });
        }
      }

      function go(k) {
        if (k < 0 || k >= len) return;
        if (A && k > S.length) { UI.toast('Adaptive mode goes in order'); return; }
        if (A && k === S.length && S.some((s) => !s.done)) { UI.toast('Answer the current question first'); return; }
        ensure(k);
        i = k;
        render();
      }

      function toggleFlag() { S[i].flag = !S[i].flag; render(true); if (S[i].flag) UI.flagPulse(); }

      let glowFor = null;
      function render(keepAnim) {
        if (S[i] !== glowFor) { UI.unwave(); glowFor = S[i]; }   // the answer glow lasts until the next question
        const st = S[i], q = st.q;
        const done = S.filter((s) => s.done).length;
        fill.style.width = (done / len) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + len;
        if (lvlChip) lvlChip.textContent = Engine.LEVELS[st.lvl];
        const body = h('div', { class: 'q-card card' + (keepAnim ? '' : ' swap-in') },
          h('div', { class: 'q-head' }, h('div', { class: 'q-label' }, q.label), UI.flagBtn(!!st.flag, toggleFlag)),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt));
        if (q.type === 'mc') {
          const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
          q.options.forEach((o, k) => {
            const b = h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => choose(k, e.currentTarget) },
              h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text));
            if (st.done) {
              b.disabled = true;
              if (o.correct) b.classList.add('correct');
              if (k === st.pick && !o.correct) b.classList.add('wrong');
            }
            list.append(UI.crossable(b, st, k));
          });
          body.append(list);
        } else {
          const input = h('input', { class: 'text-in', type: 'text', placeholder: 'Type your answer…', autocomplete: 'off', spellcheck: 'false' });
          if (st.done) { input.value = st.your || ''; input.disabled = true; input.classList.add(st.ok ? 'correct' : 'wrong'); }
          body.append(h('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); if (!st.done) typed(input); } },
            input, h('button', { class: 'btn primary', type: 'submit', disabled: st.done || null }, 'Check')));
          if (!st.done) setTimeout(() => input.focus(), 60);
        }
        stage.replaceChildren(body);
        if (st.done) body.append(explainBox(st, true));
        nav.update(S.concat(Array(len - S.length).fill({})).map((s, k) => s), i);
      }

      function nextOpen() {
        for (let d = 1; d <= len; d++) {
          const k = (i + d) % len;
          if (!S[k] || !S[k].done) return k;
        }
        return -1;
      }

      function explainBox(st, quiet) {
        const it = st.q.item, ok = st.ok, last = nextOpen() === -1;
        const box = h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') + (quiet ? ' quiet' : '') },
          h('div', { class: 'explain-head' }, icon(ok ? 'check' : 'x', 16), ok ? 'Correct' : 'Not quite'),
          st.q.explain ? h('p', null, st.q.explain) : null,
          h('p', null, h('b', null, it.term), ' — ', it.def),
          it.detail ? h('p', { class: 'muted' }, it.detail) : null,
          it.essay ? h('p', { class: 'muted small' }, h('b', null, 'Essay use: '), it.essay) : null,
          it.wiki ? h('p', { class: 'small' }, UI.wikiLink(it)) : null,
          h('div', { class: 'explain-foot' },
            h('span', { class: 'muted small' }, [it.chapter && 'Ch. ' + it.chapter, it.page && 'p. ' + it.page, it.weight && 'weight ' + it.weight + '/10'].filter(Boolean).join(' · ')),
            h('button', { class: 'btn primary', onclick: advance }, last ? 'See results' : 'Next', icon('arrow', 16))));
        return box;
      }

      function settle(st) {
        Store.bump(st.q.item.id, st.ok ? 1 : -1);
        if (A) {
          const ch = A.record(st.ok);
          if (ch) UI.toast(ch === 'up' ? 'Level up → ' + Engine.LEVELS[A.level] : 'Easing to ' + Engine.LEVELS[A.level]);
        }
        const box = explainBox(st);
        stage.firstChild.append(box);
        box.querySelector('.btn.primary').focus({ preventScroll: true });
        box.scrollIntoView({ block: 'nearest', behavior: UI.reduced() ? 'auto' : 'smooth' });
        nav.update(S.concat(Array(len - S.length).fill({})), i);
        fill.style.width = (S.filter((s) => s.done).length / len) * 100 + '%';
      }

      function choose(k, btn) {
        const st = S[i];
        if (st.done) return;
        const o = st.q.options[k];
        Object.assign(st, { done: true, ok: o.correct, pick: k, your: o.correct ? null : o.text });
        stage.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (st.q.options[j].correct) b.classList.add('correct', 'hold'); });
        if (!o.correct) btn.classList.add('wrong', 'hold');
        UI.wave(btn, o.correct, true);
        settle(st);
      }

      function typed(input) {
        const st = S[i];
        const val = input.value.trim();
        if (!val) { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); return; }
        const ok = Engine.isMatch(val, st.q.item);
        Object.assign(st, { done: true, ok, your: val });
        input.disabled = true;
        input.classList.add(ok ? 'correct' : 'wrong');
        UI.wave(input, ok, true);
        settle(st);
      }

      function advance() {
        const k = nextOpen();
        if (k === -1) return finish();
        go(k);
      }

      off = UI.keys((e) => {
        const st = S[i];
        if (!st) return;
        const typing = (e.target.tagName || '').toLowerCase() === 'input';
        if (!st.done && st.q.type === 'mc' && /^[1-4]$/.test(e.key)) {
          const b = stage.querySelectorAll('.opt')[+e.key - 1];
          if (b) b.click();
        } else if (st.done && e.key === 'Enter') { e.preventDefault(); advance(); }
        else if (!typing && (e.key === 'f' || e.key === 'F')) toggleFlag();
        else if (!typing && e.key === 'ArrowRight') go(i + 1);
        else if (!typing && e.key === 'ArrowLeft') go(i - 1);
      });

      function finish() {
        off();
        nav.destroy(); nav = null;
        const score = S.filter((s) => s.ok).length;
        const review = S.filter((s) => !s.ok).map((s) => ({ prompt: s.q.prompt, answer: s.q.answer, your: s.your }));
        if (c.onComplete) return c.onComplete({ correct: score, total: len, review });
        UI.results(root, {
          pct: (score / len) * 100, label: score + ' of ' + len + ' correct',
          stats: [['questions', len], ['correct', score], A ? ['final level', Engine.LEVELS[A.level]] : ['missed', len - score]],
          review, bestKey: c.key, bestValue: Math.round((score / len) * 100),
          onRetry: c.restart, onBack: c.exit
        });
      }

      go(0);
    }

    if (c.autoLen) run(String(c.autoLen)); else setup();
    return () => { off(); if (nav) nav.destroy(); };
  }
};
