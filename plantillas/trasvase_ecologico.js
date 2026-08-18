// plantillas/trasvase_ecologico.js
// Plantilla unificada de trasvase de líquidos, con variantes:
//   - "ecologico": agua limitada (sin grifo), regar la planta = comprobar
//   - "clasico"   ("Jarras Exactas"): grifo infinito (llenar/vaciar), Comprobar genérico
import { celebrate } from './celebration.js';

const VARIANTS = {
  ecologico: {
    icon: '💧',
    title: 'Trasvase Ecológico',
    hasTap: false,
    hasPlant: true,
    intro: 'Trasvasa agua entre los recipientes haciendo clic primero en el origen y luego en el destino.',
    goalLine: target => `Cuando un recipiente tenga exactamente <span class="target-amount">${target}</span>, selecciónalo y pulsa <strong>Regar planta</strong> para comprobar tu respuesta.`
  },
  clasico: {
    icon: '🏺',
    title: 'Jarras Exactas',
    hasTap: true,
    hasPlant: false,
    intro: 'Llena y vacía las jarras desde el grifo, o trasvasa agua entre ellas haciendo clic primero en el origen y luego en el destino.',
    goalLine: target => `Consigue exactamente <span class="target-amount">${target}</span> en cualquier jarra y pulsa <strong>Comprobar</strong>.`
  }
};

export async function render(root, data, hooks) {
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  if (!config.capacities || !config.target) {
    setStatus(ui.status, 'Error: Faltan capacidades y objetivo', 'ko');
    return;
  }

  const variant = VARIANTS[config.variant] || VARIANTS.ecologico;
  applyVariant(ui, variant, config.target);

  const gameState = initializeGame(config, variant);

  renderRecipients(ui.recipientsContainer, gameState);
  setupEventListeners(ui, gameState, config, variant);

  setStatus(ui.status, 'Listo para trasvasar', 'ok');

  function initializeGame(cfg, v) {
    const levels = cfg.initialLevels
      || (v.hasTap ? cfg.capacities.map(() => 0) : [cfg.capacities[0], ...Array(cfg.capacities.length - 1).fill(0)]);
    return {
      capacities: cfg.capacities,
      levels,
      target: cfg.target,
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

      const capacityLabel = createElement('div', { class: 'capacity-label' });
      capacityLabel.textContent = `${capacity}L`;
      recipient.appendChild(capacityLabel);

      const vessel = createElement('div', { class: 'vessel' });
      vessel.style.height = (capacity * 20) + 'px';

      const water = createElement('div', { class: 'water' });
      updateWaterLevel(water, state.levels[index], capacity);
      vessel.appendChild(water);

      recipient.appendChild(vessel);

      recipient.addEventListener('click', () => handleRecipientClick(index, state, ui));

      container.appendChild(recipient);
    });
  }

  function updateWaterLevel(waterElement, level, capacity) {
    const percentage = (level / capacity) * 100;
    waterElement.style.height = percentage + '%';
  }

  function handleRecipientClick(index, state, uiRef) {
    if (state.selected === null) {
      state.selected = index;
      highlightSelected(uiRef.recipientsContainer, index);
      setStatus(uiRef.message, `Recipiente ${index + 1} seleccionado. Click en destino, o usa los botones.`, '');
    } else if (state.selected === index) {
      state.selected = null;
      clearHighlight(uiRef.recipientsContainer);
      setStatus(uiRef.message, 'Selección cancelada.', '');
    } else {
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
        clearHighlight(uiRef.recipientsContainer);
        updateUI(uiRef, state);

        setStatus(uiRef.message, `Trasvasados ${amount}L. Movimientos: ${state.moves}`, 'ok');
      } else {
        setStatus(uiRef.message, 'No se puede trasvasar aquí.', 'ko');
      }
    }
  }

  function updateUI(uiRef, state) {
    const recipients = uiRef.recipientsContainer.querySelectorAll('.recipient');
    recipients.forEach((recipient, index) => {
      const water = recipient.querySelector('.water');
      updateWaterLevel(water, state.levels[index], state.capacities[index]);
    });
  }

  function highlightSelected(container, index) {
    clearHighlight(container);
    const recipient = container.querySelector(`[data-index="${index}"]`);
    if (recipient) recipient.classList.add('selected');
  }

  function clearHighlight(container) {
    container.querySelectorAll('.recipient').forEach(r => r.classList.remove('selected'));
  }

  function handleVictory(uiRef, state, message) {
    setStatus(uiRef.result, `¡Objetivo conseguido! ${state.target}L en ${state.moves} movimientos`, 'ok');
    celebrate({ ok: true, message });
    if (hooks && hooks.onSuccess) hooks.onSuccess();

    if (uiRef.plantButton) {
      uiRef.plantButton.classList.add('celebration');
      setTimeout(() => uiRef.plantButton.classList.remove('celebration'), 2000);
    }
  }

  function setupEventListeners(uiRef, state, cfg, v) {
    uiRef.btnEmpty.addEventListener('click', () => {
      if (state.selected === null) {
        setStatus(uiRef.message, 'Selecciona un recipiente primero', 'ko');
        return;
      }
      state.levels[state.selected] = 0;
      state.moves++;
      clearHighlight(uiRef.recipientsContainer);
      updateUI(uiRef, state);
      setStatus(uiRef.message, `Recipiente vaciado. Movimientos: ${state.moves}`, 'ok');
      state.selected = null;
    });

    if (v.hasTap) {
      uiRef.btnFill.addEventListener('click', () => {
        if (state.selected === null) {
          setStatus(uiRef.message, 'Selecciona un recipiente primero', 'ko');
          return;
        }
        state.levels[state.selected] = state.capacities[state.selected];
        state.moves++;
        updateUI(uiRef, state);
        setStatus(uiRef.message, `Recipiente ${state.selected + 1} llenado. Movimientos: ${state.moves}`, 'ok');
      });
    }

    if (v.hasPlant) {
      uiRef.plantButton.addEventListener('click', () => {
        if (state.selected === null) {
          setStatus(uiRef.message, 'Selecciona el recipiente con la cantidad exacta primero', 'ko');
          return;
        }
        if (state.levels[state.selected] === state.target) {
          const wateredIndex = state.selected;
          state.levels[wateredIndex] = 0;
          state.selected = null;
          clearHighlight(uiRef.recipientsContainer);
          updateUI(uiRef, state);
          handleVictory(uiRef, state, `Regaste la planta con ${state.target}L en ${state.moves} movimientos`);
        } else {
          setStatus(uiRef.message, 'Todavía no es la cantidad exacta. Sigue intentando.', 'ko');
        }
      });
    } else {
      uiRef.btnCheck.addEventListener('click', () => {
        if (state.levels.includes(state.target)) {
          handleVictory(uiRef, state, `Conseguiste ${state.target}L en ${state.moves} movimientos`);
        } else {
          setStatus(uiRef.message, 'Todavía no hay ninguna jarra con la cantidad exacta.', 'ko');
        }
      });
    }

    uiRef.btnReset.addEventListener('click', () => {
      state.levels = initializeGame(cfg, v).levels;
      state.selected = null;
      state.moves = 0;

      clearHighlight(uiRef.recipientsContainer);
      updateUI(uiRef, state);
      setStatus(uiRef.message, 'Juego reiniciado', 'ok');
      setStatus(uiRef.result, '', '');
    });

    uiRef.btnHint.addEventListener('click', () => {
      const hints = cfg.hints || [
        'Intenta llenar completamente un recipiente pequeño',
        'Usa el recipiente más grande como almacén temporal',
        'A veces hay que vaciar recipientes para hacer espacio'
      ];
      const randomHint = hints[Math.floor(Math.random() * hints.length)];
      setStatus(uiRef.message, `Pista: ${randomHint}`, '');
    });
  }
}

function applyVariant(ui, variant, target) {
  ui.headerIcon.textContent = variant.icon;
  ui.headerTitle.textContent = variant.title;
  ui.instructionsBody.innerHTML = `<h3>Cómo se juega</h3><p>${variant.intro}</p><p>${variant.goalLine(target + 'L')}</p>`;
  ui.btnFill.style.display = variant.hasTap ? '' : 'none';
  ui.plantSection.style.display = variant.hasPlant ? '' : 'none';
  ui.btnCheck.style.display = variant.hasPlant ? 'none' : '';
}

// FUNCIONES DE UTILIDAD
function buildShell() {
  const box = createElement('div', { class: 'template-box trasvase-game' });

  const header = createElement('div', { class: 'enigma-header-dark' });
  const headerIcon = createElement('span', { class: 'enigma-header-icon' });
  const headerTitle = document.createElement('h2');
  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  box.appendChild(header);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const instructions = createElement('div', { class: 'card deceerre-instructions' });
  const instructionsImg = createElement('img', { src: 'assets/deceerre-instructions.png', alt: 'Deceerre' });
  const instructionsBody = createElement('div', { class: 'instructions-body' });
  instructions.appendChild(instructionsImg);
  instructions.appendChild(instructionsBody);
  box.appendChild(instructions);

  const recipientsContainer = createElement('div', { class: 'trasvase-recipients' });
  box.appendChild(recipientsContainer);

  const controls = createElement('div', { class: 'trasvase-controls' });

  const btnFill = createElement('button', { class: 'btn btn-secondary' });
  btnFill.textContent = 'Llenar';

  const btnEmpty = createElement('button', { class: 'btn btn-secondary' });
  btnEmpty.textContent = 'Vaciar seleccionado';

  const btnCheck = createElement('button', { class: 'btn' });
  btnCheck.textContent = 'Comprobar';

  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';

  const btnHint = createElement('button', { class: 'btn btn-secondary' });
  btnHint.textContent = 'Pista';

  controls.appendChild(btnFill);
  controls.appendChild(btnEmpty);
  controls.appendChild(btnCheck);
  controls.appendChild(btnReset);
  controls.appendChild(btnHint);
  box.appendChild(controls);

  const plantSection = createElement('div', { class: 'trasvase-plant' });
  const plantButton = createElement('div', { class: 'plant-button' });
  plantButton.innerHTML = '<div class="plant-icon">🌱</div><div class="plant-text">Regar planta<br><small>(comprobar)</small></div>';
  plantSection.appendChild(plantButton);
  box.appendChild(plantSection);

  const message = createElement('div', { class: 'trasvase-message' });
  message.textContent = 'Selecciona un recipiente para empezar';
  box.appendChild(message);

  const result = createElement('div', { class: 'feedback' });
  box.appendChild(result);

  return {
    box,
    status,
    headerIcon,
    headerTitle,
    instructionsBody,
    recipientsContainer,
    plantSection,
    plantButton,
    btnFill,
    btnEmpty,
    btnCheck,
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
  element.className = element.className.split(' ')[0];
  if (type) {
    element.classList.add(type);
  }
}
