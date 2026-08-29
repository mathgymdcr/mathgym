// ===== plantillas/celebration.js =====
// Celebración compartida (confetti + Deceerre) reutilizada por los 5 retos.

// La estrella se dibuja aquí y no se trae de assets/: es un adorno de la
// interfaz, no el icono de un tipo, y así no hay que esperar a que cargue
// justo en el momento de la celebración.
const SVG_ESTRELLA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6 15 9.1l7.1.8-5.3 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7L1.9 9.9 9 9.1Z"/></svg>`;

/**
 * Añade las estrellas ganadas a la celebración que YA está en pantalla. Se
 * llama desde fuera (script.js) porque quien sabe la marca es el shell, no la
 * plantilla: ella solo reporta lo que ha hecho quien juega.
 */
export function pintarEstrellas(ganadas, total = 3) {
  const card = document.querySelector('.celebration-overlay .celebration-card');
  if (!card) return null;

  const fila = document.createElement('div');
  fila.className = 'celebration-estrellas';
  fila.setAttribute('role', 'img');
  fila.setAttribute('aria-label', `${ganadas} de ${total} estrellas`);

  for (let i = 0; i < total; i++) {
    const hueco = document.createElement('span');
    hueco.className = 'estrella' + (i < ganadas ? ' is-ganada' : '');
    hueco.style.animationDelay = `${i * 220}ms`;
    hueco.innerHTML = SVG_ESTRELLA;
    fila.appendChild(hueco);
  }

  const titulo = card.querySelector('.celebration-title');
  if (titulo) titulo.insertAdjacentElement('afterend', fila);
  else card.prepend(fila);

  // La imagen la decide la marca final, no el `ok` con el que la plantilla
  // abrió la celebración: sin las tres estrellas es un reto de mejorar.
  const avatar = card.querySelector('.celebration-avatar');
  if (avatar) {
    avatar.src = ganadas >= total
      ? 'assets/deceerre-celebration.png'
      : 'assets/deceerre-challenge.png';
  }

  return fila;
}

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

  // El overlay solo se cierra al clic/toque o con Esc: no hay autocierre, así
  // que quien juega ve la celebración (o el aviso de mejorable) hasta que
  // decide seguir. Los controles marcados con `data-mantener` (el botón de
  // compartir) quedan fuera de esa regla: copiar un resultado no es "seguir".
  const close = () => {
    run = false;
    overlay.remove();
    document.removeEventListener('keydown', onEsc);
  };
  function onEsc(e) { if (e.key === 'Escape') close(); }

  overlay.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-mantener]')) return;
    close();
  });
  document.addEventListener('keydown', onEsc);

  return { close };
}
