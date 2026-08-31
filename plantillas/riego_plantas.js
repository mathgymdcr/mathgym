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
    tipo: 'riego-plantas',
    gameClass: 'riego-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> organiza el calendario para que cada planta reciba <strong>exactamente</strong> sus riegos.</p>
      <p>Cada planta solo bebe en los ciclos que dice su ficha, junto a su nombre. Toca una celda para regarla; tócala otra vez para marcarla con <strong>×</strong> (para recordar que esa planta no va ahí); una tercera vez la deja vacía. La × no cuenta para ganar, es solo para no dudar dos veces.</p>
      ${descanso ? '<p>Ninguna planta se puede regar <strong>dos ciclos seguidos</strong>: la tierra tiene que secarse entre riego y riego.</p>' : ''}
      <p>Y la regadera da para <strong>${capacity} riego${capacity === 1 ? '' : 's'} por ciclo</strong> como mucho.</p>
    `
  });
  root.append(ui.box);

  const state = {
    grid: plants.map(() => Array(cycles).fill(false)),
    regados: 0,   // riegos abiertos en total, la marca del reto
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
    const nombreTexto = createElement('div', { class: 'riego-nombre-texto' });
    nombreTexto.textContent = planta.id;
    nombre.appendChild(nombreTexto);
    const nota = ventanaTexto(planta, cycles);
    if (nota) {
      const notaEl = createElement('div', { class: 'riego-ventana-nota' });
      notaEl.textContent = nota;
      nombre.appendChild(notaEl);
    }
    tr.appendChild(nombre);

    celdas.push([]);
    for (let j = 0; j < cycles; j++) {
      const td = createElement('td', { class: 'riego-cell', 'data-planta': String(i), 'data-ciclo': String(j) });
      td.addEventListener('click', () => onCeldaClick(i, j));
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
    return state.grid[i].reduce((acc, v) => acc + (v === true ? 1 : 0), 0);
  }

  function riegosDeCiclo(j) {
    return state.grid.reduce((acc, fila) => acc + (fila[j] === true ? 1 : 0), 0);
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
          if (state.grid[i][j] === true && state.grid[i][j + 1] === true) {
            msgs.push(`${planta.id} se riega dos ciclos seguidos (${j + 1} y ${j + 2})`);
          }
        }
      });
    }
    // Antes esto no hacía falta: los ciclos fuera de ventana ni siquiera
    // tenían click. Ahora que el jugador riega donde quiere (la ventana solo
    // viene en texto), hay que comprobar de verdad que no se ha colado agua
    // donde esa planta no la admite.
    plants.forEach((planta, i) => {
      for (let j = 0; j < cycles; j++) {
        if (state.grid[i][j] === true && !planta.ventana.includes(j)) {
          msgs.push(`${planta.id} no admite agua en el ciclo ${j + 1}`);
        }
      }
    });
    plants.forEach((planta, i) => {
      const tiene = riegosDePlanta(i);
      if (tiene > planta.doses) msgs.push(`${planta.id} lleva ${tiene} riegos y solo necesita ${planta.doses}`);
    });
    return msgs;
  }

  // Vacía -> regada -> marcada con × (recordatorio de que aquí no toca,
  // según el texto de la ventana) -> vacía. Igual que el marcado del
  // nonograma: la × es gratis, no se valida contra la ventana real.
  function onCeldaClick(i, j) {
    if (state.won) return;
    const v = state.grid[i][j];
    if (v === false) state.grid[i][j] = true;
    else if (v === true) state.grid[i][j] = 'x';
    else state.grid[i][j] = false;
    // El par del reto son los riegos del calendario correcto, así que cuenta
    // cada riego que se abre: rectificar es lo que cuesta estrellas. Marcar
    // con × es gratis.
    if (state.grid[i][j] === true) state.regados += 1;
    refresh();
  }

  function refresh() {
    plants.forEach((planta, i) => {
      const tiene = riegosDePlanta(i);
      for (let j = 0; j < cycles; j++) {
        const v = state.grid[i][j];
        const cell = celdas[i][j];
        cell.classList.toggle('is-on', v === true);
        cell.classList.toggle('is-marked', v === 'x');
        cell.textContent = v === 'x' ? '×' : '';
      }
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
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.regados });
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

// Ciclos 1-indexados de una ventana, agrupados en rachas ("3 a 5") para que
// no salga una lista larga de números sueltos. Sin restricción real (la
// ventana cubre todos los ciclos, como en el payload antiguo sin `ventana`)
// no hay nada que avisar y se devuelve cadena vacía.
function ventanaTexto(planta, cycles) {
  if (planta.ventana.length >= cycles) return '';
  const ordenados = [...planta.ventana].sort((a, b) => a - b).map((i) => i + 1);
  const grupos = [];
  let inicio = ordenados[0];
  let anterior = ordenados[0];
  for (let k = 1; k <= ordenados.length; k++) {
    const actual = ordenados[k];
    if (actual === anterior + 1) { anterior = actual; continue; }
    grupos.push(inicio === anterior ? `${inicio}` : `${inicio} a ${anterior}`);
    inicio = actual;
    anterior = actual;
  }
  const lista = grupos.length === 1
    ? grupos[0]
    : `${grupos.slice(0, -1).join(', ')} y ${grupos[grupos.length - 1]}`;
  const palabra = planta.ventana.length === 1 ? 'ciclo' : 'ciclos';
  return `Disponible: ${palabra} ${lista}.`;
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d || {};
}
