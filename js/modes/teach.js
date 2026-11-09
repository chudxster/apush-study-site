// Teach Me: the main way to learn a unit. Every term climbs a ladder:
//   New → Seen (read its card) → Recognized (picked it from a list)
//       → Understood (meaning or cause/effect question) → Mastered (recalled it).
// A right answer moves a term up one rung; a miss drops it one rung and shows the
// card again. Mastered terms come back for spaced reviews on later days (1, 3, 7,
// 14, 30 days); missing a review sends a term back to Recognized.
// Sessions run in short rounds with a progress check after each. Mastering a term
// unlocks its trading card and gives bonus pack points.
window.Modes = window.Modes || {};
Modes.teach = {
  name: 'Teach Me', icon: 'bulb',
  desc: 'The best place to start. Learn each term step by step, from reading its card up to recalling it from memory. Mastered terms come back for review on later days.',
  available: (c) => (c.items.length >= 4 ? null : 'Needs at least 4 items'),
  GAPS: [0, 1, 3, 7, 14, 30],                 // days until the next review, per box
  LADDER: ['New', 'Seen', 'Recognized', 'Understood', 'Mastered'],
  MASTER_BONUS: 3,                            // pack points for mastering a term
  // A term's stage (0-4). Older saves only had a review box: those were mastered.
  stageOf(rec) { return !rec ? 0 : rec.stage != null ? rec.stage : 4; },
  stage(it) { return this.stageOf((Store.get('learned') || {})[it.id]); },

  // Shared with Tree mode. Counts of terms on each rung, as a bar with a key.
  ladderBar(items) {
    const { h } = UI, L = this.LADDER, n = [0, 0, 0, 0, 0];
    items.forEach((x) => n[this.stage(x)]++);
    return h('div', { class: 'ladder-sum' },
      h('div', { class: 'ladder-bar' }, n.map((k, s) => k ? h('i', { class: 'lb-' + s, style: { flex: k }, title: L[s] + ': ' + k }) : null)),
      h('div', { class: 'ladder-key' }, n.map((k, s) => h('span', { class: 'lk lk-' + s }, h('i'), L[s] + ' ', h('b', null, k)))));
  },

  // A full study card: definition, why it matters, and how it connects.
  // opts.noLinks hides causes/effects (Tree mode asks you to find those).
  card(it, action, opts) {
    const { h, icon } = UI;
    const label = { person: 'Person', event: 'Event', law: 'Law or act', concept: 'Concept' }[it.kind] || 'Term';
    const rar = window.Cards ? Cards.rarityOf(it) : null;
    const link = (title, list) => (list || []).length && !(opts && opts.noLinks) ? h('div', { class: 'teach-links' },
      h('span', { class: 'teach-links-k' }, title),
      list.slice(0, 6).map((y) => h('span', { class: 'chip teach-link' + (this.stage(y) === 4 ? ' known' : ''), title: y.def }, y.term))) : null;
    const meta = [it.year && String(it.year), it.chapter && 'Ch. ' + it.chapter, it.page && 'p. ' + it.page].filter(Boolean).join(' · ');
    return h('div', { class: 'q-card card swap-in teach-card' },
      h('div', { class: 'q-label teach-label' }, label + (Engine.isMust(it) ? ' · Must Know' : ''),
        rar ? h('span', { class: 'chip wb-rar ' + rar }, rar) : null),
      h('div', { class: 'teach-term' }, it.term),
      h('div', { class: 'q-prompt' }, it.def),
      it.detail ? h('p', { class: 'teach-detail' }, icon('bulb', 15), h('span', null, it.detail)) : null,
      it.essay ? h('p', { class: 'teach-essay' }, h('b', null, 'Use it in an essay: '), it.essay) : null,
      link('Caused by', it.causedBy), link('Led to', it.ledTo), link('Related', it.same),
      (it.aliases || []).length ? h('p', { class: 'muted small' }, 'Also called: ' + it.aliases.map((a) => (typeof a === 'string' ? a : a.term)).join(', ')) : null,
      h('div', { class: 'explain-foot' }, h('span', { class: 'muted small' }, meta), action));
  },

  // Move a term one rung up (right) or down (wrong) outside a Classic session.
  // Reaching Mastered schedules its first review and unlocks its card.
  climb(it, ok) {
    const all = Object.assign({}, Store.get('learned') || {});
    const rec = all[it.id] = Object.assign({}, all[it.id]);
    const before = this.stageOf(rec);
    Store.bump(it.id, ok ? 1 : -1);
    if (ok && before < 4) {
      rec.stage = before + 1;
      if (rec.stage === 4) {
        rec.box = Math.max(1, rec.box || 0); rec.due = Date.now() + this.GAPS[rec.box] * 864e5;
        if (window.Cards) Cards.reward(it.id, this.MASTER_BONUS);
      }
    } else if (!ok) {
      rec.stage = Math.max(1, before - 1);
      if (before === 4) rec.box = 1;
    }
    Store.set('learned', all);
    return { before, after: this.stageOf(rec) };
  },

  start(root, c) {
    const { h, icon } = UI;
    const self = Modes.teach, L = self.LADDER;
    const DAY = 864e5, now = Date.now();
    const BATCH = 4, ROUND = 7;
    const pool = c.all && c.all.length >= 8 ? c.all : c.items;
    const learned = Object.assign({}, Store.get('learned') || {});
    const save = () => Store.set('learned', learned);
    const stage = (it) => self.stageOf(learned[it.id]);
    const rank = { must: 0, good: 1, niche: 2 };
    const easy = c.diff === 'easy', hard = c.diff === 'hard';

    const due = c.items.filter((x) => stage(x) === 4 && learned[x.id].due <= now)
      .sort((a, b) => learned[a.id].due - learned[b.id].due).slice(0, 10);
    const going = c.items.filter((x) => { const s = stage(x); return s > 0 && s < 4; })
      .sort((a, b) => stage(b) - stage(a)).slice(0, 8);
    const fresh = c.items.filter((x) => !stage(x))
      .sort((a, b) => rank[Engine.tierOf(a)] - rank[Engine.tierOf(b)] || (b.weight || 0) - (a.weight || 0) || (a.page || 0) - (b.page || 0));

    let off = () => {};
    let newN = +(Store.pref('teachNew') || 8);

    // ---------- intro ----------
    const ladderBar = (items) => self.ladderBar(items);

    // Style: Classic (the ladder) or Tree (learn a linked set, wire up causes, then quiz).
    const treeWhy = Modes.tree ? Modes.tree.available(c) : 'Unavailable';
    let style = !treeWhy && Store.pref('teachStyle') === 'tree' ? 'tree' : 'classic';
    const styleSeg = () => h('div', { class: 'teach-opt' },
      UI.seg([{ value: 'classic', label: 'Classic' }, { value: 'tree', label: 'Tree', title: treeWhy || 'Learn linked terms, connect them, then get quizzed' }], style,
        (v) => { if (v === 'tree' && treeWhy) { UI.toast(treeWhy); return; } style = v; Store.setPref('teachStyle', v); off(); intro(); }));

    function intro() {
      if (style === 'tree') return treeIntro();
      const plan = h('h2');
      const sub = h('p', { class: 'muted' });
      const startBtn = h('button', { class: 'btn primary big', onclick: () => go() });
      const nothing = () => !due.length && !going.length && !fresh.length;
      const sync = () => {
        const nNew = Math.min(newN, fresh.length), parts = [];
        if (due.length) parts.push(due.length + ' to review');
        if (going.length) parts.push(going.length + ' in progress');
        if (nNew) parts.push(nNew + ' new');
        plan.textContent = nothing() ? 'All caught up' : 'Today: ' + parts.join(' · ');
        sub.textContent = nothing()
          ? 'Every term here is mastered and none are due for review yet. Come back later, or pick a wider Relevancy.'
          : 'Each term climbs from reading its card to recalling it from memory. A miss drops it a rung, and it comes back until it sticks.';
        startBtn.replaceChildren(due.length && !nNew && !going.length ? 'Start review' : 'Start learning', icon('arrow', 18));
      };
      const go = () => { if (!nothing()) run(Math.min(newN, fresh.length)); };
      const newSeg = fresh.length ? h('div', { class: 'teach-opt' },
        h('span', { class: 'muted small' }, 'New terms this session'),
        UI.seg([4, 8, 12, 16].map((v) => ({ value: v, label: String(v) })), newN, (v) => { newN = v; Store.setPref('teachNew', v); sync(); })) : null;
      sync();
      root.replaceChildren(h('div', { class: 'setup card teach-intro' },
        h('div', { class: 'setup-icon' }, icon('bulb', 26)),
        styleSeg(),
        plan, sub,
        ladderBar(c.items),
        h('ol', { class: 'ladder-steps' },
          h('li', null, h('b', null, 'Read'), ' the term’s card'),
          h('li', null, h('b', null, 'Recognize'), ' it from its definition'),
          h('li', null, h('b', null, 'Understand'), ' what it means, caused, or led to'),
          h('li', null, h('b', null, easy ? 'Recall' : 'Write'), easy ? ' it against close look-alikes' : ' it from memory')),
        newSeg,
        nothing() ? h('button', { class: 'btn ghost', onclick: c.exit }, 'Back to methods') : startBtn));
      off = UI.keys((e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); go(); } });
    }

    function treeIntro() {
      const T = Modes.tree, set = T.pickSet(c);
      const go = () => { off(); off = T.start(root, c, set) || (() => {}); };
      root.replaceChildren(h('div', { class: 'setup card teach-intro' },
        h('div', { class: 'setup-icon' }, icon('branch', 26)),
        styleSeg(),
        h('h2', null, 'Tree: ' + set.items.length + ' linked terms'),
        h('p', { class: 'muted' }, 'Learn a set of terms that caused and led to each other, wire up how they connect, then get quizzed on them.'),
        h('div', { class: 'tree-preview' }, set.items.map((x) => h('span', { class: 'chip' + (Modes.teach.stage(x) === 4 ? ' accent' : '') }, x.term))),
        h('ol', { class: 'ladder-steps' },
          h('li', null, h('b', null, 'Learn'), ' each term’s card'),
          h('li', null, h('b', null, 'Connect'), ' causes to effects by dragging between dots (' + set.edges.length + ' links to find)'),
          h('li', null, h('b', null, 'Quiz'), ' on every term, with cause & effect questions')),
        h('p', { class: 'muted small' }, 'Every right answer climbs the term up the same ladder as Classic.'),
        h('button', { class: 'btn primary big', onclick: go }, 'Start Tree', icon('arrow', 18))));
      off = UI.keys((e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); go(); } });
    }

    // ---------- session ----------
    function run(nNew) {
      off();
      const pendingNew = fresh.slice(0, nNew);
      const review = new Set(due.map((x) => x.id));       // reviews: one right answer finishes them
      const play = due.concat(going);                       // terms being worked on now
      const all = play.concat(pendingNew);
      const startStage = new Map(all.map((x) => [x.id, stage(x)]));
      const recent = [];
      let asked = 0, right = 0, inRound = 0, roundNo = 1, roundLog = new Map();
      const mastered = [], missed = new Map(), finished = new Set();

      const fill = h('i'), count = h('span', { class: 'mode-count' });
      const strip = h('div', { class: 'step-strip' });
      const stageEl = h('div', { class: 'q-stage' });
      root.replaceChildren(strip, h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stageEl);

      // Progress: every rung climbed, out of every rung left to climb today.
      const goal = all.reduce((n, x) => n + (review.has(x.id) ? 1 : 4 - stage(x)), 0) || 1;
      let gained = 0;
      const progress = () => {
        fill.style.width = Math.min(100, (gained / goal) * 100) + '%';
        count.textContent = finished.size + ' done · ' + (all.length - finished.size) + ' to go';
      };
      const header = (kind, title, it) => strip.replaceChildren(
        h('span', { class: 'step-num' }, kind),
        h('span', { class: 'step-title' }, title),
        h('span', { class: 'step-right' }, it ? pips(it) : null));
      function pips(it) {
        const s = stage(it);
        return h('span', { class: 'pips', title: L[s] }, [1, 2, 3, 4].map((k) => h('i', { class: k <= s ? 'on' : '' })), h('span', { class: 'muted small' }, L[s]));
      }

      function next() {
        off();
        if (inRound >= ROUND && (play.length || pendingNew.length)) return roundCheck();
        // Reviews come first. After that, bring in new terms when few are left in play.
        if (!review.size && play.length < 3 && pendingNew.length) return teach(pendingNew.splice(0, BATCH));
        if (!play.length) return finish();
        // Lowest rung first, with some shuffle, and not the same term twice in a row.
        const pickFrom = review.size ? play.filter((x) => review.has(x.id)) : play;
        let cands = pickFrom.filter((x) => !recent.includes(x.id));
        if (!cands.length) cands = pickFrom;
        const it = cands.map((x) => ({ x, k: stage(x) + Math.random() * 1.6 })).sort((a, b) => a.k - b.k)[0].x;
        ask(it);
      }

      // ----- teach cards -----
      function teach(batch) {
        let k = 0;
        function show() {
          if (k >= batch.length) { UI.toast('Now let’s check those'); return next(); }
          const it = batch[k];
          header('Learn', 'New term ' + (k + 1) + ' of ' + batch.length, null);
          progress();
          const go = () => {
            learned[it.id] = Object.assign({}, learned[it.id], { stage: 1 });
            save(); gained++; play.push(it); k++; show();
          };
          stageEl.replaceChildren(card(it, h('button', { class: 'btn primary', onclick: go }, k + 1 < batch.length ? 'Got it' : 'Quiz me', icon('arrow', 16))));
          stageEl.querySelector('.explain-foot .btn.primary').focus({ preventScroll: true });
          off(); off = UI.keys((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        }
        show();
      }

      const card = (it, action) => self.card(it, action);

      // ----- questions: harder the higher the term is on the ladder -----
      function question(it) {
        const s = review.has(it.id) ? 3 : stage(it);
        if (s <= 1) {
          const ds = Engine.distractors(it, pool, 3, 1, 'term');
          return { type: 'mc', label: 'Recognize it', prompt: it.def,
            options: Engine.shuffle([it].concat(ds)).map((x) => ({ text: x.term, correct: x === it })) };
        }
        if (s === 2) {
          const linked = (it.causedBy || []).length || (it.ledTo || []).length || it.year;
          if (linked && Math.random() < 0.5) {
            const q = Engine.question(it, 3, pool, -1, { only: ['causedBy', 'ledTo', 'first'] });
            if (q.kind || q.label === 'Which came first?') return Object.assign(q, { label: 'Understand it · ' + q.label });
          }
          const q = Engine.question(it, 2, pool, -1, { only: ['term2def'] });
          return Object.assign(q, { label: 'Understand it · ' + q.label });
        }
        if (easy) {
          const ds = Engine.distractors(it, pool, 3, 3, 'term');
          return { type: 'mc', label: 'Recall it · close look-alikes', prompt: it.def,
            options: Engine.shuffle([it].concat(ds)).map((x) => ({ text: x.term, correct: x === it })) };
        }
        return { type: 'typed', label: review.has(it.id) ? 'Review · write it from memory' : 'Write it from memory', prompt: it.def };
      }

      function ask(it) {
        const q = question(it);
        const isReview = review.has(it.id);
        header(isReview ? 'Review' : 'Round ' + roundNo, isReview ? 'Mastered before: still remember it?' : (play.length + pendingNew.length) + ' terms left today', it);
        progress();
        let state = 'ask';
        const body = h('div', { class: 'q-card card swap-in' },
          h('div', { class: 'q-label' }, q.label),
          h('div', { class: 'q-prompt' + (q.prompt.length > 120 ? ' long' : '') }, q.prompt));
        stageEl.replaceChildren(body);

        if (q.type === 'typed') {
          const input = h('input', { class: 'text-in', type: 'text', placeholder: 'Type the term…', autocomplete: 'off', spellcheck: 'false' });
          const hint = h('div', { class: 'hint-line mono' });
          body.append(hint,
            h('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); check(); } }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Check')),
            h('div', { class: 'row-actions' },
              hard ? null : h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { hint.textContent = it.term.replace(/[A-Za-z0-9]/g, (ch, i) => (i === 0 || it.term[i - 1] === ' ' ? ch : '_')); } }, icon('bulb', 15), 'Hint'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => answer(false, '') }, "Don't know")));
          setTimeout(() => input.focus(), 60);
          function check() {
            const val = input.value.trim();
            if (!val) { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); return; }
            const ok = Engine.isMatch(val, it);
            input.classList.add(ok ? 'correct' : 'wrong');
            answer(ok, val);
          }
        } else {
          const list = h('div', { class: 'opts' + (q.options.some((o) => o.text.length > 60) ? ' long' : '') });
          q.options.forEach((o, k) => list.append(h('button', { class: 'opt', style: { '--i': k }, onclick: (e) => {
            if (state !== 'ask') return;
            list.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (q.options[j].correct) b.classList.add('correct'); });
            if (!o.correct) e.currentTarget.classList.add('wrong');
            answer(o.correct);
          } }, h('span', { class: 'opt-key' }, String(k + 1)), h('span', { class: 'opt-text' }, o.text))));
          body.append(list);
        }
        off(); off = UI.keys((e) => {
          if (state === 'ask' && q.type === 'mc' && /^[1-4]$/.test(e.key)) { const b = body.querySelectorAll('.opt')[+e.key - 1]; if (b) b.click(); }
          else if (state === 'shown' && e.key === 'Enter') { e.preventDefault(); const b = body.querySelector('.explain .btn.primary'); if (b) b.click(); }
        });

        function answer(ok, typedVal) {
          if (state !== 'ask') return;
          state = 'shown';
          body.querySelectorAll('form input, form button, .row-actions button').forEach((b) => (b.disabled = true));
          const before = stage(it);
          apply(it, ok);
          const after = stage(it);
          const move = after > before ? h('span', { class: 'ladder-move up' }, icon('up', 14), L[after])
            : after < before ? h('span', { class: 'ladder-move down' }, icon('down', 14), 'Back to ' + L[after]) : null;
          const box = h('div', { class: 'explain ' + (ok ? 'ok' : 'bad') },
            h('div', { class: 'explain-head' }, icon(ok ? 'check' : 'x', 16), ok ? 'Correct' : typedVal ? 'Not quite' : 'Here it is', move),
            q.type === 'typed' && !ok ? h('p', null, 'Answer: ', h('b', null, it.term)) : null,
            typedVal && !ok ? h('p', { class: 'muted' }, 'You wrote: ' + typedVal) : null,
            q.explain ? h('p', null, q.explain) : null,
            ok ? h('p', null, h('b', null, it.term), ' — ', it.def) : null,
            h('div', { class: 'explain-foot' },
              typedVal && !ok ? h('button', { class: 'btn ghost sm', onclick: override }, 'I was right') : h('span'),
              h('button', { class: 'btn primary', onclick: next }, 'Next', icon('arrow', 16))));
          body.append(box);
          // A miss shows the whole card again so it sticks.
          if (!ok) body.after(card(it, null));
          box.querySelector('.btn.primary').focus({ preventScroll: true });
          box.scrollIntoView({ block: 'nearest', behavior: UI.reduced() ? 'auto' : 'smooth' });

          function override() {   // typed answer was a fair spelling: undo the miss, count it right
            learned[it.id] = undo.rec; gained = undo.gained;
            if (undo.review) review.add(it.id);
            if (!undo.missed) missed.delete(it.id);
            asked--; inRound--;
            Store.bump(it.id, 1);   // cancels the -1 from the miss
            apply(it, true);
            next();
          }
        }
        const undo = { rec: Object.assign({}, learned[it.id]), gained, review: review.has(it.id), missed: missed.has(it.id) };
      }

      // Move a term on the ladder and record the answer.
      function apply(it, ok) {
        const rec = learned[it.id] = Object.assign({}, learned[it.id]);
        const isReview = review.has(it.id);
        asked++; inRound++; if (ok) right++;
        Store.bump(it.id, ok ? 1 : -1);
        recent.unshift(it.id); recent.length = Math.min(recent.length, play.length > 3 ? 2 : 1);
        roundLog.set(it.id, it);
        if (isReview) {
          review.delete(it.id);
          if (ok) {
            rec.box = Math.min(5, (rec.box || 1) + 1);
            rec.due = now + self.GAPS[rec.box] * DAY;
            rec.stage = 4; gained++;
            remove(it); finished.add(it.id);
          } else {
            rec.stage = 2; rec.box = 1;
            missed.set(it.id, it);
          }
        } else if (ok) {
          rec.stage = Math.min(4, self.stageOf(rec) + 1); gained++;
          if (rec.stage === 4) {
            rec.box = Math.max(1, rec.box || 0); rec.due = now + self.GAPS[rec.box] * DAY;
            mastered.push(it); remove(it); finished.add(it.id);
            if (window.Cards) Cards.reward(it.id, self.MASTER_BONUS);
          }
        } else {
          if (self.stageOf(rec) > 1) { rec.stage = self.stageOf(rec) - 1; gained--; }
          missed.set(it.id, it);
        }
        save();
        progress();
      }
      function remove(it) { const i = play.indexOf(it); if (i >= 0) play.splice(i, 1); }

      // ----- between rounds: what moved, then keep going or stop -----
      function roundCheck() {
        const moved = Array.from(roundLog.values());
        header('Round ' + roundNo + ' done', mastered.length + ' newly mastered · ' + (finished.size - mastered.length) + ' reviewed', null);
        stageEl.replaceChildren(h('div', { class: 'card round-check swap-in' },
          h('h3', null, 'Round ' + roundNo + ' check-in'),
          h('p', { class: 'muted small' }, 'Here is where each term you just practiced stands.'),
          h('div', { class: 'round-list' }, moved.map((x) => h('div', { class: 'round-row' },
            h('span', { class: 'round-term' }, x.term), pips(x)))),
          h('div', { class: 'actions' },
            h('button', { class: 'btn ghost', onclick: finish }, 'End session'),
            h('button', { class: 'btn primary', onclick: () => { inRound = 0; roundNo++; roundLog = new Map(); next(); } }, 'Keep going', icon('arrow', 16)))));
        stageEl.querySelector('.btn.primary').focus({ preventScroll: true });
        off = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); stageEl.querySelector('.btn.primary').click(); } });
      }

      function finish() {
        off();
        const climbed = all.filter((x) => stage(x) > startStage.get(x.id)).length;
        const nextDue = c.items.map((x) => learned[x.id]).filter((r) => r && self.stageOf(r) === 4 && r.due > Date.now()).map((r) => r.due).sort((a, b) => a - b)[0];
        const when = nextDue ? Math.max(1, Math.round((nextDue - Date.now()) / DAY)) : null;
        UI.results(root, {
          pct: asked ? (right / asked) * 100 : 0, label: 'correct',
          stats: [['mastered', mastered.length], ['moved up', climbed], ['reviewed', due.length], ['missed', missed.size]],
          review: Array.from(missed.values()).map((i) => ({ prompt: i.def, answer: i.term })),
          bestKey: c.key, bestValue: asked ? Math.round((right / asked) * 100) : 0,
          extra: h('div', { class: 'teach-after' },
            h('div', { class: 'section-label' }, 'Your ladder here'),
            ladderBar(c.items),
            when ? h('p', { class: 'muted small' }, 'Next review due in ' + when + ' day' + (when > 1 ? 's' : '') + '. Come back to Teach Me then and it will review those first.') : null),
          onRetry: c.restart, onBack: c.exit
        });
      }

      next();
    }

    intro();
    return () => off();
  }
};
