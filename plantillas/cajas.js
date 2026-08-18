// ===== plantillas/cajas.js =====
// Cajas Apiladas · Adaptación de las Torres de Hanói: mismo núcleo
// matemático (movimientos ordenados, mínimo teórico 2^n - 1) pero contado
// como un almacén de cajas de distinto peso en vez de discos en postes.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de cajas</div>';
    return;
  }

  const cajas = Number.isInteger(config.cajas) && config.cajas > 0 ? config.cajas : 3;
  const zonaNombres = Array.isArray(config.zonas) && config.zonas.length === 3
    ? config.zonas
    : ['Zona A', 'Zona B', 'Zona C'];
  const destino = zonaNombres.includes(config.destino) ? config.destino : zonaNombres[2];
  const minMoves = Math.pow(2, cajas) - 1;

  const ui = buildStandardShell({
    icon: '📦',
    titulo: 'Cajas Apiladas',
    gameClass: 'cajas-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> mueve todas las cajas a la <strong>${destino}</strong>.</p>
      <p>Solo puedes coger la caja de arriba del todo de una zona. Nunca dejes una caja sobre otra más ligera: no aguantaría el peso.</p>
    `
  });
  root.append(ui.box);

  const state = {
    zonas: buildInitialZonas(zonaNombres, cajas),
    selected: null,
    moves: 0,
    won: false
  };

  const info = createElement('div', { class: 'cajas-info' });
  info.innerHTML = `<span>Movimientos: <strong class="cajas-moves">0</strong></span><span>Mínimo teórico: <strong>${minMoves}</strong></span>`;
  ui.box.appendChild(info);

  const board = createElement('div', { class: 'cajas-board' });
  const zonaEls = {};
  zonaNombres.forEach(name => {
    const zona = createElement('div', { class: 'cajas-zona', 'data-zona': name });
    const stack = createElement('div', { class: 'cajas-stack' });
    const suelo = createElement('div', { class: 'cajas-suelo' });
    const label = createElement('div', { class: 'cajas-zona-label' });
    label.textContent = name === destino ? `${name} 🎯` : name;
    zona.appendChild(stack);
    zona.appendChild(suelo);
    zona.appendChild(label);
    zona.addEventListener('click', () => onZonaClick(name));
    board.appendChild(zona);
    zonaEls[name] = { zona, stack };
  });
  ui.box.appendChild(board);

  const controls = createElement('div', { class: 'cajas-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.zonas = buildInitialZonas(zonaNombres, cajas);
    state.selected = null;
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

  function buildInitialZonas(names, n) {
    const zonas = {};
    names.forEach(name => { zonas[name] = []; });
    zonas[names[0]] = Array.from({ length: n }, (_, i) => n - i); // [n, n-1, ..., 1] (peso: n = más pesada)
    return zonas;
  }

  function onZonaClick(name) {
    if (state.won) return;

    if (state.selected === null) {
      if (state.zonas[name].length === 0) return;
      state.selected = name;
      refresh();
      return;
    }

    if (state.selected === name) {
      state.selected = null;
      refresh();
      return;
    }

    const origen = state.zonas[state.selected];
    const peso = origen[origen.length - 1];
    const zonaDestino = state.zonas[name];
    const top = zonaDestino[zonaDestino.length - 1];

    if (top !== undefined && top < peso) {
      setStatus(ui.result, 'Esa caja no aguanta tanto peso encima', 'ko');
      state.selected = null;
      refresh();
      return;
    }

    origen.pop();
    zonaDestino.push(peso);
    state.moves += 1;
    state.selected = null;
    setStatus(ui.result, '', '');
    refresh();

    if (state.zonas[destino].length === cajas) {
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
    info.querySelector('.cajas-moves').textContent = state.moves;

    zonaNombres.forEach(name => {
      const { zona, stack } = zonaEls[name];
      zona.classList.toggle('is-selected', state.selected === name);
      stack.innerHTML = '';
      state.zonas[name].forEach(peso => {
        const cajaEl = createElement('div', { class: 'cajas-caja' });
        cajaEl.style.width = `${40 + peso * (160 / cajas)}px`;
        cajaEl.textContent = peso;
        stack.appendChild(cajaEl);
      });
    });
  }
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}
