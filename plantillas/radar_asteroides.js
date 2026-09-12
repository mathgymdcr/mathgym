// ===== plantillas/radar_asteroides.js =====
// Radar de Asteroides · Buscaminas por pistas. La generación (colocación de
// asteroides + recorte de pistas hasta solución única) vive en
// scripts/radar-logic.js. La plantilla compara la marca del jugador contra
// `solucion` celda a celda -- aquí sí hay una única solución real (a
// diferencia de planos-del-invernadero, la colocación de asteroides no se
// puede "redibujar de otra forma válida").

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
  const asteroidesTotales = config.asteroides_totales;

  if (!n || !pistas || !Number.isInteger(asteroidesTotales)) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de radar de asteroides sin datos válidos</div>';
    return;
  }

  const valorEnCelda = new Map();
  for (const p of pistas) valorEnCelda.set(`${p.f},${p.c}`, p.valor);

  const ui = buildStandardShell({
    tipo: 'radar-asteroides',
    gameClass: 'radar-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> marca los ${asteroidesTotales} asteroides escondidos, sin marcar ninguna celda de más.</p>
      <ul>
        <li>Una celda con número ya está escaneada.</li>
        <li>Ahí nunca hay asteroide.</li>
        <li>El número cuenta sus vecinos con asteroide.</li>
        <li>Cuentan las 8 vecinas, también en diagonal.</li>
        <li>Un 0 significa: las 8 vecinas están libres.</li>
        <li>Toca una celda sin número para marcarla.</li>
        <li>Tócala otra vez para quitar la marca.</li>
        <li>Pulsa «Comprobar» cuando termines.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'radar-info' });
  infoLine.textContent = `${n}x${n} · ${asteroidesTotales} asteroide${asteroidesTotales === 1 ? '' : 's'}`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'radar-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  const marcado = Array.from({ length: n }, () => Array(n).fill(false));
  let fallos = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'radar-celda', type: 'button' });
      const valor = valorEnCelda.get(`${f},${c}`);

      if (valor != null) {
        celda.classList.add('con-pista');
        celda.textContent = valor;
        celda.disabled = true;
      } else {
        const marca = createElement('span', { class: 'radar-marca' });
        celda.appendChild(marca);
        celda.addEventListener('click', () => {
          if (ganado) return;
          marcado[f][c] = !marcado[f][c];
          celda.classList.toggle('marcada', marcado[f][c]);
          actualizarMensaje();
        });
      }

      tablero.appendChild(celda);
      celdas[f][c] = celda;
    }
  }
  ui.box.appendChild(tablero);

  function actualizarMensaje() {
    if (ganado) return;
    let marcados = 0;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) if (marcado[f][c]) marcados++;
    }
    setStatus(ui.result, `Marcados ${marcados} de ${asteroidesTotales}.`, '');
  }

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  ui.box.appendChild(controles);

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;

    const correcto = config.solucion
      ? marcado.every((fila, f) => fila.every((v, c) => v === config.solucion[f][c]))
      : null;

    if (correcto === null) {
      setStatus(ui.result, 'Error: este reto no trae la solución para comprobar', 'ko');
      return;
    }

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Radar despejado en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Localizaste todos los asteroides' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      celdas.flat().forEach((celda) => { celda.disabled = true; });
    } else {
      fallos++;
      setStatus(ui.result, 'Todavía hay marcas de más o de menos -- revisa las pistas.', 'ko');
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
  throw new Error('Faltan datos de configuración del radar de asteroides');
}
