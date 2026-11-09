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

  function apply(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    const root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--on-accent', luminance(hex) > 0.3 ? '#0a0a0b' : '#ffffff');
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
        h('section', { class: 'setting row' },
          h('div', null, h('div', { class: 'setting-label' }, 'Reduce motion'), h('p', { class: 'muted small' }, 'Turns off page transitions and animations.')),
          motion),
        h('section', { class: 'setting' },
          h('div', { class: 'setting-label' }, 'Progress'),
          h('p', { class: 'muted small' }, 'Mastery and best scores are saved in this browser only.'),
          reset)),
      h('div', { class: 'sheet-foot muted small' }, 'APUSH Study · notes-based practice'));

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
