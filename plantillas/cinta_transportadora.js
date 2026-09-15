// ===== plantillas/cinta_transportadora.js =====
// La Ronda Espacial · Josephus inverso, vestido de estación orbital: los
// personajes (assets/espacio/personaje-N.svg) sustituyen a las cajas y la
// nave sustituye al brazo. La simulación (simulaSalida) vive en
// scripts/cinta-transportadora-logic.js, compartida con el generador y el
// validador: los tres tienen que estar de acuerdo en qué sale y en qué
// orden -- el reskin de aquí no toca esa lógica, solo el pintado.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { simulaSalida, ordenEliminacion } from '../scripts/cinta-transportadora-logic.js';

const RETRASO_ROTACION_MS = 420;
const RETRASO_PAUSA_MS = 220;
const RETRASO_PASO_MS = RETRASO_ROTACION_MS + RETRASO_PAUSA_MS;
const RETRASO_VUELO_MS = 480;
const N_PERSONAJES = 10;

function personajeUrl(id) {
  return `assets/espacio/personaje-${((id - 1) % N_PERSONAJES) + 1}.svg`;
}

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
      <p><strong>Objetivo:</strong> coloca los ${nCajas} personajes en las cápsulas de la estación para que la nave los entregue en el orden que marca la fila de siluetas bajo la estación.</p>
      <ul>
        <li>La nave gira en sentido horario (como las agujas del reloj).</li>
        <li>Empieza apuntando a la cápsula 1, sin recogerla todavía.</li>
        <li>Salta ${patronSalto} cápsula${patronSalto === 1 ? '' : 's'} con personaje sin recogerlo${patronSalto === 1 ? '' : 's'}.</li>
        <li>Una cápsula ya vaciada no cuenta para ese salto.</li>
        <li>Para en la siguiente cápsula con personaje y lo recoge.</li>
        <li>Repite el salto y la recogida hasta recogerlos todos.</li>
        <li>Toca un personaje de la bandeja y luego una cápsula vacía para colocarlo.</li>
        <li>Toca una cápsula ya ocupada para devolver ese personaje a la bandeja.</li>
        <li>Pulsa «Iniciar» cuando la estación esté completa.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'cinta-info' });
  infoLine.textContent = `${nCajas} personajes · recoge 1, salta ${patronSalto}`;
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
    const retrato = createElement('img', { class: 'cinta-hueco-retrato', alt: '' });
    hueco.appendChild(retrato);
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
  bandejaLabel.textContent = 'Personajes por colocar';
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

  // La fila de siluetas es el objetivo YA colocado junto al tablero: un
  // slot por posición de ordenObjetivo, precargado con la silueta (sombra)
  // del personaje esperado ahí. revelarSlot() lo colorea al llegar la nave.
  function pintarSalidaSlots() {
    salidaWrap.innerHTML = '';
    ordenObjetivo.forEach((esperado) => {
      const slot = createElement('div', { class: 'cinta-salida-slot' });
      const img = createElement('img', { class: 'cinta-salida-silueta', src: personajeUrl(esperado), alt: '' });
      slot.appendChild(img);
      salidaWrap.appendChild(slot);
    });
  }

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
      const retrato = createElement('img', { class: 'cinta-caja-retrato', src: personajeUrl(caja), alt: '' });
      tile.appendChild(retrato);
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
    const retrato = hueco.querySelector('.cinta-hueco-retrato');
    const numero = hueco.querySelector('.cinta-hueco-num');
    const caja = colocacion[i];
    if (caja != null) {
      retrato.src = personajeUrl(caja);
    } else {
      retrato.removeAttribute('src');
      numero.textContent = i + 1;
    }
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
      setStatus(ui.result, `Coloca los ${cajasDisponibles.size} personaje${cajasDisponibles.size === 1 ? '' : 's'} que faltan.`, '');
    } else {
      setStatus(ui.result, 'Estación completa. Pulsa «Iniciar» para comprobar.', '');
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
    pintarSalidaSlots();
    huecos.forEach((h) => h.classList.remove('volteando', 'vaciado'));
    apuntarBrazo(0, { animar: false });
    pintarBandeja();
    actualizarMensaje();
  });

  btnIniciar.addEventListener('click', async () => {
    if (ganado || corriendo) return;
    if (cajasDisponibles.size > 0) {
      setStatus(ui.result, 'Completa la estación antes de pulsar Iniciar', 'ko');
      return;
    }

    corriendo = true;
    btnIniciar.disabled = true;
    btnReiniciar.disabled = true;
    pintarSalidaSlots();
    huecos.forEach((h) => h.classList.remove('volteando', 'vaciado'));
    setStatus(ui.result, 'La nave está en marcha...', '');

    // ordenEliminacion depende solo de n y m, no de qué caja hay en cada
    // hueco -- es el mismo recorrido circular que usa simulaSalida, así que
    // sirve para saber a qué hueco apuntar en cada paso de la animación.
    const posiciones = ordenEliminacion(nCajas, m);
    const salidaReal = [];
    for (const [step, posUno] of posiciones.entries()) {
      const idx = posUno - 1;
      apuntarBrazo(idx);
      await esperar(RETRASO_ROTACION_MS);

      huecos[idx].classList.add('volteando');
      const caja = colocacion[idx];
      salidaReal.push(caja);
      volarFichaAlaSalida(huecos[idx], caja, salidaWrap.children[step], ordenObjetivo[step]);
      await esperar(RETRASO_PAUSA_MS);

      huecos[idx].classList.remove('volteando');
      huecos[idx].classList.add('vaciado');
    }

    const acierto = salidaReal.length === ordenObjetivo.length
      && salidaReal.every((caja, i) => caja === ordenObjetivo[i]);

    if (acierto) {
      ganado = true;
      setStatus(ui.result, `¡Ronda perfecta en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: `Entregaste a los ${nCajas} personajes en el orden pedido` });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      btnIniciar.disabled = true;
      huecos.forEach((h) => { h.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, `Llegaron en ${salidaReal.join(', ')}. No es el orden pedido -- reordena y prueba otra vez.`, 'ko');
      btnIniciar.disabled = false;
      btnReiniciar.disabled = false;
    }
    corriendo = false;
  });

  pintarBandeja();
  huecos.forEach((_, i) => pintarHueco(i));
  pintarSalidaSlots();
  setStatus(ui.status, 'Listo para colocar', 'ok');
  actualizarMensaje();
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function revelarSlot(slotEl, caja, esperado) {
  const img = slotEl.querySelector('img');
  img.src = personajeUrl(caja);
  img.classList.remove('cinta-salida-silueta');
  img.classList.add('cinta-salida-real');
  slotEl.classList.add(caja === esperado ? 'correcto' : 'incorrecto');
}

// Retrato "volador": vuela del hueco de origen al slot de silueta que le
// corresponde (mismo índice de paso que ordenObjetivo) con getBoundingClientRect
// y position:fixed -- FLIP sencillo, sin librería. Al llegar, revela ese slot
// con revelarSlot (que decide si el personaje llegado coincide con la silueta).
function volarFichaAlaSalida(huecoEl, caja, slotEl, esperado) {
  const origen = huecoEl.getBoundingClientRect();
  const destino = slotEl.getBoundingClientRect();

  const volando = createElement('img', { class: 'cinta-ficha-volando', src: personajeUrl(caja), alt: '' });
  volando.style.width = `${destino.width}px`;
  volando.style.height = `${destino.height}px`;
  volando.style.left = `${origen.left + origen.width / 2 - destino.width / 2}px`;
  volando.style.top = `${origen.top + origen.height / 2 - destino.height / 2}px`;
  document.body.appendChild(volando);
  void volando.offsetHeight; // fuerza reflow antes de animar

  volando.style.transition = `left ${RETRASO_VUELO_MS}ms cubic-bezier(.3,0,.2,1), top ${RETRASO_VUELO_MS}ms cubic-bezier(.3,0,.2,1)`;
  volando.style.left = `${destino.left}px`;
  volando.style.top = `${destino.top}px`;

  setTimeout(() => {
    volando.remove();
    revelarSlot(slotEl, caja, esperado);
  }, RETRASO_VUELO_MS);
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
