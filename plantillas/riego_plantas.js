// ===== plantillas/riego_plantas.js =====
// El Riego · Calendario de riegos por ciclos. Cada planta necesita
// EXACTAMENTE sus dosis, solo bebe en los ciclos de su ventana, no se puede
// regar dos ciclos seguidos (la tierra tiene que secarse) y cada ciclo
// admite como mucho `capacity` riegos en total.
//
// Sin ventanas ni descanso -- como era antes -- no había nada que deducir:
// repartir las dosis en los ciclos con más hueco funcionaba siempre. Son
// esas dos reglas las que hacen que haya que razonar quién ocupa qué hueco.
// El payload antiguo (sin `ventana` ni `descanso`) se sigue entendiendo.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch {
    root.innerHTML = '<div class="feedback ko">Error: No se pudo cargar el reto de riego</div>';
    return;
  }

  const cycles = Number.isInteger(config.cycles) && config.cycles > 0 ? config.cycles : 6;
  const capacity = Number.isInteger(config.capacity)
    ? config.capacity
    : (Number.isInteger(config.capacity_per_cycle) ? config.capacity_per_cycle : 2);
  const descanso = config.descanso === true;

  const plants = (Array.isArray(config.plants) ? config.plants : []).map((p) => ({
    id: p.id,
    doses: Number.isInteger(p.doses) && p.doses > 0 ? p.doses : 1,
    // Sin ventana declarada, la planta puede regarse en cualquier ciclo.
    ventana: Array.isArray(p.ventana) ? [...p.ventana] : [...Array(cycles).keys()]
  }));

  if (!plants.length) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de riego sin plantas</div>';
    return;
  }

  const ui = buildStandardShell({
    icon: 'assets/icono-riego-plantas.svg',
    titulo: 'El Riego',
    gameClass: 'riego-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> organiza el calendario para que cada planta reciba <strong>exactamente</strong> sus riegos.</p>
      <p>Cada planta solo bebe en los ciclos marcados como disponibles: las casillas tachadas son días en los que esa planta no admite agua.</p>
      ${descanso ? '<p>Ninguna planta se puede regar <strong>dos ciclos seguidos</strong>: la tierra tiene que secarse entre riego y riego.</p>' : ''}
      <p>Y la regadera da para <strong>${capacity} riego${capacity === 1 ? '' : 's'} por ciclo</strong> como mucho.</p>
    `
  });
  root.append(ui.box);

  const state = {
    grid: plants.map(() => Array(cycles).fill(false)),
    won: false
  };

  const tabla = createElement('table', { class: 'riego-tabla' });
  const thead = createElement('thead');
  const trh = createElement('tr');
  trh.appendChild(createElement('th', { class: 'riego-th-planta' }));
  for (let j = 0; j < cycles; j++) {
    const th = createElement('th');
    th.textContent = `C${j + 1}`;
    trh.appendChild(th);
  }
  const thTotal = createElement('th');
  thTotal.textContent = 'Riegos';
  trh.appendChild(thTotal);
  thead.appendChild(trh);
  tabla.appendChild(thead);

  const tbody = createElement('tbody');
  const celdas = [];
  plants.forEach((planta, i) => {
    const tr = createElement('tr', { class: `riego-planta riego-planta-${i}` });
    const nombre = createElement('td', { class: 'riego-nombre' });
    nombre.textContent = planta.id;
    tr.appendChild(nombre);

    celdas.push([]);
    for (let j = 0; j < cycles; j++) {
      const td = createElement('td', { class: 'riego-cell', 'data-planta': String(i), 'data-ciclo': String(j) });
      const disponible = planta.ventana.includes(j);
      if (!disponible) td.classList.add('is-blocked');
      else td.addEventListener('click', () => onCeldaClick(i, j));
      tr.appendChild(td);
      celdas[i].push(td);
    }

    const dosis = createElement('td', { class: 'riego-dosis' });
    tr.appendChild(dosis);
    tbody.appendChild(tr);
  });

  const trTotales = createElement('tr', { class: 'riego-totales' });
  const etiqueta = createElement('td', { class: 'riego-nombre' });
  etiqueta.textContent = 'Por ciclo';
  trTotales.appendChild(etiqueta);
  const totalEls = [];
  for (let j = 0; j < cycles; j++) {
    const td = createElement('td', { class: 'riego-total' });
    trTotales.appendChild(td);
    totalEls.push(td);
  }
  trTotales.appendChild(createElement('td'));
  tbody.appendChild(trTotales);
  tabla.appendChild(tbody);

  const wrap = createElement('div', { class: 'riego-tabla-wrap' });
  wrap.appendChild(tabla);
  ui.box.appendChild(wrap);

  const controls = createElement('div', { class: 'riego-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.grid = plants.map(() => Array(cycles).fill(false));
    state.won = false;
    setStatus(ui.result, '', '');
    setStatus(ui.status, 'Listo para empezar', 'ok');
    refresh();
  });
  controls.appendChild(btnReset);
  ui.box.appendChild(controls);

  setStatus(ui.status, 'Listo para empezar', 'ok');
  refresh();

  function riegosDePlanta(i) {
    return state.grid[i].reduce((acc, on) => acc + (on ? 1 : 0), 0);
  }

  function riegosDeCiclo(j) {
    return state.grid.reduce((acc, fila) => acc + (fila[j] ? 1 : 0), 0);
  }

  function problemas() {
    const msgs = [];
    for (let j = 0; j < cycles; j++) {
      const usados = riegosDeCiclo(j);
      if (usados > capacity) msgs.push(`Capacidad superada en el ciclo ${j + 1} (${usados} de ${capacity})`);
    }
    if (descanso) {
      plants.forEach((planta, i) => {
        for (let j = 0; j + 1 < cycles; j++) {
          if (state.grid[i][j] && state.grid[i][j + 1]) {
            msgs.push(`${planta.id} se riega dos ciclos seguidos (${j + 1} y ${j + 2})`);
          }
        }
      });
    }
    plants.forEach((planta, i) => {
      const tiene = riegosDePlanta(i);
      if (tiene > planta.doses) msgs.push(`${planta.id} lleva ${tiene} riegos y solo necesita ${planta.doses}`);
    });
    return msgs;
  }

  function onCeldaClick(i, j) {
    if (state.won) return;
    state.grid[i][j] = !state.grid[i][j];
    refresh();
  }

  function refresh() {
    plants.forEach((planta, i) => {
      const tiene = riegosDePlanta(i);
      for (let j = 0; j < cycles; j++) celdas[i][j].classList.toggle('is-on', state.grid[i][j]);
      const dosisEl = root.querySelector(`.riego-planta-${i} .riego-dosis`);
      dosisEl.textContent = `${tiene}/${planta.doses}`;
      dosisEl.classList.toggle('is-done', tiene === planta.doses);
      dosisEl.classList.toggle('is-over', tiene > planta.doses);
    });

    for (let j = 0; j < cycles; j++) {
      const usados = riegosDeCiclo(j);
      totalEls[j].textContent = `${usados}/${capacity}`;
      totalEls[j].classList.toggle('is-over', usados > capacity);
    }

    const msgs = problemas();
    const completo = plants.every((planta, i) => riegosDePlanta(i) === planta.doses);

    if (msgs.length) {
      setStatus(ui.result, msgs[0], 'ko');
    } else {
      setStatus(ui.result, '', '');
    }

    if (!msgs.length && completo && !state.won) {
      state.won = true;
      setStatus(ui.status, '¡Calendario de riego resuelto!', 'ok');
      // Primero se registra la victoria y luego se celebra, envuelto: el
      // confeti pinta en un <canvas> y no puede llevarse por delante el
      // progreso del jugador.
      if (hooks && hooks.onSuccess) hooks.onSuccess();
      try {
        celebrate({ ok: true, message: 'Todas las plantas regadas en su punto' });
      } catch (err) {
        console.warn('No se pudo pintar la celebración:', err);
      }
    } else if (!state.won) {
      setStatus(ui.status, msgs.length ? 'Hay algo que no cuadra' : 'Sigue repartiendo los riegos', 'ok');
    }
  }
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d || {};
}
