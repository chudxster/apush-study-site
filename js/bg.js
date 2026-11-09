// Interactive background: the glow drifts toward the cursor (parallax) and the
// grid bends away from it. Draws only while something is moving, so it stays
// light on low-power devices (e.g. Chromebooks).
(function () {
  const host = document.querySelector('.bg-fx');
  if (!host) return;
  const glow = document.createElement('div'); glow.className = 'bg-glow';
  const cv = document.createElement('canvas'); cv.className = 'bg-grid';
  host.append(glow, cv);
  const ctx = cv.getContext('2d');

  const GAP = 56, STEP = 12, R = 190, PUSH = 30, PARALLAX = 0.025, GLOW_PARALLAX = 0.06;
  let W = 0, H = 0, raf = 0, accent = '#8B5CF6';
  const target = { x: 0, y: 0, a: 0 }, cur = { x: 0, y: 0, a: 0 };

  const reduced = () => UI.reduced();
  function readAccent() {
    accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
  }
  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!cur.x) { cur.x = target.x = W / 2; cur.y = target.y = H / 3; }
    kick();
  }

  // Push a point away from the cursor (Gaussian falloff).
  function warp(x, y) {
    const dx = x - cur.x, dy = y - cur.y;
    const d2 = dx * dx + dy * dy;
    const f = cur.a * PUSH * Math.exp(-d2 / (R * R));
    const d = Math.sqrt(d2) || 1;
    return [x + (dx / d) * f, y + (dy / d) * f];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Whole grid drifts slightly toward the cursor.
    const ox = ((cur.x - W / 2) * PARALLAX) % GAP, oy = ((cur.y - H / 2) * PARALLAX) % GAP;
    const g = ctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, R * 1.8);
    g.addColorStop(0, rgba(accent, 0.07 + 0.28 * cur.a));
    g.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const reach = R * 2.6;
    for (let x = ox - GAP; x <= W + GAP; x += GAP) {
      if (cur.a < 0.01 || Math.abs(x - cur.x) > reach) { ctx.moveTo(x, 0); ctx.lineTo(x, H); continue; }
      const y0 = Math.max(0, cur.y - reach), y1 = Math.min(H, cur.y + reach);
      ctx.moveTo(x, 0); ctx.lineTo(x, y0);
      for (let y = y0; y <= y1; y += STEP) { const p = warp(x, y); ctx.lineTo(p[0], p[1]); }
      ctx.lineTo(x, H);
    }
    for (let y = oy - GAP; y <= H + GAP; y += GAP) {
      if (cur.a < 0.01 || Math.abs(y - cur.y) > reach) { ctx.moveTo(0, y); ctx.lineTo(W, y); continue; }
      const x0 = Math.max(0, cur.x - reach), x1 = Math.min(W, cur.x + reach);
      ctx.moveTo(0, y); ctx.lineTo(x0, y);
      for (let x = x0; x <= x1; x += STEP) { const p = warp(x, y); ctx.lineTo(p[0], p[1]); }
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // Glow layer drifts toward the cursor.
    glow.style.transform = 'translate3d(' + ((cur.x - W / 2) * GLOW_PARALLAX).toFixed(1) + 'px,' + ((cur.y - H / 2) * GLOW_PARALLAX).toFixed(1) + 'px,0)';
  }

  function frame() {
    raf = 0;
    const k = reduced() ? 1 : 0.12;
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.a += ((reduced() ? 0 : target.a) - cur.a) * (reduced() ? 1 : 0.08);
    draw();
    const moving = Math.abs(target.x - cur.x) > 0.3 || Math.abs(target.y - cur.y) > 0.3 || Math.abs(target.a - cur.a) > 0.005;
    if (moving && !document.hidden && !reduced()) raf = requestAnimationFrame(frame);
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  readAccent();
  size();
})();
