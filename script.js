// ===== script.js =====
import './plantillas/base.js';
import { initRouter } from './router.js';
import { recordCompletion, getProgress } from './progress.js';
import { pintarSala } from './home.js';

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

// --- SALA DE ENTRENAMIENTO (la home) ---
// Se pinta con el reto del día ya cargado, para poder anunciar cuál es antes
// de que nadie pulse nada. Si la carga falla, la sala se pinta igual y lo dice
// en la ficha del día.
async function pintarSalaDeHoy() {
  const sala = $('sala');
  if (!sala) return;
  let reto = null;
  try {
    reto = await loadReto(null);
  } catch (err) {
    console.error('No se pudo cargar el reto del día:', err);
  }
  pintarSala(sala, { reto, progreso: getProgress() });
}

// --- MONTAJE DEL RETO ---
async function mount(reto, esRetoDeHoy) {
  const cont = $('contenedor-interactivo');
  if (!cont) {
    console.error('❌ Falta #contenedor-interactivo en el HTML');
    return;
  }

  // Mostrar el reto y apartar la sala.
  cont.style.display = 'block';
  const sala = $('sala');
  if (sala) sala.style.display = 'none';

  cont.innerHTML = '<div class="skeleton">Cargando…</div>';

  try {
    await window.Templates.render(reto.tipo, reto.data || {}, cont, {
      onSuccess() {
        if (esRetoDeHoy) {
          recordCompletion(reto);
          pintarRacha();
          pintarSalaDeHoy();   // el carné y la racha reflejan ya el reto de hoy
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

// --- ARRANQUE ---
// Sin `?fecha=` la portada es la sala; el router solo monta un reto cuando se
// pide uno concreto o cuando se pulsa "Empezar serie".
const hayFecha = new URLSearchParams(window.location.search).has('fecha');
pintarRacha();
if (hayFecha) {
  router.renderCurrent();
} else {
  pintarSalaDeHoy();
}

// --- INTERCEPTA EL CLICK EN “ENTRENAR AHORA” ---
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action="entrenar"]');
  if (!btn) return;

  ev.preventDefault();
  console.log('🎯 Click en Entrenar detectado');
  history.pushState({}, '', './');
  router.renderCurrent();
}, { capture: true });
