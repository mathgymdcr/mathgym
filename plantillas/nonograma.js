// ===== plantillas/nonograma.js =====
// Nonograma · Pinta celdas según pistas numéricas de fila/columna hasta
// revelar el dibujo oculto. Familia matemática nueva respecto al resto
// del catálogo: restricciones de conteo de rachas, no movimientos.
//
// Dos variantes según el payload: sin `paleta` el reto es monocromo y el
// grid es de 0 y 1; con ella cada celda es 0 o el índice de un color, los
// bloques de una pista llevan color, y dos bloques de colores distintos
// pueden ir pegados -- solo dos del mismo color exigen hueco.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { rachasColor } from '../scripts/nonograma-logic.js';

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
  const paleta = Array.isArray(config.paleta) && config.paleta.length ? config.paleta : null;
  const pistasFila = solution.map(pistaDe);
  const pistasColumna = [];
  for (let c = 0; c < columnas; c++) {
    pistasColumna.push(pistaDe(solution.map(fila => fila[c])));
  }

  const ui = buildStandardShell({
    tipo: 'nonograma',
    gameClass: 'nono-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> pinta las celdas para formar el dibujo oculto.</p>
      <p>Cada número de una fila o columna indica cuántas celdas seguidas hay que pintar ahí, en ese orden.</p>
      <p>Toca una celda para pintarla; tócala otra vez para marcarla con <strong>×</strong> (para recordar que va vacía); una tercera vez la deja vacía.</p>
      ${paleta ? `
      <p>Este dibujo va en color: elige arriba con qué color pintas, y fíjate en el color de cada número.
      Dos bloques de <strong>colores distintos</strong> pueden ir pegados; dos del <strong>mismo color</strong>
      necesitan al menos un hueco entre ellos.</p>` : ''}
    `
  });
  root.append(ui.box);

  // Estado de cada celda: 0 = vacía, -1 = marcada con ×, 1..k = color. En
  // monocromo el único color es el 1, así que es el 0/1/× de siempre.
  const state = {
    cells: Array.from({ length: filas }, () => Array(columnas).fill(0)),
    activo: 1,
    pintadas: 0,
    won: false
  };

  // Barra de colores: sin ella no se podría decidir de qué color se pinta, y
  // ciclar por los colores a base de clics sería insufrible con tres.
  const colorEls = [];
  if (paleta) {
    const barra = createElement('div', { class: 'nono-paleta' });
    paleta.forEach((hex, i) => {
      const boton = createElement('button', { class: 'nono-color', 'data-color': i + 1 });
      boton.style.background = hex;
      boton.setAttribute('aria-label', `Pintar con el color ${i + 1}`);
      boton.addEventListener('click', () => {
        state.activo = i + 1;
        colorEls.forEach((b, j) => b.classList.toggle('is-active', j === i));
      });
      barra.appendChild(boton);
      colorEls.push(boton);
    });
    colorEls[0].classList.add('is-active');
    ui.box.appendChild(barra);
  }

  const boardWrap = createElement('div', { class: 'nono-board-wrap' });
  const board = createElement('div', { class: 'nono-board' });
  board.style.setProperty('--nono-cols', columnas);
  boardWrap.appendChild(board);
  ui.box.appendChild(boardWrap);

  // Esquina vacía
  board.appendChild(createElement('div', { class: 'nono-corner' }));

  // Los números de una pista se pintan del color de su bloque; en monocromo
  // no llevan color y el marcado se queda como estaba.
  function pintarPista(el, pista) {
    el.innerHTML = pista
      .map((b) => (paleta && b.color
        ? `<span style="color:${paleta[b.color - 1]}">${b.n}</span>`
        : `<span>${b.n}</span>`))
      .join('');
  }

  // Cabecera de columnas
  const colClueEls = [];
  for (let c = 0; c < columnas; c++) {
    const clue = createElement('div', { class: 'nono-clue nono-clue-col' });
    pintarPista(clue, pistasColumna[c]);
    board.appendChild(clue);
    colClueEls.push(clue);
  }

  // Filas: pista lateral + celdas
  const cellEls = [];
  const rowClueEls = [];
  for (let r = 0; r < filas; r++) {
    const clue = createElement('div', { class: 'nono-clue nono-clue-row' });
    pintarPista(clue, pistasFila[r]);
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

  // Pista de una línea: los bloques con su color, y un 0 cuando no hay
  // ninguno -- la línea vacía enseña un 0, como en cualquier nonograma.
  function pistaDe(linea) {
    const bloques = rachasColor(linea);
    return bloques.length ? bloques : [{ n: 0, color: 0 }];
  }

  // Lo que hay pintado ahora mismo, con las × contando como vacías.
  function pintadas(arr) {
    return arr.map(v => (v > 0 ? v : 0));
  }

  function igualRachas(a, b) {
    return a.length === b.length && a.every((v, i) => v.n === b[i].n && v.color === b[i].color);
  }

  function onCellClick(r, c) {
    if (state.won) return;
    const v = state.cells[r][c];
    // Vacía -> color activo -> × -> vacía. Una celda de OTRO color se repinta
    // del activo sin dar la vuelta entera: al cambiar de color, lo que se
    // quiere es corregirla, no descartarla.
    if (v === 0 || (v > 0 && v !== state.activo)) state.cells[r][c] = state.activo;
    else if (v === state.activo) state.cells[r][c] = -1;
    else state.cells[r][c] = 0;
    // El par del reto son las celdas del dibujo, así que la marca cuenta cada
    // vez que se RELLENA una: rellenar de más (y corregir) es lo que cuesta
    // estrellas. Las X de descarte son gratis.
    if (state.cells[r][c] > 0) state.pintadas += 1;
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
        const pintada = state.cells[r][c] > 0 ? state.cells[r][c] : 0;
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
        cell.classList.toggle('is-filled', v > 0);
        cell.classList.toggle('is-marked', v === -1);
        cell.dataset.color = String(v > 0 ? v : 0);
        // En monocromo el relleno lo pone el CSS; en color, cada celda lleva
        // el suyo, que es lo que se está deduciendo.
        if (paleta) cell.style.background = v > 0 ? paleta[v - 1] : '';
        cell.textContent = v === -1 ? '×' : '';
      }
    }
    for (let r = 0; r < filas; r++) {
      const actual = pistaDe(pintadas(state.cells[r]));
      rowClueEls[r].classList.toggle('is-done', igualRachas(actual, pistasFila[r]));
    }
    for (let c = 0; c < columnas; c++) {
      const columna = state.cells.map(fila => fila[c]);
      const actual = pistaDe(pintadas(columna));
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
