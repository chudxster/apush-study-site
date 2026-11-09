// Study session tracker: study time → alarm → break → alarm → repeat.
(function () {
  const { h, icon } = UI;
  const KEY = 'apush-session.v1';
  const SKIP = 'apush-session-skip';
  const STUDY_OPTS = [10, 15, 25, 45];
  const BREAK_OPTS = [3, 5, 10, 15];

  let s = null; // { study, brk, phase: 'study'|'break', endsAt, pausedLeft }
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const save = () => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) {} };
  const skipped = () => { try { return sessionStorage.getItem(SKIP) === '1'; } catch (e) { return false; } };
  const setSkipped = () => { try { sessionStorage.setItem(SKIP, '1'); } catch (e) {} };
  const left = () => (s.pausedLeft != null ? s.pausedLeft : s.endsAt - Date.now());

  // ---------- alarm (generated, no audio files) ----------
  let ctx = null;
  function audio() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }
  document.addEventListener('pointerdown', () => { if (s) audio(); }, { passive: true });

  function alarm() {
    const a = audio();
    if (a) {
      const t0 = a.currentTime + 0.05;
      for (let rep = 0; rep < 3; rep++) {
        [880, 1175, 1568].forEach((f, k) => {
          const t = t0 + rep * 0.9 + k * 0.16;
          const o = a.createOscillator(), g = a.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
          o.connect(g).connect(a.destination);
          o.start(t); o.stop(t + 0.4);
        });
      }
    }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    flashTitle();
  }

  let titleTimer = null;
  function flashTitle() {
    clearInterval(titleTimer);
    const base = document.title.replace(/^⏰ [^·]+ · /, '');
    const msg = s && s.phase === 'break' ? '⏰ Break time · ' : '⏰ Back to studying · ';
    let n = 0;
    titleTimer = setInterval(() => {
      document.title = n % 2 ? base : msg + base;
      if (++n > 11 || document.hasFocus()) { clearInterval(titleTimer); document.title = base; }
    }, 700);
  }

  // ---------- state ----------
  function start(study, brk) {
    s = { study, brk, phase: 'study', endsAt: Date.now() + study * 60000, pausedLeft: null };
    save(); audio(); render();
    UI.toast('Session started · ' + study + ' min study, ' + brk + ' min break');
  }
  function end() { s = null; save(); render(); UI.toast('Session ended'); }
  function pause() { if (s && s.pausedLeft == null) { s.pausedLeft = Math.max(0, left()); save(); render(); } }
  function resume() { if (s && s.pausedLeft != null) { s.endsAt = Date.now() + s.pausedLeft; s.pausedLeft = null; save(); render(); } }
  function nextPhase(silent) {
    if (!s) return;
    s.phase = s.phase === 'study' ? 'break' : 'study';
    s.endsAt = Date.now() + (s.phase === 'study' ? s.study : s.brk) * 60000;
    s.pausedLeft = null;
    save();
    if (!silent) alarm();
    if (s.phase === 'study') UI.toast(silent ? 'Back to studying' : 'Break over. Back to studying!');
    render();
  }

  // ---------- topbar pill ----------
  const pill = h('button', { class: 'session-pill', type: 'button', onclick: () => openModal() });
  document.getElementById('settings-btn').before(pill);

  // ---------- break overlay ----------
  const C = 2 * Math.PI * 70;
  const brNum = h('div', { class: 'break-num mono' });
  const brRing = h('div', { class: 'break-ring', html:
    '<svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" class="ring-bg"/><circle cx="80" cy="80" r="70" class="ring-fg" style="stroke-dasharray:' + C + '"/></svg>' });
  brRing.append(h('div', { class: 'ring-center' }, brNum, h('div', { class: 'ring-label' }, 'break left')));
  const overlay = h('div', { class: 'break-overlay', 'aria-hidden': 'true', role: 'dialog', 'aria-label': 'Break time' },
    h('div', { class: 'break-card' },
      h('div', { class: 'eyebrow' }, 'Session'),
      h('h2', null, 'Break time'),
      h('p', { class: 'muted' }, 'Stand up, stretch, drink some water, and look away from the screen. An alarm will ring when it’s time to get back to it.'),
      brRing,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', onclick: end }, 'End session'),
        h('button', { class: 'btn primary', onclick: () => nextPhase(true) }, 'Skip break', icon('arrow', 16)))));
  document.body.append(overlay);

  function render() {
    // pill
    if (!s) {
      pill.className = 'session-pill idle';
      pill.replaceChildren(icon('clock', 16), h('span', { class: 'pill-text' }, 'Session'));
      pill.setAttribute('aria-label', 'Start a study session');
    } else {
      const paused = s.pausedLeft != null;
      pill.className = 'session-pill ' + s.phase + (paused ? ' paused' : '');
      pill.replaceChildren(h('span', { class: 'pill-dot' }),
        h('span', { class: 'pill-text' }, paused ? 'Paused' : s.phase === 'study' ? 'Study' : 'Break'),
        h('span', { class: 'pill-time mono' }, UI.fmtTime(left())));
      pill.setAttribute('aria-label', 'Study session: ' + s.phase + ', ' + UI.fmtTime(left()) + ' left');
    }
    // overlay
    const showBreak = !!(s && s.phase === 'break');
    overlay.classList.toggle('show', showBreak);
    overlay.setAttribute('aria-hidden', String(!showBreak));
    document.body.classList.toggle('on-break', showBreak);
    if (showBreak) {
      brNum.textContent = UI.fmtTime(left());
      const p = Math.max(0, Math.min(1, left() / (s.brk * 60000)));
      brRing.querySelector('.ring-fg').style.strokeDashoffset = String(C * (1 - p));
    }
    if (modalLive) modalLive();
  }

  setInterval(() => {
    if (s && s.pausedLeft == null && left() <= 0) nextPhase(false);
    else render();
  }, 500);

  // ---------- modal (setup + manage) ----------
  let modalLive = null;
  function openModal(onDone) {
    const scrim = h('div', { class: 'modal-scrim' });
    const box = h('div', { class: 'modal card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Study session' });
    const wrap = h('div', { class: 'modal-wrap' }, scrim, box);
    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true; modalLive = null;
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.add('closing');
      document.body.classList.remove('modal-open');
      setTimeout(() => wrap.remove(), UI.reduced() ? 0 : 280);
      if (onDone) onDone(result);
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close('dismiss'); } }
    document.addEventListener('keydown', onKey, true);
    scrim.addEventListener('click', () => close('dismiss'));

    if (s) manage(); else setup();

    function setup() {
      let study = 15, brk = 5;
      const studyIn = h('input', { type: 'number', class: 'num-in', min: '1', max: '180', value: '15', 'aria-label': 'Custom study minutes' });
      const brkIn = h('input', { type: 'number', class: 'num-in', min: '1', max: '60', value: '5', 'aria-label': 'Custom break minutes' });
      const summary = h('div', { class: 'session-summary' });
      const sync = () => { summary.replaceChildren(h('b', null, study + ' min'), ' study  →  ', h('b', null, brk + ' min'), ' break  →  repeat'); };
      const clamp = (v, max) => Math.max(1, Math.min(max, Math.round(+v) || 1));
      const studySeg = UI.seg(STUDY_OPTS.map((m) => ({ value: String(m), label: m + (m === 15 ? ' min ★' : ' min') })), '15',
        (v) => { study = +v; studyIn.value = v; sync(); });
      const brkSeg = UI.seg(BREAK_OPTS.map((m) => ({ value: String(m), label: m + (m === 5 ? ' min ★' : ' min') })), '5',
        (v) => { brk = +v; brkIn.value = v; sync(); });
      studyIn.addEventListener('input', () => { study = clamp(studyIn.value, 180); sync(); });
      brkIn.addEventListener('input', () => { brk = clamp(brkIn.value, 60); sync(); });
      sync();
      box.replaceChildren(
        h('div', { class: 'modal-icon' }, icon('clock', 26)),
        h('h2', null, 'Start a study session?'),
        h('p', { class: 'muted' }, 'Pick how long to study and how long to rest. An alarm rings when study time is up and again when your break ends.'),
        h('div', { class: 'rec' }, icon('spark', 14), 'Recommended: 15 min study · 5 min break'),
        h('div', { class: 'modal-field' }, h('div', { class: 'control-label' }, 'Study time'),
          h('div', { class: 'field-row' }, studySeg, h('label', { class: 'custom-num' }, studyIn, h('span', null, 'min')))),
        h('div', { class: 'modal-field' }, h('div', { class: 'control-label' }, 'Break time'),
          h('div', { class: 'field-row' }, brkSeg, h('label', { class: 'custom-num' }, brkIn, h('span', null, 'min')))),
        summary,
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', onclick: () => { setSkipped(); close('skip'); } }, 'No timer'),
          h('button', { class: 'btn ghost sm', onclick: () => alarm(), title: 'Play the alarm sound' }, 'Test alarm'),
          h('button', { class: 'btn primary big', onclick: () => { start(study, brk); close('start'); } }, 'Start session', icon('arrow', 18))));
      setTimeout(() => box.querySelector('.btn.primary').focus(), 60);
    }

    function manage() {
      const time = h('div', { class: 'manage-time mono' });
      const label = h('div', { class: 'muted small' });
      const pauseBtn = h('button', { class: 'btn ghost', onclick: () => { s.pausedLeft != null ? resume() : pause(); } });
      const skipBtn = h('button', { class: 'btn ghost' });
      skipBtn.addEventListener('click', () => nextPhase(true));
      modalLive = () => {
        if (!s) return close('ended');
        time.textContent = UI.fmtTime(left());
        label.textContent = (s.pausedLeft != null ? 'Paused · ' : '') + (s.phase === 'study' ? 'study time left' : 'break time left') +
          ' · ' + s.study + ' min study / ' + s.brk + ' min break';
        pauseBtn.textContent = s.pausedLeft != null ? 'Resume' : 'Pause';
        skipBtn.textContent = s.phase === 'study' ? 'Start break now' : 'Skip break';
      };
      modalLive();
      box.replaceChildren(
        h('div', { class: 'modal-icon' }, icon('clock', 26)),
        h('h2', null, 'Study session'),
        time, label,
        h('div', { class: 'actions' },
          pauseBtn, skipBtn,
          h('button', { class: 'btn ghost danger', onclick: () => { end(); close('ended'); } }, 'End session'),
          h('button', { class: 'btn primary', onclick: () => close('dismiss') }, 'Done')));
    }

    document.body.append(wrap);
    document.body.classList.add('modal-open');
  }

  // Ask once per visit, before a study mode starts.
  function prompt() {
    return new Promise((resolve) => {
      if (s || skipped()) return resolve();
      openModal(() => { setSkipped(); resolve(); });
    });
  }

  render();
  window.Session = { prompt, open: openModal, alarm, active: () => !!s };
})();
