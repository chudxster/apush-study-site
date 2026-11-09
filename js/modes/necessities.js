window.Modes = window.Modes || {};
Modes.necessities = {
  name: 'Necessities', icon: 'spark',
  desc: '7.5 minutes of Easy flashcards (class vocab first), then a test on your class key terms. Ignores the difficulty setting.',
  FLASH_MS: 7.5 * 60 * 1000,
  TEST_LEN: 20,
  // Must Know = class calendar key terms. Topics with too few fall back to Good to Know.
  sets(c) {
    const key = c.items.filter(Engine.isMust);
    const rest = key.length >= 4 ? [] : Engine.byRelevancy(c.items, 'good').filter((x) => !Engine.isMust(x));
    return { key, rest, must: key.concat(rest) };
  },
  available(c) { return this.sets(c).must.length >= 4 ? null : 'Needs at least 4 must-know items'; },
  start(root, c) {
    const { h, icon } = UI;
    const self = this;
    const { key, rest, must } = self.sets(c);
    const testPool = key.length >= 4 ? key : must;
    const testLen = Math.min(self.TEST_LEN, testPool.length);
    const mins = self.FLASH_MS / 60000;
    let sub = null, timer = null, phase = 'intro';
    const stopSub = () => { if (sub) { try { sub(); } catch (e) {} sub = null; } };

    function strip(step, title, right) {
      return h('div', { class: 'step-strip' },
        h('span', { class: 'step-num' }, step),
        h('span', { class: 'step-title' }, title),
        h('span', { class: 'step-right' }, right));
    }

    function intro() {
      root.replaceChildren(h('div', { class: 'setup card nec-intro' },
        h('div', { class: 'setup-icon' }, icon('spark', 26)),
        h('h2', null, 'The Necessities'),
        h('p', { class: 'muted' }, key.length + ' Must Know terms from your class calendar' + (rest.length ? ' + ' + rest.length + ' Good to Know items' : '') + '. No small details.'),
        h('ol', { class: 'nec-steps' },
          h('li', null, h('b', null, mins + ' minutes'), ' of Easy flashcards, class key terms first'),
          h('li', null, h('b', null, testLen + '-question test'), key.length >= 4 ? ' on the class key terms' : ' on the must-know items')),
        h('button', { class: 'btn primary big', onclick: flashPhase }, 'Start', icon('arrow', 18))));
      sub = UI.keys((e) => { if (e.key === 'Enter') { e.preventDefault(); flashPhase(); } });
    }

    function flashPhase() {
      stopSub();
      phase = 'flash';
      let remaining = self.FLASH_MS, last = performance.now();
      const clock = h('span', { class: 'chip accent mono' }, icon('clock', 14), UI.fmtTime(remaining));
      const skip = h('button', { class: 'btn ghost sm', onclick: () => testPhase('skip') }, 'Skip to test', icon('arrow', 14));
      const holder = h('div', { class: 'refresh' });
      root.replaceChildren(strip('1 / 2', 'Flashcards · Easy', [clock, skip]), holder);
      sub = Modes.flashcards.start(holder, Object.assign({}, c, {
        items: Engine.shuffle(key).concat(Engine.shuffle(rest)), ordered: true, diff: 'easy',
        onComplete: () => testPhase('done')
      }));
      timer = setInterval(() => {
        const now = performance.now();
        // Clock pauses during session breaks and when the tab is hidden.
        if (!document.body.classList.contains('on-break') && !document.hidden) remaining -= now - last;
        last = now;
        clock.lastChild.textContent = UI.fmtTime(remaining);
        clock.classList.toggle('warn', remaining < 30000);
        if (remaining <= 0) testPhase('time');
      }, 250);
    }

    function testPhase(why) {
      if (phase === 'test') return;
      phase = 'test';
      clearInterval(timer); stopSub();
      if (why === 'time') UI.toast("Time's up! Test time");
      if (why === 'done') UI.toast('All cards known! On to the test');
      const holder = h('div', { class: 'refresh' });
      root.replaceChildren(strip('2 / 2', key.length >= 4 ? 'Test · class key terms' : 'Test · must-know items', h('span', { class: 'muted small' }, testLen + ' questions')), holder);
      sub = Modes.quiz.start(holder, Object.assign({}, c, {
        items: testPool, all: must.length >= 12 ? must : c.all, diff: 'medium', autoLen: testLen
      }));
    }

    intro();
    return () => { clearInterval(timer); stopSub(); };
  }
};
