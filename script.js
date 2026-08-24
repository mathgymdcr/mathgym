// ===== script.js =====
import './plantillas/base.js';
import { initRouter } from './router.js';
import { recordCompletion, getProgress } from './progress.js';
import { estrellasDe, parDe } from './estrellas.js';
import { pintarEstrellas } from './plantillas/celebration.js';
import { pintarSala } from './home.js';
import { tipoInfo } from './catalogo-tipos.js';

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

// --- CARGA DE DATOS ---
async function loadReto(fecha) {
  const ruta = fecha ? `retos/${encodeURIComponent(fecha)}.json` : 'reto.json';
  const r = await fetch(ruta, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function loadMuestra(tipo) {
  const r = await fetch(`data/muestra/${encodeURIComponent(tipo)}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status} al leer el ejemplo de ${tipo}`);
  return r.json();
}

// --- CAMBIO DE VISTA ---
// La sala y el tablero comparten pantalla: solo uno está visible a la vez.
function mostrarZonaDeJuego(visible) {
  const cont = $('contenedor-interactivo');
  const sala = $('sala');
  if (cont) cont.style.display = visible ? 'block' : 'none';
  if (sala) sala.style.display = visible ? 'none' : '';
  return cont;
}

// --- SALA DE ENTRENAMIENTO (la portada) ---
// Se pinta con el reto del día ya cargado, para poder anunciar cuál es antes
// de que nadie pulse nada. Si la carga falla, la sala se pinta igual y lo dice
// en la ficha del día.
async function mostrarSala() {
  mostrarZonaDeJuego(false);
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

// La meta del reto, encima del tablero. Hasta ahora el mínimo solo se veía en
// la ficha de la sala (antes de jugar) y escondido en una pista; teniéndolo
// delante, cada plantilla con su propio contador de movimientos ya dice a qué
// distancia vas. Los tipos que se miden por fallos no tienen meta que enseñar:
// "0 fallos de 0" antes de fallar no dice nada.
function pintarMeta(cont, reto) {
  const par = parDe(reto.objectives);
  if (!par) return;
  const meta = document.createElement('p');
  meta.className = 'meta-reto';
  meta.innerHTML = `Las <strong>3 estrellas</strong> son para quien lo resuelva en `
    + `<strong>${par.valor} ${par.unidad}</strong>.`;
  cont.prepend(meta);
}

// --- RETO ---
async function mostrarReto(fecha) {
  const reto = await loadReto(fecha);
  const esRetoDeHoy = !fecha;
  const cont = mostrarZonaDeJuego(true);
  if (!cont) {
    console.error('❌ Falta #contenedor-interactivo en el HTML');
    return;
  }

  cont.innerHTML = '<div class="skeleton">Cargando…</div>';

  try {
    await window.Templates.render(reto.tipo, reto.data || {}, cont, {
      // `marca` es lo que ha hecho quien juega, en la unidad que cuenta el par
      // de su tipo: { movimientos }, { pesadas } o { fallos }.
      onSuccess(marca) {
        const estrellas = estrellasDe(reto.objectives, marca);
        pintarEstrellas(estrellas);
        if (esRetoDeHoy) {
          recordCompletion(reto, estrellas);
          pintarRacha();
        }
      }
    });
    pintarMeta(cont, reto);
  } catch (err) {
    cont.innerHTML = `<p class="error">Error al cargar el reto (${reto.tipo}): ${err.message}</p>`;
    console.error('❌ Error cargando plantilla:', err);
  }
}

// --- EJEMPLO DE PRUEBA ---
// El mismo payload fijo que enseñaba el muestrario, montado con la plantilla
// real. Los hooks van vacíos a propósito: un ejemplo no toca la racha ni el
// progreso por mucho que se resuelva.
async function mostrarEjemplo(tipo) {
  const cont = mostrarZonaDeJuego(true);
  if (!cont) return;

  cont.innerHTML = '<div class="skeleton">Cargando ejemplo…</div>';
  const nombre = tipoInfo(tipo).nombre;

  const barra = document.createElement('div');
  barra.className = 'aviso-ejemplo';
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'btn btn-secondary';
  volver.dataset.action = 'volver';
  volver.textContent = '← Volver a la sala';
  const texto = document.createElement('p');
  texto.textContent = `Ejemplo de ${nombre}: es siempre el mismo, no gasta el reto de hoy ni cuenta para tu racha.`;
  barra.appendChild(volver);
  barra.appendChild(texto);

  const host = document.createElement('div');

  try {
    const data = await loadMuestra(tipo);
    cont.innerHTML = '';
    cont.appendChild(barra);
    cont.appendChild(host);
    await window.Templates.render(tipo, data, host, {});
  } catch (err) {
    cont.innerHTML = '';
    cont.appendChild(barra);
    const error = document.createElement('p');
    error.className = 'error';
    error.textContent = `No se pudo cargar el ejemplo de ${nombre}: ${err.message}`;
    cont.appendChild(error);
    console.error('❌ Error cargando el ejemplo:', err);
  }
}

// --- ROUTER ---
const router = initRouter({ mostrarSala, mostrarReto, mostrarEjemplo });

pintarRacha();
router.renderCurrent();

// --- NAVEGACIÓN INTERNA ---
// Los enlaces de la sala son <a href="?tipo=..."> de verdad, para que se
// puedan abrir en otra pestaña; aquí se interceptan para no recargar.
document.addEventListener('click', (ev) => {
  const volver = ev.target.closest('[data-action="volver"]');
  if (volver) {
    ev.preventDefault();
    router.navigateTo({});
    return;
  }

  const entrenar = ev.target.closest('[data-action="entrenar"]');
  if (entrenar) {
    ev.preventDefault();
    router.navigateTo({});
    mostrarReto(null);
    return;
  }

  const ejemplo = ev.target.closest('a[data-tipo]');
  if (ejemplo && !ev.metaKey && !ev.ctrlKey && ev.button === 0) {
    ev.preventDefault();
    router.navigateTo({ tipo: ejemplo.dataset.tipo });
  }
}, { capture: true });
