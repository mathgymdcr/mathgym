// ===== plantillas/nonograma.js =====
// Nonograma · Pinta celdas según pistas numéricas de fila/columna hasta
// revelar el dibujo oculto. Familia matemática nueva respecto al resto
// del catálogo: restricciones de conteo de rachas, no movimientos.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el nonograma</div>';
    return;
  }

  const solution = Array.isArray(config.grid) ? config.grid : null;
  if (!solution || !solution.length || !Array.isArray(solution[0])) {
    root.innerHTML = '<div class="feedback ko">Error: Nonograma sin cuadrícula válida</div>';
    return;
  }

  const filas = solution.length;
  const columnas = solution[0].length;
  const pistasFila = solution.map(rachas);
  const pistasColumna = [];
  for (let c = 0; c < columnas; c++) {
    pistasColumna.push(rachas(solution.map(fila => fila[c])));
  }

  const ui = buildStandardShell({
    tipo: 'nonograma',
    gameClass: 'nono-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> pinta las celdas para formar el dibujo oculto.</p>
      <p>Cada número de una fila o columna indica cuántas celdas seguidas hay que pintar ahí, en ese orden.</p>
      <p>Toca una celda para pintarla; tócala otra vez para marcarla con <strong>×</strong> (para recordar que va vacía); una tercera vez la deja vacía.</p>
    `
  });
  root.append(ui.box);

  // Estado de cada celda: 0 = vacía, 1 = pintada, 2 = marcada con ×
  const state = { cells: Array.from({ length: filas }, () => Array(columnas).fill(0)), pintadas: 0, won: false };

  const boardWrap = createElement('div', { class: 'nono-board-wrap' });
  const board = createElement('div', { class: 'nono-board' });
  board.style.setProperty('--nono-cols', columnas);
  boardWrap.appendChild(board);
  ui.box.appendChild(boardWrap);

  // Esquina vacía
  board.appendChild(createElement('div', { class: 'nono-corner' }));

  // Cabecera de columnas
  const colClueEls = [];
  for (let c = 0; c < columnas; c++) {
    const clue = createElement('div', { class: 'nono-clue nono-clue-col' });
    clue.innerHTML = pistasColumna[c].map(n => `<span>${n}</span>`).join('');
    board.appendChild(clue);
    colClueEls.push(clue);
  }

  // Filas: pista lateral + celdas
  const cellEls = [];
  const rowClueEls = [];
  for (let r = 0; r < filas; r++) {
    const clue = createElement('div', { class: 'nono-clue nono-clue-row' });
    clue.innerHTML = pistasFila[r].map(n => `<span>${n}</span>`).join('');
    board.appendChild(clue);
    rowClueEls.push(clue);

    const filaEls = [];
    for (let c = 0; c < columnas; c++) {
      const cell = createElement('div', { class: 'nono-cell' });
      cell.addEventListener('click', () => onCellClick(r, c));
      board.appendChild(cell);
      filaEls.push(cell);
    }
    cellEls.push(filaEls);
  }

  const controls = createElement('div', { class: 'nono-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.cells = Array.from({ length: filas }, () => Array(columnas).fill(0));
    state.pintadas = 0;
    state.won = false;
    setStatus(ui.result, '', '');
    setStatus(ui.status, 'Listo para empezar', 'ok');
    refresh();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  refresh();

  function rachas(arr) {
    const result = [];
    let run = 0;
    for (const v of arr) {
      if (v) { run++; } else if (run > 0) { result.push(run); run = 0; }
    }
    if (run > 0) result.push(run);
    return result.length ? result : [0];
  }

  function pintadas(arr) {
    return arr.map(v => (v === 1 ? 1 : 0));
  }

  function igualRachas(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  function onCellClick(r, c) {
    if (state.won) return;
    state.cells[r][c] = (state.cells[r][c] + 1) % 3;
    // El par del reto son las celdas del dibujo, así que la marca cuenta cada
    // vez que se RELLENA una: rellenar de más (y corregir) es lo que cuesta
    // estrellas. Las X de descarte son gratis.
    if (state.cells[r][c] === 1) state.pintadas += 1;
    refresh();

    if (haGanado()) {
      state.won = true;
      setStatus(ui.status, '¡Dibujo completo!', 'ok');
      celebrate({ ok: true, message: '¡Has revelado el dibujo oculto!' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.pintadas });
    }
  }

  function haGanado() {
    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        const pintada = state.cells[r][c] === 1 ? 1 : 0;
        if (pintada !== solution[r][c]) return false;
      }
    }
    return true;
  }

  function refresh() {
    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        const cell = cellEls[r][c];
        const v = state.cells[r][c];
        cell.classList.toggle('is-filled', v === 1);
        cell.classList.toggle('is-marked', v === 2);
        cell.textContent = v === 2 ? '×' : '';
      }
    }
    for (let r = 0; r < filas; r++) {
      const actual = rachas(pintadas(state.cells[r]));
      rowClueEls[r].classList.toggle('is-done', igualRachas(actual, pistasFila[r]));
    }
    for (let c = 0; c < columnas; c++) {
      const columna = state.cells.map(fila => fila[c]);
      const actual = rachas(pintadas(columna));
      colClueEls[c].classList.toggle('is-done', igualRachas(actual, pistasColumna[c]));
    }
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
