// ===== plantillas/relojes_arena.js =====
// Estética estándar MathGym (cabecera + tarjeta Deceerre) · Relojes de arena
//
// Mecánica: al abrir, toda la arena está abajo (relojes "gastados"), y el
// tamaño de cada reloj es proporcional a su duración. Un clic voltea un reloj
// (intercambia arriba/abajo tal cual esté repartida la arena en ese momento).
// "Iniciar" deja caer la arena de todos los relojes volteados y bloquea la
// interacción hasta que uno se vacíe del todo: en ese instante se paran todos
// a la vez. "Empezar tiempo" pone el cronómetro a cero en el instante que el
// jugador decida (no tiene por qué coincidir con Iniciar); el cronómetro no
// avanza hasta que se pulsa. La comprobación es automática cada vez que un
// reloj se vacía, comparando el cronómetro con el objetivo.

import { celebrate } from './celebration.js';
import { pintarIcono } from './shell.js';
import { tipoInfo } from '../catalogo-tipos.js';

const SIM_SECONDS_PER_TICK = 2; // 1 minuto de reloj ≈ 3s reales
const TICK_MS = 100;

export async function render(root, data, hooks) {
  root.innerHTML = '';
  const ui = buildShell();
  root.appendChild(ui.box);

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    setStatus(ui.status, 'Error al cargar datos: ' + (err && err.message ? err.message : err), 'ko');
    return;
  }
  if (!config || !Array.isArray(config.glasses) || !config.glasses.length || !config.target) {
    setStatus(ui.status, 'Error: faltan datos de configuración (glasses, target)', 'ko');
    return;
  }

  const targetEl = ui.box.querySelector('.target-amount');
  if (targetEl) targetEl.textContent = `${config.target} min`;

  const tolerance = config.tolerance || 0.25;
  const state = {
    glasses: config.glasses.map(min => ({ duration: min * 60, top: 0, bottom: min * 60 })),
    timerElapsed: 0,
    timerStarted: false,
    running: false,
    won: false
  };

  renderGlasses(ui.glassesContainer, state);
  updateClock(ui.clock, state);
  setStatus(ui.status, 'Listo para empezar', 'ok');

  setInterval(() => {
    if (!state.running || state.won) return;

    if (state.timerStarted) state.timerElapsed += SIM_SECONDS_PER_TICK;

    let emptied = false;
    state.glasses.forEach(g => {
      if (g.top > 0) {
        g.top = Math.max(0, g.top - SIM_SECONDS_PER_TICK);
        g.bottom = g.duration - g.top;
        if (g.top <= 0) emptied = true;
      }
    });
    updateGlasses(ui.glassesContainer, state);
    updateClock(ui.clock, state);

    if (emptied) {
      state.running = false;
      ui.btnStart.disabled = false;
      checkResult();
    }
  }, TICK_MS);

  function checkResult() {
    if (!state.timerStarted) {
      setStatus(ui.message, 'Un reloj se ha vaciado. Pulsa "Empezar tiempo" para medir hacia el objetivo la próxima vez.', '');
      return;
    }
    const elapsedMin = state.timerElapsed / 60;
    const diff = Math.abs(elapsedMin - config.target);
    if (diff <= tolerance) {
      state.won = true;
      setStatus(ui.message, `¡Objetivo conseguido en ${elapsedMin.toFixed(1)} min!`, 'ok');
      celebrate({ ok: true, message: `Detuviste la arena justo en ${config.target} minutos` });
      if (hooks && hooks.onSuccess) hooks.onSuccess();
    } else {
      setStatus(ui.message, `Un reloj se ha vaciado en ${elapsedMin.toFixed(1)} min. Voltea los relojes y pulsa Iniciar de nuevo.`, 'ko');
    }
  }

  ui.btnStart.addEventListener('click', () => {
    if (state.running || state.won) return;
    const armed = state.glasses.some(g => g.top > 0);
    if (!armed) {
      setStatus(ui.message, 'Voltea al menos un reloj antes de iniciar', 'ko');
      return;
    }
    state.running = true;
    ui.btnStart.disabled = true;
    updateGlasses(ui.glassesContainer, state);
    setStatus(ui.message, 'La arena está cayendo...', '');
  });

  ui.btnMark.addEventListener('click', () => {
    if (state.won) return;
    state.timerStarted = true;
    state.timerElapsed = 0;
    updateClock(ui.clock, state);
    setStatus(ui.message, 'Tiempo iniciado. Se cuenta hacia el objetivo desde aquí.', '');
  });

  ui.btnReset.addEventListener('click', () => {
    state.glasses.forEach(g => { g.top = 0; g.bottom = g.duration; });
    state.timerElapsed = 0;
    state.timerStarted = false;
    state.running = false;
    state.won = false;
    ui.btnStart.disabled = false;
    updateGlasses(ui.glassesContainer, state);
    updateClock(ui.clock, state);
    setStatus(ui.message, 'Reiniciado. Voltea los relojes para empezar.', '');
  });

  function renderGlasses(container, s) {
    container.innerHTML = '';
    const maxDuration = Math.max(...s.glasses.map(g => g.duration));
    s.glasses.forEach((g, i) => {
      const size = glassSize(g.duration, maxDuration);
      const wrap = createElement('div', { class: 'sand-glass', 'data-index': i });
      wrap.style.setProperty('--glass-size', size + 'px');
      wrap.innerHTML =
        '<div class="sand-glass-label">' + (g.duration / 60) + ' min</div>' +
        '<div class="sand-glass-body">' +
        '  <div class="sand-bulb sand-bulb-top"><div class="sand-fill"></div></div>' +
        '  <div class="sand-neck"></div>' +
        '  <div class="sand-bulb sand-bulb-bottom"><div class="sand-fill"></div></div>' +
        '</div>';
      wrap.addEventListener('click', () => {
        if (state.running || state.won) return;
        const glass = state.glasses[i];
        const swap = glass.top;
        glass.top = glass.bottom;
        glass.bottom = swap;
        updateGlasses(container, state);
      });
      container.appendChild(wrap);
    });
    updateGlasses(container, s);
  }

  function updateGlasses(container, s) {
    const els = container.querySelectorAll('.sand-glass');
    els.forEach((el, i) => {
      const g = s.glasses[i];
      const topPct = g.top / g.duration;
      el.querySelector('.sand-bulb-top .sand-fill').style.height = (topPct * 100) + '%';
      el.querySelector('.sand-bulb-bottom .sand-fill').style.height = ((1 - topPct) * 100) + '%';
      el.classList.toggle('running', s.running && g.top > 0);
      el.classList.toggle('empty', g.top <= 0);
      el.classList.toggle('locked', s.running);
    });
  }

  function updateClock(el, s) {
    el.textContent = formatTime(s.timerElapsed);
  }
}

// Cuanto más dura un reloj, más arena (y más grande se dibuja), entre 48 y 120px
function glassSize(duration, maxDuration) {
  const minSize = 48, maxSize = 120;
  const ratio = maxDuration > 0 ? duration / maxDuration : 1;
  return Math.round(minSize + (maxSize - minSize) * ratio);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return m + ':' + s.toString().padStart(2, '0');
}

function buildShell() {
  const box = createElement('div', { class: 'template-box relojes-game' });

  const header = createElement('div', { class: 'enigma-header-dark' });
  const headerIcon = createElement('span', { class: 'enigma-header-icon' });
  const { nombre, icono } = tipoInfo('relojes-arena');
  pintarIcono(headerIcon, icono);
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = nombre;
  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  box.appendChild(header);

  const instructions = createElement('div', { class: 'card deceerre-instructions' });
  instructions.innerHTML =
    '<img src="assets/deceerre-instructions.png" alt="Deceerre">' +
    '<div class="instructions-body">' +
    '  <h3>Cómo se juega</h3>' +
    '  <p>Haz clic en un reloj para voltearlo. Pulsa <strong>Iniciar</strong> para dejar caer la arena: se detiene sola en cuanto uno de los relojes se vacíe del todo.</p>' +
    '  <p>El cronómetro no corre hasta que pulses <strong>Empezar tiempo</strong>, en el instante que elijas. La comprobación es automática cada vez que un reloj se vacía: si el cronómetro coincide con <span class="target-amount">?</span>, ¡ganas!</p>' +
    '</div>';
  box.appendChild(instructions);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const clockWrap = createElement('div', { class: 'sand-clock' });
  clockWrap.innerHTML = '<span>Cronómetro:</span> <strong class="sand-clock-value">0:00</strong>';
  box.appendChild(clockWrap);

  const glassesContainer = createElement('div', { class: 'sand-glasses' });
  box.appendChild(glassesContainer);

  const controls = createElement('div', { class: 'trasvase-controls' });
  const btnStart = createElement('button', { class: 'btn' });
  btnStart.textContent = 'Iniciar';
  const btnMark = createElement('button', { class: 'btn btn-secondary' });
  btnMark.textContent = 'Empezar tiempo';
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  controls.appendChild(btnStart);
  controls.appendChild(btnMark);
  controls.appendChild(btnReset);
  box.appendChild(controls);

  const message = createElement('div', { class: 'trasvase-message' });
  message.textContent = 'Voltea los relojes y pulsa Iniciar';
  box.appendChild(message);

  return {
    box,
    status,
    clock: clockWrap.querySelector('.sand-clock-value'),
    glassesContainer,
    btnStart,
    btnMark,
    btnReset,
    message
  };
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && (data.glasses || data.target)) return data;
  throw new Error('Faltan datos de configuración de los relojes');
}

function createElement(tag, attrs) {
  const el = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    });
  }
  return el;
}

function setStatus(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'feedback' + (type ? ' ' + type : '');
}
