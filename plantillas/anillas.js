// ===== plantillas/anillas.js =====
// Anillas Encadenadas · Adaptación del puzzle clásico de los anillos chinos
// (Baguenaudier): misma familia matemática que las Torres de Hanói
// (movimientos ordenados, mínimo teórico que crece en 2^n) pero con una
// mecánica de interacción distinta.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de anillas</div>';
    return;
  }

  const rings = Number.isInteger(config.rings) && config.rings > 0 ? config.rings : 4;
  const minMoves = theoreticalMinMoves(rings);
  const mostrarPistas = config.mostrarPistas !== false; // niveles más difíciles pueden desactivarlo

  const ui = buildStandardShell({
    icon: '🔗',
    titulo: 'Anillas Encadenadas',
    gameClass: 'anillas-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> suelta todas las anillas de la barra.</p>
      <p><strong>Regla:</strong> en cada momento solo hay como mucho dos anillas que se pueden tocar:</p>
      <ul>
        <li>La anilla 1 siempre se puede tocar.</li>
        <li>Si la anilla 1 está enganchada, la otra anilla que puedes tocar es siempre la 2 (ninguna otra).</li>
        <li>Si la anilla 1 está suelta: recorre las anillas desde la 1 hacia la derecha hasta encontrar la primera que esté enganchada. Esa anilla <strong>no</strong> se puede tocar — la que puedes tocar es la <strong>siguiente</strong> a ella.</li>
      </ul>
    `
  });
  root.append(ui.box);

  const state = {
    rings: Array(rings).fill(true), // true = enganchada
    moves: 0,
    won: false
  };

  const info = createElement('div', { class: 'anillas-info' });
  info.innerHTML = `<span>Movimientos: <strong class="anillas-moves">0</strong></span><span>Mínimo teórico: <strong>${minMoves}</strong></span>`;
  ui.box.appendChild(info);

  let hint = null;
  if (mostrarPistas) {
    hint = createElement('div', { class: 'anillas-hint' });
    hint.textContent = '✨ Toca las anillas doradas';
    ui.box.appendChild(hint);
  }

  const bar = createElement('div', { class: 'anillas-bar-container' });
  const barLine = createElement('div', { class: 'anillas-bar' });
  const ringsRow = createElement('div', { class: 'anillas-row' });
  bar.appendChild(barLine);
  bar.appendChild(ringsRow);
  ui.box.appendChild(bar);

  const ringEls = [];
  for (let i = 0; i < rings; i++) {
    const ring = createElement('div', { class: 'anillas-ring' });
    ring.textContent = i + 1;
    ring.addEventListener('click', () => onRingClick(i));
    ringsRow.appendChild(ring);
    ringEls.push(ring);
  }

  const controls = createElement('div', { class: 'anillas-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.rings = Array(rings).fill(true);
    state.moves = 0;
    state.won = false;
    setStatus(ui.result, '', '');
    setStatus(ui.status, 'Listo para empezar', 'ok');
    refresh();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  refresh();

  // Regla del puzzle: la anilla i se puede mover si i===0, o si la anilla
  // i-1 está enganchada y todas las anillas 0..i-2 están desenganchadas.
  // Verificado por BFS: para n=1..8 produce el mínimo de movimientos real
  // del puzzle (1, 2, 5, 10, 21, 42, 85, 170).
  //
  // Equivalente más intuitivo (verificado exhaustivamente para n=1..10,
  // mismo resultado en todos los estados posibles — es el que se explica
  // al jugador): la anilla 1 siempre es legal; si la anilla 1 está
  // enganchada, la anilla 2 es la única otra legal; si la anilla 1 está
  // suelta, la única otra legal es la siguiente a la primera anilla
  // enganchada (de izquierda a derecha), si existe.
  function esMovimientoLegal(i, ringsState) {
    if (i === 0) return true;
    if (!ringsState[i - 1]) return false;
    for (let j = 0; j < i - 1; j++) {
      if (ringsState[j]) return false;
    }
    return true;
  }

  function legalIndices(ringsState) {
    const result = [];
    for (let i = 0; i < ringsState.length; i++) {
      if (esMovimientoLegal(i, ringsState)) result.push(i);
    }
    return result;
  }

  function onRingClick(i) {
    if (state.won) return;

    if (!esMovimientoLegal(i, state.rings)) {
      setStatus(ui.result, 'Esa anilla todavía no se puede mover', 'ko');
      return;
    }

    state.rings[i] = !state.rings[i];
    state.moves += 1;
    setStatus(ui.result, '', '');
    refresh();

    if (state.rings.every(on => !on)) {
      state.won = true;
      const perfect = state.moves <= minMoves;
      const message = perfect
        ? `¡Resuelto en el mínimo de ${state.moves} movimientos!`
        : `Resuelto en ${state.moves} movimientos (mínimo teórico: ${minMoves}).`;
      setStatus(ui.status, message, 'ok');
      celebrate({ ok: perfect, message });
      if (hooks && hooks.onSuccess) hooks.onSuccess();
    }
  }

  function refresh() {
    info.querySelector('.anillas-moves').textContent = state.moves;
    const legal = mostrarPistas ? new Set(legalIndices(state.rings)) : null;
    ringEls.forEach((el, i) => {
      el.classList.toggle('is-off', !state.rings[i]);
      el.classList.toggle('is-legal', !state.won && !!legal && legal.has(i));
    });
  }
}

function theoreticalMinMoves(n) {
  return n % 2 === 0
    ? (Math.pow(2, n + 1) - 2) / 3
    : (Math.pow(2, n + 1) - 1) / 3;
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}
