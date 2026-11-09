// Accent color + settings sheet (top-right gear).
(function () {
  const { h, icon } = UI;
  const PRESETS = [
    ['Violet', '#8B5CF6'], ['Blue', '#3B82F6'], ['Cyan', '#06B6D4'], ['Emerald', '#10B981'],
    ['Lime', '#84CC16'], ['Amber', '#F59E0B'], ['Rose', '#F43F5E'], ['Pink', '#EC4899']
  ];

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }

  // Shade scale computed here (not only via CSS color-mix) so older Chrome
  // versions, e.g. Chromebooks past their update date, still get the palette.
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(hex, to, t) {
    const a = rgb(hex);
    return '#' + a.map((c, i) => Math.round(c * t + to[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }
  const SHADES = { 950: [0, .10], 900: [0, .22], 800: [0, .38], 700: [0, .58], 600: [0, .80], 400: [255, .78], 300: [255, .58], 200: [255, .38], 100: [255, .18] };
  const ALPHAS = { '06': .06, 12: .12, 20: .20, 35: .35, 55: .55 };

  function apply(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    const root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--a-500', hex);
    for (const k in SHADES) { const [v, t] = SHADES[k]; root.style.setProperty('--a-' + k, mix(hex, [v, v, v], t)); }
    const [r, g, b] = rgb(hex);
    for (const k in ALPHAS) root.style.setProperty('--a-' + k, 'rgba(' + r + ',' + g + ',' + b + ',' + ALPHAS[k] + ')');
    root.style.setProperty('--on-accent', luminance(hex) > 0.3 ? '#0a0a0b' : '#ffffff');
    window.dispatchEvent(new Event('accentchange'));
  }

  function buildSheet() {
    const sheet = document.getElementById('settings');
    const scrim = document.getElementById('scrim');
    const btn = document.getElementById('settings-btn');
    btn.append(icon('gear', 20));

    const swatches = h('div', { class: 'swatches' });
    const custom = h('input', { type: 'color', class: 'color-input', value: Store.get('accent'), 'aria-label': 'Custom color' });
    const hexLabel = h('code', { class: 'hex' }, Store.get('accent').toUpperCase());

    function select(hex) {
      apply(hex);
      Store.set('accent', hex);
      custom.value = hex;
      hexLabel.textContent = hex.toUpperCase();
      swatches.querySelectorAll('.swatch').forEach((s) =>
        s.setAttribute('aria-pressed', String(s.dataset.hex.toLowerCase() === hex.toLowerCase())));
    }

    PRESETS.forEach(([name, hex]) => {
      const s = h('button', { class: 'swatch', type: 'button', title: name, 'aria-label': name, style: { '--c': hex },
        onclick: () => select(hex) });
      s.dataset.hex = hex;
      swatches.append(s);
    });
    custom.addEventListener('input', () => select(custom.value));

    const motion = h('input', { type: 'checkbox', class: 'switch', checked: Store.get('reduceMotion') || null });
    motion.addEventListener('change', () => {
      Store.set('reduceMotion', motion.checked);
      document.documentElement.classList.toggle('reduce-motion', motion.checked);
    });

    // Background controls (read by js/bg.js).
    const BG = (window.Bg && Bg.DEFAULTS) || { bgWarp: true, bgRadius: 420, bgParallax: 50, bgMotion: true, bgStars: true };
    const bgVal = (k) => (Store.get(k) == null ? BG[k] : Store.get(k));
    const bgSet = (k, v) => { Store.set(k, v); window.dispatchEvent(new Event('bgsettings')); };
    function sw(key) {
      const el = h('input', { type: 'checkbox', class: 'switch', checked: bgVal(key) || null });
      el.addEventListener('change', () => { bgSet(key, el.checked); sync(); });
      return el;
    }
    function slider(key, min, max, step, fmt) {
      const out = h('output', { class: 'range-val mono' }, fmt(bgVal(key)));
      const el = h('input', { type: 'range', class: 'range', min: String(min), max: String(max), step: String(step), value: String(bgVal(key)) });
      const fill = () => el.style.setProperty('--p', ((el.value - min) / (max - min)) * 100 + '%');
      el.addEventListener('input', () => { out.textContent = fmt(+el.value); fill(); bgSet(key, +el.value); });
      fill();
      return { el, row: h('div', { class: 'range-row' }, el, out) };
    }
    const warpSw = sw('bgWarp'), motionSw = sw('bgMotion'), starsSw = sw('bgStars');
    const radius = slider('bgRadius', 150, 800, 10, (v) => v + 'px');
    const parallax = slider('bgParallax', 0, 100, 5, (v) => (v ? v + '%' : 'Off'));
    function sync() { radius.el.disabled = !warpSw.checked; radius.row.classList.toggle('off', !warpSw.checked); }
    sync();

    const reset = h('button', { class: 'btn ghost danger', type: 'button', onclick: () => {
      if (reset.dataset.armed) {
        Store.resetProgress(); reset.textContent = 'Progress reset'; delete reset.dataset.armed;
        UI.toast('Progress cleared'); setTimeout(() => { reset.textContent = 'Reset progress'; }, 1600);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else { reset.dataset.armed = '1'; reset.textContent = 'Tap again to confirm'; }
    } }, 'Reset progress');

    sheet.append(
      h('div', { class: 'sheet-head' },
        h('h2', null, 'Settings'),
        h('button', { class: 'icon-btn', 'aria-label': 'Close settings', onclick: close }, icon('x', 20))),
      h('div', { class: 'sheet-body' },
        h('section', { class: 'setting' },
          h('div', { class: 'setting-label' }, 'Highlight color'),
          h('p', { class: 'muted small' }, 'Every shade on the site is built from this one color.'),
          swatches,
          h('label', { class: 'custom-row' }, h('span', { class: 'custom-chip' }, custom), h('span', null, 'Custom'), hexLabel),
          h('div', { class: 'shade-preview', 'aria-hidden': 'true' },
            ['900', '800', '700', '600', '500', '400', '300', '200', '100'].map((s) => h('i', { style: { background: 'var(--a-' + s + ')' } })))),
        h('section', { class: 'setting' },
          h('div', { class: 'setting-label' }, 'Background'),
          h('p', { class: 'muted small' }, 'The grid reacts to your cursor. Turn things down if your device feels slow.'),
          h('div', { class: 'sub-row' }, h('span', null, 'Cursor warp'), warpSw),
          h('div', { class: 'sub-field' }, h('span', { class: 'muted small' }, 'Warp radius'), radius.row),
          h('div', { class: 'sub-field' }, h('span', { class: 'muted small' }, 'Parallax'), parallax.row),
          h('div', { class: 'sub-row' }, h('span', null, 'Slow background movement'), motionSw),
          h('div', { class: 'sub-row' }, h('span', null, 'Shooting stars'), starsSw)),
        h('section', { class: 'setting row' },
          h('div', null, h('div', { class: 'setting-label' }, 'Reduce motion'), h('p', { class: 'muted small' }, 'Turns off page transitions and animations.')),
          motion),
        h('section', { class: 'setting' },
          h('div', { class: 'setting-label' }, 'Progress'),
          h('p', { class: 'muted small' }, 'Mastery and best scores are saved in this browser only.'),
          reset)),
      h('div', { class: 'sheet-foot muted small' }, 'Cram · notes-based practice'));

    select(Store.get('accent'));

    function open() {
      document.body.classList.add('sheet-open');
      sheet.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => sheet.querySelector('.swatch[aria-pressed="true"], .swatch').focus(), 50);
    }
    function close() {
      document.body.classList.remove('sheet-open');
      sheet.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      delete reset.dataset.armed; reset.textContent = 'Reset progress';
    }
    btn.addEventListener('click', () => document.body.classList.contains('sheet-open') ? close() : open());
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('sheet-open')) { e.stopImmediatePropagation(); close(); }
    }, true);
  }

  apply(Store.get('accent'));
  window.Theme = { apply, buildSheet };
})();
