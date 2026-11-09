window.Modes = window.Modes || {};
Modes.causeeffect = {
  name: 'Cause & Effect / FRQ', icon: 'branch',
  desc: 'Link causes to effects, then write APUSH-style short answers and check them against model points.',
  topics: ['themes', 'everything', 'economy', 'events', 'culture'],
  available(c) {
    if (!this.topics.includes(c.topicId)) return 'Open from Themes, Events, Economy, Culture or Everything';
    return c.ce.length >= 4 || c.frq.length ? null : 'No cause/effect data for this chapter';
  },
  start(root, c) {
    const { h, icon } = UI;
    let off = () => {};
    const hasCE = c.ce.length >= 4, hasFRQ = c.frq.length > 0;

    function home() {
      off();
      root.replaceChildren(h('div', { class: 'grid two' },
        hasCE ? h('button', { class: 'card choice', style: { '--i': 0 }, onclick: runCE },
          h('div', { class: 'card-icon' }, icon('branch', 22)),
          h('div', { class: 'card-title' }, 'Cause → Effect'),
          h('p', { class: 'muted' }, 'Pick the result of a cause, or the cause behind a result. ' + c.ce.length + ' links.')) : null,
        hasFRQ ? h('button', { class: 'card choice', style: { '--i': 1 }, onclick: runFRQ },
          h('div', { class: 'card-icon' }, icon('pen', 22)),
          h('div', { class: 'card-title' }, 'FRQ / SAQ practice'),
          h('p', { class: 'muted' }, 'Write your answer, then check it against model points. ' + c.frq.length + ' prompts.')) : null));
    }

    function runCE() {
      const n = { easy: 6, medium: 8, hard: 10, adaptive: 8 }[c.diff];
      let pool = c.diff === 'adaptive' ? Engine.weighted(c.ce) : Engine.shuffle(Engine.forDiff(c.ce, c.diff));
      const qs = pool.slice(0, Math.min(n, pool.length));
      let i = 0, score = 0, answered = false;
      const review = [];
      const fill = h('i'), count = h('span', { class: 'mode-count' }), stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

      function next() {
        if (i >= qs.length) return finish();
        answered = false;
        fill.style.width = (i / qs.length) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + qs.length;
        const q = qs[i];
        const forward = c.diff === 'easy' || Math.random() < 0.6;
        const from = forward ? 'cause' : 'effect', to = forward ? 'effect' : 'cause';
        const seen = new Set([Engine.norm(q[to])]);
        const wrong = Engine.shuffle(c.ce.filter((x) => x.id !== q.id)).filter((x) => {
          const k = Engine.norm(x[to]); if (seen.has(k)) return false; seen.add(k); return true;
        }).slice(0, 3);
        const opts = Engine.shuffle([q].concat(wrong));
        const list = h('div', { class: 'opts long' });
        opts.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => choose(o === q, e.currentTarget) },
          h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o[to]))));
        stage.replaceChildren(h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, forward ? 'What was an effect of this?' : 'What caused this?'),
          h('div', { class: 'q-prompt' }, q[from]),
          list));

        function choose(ok, btn) {
          if (answered) return;
          answered = true;
          list.querySelectorAll('.opt').forEach((b, k) => { b.disabled = true; if (opts[k] === q) b.classList.add('correct'); });
          if (!ok) { btn.classList.add('wrong'); review.push({ prompt: q[from], answer: q[to], your: btn.textContent.slice(1) }); }
          else score++;
          UI.wave(btn, ok);
          const box = h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') },
            h('div', { class: 'explain-head' }, icon(ok ? 'check' : 'x', 16), ok ? 'Correct' : 'Not quite'),
            h('p', null, h('b', null, 'Cause: '), q.cause),
            h('p', null, h('b', null, 'Effect: '), q.effect),
            q.why ? h('p', { class: 'muted' }, q.why) : null,
            h('div', { class: 'explain-foot' }, h('span'),
              h('button', { class: 'btn primary', onclick: adv }, i + 1 >= qs.length ? 'See results' : 'Next', icon('arrow', 16))));
          stage.firstChild.append(box);
          box.querySelector('.btn').focus({ preventScroll: true });
        }
      }
      function adv() { i++; next(); }
      off = UI.keys((e) => {
        if (!answered && /^[1-4]$/.test(e.key)) { const b = stage.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click(); }
        else if (answered && e.key === 'Enter') { e.preventDefault(); adv(); }
      });
      function finish() {
        off();
        UI.results(root, {
          pct: (score / qs.length) * 100, label: score + ' of ' + qs.length + ' correct',
          stats: [['links', qs.length], ['correct', score]],
          review, bestKey: c.key + '|ce', bestValue: Math.round((score / qs.length) * 100),
          onRetry: runCE, onBack: home
        });
      }
      next();
    }

    function runFRQ() {
      off();
      const prompts = Engine.shuffle(c.frq).slice(0, 4);
      let i = 0, got = 0, total = 0;
      const fill = h('i'), count = h('span', { class: 'mode-count' }), stage = h('div', { class: 'q-stage' });
      root.replaceChildren(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

      function show() {
        if (i >= prompts.length) return finish();
        fill.style.width = (i / prompts.length) * 100 + '%';
        count.textContent = (i + 1) + ' / ' + prompts.length;
        const p = prompts[i];
        const ta = h('textarea', { class: 'text-in area', rows: '6', placeholder: 'Write your answer: claim, evidence, reasoning…' });
        const reveal = h('button', { class: 'btn primary', onclick: () => doReveal() }, 'Reveal model answer');
        const card = h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, 'Short answer · Ch. ' + p.chapter),
          h('div', { class: 'q-prompt' }, p.prompt), ta,
          h('div', { class: 'actions' }, reveal));
        stage.replaceChildren(card);
        setTimeout(() => ta.focus(), 60);

        function doReveal() {
          reveal.parentElement.remove();
          const checks = p.points.map((pt, k) => {
            const cb = h('input', { type: 'checkbox' });
            return { cb, el: h('label', { class: 'point', style: { '--i': k } }, cb, h('span', null, pt)) };
          });
          card.append(h('div', { class: 'explain neutral' },
            h('div', { class: 'explain-head' }, icon('check', 16), 'Model answer: check what you covered'),
            h('div', { class: 'points' }, checks.map((x) => x.el)),
            h('div', { class: 'explain-foot' }, h('span', { class: 'muted small' }, 'Be honest, it only helps you.'),
              h('button', { class: 'btn primary', onclick: () => {
                got += checks.filter((x) => x.cb.checked).length; total += checks.length; i++; show();
              } }, i + 1 >= prompts.length ? 'See results' : 'Next prompt', icon('arrow', 16)))));
        }
      }
      function finish() {
        UI.results(root, {
          pct: total ? (got / total) * 100 : 0, label: got + ' of ' + total + ' points',
          stats: [['prompts', prompts.length], ['points hit', got]],
          bestKey: c.key + '|frq', bestValue: total ? Math.round((got / total) * 100) : 0,
          onRetry: runFRQ, onBack: home
        });
      }
      show();
    }

    if (hasCE && !hasFRQ) runCE(); else if (hasFRQ && !hasCE) runFRQ(); else home();
    return () => off();
  }
};
