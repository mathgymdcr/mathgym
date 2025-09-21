// plantillas/trasvase_ecologico.js
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
  if (!config.capacities || !config.target) {
    setStatus(ui.status, 'Error: Faltan capacidades y objetivo', 'ko');
    return;
  }

  // Inicializar el juego
  const gameState = initializeGame(config);
  
  // Renderizar componentes
  renderRecipients(ui.recipientsContainer, gameState);
  setupEventListeners(ui, gameState, config);

  setStatus(ui.status, 'Listo para trasvasar', 'ok');

  // FUNCIONES DEL JUEGO
  function initializeGame(config) {
    return {
      capacities: config.capacities,
      levels: config.initialLevels || [config.capacities[0], ...Array(config.capacities.length - 1).fill(0)],
      target: config.target,
      selected: null,
      moves: 0
    };
  }

  function renderRecipients(container, state) {
    container.innerHTML = '';
    
    state.capacities.forEach((capacity, index) => {
      const recipient = createElement('div', { 
        class: 'recipient',
        'data-index': index
      });
      
      // Capacidad label
      const capacityLabel = createElement('div', { class: 'capacity-label' });
      capacityLabel.textContent = `${capacity}L`;
      recipient.appendChild(capacityLabel);
      
      // Recipiente
      const vessel = createElement('div', { class: 'vessel' });
      vessel.style.height = (capacity * 20) + 'px'; // Escala visual
      
      // Agua
      const water = createElement('div', { class: 'water' });
      updateWaterLevel(water, state.levels[index], capacity);
      vessel.appendChild(water);
      
      recipient.appendChild(vessel);
      
      // Nivel actual
      const levelLabel = createElement('div', { class: 'level-label' });
      levelLabel.textContent = `${state.levels[index]}L`;
      recipient.appendChild(levelLabel);
      
      // Event listener
      recipient.addEventListener('click', () => handleRecipientClick(index, state, ui));
      
      container.appendChild(recipient);
    });
  }

  function updateWaterLevel(waterElement, level, capacity) {
    const percentage = (level / capacity) * 100;
    waterElement.style.height = percentage + '%';
  }

  function handleRecipientClick(index, state, ui) {
    if (state.selected === null) {
      // Seleccionar recipiente
      if (state.levels[index] > 0) {
        state.selected = index;
        highlightSelected(ui.recipientsContainer, index);
        setStatus(ui.message, `Recipiente ${index + 1} seleccionado. Click en destino.`, '');
      } else {
        setStatus(ui.message, 'Recipiente vacio. Selecciona uno con agua.', 'ko');
      }
    } else if (state.selected === index) {
      // Deseleccionar
      state.selected = null;
      clearHighlight(ui.recipientsContainer);
      setStatus(ui.message, 'Seleccion cancelada.', '');
    } else {
      // Trasvasar
      const fromIndex = state.selected;
      const toIndex = index;
      
      const amount = Math.min(
        state.levels[fromIndex],
        state.capacities[toIndex] - state.levels[toIndex]
      );
      
      if (amount > 0) {
        state.levels[fromIndex] -= amount;
        state.levels[toIndex] += amount;
        state.moves++;
        
        state.selected = null;
        clearHighlight(ui.recipientsContainer);
        updateUI(ui, state);
        
        setStatus(ui.message, `Trasvasados ${amount}L. Movimientos: ${state.moves}`, 'ok');
        
        // Verificar victoria
        if (state.levels.includes(state.target)) {
          handleVictory(ui, state);
        }
      } else {
        setStatus(ui.message, 'No se puede trasvasar aqui.', 'ko');
      }
    }
  }

  function updateUI(ui, state) {
    const recipients = ui.recipientsContainer.querySelectorAll('.recipient');
    recipients.forEach((recipient, index) => {
      const water = recipient.querySelector('.water');
      const levelLabel = recipient.querySelector('.level-label');
      
      updateWaterLevel(water, state.levels[index], state.capacities[index]);
      levelLabel.textContent = `${state.levels[index]}L`;
    });
  }

  function highlightSelected(container, index) {
    clearHighlight(container);
    const recipient = container.querySelector(`[data-index="${index}"]`);
    if (recipient) {
      recipient.classList.add('selected');
    }
  }

  function clearHighlight(container) {
    container.querySelectorAll('.recipient').forEach(r => {
      r.classList.remove('selected');
    });
  }

  function handleVictory(ui, state) {
    setStatus(ui.result, `Objetivo conseguido! ${state.target}L en ${state.moves} movimientos`, 'ok');
    
    // Mostrar celebración
    showCelebration(ui);
    
    // Reproducir animación de la planta (si existe)
    const plantButton = ui.plantButton;
    if (plantButton) {
      plantButton.classList.add('celebration');
      setTimeout(() => {
        plantButton.classList.remove('celebration');
      }, 2000);
    }
  }

  function showCelebration(ui) {
    const celebration = createElement('div', { class: 'celebration-overlay' });
    celebration.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-text">Reto superado!</div>
        <div class="celebration-emoji">🌟</div>
      </div>
    `;
    
    ui.box.appendChild(celebration);
    
    setTimeout(() => {
      celebration.remove();
    }, 3000);
  }

  function setupEventListeners(ui, state, config) {
    // Botón de la planta (vaciar seleccionado)
    if (ui.plantButton) {
      ui.plantButton.addEventListener('click', () => {
        if (state.selected !== null) {
          state.levels[state.selected] = 0;
          state.moves++;
          
          clearHighlight(ui.recipientsContainer);
          updateUI(ui, state);
          
          setStatus(ui.message, `Recipiente vaciado. Movimientos: ${state.moves}`, 'ok');
          
          state.selected = null;
        } else {
          setStatus(ui.message, 'Selecciona un recipiente primero', 'ko');
        }
      });
    }

    // Botón reiniciar
    if (ui.btnReset) {
      ui.btnReset.addEventListener('click', () => {
        state.levels = config.initialLevels || [config.capacities[0], ...Array(config.capacities.length - 1).fill(0)];
        state.selected = null;
        state.moves = 0;
        
        clearHighlight(ui.recipientsContainer);
        updateUI(ui, state);
        setStatus(ui.message, 'Juego reiniciado', 'ok');
        setStatus(ui.result, '', '');
      });
    }

    // Botón ayuda/pista
    if (ui.btnHint) {
      ui.btnHint.addEventListener('click', () => {
        const hints = config.hints || [
          "Intenta llenar completamente un recipiente pequeño",
          "Usa el recipiente más grande como almacen temporal",
          "A veces hay que vaciar recipientes para hacer espacio"
        ];
        const randomHint = hints[Math.floor(Math.random() * hints.length)];
        setStatus(ui.message, `Pista: ${randomHint}`, '');
      });
    }
  }
}

// FUNCIONES DE UTILIDAD
function buildShell(data) {
  const box = createElement('div', { class: 'template-box trasvase-game' });
  
  // Badge con icono ecológico
  const badge = createElement('div', { class: 'badge' });
  badge.innerHTML = `<span>💧 Trasvase Ecológico</span>`;
  box.appendChild(badge);

  // Status
  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Objetivo
  const objective = createElement('div', { class: 'trasvase-objective' });
  objective.innerHTML = `
    <p><strong>Objetivo:</strong> Obtener exactamente <span class="target-amount">${data.target || '?'}L</span> en cualquier recipiente</p>
  `;
  box.appendChild(objective);

  // Contenedor de recipientes
  const recipientsContainer = createElement('div', { class: 'trasvase-recipients' });
  box.appendChild(recipientsContainer);

  // Controles
  const controls = createElement('div', { class: 'trasvase-controls' });
  
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  
  const btnHint = createElement('button', { class: 'btn btn-secondary' });
  btnHint.textContent = 'Pista';
  
  controls.appendChild(btnReset);
  controls.appendChild(btnHint);
  box.appendChild(controls);

  // Planta ecológica (para vaciar)
  const plantSection = createElement('div', { class: 'trasvase-plant' });
  const plantButton = createElement('div', { class: 'plant-button' });
  plantButton.innerHTML = `
    <div class="plant-icon">🌱</div>
    <div class="plant-text">Regar planta<br><small>(vaciar recipiente)</small></div>
  `;
  plantSection.appendChild(plantButton);
  box.appendChild(plantSection);

  // Mensaje de estado
  const message = createElement('div', { class: 'trasvase-message' });
  message.textContent = 'Haz clic en un recipiente para seleccionarlo';
  box.appendChild(message);

  // Resultado
  const result = createElement('div', { class: 'feedback' });
  box.appendChild(result);

  return {
    box,
    status,
    recipientsContainer,
    plantButton,
    btnReset,
    btnHint,
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

  if (data && (data.capacities || data.target)) {
    return data;
  }

  throw new Error('Faltan datos de configuracion del trasvase');
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
  element.className = element.className.split(' ')[0]; // Conservar clase base
  if (type) {
    element.classList.add(type);
  }
}