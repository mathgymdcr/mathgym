// ===== script.js =====
import './plantillas/base.js';
import { initRouter } from './router.js';
import { recordCompletion, getProgress } from './progress.js';

const $ = id => document.getElementById(id);

// --- RACHA (badge en el nav) ---
function pintarRacha() {
  const badge = $('streak-badge');
  if (!badge) return;
  const { currentStreak } = getProgress();
  if (!currentStreak) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = '';
  badge.textContent = `🔥 Racha: ${currentStreak} día${currentStreak === 1 ? '' : 's'}`;
}

// --- CARGA DEL RETO ---
async function loadReto(fecha) {
  const ruta = fecha ? `retos/${encodeURIComponent(fecha)}.json` : 'reto.json';
  const r = await fetch(ruta, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// --- MONTAJE DEL RETO ---
async function mount(reto, esRetoDeHoy) {
  const cont = $('contenedor-interactivo');
  if (!cont) {
    console.error('❌ Falta #contenedor-interactivo en el HTML');
    return;
  }

  // Mostrar contenedor y ocultar la hero de bienvenida
  cont.style.display = 'block';
  const hero = document.querySelector('.hero');
  if (hero) hero.style.display = 'none';

  cont.innerHTML = '<div class="skeleton">Cargando…</div>';

  try {
    await window.Templates.render(reto.tipo, reto.data || {}, cont, {
      onSuccess() {
        if (esRetoDeHoy) {
          recordCompletion(reto);
          pintarRacha();
        }
      }
    });
  } catch (err) {
    cont.innerHTML = `<p class="error">Error al cargar el reto (${reto.tipo}): ${err.message}</p>`;
    console.error('❌ Error cargando plantilla:', err);
  }
}

// --- INICIALIZA ROUTER ---
const router = initRouter({ mount, loadReto });

// --- CARGA EL RETO AL INICIAR ---
pintarRacha();
router.renderCurrent();

// --- INTERCEPTA EL CLICK EN “ENTRENAR AHORA” ---
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action="entrenar"]');
  if (!btn) return;

  ev.preventDefault();
  console.log('🎯 Click en Entrenar detectado');
  history.pushState({}, '', './');
  router.renderCurrent();
}, { capture: true });
