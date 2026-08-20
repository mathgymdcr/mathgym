// ===== plantillas/laser_triangular.js =====
// Láseres sobre malla triangular · Tablero cuadrado grande, pero cada celda
// se trata internamente como 4 triángulos (las dos diagonales completas),
// no como un cuadrado macizo. El rayo se traza con geometría real, así que
// puede entrar y salir de cada celda por cualquiera de sus 8 direcciones y
// SÍ puede reflejarse en diagonal — con una sola diagonal fija por celda,
// dos de las cuatro direcciones diagonales quedan siempre paralelas a esa
// diagonal y ningún espejo las toca jamás; con las dos diagonales
// disponibles ese punto ciego desaparece.
//
// El jugador sigue eligiendo espejo por CELDA (vacío / '/' / '\'), igual
// que en la plantilla clásica: un rayo que llega EN PARALELO al espejo
// activo lo atraviesa sin desviarse; un rayo que llega PERPENDICULAR a él
// rebota en línea recta hacia atrás (así se comportan los espejos a 45°
// con rayos que también van a 45°: solo hay "de largo" o "vuelta atrás",
// nunca un giro de 90° — eso solo ocurre con rayos horizontales/verticales).

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
// El trazado de rayos vive fuera, en scripts/laser-triangular-logic.js, para
// que el juego, el generador diario y el validador usen exactamente el mismo
// código: con dos copias, cualquier diferencia publicaría retos imposibles.
import { DIR_VECTOR, simularTodos as trazarTodos } from '../scripts/laser-triangular-logic.js';
const DIR_ROTATION = {
  right: 0, se: 45, down: 90, sw: 135, left: 180, nw: 225, up: 270, ne: 315
};
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

  const n = config.size;
  const lasers = Array.isArray(config.lasers) ? config.lasers : [];
  const bloqueos = Array.isArray(config.blocks) ? config.blocks : [];

  const dentro = (r, c) => r >= 0 && r < n && c >= 0 && c < n;
  const configValida = n > 0 && lasers.length >= 2 &&
    lasers.every(l => l.emitter && l.target && DIR_VECTOR[l.emitter.dir] &&
      dentro(l.emitter.row, l.emitter.col) && dentro(l.target.row, l.target.col));
  if (!configValida) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de láseres mal configurado (se requieren al menos dos láseres válidos)</div>';
    return;
  }

  const bloqueadas = new Set(bloqueos.map(b => `${b.row},${b.col}`));
  const sinEspejo = new Set(bloqueadas);
  lasers.forEach(l => {
    sinEspejo.add(`${l.emitter.row},${l.emitter.col}`);
    sinEspejo.add(`${l.target.row},${l.target.col}`);
  });

  const ui = buildStandardShell({
    icon: '🔺',
    titulo: 'Láseres · Malla Triangular',
    gameClass: 'laser-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> coloca espejos para dirigir <strong>cada láser</strong> hasta la diana con su mismo número y color.</p>
      <p>Cada celda está dividida en triángulos por sus dos diagonales. El rayo se mueve también en diagonal (45°) y puede reflejarse en cualquiera de las 8 direcciones.</p>
      <p>Un rayo diagonal que llega <strong>en paralelo</strong> al espejo lo atraviesa; si llega <strong>perpendicular</strong>, rebota recto hacia atrás.</p>
      <p>Toca una celda para ir poniendo espejo <strong>/</strong>, <strong>\\</strong>, <strong>|</strong> y <strong>―</strong>; sigue tocando hasta dejarla vacía otra vez.</p>
      <p>Los rayos <strong>no pueden cruzarse</strong>: si dos trayectos pasan por la misma celda, reordena los espejos.</p>
    `
  });
  root.append(ui.box);

  const state = {
    mirrors: Array.from({ length: n }, () => Array(n).fill(0)),
    won: false
  };

  const boardWrap = createElement('div', { class: 'laser-board-wrap' });
  const boardStack = createElement('div', { class: 'laser-board-stack' });
  const board = createElement('div', { class: 'laser-board laser-board-mesh' });
  board.style.setProperty('--laser-cols', n);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'laser-beams');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  boardStack.appendChild(board);
  boardStack.appendChild(svg);
  boardWrap.appendChild(boardStack);
  ui.box.appendChild(boardWrap);

  const cellEls = [];
  for (let r = 0; r < n; r++) {
    const filaEls = [];
    for (let c = 0; c < n; c++) {
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
    state.mirrors = Array.from({ length: n }, () => Array(n).fill(0));
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
    state.mirrors[r][c] = (state.mirrors[r][c] + 1) % 5;
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

  // Un solo trazador para todos: se le pasa la configuración del reto y el
  // estado actual de los espejos.
  function simularTodos() {
    return trazarTodos({ size: n, lasers, blocks: bloqueos }, state.mirrors);
  }

  function refresh() {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = cellEls[r][c];
        if (sinEspejo.has(`${r},${c}`)) continue;
        const v = state.mirrors[r][c];
        cell.classList.toggle('is-slash', v === 1);
        cell.classList.toggle('is-backslash', v === 2);
        cell.classList.toggle('is-vert', v === 3);
        cell.classList.toggle('is-horiz', v === 4);
        cell.innerHTML = v ? '<span class="laser-mirror"></span>' : '';
      }
    }

    cellEls.forEach(fila => fila.forEach(cell => cell.classList.remove('is-hit', 'is-crossing')));
    svg.innerHTML = '';

    const { resultados, cruces } = simularTodos();
    resultados.forEach(({ puntos, resultado }, idx) => {
      const color = LASER_COLORS[idx % LASER_COLORS.length];
      const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      linea.setAttribute('points', puntos.map(p => `${p.x},${p.y}`).join(' '));
      linea.setAttribute('class', 'laser-beam-line');
      linea.style.stroke = color;
      svg.appendChild(linea);
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

// Insignia numerada que empareja visualmente cada emisor con su diana.
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
