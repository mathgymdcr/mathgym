// ===== muestrario.js =====
// Vitrina de los tipos de reto: una ficha por tipo con su ejemplo real
// montado con la misma plantilla que usa el reto del día.
//
// Los puzzles se montan solo cuando la ficha entra en pantalla: montar los
// trece de golpe carga el DOM con varios tableros grandes a la vez sin que
// nadie los esté mirando.
//
// Con ?debug=1 la página añade un panel de diagnóstico: cuántas plantillas
// montan bien, cuáles fallan y con qué error, más el JSON que ha usado cada
// una. Sustituye a las antiguas diag.html y enigma_demo.html.

import './plantillas/base.js';
import { TIPOS } from './catalogo-tipos.js';

const debug = new URLSearchParams(location.search).get('debug') === '1';
const grid = document.getElementById('muestrario');
const panel = document.getElementById('diagnostico');
const estados = new Map();

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function pintarDiagnostico() {
  if (!debug) return;
  const total = TIPOS.length;
  const ok = [...estados.values()].filter((e) => e.estado === 'ok').length;
  const fallos = [...estados.entries()].filter(([, e]) => e.estado === 'error');
  const pendientes = total - estados.size;

  panel.hidden = false;
  panel.innerHTML = '';
  const resumen = crear('p', fallos.length ? 'feedback ko' : 'feedback ok',
    `${ok}/${total} plantillas montadas${pendientes ? ` · ${pendientes} sin montar todavía (baja para cargarlas)` : ''}` +
    (fallos.length ? ` · ${fallos.length} con error` : ''));
  panel.appendChild(resumen);

  for (const [tipo, e] of fallos) {
    panel.appendChild(crear('p', 'muestrario-error', `${tipo}: ${e.error}`));
  }
}

function ficha(t) {
  const card = crear('article', 'card muestrario-card');
  card.id = `tipo-${t.tipo}`;

  const cabecera = crear('div', 'muestrario-card-head');
  cabecera.appendChild(crear('span', 'muestrario-emoji', t.emoji));
  const titulos = crear('div', 'muestrario-titulos');
  titulos.appendChild(crear('h3', null, t.nombre));
  titulos.appendChild(crear('p', 'muestrario-resumen', t.resumen));
  cabecera.appendChild(titulos);
  card.appendChild(cabecera);

  const etiquetas = crear('div', 'muestrario-etiquetas');
  etiquetas.appendChild(crear('span', 'muestrario-tag', t.generado ? 'Sale en el reto diario' : 'Plantilla en preparación'));
  if (debug) etiquetas.appendChild(crear('code', 'muestrario-tag muestrario-tag-tipo', t.tipo));
  card.appendChild(etiquetas);

  const host = crear('div', 'muestrario-host');
  host.appendChild(crear('p', 'muestrario-cargando', 'Cargando ejemplo…'));
  card.appendChild(host);

  return { card, host };
}

async function montar(t, host) {
  const arranque = performance.now();
  try {
    const r = await fetch(`data/muestra/${t.tipo}.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} al leer data/muestra/${t.tipo}.json`);
    const data = await r.json();

    host.innerHTML = '';
    // hooks vacíos a propósito: un ejemplo del muestrario no toca la racha
    // ni el progreso del jugador.
    await window.Templates.render(t.tipo, data, host, {});

    if (host.innerHTML.includes('Error al cargar la plantilla')) {
      throw new Error('la plantilla no llegó a montar (ver consola)');
    }
    estados.set(t.tipo, { estado: 'ok', ms: Math.round(performance.now() - arranque) });

    if (debug) {
      const pie = crear('details', 'muestrario-debug');
      pie.appendChild(crear('summary', null, `montada en ${estados.get(t.tipo).ms} ms · ver JSON`));
      pie.appendChild(crear('pre', null, JSON.stringify(data, null, 2)));
      host.appendChild(pie);
    }
  } catch (err) {
    estados.set(t.tipo, { estado: 'error', error: err.message });
    host.innerHTML = '';
    host.appendChild(crear('p', 'feedback ko', `No se pudo cargar el ejemplo: ${err.message}`));
    const reintentar = crear('button', 'btn btn-secondary', 'Reintentar');
    reintentar.addEventListener('click', () => {
      host.innerHTML = '';
      host.appendChild(crear('p', 'muestrario-cargando', 'Cargando ejemplo…'));
      montar(t, host);
    });
    host.appendChild(reintentar);
  }
  pintarDiagnostico();
}

const observador = 'IntersectionObserver' in window
  ? new IntersectionObserver((entradas, obs) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        obs.unobserve(entrada.target);
        const t = TIPOS.find((x) => `tipo-${x.tipo}` === entrada.target.id);
        montar(t, entrada.target.querySelector('.muestrario-host'));
      }
    }, { rootMargin: '200px' })
  : null;

const fichas = TIPOS.map((t) => {
  const { card, host } = ficha(t);
  grid.appendChild(card);
  return { t, card, host };
});

// Primera pasada explícita sobre lo que ya se ve al abrir la página: el
// observador solo avisa de forma fiable cuando algo ENTRA en pantalla, y
// dejaba las fichas de arriba en "Cargando ejemplo..." hasta que el visitante
// hacía scroll.
function visible(el) {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight + 200 && r.bottom > -200;
}

for (const f of fichas) {
  if (!observador || visible(f.card)) {
    if (observador) observador.unobserve(f.card);
    montar(f.t, f.host);
  } else {
    observador.observe(f.card);
  }
}

pintarDiagnostico();
