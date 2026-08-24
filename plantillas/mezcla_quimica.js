// plantillas/mezcla_quimica.js
// Síntesis de un volumen exacto trasvasando reactivo entre matraces sin
// graduar. Dos de los tres ejes del tipo se leen del payload:
//   - `grifo`: si hay dosificador, se puede llenar un matraz hasta arriba
//     y vaciarlo cuantas veces haga falta; sin él, el reactivo de partida
//     es todo el que hay.
//   - nº de matraces: la longitud de `capacities` (3 o 4).
// El gesto de victoria es el mismo en las dos variantes: seleccionar el
// matraz con el volumen exacto y verterlo en el reactor.
import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { initialLevelsMezcla } from '../scripts/mezcla-logic.js';

const PISTAS_GENERICAS = [
  'Llena del todo el matraz más pequeño y vuélcalo en uno mayor.',
  'El matraz grande sirve de depósito temporal mientras mides con los pequeños.',
  'A veces hay que vaciar un matraz para dejar sitio y poder seguir midiendo.'
];

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    root.innerHTML = `<div class="feedback ko">Error: ${error.message || error}</div>`;
    return;
  }

  if (!config.capacities || !config.target) {
    root.innerHTML = '<div class="feedback ko">Error: Faltan capacidades y objetivo</div>';
    return;
  }

  const grifo = config.grifo === true;
  const ui = buildShell(config, grifo);
  root.append(ui.box);

  const state = {
    capacities: config.capacities,
    levels: initialLevels(config, grifo),
    target: config.target,
    selected: null,
    moves: 0
  };

  renderMatraces(ui.matracesContainer, state);
  setupEventListeners(ui, state, config, grifo);

  setStatus(ui.status, 'Laboratorio listo', 'ok');

  function initialLevels(cfg, hasGrifo) {
    // El generador siempre escribe initialLevels explícito; el fallback es
    // para un payload escrito a mano, y usa la misma regla que el generador.
    if (cfg.initialLevels) return cfg.initialLevels.slice();
    return initialLevelsMezcla(cfg.capacities, hasGrifo);
  }

  function renderMatraces(container, s) {
    container.innerHTML = '';

    s.capacities.forEach((capacity, index) => {
      const matraz = createElement('div', { class: 'matraz', 'data-index': index });

      const capacityLabel = createElement('div', { class: 'capacity-label' });
      capacityLabel.textContent = `${capacity} mL`;
      matraz.appendChild(capacityLabel);

      const cuerpo = createElement('div', { class: 'matraz-cuerpo' });
      cuerpo.style.height = (capacity * 20) + 'px';

      const reactivo = createElement('div', { class: 'reactivo' });
      updateNivel(reactivo, s.levels[index], capacity);
      cuerpo.appendChild(reactivo);

      matraz.appendChild(cuerpo);

      const nivelLabel = createElement('div', { class: 'nivel-label' });
      nivelLabel.textContent = `${s.levels[index]} mL`;
      matraz.appendChild(nivelLabel);

      matraz.addEventListener('click', () => handleMatrazClick(index, s, ui));

      container.appendChild(matraz);
    });
  }

  function updateNivel(reactivoElement, level, capacity) {
    reactivoElement.style.height = ((level / capacity) * 100) + '%';
  }

  function handleMatrazClick(index, s, uiRef) {
    if (s.selected === null) {
      s.selected = index;
      highlightSelected(uiRef.matracesContainer, index);
      setStatus(uiRef.message, `Matraz ${index + 1} seleccionado. Pulsa el matraz de destino, o usa los botones.`, '');
    } else if (s.selected === index) {
      s.selected = null;
      clearHighlight(uiRef.matracesContainer);
      setStatus(uiRef.message, 'Selección cancelada.', '');
    } else {
      const fromIndex = s.selected;
      const toIndex = index;

      const amount = Math.min(
        s.levels[fromIndex],
        s.capacities[toIndex] - s.levels[toIndex]
      );

      if (amount > 0) {
        s.levels[fromIndex] -= amount;
        s.levels[toIndex] += amount;
        s.moves++;

        s.selected = null;
        clearHighlight(uiRef.matracesContainer);
        updateUI(uiRef, s);

        setStatus(uiRef.message, `Trasvasados ${amount} mL. Movimientos: ${s.moves}`, 'ok');
      } else {
        setStatus(uiRef.message, 'Ese trasvase no mueve nada: o el origen está vacío o el destino lleno.', 'ko');
      }
    }
  }

  function updateUI(uiRef, s) {
    const matraces = uiRef.matracesContainer.querySelectorAll('.matraz');
    matraces.forEach((matraz, index) => {
      updateNivel(matraz.querySelector('.reactivo'), s.levels[index], s.capacities[index]);
      matraz.querySelector('.nivel-label').textContent = `${s.levels[index]} mL`;
    });
  }

  function highlightSelected(container, index) {
    clearHighlight(container);
    const matraz = container.querySelector(`[data-index="${index}"]`);
    if (matraz) matraz.classList.add('selected');
  }

  function clearHighlight(container) {
    container.querySelectorAll('.matraz').forEach(m => m.classList.remove('selected'));
  }

  function handleVictory(uiRef, s) {
    setStatus(uiRef.result, `¡Compuesto sintetizado! ${s.target} mL en ${s.moves} movimientos`, 'ok');
    // El pie se queda si no: al verter se deselecciona el matraz, y dejar ahí
    // un "Matraz N seleccionado" contradice lo que muestra el tablero.
    setStatus(uiRef.message, 'El compuesto ya está en el reactor.', 'ok');
    celebrate({ ok: true, message: `Vertiste ${s.target} mL exactos en el reactor en ${s.moves} movimientos` });
    if (hooks && hooks.onSuccess) hooks.onSuccess();

    uiRef.reactorButton.classList.add('celebration');
    setTimeout(() => uiRef.reactorButton.classList.remove('celebration'), 2000);
  }

  function setupEventListeners(uiRef, s, cfg, hasGrifo) {
    uiRef.btnEmpty.addEventListener('click', () => {
      if (s.selected === null) {
        setStatus(uiRef.message, 'Selecciona un matraz primero', 'ko');
        return;
      }
      s.levels[s.selected] = 0;
      s.moves++;
      clearHighlight(uiRef.matracesContainer);
      updateUI(uiRef, s);
      setStatus(uiRef.message, `Matraz vaciado en el fregadero. Movimientos: ${s.moves}`, 'ok');
      s.selected = null;
    });

    if (hasGrifo) {
      uiRef.btnFill.addEventListener('click', () => {
        if (s.selected === null) {
          setStatus(uiRef.message, 'Selecciona un matraz primero', 'ko');
          return;
        }
        s.levels[s.selected] = s.capacities[s.selected];
        s.moves++;
        updateUI(uiRef, s);
        setStatus(uiRef.message, `Matraz ${s.selected + 1} lleno hasta el borde. Movimientos: ${s.moves}`, 'ok');
      });
    }

    uiRef.reactorButton.addEventListener('click', () => {
      if (s.selected === null) {
        setStatus(uiRef.message, 'Selecciona primero el matraz que quieres verter', 'ko');
        return;
      }
      if (s.levels[s.selected] === s.target) {
        s.levels[s.selected] = 0;
        s.selected = null;
        clearHighlight(uiRef.matracesContainer);
        updateUI(uiRef, s);
        handleVictory(uiRef, s);
      } else {
        setStatus(uiRef.message, 'Ese matraz no tiene el volumen exacto. El reactor no admite aproximaciones.', 'ko');
      }
    });

    uiRef.btnReset.addEventListener('click', () => {
      s.levels = initialLevels(cfg, hasGrifo);
      s.selected = null;
      s.moves = 0;

      clearHighlight(uiRef.matracesContainer);
      updateUI(uiRef, s);
      setStatus(uiRef.message, 'Laboratorio reiniciado', 'ok');
      setStatus(uiRef.result, '', '');
    });

    uiRef.btnHint.addEventListener('click', () => {
      const pistas = cfg.hints || PISTAS_GENERICAS;
      const pista = pistas[Math.floor(Math.random() * pistas.length)];
      setStatus(uiRef.message, `Pista: ${pista}`, '');
      if (hooks && hooks.onHint) hooks.onHint(pista);
    });
  }
}

function buildShell(config, grifo) {
  const target = `<span class="target-amount">${config.target} mL</span>`;
  const intro = grifo
    ? 'Llena los matraces en el dosificador o vacíalos en el fregadero, y trasvasa reactivo entre ellos pulsando primero el matraz de origen y luego el de destino.'
    : `Solo dispones de ${config.initialLevels ? config.initialLevels.reduce((a, b) => a + b, 0) : config.capacities[0]} mL de reactivo: no hay dosificador, así que trasvasa entre los matraces pulsando primero el de origen y luego el de destino, sin desperdiciarlo.`;

  const ui = buildStandardShell({
    tipo: 'mezcla-quimica',
    gameClass: 'mezcla-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p>${intro}</p>
      <p>Los matraces no están graduados: al volcar uno en otro pasa todo lo que quepa, ni una gota más.</p>
      <p>Cuando un matraz tenga exactamente ${target}, selecciónalo y pulsa <strong>Verter en el reactor</strong>.</p>
    `
  });

  const matracesContainer = createElement('div', { class: 'mezcla-matraces' });
  ui.box.appendChild(matracesContainer);

  const controls = createElement('div', { class: 'panel-controls' });

  const btnFill = createElement('button', { class: 'btn btn-secondary' });
  btnFill.textContent = 'Llenar del dosificador';

  const btnEmpty = createElement('button', { class: 'btn btn-secondary' });
  btnEmpty.textContent = 'Vaciar matraz';

  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';

  const btnHint = createElement('button', { class: 'btn btn-secondary' });
  btnHint.textContent = 'Pista';

  if (grifo) controls.appendChild(btnFill);
  controls.appendChild(btnEmpty);
  controls.appendChild(btnReset);
  controls.appendChild(btnHint);
  ui.box.appendChild(controls);

  const reactorSection = createElement('div', { class: 'mezcla-reactor' });
  const reactorButton = createElement('div', { class: 'reactor-button' });
  reactorButton.innerHTML = '<div class="reactor-icon">⚗️</div><div class="reactor-text">Verter en el reactor<br><small>(comprobar)</small></div>';
  reactorSection.appendChild(reactorButton);
  ui.box.appendChild(reactorSection);

  const message = createElement('div', { class: 'panel-message' });
  message.textContent = 'Selecciona un matraz para empezar';
  ui.box.appendChild(message);

  return { ...ui, matracesContainer, btnFill, btnEmpty, btnReset, btnHint, reactorButton, message };
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

  throw new Error('Faltan datos de configuracion de la mezcla');
}
