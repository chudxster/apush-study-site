window.Modes = window.Modes || {};
Modes.necessities = {
  name: 'Necessities', icon: 'spark',
  desc: '5 minutes of Easy flashcards on the must-know items, then a test on them. Ignores the difficulty setting.',
  FLASH_MS: 5 * 60 * 1000,
  TEST_LEN: 15,
  must(items) { return Engine.byLevel(items, 1, 4); },
  available(c) { return this.must(c.items).length >= 4 ? null : 'Needs at least 4 must-know items'; },
  start(root, c) {
    const { h, icon } = UI;
    const self = this;
    const must = self.must(c.items);
    const mustAll = Engine.byLevel(c.all, 1, 12);
    const testLen = Math.min(self.TEST_LEN, must.length);
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
        h('p', { class: 'muted' }, 'The ' + must.length + ' must-know items' + (c.topicId === 'everything' ? '' : ' in ' + c.topic.name) + '. No small details.'),
        h('ol', { class: 'nec-steps' },
          h('li', null, h('b', null, '5 minutes'), ' of flashcards on Easy'),
          h('li', null, h('b', null, testLen + '-question test'), ' on the same items')),
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
        items: must, diff: 'easy', loop: true,
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
      root.replaceChildren(strip('2 / 2', 'Test · must-know items', h('span', { class: 'muted small' }, testLen + ' questions')), holder);
      sub = Modes.quiz.start(holder, Object.assign({}, c, {
        items: must, all: mustAll, diff: 'medium', autoLen: testLen
      }));
    }

    intro();
    return () => { clearInterval(timer); stopSub(); };
  }
};
