// ===== plantillas/senal_perdida.js =====
// Señal Perdida. Cada letra del alfabeto usado está anclada a una celda de
// la rejilla; las pistas (compartidas con el generador y el validador via
// scripts/senal-logic.js) acotan dónde va cada una. Mismo patrón de
// interacción que fabrica-de-bloques: toca una letra de la bandeja y luego
// una celda para colocarla ahí (o la misma celda otra vez para vaciarla).

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';
import { cumplePista, pistaTexto } from '../scripts/senal-logic.js';

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
  const alfabeto = Array.isArray(config.alfabeto) ? config.alfabeto : null;
  const solucion = config.solucion;
  const mensajeCifrado = Array.isArray(config.mensaje_cifrado) ? config.mensaje_cifrado : null;
  const pistas = Array.isArray(config.pistas) ? config.pistas : null;

  if (!n || !alfabeto || !solucion || !mensajeCifrado || !pistas) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de señal perdida sin datos válidos</div>';
    return;
  }

  const ui = buildStandardShell({
    tipo: 'senal-perdida',
    gameClass: 'senal-game',
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> coloca cada letra en su celda de la rejilla ${n}x${n}.</p>
      <ul>
        <li>Las pistas dicen cosas sobre la columna o la fila de cada letra.</li>
        <li>Las columnas y filas se numeran desde 0.</li>
        <li>Toca una letra de la bandeja para seleccionarla.</li>
        <li>Toca una celda para colocar ahí la letra seleccionada.</li>
        <li>Toca una celda ocupada para vaciarla.</li>
        <li>El mensaje se va completando con las letras que coloques.</li>
        <li>Cuando la rejilla esté completa, pulsa «Comprobar».</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const panelPistas = createElement('div', { class: 'senal-pistas' });
  const tituloPistas = createElement('h4');
  tituloPistas.textContent = 'Pistas';
  panelPistas.appendChild(tituloPistas);
  const listaPistas = createElement('ul');
  for (const p of pistas) {
    const li = createElement('li');
    li.textContent = pistaTexto(p);
    listaPistas.appendChild(li);
  }
  panelPistas.appendChild(listaPistas);
  ui.box.appendChild(panelPistas);

  const mensajeBox = createElement('div', { class: 'senal-mensaje' });
  const celdasMensaje = mensajeCifrado.map(() => {
    const span = createElement('span', { class: 'senal-mensaje-letra' });
    span.textContent = '_';
    mensajeBox.appendChild(span);
    return span;
  });
  ui.box.appendChild(mensajeBox);

  const tablero = createElement('div', { class: 'senal-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  // celdaEn[x][y] = letra colocada ahí, o null
  const celdaEn = Array.from({ length: n }, () => Array(n).fill(null));
  const posDeLetra = {}; // letra -> [x,y] o null si aun no se coloco
  alfabeto.forEach((l) => { posDeLetra[l] = null; });

  let seleccionada = null;
  let fallos = 0;
  let ganado = false;

  const celdasDom = Array.from({ length: n }, () => new Array(n));
  // Las celdas se recorren por fila (y) y columna (x) para que se pinten
  // como una rejilla visual normal; internamente todo se indexa [x][y].
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const celda = createElement('button', { class: 'senal-celda', type: 'button' });
      celda.addEventListener('click', () => {
        if (ganado) return;
        const actual = celdaEn[x][y];
        if (actual) {
          // vaciar
          celdaEn[x][y] = null;
          posDeLetra[actual] = null;
          celda.textContent = '';
          celda.classList.remove('ocupada');
          actualizarBandeja();
          actualizarMensaje();
          return;
        }
        if (!seleccionada) return;
        // si la letra seleccionada ya estaba en otra celda, se mueve
        const previa = posDeLetra[seleccionada];
        if (previa) {
          celdaEn[previa[0]][previa[1]] = null;
          celdasDom[previa[0]][previa[1]].textContent = '';
          celdasDom[previa[0]][previa[1]].classList.remove('ocupada');
        }
        celdaEn[x][y] = seleccionada;
        posDeLetra[seleccionada] = [x, y];
        celda.textContent = seleccionada;
        celda.classList.add('ocupada');
        seleccionada = null;
        actualizarBandeja();
        actualizarMensaje();
      });
      tablero.appendChild(celda);
      celdasDom[x][y] = celda;
    }
  }
  ui.box.appendChild(tablero);

  const bandeja = createElement('div', { class: 'senal-bandeja' });
  const botonesLetra = new Map();
  for (const letra of alfabeto) {
    const boton = createElement('button', { class: 'senal-letra', type: 'button' });
    boton.textContent = letra;
    boton.addEventListener('click', () => {
      if (ganado || posDeLetra[letra]) return;
      seleccionada = seleccionada === letra ? null : letra;
      actualizarBandeja();
    });
    bandeja.appendChild(boton);
    botonesLetra.set(letra, boton);
  }
  ui.box.appendChild(bandeja);

  function actualizarBandeja() {
    for (const [letra, boton] of botonesLetra) {
      boton.classList.toggle('seleccionada', seleccionada === letra);
      boton.classList.toggle('colocada', Boolean(posDeLetra[letra]));
    }
  }

  function actualizarMensaje() {
    mensajeCifrado.forEach(([x, y], i) => {
      celdasMensaje[i].textContent = celdaEn[x][y] || '_';
    });
    if (ganado) return;
    const colocadas = alfabeto.filter((l) => posDeLetra[l]).length;
    if (colocadas < alfabeto.length) {
      setStatus(ui.result, `Colocadas ${colocadas} de ${alfabeto.length} letras.`, '');
    } else {
      setStatus(ui.result, 'Rejilla completa. Pulsa «Comprobar».', '');
    }
  }

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
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        celdaEn[x][y] = null;
        celdasDom[x][y].textContent = '';
        celdasDom[x][y].classList.remove('ocupada');
      }
    }
    alfabeto.forEach((l) => { posDeLetra[l] = null; });
    seleccionada = null;
    actualizarBandeja();
    actualizarMensaje();
  });

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;
    if (alfabeto.some((l) => !posDeLetra[l])) {
      setStatus(ui.result, 'Coloca todas las letras antes de comprobar', 'ko');
      return;
    }

    const correcto = alfabeto.every((l) => cumplePista(
      { tipo: 'posicion_absoluta', a: l, valor: solucion[l] }, posDeLetra
    ));

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `¡Mensaje descifrado en ${fallos} fallo${fallos === 1 ? '' : 's'}!`, 'ok');
      celebrate({ ok: true, message: 'Descifraste la Señal Perdida' });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) celdasDom[x][y].disabled = true;
      for (const boton of botonesLetra.values()) boton.disabled = true;
    } else {
      fallos++;
      setStatus(ui.result, 'Todavía hay alguna letra en la celda equivocada.', 'ko');
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
  throw new Error('Faltan datos de configuración de la señal perdida');
}
