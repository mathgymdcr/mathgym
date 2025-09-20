// ===== ARCHIVO CORREGIDO: plantillas/enigma_einstein.js =====
export async function render(root, data, hooks) {
  // Limpiar contenedor
  root.innerHTML = '';
  
  const ui = buildShell();
  root.append(ui.box);

  // Cargar configuracion
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  // Validar categorias
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
  setupEventListeners(ui, gameState, categories, BOARD_SIZE, config);

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

  function setupEventListeners(ui, state, categories, boardSize, config) {
    if (ui.btnValidate) {
      ui.btnValidate.addEventListener('click', () => {
        if (!config || !config.solution) {
          setStatus(ui.result, 'No hay solucion en el JSON (campo "solution").', 'ko');
          return;
        }
        const out = checkAgainstSolutionIgnoreOrder(state, categories, config.solution);
        setStatus(ui.result, out.ok ? 'Correcto!' : out.msg, out.ok ? 'ok' : 'ko');
      });
    }

    if (ui.btnClear) {
      ui.btnClear.addEventListener('click', () => {
        clearBoard(ui.board, state, categories, boardSize);
        state.selected = null;
        // Quitar resaltado en la paleta
        ui.palette.querySelectorAll('.card.is-selected').forEach(el => el.classList.remove('is-selected'));
        // Mensaje
        setStatus(ui.result, 'Tablero limpiado', 'ok');
      });
    }
  }

  function clearBoard(container, state, categories, size) {
    for (let i = 0; i < size; i++) {
      state.board[i] = {};
    }
    // Quitar chips del DOM
    container.querySelectorAll('.cell').forEach(cell => {
      cell.innerHTML = '';
    });
  }
}

// FUNCIONES DE UTILIDAD - buildShell() CORREGIDA Y UNIFICADA
// En plantillas/enigma_einstein.js - Modificar la función buildShell()

function buildShell() {
  const box = createElement('div', { class: 'template-box' });
  
  // Header con Einstein integrado
  const header = createElement('div', { class: 'enigma-header' });
  header.innerHTML = `
    <div class="einstein-container">
      <img src="assets/einstein-caricature.png" alt="Einstein" class="einstein-avatar">
      <div class="header-content">
        <h2 class="enigma-title">Resuelve el enigma</h2>
        <p class="enigma-subtitle">Coloca las tarjetas cumpliendo las pistas</p>
      </div>
    </div>
  `;
  box.appendChild(header);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // ... resto del código igual
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

// Función para validar solución - Versión final optimizada
// FUNCIÓN DE VALIDACIÓN CORREGIDA para enigma_einstein.js
// Reemplaza las funciones de validación existentes

function checkAgainstSolutionIgnoreOrder(state, categories, solution) {
  const SIZE = 4;

  // Obtener todas las personas de la solución
  const personas = Object.keys(solution);
  if (personas.length !== SIZE) {
    return { ok: false, msg: 'La solución debe tener exactamente 4 personas.' };
  }

  // Obtener las categorías a validar (excluyendo "Persona" si existe)
  const firstPerson = personas[0];
  const catsToCheck = Object.keys(solution[firstPerson]); // Ej: ["Camiseta", "Bebida", "Mascota"]

  // 1) Validar que cada columna tenga exactamente 1 selección por categoría
  const picksByCol = [];
  for (let col = 0; col < SIZE; col++) {
    const picks = {};
    let hasSelections = false;

    for (const cat of catsToCheck) {
      const cellData = state.board[col]?.[cat];
      
      if (!cellData || !(cellData instanceof Set)) {
        return { ok: false, msg: `La columna ${col + 1} no tiene selección en "${cat}".` };
      }

      if (cellData.size !== 1) {
        if (cellData.size === 0) {
          return { ok: false, msg: `Falta seleccionar un valor en "${cat}" para la columna ${col + 1}.` };
        } else {
          return { ok: false, msg: `Hay ${cellData.size} valores seleccionados en "${cat}" para la columna ${col + 1}. Debe ser exactamente 1.` };
        }
      }

      const selectedValue = Array.from(cellData)[0];
      picks[cat] = selectedValue;
      hasSelections = true;
    }

    if (!hasSelections) {
      return { ok: false, msg: `La columna ${col + 1} está vacía.` };
    }

    picksByCol.push(picks);
  }

  // 2) Para cada columna, encontrar qué persona(s) de la solución coinciden
  const candidatesByCol = picksByCol.map((picks, colIndex) => {
    const candidates = personas.filter(persona => {
      const solPerson = solution[persona];
      return catsToCheck.every(cat => {
        const expected = solPerson[cat];
        const actual = picks[cat];
        return expected === actual;
      });
    });

    // Debug info para diagnóstico
    if (candidates.length === 0) {
      console.log(`Columna ${colIndex + 1}:`, picks);
      console.log('No coincide con ninguna persona. Comparando con solución:');
      personas.forEach(p => {
        const sol = solution[p];
        const diffs = catsToCheck.filter(cat => sol[cat] !== picks[cat]);
        if (diffs.length > 0) {
          console.log(`  ${p}: difiere en ${diffs.map(cat => `${cat} (esperado: ${sol[cat]}, actual: ${picks[cat]})`).join(', ')}`);
        }
      });
    }

    return candidates;
  });

  // 3) Verificar que cada columna tenga al menos un candidato
  for (let col = 0; col < SIZE; col++) {
    if (candidatesByCol[col].length === 0) {
      // Dar información específica sobre qué está mal
      const picks = picksByCol[col];
      const details = [];
      
      personas.forEach(persona => {
        const sol = solution[persona];
        const mismatches = catsToCheck.filter(cat => sol[cat] !== picks[cat]);
        if (mismatches.length > 0) {
          const first = mismatches[0];
          details.push(`Para ${persona}, "${first}" debería ser "${sol[first]}" no "${picks[first]}"`);
        }
      });

      return {
        ok: false,
        msg: `La columna ${col + 1} no coincide con ninguna persona de la solución. ${details[0] || ''}`
      };
    }
  }

  // 4) Intentar encontrar una asignación única usando backtracking
  const used = new Set();
  const assignment = new Array(SIZE);

  function backtrack(col) {
    if (col === SIZE) {
      return true; // Encontramos una asignación completa
    }

    for (const persona of candidatesByCol[col]) {
      if (used.has(persona)) {
        continue; // Esta persona ya está asignada
      }

      used.add(persona);
      assignment[col] = persona;

      if (backtrack(col + 1)) {
        return true;
      }

      // Backtrack
      used.delete(persona);
      assignment[col] = null;
    }

    return false;
  }

  if (!backtrack(0)) {
    return {
      ok: false,
      msg: 'No se puede encontrar una asignación única de personas a columnas. Verifica que no haya conflictos entre las selecciones.'
    };
  }

  // 5) Si llegamos aquí, encontramos una asignación válida
  console.log('Asignación encontrada:', assignment.map((persona, col) => `Columna ${col + 1}: ${persona}`));
  
  return { ok: true, msg: '¡Solución correcta!' };
}

// Función auxiliar para debug - puedes usarla para diagnosticar problemas
function debugGameState(state, categories) {
  console.log('=== DEBUG: Estado actual del juego ===');
  
  const categoryKeys = Object.keys(categories);
  const SIZE = 4;

  for (let col = 0; col < SIZE; col++) {
    console.log(`Columna ${col + 1}:`);
    
    for (const cat of categoryKeys) {
      const cellData = state.board[col]?.[cat];
      
      if (!cellData || cellData.size === 0) {
        console.log(`  ${cat}: (vacío)`);
      } else {
        const values = Array.from(cellData);
        console.log(`  ${cat}: [${values.join(', ')}]`);
      }
    }
  }
}

