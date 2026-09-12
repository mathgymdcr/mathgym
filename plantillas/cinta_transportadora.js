// ===== plantillas/cinta_transportadora.js =====
// La Cinta Sin Fin · Josephus inverso. La simulación de la cinta
// (simulaSalida) vive en scripts/cinta-transportadora-logic.js, compartida
// con el generador y el validador: los tres tienen que estar de acuerdo en
// qué sale y en qué orden.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { simulaSalida, ordenEliminacion } from '../scripts/cinta-transportadora-logic.js';

const RETRASO_ROTACION_MS = 300;
const RETRASO_PAUSA_MS = 150;
const RETRASO_PASO_MS = RETRASO_ROTACION_MS + RETRASO_PAUSA_MS;

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const nCajas = Number.isInteger(config.n_cajas) && config.n_cajas > 0 ? config.n_cajas : 6;
  const patronSalto = Number.isInteger(config.patron_salto) && config.patron_salto >= 0 ? config.patron_salto : 1;
  const ordenObjetivo = Array.isArray(config.orden_objetivo) && config.orden_objetivo.length === nCajas
    ? config.orden_objetivo
    : null;

  if (!ordenObjetivo) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de cinta transportadora sin orden objetivo válido</div>';
    return;
  }

  const m = patronSalto + 1;

  const ui = buildStandardShell({
    tipo: 'cinta-transportadora',
    gameClass: 'cinta-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> coloca las ${nCajas} cajas en los huecos de la cinta para que el brazo las saque en este orden: <strong>${ordenObjetivo.join(', ')}</strong>.</p>
      <p>El brazo empieza en el hueco 1: voltea una caja, se salta ${patronSalto} sin mirar${patronSalto === 1 ? '' : 's'} y voltea la siguiente, dando vueltas a la cinta hasta sacarlas todas.</p>
      <p>Toca una caja de la bandeja y luego un hueco vacío para colocarla. Toca un hueco ya ocupado para devolver esa caja a la bandeja. Pulsa <strong>«Iniciar»</strong> cuando la cinta esté completa.</p>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'cinta-info' });
  infoLine.textContent = `${nCajas} cajas · voltea 1, salta ${patronSalto}`;
  ui.box.appendChild(infoLine);

  const stage = createElement('div', { class: 'cinta-stage' });
  const circulo = createElement('div', { class: 'cinta-circulo' });
  const huecos = [];
  const RADIO_PORCENTAJE = 38;

  // Ángulo (en grados, horario desde el norte) del hueco i-ésimo.
  const anguloHueco = (i) => (i * 360 / nCajas);

  for (let i = 0; i < nCajas; i++) {
    const angulo = -Math.PI / 2 + i * (2 * Math.PI / nCajas);
    const x = 50 + RADIO_PORCENTAJE * Math.cos(angulo);
    const y = 50 + RADIO_PORCENTAJE * Math.sin(angulo);

    const hueco = createElement('button', { class: 'cinta-hueco', type: 'button' });
    hueco.style.left = `${x}%`;
    hueco.style.top = `${y}%`;
    hueco.dataset.posicion = i + 1;
    const numero = createElement('span', { class: 'cinta-hueco-num' });
    numero.textContent = i + 1;
    hueco.appendChild(numero);
    huecos.push(hueco);
    circulo.appendChild(hueco);
  }

  const brazo = createElement('div', { class: 'cinta-brazo' });
  const brazoGarra = createElement('div', { class: 'cinta-brazo-garra' });
  brazo.appendChild(brazoGarra);
  const brazoEje = createElement('div', { class: 'cinta-brazo-eje' });

  // El brazo apunta al hueco 1 (norte) en reposo. rotate(0) apunta al sur,
  // así que hay que restar 180 al rumbo (horario desde el norte) del hueco.
  function apuntarBrazo(i, { animar = true } = {}) {
    brazo.style.transition = animar ? '' : 'none';
    brazo.style.transform = `translateX(-50%) rotate(${anguloHueco(i) - 180}deg)`;
    if (!animar) void brazo.offsetHeight; // fuerza reflow antes de reactivar la transición
  }

  circulo.appendChild(brazo);
  circulo.appendChild(brazoEje);
  apuntarBrazo(0, { animar: false });

  stage.appendChild(circulo);
  ui.box.appendChild(stage);

  const bandejaWrap = createElement('div', { class: 'cinta-bandeja-wrap' });
  const bandejaLabel = createElement('div', { class: 'cinta-bandeja-label' });
  bandejaLabel.textContent = 'Cajas por colocar';
  const bandeja = createElement('div', { class: 'cinta-bandeja' });
  bandejaWrap.appendChild(bandejaLabel);
  bandejaWrap.appendChild(bandeja);
  ui.box.appendChild(bandejaWrap);

  const btnIniciar = createElement('button', { class: 'btn' });
  btnIniciar.textContent = 'Iniciar';
  const btnReiniciar = createElement('button', { class: 'btn btn-secondary' });
  btnReiniciar.textContent = 'Reiniciar colocación';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnIniciar);
  controles.appendChild(btnReiniciar);
  ui.box.appendChild(controles);

  const salidaWrap = createElement('div', { class: 'cinta-salida' });
  ui.box.appendChild(salidaWrap);

  // colocacion[i] = caja en la posicion i+1, o null si esta vacia.
  const colocacion = new Array(nCajas).fill(null);
  const cajasDisponibles = new Set(Array.from({ length: nCajas }, (_, i) => i + 1));
  let seleccionada = null; // caja tomada de la bandeja, pendiente de hueco
  let fallos = 0;
  let ganado = false;
  let corriendo = false;

  function pintarBandeja() {
    bandeja.innerHTML = '';
    for (const caja of [...cajasDisponibles].sort((a, b) => a - b)) {
      const tile = createElement('button', { class: 'cinta-caja', type: 'button' });
      tile.textContent = caja;
      tile.classList.toggle('seleccionada', seleccionada === caja);
      tile.addEventListener('click', () => {
        if (ganado || corriendo) return;
        seleccionada = seleccionada === caja ? null : caja;
        pintarBandeja();
      });
      bandeja.appendChild(tile);
    }
  }

  function pintarHueco(i) {
    const hueco = huecos[i];
    const numero = hueco.querySelector('.cinta-hueco-num');
    const caja = colocacion[i];
    numero.textContent = caja ?? i + 1;
    hueco.classList.toggle('ocupado', caja != null);
  }

  huecos.forEach((hueco, i) => {
    hueco.addEventListener('click', () => {
      if (ganado || corriendo) return;
      if (colocacion[i] != null) {
        // Hueco ocupado: la caja vuelve a la bandeja.
        cajasDisponibles.add(colocacion[i]);
        colocacion[i] = null;
        pintarHueco(i);
        pintarBandeja();
        return;
      }
      if (seleccionada == null) return;
      colocacion[i] = seleccionada;
      cajasDisponibles.delete(seleccionada);
      seleccionada = null;
      pintarHueco(i);
      pintarBandeja();
      actualizarMensaje();
    });
  });

  function actualizarMensaje() {
    if (ganado) return;
    if (cajasDisponibles.size > 0) {
      setStatus(ui.result, `Coloca las ${cajasDisponibles.size} caja${cajasDisponibles.size === 1 ? '' : 's'} que faltan.`, '');
    } else {
      setStatus(ui.result, 'Cinta completa. Pulsa «Iniciar» para comprobar.', '');
    }
  }

  btnReiniciar.addEventListener('click', () => {
    if (ganado || corriendo) return;
    for (let i = 0; i < nCajas; i++) {
      if (colocacion[i] != null) cajasDisponibles.add(colocacion[i]);
      colocacion[i] = null;
      pintarHueco(i);
    }
    seleccionada = null;
    salidaWrap.innerHTML = '';
    huecos.forEach((h) => h.classList.remove('volteando', 'vaciado'));
    apuntarBrazo(0, { animar: false });
    pintarBandeja();
    actualizarMensaje();
  });

  btnIniciar.addEventListener('click', async () => {
    if (ganado || corriendo) return;
    if (cajasDisponibles.size > 0) {
      setStatus(ui.result, 'Completa la cinta antes de pulsar Iniciar', 'ko');
      return;
    }

    corriendo = true;
    btnIniciar.disabled = true;
    btnReiniciar.disabled = true;
    salidaWrap.innerHTML = '';
    huecos.forEach((h) => h.classList.remove('volteando', 'vaciado'));
    setStatus(ui.result, 'La cinta está en marcha...', '');

    // ordenEliminacion depende solo de n y m, no de qué caja hay en cada
    // hueco -- es el mismo recorrido circular que usa simulaSalida, así que
    // sirve para saber a qué hueco apuntar en cada paso de la animación.
    const posiciones = ordenEliminacion(nCajas, m);
    const salidaReal = [];
    for (const posUno of posiciones) {
      const idx = posUno - 1;
      apuntarBrazo(idx);
      await esperar(RETRASO_ROTACION_MS);

      huecos[idx].classList.add('volteando');
      const caja = colocacion[idx];
      salidaReal.push(caja);
      const ficha = createElement('span', { class: 'cinta-salida-ficha' });
      ficha.textContent = caja;
      salidaWrap.appendChild(ficha);
      await esperar(RETRASO_PAUSA_MS);

      huecos[idx].classList.remove('volteando');
      huecos[idx].classList.add('vaciado');
    }

    const acierto = salidaReal.length === ordenObjetivo.length
      && salidaReal.every((caja, i) => caja === ordenObjetivo[i]);

    if (acierto) {
      ganado = true;
      setStatus(ui.result, `¡Cinta perfecta en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: `Sacaste las ${nCajas} cajas en el orden pedido` });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      btnIniciar.disabled = true;
      huecos.forEach((h) => { h.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, `Salió ${salidaReal.join(', ')}. No es el orden pedido -- reordena y prueba otra vez.`, 'ko');
      btnIniciar.disabled = false;
      btnReiniciar.disabled = false;
    }
    corriendo = false;
  });

  pintarBandeja();
  huecos.forEach((_, i) => pintarHueco(i));
  setStatus(ui.status, 'Listo para colocar', 'ok');
  actualizarMensaje();
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && (data.orden_objetivo || data.n_cajas)) return data;
  throw new Error('Faltan datos de configuración de la cinta transportadora');
}
