/* Confetti lightweight, fără dependențe — canvas full-screen, auto-cleanup.
   Non-blocking (pointer-events:none), adaptat pentru desktop și mobile. */

let active = false;

export function fireConfetti() {
  if (typeof document === 'undefined' || active) return;
  active = true;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:4000';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  const resize = () => {
    canvas.width  = W() * dpr;
    canvas.height = H() * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#00A99D', '#17B26A', '#0871C4', '#033667', '#F59E0B', '#2BD4C7'];
  const COUNT  = W() < 600 ? 80 : 150;

  const parts = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * W(),
    y:     -20 - Math.random() * H() * 0.35,
    w:     6 + Math.random() * 6,
    h:     8 + Math.random() * 8,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    vx:    -2.4 + Math.random() * 4.8,
    vy:    2 + Math.random() * 4,
    rot:   Math.random() * Math.PI,
    vr:    -0.22 + Math.random() * 0.44,
  }));

  const DURATION = 2800;
  const start    = performance.now();

  function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, W(), H());
    const fade = elapsed > DURATION - 700 ? Math.max(0, (DURATION - elapsed) / 700) : 1;

    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.vx *= 0.995;
      p.rot += p.vr;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener('resize', resize);
      canvas.remove();
      active = false;
    }
  }

  requestAnimationFrame(frame);
}
