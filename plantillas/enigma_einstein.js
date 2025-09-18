// ===== ARCHIVO SEPARADO: plantillas/enigma_einstein.js =====
export async function render(root, data, hooks) {
  // Limpiar contenedor
  root.innerHTML = '';
  
  const ui = buildShell();
  root.append(ui.box);

  // Cargar configuración
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  // Validar categorías
  const allCategories = Object.keys(config.categories || {});
  if (allCategories.length < 4) {
    setStatus(ui.status, 'Error: Se requieren 4 categorias', 'ko');
    return;
  }

  // Normalizar datos a 4x4
  const categoryKeys = allCategories.slice(0, 4);
  const categories = {};
  
  for (const key of categoryKeys) {
    const values = Array.isArray(config.categories[key]) 
      ? config.categories[key].slice(0, 4)
      : [];
    
    while (values.length < 4) {
      values.push('Valor' + (values.length + 1));
    }
    
    categories[key] = values;
  }

  const BOARD_SIZE = 4;

  // Renderizar pistas
  renderClues(ui.cluesContainer, config.clues || []);

  // Estado del juego
  const gameState = {
    selected: null,
    board: Array(BOARD_SIZE).fill(0).map(() => ({}))
  };

  // Renderizar componentes
  renderBoard(ui.board, categories, gameState);
  renderPalette(ui.palette, categories, (selection) => {
    gameState.selected = selection;
    highlightSelected(ui.palette, selection);
  });

  // Event listeners
  setupEventListeners(ui, gameState, categories, BOARD_SIZE);

  setStatus(ui.status, 'Listo para jugar', 'ok');

  // FUNCIONES AUXILIARES
  function renderClues(container, clues) {
    container.innerHTML = '';
    
    if (!Array.isArray(clues) || clues.length === 0) {
      container.innerHTML = '<li>No hay pistas disponibles</li>';
      return;
    }

    clues.forEach(clue => {
      const li = document.createElement('li');
      li.textContent = clue;
      container.appendChild(li);
    });
  }

  function renderBoard(container, categories, state) {
    container.innerHTML = '';
    
    const table = createElement('table', { class: 'ein-table' });
    const tbody = createElement('tbody');
    const categoryKeys = Object.keys(categories);

    categoryKeys.forEach(category => {
      const row = createElement('tr');
      
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = createElement('td', {
          class: 'cell',
          'data-house': String(col),
          'data-category': category
        });

        cell.addEventListener('click', () => {
          handleCellClick(cell, state, col, category);
        });

        updateCell(cell, state.board[col][category] || new Set());
        row.appendChild(cell);
      }
      
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function handleCellClick(cell, state, col, category) {
    const selected = state.selected;
    if (!selected) return;

    if (!state.board[col][category]) {
      state.board[col][category] = new Set();
    }

    const cellSet = state.board[col][category];
    
    if (cellSet.has(selected.value)) {
      cellSet.delete(selected.value);
    } else {
      cellSet.add(selected.value);
    }

    updateCell(cell, cellSet);
  }

  function updateCell(cell, valueSet) {
    cell.innerHTML = '';
    
    if (!valueSet || valueSet.size === 0) {
      return;
    }

    const chipsContainer = createElement('div', { class: 'chips' });
    
    for (const value of valueSet) {
      const chip = createElement('button', {
        class: 'chip',
        'data-value': value
      });
      
      chip.textContent = value;
      
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        valueSet.delete(value);
        updateCell(cell, valueSet);
      });

      chipsContainer.appendChild(chip);
    }

    cell.appendChild(chipsContainer);
  }

  function renderPalette(container, categories, onSelect) {
    container.innerHTML = '';
    
    Object.entries(categories).forEach(([category, values]) => {
      const group = createElement('div', { class: 'ein-group' });
      
      const title = createElement('h3');
      title.textContent = category;
      group.appendChild(title);
      
      const cardsContainer = createElement('div', { class: 'ein-cards' });
      
      values.forEach(value => {
        const card = createElement('button', {
          class: 'card',
          'data-category': category,
          'data-value': value
        });
        
        card.textContent = value;
        
        card.addEventListener('click', () => {
          onSelect({ category, value });
        });

        cardsContainer.appendChild(card);
      });
      
      group.appendChild(cardsContainer);
      container.appendChild(group);
    });
  }

  function highlightSelected(container, selection) {
    container.querySelectorAll('.card').forEach(card => {
      card.classList.remove('is-selected');
    });

    if (!selection) return;

    const selectedCard = container.querySelector(
      '[data-category="' + selection.category + '"][data-value="' + selection.value + '"]'
    );
    
    if (selectedCard) {
      selectedCard.classList.add('is-selected');
    }
  }

  function setupEventListeners(ui, state, categories, boardSize) {
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        // 1) Si te pasan un hook externo, úsalo (opcional)
        if (hooks && typeof hooks.onValidate === 'function') {
          hooks.onValidate(state, categories, (msg, kind) => setStatus(ui.result, msg, kind));
          return;
        }
    
        // 2) Validación interna usando config.solution
        if (!config.solution) {
          setStatus(ui.result, 'No hay solución en el JSON (campo "solution").', 'ko');
          return;
        }
    
        const out = checkAgainstSolution(state, categories, config.solution);
        setStatus(ui.result, out.ok ? '¡Correcto!' : out.msg, out.ok ? 'ok' : 'ko');
      });
    }
    

  function clearBoard(container, state, categories, size) {
    for (let i = 0; i < size; i++) {
      state.board[i] = {};
    }

    container.querySelectorAll('.cell').forEach(cell => {
      cell.innerHTML = '';
    });
  }
}
function checkAgainstSolution(state, categories, solution) {
  // Asumimos que cada columna representa una "entidad" y que la fila "Persona"
  // tendrá exactamente 1 nombre por columna. Con eso identificamos a la persona.
  const categoryKeys = Object.keys(categories);
  const personaKey = categoryKeys.find(k => k.toLowerCase() === 'persona');
  if (!personaKey) {
    return { ok: false, msg: 'No existe la categoría "Persona" en el puzzle.' };
  }

  const size = 4;
  const seenPersonas = new Set();
  const user = {}; // user[persona] = { Cat1: val1, Cat2: val2, ... }

  for (let col = 0; col < size; col++) {
    // 1) Persona en la columna
    const pSet = state.board[col]?.[personaKey] || new Set();
    if (pSet.size !== 1) {
      return { ok: false, msg: `Falta seleccionar 1 Persona (exacta) en la columna ${col + 1}.` };
    }
    const persona = [...pSet][0];
    if (seenPersonas.has(persona)) {
      return { ok: false, msg: `La Persona "${persona}" está repetida en varias columnas.` };
    }
    seenPersonas.add(persona);
    user[persona] = {};

    // 2) Cada categoría debe tener exactamente 1 valor en la columna
    for (const cat of categoryKeys) {
      if (cat === personaKey) continue;
      const set = state.board[col]?.[cat] || new Set();
      if (set.size !== 1) {
        return { ok: false, msg: `En "${cat}" (columna ${col + 1}) debes elegir exactamente 1 valor.` };
      }
      user[persona][cat] = [...set][0];
    }
  }

  // 3) Comparar con la solución esperada
  for (const persona of Object.keys(solution)) {
    const sol = solution[persona];
    const ans = user[persona];
    if (!ans) {
      return { ok: false, msg: `Falta la Persona "${persona}" en el tablero.` };
    }
    for (const cat of Object.keys(sol)) {
      if (ans[cat] !== sol[cat]) {
        return {
          ok: false,
          msg: `Error en ${persona}: "${cat}" debería ser "${sol[cat]}", no "${ans[cat]}".`
        };
      }
    }
  }

  return { ok: true, msg: '¡Correcto!' };
}


// FUNCIONES DE UTILIDAD para enigma_einstein.js
function buildShell() {
  const box = createElement('div', { class: 'template-box' });
  
  const badge = createElement('div', { class: 'badge' });
  badge.textContent = 'Enigma 4x4 PlayFix';
  box.appendChild(badge);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const grid = createElement('div', { class: 'ein-grid' });

  // Sección de pistas
  const cluesSection = createElement('section', { class: 'ein-clues' });
  const cluesTitle = createElement('h2');
  cluesTitle.textContent = 'Pistas';
  cluesSection.appendChild(cluesTitle);
  
  const cluesContainer = createElement('ol');
  cluesSection.appendChild(cluesContainer);

  // Toolbar
  const toolbar = createElement('div', { class: 'toolbar' });
  const btnValidate = createElement('button', { class: 'btn' });
  btnValidate.textContent = 'Validar';
  
  const btnClear = createElement('button', { class: 'btn' });
  btnClear.textContent = 'Limpiar';
  
  toolbar.appendChild(btnValidate);
  toolbar.appendChild(btnClear);
  cluesSection.appendChild(toolbar);

  const result = createElement('div', { class: 'feedback' });
  cluesSection.appendChild(result);

  // Sección del tablero
  const boardSection = createElement('section', { class: 'ein-board' });
  const boardTitle = createElement('h2');
  boardTitle.textContent = 'Tablero';
  boardSection.appendChild(boardTitle);
  
  const board = createElement('div');
  boardSection.appendChild(board);

  // Sección de la paleta
  const paletteSection = createElement('section', { class: 'ein-palette' });
  const paletteTitle = createElement('h2');
  paletteTitle.textContent = 'Tarjetas';
  paletteSection.appendChild(paletteTitle);
  
  const palette = createElement('div');
  paletteSection.appendChild(palette);

  grid.appendChild(cluesSection);
  grid.appendChild(boardSection);
  grid.appendChild(paletteSection);
  box.appendChild(grid);

  return {
    box,
    status,
    cluesContainer,
    btnValidate,
    btnClear,
    result,
    board,
    palette
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

  if (data && (data.categories || data.constraints || data.clues)) {
    return data;
  }

  throw new Error('Faltan datos de configuracion');
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