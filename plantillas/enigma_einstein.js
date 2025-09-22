// ===== ARCHIVO COMPLETO: plantillas/enigma_einstein.js =====
export async function render(root, data, hooks) {
  root.innerHTML = '';
  
  const ui = buildShell();
  root.append(ui.box);

  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: No se pudo cargar el enigma', 'ko');
    return;
  }

  const allCategories = Object.keys(config.categories || {});
  if (allCategories.length < 4) {
    setStatus(ui.status, 'Error: Faltan categorías en el enigma', 'ko');
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

  setStatus(ui.status, 'Listo para jugar', 'ok');

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
          setStatus(ui.result, 'No hay solución definida', 'ko');
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
        setStatus(ui.result, 'Tablero limpio', 'ok');
      });
    }
  }
}

function buildShell() {
  const box = createElement('div', { class: 'template-box' });
  
  // Header con Einstein y efecto luminoso
  const header = createElement('div', { 
    class: 'enigma-header', 
    style: 'display: flex; align-items: center; gap: 16px; margin-bottom: 16px; position: relative; overflow: hidden;' 
  });
  
  const einsteinImg = createElement('img', {
    src: 'assets/einstein-caricature.png',
    alt: 'Einstein',
    style: 'width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--accent); z-index: 2; position: relative;'
  });
  einsteinImg.onerror = () => einsteinImg.style.display = 'none';
  
  const title = createElement('h2', { 
    style: 'margin: 0; color: var(--accent); font-size: 1.5rem; z-index: 2; position: relative;' 
  });
  title.textContent = 'Resuelve el enigma';
  
  // Efecto luminoso animado
  const lightEffect = createElement('div', {
    style: `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(108, 92, 231, 0.3), transparent);
      animation: slideLight 3s infinite;
      z-index: 1;
    `
  });
  
  header.appendChild(lightEffect);
  header.appendChild(einsteinImg);
  header.appendChild(title);
  box.appendChild(header);

  // Recuadro de instrucciones con Deceerre - Elegante y vistoso
  const instructionsBox = createElement('div', { 
    class: 'card deceerre-instructions',
    style: `
      display: flex; 
      align-items: center; 
      gap: 20px; 
      margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(108, 92, 231, 0.1), rgba(168, 85, 247, 0.1));
      border: 2px solid transparent;
      border-radius: 16px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    `
  });
  
  // Efecto de borde animado
  const borderEffect = createElement('div', {
    style: `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 16px;
      padding: 2px;
      background: linear-gradient(45deg, var(--accent), #a855f7, var(--accent));
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: subtract;
      opacity: 0.6;
    `
  });
  instructionsBox.appendChild(borderEffect);
  
  const deceerreImg = createElement('img', {
    src: 'assets/deceerre-instructions.png',
    alt: 'Deceerre',
    style: `
      width: 90px; 
      height: 90px; 
      flex-shrink: 0;
      filter: drop-shadow(0 4px 12px rgba(108, 92, 231, 0.3));
      transition: transform 0.3s ease;
      z-index: 2;
      position: relative;
    `
  });
  deceerreImg.onerror = () => deceerreImg.style.display = 'none';
  
  const instructionsContent = createElement('div', {
    style: 'flex: 1; z-index: 2; position: relative;'
  });
  
  const instructionsTitle = createElement('h3', {
    style: `
      margin: 0 0 8px 0;
      color: var(--accent);
      font-size: 1.1rem;
      font-weight: 700;
    `
  });
  instructionsTitle.textContent = '¡Hola, detective!';
  
  const instructionsText = createElement('p', {
    style: `
      margin: 0;
      color: var(--fg);
      line-height: 1.5;
      font-size: 0.95rem;
    `
  });
  instructionsText.innerHTML = 'Soy <strong>Deceerre</strong> y te voy a ayudar a resolver este enigma. Selecciona una tarjeta y colócala en el tablero. Recuerda: cada <strong>COLUMNA</strong> debe tener exactamente una tarjeta de cada categoría. Usa tu lógica y las pistas para descifrar el misterio. <span style="color: var(--accent); font-weight: 600;">¡Tú puedes!</span>';
  
  instructionsContent.appendChild(instructionsTitle);
  instructionsContent.appendChild(instructionsText);
  
  instructionsBox.appendChild(deceerreImg);
  instructionsBox.appendChild(instructionsContent);
  
  // Efecto hover
  instructionsBox.addEventListener('mouseenter', () => {
    instructionsBox.style.transform = 'translateY(-2px) scale(1.01)';
    instructionsBox.style.boxShadow = '0 8px 25px rgba(108, 92, 231, 0.2)';
    deceerreImg.style.transform = 'scale(1.05) rotate(1deg)';
  });
  
  instructionsBox.addEventListener('mouseleave', () => {
    instructionsBox.style.transform = 'translateY(0) scale(1)';
    instructionsBox.style.boxShadow = 'none';
    deceerreImg.style.transform = 'scale(1) rotate(0deg)';
  });
  
  box.appendChild(instructionsBox);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const grid = createElement('div', { class: 'ein-grid' });

  const cluesSection = createElement('section', { class: 'ein-clues' });
  const cluesTitle = createElement('h2');
  cluesTitle.textContent = 'Pistas';
  cluesSection.appendChild(cluesTitle);
  
  const cluesContainer = createElement('ol');
  cluesSection.appendChild(cluesContainer);

  const toolbar = createElement('div', { class: 'toolbar' });
  const btnValidate = createElement('button', { class: 'btn' });
  btnValidate.textContent = 'Comprobar';
  
  const btnClear = createElement('button', { class: 'btn' });
  btnClear.textContent = 'Borrar todo';
  
  toolbar.appendChild(btnValidate);
  toolbar.appendChild(btnClear);
  cluesSection.appendChild(toolbar);

  const result = createElement('div', { class: 'feedback' });
  cluesSection.appendChild(result);

  const boardSection = createElement('section', { class: 'ein-board' });
  const boardTitle = createElement('h2');
  boardTitle.textContent = 'Tablero';
  boardSection.appendChild(boardTitle);
  
  const board = createElement('div');
  boardSection.appendChild(board);

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

  // Añadir estilos CSS para las animaciones
  if (!document.getElementById('enigma-animations')) {
    const style = createElement('style', { id: 'enigma-animations' });
    style.textContent = `
      @keyframes slideLight {
        0% { left: -100%; }
        50% { left: 100%; }
        100% { left: 100%; }
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }
      
      @keyframes sparkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }

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
    } else if (key === 'style') {
      element.style.cssText = value;
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

function validateSolution(state, categories, solution) {
  const SIZE = 4;
  
  // 1) Extraer columnas del usuario y ordenar cada una alfabéticamente
  const userColumns = [];
  
  for (let col = 0; col < SIZE; col++) {
    const columnValues = [];
    
    // Extraer todos los valores de esta columna
    for (const [category, values] of Object.entries(categories)) {
      const cellData = state.board[col]?.[category];
      
      if (!cellData || !(cellData instanceof Set) || cellData.size === 0) {
        return { 
          ok: false, 
          msg: 'La columna ' + (col + 1) + ' está incompleta' 
        };
      }
      
      if (cellData.size > 1) {
        return { 
          ok: false, 
          msg: 'Tienes demasiadas opciones en la columna ' + (col + 1) 
        };
      }
      
      columnValues.push(Array.from(cellData)[0]);
    }
    
    // Ordenar los valores de esta columna alfabéticamente
    columnValues.sort();
    userColumns.push(columnValues);
  }

  // 2) Crear columnas de la solución y ordenar cada una alfabéticamente
  const solutionColumns = [];
  
  for (const [person, combo] of Object.entries(solution)) {
    const columnValues = [person]; // Incluir la persona
    
    // Añadir los otros valores
    for (const value of Object.values(combo)) {
      columnValues.push(value);
    }
    
    // Ordenar alfabéticamente
    columnValues.sort();
    solutionColumns.push(columnValues);
  }

  // 3) Contar coincidencias (sin importar orden de columnas)
  let matches = 0;
  const usedSolutionColumns = new Set();
  
  for (const userColumn of userColumns) {
    // Buscar si esta columna del usuario coincide con alguna de la solución
    for (let i = 0; i < solutionColumns.length; i++) {
      if (usedSolutionColumns.has(i)) continue; // Ya usada
      
      const solutionColumn = solutionColumns[i];
      
      // Comparar arrays
      if (userColumn.length === solutionColumn.length) {
        let isMatch = true;
        for (let j = 0; j < userColumn.length; j++) {
          if (userColumn[j] !== solutionColumn[j]) {
            isMatch = false;
            break;
          }
        }
        
        if (isMatch) {
          matches++;
          usedSolutionColumns.add(i);
          break;
        }
      }
    }
  }

  // 4) Resultado con Deceerre
  if (matches === 4) {
    return {
      ok: true,
      msg: createCelebrationMessage()
    };
  } else {
    return {
      ok: false,
      msg: 'Hay un error. Revisa las pistas.'
    };
  }
}

function createCelebrationMessage() {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex; 
    align-items: center; 
    gap: 16px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1));
    padding: 16px;
    border-radius: 12px;
    border: 2px solid rgba(16, 185, 129, 0.3);
    position: relative;
    overflow: hidden;
  `;
  
  // Efecto de partículas de celebración
  const particles = document.createElement('div');
  particles.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    background-image: 
      radial-gradient(circle at 20% 30%, rgba(255, 215, 0, 0.3) 2px, transparent 2px),
      radial-gradient(circle at 80% 70%, rgba(255, 105, 180, 0.3) 2px, transparent 2px),
      radial-gradient(circle at 40% 80%, rgba(0, 191, 255, 0.3) 2px, transparent 2px);
    background-size: 30px 30px, 25px 25px, 35px 35px;
    animation: sparkle 2s infinite;
  `;
  container.appendChild(particles);
  
  const deceerreImg = document.createElement('img');
  deceerreImg.src = 'assets/deceerre-celebration.png';
  deceerreImg.alt = 'Deceerre celebrando';
  deceerreImg.style.cssText = `
    width: 70px; 
    height: 70px; 
    flex-shrink: 0;
    filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.4));
    animation: bounce 1s infinite;
    z-index: 2;
    position: relative;
  `;
  deceerreImg.onerror = () => deceerreImg.style.display = 'none';
  
  const textContainer = document.createElement('div');
  textContainer.style.cssText = 'flex: 1; z-index: 2; position: relative;';
  
  const title = document.createElement('div');
  title.style.cssText = `
    color: var(--success);
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 4px;
  `;
  title.textContent = '¡Increíble, detective!';
  
  const message = document.createElement('div');
  message.style.cssText = 'color: var(--fg); line-height: 1.4;';
  message.innerHTML = 'Lo has resuelto perfectamente. <strong>Eres un genio de la lógica!</strong>';
  
  textContainer.appendChild(title);
  textContainer.appendChild(message);
  
  container.appendChild(deceerreImg);
  container.appendChild(textContainer);
  
  return container;
}