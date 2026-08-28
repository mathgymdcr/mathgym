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
import {
  DIR_VECTOR, normalizaConfig, crearPiezas, resuelto, PIEZA,
  simularTodos as trazarTodos
} from '../scripts/laser-triangular-logic.js';
const DIR_ROTATION = {
  right: 0, se: 45, down: 90, sw: 135, left: 180, nw: 225, up: 270, ne: 315
};
const LASER_COLORS = ['#ff8c42', '#3ec6ff', '#c084fc', '#7ee787'];

// La FORMA identifica el color, no solo el tinte: así el tablero se puede
// jugar sin distinguir colores. FORMA_DE_COLOR cubre los cuatro colores del
// esquema nuevo; los "neutro-N" del clásico son el mismo neutro con distinto
// tinte (misma forma, dos láseres).
const FORMA_DE_COLOR = {
  neutro: 'circulo', azul: 'triangulo', rojo: 'cuadrado', magenta: 'rombo'
};
// Exportada para que el test de accesibilidad pueda recorrer COLORES (el
// catálogo real, en scripts/laser-triangular-logic.js) y comprobar que cada
// color de ahí tiene su propia forma, en vez de fiarse de que este mapa
// literal se mantenga sincronizado a mano con esa lista.
export const formaDe = (color) => FORMA_DE_COLOR[String(color).replace(/-\d+$/, '')] || 'circulo';

const TINTE = {
  neutro: '#ff8c42', 'neutro-1': '#ff8c42', 'neutro-2': '#3ec6ff',
  azul: '#3ec6ff', rojo: '#ff5d5d', magenta: '#c084fc'
};
// TINTE solo cubre neutro-1/neutro-2 porque construirClasico solo genera dos
// láseres; para un neutro-N fuera de ese mapa, se resuelve igual que
// colorDeTramo (por índice en LASER_COLORS), en vez de caer siempre en el
// mismo color de reserva.
const tinteDe = (color) => {
  if (TINTE[color]) return TINTE[color];
  const m = /^neutro-(\d+)$/.exec(color);
  if (m) return LASER_COLORS[(Number(m[1]) - 1) % LASER_COLORS.length];
  return '#ffd23b';
};

// Nombre de cada pieza para el atributo data-pieza que consume el CSS.
const NOMBRE_PIEZA = {
  [PIEZA.SLASH]: 'slash', [PIEZA.BACKSLASH]: 'backslash',
  [PIEZA.VERT]: 'vert', [PIEZA.HORIZ]: 'horiz',
  [PIEZA.PRISMA]: 'prisma', [PIEZA.CONDENSADOR]: 'condensador'
};

// Colores fijos para los rayos ya coloreados (prisma/condensador); los
// "neutro-N" del modo clásico se resuelven por índice en LASER_COLORS, así
// que dos láseres siguen viéndose tan distintos como hoy.
const COLOR_FIJO = { azul: '#3ec6ff', rojo: '#ff5470', magenta: '#c084fc', neutro: '#ff8c42' };
function colorDeTramo(color) {
  if (COLOR_FIJO[color]) return COLOR_FIJO[color];
  const m = /^neutro-(\d+)$/.exec(color);
  if (m) return LASER_COLORS[(Number(m[1]) - 1) % LASER_COLORS.length];
  return LASER_COLORS[0];
}

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = normalizaConfig(await loadConfig(data));
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de láseres</div>';
    return;
  }

  const n = config.size;
  const lasers = Array.isArray(config.lasers) ? config.lasers : [];
  const targets = Array.isArray(config.targets) ? config.targets : [];
  const bloqueos = Array.isArray(config.blocks) ? config.blocks : [];

  const dentro = (r, c) => r >= 0 && r < n && c >= 0 && c < n;
  // El numero de emisores y de dianas NO tiene por que coincidir: en modo
  // prisma un emisor reparte en dos dianas, en condensador dos emisores
  // pueden converger en una. Lo unico exigible aqui es que haya al menos uno
  // de cada y que todos esten dentro del tablero.
  const configValida = n > 0 && lasers.length >= 1 && targets.length >= 1 &&
    lasers.every(l => l.emitter && DIR_VECTOR[l.emitter.dir] &&
      dentro(l.emitter.row, l.emitter.col)) &&
    targets.every(t => dentro(t.row, t.col));
  if (!configValida) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de láseres mal configurado (se requiere al menos un láser y una diana válidos)</div>';
    return;
  }

  const bloqueadas = new Set(bloqueos.map(b => `${b.row},${b.col}`));
  const sinPieza = new Set(bloqueadas);
  lasers.forEach(l => sinPieza.add(`${l.emitter.row},${l.emitter.col}`));
  targets.forEach(t => sinPieza.add(`${t.row},${t.col}`));

  const ui = buildStandardShell({
    tipo: 'laser-triangular',
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
    piezas: crearPiezas(n),
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
      const dianaIdx = targets.findIndex(t => t.row === r && t.col === c);
      if (emisorIdx !== -1) {
        const laser = lasers[emisorIdx];
        cell.classList.add('is-emitter');
        cell.style.setProperty('--laser-color', LASER_COLORS[emisorIdx % LASER_COLORS.length]);
        const boquilla = createElement('span', { class: 'laser-emisor' });
        boquilla.style.setProperty('--laser-dir-rot', `${DIR_ROTATION[laser.emitter.dir]}deg`);
        cell.appendChild(boquilla);
        // La insignia numerada solo aporta en clasico, donde hay dos
        // emisores y dos dianas que emparejar; en prisma/condensador hay un
        // solo emisor y un número ahí no dice nada.
        if (config.modo === 'clasico') cell.appendChild(laserBadge(emisorIdx));
      } else if (dianaIdx !== -1) {
        const target = targets[dianaIdx];
        cell.classList.add('is-target');
        cell.style.setProperty('--laser-color', tinteDe(target.color));
        const diana = createElement('span', { class: 'laser-diana' });
        diana.dataset.forma = formaDe(target.color);
        cell.appendChild(diana);
        if (config.modo === 'clasico') cell.appendChild(laserBadge(dianaIdx));
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
    state.piezas = crearPiezas(n);
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
    if (sinPieza.has(`${r},${c}`)) return;
    state.piezas[r][c] = (state.piezas[r][c] + 1) % 5;
    refresh();

    if (resuelto(config, state.piezas)) {
      state.won = true;
      setStatus(ui.status, '¡Todos los láseres llegaron a su diana!', 'ok');
      celebrate({ ok: true, message: '¡Has dirigido los láseres hasta sus dianas!' });
      if (hooks && hooks.onSuccess) {
        // El par son los espejos de la solución, así que se cuentan los
        // espejos puestos, no los clics: girar uno hasta dar con su tipo es
        // parte de jugar, no un gasto.
        const puestos = state.piezas.reduce(
          (total, fila) => total + fila.filter(Boolean).length, 0);
        hooks.onSuccess({ movimientos: puestos });
      }
    } else {
      const { cruces } = simularTodos();
      if (cruces.size > 0) {
        setStatus(ui.status, 'Los rayos se cruzan: dos trayectos no pueden compartir celda', 'ko');
      } else {
        setStatus(ui.status, 'Sigue ajustando los espejos', 'ok');
      }
    }
  }

  // Un solo trazador para todos: se le pasa la configuración del reto (ya
  // normalizada) y el estado actual de las piezas.
  function simularTodos() {
    return trazarTodos(config, state.piezas);
  }

  function refresh() {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = cellEls[r][c];
        if (sinPieza.has(`${r},${c}`)) continue;
        const v = state.piezas[r][c];
        cell.innerHTML = '';
        if (v) {
          const pieza = createElement('span', { class: 'laser-pieza' });
          pieza.dataset.pieza = NOMBRE_PIEZA[v];
          cell.appendChild(pieza);
        }
      }
    }

    cellEls.forEach(fila => fila.forEach(cell => cell.classList.remove('is-hit', 'is-crossing')));
    svg.innerHTML = '';

    const { tramos, cruces, dianasAlcanzadas } = simularTodos();
    tramos.forEach(({ puntos, color }) => {
      const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      linea.setAttribute('points', puntos.map(p => `${p.x},${p.y}`).join(' '));
      linea.setAttribute('class', 'laser-beam-line');
      linea.style.stroke = colorDeTramo(color);
      svg.appendChild(linea);
    });
    dianasAlcanzadas.forEach(key => {
      const [row, col] = key.split(',').map(Number);
      cellEls[row][col].classList.add('is-hit');
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
