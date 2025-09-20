// ===== ARCHIVO COMPLETO: plantillas/enigma_einstein.js =====
export async function render(root, data, hooks) {
  root.innerHTML = '';
  
  const ui = buildShell();
  root.append(ui.box);

  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, '❌ No se pudo cargar el enigma', 'ko');
    return;
  }

  const allCategories = Object.keys(config.categories || {});
  if (allCategories.length < 4) {
    setStatus(ui.status, '❌ Faltan categorías en el enigma', 'ko');
    return;
  }

  const categoryKeys = allCategories.slice(0, 4);
  const categories = {};
  
  for (const key of categoryKeys) {
    const values = Array.isArray(config.categories[key]) 
      ? config.categories[key].slice(0, 4)
      : [];
    categories[key] = values;
  }

  const BOARD_SIZE = 4;

  renderClues(ui.cluesContainer, config.clues || []);

  const gameState = {
    selected: null,
    board: Array(BOARD_SIZE).fill(0).map(() => ({}))
  };

  renderBoard(ui.board, categories, gameState);
  renderPalette(ui.palette, categories, (selection) => {
    gameState.selected = selection;
    highlightSelected(ui.palette, selection);
  });

  setupEventListeners(ui, gameState, categories, BOARD_SIZE, config);

  setStatus(ui.status, '🎮 ¡Listo para jugar!', 'ok');

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

  function setupEventListeners(ui, state, categories, boardSize, config) {
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        if (!config || !config.solution) {
          setStatus(ui.result, '❌ No hay solución definida', 'ko');
          return;
        }
        
        const result = validateSolution(state, categories, config.solution);
        setStatus(ui.result, result.msg, result.ok ? 'ok' : 'ko');
        
        if (result.ok && hooks && typeof hooks.onSuccess === 'function') {
          hooks.onSuccess();
        }
      });
    }

    if (ui.btnClear) {
      ui.btnClear.addEventListener('click', () => {
        for (let i = 0; i < boardSize; i++) {
          state.board[i] = {};
        }
        ui.board.querySelectorAll('.cell').forEach(cell => {
          cell.innerHTML = '';
        });
        state.selected = null;
        ui.palette.querySelectorAll('.card.is-selected').forEach(el => el.classList.remove('is-selected'));
        setStatus(ui.result, '🧹 Tablero limpio', 'ok');
      });
    }
  }
}

function buildShell() {
  const box = createElement('div', { class: 'template-box' });
  
  const badge = createElement('div', { class: 'badge' });
  badge.textContent = '🧩 Enigma de Einstein';
  box.appendChild(badge);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const grid = createElement('div', { class: 'ein-grid' });

  const cluesSection = createElement('section', { class: 'ein-clues' });
  const cluesTitle = createElement('h2');
  cluesTitle.textContent = '🔍 Pistas';
  cluesSection.appendChild(cluesTitle);
  
  const cluesContainer = createElement('ol');
  cluesSection.appendChild(cluesContainer);

  const toolbar = createElement('div', { class: 'toolbar' });
  const btnValidate = createElement('button', { class: 'btn' });
  btnValidate.textContent = '✅ Comprobar';
  
  const btnClear = createElement('button', { class: 'btn' });
  btnClear.textContent = '🗑️ Borrar todo';
  
  toolbar.appendChild(btnValidate);
  toolbar.appendChild(btnClear);
  cluesSection.appendChild(toolbar);

  const result = createElement('div', { class: 'feedback' });
  cluesSection.appendChild(result);

  const boardSection = createElement('section', { class: 'ein-board' });
  const boardTitle = createElement('h2');
  boardTitle.textContent = '🏠 Tablero';
  boardSection.appendChild(boardTitle);
  
  const board = createElement('div');
  boardSection.appendChild(board);

  const paletteSection = createElement('section', { class: 'ein-palette' });
  const paletteTitle = createElement('h2');
  paletteTitle.textContent = '🃏 Tarjetas';
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

// VALIDADOR SIMPLE - Ordenar alfabéticamente y comparar
function validateSolution(state, categories, solution) {
  const SIZE = 4;
  
  // 1) Extraer combinaciones del usuario
  const userCombinations = [];
  
  for (let col = 0; col < SIZE; col++) {
    const combination = {};
    let isComplete = true;
    
    // Revisar cada categoría
    for (const [category, values] of Object.entries(categories)) {
      const cellData = state.board[col]?.[category];
      
      if (!cellData || !(cellData instanceof Set) || cellData.size === 0) {
        return { 
          ok: false, 
          msg: `🤔 Te falta algo en la columna ${col + 1}: ${category}` 
        };
      }
      
      if (cellData.size > 1) {
        return { 
          ok: false, 
          msg: `😅 Tienes ${cellData.size} opciones en la columna ${col + 1}. Elige solo una por categoría.` 
        };
      }
      
      combination[category] = Array.from(cellData)[0];
    }
    
    userCombinations.push(combination);
  }

  // 2) Extraer combinaciones de la solución
  const solutionCombinations = [];
  for (const [person, combo] of Object.entries(solution)) {
    solutionCombinations.push({
      Persona: person,
      ...combo
    });
  }

  // 3) Ordenar ambas listas alfabéticamente por Persona
  userCombinations.sort((a, b) => a.Persona.localeCompare(b.Persona));
  solutionCombinations.sort((a, b) => a.Persona.localeCompare(b.Persona));

  // 4) Comparar las dos listas ordenadas
  for (let i = 0; i < SIZE; i++) {
    const userCombo = userCombinations[i];
    const correctCombo = solutionCombinations[i];
    
    // Comparar cada categoría
    for (const category of Object.keys(categories)) {
      if (userCombo[category] !== correctCombo[category]) {
        return {
          ok: false,
          msg: `🤨 ${correctCombo.Persona} necesita "${correctCombo[category]}" en ${category}, no "${userCombo[category]}".`
        };
      }
    }
  }

  // 5) ¡Todo correcto!
  return {
    ok: true,
    msg: `🎉 ¡INCREÍBLE! Lo resolviste perfectamente. Eres un genio como Einstein! 🧠✨`
  };
}