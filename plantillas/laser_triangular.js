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
// El jugador arma una pieza de una BANDEJA (seis piezas: los cuatro
// espejos de siempre, más un prisma y un condensador) y la coloca tocando
// o arrastrando hasta una celda libre; tocar o arrastrar fuera de una
// celda ocupada la retira. Un rayo que llega EN PARALELO a un espejo
// activo lo atraviesa sin desviarse; uno que llega PERPENDICULAR a él
// rebota en línea recta hacia atrás (así se comportan los espejos a 45°
// con rayos que también van a 45°: solo hay "de largo" o "vuelta atrás",
// nunca un giro de 90° — eso solo ocurre con rayos horizontales/verticales).
// El prisma parte un rayo neutro en un hijo azul y otro rojo a ±45°; el
// condensador hace lo contrario, fundiendo un azul y un rojo que lleguen
// hasta él en un único rayo magenta. El modo clásico (sin prisma ni
// condensador) sigue jugándose solo con los cuatro espejos.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
// El trazado de rayos vive fuera, en scripts/laser-triangular-logic.js, para
// que el juego, el generador diario y el validador usen exactamente el mismo
// código: con dos copias, cualquier diferencia publicaría retos imposibles.
import {
  DIR_VECTOR, normalizaConfig, crearPiezas, resuelto, PIEZA, tiposDisponibles,
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

// Las formas no llevan texto, asi que la etiqueta es lo unico que lee quien
// navegue con lector de pantalla.
const ETIQUETA_PIEZA = {
  [PIEZA.SLASH]: 'Espejo diagonal /', [PIEZA.BACKSLASH]: 'Espejo diagonal \\',
  [PIEZA.VERT]: 'Espejo vertical', [PIEZA.HORIZ]: 'Espejo horizontal',
  [PIEZA.PRISMA]: 'Prisma: parte el rayo en azul y rojo',
  [PIEZA.CONDENSADOR]: 'Condensador: junta azul y rojo en magenta'
};

// Un solo dibujante para cada forma: lo usan tanto la celda del tablero
// (refresh) como el boton de la bandeja, asi que hay una unica definicion
// del marcado de cada pieza.
function piezaSpan(tipo) {
  const pieza = createElement('span', { class: 'laser-pieza' });
  pieza.dataset.pieza = NOMBRE_PIEZA[tipo];
  return pieza;
}

// Colores fijos para los rayos ya coloreados (prisma/condensador); los
// "neutro-N" del modo clásico se resuelven por índice en LASER_COLORS, así
// que dos láseres siguen viéndose tan distintos como hoy. El rojo es el
// mismo #ff5d5d que TINTE.rojo (la diana) y que ya usa el resto del CSS
// (prisma, condensador, is-choque): un solo rojo para el rayo y su diana,
// en vez de dos que solo coincidían de cerca.
const COLOR_FIJO = { azul: '#3ec6ff', rojo: '#ff5d5d', magenta: '#c084fc', neutro: '#ff8c42' };
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

  // En la variante pequena el rayo se redibuja solo en cada cambio: es el nivel
  // de entrada y ahi ver el rayo moverse es la mitad de aprender el juego. En
  // medio y grande manda el boton, y la victoria solo se comprueba al disparar.
  const autoTraza = config.variant === 'pequeno';

  const ui = buildStandardShell({
    tipo: 'laser-triangular',
    gameClass: 'laser-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> dirige cada rayo hasta la diana de su mismo color y forma (y, en el modo clásico, su mismo número).</p>
      <p>Cada celda está dividida en triángulos por sus dos diagonales. El rayo se mueve también en diagonal (45°) y puede reflejarse en cualquiera de las 8 direcciones.</p>
      <p>Un rayo diagonal que llega <strong>en paralelo</strong> a un espejo lo atraviesa; si llega <strong>perpendicular</strong>, rebota recto hacia atrás.</p>
      <p>Un <strong>prisma</strong> parte un rayo neutro en dos: uno azul y otro rojo, que siguen caminos distintos. Un <strong>condensador</strong> hace lo contrario: junta en un único rayo magenta un rayo azul y uno rojo que lleguen hasta él.</p>
      <p>Elige una pieza de la bandeja y toca una celda libre para colocarla ahí (o arrástrala hasta ahí sin soltar por el camino); toca una celda ocupada para retirar su pieza.</p>
      <p>${autoTraza
        ? 'El rayo se traza solo cada vez que colocas o quitas una pieza, así ves su efecto al momento.'
        : 'Coloca las piezas que necesites y pulsa <strong>«Lanzar rayo»</strong> cuando la composición esté lista: solo entonces se traza el rayo y se comprueba si el reto queda resuelto.'}</p>
      <p>Los rayos <strong>no pueden cruzarse</strong>: si dos trayectos pasan por la misma celda que no sea un prisma o un condensador, reordena las piezas.</p>
    `
  });
  root.append(ui.box);

  const state = {
    piezas: crearPiezas(n),
    won: false,
    trazado: autoTraza, // en medio/grande, si ya se pulso 'Lanzar' desde el ultimo cambio
    armada: null,       // tipo de pieza armada en la bandeja, o null
    arrastrando: false  // hay un gesto de arrastre en curso (Pointer Events)
  };
  // Pieza levantada del propio tablero mientras se decide si el gesto es un
  // simple toque o un arrastre de verdad: solo se retira de su celda y se
  // arma cuando el puntero se mueve más allá de UMBRAL_ARRASTRE. Si se
  // suelta sin moverse, el toque normal (evento click) es quien la retira --
  // así no queda nada armado por un simple toque de "quitar pieza".
  let recogida = null; // { r, c, tipo, x, y } o null
  const UMBRAL_ARRASTRE = 6; // px
  // setPointerCapture retargetea TODOS los eventos posteriores del gesto al
  // elemento donde empezó -- incluido el 'click' de compatibilidad que el
  // navegador dispara detrás de todo pointerdown+pointerup. Sin esta
  // bandera, ese click retargeteado vuelve a entrar en onCellClick con
  // state.armada todavía viva (nunca se limpia tras colocar) y repite la
  // colocación en el ORIGEN del arrastre: la pieza queda en las dos celdas,
  // o se borra si el arrastre volvió al mismo sitio, o reaparece si se soltó
  // fuera del tablero. gestoConsumido se pone a true en soltarArrastre,
  // antes de tocar elementFromPoint (para cubrir también soltar fuera del
  // tablero), y se limpia al empezar cada gesto nuevo -- así solo se come el
  // click que de verdad viene retargeteado, nunca un toque suelto posterior.
  let gestoConsumido = false;

  // Bandeja: existencias infinitas de cada pieza disponible en este modo, en
  // vez del ciclo de cinco estados por clic que no escalaba a seis piezas.
  const trayButtons = [];
  const tray = createElement('div', { class: 'laser-tray', role: 'toolbar', 'aria-label': 'Piezas' });
  tiposDisponibles(config.modo).forEach((tipo) => {
    const btn = createElement('button', { class: 'laser-tray-pieza', type: 'button' });
    btn.dataset.pieza = NOMBRE_PIEZA[tipo];
    btn.setAttribute('aria-label', ETIQUETA_PIEZA[tipo]);
    btn.setAttribute('aria-pressed', 'false');
    btn.appendChild(piezaSpan(tipo));
    btn.addEventListener('click', () => {
      // Un arrastre que arranca en la bandeja retargetea su click de
      // compatibilidad al propio botón (la captura está en él), no a la
      // celda destino -- así que es AQUÍ donde ese click hay que consumirlo,
      // no en la celda. Re-armar el mismo tipo es idempotente de todos
      // modos, pero sin este reset la bandera se queda colgada (no hubo
      // pointerdown de por medio que la limpiara) y se come el siguiente
      // toque real que llegue como click plano, sin pointerdown -- p.ej.
      // activar una celda por teclado, o el propio .click() de los tests.
      gestoConsumido = false;
      armar(tipo);
    });
    // Arrastre con Pointer Events: un solo camino de codigo para raton, dedo
    // y lapiz. happy-dom no implementa setPointerCapture ni elementFromPoint
    // de forma util, asi que se comprueba que existan antes de usarlos -- una
    // plantilla que lanzase aqui se llevaria por delante tests/plantillas/,
    // que monta las doce plantillas y es la unica red que las cubre todas.
    btn.addEventListener('pointerdown', (ev) => {
      gestoConsumido = false;
      armar(tipo);
      state.arrastrando = true;
      if (typeof btn.setPointerCapture === 'function') {
        try { btn.setPointerCapture(ev.pointerId); } catch { /* sin soporte */ }
      }
    });
    btn.addEventListener('pointerup', soltarArrastre);
    // Si el gesto se cancela a medio camino (scroll, multi-touch, UI del
    // sistema) nunca llega pointerup: sin esto, arrastrando se queda en
    // true y el siguiente pointerup suelto en cualquier sitio coloca la
    // pieza donde no tocaba.
    btn.addEventListener('pointercancel', () => { state.arrastrando = false; gestoConsumido = false; });
    trayButtons.push(btn);
    tray.appendChild(btn);
  });
  ui.box.appendChild(tray);

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
      cell.dataset.fila = r;
      cell.dataset.col = c;
      const emisorIdx = lasers.findIndex(l => l.emitter.row === r && l.emitter.col === c);
      const dianaIdx = targets.findIndex(t => t.row === r && t.col === c);
      if (emisorIdx !== -1) {
        const laser = lasers[emisorIdx];
        cell.classList.add('is-emitter');
        // Se resuelve por COLOR, igual que la diana (tinteDe), en vez de por
        // índice: así el emparejamiento visual emisor<->diana es estructural
        // (mismo color -> mismo tinte) y no una coincidencia que depende de
        // que normalizaConfig y construirClasico asignen "neutro-N" en el
        // mismo orden que lasers[].
        cell.style.setProperty('--laser-color', tinteDe(laser.color));
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
        cell.addEventListener('click', () => {
          // Ver la nota junto a la declaración de gestoConsumido: este click
          // puede ser el de compatibilidad que el navegador retargetea al
          // origen de un arrastre, no un toque nuevo.
          if (gestoConsumido) { gestoConsumido = false; return; }
          onCellClick(r, c);
        });
        // Una pieza ya colocada tambien se arrastra, pero solo se retira de
        // su celda y se arma cuando el gesto CONFIRMA ser un arrastre (el
        // puntero se mueve más allá de UMBRAL_ARRASTRE) -- no en el propio
        // pointerdown. Un toque simple (sin mover) no debe tocar el estado
        // aquí: lo retira el 'click' normal de arriba, sin dejar nada armado.
        cell.addEventListener('pointerdown', (ev) => {
          gestoConsumido = false;
          if (state.won) return;
          const actual = state.piezas[r][c];
          if (actual === PIEZA.VACIO) return;
          recogida = { r, c, tipo: actual, x: ev.clientX, y: ev.clientY };
          if (typeof cell.setPointerCapture === 'function') {
            try { cell.setPointerCapture(ev.pointerId); } catch { /* sin soporte */ }
          }
        });
        cell.addEventListener('pointermove', (ev) => {
          if (!recogida || recogida.r !== r || recogida.c !== c || state.arrastrando) return;
          const dx = ev.clientX - recogida.x, dy = ev.clientY - recogida.y;
          if (Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
          if (state.won) { recogida = null; return; }
          state.piezas[r][c] = PIEZA.VACIO;
          apagaTrazo(); // levantar una pieza tambien cambia el tablero
          armar(recogida.tipo);
          state.arrastrando = true;
        });
        cell.addEventListener('pointerup', (ev) => {
          recogida = null;
          soltarArrastre(ev);
        });
        // Ver el pointerdown de la bandeja: sin esto, un gesto cancelado a
        // medio camino deja `arrastrando` (o una recogida pendiente) colgado.
        cell.addEventListener('pointercancel', () => {
          recogida = null;
          state.arrastrando = false;
          gestoConsumido = false;
        });
      }
      board.appendChild(cell);
      filaEls.push(cell);
    }
    cellEls.push(filaEls);
  }

  const controls = createElement('div', { class: 'laser-controls' });
  // El botón de lanzar solo existe en medio/grande: en pequeño el rayo se
  // traza solo con cada cambio, así que dispararlo aparte no significa nada.
  if (!autoTraza) {
    const btnLanzar = createElement('button', { class: 'btn laser-btn-lanzar' });
    btnLanzar.textContent = 'Lanzar rayo';
    btnLanzar.addEventListener('click', () => lanzar());
    controls.appendChild(btnLanzar);
  }
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.piezas = crearPiezas(n);
    state.won = false;
    // Reiniciar puede llegar a media de un arrastre (p.ej. desde el teclado,
    // o un segundo dedo); sin esto la bandera se queda colgada y el próximo
    // pointerup suelto en cualquier sitio coloca una pieza sin que nadie
    // haya vuelto a armar nada.
    state.arrastrando = false;
    recogida = null;
    armar(null);
    setStatus(ui.result, '', '');
    setStatus(ui.status, autoTraza ? 'Listo para empezar' : 'Coloca piezas y lanza el rayo', 'ok');
    apagaTrazo();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, autoTraza ? 'Listo para empezar' : 'Coloca piezas y lanza el rayo', 'ok');
  refresh();

  // Arma `tipo` en la bandeja: el siguiente toque en una celda libre lo
  // coloca. tipo === null limpia la bandeja (nada armado).
  function armar(tipo) {
    state.armada = tipo;
    trayButtons.forEach((btn) => {
      const activa = tipo != null && btn.dataset.pieza === NOMBRE_PIEZA[tipo];
      btn.classList.toggle('is-armada', activa);
      btn.setAttribute('aria-pressed', String(activa));
    });
  }

  // Fin de un gesto de arrastre (pointerup, retargeteado por setPointerCapture
  // al elemento donde empezo): busca la celda bajo el punto de soltar y la
  // trata igual que un toque. Soltar fuera del tablero no hace nada.
  function soltarArrastre(ev) {
    if (!state.arrastrando) return;
    state.arrastrando = false;
    // Se marca ANTES de mirar qué hay bajo el punto de soltar, y sin
    // condicionarlo a que se encuentre una celda: soltar fuera del tablero
    // (elementFromPoint no encuentra '.laser-cell') es justo el caso en el
    // que, sin esto, el click retargeteado coloca la pieza igualmente en el
    // origen -- el arrastre "para quitarla" no haría nada.
    gestoConsumido = true;
    if (typeof document.elementFromPoint !== 'function') return;
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    const celda = bajo && bajo.closest && bajo.closest('.laser-cell');
    if (celda && celda.dataset.fila !== undefined) {
      onCellClick(Number(celda.dataset.fila), Number(celda.dataset.col));
    }
  }

  function onCellClick(r, c) {
    if (state.won || sinPieza.has(`${r},${c}`)) return;
    if (state.piezas[r][c] !== PIEZA.VACIO) state.piezas[r][c] = PIEZA.VACIO;  // tocar retira
    else if (state.armada) state.piezas[r][c] = state.armada;
    else return;
    apagaTrazo();

    // En pequeño el rayo se traza solo y la victoria se comprueba en cada
    // cambio, como siempre; en medio/grande apagaTrazo() ya dejó el tablero
    // "sin disparar" y aquí no hay nada más que hacer hasta pulsar el botón.
    if (!autoTraza) return;

    if (resuelto(config, state.piezas)) { declararVictoria(); return; }
    const { cruces, tramos } = simularTodos();
    const estado = mensajeDeEstado(tramos, cruces);
    setStatus(ui.status, estado ? estado.texto : 'Sigue ajustando los espejos', estado ? estado.tipo : 'ok');
  }

  // Par son los espejos de la solución, así que se cuentan las piezas
  // puestas, no los clics: girar una hasta dar con su tipo es parte de
  // jugar, no un gasto. Compartida por onCellClick (pequeño) y lanzar
  // (medio/grande) -- antes cada una tenía su propia copia del bloque de
  // victoria y las dos habían ido divergiendo.
  function declararVictoria() {
    state.won = true;
    setStatus(ui.status, '¡Todos los rayos llegaron a su diana!', 'ok');
    celebrate({ ok: true, message: '¡Has dirigido los rayos hasta sus dianas!' });
    if (hooks && hooks.onSuccess) {
      const puestas = state.piezas.reduce((t, fila) => t + fila.filter(Boolean).length, 0);
      hooks.onSuccess({ movimientos: puestas });
    }
  }

  // Ladder de estado "no resuelto todavía" compartido por onCellClick
  // (pequeño) y lanzar (medio/grande) -- antes solo lanzar preguntaba por
  // 'emisor' antes que por cruces, y onCellClick se había quedado con la
  // versión vieja que solo miraba cruces, así que un rayo absorbido por
  // OTRO emisor (que también deja una celda visitada por dos tramos)
  // informaba "los rayos se cruzan" en pequeño, en vez del mensaje
  // correcto. Devuelve null cuando ninguno de los dos casos aplica, para
  // que cada llamador ponga su propio mensaje genérico -- difieren entre
  // pequeño (sigue invitando a seguir ajustando, en 'ok') y medio/grande
  // (ya se disparó y falló, en 'ko').
  function mensajeDeEstado(tramos, cruces) {
    if (tramos.some((t) => t.resultado === 'emisor')) {
      return { texto: 'El rayo choca con un emisor y se apaga', tipo: 'ko' };
    }
    if (cruces.size > 0) {
      return { texto: 'Los rayos se cruzan: dos trayectos no pueden compartir celda', tipo: 'ko' };
    }
    return null;
  }

  // Un solo trazador para todos: se le pasa la configuración del reto (ya
  // normalizada) y el estado actual de las piezas.
  function simularTodos() {
    return trazarTodos(config, state.piezas);
  }

  // Apaga el trazo visible del rayo tras cualquier cambio en el tablero. En
  // pequeño eso significa volver a trazarlo ya mismo (refresh() lo hace
  // solo, porque ahí SIEMPRE dibuja); en medio/grande significa justo lo
  // contrario -- borrar el SVG y dejar el tablero "sin disparar" hasta que
  // se pulse 'Lanzar rayo', que es quien vuelve a llamar a refresh().
  function apagaTrazo() {
    if (autoTraza) { refresh(); return; }
    state.trazado = false;
    svg.innerHTML = '';
    cellEls.forEach((f) => f.forEach((c) => c.classList.remove('is-hit', 'is-crossing', 'is-choque')));
    setStatus(ui.status, 'Coloca piezas y lanza el rayo', 'ok');
    // refresh() repinta las piezas del tablero (el SVG ya está limpio y, con
    // trazado en false, refresh() no lo vuelve a tocar).
    refresh();
  }

  // Solo existe el botón en medio/grande: dispara el trazado y, con él, la
  // única comprobación de victoria de esas dos variantes.
  function lanzar() {
    if (state.won) return;
    state.trazado = true;
    refresh();
    const { cruces, tramos } = simularTodos();
    if (resuelto(config, state.piezas)) { declararVictoria(); return; }
    const estado = mensajeDeEstado(tramos, cruces);
    setStatus(ui.status, estado ? estado.texto : 'Todavía no. Mueve alguna pieza y vuelve a lanzar', estado ? estado.tipo : 'ko');
  }

  function refresh() {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = cellEls[r][c];
        if (sinPieza.has(`${r},${c}`)) continue;
        const v = state.piezas[r][c];
        cell.innerHTML = '';
        if (v) cell.appendChild(piezaSpan(v));
      }
    }

    // En medio/grande, sin haber disparado, el trazo se queda apagado: no se
    // recalcula ni se toca el SVG hasta pulsar 'Lanzar rayo' (o hasta que
    // apagaTrazo() lo haya limpiado ya explícitamente).
    if (!autoTraza && !state.trazado) return;

    cellEls.forEach(fila => fila.forEach(cell => cell.classList.remove('is-hit', 'is-crossing', 'is-choque')));
    svg.innerHTML = '';

    const { tramos, cruces, dianasAlcanzadas } = simularTodos();
    tramos.forEach(({ puntos, color, resultado, squaresPath }) => {
      const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      linea.setAttribute('points', puntos.map(p => `${p.x},${p.y}`).join(' '));
      linea.setAttribute('class', 'laser-beam-line is-lanzando');
      linea.style.stroke = colorDeTramo(color);
      svg.appendChild(linea);
      // happy-dom no implementa SVGGeometryElement.getTotalLength.
      if (typeof linea.getTotalLength === 'function') {
        linea.style.setProperty('--laser-largo', linea.getTotalLength());
      }
      // El tramo que se queda cortado contra un emisor o un bloque marca su
      // celda final, para que se vea DÓNDE se apagó el rayo. Contra un
      // emisor, squaresPath ya incluye esa celda (igual que con una diana);
      // contra un bloque NO la incluye (los bloques no son transitables, así
      // que el trazador corta antes de entrar) y la última celda de
      // squaresPath es la casilla libre justo antes del bloque -- ahí se
      // marca, sin tocar scripts/laser-triangular-logic.js solo por esto,
      // que también usan el generador y el validador.
      if (resultado === 'emisor' || resultado === 'bloqueo') {
        const fin = squaresPath[squaresPath.length - 1];
        cellEls[fin.row][fin.col].classList.add('is-choque');
      }
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
