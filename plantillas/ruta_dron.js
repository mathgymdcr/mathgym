// ===== plantillas/ruta_dron.js =====
// Ruta del Dron. La generación (instrucciones al azar + comprobación de un
// único inicio con la cadena más larga hasta la meta) vive en
// scripts/dron-logic.js, compartida con el generador y el validador --
// misma simulación (`simulaCadena`) en los tres sitios.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { simulaCadena } from '../scripts/dron-logic.js';

const FLECHA = { N: '↑', S: '↓', E: '→', O: '←' };

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const n = config.tablero && config.tablero.ancho;
  const meta = config.meta;
  const instrucciones = config.instrucciones;

  if (!n || !meta || !Array.isArray(instrucciones)) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de ruta del dron sin datos válidos</div>';
    return;
  }

  const ui = buildStandardShell({
    tipo: 'ruta-del-dron',
    gameClass: 'dron-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> encuentra la única baldosa de inicio que llega a la meta con la cadena más larga.</p>
      <ul>
        <li>Cada baldosa tiene una flecha y una distancia.</li>
        <li>Desde una baldosa, salta en esa dirección esa distancia.</li>
        <li>Ahí lees la flecha de la nueva baldosa y saltas otra vez.</li>
        <li>Repite hasta llegar a la meta, salir del tablero o repetir baldosa.</li>
        <li>Varias baldosas llegan a la meta, pero con cadenas más cortas.</li>
        <li>Busca la que tiene la cadena más larga: esa es la respuesta.</li>
        <li>Toca una baldosa para ver su cadena completa marcada.</li>
        <li>Pulsa «Comprobar» con la baldosa marcada como tu respuesta.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'dron-info' });
  infoLine.textContent = `${n}x${n}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'dron-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  let seleccion = null;
  let ganado = false;
  let fallos = 0;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'dron-celda', type: 'button' });

      if (f === meta.f && c === meta.c) {
        celda.classList.add('meta');
        celda.textContent = '🏁';
        celda.disabled = true;
      } else {
        const instr = instrucciones[f][c];
        celda.innerHTML = `<span class="dron-flecha">${FLECHA[instr.direccion]}</span><span class="dron-distancia">${instr.distancia}</span>`;
        celda.addEventListener('click', () => {
          if (ganado) return;
          seleccion = { f, c };
          pintarSeleccion();
        });
      }

      tablero.appendChild(celda);
      celdas[f][c] = celda;
    }
  }
  ui.box.appendChild(tablero);

  function pintarSeleccion() {
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) celdas[f][c].classList.remove('en-ruta', 'seleccionada');
    }
    if (!seleccion) return;

    const { resultado, pasos } = simulaCadena(n, instrucciones, meta, seleccion);
    for (const [f, c] of pasos) celdas[f][c].classList.add('en-ruta');
    celdas[seleccion.f][seleccion.c].classList.add('seleccionada');

    const saltos = pasos.length - 1;
    if (resultado === 'meta') {
      setStatus(ui.result, `Esta cadena llega a la meta en ${saltos} salto${saltos === 1 ? '' : 's'}.`, '');
    } else if (resultado === 'fuera') {
      setStatus(ui.result, 'Esta cadena se sale del tablero.', '');
    } else {
      setStatus(ui.result, 'Esta cadena entra en un bucle sin llegar a la meta.', '');
    }
  }

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  ui.box.appendChild(controles);

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;
    if (!seleccion) {
      setStatus(ui.result, 'Toca primero una baldosa para marcarla como tu respuesta.', 'ko');
      return;
    }

    const correcto = config.solucion && seleccion.f === config.solucion.f && seleccion.c === config.solucion.c;

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Ruta encontrada en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Encontraste la ruta del dron' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      celdas.flat().forEach((celda) => { celda.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, 'Esa no es la baldosa con la cadena más larga -- sigue buscando.', 'ko');
    }
  });

  setStatus(ui.status, 'Listo para empezar', 'ok');
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración de la ruta del dron');
}
