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

const DIR_VECTOR = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1]
};
const DIR_ROTATION = {
  right: 0, se: 45, down: 90, sw: 135, left: 180, nw: 225, up: 270, ne: 315
};
const LASER_COLORS = ['#ff8c42', '#3ec6ff', '#c084fc', '#7ee787'];
const EPS = 1e-9;

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

  // Busca el primer borde de la celda actual (en coordenadas locales 0..1)
  // que el rayo cruza siguiendo (dx,dy) desde (lx,ly). Prueba las 4 aristas
  // del cuadrado más las 2 diagonales completas; por convexidad de cada uno
  // de los 4 triángulos, el cruce más cercano encontrado así es siempre una
  // arista real del triángulo en el que el rayo se encuentra.
  function siguienteCruce(lx, ly, dx, dy) {
    const candidatos = [];
    const add = (k, line, x, y) => {
      if (k > EPS && x >= -EPS && x <= 1 + EPS && y >= -EPS && y <= 1 + EPS) {
        candidatos.push({ k, line, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
      }
    };
    if (dy !== 0) {
      let k = (0 - ly) / dy; add(k, 'top', lx + k * dx, 0);
      k = (1 - ly) / dy; add(k, 'bottom', lx + k * dx, 1);
    }
    if (dx !== 0) {
      let k = (0 - lx) / dx; add(k, 'left', 0, ly + k * dy);
      k = (1 - lx) / dx; add(k, 'right', 1, ly + k * dy);
    }
    if (dx !== dy) {
      const k = (lx - ly) / (dy - dx);
      add(k, 'bs', lx + k * dx, ly + k * dy); // diagonal '\'
    }
    if (dx !== -dy) {
      const k = (1 - lx - ly) / (dx + dy);
      add(k, 'fs', lx + k * dx, ly + k * dy); // diagonal '/'
    }
    if (dy !== 0) {
      const k = (0.5 - ly) / dy;
      add(k, 'hc', lx + k * dx, 0.5); // espejo plano horizontal, por el centro
    }
    if (dx !== 0) {
      const k = (0.5 - lx) / dx;
      add(k, 'vc', 0.5, ly + k * dy); // espejo plano vertical, por el centro
    }
    candidatos.sort((a, b) => a.k - b.k);
    return candidatos[0];
  }

  // Traza un láser celda a celda con geometría real. Al cruzar una de las
  // dos diagonales de la celda actual: si esa orientación NO es el espejo
  // activo de la celda, el rayo la atraviesa sin desviarse; si SÍ lo es,
  // se refleja con la misma fórmula de siempre ('/' → (-dy,-dx), '\' →
  // (dy,dx)) y sigue dentro de la misma celda. Al cruzar un borde exterior
  // pasa a la celda vecina.
  function simular(laser) {
    let [dx, dy] = DIR_VECTOR[laser.emitter.dir];
    let r = laser.emitter.row, c = laser.emitter.col;
    let lx = 0.501, ly = 0.502; // arranque desplazado del centro, sin puntos singulares para ninguna de las 8 direcciones
    const squaresPath = [{ row: r, col: c }];
    // Puntos reales (coordenadas globales, no de celda) para dibujar el
    // rayo como línea recta: un tramo diagonal cruza varias celdas pero
    // todos esos puntos quedan alineados, así que se ve como una única
    // diagonal, no como un escalón de cuadrados.
    const puntos = [{ x: c + lx, y: r + ly }];
    const maxSteps = n * n * 12;

    for (let step = 0; step < maxSteps; step++) {
      const hit = siguienteCruce(lx, ly, dx, dy);
      if (!hit) return { squaresPath, puntos, resultado: 'bucle' };

      if (hit.line === 'bs' || hit.line === 'fs' || hit.line === 'hc' || hit.line === 'vc') {
        const m = state.mirrors[r][c];
        const activa = (hit.line === 'bs' && m === 2) || (hit.line === 'fs' && m === 1) ||
          (hit.line === 'vc' && m === 3) || (hit.line === 'hc' && m === 4);
        lx = hit.x; ly = hit.y;
        puntos.push({ x: c + lx, y: r + ly });
        if (activa) {
          if (hit.line === 'bs') { const [ndx, ndy] = [dy, dx]; dx = ndx; dy = ndy; }
          else if (hit.line === 'fs') { const [ndx, ndy] = [-dy, -dx]; dx = ndx; dy = ndy; }
          else if (hit.line === 'hc') { dy = -dy; }
          else { dx = -dx; } // vc
        }
        continue;
      }

      let nr = r, nc = c, nlx = lx, nly = ly;
      if (hit.line === 'top') { nr = r - 1; nly = 1; nlx = hit.x; }
      else if (hit.line === 'bottom') { nr = r + 1; nly = 0; nlx = hit.x; }
      else if (hit.line === 'left') { nc = c - 1; nlx = 1; nly = hit.y; }
      else if (hit.line === 'right') { nc = c + 1; nlx = 0; nly = hit.y; }

      puntos.push({ x: c + hit.x, y: r + hit.y });
      if (!dentro(nr, nc)) return { squaresPath, puntos, resultado: 'fuera' };
      if (bloqueadas.has(`${nr},${nc}`)) return { squaresPath, puntos, resultado: 'bloqueo' };
      if (nr === laser.target.row && nc === laser.target.col) {
        squaresPath.push({ row: nr, col: nc });
        puntos.push({ x: nc + 0.5, y: nr + 0.5 });
        return { squaresPath, puntos, resultado: 'diana' };
      }
      if (esObjetoAjeno(nr, nc, laser)) return { squaresPath, puntos, resultado: 'obstaculo' };
      r = nr; c = nc; lx = nlx; ly = nly;
      squaresPath.push({ row: r, col: c });
    }
    return { squaresPath, puntos, resultado: 'bucle' };
  }

  function esObjetoAjeno(r, c, laserActual) {
    return lasers.some(l => l !== laserActual && (
      (l.emitter.row === r && l.emitter.col === c) ||
      (l.target.row === r && l.target.col === c)
    ));
  }

  function simularTodos() {
    const resultados = lasers.map(simular);
    const ocupacion = new Map();
    const cruces = new Set();
    resultados.forEach(({ squaresPath }, idx) => {
      squaresPath.forEach(({ row, col }) => {
        const key = `${row},${col}`;
        const previo = ocupacion.get(key);
        if (previo !== undefined && previo !== idx) cruces.add(key);
        ocupacion.set(key, idx);
      });
    });
    return { resultados, cruces };
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
