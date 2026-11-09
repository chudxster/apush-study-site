// Teach Me: shows a few new terms, checks them right away, brings earlier ones back
// later in the session, and schedules spaced reviews for later visits.
window.Modes = window.Modes || {};
Modes.teach = {
  name: 'Teach Me', icon: 'bulb',
  desc: 'Learn a few new terms at a time, get quizzed on them right away, then again later. Learned terms come back for review on later visits.',
  available: (c) => (c.items.length >= 4 ? null : 'Needs at least 4 items'),
  // Days until the next review for each box (box 1 = just learned).
  GAPS: [0, 1, 3, 7, 14, 30],
  start(root, c) {
    const { h, icon } = UI;
    const DAY = 864e5, now = Date.now();
    const BATCH = 4;
    const newCap = { easy: 8, medium: 12, hard: 12, adaptive: 12 }[c.diff] || 12;
    const level = { easy: 1, medium: 2, hard: 3, adaptive: 2 }[c.diff] || 2;
    const pool = c.all && c.all.length >= 8 ? c.all : c.items;
    const learned = Object.assign({}, Store.get('learned') || {});
    const save = () => Store.set('learned', learned);
    const rank = { must: 0, good: 1, niche: 2 };

    const due = c.items.filter((x) => learned[x.id] && learned[x.id].due <= now)
      .sort((a, b) => learned[a.id].due - learned[b.id].due).slice(0, 10);
    const fresh = c.items.filter((x) => !learned[x.id])
      .sort((a, b) => rank[Engine.tierOf(a)] - rank[Engine.tierOf(b)] || (b.weight || 0) - (a.weight || 0) || (a.page || 0) - (b.page || 0));
    const known = c.items.filter((x) => learned[x.id]).length;

    let off = () => {};
    const fill = h('i');
    const count = h('span', { class: 'mode-count' });
    const strip = h('div', { class: 'step-strip' });
    const stage = h('div', { class: 'q-stage' });

    // ---------- intro ----------
    function intro() {
      const nNew = Math.min(newCap, fresh.length);
      const parts = [];
      if (due.length) parts.push(due.length + ' term' + (due.length > 1 ? 's' : '') + ' due for review');
      if (nNew) parts.push(nNew + ' new term' + (nNew > 1 ? 's' : '') + ' to learn');
      const nothing = !due.length && !nNew;
      const start = () => (nothing ? null : run(nNew));
      root.replaceChildren(h('div', { class: 'setup card' },
        h('div', { class: 'setup-icon' }, icon('bulb', 26)),
        h('h2', null, nothing ? 'All caught up' : 'Today: ' + parts.join(' + ')),
        h('p', { class: 'muted' }, nothing
          ? 'You have learned every term here and none are due yet. Come back later, or pick a wider Relevancy.'
          : 'New terms come ' + BATCH + ' at a time: read each one, then answer a quick check. Earlier terms pop back up later in the session.'),
        h('p', { class: 'muted small' }, known + ' of ' + c.items.length + ' learned here' + (fresh.length ? ' · ' + fresh.length + ' not started' : '')),
        nothing ? h('button', { class: 'btn ghost', onclick: c.exit }, 'Back to methods')
          : h('button', { class: 'btn primary big', onclick: start }, due.length && !nNew ? 'Start review' : 'Start learning', icon('arrow', 18))));
      off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } });
    }

    // ---------- session ----------
    function run(nNew) {
      off();
      const newItems = fresh.slice(0, nNew);
      const batches = [];
      for (let k = 0; k < newItems.length; k += BATCH) batches.push(newItems.slice(k, k + BATCH));
      // Steps: review due terms, then teach → check per batch, then a final review of all new terms.
      const steps = [];
      if (due.length) steps.push({ kind: 'quiz', title: 'Review: terms you learned before', items: due, review: true });
      batches.forEach((b, k) => {
        steps.push({ kind: 'teach', title: 'Learn set ' + (k + 1) + ' of ' + batches.length, items: b });
        // Mix in up to 2 terms from earlier sets so they come back "later".
        const earlier = Engine.shuffle(batches.slice(0, k).flat()).slice(0, 2);
        steps.push({ kind: 'quiz', title: 'Check set ' + (k + 1), items: b.concat(earlier) });
      });
      if (batches.length > 1) steps.push({ kind: 'quiz', title: 'Final round: everything you learned today', items: newItems, final: true });

      const total = steps.reduce((n, s) => n + s.items.length, 0);
      let doneN = 0, si = 0;
      let asked = 0, right = 0;     // first attempts across every quiz step
      const misses = new Map();
      root.replaceChildren(strip, h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

      const progress = () => {
        fill.style.width = (doneN / total) * 100 + '%';
        count.textContent = Math.min(doneN, total) + ' / ' + total;
      };
      const header = (s, right) => strip.replaceChildren(
        h('span', { class: 'step-num' }, (s.kind === 'teach' ? 'Learn' : 'Quiz')),
        h('span', { class: 'step-title' }, s.title),
        h('span', { class: 'step-right' }, h('span', { class: 'muted small' }, right || '')));

      function nextStep() {
        off();
        if (si >= steps.length) return finish();
        const s = steps[si++];
        if (si > 1) UI.toast(s.title);
        (s.kind === 'teach' ? teach : quiz)(s);
      }

      // Teach: one card per term, read then continue.
      function teach(s) {
        let k = 0;
        function show() {
          if (k >= s.items.length) return nextStep();
          const it = s.items[k];
          header(s, 'Card ' + (k + 1) + ' of ' + s.items.length);
          progress();
          const label = { person: 'Person', event: 'Event', law: 'Law or act', concept: 'Concept' }[it.kind] || 'Term';
          const go = () => { k++; doneN++; show(); };
          stage.replaceChildren(h('div', { class: 'q-card card swap-in teach-card' },
            h('div', { class: 'q-label' }, label + (Engine.isMust(it) ? ' · Must Know' : '')),
            h('div', { class: 'teach-term' }, it.term),
            h('div', { class: 'q-prompt' }, it.def),
            it.detail ? h('p', { class: 'teach-detail' }, icon('bulb', 15), h('span', null, it.detail)) : null,
            it.essay ? h('p', { class: 'muted small' }, h('b', null, 'Essay use: '), it.essay) : null,
            (it.aliases || []).length ? h('p', { class: 'muted small' }, 'Also called: ' + it.aliases.join(', ')) : null,
            h('div', { class: 'explain-foot' },
              h('span', { class: 'muted small' }, [it.year && String(it.year), it.chapter && 'Ch. ' + it.chapter, it.page && 'p. ' + it.page].filter(Boolean).join(' · ')),
              h('button', { class: 'btn primary', onclick: go }, k + 1 < s.items.length ? 'Got it' : 'Quiz me', icon('arrow', 16)))));
          stage.querySelector('.btn.primary').focus({ preventScroll: true });
          off(); off = UI.keys((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        }
        show();
      }

      // Quiz: multiple choice; a miss shows the card again and the term comes back at the end.
      function quiz(s) {
        const queue = Engine.shuffle(s.items.slice());
        const tried = new Set();
        let state = 'ask';
        function ask() {
          const it = queue[0];
          if (!it) return nextStep();
          state = 'ask';
          header(s, queue.length + ' left');
          progress();
          // Same-session checks ask definition → term; the final round and reviews can flip it.
          const lv = s.final || s.review ? Math.max(level, 2) : Math.min(level, 2);
          let q = Engine.question(it, lv, pool, -1, { noChrono: true, only: ['def2term', 'term2def'] });
          if (q.type !== 'mc') q = {};
          const opts = q.options || Engine.shuffle([it].concat(Engine.distractors(it, pool, 3, lv, 'term'))).map((x) => ({ text: x.term, correct: x === it }));
          const list = h('div', { class: 'opts' + (opts.some((o) => o.text.length > 60) ? ' long' : '') });
          opts.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => choose(k, e.currentTarget) },
            h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text))));
          const prompt = q.options ? q.prompt : it.def;
          stage.replaceChildren(h('div', { class: 'q-card card swap-in' },
            h('div', { class: 'q-label' }, q.options ? q.label : 'Which term matches?'),
            h('div', { class: 'q-prompt' + (prompt.length > 120 ? ' long' : '') }, prompt), list));

          function choose(k, btn) {
            if (state !== 'ask') return;
            state = 'shown';
            const ok = opts[k].correct;
            list.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (opts[j].correct) b.classList.add('correct'); });
            if (!ok) btn.classList.add('wrong');
            const first = !tried.has(it.id);
            tried.add(it.id);
            if (first) { asked++; if (ok) right++; }
            if (!ok) misses.set(it.id, it);
            Store.bump(it.id, ok ? 1 : -1);
            schedule(it, ok, first, s);
            const box = h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') },
              h('div', { class: 'explain-head' }, icon(ok ? 'check' : 'x', 16), ok ? 'Correct' : 'Not quite: read it again, it will come back'),
              h('p', null, h('b', null, it.term), ' — ', it.def),
              it.detail ? h('p', { class: 'muted' }, it.detail) : null,
              h('div', { class: 'explain-foot' }, h('span'),
                h('button', { class: 'btn primary', onclick: advance }, 'Next', icon('arrow', 16))));
            stage.firstChild.append(box);
            box.querySelector('.btn.primary').focus({ preventScroll: true });
            box.scrollIntoView({ block: 'nearest', behavior: UI.reduced() ? 'auto' : 'smooth' });
            function advance() {
              queue.shift();
              if (ok) doneN++;
              else queue.push(it);   // try again at the end of this round
              ask();
            }
          }
          off(); off = UI.keys((e) => {
            if (state === 'ask' && /^[1-4]$/.test(e.key)) { const b = list.children[+e.key - 1]; if (b) b.click(); }
            else if (state === 'shown' && e.key === 'Enter') { e.preventDefault(); const b = stage.querySelector('.explain .btn.primary'); if (b) b.click(); }
          });
        }
        ask();
      }

      // Spaced schedule: a new term starts in box 1; a right review moves it up a box,
      // a miss sends it back to box 1.
      function schedule(it, ok, first, s) {
        const cur = learned[it.id];
        let box;
        if (s.review) box = ok && first ? Math.min(5, (cur ? cur.box : 0) + 1) : 1;
        else box = cur && cur.box > 1 ? cur.box : 1;
        if (!first && !s.review) return;
        learned[it.id] = { box, due: now + Modes.teach.GAPS[box] * DAY };
        save();
      }

      function finish() {
        off();
        progress();
        const review = Array.from(misses.values()).map((i) => ({ prompt: i.def, answer: i.term }));
        const nextDue = c.items.map((x) => learned[x.id]).filter(Boolean).map((x) => x.due).filter((d) => d > Date.now()).sort((a, b) => a - b)[0];
        const when = nextDue ? Math.max(1, Math.round((nextDue - Date.now()) / DAY)) : null;
        UI.results(root, {
          pct: asked ? (right / asked) * 100 : 0, label: 'first try',
          stats: [['new learned', newItems.length], ['reviewed', due.length], ['missed', misses.size]],
          review, bestKey: c.key, bestValue: asked ? Math.round((right / asked) * 100) : 0,
          extra: when ? h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'Next review due in ' + when + ' day' + (when > 1 ? 's' : '') + '. Come back to Teach Me then and it will quiz you first.') : null,
          onRetry: c.restart, onBack: c.exit
        });
      }

      nextStep();
    }

    intro();
    return () => off();
  }
};
