// ===== plantillas/red_enredada.js =====
// Desenreda la Red. El único tipo del catálogo sin rejilla: los nodos se
// arrastran libremente por un lienzo y los cruces se recalculan en vivo con
// `cuentaCruces` (scripts/red-logic.js), compartida con el generador y el
// validador -- los tres tienen que estar de acuerdo en qué cuenta como
// cruce.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { cuentaCruces, segmentosSeCruzan } from '../scripts/red-logic.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PALETA = ['#3D8BE0', '#E85B4A', '#3DBE7A', '#F8C818', '#D163CC', '#4FB8C4', '#E0973D', '#8C7AE6', '#5C9DE8', '#C4526E'];

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const n = config.nodos;
  const aristas = config.aristas;
  const posicionesIniciales = config.posiciones_iniciales;

  if (!n || !Array.isArray(aristas) || !Array.isArray(posicionesIniciales)) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de desenreda la red sin datos válidos</div>';
    return;
  }

  const ui = buildStandardShell({
    tipo: 'desenreda-la-red',
    gameClass: 'red-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> arrastra los nodos hasta que ningún cable cruce a otro.</p>
      <ul>
        <li>Cada nodo de color es un punto de la red.</li>
        <li>Los cables entre nodos no se pueden añadir ni quitar.</li>
        <li>Toca y arrastra un nodo a otra posición del lienzo.</li>
        <li>Un cable que cruza a otro se pinta en rojo.</li>
        <li>Cuando ningún cable esté en rojo, la red está desenredada.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'red-info' });
  infoLine.textContent = `${n} nodos · ${aristas.length} cables`;
  ui.box.appendChild(infoLine);

  const lienzo = createElement('div', { class: 'red-lienzo' });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'red-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  lienzo.appendChild(svg);

  const lineas = aristas.map(() => {
    const linea = document.createElementNS(SVG_NS, 'line');
    linea.setAttribute('class', 'red-cable');
    svg.appendChild(linea);
    return linea;
  });

  const posiciones = posicionesIniciales.map((p) => ({ x: p.x, y: p.y }));
  let ganado = false;

  const nodos = posiciones.map((p, i) => {
    const nodo = createElement('button', { class: 'red-nodo', type: 'button' });
    nodo.style.background = PALETA[i % PALETA.length];
    lienzo.appendChild(nodo);
    return nodo;
  });

  function pintar() {
    posiciones.forEach((p, i) => {
      nodos[i].style.left = `${p.x}%`;
      nodos[i].style.top = `${p.y}%`;
    });

    const cruzada = new Array(aristas.length).fill(false);
    for (let i = 0; i < aristas.length; i++) {
      const [a, c] = aristas[i];
      for (let j = i + 1; j < aristas.length; j++) {
        const [b, d] = aristas[j];
        if (a === b || a === d || c === b || c === d) continue;
        if (segmentosSeCruzan(posiciones[a], posiciones[c], posiciones[b], posiciones[d])) {
          cruzada[i] = true;
          cruzada[j] = true;
        }
      }
    }

    aristas.forEach(([a, b], i) => {
      const linea = lineas[i];
      linea.setAttribute('x1', posiciones[a].x);
      linea.setAttribute('y1', posiciones[a].y);
      linea.setAttribute('x2', posiciones[b].x);
      linea.setAttribute('y2', posiciones[b].y);
      linea.classList.toggle('cruzado', cruzada[i]);
    });

    return cruzada.some(Boolean);
  }

  function actualizarMensaje(hayCruces) {
    if (ganado) return;
    setStatus(ui.result, hayCruces ? 'Todavía hay cables cruzados.' : 'Lienzo completo. ¡Comprobando...!', '');
  }

  function comprobarVictoria() {
    const total = cuentaCruces(posiciones, aristas);
    if (total === 0 && !ganado) {
      ganado = true;
      setStatus(ui.result, '¡Red desenredada!', 'ok');
      celebrate({ ok: true, message: 'Desenredaste todos los cables' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({});
      nodos.forEach((nodo) => { nodo.disabled = true; });
    }
  }

  let arrastrando = null; // indice del nodo en arrastre, o null

  function posicionRelativa(evento) {
    const rect = lienzo.getBoundingClientRect();
    const x = ((evento.clientX - rect.left) / rect.width) * 100;
    const y = ((evento.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(96, Math.max(4, y))
    };
  }

  nodos.forEach((nodo, i) => {
    nodo.addEventListener('pointerdown', (evento) => {
      if (ganado) return;
      arrastrando = i;
      nodo.setPointerCapture(evento.pointerId);
      nodo.classList.add('arrastrando');
    });
  });

  lienzo.addEventListener('pointermove', (evento) => {
    if (arrastrando == null || ganado) return;
    posiciones[arrastrando] = posicionRelativa(evento);
    const hayCruces = pintar();
    actualizarMensaje(hayCruces);
  });

  function soltar() {
    if (arrastrando == null) return;
    nodos[arrastrando].classList.remove('arrastrando');
    arrastrando = null;
    comprobarVictoria();
  }

  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  ui.box.appendChild(lienzo);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  const hayCruces = pintar();
  actualizarMensaje(hayCruces);
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && Array.isArray(data.aristas)) return data;
  throw new Error('Faltan datos de configuración de la red enredada');
}
