window.Modes = window.Modes || {};
Modes.timeline = {
  name: 'Timeline Order', icon: 'timeline',
  desc: 'Drag events into chronological order. Three rounds.',
  available(c) {
    const years = new Set(c.items.filter((x) => x.year).map((x) => x.year));
    return years.size >= 5 ? null : 'Needs 5+ dated items';
  },
  start(root, c) {
    const { h, icon } = UI;
    const n = { easy: 5, medium: 7, hard: 9, adaptive: 7 }[c.diff];
    const ROUNDS = 3;
    let round = 0, correct = 0, slots = 0, checked = false, set = [];
    const review = [];

    const fill = h('i');
    const count = h('span', { class: 'mode-count' });
    const stage = h('div');
    root.append(h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count), stage);

    function pickSet() {
      let pool = c.items.filter((x) => x.year);
      if (c.diff === 'easy' || c.diff === 'medium') pool = Engine.byLevel(pool, Engine.levelOf(c.diff), n);
      if (c.diff === 'adaptive') pool = Engine.weighted(pool); else pool = Engine.shuffle(pool);
      const byYear = new Map();
      pool.forEach((x) => { if (!byYear.has(x.year)) byYear.set(x.year, x); });
      const uniq = Array.from(byYear.values());
      if (c.diff === 'hard') {
        const sorted = uniq.sort((a, b) => a.year - b.year);
        if (sorted.length <= n) return Engine.shuffle(sorted);
        const s = (Math.random() * (sorted.length - n + 1)) | 0;
        return Engine.shuffle(sorted.slice(s, s + n));
      }
      const gap = c.diff === 'easy' ? 2 : 1, out = [];
      for (const it of uniq) {
        if (out.every((o) => Math.abs(o.year - it.year) >= gap)) out.push(it);
        if (out.length === n) break;
      }
      return out;
    }

    // Hide dates in the hint text so it doesn't give the answer away.
    const MONTHS = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
    const maskYears = (s) => s
      .replace(new RegExp('\\b(?:early |late |mid-)?(?:' + MONTHS + '\\s+)?(?:\\d{1,2},\\s+)?1[89]\\d\\d(?:s|\\s*[–-]\\s*(?:1[89])?\\d\\d)?\\b', 'g'), '····')
      .replace(new RegExp('\\b' + MONTHS + '\\s+····', 'g'), '····');

    function flipMove(els, mutate) {
      const tops = new Map(els.map((e) => [e, e.getBoundingClientRect().top]));
      mutate();
      if (UI.reduced()) return;
      els.forEach((e) => {
        const d = tops.get(e) - e.getBoundingClientRect().top;
        if (!d) return;
        e.style.transition = 'none'; e.style.transform = 'translateY(' + d + 'px)';
        void e.offsetWidth;
        e.style.transition = ''; e.style.transform = '';
      });
    }

    function newRound() {
      checked = false;
      set = pickSet();
      fill.style.width = (round / ROUNDS) * 100 + '%';
      count.textContent = 'Round ' + (round + 1) + ' / ' + ROUNDS;
      const list = h('ol', { class: 'tl-list' });
      set.forEach((it, k) => {
        const li = h('li', { class: 'tl-item', style: { '--i': k } },
          h('span', { class: 'tl-grip' }, icon('grip', 18)),
          h('span', { class: 'tl-text' }, h('b', null, it.term), h('small', null, maskYears(it.def))),
          h('span', { class: 'tl-year' }),
          h('span', { class: 'tl-move' },
            h('button', { class: 'icon-btn sm', 'aria-label': 'Move up', onclick: () => move(li, -1) }, icon('up', 16)),
            h('button', { class: 'icon-btn sm', 'aria-label': 'Move down', onclick: () => move(li, 1) }, icon('down', 16))));
        li.dataset.id = it.id;
        list.append(li);
      });
      const checkBtn = h('button', { class: 'btn primary big', onclick: () => check(list, checkBtn) }, icon('check', 18), 'Check order');
      stage.replaceChildren(
        h('div', { class: 'tl-ends muted small' }, h('span', null, 'Earliest'), h('span', null, 'drag to reorder')),
        list,
        h('div', { class: 'tl-ends muted small' }, h('span', null, 'Latest'), h('span')),
        h('div', { class: 'actions' }, checkBtn));
      enableDrag(list);
    }

    function move(li, dir) {
      if (checked) return;
      const sib = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
      if (!sib) return;
      flipMove([li, sib], () => (dir < 0 ? sib.before(li) : sib.after(li)));
    }

    function enableDrag(list) {
      let drag = null, startY = 0;
      const GAP = 8;
      list.addEventListener('pointerdown', (e) => {
        const li = e.target.closest('.tl-item');
        if (!li || checked || e.target.closest('.tl-move')) return;
        e.preventDefault();
        drag = li; startY = e.clientY;
        li.setPointerCapture(e.pointerId);
        li.classList.add('dragging');
      });
      list.addEventListener('pointermove', (e) => {
        if (!drag) return;
        let dy = e.clientY - startY;
        const next = drag.nextElementSibling, prev = drag.previousElementSibling;
        if (next && dy > (next.offsetHeight + GAP) / 2) {
          flipMove([next], () => drag.before(next)); startY += next.offsetHeight + GAP;
        } else if (prev && dy < -(prev.offsetHeight + GAP) / 2) {
          flipMove([prev], () => drag.after(prev)); startY -= prev.offsetHeight + GAP;
        }
        dy = e.clientY - startY;
        drag.style.transform = 'translateY(' + dy + 'px) scale(1.02)';
      });
      const end = () => {
        if (!drag) return;
        drag.classList.remove('dragging');
        drag.style.transform = '';
        drag = null;
      };
      list.addEventListener('pointerup', end);
      list.addEventListener('pointercancel', end);
    }

    function check(list, btn) {
      if (checked) return;
      checked = true;
      list.classList.add('checked');
      const sorted = set.slice().sort((a, b) => a.year - b.year);
      const lis = Array.from(list.children);
      let roundRight = 0;
      lis.forEach((li, k) => {
        const it = set.find((x) => x.id === li.dataset.id);
        li.querySelector('.tl-year').textContent = it.year;
        const ok = sorted[k].id === it.id;
        li.classList.add(ok ? 'ok' : 'bad');
        if (ok) roundRight++;
        else review.push({ prompt: it.term, answer: String(it.year) });
        Store.bump(it.id, ok ? 1 : -1);
      });
      correct += roundRight; slots += set.length; round++;
      fill.style.width = (round / ROUNDS) * 100 + '%';
      const last = round >= ROUNDS;
      const actions = btn.parentElement;
      actions.replaceChildren(
        h('span', { class: 'chip accent' }, roundRight + ' / ' + set.length + ' in place'),
        roundRight < set.length ? h('button', { class: 'btn ghost', onclick: (e) => {
          e.currentTarget.remove();
          flipMove(lis, () => sorted.forEach((it) => list.append(lis.find((li) => li.dataset.id === it.id))));
        } }, 'Show correct order') : null,
        h('button', { class: 'btn primary', onclick: last ? finish : newRound }, last ? 'See results' : 'Next round', icon('arrow', 16)));
      actions.querySelector('.btn.primary').focus({ preventScroll: true });
    }

    const off = UI.keys((e) => {
      if (checked && e.key === 'Enter') { e.preventDefault(); const b = stage.querySelector('.actions .btn.primary'); if (b) b.click(); }
    });

    function finish() {
      off();
      UI.results(root, {
        pct: (correct / slots) * 100, label: correct + ' of ' + slots + ' placed',
        stats: [['rounds', ROUNDS], ['in place', correct], ['out of place', slots - correct]],
        review, bestKey: c.key, bestValue: Math.round((correct / slots) * 100),
        onRetry: c.restart, onBack: c.exit
      });
    }

    newRound();
    return off;
  }
};
