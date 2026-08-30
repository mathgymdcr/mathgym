// plantillas/poligono_geometrico.js
import { celebrate } from './celebration.js';
import { pintarIcono } from './shell.js';
import { tipoInfo } from '../catalogo-tipos.js';
import {
  claveArista,
  nodosDeArista,
  figurasDeAristas,
  medidasDeFigura
} from '../scripts/poligono-logic.js';

export async function render(root, data, hooks) {
  // Limpiar contenedor
  root.innerHTML = '';
  
  const ui = buildShell(data);
  root.append(ui.box);

  // Cargar configuración
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  // Validar configuración
  if (!config.area || !config.perimeter) {
    setStatus(ui.status, 'Error: Faltan área y perímetro objetivo', 'ko');
    return;
  }

  // Actualizar el objetivo mostrado (buildShell se ejecutó antes de cargar config)
  const instructionsP = ui.box.querySelector('.polygon-instructions p');
  if (instructionsP) {
    const totales = (config.n_figuras ?? 1) > 1 ? ' (totales de las dos figuras)' : '';
    const forma = {
      'libre': '',
      'convexa': ' · sin entrantes',
      'concava': ' · con al menos un entrante',
      'ambas-convexas': ' · las dos sin entrantes',
      'una-de-cada': ' · una sin entrantes y otra con al menos uno',
      'ambas-concavas': ' · las dos con al menos un entrante'
    }[config.formas ?? 'libre'] || '';
    instructionsP.innerHTML =
      `<strong>Objetivo:</strong> Área = ${config.area}, Perímetro = ${config.perimeter}${totales}${forma}`;
  }

  // Inicializar variables del juego
  const gameState = initializeGame(config, ui.canvases.grid.parentElement);
  
  // Renderizar componentes
  setupCanvas(ui.canvases, gameState);
  buildNodes(ui.nodesLayer, gameState);
  buildEdges(ui.nodesLayer, gameState, ui);
  setupEventListeners(ui, gameState, config);
  // Pinta el estado inicial: sin esto el mensaje de "haz clic en un nodo
  // para empezar" no aparece hasta el primer clic, que es justo cuando ya
  // no hace falta.
  refresh(ui, gameState);

  setStatus(ui.status, 'Listo para construir', 'ok');

  // FUNCIONES DEL JUEGO
  function initializeGame(config, stageEl) {
    const N = config.gridSize || 8;
    const measured = stageEl ? Math.round(stageEl.getBoundingClientRect().width) : 480;
    const W = measured || 480, H = W;
    const pad = Math.round(W * (24 / 480));
    const step = (W - pad * 2) / (N - 1);

    return {
      N,
      W,
      H,
      pad,
      step,
      // El tablero es un CONJUNTO DE ARISTAS, no una secuencia de nodos:
      // así se puede borrar un segmento de en medio (una secuencia se
      // partiría en dos) y dos figuras son dos componentes conexas.
      aristas: new Set(),
      // Nodo pendiente de un segundo clic para formar segmento. Un solo
      // campo en vez del viejo inicio/activo por "cabo abierto": con el
      // tablero cerrado (todos los nodos a grado 2) no había ningún cabo
      // desde el que seguir dibujando, y el juego se quedaba bloqueado.
      seleccionado: null,
      history: [],
      future: [],
      nFiguras: config.n_figuras ?? 1,
      formas: config.formas ?? 'libre',
      targetArea: config.area,
      targetPerimeter: config.perimeter
    };
  }

  function setupCanvas(canvases, state) {
    const { grid, lines } = canvases;
    const gctx = grid.getContext('2d');
    const lctx = lines.getContext('2d');
    
    // Configurar canvas
    grid.width = lines.width = state.W;
    grid.height = lines.height = state.H;
    
    drawGrid(gctx, state);
  }

  function drawGrid(ctx, state) {
    ctx.clearRect(0, 0, state.W, state.H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < state.N; i++) {
      const y = state.pad + i * state.step;
      ctx.beginPath();
      ctx.moveTo(state.pad, y);
      ctx.lineTo(state.W - state.pad, y);
      ctx.stroke();
      
      const x = state.pad + i * state.step;
      ctx.beginPath();
      ctx.moveTo(x, state.pad);
      ctx.lineTo(x, state.H - state.pad);
      ctx.stroke();
    }
  }

  function drawLines(ctx, state) {
    ctx.clearRect(0, 0, state.W, state.H);
    if (state.aristas.size === 0) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;

    const grad = ctx.createLinearGradient(0, 0, state.W, state.H);
    grad.addColorStop(0, '#8A2189');  // --brand (canvas no lee var())
    grad.addColorStop(1, '#1788C7');  // --blue
    ctx.strokeStyle = grad;

    for (const clave of state.aristas) {
      const [a, b] = nodosDeArista(clave);
      ctx.beginPath();
      ctx.moveTo(state.pad + a.c * state.step, state.pad + a.r * state.step);
      ctx.lineTo(state.pad + b.c * state.step, state.pad + b.r * state.step);
      ctx.stroke();
    }
  }

  function buildNodes(container, state) {
    container.innerHTML = '';
    
    for (let r = 0; r < state.N; r++) {
      for (let c = 0; c < state.N; c++) {
        const x = state.pad + c * state.step;
        const y = state.pad + r * state.step;
        
        const dot = createElement('div', { class: 'polygon-node' });
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        // Por encima de la capa de segmentos, que se monta después.
        dot.style.zIndex = '2';
        dot.dataset.r = r;
        dot.dataset.c = c;
        dot.dataset.x = x;
        dot.dataset.y = y;
        
        dot.addEventListener('click', (e) => onNodeClick(e, state, ui));
        container.appendChild(dot);
      }
    }
  }

  // Un nodo pulsado se selecciona; pulsar un segundo nodo ADYACENTE traza
  // el segmento entre los dos y limpia la selección. Da igual el grado que
  // tenga cada nodo o si el tablero ya está cerrado: cualquier nodo libre
  // sirve de punto de partida, así que cerrar una figura no bloquea nada.
  function onNodeClick(e, state, ui) {
    const dot = e.currentTarget;
    const nodo = { r: +dot.dataset.r, c: +dot.dataset.c };

    if (!state.seleccionado) {
      state.seleccionado = nodo;
      refresh(ui, state);
      return;
    }

    // Pulsar el mismo nodo otra vez deselecciona.
    if (state.seleccionado.r === nodo.r && state.seleccionado.c === nodo.c) {
      state.seleccionado = null;
      refresh(ui, state);
      return;
    }

    const vecino = Math.abs(state.seleccionado.r - nodo.r) + Math.abs(state.seleccionado.c - nodo.c) === 1;
    if (!vecino) {
      // No adyacente: mueve la selección al nuevo nodo en vez de fallar.
      state.seleccionado = nodo;
      refresh(ui, state);
      return;
    }

    const clave = claveArista(state.seleccionado, nodo);
    if (state.aristas.has(clave)) {
      state.seleccionado = null;
      refresh(ui, state);
      return;
    }

    // Ningún nodo puede pasar de grado 2: eso es lo que impide los cruces,
    // y con ellos el área por shoelace de un polígono que se corta a sí
    // mismo, que no significa nada.
    const prueba = new Set([...state.aristas, clave]);
    if (figurasDeAristas(prueba).invalido) {
      state.seleccionado = nodo;
      refresh(ui, state);
      return;
    }

    pushHistory(state);
    state.aristas = prueba;
    state.seleccionado = null;
    refresh(ui, state);
  }

  // Pulsar un segmento dibujado lo quita. Poner es cosa de los nodos.
  function onEdgeClick(clave, state, ui) {
    if (!state.aristas.has(clave)) return;
    pushHistory(state);
    const nuevas = new Set(state.aristas);
    nuevas.delete(clave);
    state.aristas = nuevas;
    state.seleccionado = null;
    refresh(ui, state);
  }

  function buildEdges(container, state, ui) {
    const grosor = 14;   // área de pulsación generosa; la línea pintada es más fina
    for (let r = 0; r < state.N; r++) {
      for (let c = 0; c < state.N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= state.N || c2 >= state.N) continue;

          const el = createElement('div', { class: 'polygon-edge' });
          el.dataset.arista = claveArista({ r, c }, { r: r2, c: c2 });
          const x = state.pad + c * state.step;
          const y = state.pad + r * state.step;
          el.style.position = 'absolute';
          el.style.left = `${x - (dc ? 0 : grosor / 2)}px`;
          el.style.top = `${y - (dr ? 0 : grosor / 2)}px`;
          el.style.width = `${dc ? state.step : grosor}px`;
          el.style.height = `${dr ? state.step : grosor}px`;
          el.style.zIndex = '1';
          el.style.cursor = 'pointer';
          // .polygon-nodes (el contenedor) pone pointer-events:none para
          // que el hueco entre nodos no tape el canvas; .polygon-node lo
          // reactiva con su propia regla CSS, pero .polygon-edge no tiene
          // ninguna y heredaba el 'none' del contenedor -- el clic
          // atravesaba al canvas y el segmento nunca se borraba.
          el.style.pointerEvents = 'auto';
          el.addEventListener('click', () => onEdgeClick(el.dataset.arista, state, ui));
          container.appendChild(el);
        }
      }
    }
  }

  function marcaAristas(container, state) {
    container.querySelectorAll('.polygon-edge').forEach((el) => {
      el.classList.toggle('puesta', state.aristas.has(el.dataset.arista));
    });
  }

  function highlightAdjacent(container, state) {
    container.querySelectorAll('.polygon-node').forEach((el) => {
      el.classList.remove('adj', 'selected');
    });

    const cabo = state.seleccionado;
    if (!cabo) return;

    const sel = container.querySelector(
      `.polygon-node[data-r="${cabo.r}"][data-c="${cabo.c}"]`
    );
    if (sel) sel.classList.add('selected');

    const alrededor = [
      [cabo.r - 1, cabo.c], [cabo.r + 1, cabo.c],
      [cabo.r, cabo.c - 1], [cabo.r, cabo.c + 1]
    ];
    for (const [rr, cc] of alrededor) {
      if (rr < 0 || rr >= state.N || cc < 0 || cc >= state.N) continue;
      if (state.aristas.has(claveArista(cabo, { r: rr, c: cc }))) continue;
      const el = container.querySelector(`.polygon-node[data-r="${rr}"][data-c="${cc}"]`);
      if (el) el.classList.add('adj');
    }
  }

  function refresh(ui, state) {
    const gctx = ui.canvases.grid.getContext('2d');
    const lctx = ui.canvases.lines.getContext('2d');

    drawGrid(gctx, state);
    drawLines(lctx, state);
    marcaAristas(ui.nodesLayer, state);
    highlightAdjacent(ui.nodesLayer, state);
    updateMessage(ui.message, state);
  }

  function updateMessage(messageEl, state) {
    if (!messageEl) return;

    if (state.aristas.size === 0 && !state.seleccionado) {
      messageEl.textContent = 'Haz clic en un nodo para empezar. Se iluminan los adyacentes.';
      return;
    }
    if (state.seleccionado) {
      messageEl.textContent = 'Pulsa un nodo adyacente para trazar el segmento.';
      return;
    }

    const { ciclos, abiertas } = figurasDeAristas(state.aristas);
    if (abiertas > 0) {
      messageEl.textContent = 'Sigue hasta cerrar la figura. Pulsa un segmento dibujado para borrarlo.';
      return;
    }
    messageEl.textContent = ciclos.length === state.nFiguras
      ? 'Pulsa Validar para comprobar.'
      : `Llevas ${ciclos.length} de ${state.nFiguras} figuras cerradas.`;
  }

  function pushHistory(state) {
    state.history.push(JSON.stringify([...state.aristas]));
    if (state.history.length > 100) state.history.shift();
    state.future.length = 0;
  }

  function setupEventListeners(ui, state, config) {
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        const { ciclos, invalido } = figurasDeAristas(state.aristas);
        if (invalido || ciclos.length !== state.nFiguras) {
          state.fallos = (state.fallos || 0) + 1;
          const plural = state.nFiguras > 1 ? 's' : '';
          setStatus(ui.result,
            `Necesitas ${state.nFiguras} figura${plural} cerrada${plural}.`, 'ko');
          return;
        }

        // Área, perímetro y convexidad los decide poligono-logic.js, el
        // mismo módulo que usan el generador y el validador: dos copias con
        // cualquier diferencia publicarían retos imposibles de cumplir.
        const medidas = ciclos.map(medidasDeFigura);
        const area = medidas.reduce((acc, m) => acc + m.area, 0);
        const perimetro = medidas.reduce((acc, m) => acc + m.perimetro, 0);
        const convexas = medidas.filter((m) => m.convexa).length;

        const cumpleForma = {
          'libre': () => true,
          'convexa': () => convexas === 1,
          'concava': () => convexas === 0,
          'ambas-convexas': () => convexas === 2,
          'una-de-cada': () => convexas === 1,
          'ambas-concavas': () => convexas === 0
        }[state.formas];

        const ok = area === state.targetArea
          && perimetro === state.targetPerimeter
          && (cumpleForma ? cumpleForma() : true);

        if (ok) {
          setStatus(ui.result, `Correcto! A=${area}, P=${perimetro}`, 'ok');
          celebrate({ ok: true });
          if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos: state.fallos || 0 });
        } else {
          state.fallos = (state.fallos || 0) + 1;
          setStatus(ui.result, `No coincide. A=${area}, P=${perimetro}`, 'ko');
        }
      });
    }

    if (ui.btnUndo) {
      ui.btnUndo.addEventListener('click', () => {
        if (state.history.length) {
          state.future.push(JSON.stringify([...state.aristas]));
          state.aristas = new Set(JSON.parse(state.history.pop()));
          state.seleccionado = null;
          refresh(ui, state);
        }
      });
    }

    if (ui.btnReset) {
      ui.btnReset.addEventListener('click', () => {
        pushHistory(state);
        state.aristas = new Set();
        state.seleccionado = null;
        refresh(ui, state);
      });
    }
  }
}

// FUNCIONES DE UTILIDAD
function buildShell(data) {
  const box = createElement('div', { class: 'template-box polygon-game' });

  // Cabecera estándar (oscura) + barrido
  const header = createElement('div', { class: 'enigma-header-dark' });
  const headerIcon = createElement('span', { class: 'enigma-header-icon' });
  const { nombre, icono } = tipoInfo('poligono-geometrico');
  pintarIcono(headerIcon, icono);
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = nombre;
  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  box.appendChild(header);

  // Status
  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Instrucciones
  const instructions = createElement('div', { class: 'polygon-instructions' });
  instructions.innerHTML = `
    <p><strong>Objetivo:</strong> ${data.area ? `Área = ${data.area}, Perímetro = ${data.perimeter}` : 'Construir polígono con medidas específicas'}</p>
  `;
  box.appendChild(instructions);

  // Game container
  const gameContainer = createElement('div', { class: 'polygon-container' });
  
  // Stage
  const stage = createElement('div', { class: 'polygon-stage' });
  const gridCanvas = createElement('canvas', { id: 'polygon-grid' });
  const linesCanvas = createElement('canvas', { id: 'polygon-lines' });
  const nodesLayer = createElement('div', { class: 'polygon-nodes' });
  
  stage.appendChild(gridCanvas);
  stage.appendChild(linesCanvas);
  stage.appendChild(nodesLayer);
  gameContainer.appendChild(stage);

  // Controls
  const controls = createElement('div', { class: 'polygon-controls' });
  const btnValidate = createElement('button', { class: 'btn', id: 'polygon-validate' });
  btnValidate.textContent = 'Validar';
  const btnUndo = createElement('button', { class: 'btn btn-secondary' });
  btnUndo.textContent = 'Deshacer';
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  
  controls.appendChild(btnValidate);
  controls.appendChild(btnUndo);
  controls.appendChild(btnReset);
  gameContainer.appendChild(controls);

  // Message
  const message = createElement('div', { class: 'polygon-message' });
  gameContainer.appendChild(message);

  // Result
  const result = createElement('div', { class: 'feedback' });
  gameContainer.appendChild(result);

  box.appendChild(gameContainer);

  return {
    box,
    status,
    canvases: {
      grid: gridCanvas,
      lines: linesCanvas
    },
    nodesLayer,
    btnValidate,
    btnUndo,
    btnReset,
    message,
    result
  };
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const response = await fetch(data.json_url);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.json();
  }

  if (data && (data.area || data.perimeter)) {
    return data;
  }

  throw new Error('Faltan datos de configuración del polígono');
}

function createElement(tag, attributes = {}) {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });

  return element;
}

function setStatus(element, text, type = '') {
  if (!element) return;
  
  element.textContent = text;
  element.className = 'feedback';
  if (type) {
    element.classList.add(type);
  }
}