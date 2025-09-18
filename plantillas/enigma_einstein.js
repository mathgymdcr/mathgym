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
        if (!config || !config.solution) {
          setStatus(ui.result, 'No hay solución en el JSON (campo "solution").', 'ko');
          return;
        }
        const out = checkAgainstSolutionIgnoreOrder(gameState, categories, config.solution);
        setStatus(ui.result, out.ok ? '¡Correcto!' : out.msg, out.ok ? 'ok' : 'ko');
      });
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
    if (ui.btnClear) {
      ui.btnClear.addEventListener('click', () => {
        clearBoard(ui.board, gameState, categories, BOARD_SIZE);
        gameState.selected = null;
        // Quitar resaltado en la paleta
        ui.palette.querySelectorAll('.card.is-selected').forEach(el => el.classList.remove('is-selected'));
        // Mensaje
        setStatus(ui.result, 'Tablero limpiado', 'ok');
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
function checkAgainstSolutionFlexible(state, categories, solution) {
  const categoryKeys = Object.keys(categories);
  const SIZE = 4;

  // 1) Construir, por columna, el mapa {cat: valor}
  const picksByCol = [];
  for (let col = 0; col < SIZE; col++) {
    const picks = {};
    for (const cat of categoryKeys) {
      const set = state.board[col]?.[cat] || new Set();
      if (set.size !== 1) {
        return { ok: false, msg: `En la columna ${col + 1}, debes elegir exactamente 1 valor de "${cat}".` };
      }
      picks[cat] = [...set][0];
    }
    picksByCol.push(picks);
  }

  // 2) Para cada columna, buscar qué persona(s) de la solución encajan con todos los pares seleccionados
  const personas = Object.keys(solution);
  const used = new Set();
  const assignment = {}; // persona -> col

  for (let col = 0; col < SIZE; col++) {
    const picks = picksByCol[col];

    // Candidatos: personas cuyo registro coincide en TODOS los cat!=Persona
    const candidates = personas.filter(p => {
      const sol = solution[p];
      return Object.keys(sol).every(cat => sol[cat] === picks[cat]);
    });

    if (candidates.length === 0) {
      // Buscar el primer conflicto para mensaje más claro
      const details = [];
      for (const p of personas) {
        const sol = solution[p];
        const mismatch = Object.keys(sol).find(cat => sol[cat] !== picks[cat]);
        if (mismatch) details.push(`${p}: ${mismatch} debería ser "${sol[mismatch]}"`);
      }
      return {
        ok: false,
        msg: `La columna ${col + 1} no coincide con ninguna persona de la solución. ` +
             (details.length ? `Ej.: ${details[0]}.` : '')
      };
    }

    if (candidates.length > 1) {
      return {
        ok: false,
        msg: `La columna ${col + 1} es ambigua (encaja con ${candidates.join(', ')}). ` +
             `Asegúrate de seleccionar 1 valor por categoría y que sean los correctos.`
      };
    }

    const person = candidates[0];
    if (used.has(person)) {
      return { ok: false, msg: `La persona "${person}" aparece duplicada en más de una columna.` };
    }
    used.add(person);
    assignment[person] = col;
  }

  // 3) Si todas las personas están asignadas sin conflictos, es correcto
  return { ok: true, msg: '¡Correcto!' };
}

function checkAgainstSolutionIgnoreOrder(state, categories, solution) {
  const SIZE = 4;

  // Las categorías a chequear se toman de la solución (no exigimos "Persona" como chip)
  const personas = Object.keys(solution);
  if (personas.length !== SIZE) {
    return { ok: false, msg: 'La solución no tiene 4 personas.' };
  }
  // Suponemos que todas las personas tienen las mismas claves (p. ej., Camiseta/Bebida/Mascota)
  const catsToCheck = Object.keys(solution[personas[0]]); // p.ej. ["Camiseta","Bebida","Mascota"]

  // 1) Recolectar lo que el usuario ha puesto en cada columna (1 valor exacto por categoría a chequear)
  const picksByCol = []; // [{Camiseta:'Azul',Bebida:'Agua',Mascota:'Tortuga'}, ...]
  for (let col = 0; col < SIZE; col++) {
    const picks = {};
    for (const cat of catsToCheck) {
      const set = state.board[col]?.[cat] || new Set();
      if (set.size !== 1) {
        return { ok: false, msg: `En la columna ${col + 1}, en "${cat}" debe haber exactamente 1 selección.` };
      }
      picks[cat] = [...set][0];
    }
    picksByCol.push(picks);
  }

  // 2) Construir candidatos: para cada columna, qué persona(s) de la solución encajan exactamente
  const candidatesByCol = picksByCol.map(picks => {
    return personas.filter(p => {
      const sol = solution[p];
      return catsToCheck.every(cat => sol[cat] === picks[cat]);
    });
  });

  // Si alguna columna no encaja con nadie, error claro
  for (let i = 0; i < SIZE; i++) {
    if (candidatesByCol[i].length === 0) {
      // Intentar dar una pista del primer mismatch
      const det = [];
      for (const p of personas) {
        const sol = solution[p];
        const mis = catsToCheck.find(cat => sol[cat] !== picksByCol[i][cat]);
        if (mis) det.push(`${p}: ${mis} debería ser "${sol[mis]}"`);
      }
      return {
        ok: false,
        msg: `La columna ${i + 1} no coincide con ninguna persona. ` + (det[0] ? `Ej.: ${det[0]}.` : '')
      };
    }
  }

  // 3) Resolver asignación persona↔columna ignorando orden (backtracking sobre 4! = 24)
  const used = new Set();
  const assign = new Array(SIZE); // assign[col] = persona

  function bt(col) {
    if (col === SIZE) return true;
    for (const p of candidatesByCol[col]) {
      if (used.has(p)) continue;
      used.add(p);
      assign[col] = p;
      if (bt(col + 1)) return true;
      used.delete(p);
    }
    return false;
  }

  const ok = bt(0);
  if (!ok) {
    // Si no hay asignación global única con las selecciones actuales
    // puede ser porque haya ambigüedad o conflicto cruzado.
    return { ok: false, msg: 'Las selecciones no forman una asignación válida persona↔columna.' };
  }

  // 4) Si llegamos aquí, hay una asignación válida: ¡Correcto!
  return { ok: true, msg: '¡Correcto!' };
}

