// ===== plantillas/cajas.js =====
// Cajas Apiladas · Almacén con carga por kilos. La base sigue siendo Hanói
// (mover pilas sin dejar una caja sobre otra más ligera), pero con dos
// cambios que rompen el 2^n - 1 de toda la vida: cada caja pesa unos kilos
// concretos y una carretilla puede llevarse VARIAS cajas del tope de una
// zona en un solo viaje, mientras la suma no pase de la capacidad.

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

  const modelo = normalizar(config);
  if (!modelo) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de cajas mal configurado</div>';
    return;
  }

  const { nombres, destino, capacidad, maxCajas, minMovimientos, inicial } = modelo;
  const totalCajas = inicial.reduce((acc, z) => acc + z.length, 0);
  const pesosOrdenados = [...inicial.flat()].sort((a, b) => a - b);

  const limiteTexto = Number.isFinite(capacidad)
    ? `<p>Tu carretilla aguanta <strong>${capacidad} kg</strong>: puedes llevarte de una vez varias cajas del montón mientras la suma no pase de ahí.</p>`
    : '<p>Solo puedes mover una caja cada vez.</p>';

  const ui = buildStandardShell({
    tipo: 'cajas-apiladas',
    gameClass: 'cajas-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> mueve todas las cajas a la <strong>${nombres[destino]}</strong>.</p>
      ${limiteTexto}
      <p>Toca una zona para cargar su caja de arriba; tócala otra vez para añadir la siguiente de debajo (si cabe en la carretilla) y una vez más para soltarlo todo. Luego toca la zona donde quieras descargar.</p>
      <p>Nunca puedes dejar una caja sobre otra más ligera: no aguantaría el peso.</p>
    `
  });
  root.append(ui.box);

  const state = {
    zonas: inicial.map((z) => [...z]),
    seleccion: null, // { zona, cajas }
    moves: 0,
    won: false
  };

  const info = createElement('div', { class: 'cajas-info' });
  ui.box.appendChild(info);

  const carga = createElement('div', { class: 'cajas-carga' });
  ui.box.appendChild(carga);

  const board = createElement('div', { class: 'cajas-board' });
  const zonaEls = [];
  nombres.forEach((nombre, idx) => {
    const zona = createElement('div', { class: 'cajas-zona', 'data-zona': nombre });
    const stack = createElement('div', { class: 'cajas-stack' });
    const suelo = createElement('div', { class: 'cajas-suelo' });
    const label = createElement('div', { class: 'cajas-zona-label' });
    label.textContent = idx === destino ? `${nombre} 🎯` : nombre;
    zona.appendChild(stack);
    zona.appendChild(suelo);
    zona.appendChild(label);
    zona.addEventListener('click', () => onZonaClick(idx));
    board.appendChild(zona);
    zonaEls.push({ zona, stack });
  });
  ui.box.appendChild(board);

  const controls = createElement('div', { class: 'cajas-controls' });
  const btnReset = createElement('button', { class: 'btn btn-secondary' });
  btnReset.textContent = 'Reiniciar';
  btnReset.addEventListener('click', () => {
    state.zonas = inicial.map((z) => [...z]);
    state.seleccion = null;
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

  function bloqueSeleccionado() {
    if (!state.seleccion) return [];
    const zona = state.zonas[state.seleccion.zona];
    return zona.slice(zona.length - state.seleccion.cajas);
  }

  function peso(bloque) {
    return bloque.reduce((a, b) => a + b, 0);
  }

  function onZonaClick(idx) {
    if (state.won) return;

    if (!state.seleccion) {
      const zona = state.zonas[idx];
      if (!zona.length) return;
      const arriba = zona[zona.length - 1];
      if (arriba > capacidad) {
        setStatus(ui.result, `La caja de ${arriba} kg pasa de tu carga máxima de ${capacidad} kg`, 'ko');
        return;
      }
      state.seleccion = { zona: idx, cajas: 1 };
      setStatus(ui.result, '', '');
      refresh();
      return;
    }

    if (state.seleccion.zona === idx) {
      // Segundo toque en la misma zona: añadir la caja de debajo si cabe;
      // si no cabe (o no hay más), se suelta la carga y se vuelve a empezar.
      const zona = state.zonas[idx];
      const siguiente = state.seleccion.cajas + 1;
      const cabeEnKilos = peso(zona.slice(zona.length - siguiente)) <= capacidad;
      if (siguiente <= zona.length && siguiente <= maxCajas && cabeEnKilos) {
        state.seleccion.cajas = siguiente;
      } else {
        if (siguiente <= zona.length && !cabeEnKilos) {
          setStatus(ui.result, `Esa caja más no cabe: pasarías de ${capacidad} kg`, 'ko');
        }
        state.seleccion = null;
      }
      refresh();
      return;
    }

    const bloque = bloqueSeleccionado();
    const tope = state.zonas[idx][state.zonas[idx].length - 1];
    if (tope !== undefined && tope < bloque[0]) {
      setStatus(ui.result, 'Esa caja no aguanta tanto peso encima', 'ko');
      state.seleccion = null;
      refresh();
      return;
    }

    const origen = state.zonas[state.seleccion.zona];
    origen.splice(origen.length - bloque.length);
    state.zonas[idx].push(...bloque);
    state.moves += 1;
    state.seleccion = null;
    setStatus(ui.result, '', '');
    refresh();

    if (state.zonas[destino].length === totalCajas) {
      state.won = true;
      const perfecto = minMovimientos == null || state.moves <= minMovimientos;
      const mensaje = minMovimientos == null
        ? `¡Almacén ordenado en ${state.moves} movimientos!`
        : (perfecto
            ? `¡Resuelto en el mínimo de ${state.moves} movimientos!`
            : `Resuelto en ${state.moves} movimientos (el mínimo era ${minMovimientos}).`);
      setStatus(ui.status, mensaje, 'ok');
      // Primero se da la victoria por buena y luego se celebra: la animación
      // pinta confeti en un <canvas> y, si por lo que sea fallara, no puede
      // llevarse por delante el registro del progreso.
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.moves });
      try {
        celebrate({ ok: perfecto, message: mensaje });
      } catch (err) {
        console.warn('No se pudo pintar la celebración:', err);
      }
    }
  }

  function refresh() {
    const partes = [`<span>Movimientos: <strong class="cajas-moves">${state.moves}</strong></span>`];
    if (Number.isFinite(capacidad)) partes.push(`<span>Carga máxima: <strong>${capacidad} kg</strong></span>`);
    // El mínimo viene calculado por el solver: con carga múltiple ya no es
    // el 2^n - 1 de Hanói, así que no se puede deducir del número de cajas.
    if (minMovimientos != null) partes.push(`<span>Mínimo: <strong>${minMovimientos}</strong></span>`);
    info.innerHTML = partes.join('');

    const bloque = bloqueSeleccionado();
    carga.textContent = bloque.length
      ? `Cargando ${peso(bloque)}/${capacidad} kg (${bloque.length} caja${bloque.length === 1 ? '' : 's'})`
      : '';

    state.zonas.forEach((zona, idx) => {
      const { zona: zonaEl, stack } = zonaEls[idx];
      zonaEl.classList.toggle('is-selected', state.seleccion !== null && state.seleccion.zona === idx);
      stack.innerHTML = '';
      zona.forEach((pesoCaja, i) => {
        const cajaEl = createElement('div', { class: 'cajas-caja' });
        // Ancho por posición en el orden de pesos, no por kilos: con cajas
        // de 20 kg el ancho proporcional se salía de la pantalla.
        const rango = pesosOrdenados.indexOf(pesoCaja);
        const paso = totalCajas > 1 ? 140 / (totalCajas - 1) : 0;
        cajaEl.style.width = `${60 + rango * paso}px`;
        cajaEl.textContent = `${pesoCaja} kg`;
        const seleccionada = state.seleccion !== null && state.seleccion.zona === idx &&
          i >= zona.length - state.seleccion.cajas;
        cajaEl.classList.toggle('is-selected', seleccionada);
        stack.appendChild(cajaEl);
      });
    });
  }
}

// Acepta el esquema nuevo (zonas como pilas de pesos) y el antiguo (un
// número de cajas y las zonas como nombres), que es el que quedó en
// archive-pre-relanzamiento.
function normalizar(config) {
  if (!config) return null;

  const esquemaAntiguo = Array.isArray(config.zonas) && typeof config.zonas[0] === 'string';
  if (esquemaAntiguo || !Array.isArray(config.zonas)) {
    const n = Number.isInteger(config.cajas) && config.cajas > 0 ? config.cajas : 3;
    const nombres = esquemaAntiguo && config.zonas.length === 3 ? config.zonas : ['Zona A', 'Zona B', 'Zona C'];
    const idx = nombres.indexOf(config.destino);
    const inicial = [Array.from({ length: n }, (_, i) => n - i), [], []];
    return {
      nombres,
      destino: idx >= 0 ? idx : 2,
      capacidad: Infinity,
      maxCajas: 1,            // Hanói clásico: una caja por viaje
      minMovimientos: Math.pow(2, n) - 1,
      inicial
    };
  }

  const inicial = config.zonas;
  if (inicial.length !== 3 || inicial.some((z) => !Array.isArray(z))) return null;
  if (!inicial.flat().length) return null;

  const nombres = Array.isArray(config.nombresZonas) && config.nombresZonas.length === 3
    ? config.nombresZonas
    : ['Zona A', 'Zona B', 'Zona C'];
  const destino = Number.isInteger(config.destino) && config.destino >= 0 && config.destino < 3
    ? config.destino
    : 2;
  const capacidad = Number.isFinite(config.capacidad) && config.capacidad > 0
    ? config.capacidad
    : Math.max(...inicial.flat());

  return {
    nombres,
    destino,
    capacidad,
    maxCajas: Infinity,
    minMovimientos: Number.isInteger(config.min_movimientos) ? config.min_movimientos : null,
    inicial
  };
}

async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}
