// ===== plantillas/androides_fabrica.js =====
// Androides en la Fábrica. Dos capas independientes por celda -- modelo
// (cuadrado latino) y clase (color libre con pistas de adyacencia) --
// generadas y comprobadas en scripts/androides-logic.js; la plantilla solo
// pinta y compara contra `solucionModelo`/`solucionClase`, nunca decide si
// el reto es solvente.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const PALETA_CLASE = ['#3D8BE0', '#E85B4A', '#F8C818', '#3DBE7A'];

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
  const numClases = config.numClases;
  const dadosModelo = Array.isArray(config.dadosModelo) ? config.dadosModelo : null;
  const dadosClase = Array.isArray(config.dadosClase) ? config.dadosClase : null;
  const pistasPares = Array.isArray(config.pistasPares) ? config.pistasPares : null;
  const solucionModelo = Array.isArray(config.solucionModelo) ? config.solucionModelo : null;
  const solucionClase = Array.isArray(config.solucionClase) ? config.solucionClase : null;

  if (!n || !numClases || !dadosModelo || !dadosClase || !pistasPares || !solucionModelo || !solucionClase) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de androides en la fábrica sin datos válidos</div>';
    return;
  }

  const ui = buildStandardShell({
    tipo: 'androides-en-la-fabrica',
    gameClass: 'androides-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> pon el modelo y la clase de cada sala de la rejilla de ${n}x${n}.</p>
      <ul>
        <li>El modelo es un número del 1 al ${n}: no se repite en la misma fila ni columna.</li>
        <li>La clase es un color: no tiene esa restricción, pero algunas parejas de salas vecinas dan una pista.</li>
        <li>Una pista «=» entre dos salas vecinas dice que llevan la misma clase.</li>
        <li>Una pista «≠» entre dos salas vecinas dice que llevan clases distintas.</li>
        <li>Toca un número del panel «Modelo» y después una sala para escribirlo.</li>
        <li>Toca un color del panel «Clase» y después una sala para pintarla.</li>
        <li>Toca la misma sala otra vez con la misma herramienta para vaciar esa capa.</li>
        <li>Algunas salas ya traen su modelo o su clase fijados de fábrica.</li>
        <li>Pulsa «Comprobar» cuando la rejilla esté completa.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'androides-info' });
  infoLine.textContent = `${n}x${n} · ${numClases} clases · ${pistasPares.length} pista${pistasPares.length === 1 ? '' : 's'} de contacto`;
  ui.box.appendChild(infoLine);

  const fijoModelo = Array.from({ length: n }, () => Array(n).fill(false));
  const fijoClase = Array.from({ length: n }, () => Array(n).fill(false));
  const valorModelo = Array.from({ length: n }, () => Array(n).fill(0));
  const valorClase = Array.from({ length: n }, () => Array(n).fill(-1));

  for (const { f, c, valor } of dadosModelo) { fijoModelo[f][c] = true; valorModelo[f][c] = valor; }
  for (const { f, c, valor } of dadosClase) { fijoClase[f][c] = true; valorClase[f][c] = valor; }

  const wrap = createElement('div', { class: 'androides-tablero-wrap' });
  const tablero = createElement('div', { class: 'androides-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  wrap.appendChild(tablero);

  let herramienta = null; // {tipo:'modelo', valor} | {tipo:'clase', valor} | null
  let fallos = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  function pintaCelda(f, c) {
    const { celda, valorSpan } = celdas[f][c];
    valorSpan.textContent = valorModelo[f][c] || '';
    if (valorClase[f][c] >= 0) {
      celda.style.backgroundColor = PALETA_CLASE[valorClase[f][c] % PALETA_CLASE.length];
      celda.classList.add('con-clase');
    } else {
      celda.style.backgroundColor = '';
      celda.classList.remove('con-clase');
    }
  }

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'androides-celda', type: 'button' });
      const valorSpan = createElement('span', { class: 'androides-celda-valor' });
      celda.appendChild(valorSpan);
      if (fijoModelo[f][c]) celda.classList.add('modelo-fijo');
      if (fijoClase[f][c]) celda.classList.add('clase-fija');

      celda.addEventListener('click', () => {
        if (ganado || herramienta == null) return;
        if (herramienta.tipo === 'modelo') {
          if (fijoModelo[f][c]) return;
          valorModelo[f][c] = valorModelo[f][c] === herramienta.valor ? 0 : herramienta.valor;
        } else {
          if (fijoClase[f][c]) return;
          valorClase[f][c] = valorClase[f][c] === herramienta.valor ? -1 : herramienta.valor;
        }
        pintaCelda(f, c);
        actualizarMensaje();
      });

      tablero.appendChild(celda);
      celdas[f][c] = { celda, valorSpan };
      pintaCelda(f, c);
    }
  }

  // Marcadores de las pistas de contacto, superpuestos en el punto medio
  // entre las dos salas de cada pareja -- mismo patrón porcentual que el
  // trazo perimetral para pintar elementos entre celdas de la rejilla.
  const paso = 100 / n;
  for (const p of pistasPares) {
    const [fa, ca] = p.a;
    const [fb, cb] = p.b;
    const marca = createElement('div', { class: `androides-marca ${p.misma ? 'misma' : 'distinta'}` });
    marca.style.left = `${((ca + cb) / 2 + 0.5) * paso}%`;
    marca.style.top = `${((fa + fb) / 2 + 0.5) * paso}%`;
    marca.textContent = p.misma ? '=' : '≠';
    wrap.appendChild(marca);
  }

  ui.box.appendChild(wrap);

  const panelModelo = createElement('div', { class: 'androides-panel' });
  const tituloModelo = createElement('div', { class: 'androides-panel-titulo' });
  tituloModelo.textContent = 'Modelo';
  panelModelo.appendChild(tituloModelo);
  const numpadModelo = createElement('div', { class: 'androides-numpad' });
  const botonesHerramienta = [];

  function seleccionaHerramienta(herr, boton) {
    if (ganado) return;
    const mismaHerramienta = herramienta && herramienta.tipo === herr.tipo && herramienta.valor === herr.valor;
    herramienta = mismaHerramienta ? null : herr;
    botonesHerramienta.forEach(({ boton: b, herr: h }) => {
      b.classList.toggle('seleccionado', !!herramienta && herramienta.tipo === h.tipo && herramienta.valor === h.valor);
    });
  }

  for (let v = 1; v <= n; v++) {
    const boton = createElement('button', { class: 'androides-num', type: 'button' });
    boton.textContent = v;
    const herr = { tipo: 'modelo', valor: v };
    boton.addEventListener('click', () => seleccionaHerramienta(herr, boton));
    numpadModelo.appendChild(boton);
    botonesHerramienta.push({ boton, herr });
  }
  const btnBorrarModelo = createElement('button', { class: 'androides-num androides-num-borrar', type: 'button' });
  btnBorrarModelo.textContent = 'Borrar';
  const herrBorrarModelo = { tipo: 'modelo', valor: 0 };
  btnBorrarModelo.addEventListener('click', () => seleccionaHerramienta(herrBorrarModelo, btnBorrarModelo));
  numpadModelo.appendChild(btnBorrarModelo);
  botonesHerramienta.push({ boton: btnBorrarModelo, herr: herrBorrarModelo });
  panelModelo.appendChild(numpadModelo);
  ui.box.appendChild(panelModelo);

  const panelClase = createElement('div', { class: 'androides-panel' });
  const tituloClase = createElement('div', { class: 'androides-panel-titulo' });
  tituloClase.textContent = 'Clase';
  panelClase.appendChild(tituloClase);
  const numpadClase = createElement('div', { class: 'androides-numpad' });

  for (let v = 0; v < numClases; v++) {
    const boton = createElement('button', { class: 'androides-swatch', type: 'button' });
    boton.style.backgroundColor = PALETA_CLASE[v % PALETA_CLASE.length];
    const herr = { tipo: 'clase', valor: v };
    boton.addEventListener('click', () => seleccionaHerramienta(herr, boton));
    numpadClase.appendChild(boton);
    botonesHerramienta.push({ boton, herr });
  }
  const btnBorrarClase = createElement('button', { class: 'androides-num androides-num-borrar', type: 'button' });
  btnBorrarClase.textContent = 'Borrar';
  const herrBorrarClase = { tipo: 'clase', valor: -1 };
  btnBorrarClase.addEventListener('click', () => seleccionaHerramienta(herrBorrarClase, btnBorrarClase));
  numpadClase.appendChild(btnBorrarClase);
  botonesHerramienta.push({ boton: btnBorrarClase, herr: herrBorrarClase });
  panelClase.appendChild(numpadClase);
  ui.box.appendChild(panelClase);

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Comprobar';
  const btnReiniciar = createElement('button', { class: 'btn btn-secondary' });
  btnReiniciar.textContent = 'Reiniciar';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  controles.appendChild(btnReiniciar);
  ui.box.appendChild(controles);

  btnReiniciar.addEventListener('click', () => {
    if (ganado) return;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (!fijoModelo[f][c]) valorModelo[f][c] = 0;
        if (!fijoClase[f][c]) valorClase[f][c] = -1;
        pintaCelda(f, c);
      }
    }
    herramienta = null;
    botonesHerramienta.forEach(({ boton }) => boton.classList.remove('seleccionado'));
    actualizarMensaje();
  });

  function faltantes() {
    let faltan = 0;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (valorModelo[f][c] === 0) faltan++;
        if (valorClase[f][c] < 0) faltan++;
      }
    }
    return faltan;
  }

  function actualizarMensaje() {
    if (ganado) return;
    const faltan = faltantes();
    if (faltan > 0) {
      setStatus(ui.result, `Faltan ${faltan} dato${faltan === 1 ? '' : 's'} por rellenar.`, '');
    } else {
      setStatus(ui.result, 'Rejilla completa. Pulsa «Comprobar».', '');
    }
  }

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;
    if (faltantes() > 0) {
      setStatus(ui.result, 'Completa todas las salas antes de comprobar', 'ko');
      return;
    }

    const correcto = valorModelo.every((fila, f) => fila.every((v, c) => v === solucionModelo[f][c]))
      && valorClase.every((fila, f) => fila.every((v, c) => v === solucionClase[f][c]));

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Fábrica ordenada en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Completaste los Androides en la Fábrica' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) celdas[f][c].celda.disabled = true;
      }
    } else {
      fallos++;
      setStatus(ui.result, 'Todavía hay algo que no cuadra -- revisa modelos, clases y contactos.', 'ko');
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
  throw new Error('Faltan datos de configuración de androides en la fábrica');
}
