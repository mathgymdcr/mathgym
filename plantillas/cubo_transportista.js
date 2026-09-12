// ===== plantillas/cubo_transportista.js =====
// El Cubo Transportista. Las reglas de rodar (`rollCube`) viven en
// scripts/cubo-logic.js, compartidas con el generador y el validador: los
// tres tienen que estar de acuerdo en qué orientación resulta de cada
// movimiento.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { rollCube } from '../scripts/cubo-logic.js';

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
  const inicio = config.inicio;
  const meta = config.meta;
  const minimo = config.minimo;

  if (!n || !inicio || !meta || !Number.isInteger(minimo)) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de cubo transportista sin datos válidos</div>';
    return;
  }

  const ui = buildStandardShell({
    tipo: 'cubo-transportista',
    gameClass: 'cubo-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> lleva el cubo hasta la meta mostrando la cara <strong>${meta.cara}</strong> hacia arriba.</p>
      <ul>
        <li>El cubo empieza en la celda marcada con un punto.</li>
        <li>La meta es la celda con el número grande.</li>
        <li>Cada flecha hace rodar el cubo una celda en esa dirección.</li>
        <li>Al rodar, el cubo vuelca: sus caras cambian de posición.</li>
        <li>El número grande en el cubo es la cara que mira hacia arriba.</li>
        <li>Los números pequeños son las caras norte, sur, este y oeste.</li>
        <li>Se puede hacer en ${minimo} movimiento${minimo === 1 ? '' : 's'}.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'cubo-info' });
  infoLine.textContent = `${n}x${n} · mínimo ${minimo} movimiento${minimo === 1 ? '' : 's'}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'cubo-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  let posicion = { f: inicio.f, c: inicio.c };
  let orientacion = inicio.orientacion;
  let movimientos = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('div', { class: 'cubo-celda' });
      if (f === meta.f && c === meta.c) {
        celda.classList.add('meta');
        const numero = createElement('span', { class: 'cubo-meta-num' });
        numero.textContent = meta.cara;
        celda.appendChild(numero);
      } else if (f === inicio.f && c === inicio.c) {
        celda.classList.add('inicio');
      }
      tablero.appendChild(celda);
      celdas[f][c] = celda;
    }
  }
  ui.box.appendChild(tablero);

  const cuboWrap = createElement('div', { class: 'cubo-figura' });
  const caraArriba = createElement('div', { class: 'cubo-cara cubo-cara-arriba' });
  const caraNorte = createElement('div', { class: 'cubo-cara cubo-cara-norte' });
  const caraSur = createElement('div', { class: 'cubo-cara cubo-cara-sur' });
  const caraEste = createElement('div', { class: 'cubo-cara cubo-cara-este' });
  const caraOeste = createElement('div', { class: 'cubo-cara cubo-cara-oeste' });
  cuboWrap.appendChild(caraNorte);
  cuboWrap.appendChild(caraOeste);
  cuboWrap.appendChild(caraArriba);
  cuboWrap.appendChild(caraEste);
  cuboWrap.appendChild(caraSur);
  ui.box.appendChild(cuboWrap);

  function pintarCubo() {
    caraArriba.textContent = orientacion.U;
    caraNorte.textContent = orientacion.N;
    caraSur.textContent = orientacion.S;
    caraEste.textContent = orientacion.E;
    caraOeste.textContent = orientacion.O;

    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) celdas[f][c].classList.remove('con-cubo');
    }
    celdas[posicion.f][posicion.c].classList.add('con-cubo');
  }

  function actualizarMensaje() {
    if (ganado) return;
    setStatus(ui.result, `Movimientos: ${movimientos}`, '');
  }

  const controles = createElement('div', { class: 'cubo-controles' });
  const btnN = createElement('button', { class: 'cubo-flecha cubo-flecha-n', type: 'button' });
  btnN.textContent = '↑';
  const btnO = createElement('button', { class: 'cubo-flecha cubo-flecha-o', type: 'button' });
  btnO.textContent = '←';
  const btnE = createElement('button', { class: 'cubo-flecha cubo-flecha-e', type: 'button' });
  btnE.textContent = '→';
  const btnS = createElement('button', { class: 'cubo-flecha cubo-flecha-s', type: 'button' });
  btnS.textContent = '↓';
  controles.appendChild(btnN);
  controles.appendChild(btnO);
  controles.appendChild(btnE);
  controles.appendChild(btnS);
  ui.box.appendChild(controles);

  function mover(direccion, df, dc) {
    if (ganado) return;
    const f = posicion.f + df;
    const c = posicion.c + dc;
    if (f < 0 || f >= n || c < 0 || c >= n) return;

    posicion = { f, c };
    orientacion = rollCube(orientacion, direccion);
    movimientos++;
    pintarCubo();
    actualizarMensaje();

    if (posicion.f === meta.f && posicion.c === meta.c && orientacion.U === meta.cara) {
      ganado = true;
      const dentroDelPar = movimientos <= minimo;
      setStatus(
        ui.result,
        dentroDelPar
          ? `¡Meta en ${movimientos} movimiento${movimientos === 1 ? '' : 's'}, igualando el mínimo!`
          : `¡Meta en ${movimientos} movimientos! El mínimo era ${minimo}.`,
        'ok'
      );
      celebrate({ ok: true, message: 'Llevaste el cubo hasta la meta' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos });
      [btnN, btnS, btnE, btnO].forEach((b) => { b.disabled = true; });
    }
  }

  btnN.addEventListener('click', () => mover('N', -1, 0));
  btnS.addEventListener('click', () => mover('S', 1, 0));
  btnE.addEventListener('click', () => mover('E', 0, 1));
  btnO.addEventListener('click', () => mover('O', 0, -1));

  setStatus(ui.status, 'Listo para empezar', 'ok');
  pintarCubo();
  actualizarMensaje();
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración del cubo transportista');
}
