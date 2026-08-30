// plantillas/mezcla_quimica.js
// Síntesis de volúmenes exactos trasvasando reactivo entre matraces sin
// graduar. Los tres ejes del tipo se leen del payload:
//   - `grifo`: si hay dosificador, se puede llenar un matraz hasta arriba
//     y vaciarlo cuantas veces haga falta; sin él, el reactivo de partida
//     es todo el que hay.
//   - nº de matraces: la longitud de `capacities` (3 o 4).
//   - nº de objetivos: la longitud de `targets` (1 o 2).
// El gesto es el mismo en todas: seleccionar el matraz con el volumen
// exacto y verterlo en el reactor. Con varios compuestos se sintetizan EN
// CADENA y en el orden que quiera quien juega -- el reactor vacía el
// matraz, así que el siguiente arranca de lo que quede en los demás.
import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus, pintarIcono } from './shell.js';
import { initialLevelsMezcla, objetivosMezcla } from '../scripts/mezcla-logic.js';

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

  const objetivos = objetivosMezcla(config);
  if (!config.capacities || objetivos.length === 0) {
    root.innerHTML = '<div class="feedback ko">Error: Faltan capacidades y objetivo</div>';
    return;
  }

  const grifo = config.grifo === true;
  const ui = buildShell(config, grifo, objetivos);
  root.append(ui.box);

  const state = {
    capacities: config.capacities,
    levels: initialLevels(config, grifo),
    objetivos,
    // Índices de `objetivos` ya vertidos: con dos compuestos del mismo
    // volumen hay que distinguirlos por posición, no por valor.
    vertidos: [],
    selected: null,
    moves: 0
  };

  renderMatraces(ui.matracesContainer, state);
  renderObjetivos(ui.objetivosContainer, state);
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

      const reactivo = createElement('div', { class: `reactivo ${claseColorReactivo(s)}` });
      updateNivel(reactivo, s.levels[index], capacity);
      cuerpo.appendChild(reactivo);

      matraz.appendChild(cuerpo);

      // El nivel no se escribe: los matraces no están graduados, así que lo
      // que hay dentro se ve por el líquido dibujado y nada más.
      matraz.addEventListener('click', () => handleMatrazClick(index, s, ui));

      container.appendChild(matraz);
    });
  }

  // Los compuestos pedidos, a la vista: con dos objetivos hay que poder
  // mirar cuál queda, y el vertido no los tacha por valor sino por
  // posición -- dos compuestos pueden pedir el mismo volumen.
  function renderObjetivos(container, s) {
    container.innerHTML = '';

    const titulo = createElement('p', { class: 'objetivos-titulo' });
    titulo.textContent = s.objetivos.length === 1
      ? 'Compuesto por sintetizar:'
      : 'Compuestos por sintetizar, en el orden que quieras:';
    container.appendChild(titulo);

    const lista = createElement('div', { class: 'objetivos-lista' });
    s.objetivos.forEach((volumen, i) => {
      const hecho = s.vertidos.includes(i);
      const ficha = createElement('div', {
        class: hecho ? 'objetivo hecho' : 'objetivo',
        'data-objetivo': i
      });

      const cantidad = createElement('span', { class: 'target-amount' });
      cantidad.textContent = `${volumen} mL`;
      ficha.appendChild(cantidad);

      const estado = createElement('span', { class: 'objetivo-estado' });
      estado.textContent = hecho ? 'ya en el reactor' : 'pendiente';
      ficha.appendChild(estado);

      lista.appendChild(ficha);
    });
    container.appendChild(lista);
  }

  function updateNivel(reactivoElement, level, capacity) {
    reactivoElement.style.height = ((level / capacity) * 100) + '%';
  }

  // Solo cosmético: el reactivo sigue siendo el mismo fungible de siempre
  // (cualquier matraz se puede mezclar con cualquier otro), pero cambia de
  // color en cuanto se vierte el primer compuesto, para que no parezca que
  // el segundo sale del mismo líquido sin más -- aunque mecánicamente sí.
  function claseColorReactivo(s) {
    return (s.objetivos.length > 1 && s.vertidos.length >= 1) ? 'compuesto-2' : 'compuesto-1';
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
    const clase = claseColorReactivo(s);
    const matraces = uiRef.matracesContainer.querySelectorAll('.matraz');
    matraces.forEach((matraz, index) => {
      const reactivo = matraz.querySelector('.reactivo');
      updateNivel(reactivo, s.levels[index], s.capacities[index]);
      reactivo.classList.toggle('compuesto-2', clase === 'compuesto-2');
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
    const varios = s.objetivos.length > 1;
    const resumen = s.objetivos.map((t) => `${t} mL`).join(' y ');
    setStatus(uiRef.result, varios
      ? `¡Compuestos sintetizados! ${resumen} en ${s.moves} movimientos`
      : `¡Compuesto sintetizado! ${resumen} en ${s.moves} movimientos`, 'ok');
    // El pie se queda si no: al verter se deselecciona el matraz, y dejar ahí
    // un "Matraz N seleccionado" contradice lo que muestra el tablero.
    setStatus(uiRef.message, varios
      ? 'Todos los compuestos están ya en el reactor.'
      : 'El compuesto ya está en el reactor.', 'ok');
    celebrate({ ok: true, message: `Vertiste ${resumen} exactos en el reactor en ${s.moves} movimientos` });
    if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: s.moves });

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
        // Llenar deselecciona, igual que vaciar: el gesto de verter es
        // seleccionar el matraz y pulsar el reactor, y dejar la selección
        // puesta obligaría a pulsar el matraz dos veces para volver a él.
        const lleno = s.selected;
        s.levels[lleno] = s.capacities[lleno];
        s.moves++;
        s.selected = null;
        clearHighlight(uiRef.matracesContainer);
        updateUI(uiRef, s);
        setStatus(uiRef.message, `Matraz ${lleno + 1} lleno hasta el borde. Movimientos: ${s.moves}`, 'ok');
      });
    }

    uiRef.reactorButton.addEventListener('click', () => {
      if (s.selected === null) {
        setStatus(uiRef.message, 'Selecciona primero el matraz que quieres verter', 'ko');
        return;
      }
      // Si dos compuestos piden el mismo volumen da igual cuál se dé por
      // vertido: se apunta el primero que siga pendiente.
      const pendiente = s.objetivos.findIndex(
        (volumen, i) => !s.vertidos.includes(i) && volumen === s.levels[s.selected]
      );
      if (pendiente === -1) {
        setStatus(uiRef.message, 'Ese matraz no tiene el volumen exacto. El reactor no admite aproximaciones.', 'ko');
        return;
      }

      s.levels[s.selected] = 0;
      s.vertidos.push(pendiente);
      // Verter cuenta como movimiento, igual que llenar o trasvasar: es lo
      // que cuenta el BFS que fija el mínimo del reto (mezcla-logic.js).
      s.moves++;
      s.selected = null;
      clearHighlight(uiRef.matracesContainer);
      updateUI(uiRef, s);
      renderObjetivos(uiRef.objetivosContainer, s);

      if (s.vertidos.length === s.objetivos.length) {
        handleVictory(uiRef, s);
        return;
      }

      const quedan = s.objetivos.length - s.vertidos.length;
      setStatus(uiRef.message,
        `Compuesto de ${s.objetivos[pendiente]} mL vertido; el reactor ha vaciado el matraz. ` +
        `Queda${quedan === 1 ? '' : 'n'} ${quedan} por sintetizar. Movimientos: ${s.moves}`, 'ok');
    });

    uiRef.btnReset.addEventListener('click', () => {
      s.levels = initialLevels(cfg, hasGrifo);
      s.selected = null;
      s.moves = 0;
      s.vertidos = [];

      clearHighlight(uiRef.matracesContainer);
      updateUI(uiRef, s);
      renderObjetivos(uiRef.objetivosContainer, s);
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

function buildShell(config, grifo, objetivos) {
  const objTxt = objetivos.map((t) => `<span class="target-amount">${t} mL</span>`).join(' y ');
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
      <p>Cuando un matraz tenga exactamente ${objTxt}, selecciónalo y pulsa <strong>Verter en el reactor</strong>.</p>
      ${objetivos.length > 1 ? `<p>Los ${objetivos.length} compuestos se sintetizan en cadena y en el orden que quieras: el reactor vacía el matraz que le viertes, así que el siguiente arranca de lo que hayas dejado en los demás.</p>` : ''}
    `
  });

  const objetivosContainer = createElement('div', { class: 'mezcla-objetivos' });
  ui.box.appendChild(objetivosContainer);

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
  const reactorIcon = createElement('div', { class: 'reactor-icon' });
  pintarIcono(reactorIcon, 'assets/icono-reactor.svg');
  const reactorText = createElement('div', { class: 'reactor-text' });
  reactorText.innerHTML = 'Verter en el reactor<br><small>(comprobar)</small>';
  reactorButton.appendChild(reactorIcon);
  reactorButton.appendChild(reactorText);
  reactorSection.appendChild(reactorButton);
  ui.box.appendChild(reactorSection);

  const message = createElement('div', { class: 'panel-message' });
  message.textContent = 'Selecciona un matraz para empezar';
  ui.box.appendChild(message);

  return { ...ui, objetivosContainer, matracesContainer, btnFill, btnEmpty, btnReset, btnHint, reactorButton, message };
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const response = await fetch(data.json_url);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.json();
  }

  if (data && (data.capacities || data.target || data.targets)) {
    return data;
  }

  throw new Error('Faltan datos de configuracion de la mezcla');
}
