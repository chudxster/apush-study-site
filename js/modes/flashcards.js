window.Modes = window.Modes || {};
Modes.flashcards = {
  name: 'Flashcards', icon: 'cards',
  desc: 'Flip, sort into Got it / Still learning, and misses come back.',
  available: (c) => (c.items.length >= 2 ? null : 'Not enough cards here'),
  start(root, c) {
    const { h, icon } = UI;
    const lvl = Engine.levelOf(c.diff);
    const deck = c.ordered ? c.items.slice()
      : c.diff === 'adaptive' ? Engine.weighted(c.items) : Engine.shuffle(Engine.forDiff(c.items, c.diff));
    const total = deck.length;
    let queue = deck.slice(), known = 0, flipped = false, busy = false;
    let reverse = !!Store.pref('flashReverse');
    const missed = new Map();

    const fill = h('i');
    const count = h('span', { class: 'mode-count' });
    const front = h('div', { class: 'face front' });
    const back = h('div', { class: 'face back' });
    const card = h('div', { class: 'flash', tabindex: '0', role: 'button', 'aria-label': 'Flashcard, press space to flip' },
      h('div', { class: 'flash-inner' }, front, back));
    const revLabel = h('span', null);
    const revBtn = h('button', { class: 'btn ghost sm', onclick: () => {
      reverse = !reverse; Store.setPref('flashReverse', reverse); paint(); } }, icon('flip', 15), revLabel);
    const shufBtn = h('button', { class: 'btn ghost sm', onclick: () => {
      queue = Engine.shuffle(queue); paint(); UI.toast('Shuffled'); } }, icon('shuffle', 15), 'Shuffle');

    root.append(
      h('div', { class: 'mode-bar' }, h('div', { class: 'bar' }, fill), count),
      h('div', { class: 'toolbar' }, revBtn, shufBtn, h('span', { class: 'hint' }, h('kbd', null, 'Space'), ' flip  ', h('kbd', null, '←'), h('kbd', null, '→'), ' sort')),
      card,
      h('div', { class: 'actions split' },
        h('button', { class: 'btn ghost big', onclick: () => answer(false) }, icon('x', 18), 'Still learning'),
        h('button', { class: 'btn primary big', onclick: () => answer(true) }, icon('check', 18), 'Got it')));

    const kindName = { person: 'Person', event: 'Event', law: 'Law / Act', term: 'Term', concept: 'Concept' };
    function side(item, which) {
      if (which === 'term') {
        return [h('div', { class: 'face-label' }, (kindName[item.kind] || 'Term') + (Engine.isMust(item) ? ' · Must Know' : Engine.isClass(item) ? ' · Class vocab' : '')),
          h('div', { class: 'face-term' }, item.term),
          item.year ? h('div', { class: 'chip' }, String(item.year)) : null];
      }
      return [h('div', { class: 'face-label' }, 'Definition'),
        h('div', { class: 'face-def' }, item.def),
        lvl >= 2 && item.detail ? h('div', { class: 'face-detail' }, item.detail) : null,
        item.essay ? h('div', { class: 'face-essay' }, icon('pen', 13), 'Essay use: ' + item.essay) : null,
        UI.wikiLink(item),
        h('div', { class: 'face-meta' }, [item.chapter && 'Ch. ' + item.chapter, item.page && 'p. ' + item.page, item.weight && 'weight ' + item.weight + '/10'].filter(Boolean).join(' · '))];
    }

    function paint() {
      revLabel.textContent = reverse ? 'Definition first' : 'Term first';
      fill.style.width = (known / total) * 100 + '%';
      count.textContent = known + ' / ' + total;
      const it = queue[0];
      if (!it) return finish();
      flipped = false;
      card.classList.add('no-anim');
      card.classList.remove('flipped');
      front.replaceChildren(...side(it, reverse ? 'def' : 'term').filter(Boolean));
      back.replaceChildren(...side(it, reverse ? 'term' : 'def').filter(Boolean));
      void card.offsetWidth;
      card.classList.remove('no-anim');
    }

    function flip() { if (busy) return; flipped = !flipped; card.classList.toggle('flipped', flipped); }

    function answer(ok) {
      if (busy || !queue.length) return;
      busy = true;
      const it = queue.shift();
      if (ok) { known++; Store.bump(it.id, missed.has(it.id) ? 1 : 2); }
      else {
        missed.set(it.id, it); Store.bump(it.id, -1);
        queue.splice(Math.min(queue.length, 3 + ((Math.random() * 3) | 0)), 0, it);
      }
      const delay = UI.reduced() ? 0 : 280;
      card.classList.add(ok ? 'out-right' : 'out-left');
      setTimeout(() => {
        card.classList.add('no-anim');
        card.classList.remove('out-right', 'out-left');
        paint();
        if (!queue.length) return;
        card.classList.add('in');
        setTimeout(() => { card.classList.remove('in'); busy = false; }, delay);
      }, delay);
    }

    // Tap to flip, swipe to sort.
    let sx = null, sy = 0;
    card.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    card.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) answer(dx > 0);
      else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) flip();
    });

    const off = UI.keys((e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); flip(); }
      else if (e.key === 'ArrowRight') answer(true);
      else if (e.key === 'ArrowLeft') answer(false);
    });

    function finish() {
      off();
      if (c.onComplete) return c.onComplete({ correct: total - missed.size, total,
        review: Array.from(missed.values()).map((i) => ({ prompt: i.def, answer: i.term })) });
      const firstTry = total - missed.size;
      UI.results(root, {
        pct: (firstTry / total) * 100, big: firstTry + '/' + total, label: 'first try',
        stats: [['cards', total], ['needed review', missed.size]],
        review: Array.from(missed.values()).map((i) => ({ prompt: i.def, answer: i.term })),
        bestKey: c.key, bestValue: Math.round((firstTry / total) * 100),
        onRetry: c.restart, onBack: c.exit
      });
    }

    paint();
    return off;
  }
};
