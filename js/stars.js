// Star field behind the grid: faint stars drifting slowly, a small meteor about
// every 15s that lights up the stars it passes, and a short, slightly brighter
// meteor shower about every 2 minutes. Toggle: Settings > Shooting stars.
// Reduce motion shows still stars only. Runs at ~30fps and pauses when hidden.
(function () {
  const host = document.querySelector('.bg-fx');
  if (!host) return;
  const cv = document.createElement('canvas'); cv.className = 'bg-stars';
  host.insertBefore(cv, host.querySelector('.bg-grid'));
  const ctx = cv.getContext('2d');

  const METEOR_EVERY = 15000, SHOWER_EVERY = 120000, SHOWER_LEN = 8000;
  const LIGHT_R = 90;                     // meteors light up stars within this distance
  const jitter = (ms, f) => ms * (1 - f + Math.random() * 2 * f);
  const rnd = (a, b) => a + Math.random() * (b - a);

  let W = 0, H = 0, stars = [], meteors = [], raf = 0, last = 0, prev = 0;
  let nextMeteor = 0, nextShower = 0, showerEnd = 0, nextShowerMeteor = 0, radiant = null;
  let accent = '#8B5CF6';

  const on = () => Store.get('bgStars') !== false;
  const still = () => UI.reduced() || Store.get('bgMotion') === false;

  function rgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0x8B5CF6;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readAccent() {
    accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(260, (W * H) / 8000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: rnd(0.35, 1.15), a: rnd(0.12, 0.42),
      tw: rnd(0.3, 1.1), ph: Math.random() * 6.28,
      vx: rnd(-2.5, -0.6), vy: rnd(0.2, 1.2),       // px per second: a slow drift
      glow: 0
    }));
    paint(performance.now());
  }

  // A meteor: head travels along (dx, dy); tail trails behind it.
  function launch(now, bright, from) {
    let x, y, ang;
    if (from) {   // shower: streams out of one radiant point, spread a little
      ang = Math.atan2(H * 0.6 - from.y, W * 0.35 - from.x) + rnd(-0.35, 0.35);
      x = from.x + rnd(-120, 120); y = from.y + rnd(-60, 60);
    } else {      // lone meteor: enters from the top or right edge, heads down-left
      ang = rnd(Math.PI * 0.62, Math.PI * 0.8);
      if (Math.random() < 0.6) { x = rnd(W * 0.25, W * 1.05); y = -20; } else { x = W + 20; y = rnd(-20, H * 0.45); }
    }
    const speed = rnd(520, 820) * (bright ? 1.1 : 1);
    meteors.push({ x, y, dx: Math.cos(ang), dy: Math.sin(ang), speed, t0: now,
      life: rnd(900, 1500), len: rnd(70, 130) * (bright ? 1.25 : 1), b: bright ? 1.35 : 1 });
  }

  function schedule(now) {
    nextMeteor = now + jitter(METEOR_EVERY, 0.3);
    if (!nextShower) nextShower = now + jitter(SHOWER_EVERY, 0.15);
  }

  function step(now, dt) {
    if (now >= nextMeteor) { launch(now, false); nextMeteor = now + jitter(METEOR_EVERY, 0.3); }
    if (now >= nextShower && !showerEnd) {
      showerEnd = now + SHOWER_LEN; nextShowerMeteor = now;
      radiant = { x: W * rnd(0.75, 1.0), y: -H * rnd(0.05, 0.2) };
    }
    if (showerEnd) {
      if (now >= showerEnd) { showerEnd = 0; nextShower = now + jitter(SHOWER_EVERY, 0.15); }
      else if (now >= nextShowerMeteor) { launch(now, true, radiant); nextShowerMeteor = now + rnd(220, 650); }
    }
    for (const s of stars) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < -4) s.x += W + 8; if (s.y > H + 4) s.y -= H + 8;
      s.glow *= Math.pow(0.18, dt);           // fade back over ~1.5s
    }
    for (let k = meteors.length - 1; k >= 0; k--) {
      const m = meteors[k], age = now - m.t0;
      if (age > m.life) { meteors.splice(k, 1); continue; }
      const d = (age / 1000) * m.speed;
      m.hx = m.x + m.dx * d; m.hy = m.y + m.dy * d;
      m.fade = Math.sin(Math.PI * Math.min(1, age / m.life));   // ease in and out
      for (const s of stars) {
        const ex = s.x - m.hx, ey = s.y - m.hy;
        if (ex > LIGHT_R || ex < -LIGHT_R || ey > LIGHT_R || ey < -LIGHT_R) continue;
        const g = (1 - Math.sqrt(ex * ex + ey * ey) / LIGHT_R) * m.fade * m.b;
        if (g > s.glow) s.glow = Math.min(1.3, g);
      }
    }
  }

  function paint(now) {
    ctx.clearRect(0, 0, W, H);
    if (!on()) return;
    const [ar, ag, ab] = rgb(accent);
    const t = now / 1000, moving = !still();
    for (const s of stars) {
      const tw = moving ? 0.75 + 0.25 * Math.sin(t * s.tw + s.ph) : 1;
      const a = Math.min(1, s.a * tw + s.glow * 0.75);
      if (s.glow > 0.05) {   // soft halo, tinted with the highlight color
        ctx.fillStyle = 'rgba(' + ar + ',' + ag + ',' + ab + ',' + (s.glow * 0.22).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2 + s.glow * 4, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = 'rgba(235,240,255,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + s.glow * 0.9, 0, 6.283); ctx.fill();
    }
    for (const m of meteors) {
      if (m.hx == null) continue;
      const tx = m.hx - m.dx * m.len, ty = m.hy - m.dy * m.len;
      const g = ctx.createLinearGradient(m.hx, m.hy, tx, ty);
      const a = 0.55 * m.fade * m.b;
      g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, a).toFixed(3) + ')');
      g.addColorStop(0.25, 'rgba(' + ar + ',' + ag + ',' + ab + ',' + (a * 0.5).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + ar + ',' + ag + ',' + ab + ',0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2 * (m.b > 1 ? 1.2 : 1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.hx, m.hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, a * 1.3).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(m.hx, m.hy, 1.1 * m.b, 0, 6.283); ctx.fill();
    }
  }

  function frame(now) {
    raf = 0;
    if (document.hidden || !on() || still()) { paint(now); return; }
    if (now - last >= 33) {                      // ~30fps is plenty for slow stars
      const dt = Math.min(0.1, (now - (prev || now)) / 1000);
      prev = now; last = now;
      step(now, dt);
      paint(now);
    }
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (raf) return;
    prev = 0;
    const now = performance.now();
    if (!nextMeteor || now > nextMeteor + 5000) schedule(now);   // don't fire a backlog after a pause
    if (nextShower && now > nextShower + SHOWER_LEN) nextShower = now + jitter(SHOWER_EVERY, 0.15);
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', size);
  window.addEventListener('accentchange', () => { readAccent(); paint(performance.now()); });
  window.addEventListener('bgsettings', () => { meteors = []; kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  new MutationObserver(kick).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // For testing from the console: Stars.meteor(), Stars.shower().
  window.Stars = {
    meteor() { launch(performance.now(), false); kick(); },
    shower() { nextShower = performance.now(); showerEnd = 0; kick(); }
  };

  readAccent();
  size();
  kick();
})();
