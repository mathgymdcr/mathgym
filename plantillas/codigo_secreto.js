// ===== plantillas/codigo_secreto.js =====
// Código Secreto · Mastermind. La comparación de un intento (aciertos
// exactos / de color) vive en scripts/codigo-secreto-logic.js, no aquí: la
// comparte el generador, el validador y esta plantilla para que los tres
// midan un intento exactamente igual (mismo patrón que laser-triangular con
// su trazador).

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { PALETA, comparaCombinacion } from '../scripts/codigo-secreto-logic.js';

const EMOJI_COLOR = {
  rojo: '🔴', azul: '🔵', verde: '🟢', amarillo: '🟡',
  morado: '🟣', naranja: '🟠', marron: '🟤', negro: '⚫'
};

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const longitud = Number.isInteger(config.longitud) && config.longitud > 0 ? config.longitud : 4;
  const coloresDisponibles = Number.isInteger(config.colores_disponibles) && config.colores_disponibles > 0
    ? Math.min(config.colores_disponibles, PALETA.length)
    : Math.min(6, PALETA.length);
  const permiteRepeticion = config.permite_repeticion !== false;
  const solucion = Array.isArray(config.solucion) && config.solucion.length === longitud
    ? config.solucion
    : null;

  if (!solucion) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de código secreto sin solución válida</div>';
    return;
  }

  const paleta = PALETA.slice(0, coloresDisponibles);

  const ui = buildStandardShell({
    tipo: 'codigo-secreto',
    gameClass: 'codigo-secreto-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> descubre la combinación oculta de ${longitud} colores.</p>
      <p>Toca una casilla del intento para seleccionarla y luego un color de la paleta para colocarlo${permiteRepeticion ? ' (un color puede repetirse dentro del código)' : ' (cada color aparece como mucho una vez en el código)'}. Vuelve a tocar una casilla ya rellena para borrarla.</p>
      <p>Pulsa <strong>«Probar»</strong> cuando completes las ${longitud} casillas: por cada intento verás cuántos colores están <strong>🎯 exactos</strong> (color y posición) y cuántos son de <strong>🔶 color correcto</strong> pero en otra posición.</p>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'codigo-secreto-info' });
  infoLine.textContent = `Longitud: ${longitud} · Colores disponibles: ${coloresDisponibles} · Repetición: ${permiteRepeticion ? 'sí' : 'no'}`;
  ui.box.appendChild(infoLine);

  const slotsWrap = createElement('div', { class: 'codigo-secreto-slots' });
  const slots = [];
  for (let i = 0; i < longitud; i++) {
    const slot = createElement('button', { class: 'codigo-secreto-slot', type: 'button' });
    slots.push(slot);
    slotsWrap.appendChild(slot);
  }
  ui.box.appendChild(slotsWrap);

  const paletteWrap = createElement('div', { class: 'codigo-secreto-paleta' });
  paleta.forEach((color) => {
    const swatch = createElement('button', { class: 'codigo-secreto-swatch', type: 'button' });
    swatch.textContent = EMOJI_COLOR[color] || '?';
    swatch.setAttribute('aria-label', color);
    swatch.addEventListener('click', () => colocar(color));
    paletteWrap.appendChild(swatch);
  });
  ui.box.appendChild(paletteWrap);

  const btnProbar = createElement('button', { class: 'btn' });
  btnProbar.textContent = 'Probar';
  ui.box.appendChild(btnProbar);

  const historial = createElement('div', { class: 'codigo-secreto-historial' });
  ui.box.appendChild(historial);

  const intento = new Array(longitud).fill(null);
  let seleccionada = 0;
  let intentos = 0;
  let ganado = false;

  slots.forEach((slot, i) => {
    slot.addEventListener('click', () => {
      if (ganado) return;
      if (intento[i]) {
        intento[i] = null;
        pintarSlot(i);
      }
      seleccionada = i;
      pintarSeleccion();
    });
  });

  btnProbar.addEventListener('click', () => {
    if (ganado) return;
    if (intento.some((c) => !c)) {
      setStatus(ui.result, 'Completa las casillas antes de probar', 'ko');
      return;
    }
    intentos++;
    const { exactos, colores } = comparaCombinacion(intento, solucion);
    pintarIntentoHistorial(intento, exactos, colores);

    if (exactos === longitud) {
      ganado = true;
      setStatus(ui.result, `¡Código descifrado en ${intentos} intento${intentos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: `Descifraste el código en ${intentos} intento${intentos === 1 ? '' : 's'}` });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ intentos });
      slots.forEach((s) => { s.disabled = true; });
      paletteWrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      btnProbar.disabled = true;
    } else {
      setStatus(ui.result, `🎯 Exactos: ${exactos} · 🔶 Color: ${colores}. Sigue probando.`, '');
      intento.fill(null);
      slots.forEach((s, i) => pintarSlot(i));
      seleccionada = 0;
      pintarSeleccion();
    }
  });

  function colocar(color) {
    if (ganado) return;
    intento[seleccionada] = color;
    pintarSlot(seleccionada);
    const siguienteVacia = intento.findIndex((c) => !c);
    if (siguienteVacia !== -1) seleccionada = siguienteVacia;
    pintarSeleccion();
  }

  function pintarSlot(i) {
    slots[i].textContent = intento[i] ? (EMOJI_COLOR[intento[i]] || '?') : '';
    slots[i].classList.toggle('lleno', Boolean(intento[i]));
    slots[i].setAttribute('aria-label', `Casilla ${i + 1}: ${intento[i] || 'vacía'}`);
  }

  function pintarSeleccion() {
    slots.forEach((s, i) => s.classList.toggle('seleccionada', i === seleccionada));
  }

  function pintarIntentoHistorial(combinacion, exactos, colores) {
    const fila = createElement('div', { class: 'codigo-secreto-fila-historial' });
    const pegs = createElement('div', { class: 'codigo-secreto-pegs' });
    combinacion.forEach((color) => {
      const peg = createElement('span', { class: 'codigo-secreto-peg' });
      peg.textContent = EMOJI_COLOR[color] || '?';
      pegs.appendChild(peg);
    });
    const marca = createElement('div', { class: 'codigo-secreto-marca' });
    marca.textContent = `🎯 ${exactos} · 🔶 ${colores}`;
    fila.appendChild(pegs);
    fila.appendChild(marca);
    historial.insertBefore(fila, historial.firstChild);
  }

  slots.forEach((s, i) => pintarSlot(i));
  pintarSeleccion();
  setStatus(ui.status, 'Listo para empezar', 'ok');
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && (data.solucion || data.longitud)) return data;
  throw new Error('Faltan datos de configuración del código secreto');
}
