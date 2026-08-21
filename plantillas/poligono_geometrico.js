// plantillas/poligono_geometrico.js
import { celebrate } from './celebration.js';
import { pintarIcono } from './shell.js';

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
    instructionsP.innerHTML = `<strong>Objetivo:</strong> Área = ${config.area}, Perímetro = ${config.perimeter}`;
  }

  // Inicializar variables del juego
  const gameState = initializeGame(config, ui.canvases.grid.parentElement);
  
  // Renderizar componentes
  setupCanvas(ui.canvases, gameState);
  buildNodes(ui.nodesLayer, gameState);
  setupEventListeners(ui, gameState, config);

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
      path: [],
      closed: false,
      history: [],
      future: [],
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
    if (state.path.length === 0) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    
    const grad = ctx.createLinearGradient(0, 0, state.W, state.H);
    grad.addColorStop(0, '#8A2189');  // --brand (canvas no lee var())
    grad.addColorStop(1, '#1788C7');  // --blue
    ctx.strokeStyle = grad;
    
    ctx.beginPath();
    ctx.moveTo(state.path[0].x, state.path[0].y);
    for (let i = 1; i < state.path.length; i++) {
      ctx.lineTo(state.path[i].x, state.path[i].y);
    }
    if (state.closed) {
      ctx.lineTo(state.path[0].x, state.path[0].y);
    }
    ctx.stroke();
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
        dot.dataset.r = r;
        dot.dataset.c = c;
        dot.dataset.x = x;
        dot.dataset.y = y;
        
        dot.addEventListener('click', (e) => onNodeClick(e, state, ui));
        container.appendChild(dot);
      }
    }
  }

  function onNodeClick(e, state, ui) {
    if (state.closed) return;
    
    const dot = e.currentTarget;
    const r = +dot.dataset.r;
    const c = +dot.dataset.c;
    const x = +dot.dataset.x;
    const y = +dot.dataset.y;
    const node = { r, c, x, y };
    
    if (state.path.length === 0) {
      pushHistory(state);
      state.path.push(node);
      refresh(ui, state);
      return;
    }
    
    const start = state.path[0];
    const last = state.path[state.path.length - 1];
    
    // Cerrar polígono
    if (r === start.r && c === start.c && state.path.length >= 3) {
      pushHistory(state);
      state.closed = true;
      refresh(ui, state);
      return;
    }
    
    // Verificar adyacencia (Manhattan distance = 1)
    const adjacent = (Math.abs(r - last.r) + Math.abs(c - last.c)) === 1;
    if (!adjacent) return;
    
    pushHistory(state);
    state.path.push(node);
    refresh(ui, state);
  }

  function highlightAdjacent(container, state) {
    container.querySelectorAll('.polygon-node').forEach(el => {
      el.classList.remove('adj', 'selected');
    });
    
    if (state.path.length === 0) return;
    
    const last = state.path[state.path.length - 1];
    const selected = container.querySelector(
      `.polygon-node[data-r="${last.r}"][data-c="${last.c}"]`
    );
    if (selected) selected.classList.add('selected');
    
    const coords = [
      [last.r - 1, last.c],
      [last.r + 1, last.c],
      [last.r, last.c - 1],
      [last.r, last.c + 1]
    ];
    
    coords.forEach(([rr, cc]) => {
      if (rr >= 0 && rr < state.N && cc >= 0 && cc < state.N) {
        const el = container.querySelector(
          `.polygon-node[data-r="${rr}"][data-c="${cc}"]`
        );
        if (el) el.classList.add('adj');
      }
    });
  }

  function refresh(ui, state) {
    const gctx = ui.canvases.grid.getContext('2d');
    const lctx = ui.canvases.lines.getContext('2d');
    
    drawGrid(gctx, state);
    drawLines(lctx, state);
    highlightAdjacent(ui.nodesLayer, state);
    updateMessage(ui.message, state);
  }

  function updateMessage(messageEl, state) {
    if (!state.path.length) {
      messageEl.textContent = 'Haz clic en un nodo para empezar. Se iluminan los adyacentes.';
      return;
    }
    if (!state.closed) {
      messageEl.textContent = 'Sigue construyendo. Solo movimientos a nodos adyacentes.';
      return;
    }
    messageEl.textContent = 'Pulsa Validar para verificar tu polígono.';
  }

  function calculateArea(state) {
    if (!state.closed || state.path.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < state.path.length; i++) {
      const j = (i + 1) % state.path.length;
      area += state.path[i].x * state.path[j].y - state.path[j].x * state.path[i].y;
    }
    return Math.abs(area) / 2 / (state.step * state.step);
  }

  function calculatePerimeter(state) {
    if (!state.closed || state.path.length < 2) return 0;
    let perimeter = 0;
    for (let i = 0; i < state.path.length; i++) {
      const j = (i + 1) % state.path.length;
      const dr = Math.abs(state.path[i].r - state.path[j].r);
      const dc = Math.abs(state.path[i].c - state.path[j].c);
      perimeter += dr + dc;
    }
    return perimeter;
  }

  function pushHistory(state) {
    state.history.push(JSON.stringify({
      path: state.path.map(p => ({ ...p })),
      closed: state.closed
    }));
    if (state.history.length > 100) state.history.shift();
    state.future.length = 0;
  }

  function setupEventListeners(ui, state, config) {
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        if (!state.closed) {
          setStatus(ui.result, 'El polígono no está cerrado', 'ko');
          return;
        }
        
        const area = calculateArea(state);
        const perimeter = calculatePerimeter(state);
        const areaOk = Math.abs(area - state.targetArea) < 1e-6;
        const perimeterOk = perimeter === state.targetPerimeter;
        
        if (areaOk && perimeterOk) {
          setStatus(ui.result, `Correcto! A=${area.toFixed(1)}, P=${perimeter}`, 'ok');
          celebrate({ ok: true });
          if (hooks && hooks.onSuccess) hooks.onSuccess();
        } else {
          setStatus(ui.result, `No coincide. A=${area.toFixed(2)}, P=${perimeter}`, 'ko');
        }
      });
    }

    if (ui.btnUndo) {
      ui.btnUndo.addEventListener('click', () => {
        if (state.history.length) {
          const lastState = JSON.parse(state.history.pop());
          state.future.push(JSON.stringify({
            path: state.path.map(p => ({ ...p })),
            closed: state.closed
          }));
          state.path = lastState.path;
          state.closed = lastState.closed;
          refresh(ui, state);
        }
      });
    }

    if (ui.btnReset) {
      ui.btnReset.addEventListener('click', () => {
        pushHistory(state);
        state.path = [];
        state.closed = false;
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
  pintarIcono(headerIcon, 'assets/icono-poligono-geometrico.svg');
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = 'Construye el polígono';
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
  const btnValidate = createElement('button', { class: 'btn' });
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