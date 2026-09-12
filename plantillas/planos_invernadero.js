// ===== plantillas/planos_invernadero.js =====
// Planos del Invernadero · Shikaku. La generación (partición en rectángulos
// + una pista de área por rectángulo + comprobación de solución única) vive
// en scripts/invernadero-logic.js. La plantilla no compara contra
// `solucion` celda a celda: comprueba la regla directamente (cobertura
// completa + una pista por módulo con área exacta), así que acepta
// cualquier reparto válido, no solo el que escribió el generador.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const PALETA = ['#3D8BE0', '#E85B4A', '#3DBE7A', '#F8C818', '#D163CC', '#4FB8C4', '#E0973D', '#8C7AE6'];

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
  const pistas = Array.isArray(config.pistas) ? config.pistas : null;

  if (!n || !pistas) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de planos del invernadero sin datos válidos</div>';
    return;
  }

  const pistaEnCelda = new Map();
  for (const p of pistas) pistaEnCelda.set(`${p.f},${p.c}`, p.valor);

  const ui = buildStandardShell({
    tipo: 'planos-del-invernadero',
    gameClass: 'invernadero-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> divide la rejilla de ${n}x${n} en módulos rectangulares -- uno por cada pista -- de forma que el área de cada módulo (en celdas) sea exactamente el número de su pista.</p>
      <p>Cada módulo tiene que contener EXACTAMENTE una pista, y entre todos tienen que cubrir el tablero completo sin solaparse.</p>
      <p>Toca una celda para marcar la primera esquina de un módulo, y toca otra para marcar la esquina opuesta: se rellena el rectángulo entre ambas. Toca cualquier celda de un módulo ya trazado para deshacerlo. Pulsa <strong>«Comprobar»</strong> cuando la rejilla esté completa.</p>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'invernadero-info' });
  infoLine.textContent = `${n}x${n} · ${pistas.length} pista${pistas.length === 1 ? '' : 's'}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'invernadero-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  const dueño = Array.from({ length: n }, () => Array(n).fill(null));
  const rectangulos = new Map(); // id -> {f,c,ancho,alto}
  let siguienteId = 1;
  let anclaje = null; // [f,c] o null
  let fallos = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'invernadero-celda', type: 'button' });
      const valorPista = pistaEnCelda.get(`${f},${c}`);
      const numero = createElement('span', { class: 'invernadero-celda-num' });
      if (valorPista != null) numero.textContent = valorPista;
      celda.appendChild(numero);

      celda.addEventListener('click', () => onClickCelda(f, c));

      tablero.appendChild(celda);
      celdas[f][c] = celda;
    }
  }
  ui.box.appendChild(tablero);

  function quitarRectangulo(id) {
    const r = rectangulos.get(id);
    if (!r) return;
    for (let f = r.f; f < r.f + r.alto; f++) {
      for (let c = r.c; c < r.c + r.ancho; c++) dueño[f][c] = null;
    }
    rectangulos.delete(id);
  }

  function onClickCelda(f, c) {
    if (ganado) return;

    const idActual = dueño[f][c];
    if (idActual != null) {
      quitarRectangulo(idActual);
      anclaje = null;
      pintar();
      actualizarMensaje();
      return;
    }

    if (!anclaje) {
      anclaje = [f, c];
      pintar();
      return;
    }

    const [af, ac] = anclaje;
    // Volver a tocar la propia ancla confirma un módulo de 1 sola celda
    // (muy habitual: cualquier pista de valor 1) -- si cancelara en vez de
    // confirmar, esas pistas no se podrían trazar nunca con dos toques.
    const f0 = Math.min(af, f);
    const f1 = Math.max(af, f);
    const c0 = Math.min(ac, c);
    const c1 = Math.max(ac, c);

    for (let ff = f0; ff <= f1; ff++) {
      for (let cc = c0; cc <= c1; cc++) {
        if (dueño[ff][cc] != null) {
          setStatus(ui.result, 'Esa zona ya pertenece a otro módulo.', 'ko');
          anclaje = null;
          pintar();
          return;
        }
      }
    }

    const id = siguienteId++;
    for (let ff = f0; ff <= f1; ff++) {
      for (let cc = c0; cc <= c1; cc++) dueño[ff][cc] = id;
    }
    rectangulos.set(id, { f: f0, c: c0, ancho: c1 - c0 + 1, alto: f1 - f0 + 1 });
    anclaje = null;
    pintar();
    actualizarMensaje();
  }

  function pintar() {
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        const celda = celdas[f][c];
        const id = dueño[f][c];
        celda.style.background = id != null ? PALETA[(id - 1) % PALETA.length] : '';
        celda.classList.toggle('con-modulo', id != null);
        celda.classList.toggle(
          'anclada',
          !!anclaje && anclaje[0] === f && anclaje[1] === c
        );
      }
    }
    btnCancelarAncla.style.display = anclaje ? '' : 'none';
  }

  function actualizarMensaje() {
    if (ganado) return;
    let libres = 0;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) if (dueño[f][c] == null) libres++;
    }
    if (libres > 0) {
      setStatus(ui.result, `Quedan ${libres} celda${libres === 1 ? '' : 's'} sin módulo.`, '');
    } else {
      setStatus(ui.result, 'Tablero completo. Pulsa «Comprobar».', '');
    }
  }

  const btnCancelarAncla = createElement('button', { class: 'btn btn-secondary' });
  btnCancelarAncla.textContent = 'Cancelar selección';
  btnCancelarAncla.style.display = 'none';
  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const btnReiniciar = createElement('button', { class: 'btn btn-secondary' });
  btnReiniciar.textContent = 'Reiniciar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnCancelarAncla);
  controles.appendChild(btnComprobar);
  controles.appendChild(btnReiniciar);
  ui.box.appendChild(controles);

  btnCancelarAncla.addEventListener('click', () => {
    if (ganado || !anclaje) return;
    anclaje = null;
    pintar();
  });

  btnReiniciar.addEventListener('click', () => {
    if (ganado) return;
    [...rectangulos.keys()].forEach((id) => quitarRectangulo(id));
    anclaje = null;
    pintar();
    actualizarMensaje();
  });

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;

    let libres = 0;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) if (dueño[f][c] == null) libres++;
    }
    if (libres > 0) {
      setStatus(ui.result, 'Completa el tablero entero antes de comprobar', 'ko');
      return;
    }

    let correcto = true;
    for (const r of rectangulos.values()) {
      const area = r.ancho * r.alto;
      let pistasDentro = 0;
      let valor = null;
      for (let f = r.f; f < r.f + r.alto; f++) {
        for (let c = r.c; c < r.c + r.ancho; c++) {
          const v = pistaEnCelda.get(`${f},${c}`);
          if (v != null) { pistasDentro++; valor = v; }
        }
      }
      if (pistasDentro !== 1 || valor !== area) { correcto = false; break; }
    }

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Planos correctos en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Completaste los Planos del Invernadero' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      celdas.flat().forEach((celda) => { celda.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, 'Algún módulo no cuadra -- una pista, una sola, con su área exacta.', 'ko');
    }
  });

  setStatus(ui.status, 'Listo para empezar', 'ok');
  pintar();
  actualizarMensaje();
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración de los planos del invernadero');
}
