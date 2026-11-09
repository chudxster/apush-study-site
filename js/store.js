// Progress + preferences, saved in this browser only.
(function () {
  const KEY = 'apush-study.v1';
  const defaults = {
    accent: '#8B5CF6',
    reduceMotion: false,
    prefs: { diff: 'medium', ch: 'all', sub: 'all', flashReverse: false, quizLen: '10' },
    mastery: {},
    best: {}
  };
  let state = JSON.parse(JSON.stringify(defaults));
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      state = Object.assign(state, saved);
      state.prefs = Object.assign({}, defaults.prefs, saved.prefs || {});
      state.mastery = saved.mastery || {};
      // Mastery used to be keyed by bare item id; those were all Boom to Bust.
      Object.keys(state.mastery).forEach((k) => {
        if (k.indexOf('/') < 0) { state.mastery['boom-to-bust/' + k] = state.mastery[k]; delete state.mastery[k]; }
      });
      state.best = saved.best || {};
    }
  } catch (e) { /* storage unavailable: run with defaults */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  window.Store = {
    get: (k) => state[k],
    set(k, v) { state[k] = v; save(); },
    pref: (k) => state.prefs[k],
    setPref(k, v) { state.prefs[k] = v; save(); },
    mastery: (id) => state.mastery[id] || 0,
    bump(id, d) {
      const v = Math.max(0, Math.min(5, (state.mastery[id] || 0) + d));
      state.mastery[id] = v; save(); return v;
    },
    best: (key) => state.best[key],
    // Returns true when val is a new best.
    setBest(key, val, lowerIsBetter) {
      const cur = state.best[key];
      const better = cur == null || (lowerIsBetter ? val < cur : val > cur);
      if (better) { state.best[key] = val; save(); }
      return better;
    },
    resetProgress() { state.mastery = {}; state.best = {}; state.learned = {}; save(); }
  };
})();
