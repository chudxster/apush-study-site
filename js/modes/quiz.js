window.Modes = window.Modes || {};
Modes.quiz = {
  name: 'Quiz', icon: 'quiz',
  desc: 'Multiple choice. Hard mode mixes in typed answers, "which came first?", and detail questions.',
  available: (c) => (c.items.length >= 4 ? null : 'Needs at least 4 items'),
  start(root, c) {
    const { h, icon } = UI;
    const adaptive = c.diff === 'adaptive';
    const base = adaptive ? c.items : Engine.forDiff(c.items, c.diff);
    let off = () => {};

    function setup() {
      let len = Store.pref('quizLen') || '10';
      root.replaceChildren(h('div', { class: 'setup card' },
        h('div', { class: 'setup-icon' }, icon('quiz', 26)),
        h('h2', null, 'How many questions?'),
        UI.seg([{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: 'all', label: 'All ' + base.length }], len,
          (v) => { len = v; Store.setPref('quizLen', v); }),
        h('p', { class: 'muted small' }, base.length + ' questions available' + (adaptive ? ' · difficulty adjusts as you go' : '')),
        h('button', { class: 'btn primary big', onclick: () => run(len) }, 'Start quiz', icon('arrow', 18))));
      off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); run(len); } });
    }

    function run(lenPref) {
      off();
      const len = lenPref === 'all' ? base.length : Math.min(base.length, +lenPref);
      const order = adaptive ? null : Engine.shuffle(base).slice(0, len);
      const A = adaptive ? new Engine.Adaptive() : null;
      const used = new Set(), review = [];
      let i = 0, score = 0, q = null, answered = false;

      const fill = h('i');
      const count = h('span', { class: 'mode-count' });
      const lvlChip = A ? h('span', { class: 'chip accent' }) : null;
      const stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), lvlChip, count), stage);

      function nextItem() {
        if (!A) return order[i];
        const rem = c.items.filter((x) => !used.has(x.id));
        const at = rem.filter((x) => (x.difficulty || 2) <= A.level);
        return Engine.weighted(at.length ? at : rem)[0];
      }

      function next() {
        if (i >= len) return finish();
        const item = nextItem();
        used.add(item.id);
        const lvl = A ? A.level : Engine.levelOf(c.diff);
        q = Engine.question(item, lvl, c.all);
        answered = false;
        fill.style.width = (i / len) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + len;
        if (lvlChip) lvlChip.textContent = Engine.LEVELS[A.level];
        render();
      }

      function render() {
        const body = h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, q.label),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt));
        if (q.type === 'mc') {
          const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
          q.options.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => choose(o, e.currentTarget, list) },
            h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text))));
          body.append(list);
        } else {
          const input = h('input', { class: 'text-in', type: 'text', placeholder: 'Type your answer…', autocomplete: 'off', spellcheck: 'false' });
          const form = h('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); if (!answered) typed(input); } },
            input, h('button', { class: 'btn primary', type: 'submit' }, 'Check'));
          body.append(form);
          setTimeout(() => input.focus(), 60);
        }
        stage.replaceChildren(body);
      }

      function explain(ok, yours) {
        const it = q.item;
        const box = h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') },
          h('div', { class: 'explain-head' }, icon(ok ? 'check' : 'x', 16), ok ? 'Correct' : 'Not quite'),
          q.explain ? h('p', null, q.explain) : null,
          h('p', null, h('b', null, it.term), ' — ', it.def),
          it.detail ? h('p', { class: 'muted' }, it.detail) : null,
          h('div', { class: 'explain-foot' },
            h('span', { class: 'muted small' }, 'Ch. ' + it.chapter + ' · p. ' + it.page),
            h('button', { class: 'btn primary', onclick: advance }, i + 1 >= len ? 'See results' : 'Next', icon('arrow', 16))));
        stage.firstChild.append(box);
        box.querySelector('.btn').focus({ preventScroll: true });
        box.scrollIntoView({ block: 'nearest', behavior: UI.reduced() ? 'auto' : 'smooth' });
        settle(ok, yours);
      }

      function settle(ok, yours) {
        if (ok) score++;
        Store.bump(q.item.id, ok ? 1 : -1);
        if (!ok) review.push({ prompt: q.prompt, answer: q.answer, your: yours });
        if (A) {
          const ch = A.record(ok);
          if (ch) UI.toast(ch === 'up' ? 'Level up → ' + Engine.LEVELS[A.level] : 'Easing to ' + Engine.LEVELS[A.level]);
        }
      }

      function choose(o, btn, list) {
        if (answered) return;
        answered = true;
        list.querySelectorAll('.opt').forEach((b, k) => {
          b.disabled = true;
          if (q.options[k].correct) b.classList.add('correct');
        });
        if (!o.correct) btn.classList.add('wrong');
        UI.wave(btn, o.correct);
        explain(o.correct, o.correct ? null : o.text);
      }

      function typed(input) {
        const val = input.value.trim();
        if (!val) { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); return; }
        answered = true;
        const ok = Engine.isMatch(val, q.item);
        input.disabled = true;
        input.classList.add(ok ? 'correct' : 'wrong');
        UI.wave(input, ok);
        explain(ok, ok ? null : val);
      }

      function advance() { i++; next(); }

      off = UI.keys((e) => {
        if (!q) return;
        if (!answered && q.type === 'mc' && /^[1-4]$/.test(e.key)) {
          const b = stage.querySelectorAll('.opt')[+e.key - 1];
          if (b) b.click();
        } else if (answered && e.key === 'Enter') { e.preventDefault(); advance(); }
      });

      function finish() {
        off();
        UI.results(root, {
          pct: (score / len) * 100, label: score + ' of ' + len + ' correct',
          stats: [['questions', len], ['correct', score], A ? ['final level', Engine.LEVELS[A.level]] : ['missed', len - score]],
          review, bestKey: c.key, bestValue: Math.round((score / len) * 100),
          onRetry: c.restart, onBack: c.exit
        });
      }

      next();
    }

    if (c.autoLen) run(String(c.autoLen)); else setup();
    return () => off();
  }
};
