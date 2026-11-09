// Interactive background: the glow drifts toward the cursor (parallax), the grid
// bends gently away from it and brightens near it, and everything drifts slowly
// on its own. All of it is adjustable in Settings. Ambient-only frames are
// throttled so it stays light on low-power devices (e.g. Chromebooks).
(function () {
  const host = document.querySelector('.bg-fx');
  if (!host) return;
  const glow = document.createElement('div'); glow.className = 'bg-glow';
  const cv = document.createElement('canvas'); cv.className = 'bg-grid';
  host.append(glow, cv);
  const ctx = cv.getContext('2d');

  const GAP = 56, STEP = 14;
  const DEFAULTS = { bgWarp: true, bgRadius: 420, bgParallax: 50, bgMotion: true };
  const opt = () => {
    const o = {};
    for (const k in DEFAULTS) { const v = Store.get(k); o[k] = v == null ? DEFAULTS[k] : v; }
    return o;
  };
  let o = opt();
  let W = 0, H = 0, raf = 0, last = 0, accent = '#8B5CF6';
  const target = { x: 0, y: 0, a: 0 }, cur = { x: 0, y: 0, a: 0 };
  const reduced = () => UI.reduced();

  function readAccent() {
    accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
  }
  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, a).toFixed(3) + ')';
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!cur.x) { cur.x = target.x = W / 2; cur.y = target.y = H / 3; }
    kick();
  }

  // Gentle push away from the cursor: zero at the cursor, peaks at ~0.7R, fades out.
  function warp(x, y, R, push) {
    const dx = x - cur.x, dy = y - cur.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = push * (d / R) * Math.exp(-(d * d) / (R * R));
    return [x + (dx / d) * f, y + (dy / d) * f];
  }

  function draw(t) {
    const R = o.bgRadius, warpOn = o.bgWarp && cur.a > 0.01;
    const push = 16 * cur.a;                       // minor warp
    const par = (o.bgParallax / 100) * 0.05;       // grid parallax strength
    const drift = o.bgMotion && !reduced() ? t / 1000 : 0;
    ctx.clearRect(0, 0, W, H);

    // Grid offset: parallax toward the cursor + slow diagonal drift.
    const ox = (((cur.x - W / 2) * par + drift * 6) % GAP + GAP) % GAP;
    const oy = (((cur.y - H / 2) * par + drift * 4) % GAP + GAP) % GAP;

    // Brighter lines near the cursor, fading to the normal faint grid.
    const g = ctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, Math.max(R, 1));
    const lit = o.bgWarp ? cur.a : cur.a * 0.6;
    g.addColorStop(0, rgba(accent, 0.12 + 0.5 * lit));
    g.addColorStop(0.45, rgba(accent, 0.06 + 0.18 * lit));
    g.addColorStop(1, 'rgba(255,255,255,0.045)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const reach = R * 2;
    for (let x = ox - GAP; x <= W + GAP; x += GAP) {
      if (!warpOn || Math.abs(x - cur.x) > reach) { ctx.moveTo(x, 0); ctx.lineTo(x, H); continue; }
      const y0 = Math.max(0, cur.y - reach), y1 = Math.min(H, cur.y + reach);
      ctx.moveTo(x, 0); ctx.lineTo(x, y0);
      for (let y = y0; y <= y1; y += STEP) { const p = warp(x, y, R, push); ctx.lineTo(p[0], p[1]); }
      ctx.lineTo(x, H);
    }
    for (let y = oy - GAP; y <= H + GAP; y += GAP) {
      if (!warpOn || Math.abs(y - cur.y) > reach) { ctx.moveTo(0, y); ctx.lineTo(W, y); continue; }
      const x0 = Math.max(0, cur.x - reach), x1 = Math.min(W, cur.x + reach);
      ctx.moveTo(0, y); ctx.lineTo(x0, y);
      for (let x = x0; x <= x1; x += STEP) { const p = warp(x, y, R, push); ctx.lineTo(p[0], p[1]); }
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Glow: parallax toward the cursor + slow wander.
    const gp = (o.bgParallax / 100) * 0.12;
    const wx = drift ? Math.sin(drift * 0.21) * 28 + Math.sin(drift * 0.53) * 10 : 0;
    const wy = drift ? Math.cos(drift * 0.17) * 22 : 0;
    glow.style.transform = 'translate3d(' + ((cur.x - W / 2) * gp + wx).toFixed(1) + 'px,' + ((cur.y - H / 2) * gp + wy).toFixed(1) + 'px,0)';
  }

  function frame(now) {
    raf = 0;
    const k = reduced() ? 1 : 0.12;
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.a += ((reduced() ? 0 : target.a) - cur.a) * (reduced() ? 1 : 0.08);
    const moving = Math.abs(target.x - cur.x) > 0.3 || Math.abs(target.y - cur.y) > 0.3 || Math.abs(target.a - cur.a) > 0.005;
    const ambient = o.bgMotion && !reduced();
    // Ambient-only frames run at ~24fps; cursor movement runs at full rate.
    if (moving || !ambient || now - last > 40) { draw(now); last = now; }
    if (document.hidden) return;
    if (moving || ambient) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    target.x = e.clientX; target.y = e.clientY; target.a = 1;
    kick();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { target.a = 0; kick(); });
  window.addEventListener('blur', () => { target.a = 0; kick(); });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') { target.a = 0; kick(); } }, { passive: true });
  window.addEventListener('resize', size);
  window.addEventListener('accentchange', () => { readAccent(); kick(); });
  window.addEventListener('bgsettings', () => { o = opt(); kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  window.Bg = { DEFAULTS };
  readAccent();
  size();
})();
