// ===== plantillas/trazo_perimetral.js =====
// El Trazo Perimetral · Slitherlink. La generación (2-coloreado de celdas
// dentro/fuera, pistas = cuántos lados de cada celda cambian de color) vive
// en scripts/trazo-logic.js. La plantilla no repite el solver: compara
// directamente las aristas que marca el jugador contra las aristas reales
// del `solucion` publicado (la frontera entre colores).

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const n = config.tablero && config.tablero.ancho;
  const pistas = Array.isArray(config.pistas) ? config.pistas : null;
  const solucion = Array.isArray(config.solucion) ? config.solucion : null;

  if (!n || !pistas || !solucion) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de trazo perimetral sin datos válidos</div>';
    return;
  }

  const pistaEnCelda = new Map();
  for (const p of pistas) pistaEnCelda.set(`${p.f},${p.c}`, p.valor);

  // Aristas CANONICAS (las del `solucion`): una arista separa dos celdas
  // (o una celda y el borde del tablero, que cuenta como "fuera") de
  // distinto color. Se calculan una vez y se comparan contra lo que
  // marque el jugador -- la plantilla no vuelve a resolver el puzzle.
  function colorEn(f, c) {
    if (f < 0 || f >= n || c < 0 || c >= n) return false;
    return solucion[f][c];
  }
  const aristaHCanonica = Array.from({ length: n + 1 }, (_, r) =>
    Array.from({ length: n }, (_, c) => colorEn(r - 1, c) !== colorEn(r, c))
  );
  const aristaVCanonica = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n + 1 }, (_, c) => colorEn(r, c - 1) !== colorEn(r, c))
  );

  const ui = buildStandardShell({
    tipo: 'trazo-perimetral',
    gameClass: 'trazo-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> traza un único circuito cerrado sobre los puntos de la rejilla.</p>
      <ul>
        <li>El número de una celda cuenta sus 4 lados.</li>
        <li>Ese número dice cuántos de esos lados forman parte del circuito.</li>
        <li>Una celda sin número no tiene esa restricción.</li>
        <li>Toca un lado entre dos puntos para activarlo o desactivarlo.</li>
        <li>El circuito final tiene que ser uno solo, cerrado, sin ramas.</li>
        <li>Pulsa «Comprobar» cuando creas que está completo.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'trazo-info' });
  infoLine.textContent = `${n}x${n} · ${pistas.length} pista${pistas.length === 1 ? '' : 's'}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'trazo-tablero' });
  const paso = 100 / n;

  const aristaH = Array.from({ length: n + 1 }, () => Array(n).fill(false));
  const aristaV = Array.from({ length: n }, () => Array(n + 1).fill(false));
  let ganado = false;
  let fallos = 0;

  // Puntos (solo visuales).
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const punto = createElement('div', { class: 'trazo-punto' });
      punto.style.left = `${c * paso}%`;
      punto.style.top = `${r * paso}%`;
      tablero.appendChild(punto);
    }
  }

  // Numeros de pista, centrados en su celda.
  for (const p of pistas) {
    const numero = createElement('div', { class: 'trazo-numero' });
    numero.style.left = `${(p.c + 0.5) * paso}%`;
    numero.style.top = `${(p.f + 0.5) * paso}%`;
    numero.textContent = p.valor;
    tablero.appendChild(numero);
  }

  const botonesH = [];
  for (let r = 0; r <= n; r++) {
    botonesH.push([]);
    for (let c = 0; c < n; c++) {
      const boton = createElement('button', { class: 'trazo-arista trazo-arista-h', type: 'button' });
      boton.style.left = `${c * paso}%`;
      boton.style.top = `${r * paso}%`;
      boton.style.width = `${paso}%`;
      boton.addEventListener('click', () => {
        if (ganado) return;
        aristaH[r][c] = !aristaH[r][c];
        boton.classList.toggle('activa', aristaH[r][c]);
        actualizarMensaje();
      });
      tablero.appendChild(boton);
      botonesH[r].push(boton);
    }
  }

  const botonesV = [];
  for (let r = 0; r < n; r++) {
    botonesV.push([]);
    for (let c = 0; c <= n; c++) {
      const boton = createElement('button', { class: 'trazo-arista trazo-arista-v', type: 'button' });
      boton.style.left = `${c * paso}%`;
      boton.style.top = `${r * paso}%`;
      boton.style.height = `${paso}%`;
      boton.addEventListener('click', () => {
        if (ganado) return;
        aristaV[r][c] = !aristaV[r][c];
        boton.classList.toggle('activa', aristaV[r][c]);
        actualizarMensaje();
      });
      tablero.appendChild(boton);
      botonesV[r].push(boton);
    }
  }

  ui.box.appendChild(tablero);

  function actualizarMensaje() {
    if (ganado) return;
    setStatus(ui.result, 'Traza el circuito y pulsa «Comprobar» cuando esté listo.', '');
  }

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  ui.box.appendChild(controles);

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;

    let correcto = true;
    outer:
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c < n; c++) {
        if (aristaH[r][c] !== aristaHCanonica[r][c]) { correcto = false; break outer; }
      }
    }
    if (correcto) {
      outer2:
      for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) {
          if (aristaV[r][c] !== aristaVCanonica[r][c]) { correcto = false; break outer2; }
        }
      }
    }

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Circuito correcto en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Trazaste el circuito perfecto' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      [...botonesH.flat(), ...botonesV.flat()].forEach((b) => { b.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, 'Todavía no es el circuito correcto -- revisa las pistas.', 'ko');
    }
  });

  setStatus(ui.status, 'Listo para empezar', 'ok');
  actualizarMensaje();
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración del trazo perimetral');
}
