// ===== plantillas/hashi.js =====
// Puentes de Hashi (Hashiwokakero) · Conecta todos los chips con puentes
// horizontales/verticales hasta que el número de cada chip coincida con
// la cantidad de puentes que le llegan, formando un único archipiélago
// conectado y sin que ningún puente cruce a otro.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de puentes</div>';
    return;
  }

  const filas = config.rows;
  const columnas = config.cols;
  const islas = Array.isArray(config.islands) ? config.islands : [];
  const configValida = filas > 0 && columnas > 0 && islas.length >= 2 &&
    islas.every(i => Number.isInteger(i.row) && Number.isInteger(i.col) && i.grado > 0);
  if (!configValida) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de puentes mal configurado (se requieren al menos dos chips con fila, columna y grado)</div>';
    return;
  }

  const islaEnCelda = new Map();
  islas.forEach((isla, idx) => islaEnCelda.set(`${isla.row},${isla.col}`, idx));

  const ui = buildStandardShell({
    tipo: 'puentes-hashi',
    gameClass: 'hashi-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> une todos los chips con puentes rectos (horizontales o verticales) hasta que el número de cada chip coincida con la cantidad de puentes que le llegan.</p>
      <p>Toca un chip y luego otro alineado con él para trazar un puente. Vuelve a tocar el mismo par para añadir un segundo puente paralelo; una tercera vez lo borra.</p>
      <p>Los puentes no pueden cruzarse ni pasar por encima de otro chip, y al final todos los chips deben quedar conectados en una sola red.</p>
    `
  });
  root.append(ui.box);

  const state = {
    puentes: new Map(), // "i-j" (i<j) -> 1 o 2
    tendidos: 0,        // puentes tendidos en total, la marca del reto
    seleccion: -1,
    won: false
  };

  const boardStack = createElement('div', { class: 'hashi-board-stack' });
  const board = createElement('div', { class: 'hashi-board' });
  board.style.setProperty('--hashi-cols', columnas);
  board.style.setProperty('--hashi-rows', filas);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'hashi-bridges');
  svg.setAttribute('viewBox', `0 0 ${columnas} ${filas}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  boardStack.appendChild(board);
  boardStack.appendChild(svg);
  ui.box.appendChild(boardStack);

  const islandEls = [];
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < columnas; c++) {
      const cell = createElement('div', { class: 'hashi-cell' });
      const idx = islaEnCelda.get(`${r},${c}`);
      if (idx !== undefined) {
        cell.classList.add('is-island');
        const btn = createElement('button', { class: 'hashi-island-btn', type: 'button' });
        pintarChip(btn, islas[idx].grado);
        btn.addEventListener('click', () => onIslandClick(idx));
        cell.appendChild(btn);
        islandEls[idx] = cell;
      }
      board.appendChild(cell);
    }
  }

  const controls = createElement('div', { class: 'laser-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.puentes.clear();
    state.tendidos = 0;
    state.seleccion = -1;
    state.won = false;
    setStatus(ui.result, '', '');
    setStatus(ui.status, 'Listo para empezar', 'ok');
    refresh();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  refresh();

  function alineadas(a, b) {
    return islas[a].row === islas[b].row || islas[a].col === islas[b].col;
  }

  function celdasIntermedias(a, b) {
    const A = islas[a], B = islas[b];
    const cells = [];
    if (A.row === B.row) {
      const [c0, c1] = A.col < B.col ? [A.col, B.col] : [B.col, A.col];
      for (let c = c0 + 1; c < c1; c++) cells.push({ row: A.row, col: c });
    } else {
      const [r0, r1] = A.row < B.row ? [A.row, B.row] : [B.row, A.row];
      for (let r = r0 + 1; r < r1; r++) cells.push({ row: r, col: A.col });
    }
    return cells;
  }

  function bridgeKey(a, b) {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}-${y}`;
  }

  function ocupadaPorOtraIsla(cells) {
    return cells.some(({ row, col }) => islaEnCelda.has(`${row},${col}`));
  }

  // Un puente nuevo solo puede cruzar a otro si tienen orientación distinta
  // (uno horizontal, otro vertical) y comparten una celda intermedia. Dos
  // puentes con la misma orientación nunca se cruzan aquí: si compartieran
  // tramo, habría una isla entre medias que ya bloquea la conexión directa.
  function cruzaOtroPuente(a, b, cells) {
    const horizontal = islas[a].row === islas[b].row;
    for (const key of state.puentes.keys()) {
      const [i, j] = key.split('-').map(Number);
      if ((i === a && j === b) || (i === b && j === a)) continue;
      const otraHorizontal = islas[i].row === islas[j].row;
      if (otraHorizontal === horizontal) continue;
      const otrasCeldas = celdasIntermedias(i, j);
      if (cells.some(c1 => otrasCeldas.some(c2 => c1.row === c2.row && c1.col === c2.col))) return true;
    }
    return false;
  }

  function onIslandClick(idx) {
    if (state.won) return;
    if (state.seleccion === -1) {
      state.seleccion = idx;
      refresh();
      return;
    }
    if (state.seleccion === idx) {
      state.seleccion = -1;
      refresh();
      return;
    }
    const a = state.seleccion, b = idx;
    if (!alineadas(a, b)) {
      state.seleccion = idx;
      refresh();
      return;
    }
    const cells = celdasIntermedias(a, b);
    if (ocupadaPorOtraIsla(cells)) {
      state.seleccion = idx;
      refresh();
      return;
    }
    const key = bridgeKey(a, b);
    const actual = state.puentes.get(key) || 0;
    // Cada puente que se tiende cuenta, y el par del reto son los puentes de
    // la solución: rehacer el trazado es lo que cuesta estrellas.
    if (actual === 0) {
      if (cruzaOtroPuente(a, b, cells)) {
        setStatus(ui.status, 'Ese puente cruzaría a otro ya construido', 'ko');
        state.seleccion = -1;
        refresh();
        return;
      }
      state.puentes.set(key, 1);
      state.tendidos += 1;
    } else if (actual === 1) {
      state.puentes.set(key, 2);
      state.tendidos += 1;
    } else {
      state.puentes.delete(key);
    }
    state.seleccion = -1;
    refresh();
    comprobarVictoria();
  }

  function calcularGrados() {
    const grados = islas.map(() => 0);
    state.puentes.forEach((count, key) => {
      const [i, j] = key.split('-').map(Number);
      grados[i] += count;
      grados[j] += count;
    });
    return grados;
  }

  function conectado() {
    const visitado = new Set([0]);
    const pila = [0];
    while (pila.length) {
      const cur = pila.pop();
      islas.forEach((_, idx) => {
        if (visitado.has(idx)) return;
        if ((state.puentes.get(bridgeKey(cur, idx)) || 0) > 0) {
          visitado.add(idx);
          pila.push(idx);
        }
      });
    }
    return visitado.size === islas.length;
  }

  function comprobarVictoria() {
    const grados = calcularGrados();
    const todasCumplen = islas.every((isla, idx) => grados[idx] === isla.grado);
    if (todasCumplen && conectado()) {
      state.won = true;
      setStatus(ui.status, '¡Todos los chips quedaron conectados!', 'ok');
      celebrate({ ok: true, message: '¡Has completado la red!' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.tendidos });
    } else {
      setStatus(ui.status, 'Sigue conectando los chips', 'ok');
    }
  }

  function dibujarPuente(i, j, count) {
    const A = islas[i], B = islas[j];
    const horizontal = A.row === B.row;
    const cx1 = A.col + 0.5, cy1 = A.row + 0.5, cx2 = B.col + 0.5, cy2 = B.row + 0.5;
    const offsets = count === 2 ? [-0.08, 0.08] : [0];
    offsets.forEach(off => {
      const line = document.createElementNS(SVG_NS, 'line');
      if (horizontal) {
        line.setAttribute('x1', cx1); line.setAttribute('x2', cx2);
        line.setAttribute('y1', cy1 + off); line.setAttribute('y2', cy2 + off);
      } else {
        line.setAttribute('x1', cx1 + off); line.setAttribute('x2', cx2 + off);
        line.setAttribute('y1', cy1); line.setAttribute('y2', cy2);
      }
      line.setAttribute('class', 'hashi-bridge-line');
      svg.appendChild(line);
    });
  }

  function refresh() {
    const grados = calcularGrados();
    islas.forEach((isla, idx) => {
      const cell = islandEls[idx];
      cell.classList.toggle('is-selected', state.seleccion === idx);
      cell.classList.toggle('is-satisfied', grados[idx] === isla.grado);
      cell.classList.toggle('is-over', grados[idx] > isla.grado);
    });
    svg.innerHTML = '';
    state.puentes.forEach((count, key) => {
      const [i, j] = key.split('-').map(Number);
      dibujarPuente(i, j, count);
    });
  }
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}

// --- El chip ---------------------------------------------------------------
// Ficha dibujada en SVG: disco exterior, aro con muescas (las cuñas de una
// ficha de verdad), disco interior y el número centrado.
//
// El tamaño va con el grado y el color por tramos. Los tres colores son
// RELLENOS que ya existen en la paleta -- no se inventan ocho, que se
// pelearían con una paleta corta a propósito, y sobre todo no se tocan el
// verde y el rojo, que son del estado del juego y se pintan en el aro de
// fuera (ver .hashi-cell.is-satisfied / .is-over en style.css).
const TRAMOS = [
  // `muesca` y `texto` van SIEMPRE en el tono que contrasta con el cuerpo:
  // sobre el oro, el blanco da 1.7:1 y desaparece. Las muescas en un tono
  // parecido al cuerpo no se leen a 26px -- parecen un borde raído -- así
  // que son de alto contraste, como las cuñas de una ficha de verdad.
  { hasta: 2, nombre: 'bajo',  cuerpo: '#1788c7', muesca: '#f4f8fb', texto: '#fff' },
  { hasta: 5, nombre: 'medio', cuerpo: '#8a2189', muesca: '#f7eef7', texto: '#fff' },
  { hasta: 8, nombre: 'alto',  cuerpo: '#f8c818', muesca: '#141b26', texto: '#141b26' }
];

export function tramoDeGrado(grado) {
  return TRAMOS.find((t) => grado <= t.hasta) || TRAMOS[TRAMOS.length - 1];
}

export function ladoDeGrado(grado) {
  const g = Math.min(Math.max(grado, 1), 8);
  return 26 + Math.round(((g - 1) / 7) * 12);   // 26px con grado 1, 38px con grado 8
}

function pintarChip(btn, grado) {
  const tramo = tramoDeGrado(grado);
  const lado = ladoDeGrado(grado);
  btn.dataset.grado = String(grado);
  btn.dataset.tramo = tramo.nombre;
  btn.style.width = `${lado}px`;
  btn.style.height = `${lado}px`;

  // Seis cuñas en el aro: dash y hueco iguales reparten la circunferencia
  // en doce tramos y se pintan seis. El aro es grueso (18 de 100) porque a
  // 26px cualquier cosa más fina se pierde.
  const radioAro = 41, grosorAro = 18;
  const cuna = (2 * Math.PI * radioAro) / 12;

  btn.innerHTML = `
    <svg viewBox="0 0 100 100" width="${lado}" height="${lado}" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="50" fill="${tramo.cuerpo}"></circle>
      <circle cx="50" cy="50" r="${radioAro}" fill="none" stroke="${tramo.muesca}"
              stroke-width="${grosorAro}" stroke-dasharray="${cuna} ${cuna}"></circle>
      <circle cx="50" cy="50" r="32" fill="${tramo.cuerpo}"></circle>
      <circle cx="50" cy="50" r="32" fill="none" stroke="${tramo.muesca}" stroke-width="4"></circle>
      <text x="50" y="50" fill="${tramo.texto}" font-size="40" font-weight="700"
            text-anchor="middle" dominant-baseline="central">${grado}</text>
    </svg>`;
}
