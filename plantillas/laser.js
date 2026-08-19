// ===== plantillas/laser.js =====
// Láseres y espejos · Coloca espejos para dirigir varios rayos, cada uno
// desde su propio emisor hasta su propia diana. Al menos dos láseres y dos
// dianas, y los trayectos no pueden compartir ninguna celda entre sí.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const DIR_VECTOR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIR_ROTATION = { right: 0, down: 90, left: 180, up: 270 };
const LASER_COLORS = ['#ff8c42', '#3ec6ff', '#c084fc', '#7ee787'];

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de láseres</div>';
    return;
  }

  const filas = config.rows;
  const columnas = config.cols;
  const lasers = Array.isArray(config.lasers) ? config.lasers : [];
  const bloqueos = Array.isArray(config.blocks) ? config.blocks : [];

  const configValida = filas && columnas && lasers.length >= 2 &&
    lasers.every(l => l.emitter && l.target && DIR_VECTOR[l.emitter.dir]);
  if (!configValida) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de láseres mal configurado (se requieren al menos dos láseres con emisor y diana)</div>';
    return;
  }

  const bloqueadas = new Set(bloqueos.map(b => `${b.row},${b.col}`));
  const sinEspejo = new Set(bloqueadas);
  lasers.forEach(l => {
    sinEspejo.add(`${l.emitter.row},${l.emitter.col}`);
    sinEspejo.add(`${l.target.row},${l.target.col}`);
  });

  const ui = buildStandardShell({
    icon: '🔦',
    titulo: 'Láseres y Espejos',
    gameClass: 'laser-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> coloca espejos para dirigir <strong>cada láser</strong> hasta la diana con su mismo número y color.</p>
      <p>Toca una celda para poner un espejo <strong>/</strong>; tócala otra vez para <strong>\\</strong>; una tercera vez la deja vacía.</p>
      <p>Los rayos <strong>no pueden cruzarse</strong>: si dos trayectos pasan por la misma celda, reordena los espejos.</p>
    `
  });
  root.append(ui.box);

  const state = {
    mirrors: Array.from({ length: filas }, () => Array(columnas).fill(0)),
    won: false
  };

  const boardWrap = createElement('div', { class: 'laser-board-wrap' });
  const board = createElement('div', { class: 'laser-board' });
  board.style.setProperty('--laser-cols', columnas);
  boardWrap.appendChild(board);
  ui.box.appendChild(boardWrap);

  const cellEls = [];
  for (let r = 0; r < filas; r++) {
    const filaEls = [];
    for (let c = 0; c < columnas; c++) {
      const cell = createElement('div', { class: 'laser-cell' });
      const emisorIdx = lasers.findIndex(l => l.emitter.row === r && l.emitter.col === c);
      const dianaIdx = lasers.findIndex(l => l.target.row === r && l.target.col === c);
      if (emisorIdx !== -1) {
        const laser = lasers[emisorIdx];
        cell.classList.add('is-emitter');
        cell.style.setProperty('--laser-color', LASER_COLORS[emisorIdx % LASER_COLORS.length]);
        const arrow = createElement('span', { class: 'laser-arrow' });
        arrow.textContent = '➤';
        arrow.style.transform = `rotate(${DIR_ROTATION[laser.emitter.dir]}deg)`;
        cell.appendChild(arrow);
        cell.appendChild(laserBadge(emisorIdx));
      } else if (dianaIdx !== -1) {
        cell.classList.add('is-target');
        cell.style.setProperty('--laser-color', LASER_COLORS[dianaIdx % LASER_COLORS.length]);
        const targetIcon = createElement('span', { class: 'laser-target-icon' });
        targetIcon.textContent = '🎯';
        cell.appendChild(targetIcon);
        cell.appendChild(laserBadge(dianaIdx));
      } else if (bloqueadas.has(`${r},${c}`)) {
        cell.classList.add('is-block');
      } else {
        cell.addEventListener('click', () => onCellClick(r, c));
      }
      board.appendChild(cell);
      filaEls.push(cell);
    }
    cellEls.push(filaEls);
  }

  const controls = createElement('div', { class: 'laser-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.mirrors = Array.from({ length: filas }, () => Array(columnas).fill(0));
    state.won = false;
    setStatus(ui.result, '', '');
    setStatus(ui.status, 'Listo para empezar', 'ok');
    refresh();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  refresh();

  function onCellClick(r, c) {
    if (state.won) return;
    if (sinEspejo.has(`${r},${c}`)) return;
    state.mirrors[r][c] = (state.mirrors[r][c] + 1) % 3;
    refresh();

    const { resultados, cruces } = simularTodos();
    const todasEnDiana = resultados.every(res => res.resultado === 'diana');
    if (todasEnDiana && cruces.size === 0) {
      state.won = true;
      setStatus(ui.status, '¡Todos los láseres llegaron a su diana!', 'ok');
      celebrate({ ok: true, message: '¡Has dirigido los láseres hasta sus dianas!' });
      if (hooks && hooks.onSuccess) hooks.onSuccess();
    } else if (cruces.size > 0) {
      setStatus(ui.status, 'Los rayos se cruzan: dos trayectos no pueden compartir celda', 'ko');
    } else {
      setStatus(ui.status, 'Sigue ajustando los espejos', 'ok');
    }
  }

  // Traza el trayecto de un láser desde su emisor, aplicando la reflexión de
  // cada espejo que encuentra. También se detiene si choca con el emisor o
  // la diana de OTRO láser (son objetos físicos en la celda), no solo con
  // los bloqueos del tablero. Vector (dx,dy): dx = columnas (+1 derecha),
  // dy = filas (+1 abajo). Fórmulas de reflexión verificadas antes de
  // implementarlas: '/' → (dx,dy)->(-dy,-dx); '\' → (dx,dy)->(dy,dx).
  function simular(laser) {
    let [dx, dy] = DIR_VECTOR[laser.emitter.dir];
    let r = laser.emitter.row, c = laser.emitter.col;
    const path = [{ row: r, col: c }];
    const maxSteps = filas * columnas * 4;

    for (let step = 0; step < maxSteps; step++) {
      r += dy;
      c += dx;
      if (r < 0 || r >= filas || c < 0 || c >= columnas) return { path, resultado: 'fuera' };
      if (bloqueadas.has(`${r},${c}`)) return { path, resultado: 'bloqueo' };
      if (r === laser.target.row && c === laser.target.col) {
        path.push({ row: r, col: c });
        return { path, resultado: 'diana' };
      }
      if (esObjetoAjeno(r, c, laser)) return { path, resultado: 'obstaculo' };
      path.push({ row: r, col: c });

      const m = state.mirrors[r][c];
      if (m === 1) { const [ndx, ndy] = [-dy, -dx]; dx = ndx; dy = ndy; }
      else if (m === 2) { const [ndx, ndy] = [dy, dx]; dx = ndx; dy = ndy; }
    }
    return { path, resultado: 'bucle' };
  }

  function esObjetoAjeno(r, c, laserActual) {
    return lasers.some(l => l !== laserActual && (
      (l.emitter.row === r && l.emitter.col === c) ||
      (l.target.row === r && l.target.col === c)
    ));
  }

  // Simula todos los láseres y detecta si algún par de trayectos comparte
  // celda: eso cuenta como cruce y bloquea la victoria, aunque cada uno por
  // separado hubiera llegado a su diana.
  function simularTodos() {
    const resultados = lasers.map(simular);
    const ocupacion = new Map();
    const cruces = new Set();
    resultados.forEach(({ path }, idx) => {
      path.forEach(({ row, col }) => {
        const key = `${row},${col}`;
        const previo = ocupacion.get(key);
        if (previo !== undefined && previo !== idx) cruces.add(key);
        ocupacion.set(key, idx);
      });
    });
    return { resultados, cruces };
  }

  function refresh() {
    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        const cell = cellEls[r][c];
        if (sinEspejo.has(`${r},${c}`)) continue;
        const v = state.mirrors[r][c];
        cell.classList.toggle('is-slash', v === 1);
        cell.classList.toggle('is-backslash', v === 2);
        cell.innerHTML = v ? '<span class="laser-mirror"></span>' : '';
      }
    }

    cellEls.forEach(fila => fila.forEach(cell => {
      cell.classList.remove('is-path', 'is-hit', 'is-crossing');
      cell.style.removeProperty('--laser-color-path');
    }));

    const { resultados, cruces } = simularTodos();
    resultados.forEach(({ path, resultado }, idx) => {
      const color = LASER_COLORS[idx % LASER_COLORS.length];
      path.forEach(({ row, col }) => {
        const cell = cellEls[row][col];
        cell.classList.add('is-path');
        cell.style.setProperty('--laser-color-path', color);
      });
      if (resultado === 'diana') {
        cellEls[lasers[idx].target.row][lasers[idx].target.col].classList.add('is-hit');
      }
    });
    cruces.forEach(key => {
      const [row, col] = key.split(',').map(Number);
      cellEls[row][col].classList.add('is-crossing');
    });
  }
}

// Insignia numerada que empareja visualmente cada emisor con su diana,
// para no depender solo del color (accesibilidad + claridad a simple vista).
function laserBadge(idx) {
  const badge = createElement('span', { class: 'laser-badge' });
  badge.textContent = String(idx + 1);
  return badge;
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}
