window.Modes = window.Modes || {};
Modes.learn = {
  name: 'Learn / Write', icon: 'pen',
  desc: 'Read the definition and type the term. Close spellings count, and misses repeat.',
  available: (c) => (c.items.length >= 3 ? null : 'Needs at least 3 items'),
  start(root, c) {
    const { h, icon } = UI;
    const n = { easy: 8, medium: 10, hard: 12, adaptive: 10 }[c.diff];
    const src = c.diff === 'adaptive' ? Engine.weighted(c.items) : Engine.shuffle(Engine.forDiff(c.items, c.diff));
    const set = src.slice(0, Math.min(n, src.length));
    let queue = set.slice(), done = 0, state = 'ask';
    const firstTry = new Set(set.map((x) => x.id));
    const misses = [];

    const fill = h('i');
    const count = h('span', { class: 'mode-count' });
    const stage = h('div', { class: 'q-stage' });
    root.append(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

    const hintOf = (t) => t.replace(/[A-Za-z0-9]/g, (ch, i) => (i === 0 || t[i - 1] === ' ' ? ch : '_'));

    function ask() {
      state = 'ask';
      fill.style.width = (done / set.length) * 100 + '%';
      count.textContent = done + ' / ' + set.length;
      const it = queue[0];
      if (!it) return finish();
      const input = h('input', { class: 'text-in', type: 'text', placeholder: 'Type the term…', autocomplete: 'off', spellcheck: 'false' });
      const hint = h('div', { class: 'hint-line mono' });
      const showHint = c.diff !== 'hard';
      const card = h('div', { class: 'q-card card swap-in' },
        h('div', { class: 'q-label' }, { person: 'Who is this?', event: 'Name the event', law: 'Name the law or act' }[it.kind] || 'Name the term'),
        h('div', { class: 'q-prompt' }, it.def),
        c.diff === 'easy' && it.detail ? h('p', { class: 'muted' }, it.detail) : null,
        hint,
        h('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); check(input, it); } },
          input, h('button', { class: 'btn primary', type: 'submit' }, 'Check')),
        h('div', { class: 'row-actions' },
          showHint ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { hint.textContent = hintOf(it.term); } }, icon('bulb', 15), 'Hint') : null,
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => wrong(it, '') }, "Don't know")));
      stage.replaceChildren(card);
      setTimeout(() => input.focus(), 60);
    }

    function check(input, it) {
      if (state !== 'ask') return;
      const val = input.value.trim();
      if (!val) { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); return; }
      if (Engine.isMatch(val, it)) right(it, input);
      else wrong(it, val);
    }

    function right(it, input) {
      state = 'wait';
      input.classList.add('correct'); input.disabled = true;
      Store.bump(it.id, firstTry.has(it.id) ? 2 : 1);
      queue.shift(); done++;
      const note = Engine.norm(input.value) === Engine.norm(it.term) ? 'Correct' : 'Correct: ' + it.term;
      stage.firstChild.append(h('div', { class: 'explain ok' }, h('div', { class: 'explain-head' }, icon('check', 16), note)));
      setTimeout(ask, UI.reduced() ? 300 : 750);
    }

    function wrong(it, val) {
      if (state !== 'ask') return;
      state = 'wrong';
      firstTry.delete(it.id); Store.bump(it.id, -1);
      if (!misses.includes(it)) misses.push(it);
      const box = h('div', { class: 'explain bad' },
        h('div', { class: 'explain-head' }, icon('x', 16), val ? 'Not quite' : 'Here it is'),
        h('p', null, 'Answer: ', h('b', null, it.term)),
        val ? h('p', { class: 'muted' }, 'You wrote: ' + val) : null,
        h('div', { class: 'explain-foot' },
          val ? h('button', { class: 'btn ghost sm', onclick: override }, 'I was right') : h('span'),
          h('button', { class: 'btn primary', onclick: requeue }, 'Continue', icon('arrow', 16))));
      stage.firstChild.querySelectorAll('input,button').forEach((b) => (b.disabled = true));
      stage.firstChild.append(box);
      box.querySelectorAll('button').forEach((b) => (b.disabled = false));
      box.querySelector('.btn.primary').focus({ preventScroll: true });

      function override() {
        firstTry.add(it.id); misses.splice(misses.indexOf(it), 1);
        Store.bump(it.id, 2); queue.shift(); done++; ask();
      }
      function requeue() {
        queue.shift();
        queue.splice(Math.min(queue.length, 2 + ((Math.random() * 3) | 0)), 0, it);
        ask();
      }
    }

    const off = UI.keys((e) => {
      if (state === 'wrong' && e.key === 'Enter') { e.preventDefault(); stage.querySelector('.explain .btn.primary').click(); }
    });

    function finish() {
      off();
      if (c.onComplete) return c.onComplete({ correct: firstTry.size, total: set.length, review: misses.map((i) => ({ prompt: i.def, answer: i.term })) });
      UI.results(root, {
        pct: (firstTry.size / set.length) * 100, big: firstTry.size + '/' + set.length, label: 'first try',
        stats: [['terms', set.length], ['missed', misses.length]],
        review: misses.map((i) => ({ prompt: i.def, answer: i.term })),
        bestKey: c.key, bestValue: Math.round((firstTry.size / set.length) * 100),
        onRetry: c.restart, onBack: c.exit
      });
    }

    ask();
    return off;
  }
};
