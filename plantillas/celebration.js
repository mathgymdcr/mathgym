// ===== plantillas/celebration.js =====
// Celebración compartida (confetti + Deceerre) reutilizada por los 5 retos.

export function celebrate({ ok = true, title, message } = {}) {
  document.querySelectorAll('.celebration-overlay').forEach(o => o.remove());

  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const overlay = document.createElement('div');
  overlay.className = 'celebration-overlay';

  const img = ok ? 'assets/deceerre-celebration.png' : 'assets/deceerre-challenge.png';
  const heading = title || (ok ? '¡Excelente trabajo!' : '¡Reto superado, pero puedes optimizarlo!');

  overlay.innerHTML = `
    <div class="celebration-card">
      <img src="${img}" alt="Deceerre celebrando" class="celebration-avatar">
      <h2 class="celebration-title ${ok ? 'is-ok' : 'is-warn'}">${heading}</h2>
      ${message ? `<p class="celebration-message">${message}</p>` : ''}
      <span class="celebration-hint">Toca o pulsa Esc para continuar</span>
      ${reduceMotion ? '' : '<canvas class="celebration-confetti"></canvas>'}
    </div>`;
  document.body.appendChild(overlay);

  let run = false;
  if (!reduceMotion) {
    const canvas = overlay.querySelector('.celebration-confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 4 + 2,
      dx: (Math.random() - .5) * 1.5,
      dy: Math.random() * 2 + 1.2,
      color: `hsl(${Math.random() * 360},85%,60%)`,
      phase: Math.random() * Math.PI * 2
    }));

    run = true;
    (function loop() {
      if (!run) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.dx + Math.sin(p.phase) * 0.5; p.y += p.dy; p.phase += 0.03;
        if (p.y > canvas.height + 8) p.y = -8;
        if (p.x > canvas.width + 8) p.x = -8;
        if (p.x < -8) p.x = canvas.width + 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  }

  const close = () => {
    run = false;
    overlay.remove();
    document.removeEventListener('keydown', onEsc);
  };
  function onEsc(e) { if (e.key === 'Escape') close(); }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onEsc);
  setTimeout(close, 8000);

  return { close };
}
