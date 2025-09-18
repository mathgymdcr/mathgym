// plantillas/enigma_einstein.js - MEJORADO

export async function render(root, data, hooks) {
  // Limpiar contenedor
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  // Cargar y validar configuración
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, `❌ ${error?.message || error}`, 'ko');
    return;
  }

  // Validar que tenemos 4 categorías
  const allCategories = Object.keys(config?.categories || {});
  if (allCategories.length < 4) {
    setStatus(ui.status, '❌ Se requieren exactamente 4 categorías', 'ko');
    return;
  }

  // Normalizar datos a 4x4
  const categoryKeys = allCategories.slice(0, 4);
  const categories = {};
  
  for (const key of categoryKeys) {
    const values = Array.isArray(config.categories[key]) 
      ? config.categories[key].slice(0, 4)
      : [];
    
    // Rellenar valores faltantes
    while (values.length < 4) {
      values.push(`Valor${values.length + 1}`);
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

  setStatus(ui.status, '✅ Listo para jugar', 'ok');

  // --- FUNCIONES AUXILIARES ---

  function renderClues(container, clues) {
    container.innerHTML = '';
    
    if (!Array.isArray(clues) || clues.length === 0) {
      container.innerHTML = '<li class="feedback">No hay pistas disponibles</li>';
      return;
    }

    clues.forEach(clue => {
      const li = document.createElement('li');
      li.textContent = clue;
      li.style.marginBottom = '6px';
      container.appendChild(li);
    });
  }

  function renderBoard(container, categories, state) {
    container.innerHTML = '';
    
    const table = createElement('table', {
      class: 'ein-table',
      role: 'grid',
      'aria-label': 'Tablero de enigma 4x4'
    });
    
    const tbody = createElement('tbody');
    const categoryKeys = Object.keys(categories);

    categoryKeys.forEach(category => {
      const row = createElement('tr', { 'data-category': category });
      
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = createElement('td', {
          class: 'cell',
          'data-house': String(col),
          'data-category': category,
          tabindex: '0',
          role: 'gridcell',
          'aria-label': `Celda ${category}, casa ${col + 1}`
        });

        // Event listener para clicks en celdas
        cell.addEventListener('click', () => handleCellClick(cell, state, col, category));
        
        // Navegación por teclado
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCellClick(cell, state, col, category);
          }
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
    
    // Toggle del valor
    if (cellSet.has(selected.value)) {
      cellSet.delete(selected.value);
    } else {
      cellSet.add(selected.value);
    }

    updateCell(cell, cellSet);
    
    // Efecto visual de feedback
    cell.style.transform = 'scale(0.95)';
    setTimeout(() => {
      cell.style.transform = '';
    }, 150);
  }

  function updateCell(cell, valueSet) {
    // Limpiar contenido anterior
    cell.innerHTML = '';
    
    if (!valueSet || valueSet.size === 0) {
      return;
    }

    const chipsContainer = createElement('div', { class: 'chips' });
    
    for (const value of valueSet) {
      const chip = createElement('button', {
        class: 'chip',
        'data-value': value,
        title: `Eliminar "${value}"`,
        'aria-label': `Eliminar ${value} de esta celda`,
        tabindex: '0'
      });
      
      chip.textContent = value;
      
      // Event listener para eliminar chip
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        valueSet.delete(value);
        updateCell(cell, valueSet);
      });

      // Navegación por teclado para chips
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          chip.click();
        }
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
          type: 'button',
          'data-category': category,
          'data-value': value,
          'aria-label': `Seleccionar ${value} de ${category}`
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
    // Quitar selección anterior
    container.querySelectorAll('.card').forEach(card => {
      card.classList.remove('is-selected');
    });

    if (!selection) return;

    // Buscar y seleccionar la nueva carta
    const selector = `.card[data-category="${escapeCSS(selection.category)}"][data-value="${escapeCSS(selection.value)}"]`;
    const selectedCard = container.querySelector(selector);
    
    if (selectedCard) {
      selectedCard.classList.add('is-selected');
      selectedCard.focus();
    }
  }

  function setupEventListeners(ui, state, categories, boardSize) {
    // Botón validar
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        const completedCells = state.board.flat().filter(cell => 
          Object.keys(cell).length > 0
        ).length;
        
        setStatus(ui.result, 
          `🎯 Progreso: ${completedCells}/${boardSize * Object.keys(categories).length} celdas con valores`, 
          completedCells > 0 ? 'ok' : 'warning'
        );
      });
    }

    // Botón limpiar
    if (ui.btnClear) {
      ui.btnClear.addEventListener('click', () => {
        clearBoard(ui.board, state, categories, boardSize);
        setStatus(ui.result, '🧹 Tablero limpiado', 'ok');
      });
    }
  }

  function clearBoard(container, state, categories, size) {
    // Limpiar estado
    for (let i = 0; i < size; i++) {
      state.board[i] = {};
    }

    // Limpiar visualmente
    container.querySelectorAll('.cell').forEach(cell => {
      cell.innerHTML = '';
    });
  }
}

// --- FUNCIONES DE UTILIDAD ---

function buildShell() {
  const box = createElement('div', { class: 'template-box', id: 'enigma-game' });
  
  // Badge
  const badge = createElement('div', { class: 'badge' });
  badge.textContent = 'Enigma 4×4 · PlayFix';
  box.appendChild(badge);

  // Estado
  const status = createElement('div', { class: 'feedback', id: 'enigma-status' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Grid principal
  const grid = createElement('div', { class: 'ein-grid' });

  // Sección de pistas
  const cluesSection = createElement('section', { class: 'ein-clues' });
  const cluesTitle = createElement('h2');
  cluesTitle.textContent = 'Pistas';
  cluesSection.appendChild(cluesTitle);
  
  const cluesContainer = createElement('ol', { id: 'enigma-clues' });
  cluesSection.appendChild(cluesContainer);

  // Toolbar con botones
  const toolbar = createElement('div', { class: 'toolbar' });
  const btnValidate = createElement('button', {
    class: 'btn',
    id: 'enigma-validate',
    type: 'button'
  });
  btnValidate.textContent = '✓ Validar';
  
  const btnClear = createElement('button', {
    class: 'btn',
    id: 'enigma-clear',
    type: 'button'
  });
  btnClear.textContent = '🧹 Limpiar';
  
  toolbar.appendChild(btnValidate);
  toolbar.appendChild(btnClear);
  cluesSection.appendChild(toolbar);

  // Resultado
  const result = createElement('div', { class: 'feedback', id: 'enigma-result' });
  cluesSection.appendChild(result);

  // Sección del tablero
  const boardSection = createElement('section', { class: 'ein-board' });
  const boardTitle = createElement('h2');
  boardTitle.textContent = 'Tablero';
  boardSection.appendChild(boardTitle);
  
  const board = createElement('div', { id: 'enigma-board' });
  boardSection.appendChild(board);

  // Sección de la paleta
  const paletteSection = createElement('section', { class: 'ein-palette' });
  const paletteTitle = createElement('h2');
  paletteTitle.textContent = 'Tarjetas';
  paletteSection.appendChild(paletteTitle);
  
  const palette = createElement('div', { id: 'enigma-palette' });
  paletteSection.appendChild(palette);

  // Ensamblar grid
  grid.appendChild(cluesSection);
  grid.appendChild(boardSection);
  grid.appendChild(paletteSection);
  box.appendChild(grid);

  return {
    box,
    status,
    cluesContainer,
    btnValidate: document.getElementById('enigma-validate') || btnValidate,
    btnClear: document.getElementById('enigma-clear') || btnClear,
    result,
    board,
    palette
  };
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const response = await fetch(data.json_url, { 
      cache: 'default',
      headers: { 'Cache-Control': 'max-age=300' }
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: No se pudo cargar la configuración`);
    }
    
    return await response.json();
  }

  if (data && (data.categories || data.constraints || data.clues)) {
    return data;
  }

  throw new Error('Faltan datos: se requiere data.json_url o configuración directa');
}

function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  // Establecer atributos
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });

  // Agregar hijos
  const childArray = Array.isArray(children) ? children : [children];
  childArray.filter(child => child != null).forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
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

function escapeCSS(str) {
  if (!str) return '';
  // Usar la API nativa del navegador si está disponible
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  
  // Fallback manual
  return String(str).replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\  // Estado
  const status = createElement('div', { class');
}