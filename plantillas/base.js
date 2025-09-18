// ===== plantillas/base.js (CORREGIDO) =====
// Loader dinámico de plantillas
window.Templates = (function() {
  const loaders = {
    'enigma-einstein': () => import('./enigma_einstein.js'),
    'relojes-arena': () => import('./relojes_arena.js'),
    'jarras-exactas': () => import('./jarras_exactas.js'),
    'plantas': () => import('./plantas.js')
  };

  async function render(tipo, data, container, hooks) {
    if (!loaders[tipo]) {
      container.innerHTML = `<p>Plantilla no encontrada: <code>${tipo}</code></p>`;
      return;
    }

    try {
      const mod = await loaders[tipo]();
      if (typeof mod.render !== 'function') {
        container.innerHTML = `<p>La plantilla <code>${tipo}</code> no expone render()</p>`;
        return;
      }
      await mod.render(container, data, hooks || {});
    } catch (error) {
      console.error('Error cargando plantilla:', error);
      container.innerHTML = `<p>Error al cargar la plantilla <code>${tipo}</code>: ${error.message}</p>`;
    }
  }

  return { render };
})();

// ===== plantillas/relojes_arena.js (CORREGIDO) =====
export async function render(root, data, hooks) {
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Relojes de arena</div>
      <p>Plantilla en desarrollo...</p>
    </div>
  `;
}

// ===== plantillas/jarras_exactas.js (CORREGIDO) =====
export async function render(root, data, hooks) {
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Jarras exactas</div>
      <p>Plantilla en desarrollo...</p>
    </div>
  `;
}

// ===== plantillas/plantas.js (CORREGIDO) =====
export async function render(root, data, hooks) {
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Plantas</div>
      <p>Plantilla en desarrollo...</p>
    </div>
  `;
}

// ===== data/enigma_2025-09-15.json (CORREGIDO - Sin caracteres raros) =====
{
  "houses": 4,
  "categories": {
    "Persona": ["Ana", "Beto", "Cora", "Damian"],
    "Color": ["Roja", "Verde", "Azul", "Amarilla"],
    "Bebida": ["Cafe", "Te", "Agua", "Zumo"],
    "Mascota": ["Perro", "Gato", "Pez", "Tortuga"]
  },
  "constraints": [
    {"type": "eq", "a": {"cat": "Persona", "val": "Ana"}, "b": {"cat": "Color", "val": "Roja"}},
    {"type": "left_of", "a": {"cat": "Color", "val": "Verde"}, "b": {"cat": "Color", "val": "Azul"}},
    {"type": "eq", "a": {"cat": "Bebida", "val": "Te"}, "b": {"cat": "Persona", "val": "Damian"}},
    {"type": "eq", "a": {"cat": "Mascota", "val": "Pez"}, "b": {"cat": "Persona", "val": "Cora"}}
  ],
  "clues": [
    "Ana vive en la casa roja.",
    "La casa verde esta a la izquierda de la casa azul.",
    "Damian bebe te.",
    "Cora tiene un pez.",
    "Beto no tiene tortuga.",
    "Quien bebe agua no vive en la casa amarilla.",
    "El dueno del perro no bebe cafe.",
    "La casa 1 no bebe zumo.",
    "La casa 4 no es roja.",
    "El que tiene gato vive junto al que bebe agua."
  ]
}

// ===== plantillas/enigma_einstein.js (VERSIÓN SIMPLIFICADA Y SEGURA) =====
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
        setStatus(ui.result, 'Progreso guardado!', 'ok');
      });
    }

    if (ui.btnClear) {
      ui.btnClear.addEventListener('click', () => {
        clearBoard(ui.board, state, categories, boardSize);
        setStatus(ui.result, 'Tablero limpiado', 'ok');
      });
    }
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

// FUNCIONES DE UTILIDAD
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
  const btnValidate = createElement('button', { class: 'btn', id: 'enigma-validate' });
  btnValidate.textContent = 'Validar';
  
  const btnClear = createElement('button', { class: 'btn', id: 'enigma-clear' });
  btnClear.textContent = 'Limpiar';
  
  toolbar.appendChild(btnValidate);
  toolbar.appendChild(btnClear);
  cluesSection.appendChild(toolbar);

  const result = createElement('di