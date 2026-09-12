// ===== plantillas/fabrica_bloques.js =====
// Fábrica de Bloques · KenKen/Calcudoku. La generación (cuadrado latino +
// regiones + comprobación de solución única) vive en scripts/fabrica-logic.js,
// compartida con el generador y el validador -- la plantilla solo pinta y
// compara contra `solucion`, nunca re-decide si el reto es solvente.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const SIMBOLO_OP = { suma: '+', resta: '−', multiplicacion: '×', division: '÷' };

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
  const regiones = Array.isArray(config.regiones) ? config.regiones : null;
  const solucion = Array.isArray(config.solucion) ? config.solucion : null;

  if (!n || !regiones || !solucion) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de fábrica de bloques sin datos válidos</div>';
    return;
  }

  // Region de cada celda (por referencia de objeto, para saber cuándo dos
  // celdas vecinas pertenecen a la misma región al pintar los bordes).
  const regionDeCelda = Array.from({ length: n }, () => Array(n).fill(null));
  regiones.forEach((region) => {
    region.celdas.forEach(([f, c]) => { regionDeCelda[f][c] = region; });
  });

  // La pista (operación+objetivo) se pinta solo en la celda de la región
  // que va primero en orden de lectura -- no hace falta repetirla en todas.
  const etiquetaDeCelda = new Map();
  for (const region of regiones) {
    if (region.operacion === null) continue; // las de una celda son "dadas", sin pista que pintar
    const [f, c] = [...region.celdas].sort((a, b) => (a[0] * n + a[1]) - (b[0] * n + b[1]))[0];
    etiquetaDeCelda.set(`${f},${c}`, `${region.objetivo}${SIMBOLO_OP[region.operacion]}`);
  }

  const ui = buildStandardShell({
    tipo: 'fabrica-de-bloques',
    gameClass: 'fabrica-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> rellena la rejilla de ${n}x${n} con dígitos del 1 al ${n} sin repetir ninguno en la misma fila ni en la misma columna.</p>
      <p>Cada región (el grupo de celdas con el mismo borde grueso) lleva en su esquina una pista como «12+» o «6×»: combinando con esa operación los dígitos que pongas en TODAS sus celdas tienes que llegar exactamente a ese número. Las celdas sin pista y sin operación ya vienen con su dígito fijado.</p>
      <p>Toca una celda vacía y luego un número del panel para escribirlo; toca el mismo número otra vez (o «borrar») para vaciarla. Pulsa <strong>«Comprobar»</strong> cuando la rejilla esté completa.</p>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'fabrica-info' });
  infoLine.textContent = `${n}x${n} · ${regiones.length} región${regiones.length === 1 ? '' : 'es'}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'fabrica-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  const valores = Array.from({ length: n }, () => Array(n).fill(0));
  const fijadas = Array.from({ length: n }, () => Array(n).fill(false));
  for (const region of regiones) {
    if (region.operacion === null) {
      const [f, c] = region.celdas[0];
      valores[f][c] = region.objetivo;
      fijadas[f][c] = true;
    }
  }

  let seleccion = null;
  let fallos = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'fabrica-celda', type: 'button' });
      const region = regionDeCelda[f][c];
      if (c === 0 || regionDeCelda[f][c - 1] !== region) celda.classList.add('borde-izq');
      if (c === n - 1 || regionDeCelda[f][c + 1] !== region) celda.classList.add('borde-der');
      if (f === 0 || regionDeCelda[f - 1][c] !== region) celda.classList.add('borde-arriba');
      if (f === n - 1 || regionDeCelda[f + 1][c] !== region) celda.classList.add('borde-abajo');

      const etiqueta = etiquetaDeCelda.get(`${f},${c}`);
      if (etiqueta) {
        const pista = createElement('span', { class: 'fabrica-celda-pista' });
        pista.textContent = etiqueta;
        celda.appendChild(pista);
      }

      const valorSpan = createElement('span', { class: 'fabrica-celda-valor' });
      celda.appendChild(valorSpan);

      if (fijadas[f][c]) {
        celda.classList.add('fija');
        celda.disabled = true;
        valorSpan.textContent = valores[f][c];
      } else {
        celda.addEventListener('click', () => {
          if (ganado) return;
          seleccion = [f, c];
          pintarSeleccion();
        });
      }

      tablero.appendChild(celda);
      celdas[f][c] = { celda, valorSpan };
    }
  }
  ui.box.appendChild(tablero);

  function pintarSeleccion() {
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        celdas[f][c].celda.classList.toggle(
          'seleccionada',
          !!seleccion && seleccion[0] === f && seleccion[1] === c
        );
      }
    }
  }

  const numpad = createElement('div', { class: 'fabrica-numpad' });
  for (let v = 1; v <= n; v++) {
    const boton = createElement('button', { class: 'fabrica-num', type: 'button' });
    boton.textContent = v;
    boton.addEventListener('click', () => {
      if (ganado || !seleccion) return;
      const [f, c] = seleccion;
      if (fijadas[f][c]) return;
      valores[f][c] = valores[f][c] === v ? 0 : v;
      celdas[f][c].valorSpan.textContent = valores[f][c] || '';
      actualizarMensaje();
    });
    numpad.appendChild(boton);
  }
  const btnBorrar = createElement('button', { class: 'fabrica-num fabrica-num-borrar', type: 'button' });
  btnBorrar.textContent = 'Borrar';
  btnBorrar.addEventListener('click', () => {
    if (ganado || !seleccion) return;
    const [f, c] = seleccion;
    if (fijadas[f][c]) return;
    valores[f][c] = 0;
    celdas[f][c].valorSpan.textContent = '';
    actualizarMensaje();
  });
  numpad.appendChild(btnBorrar);
  ui.box.appendChild(numpad);

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  ui.box.appendChild(controles);

  function actualizarMensaje() {
    if (ganado) return;
    const vacias = valores.reduce((total, fila) => total + fila.filter((v) => v === 0).length, 0);
    if (vacias > 0) {
      setStatus(ui.result, `Faltan ${vacias} celda${vacias === 1 ? '' : 's'} por rellenar.`, '');
    } else {
      setStatus(ui.result, 'Rejilla completa. Pulsa «Comprobar».', '');
    }
  }

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;
    const vacio = valores.some((fila) => fila.some((v) => v === 0));
    if (vacio) {
      setStatus(ui.result, 'Completa todas las celdas antes de comprobar', 'ko');
      return;
    }

    const correcto = valores.every((fila, f) => fila.every((v, c) => v === solucion[f][c]));

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Rejilla correcta en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Completaste la Fábrica de Bloques' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) celdas[f][c].celda.disabled = true;
      }
    } else {
      fallos++;
      setStatus(ui.result, 'Todavía hay algo que no cuadra -- revisa filas, columnas y regiones.', 'ko');
    }
  });

  setStatus(ui.status, 'Listo para empezar', 'ok');
  actualizarMensaje();
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración de la fábrica de bloques');
}
