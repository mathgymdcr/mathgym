// ===== plantillas/shell.js =====
// Helpers compartidos para el patrón cabecera + instrucciones + estado que
// cada plantilla reconstruye a mano (ver `buildShell` en trasvase_ecologico.js,
// poligono_geometrico.js, etc). Usar en plantillas nuevas; las existentes no se
// tocan para no arriesgar regresiones en juegos que ya funcionan.

import { tipoInfo } from '../catalogo-tipos.js';

export function createElement(tag, attributes = {}) {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
}

// Un icono puede ser un emoji o la ruta de una imagen (assets/icono-*.svg).
// Las rutas se montan como <img> para que el SVG conserve sus colores y su alfa;
// el emoji se sigue pintando como texto.
export function pintarIcono(element, icono, alt = '') {
  if (!element) return;
  element.textContent = '';
  if (typeof icono === 'string' && /\.(svg|png)$/i.test(icono)) {
    const img = createElement('img', { src: icono, alt });
    if (!alt) img.setAttribute('aria-hidden', 'true');
    element.appendChild(img);
  } else {
    element.textContent = icono;
  }
}

export function setStatus(element, text, type = '') {
  if (!element) return;
  element.textContent = text;
  element.className = element.className.split(' ')[0];
  if (type) element.classList.add(type);
}

/**
 * Construye la cabecera + caja de instrucciones (con Deceerre) + estado
 * que comparten todas las plantillas. Devuelve los elementos para que la
 * plantilla añada su propio contenido de juego dentro de `box`.
 *
 * El nombre y el icono no se pasan: salen del catálogo a partir de `tipo`,
 * que es la única fuente de verdad de ambos.
 *
 * @param {{tipo: string, gameClass: string, instructionsHTML: string}} opts
 */
export function buildStandardShell({ tipo, gameClass, instructionsHTML }) {
  const { nombre, icono } = tipoInfo(tipo);
  const box = createElement('div', { class: `template-box ${gameClass}` });

  const header = createElement('div', { class: 'enigma-header-dark' });
  const headerIcon = createElement('span', { class: 'enigma-header-icon' });
  pintarIcono(headerIcon, icono);
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = nombre;
  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  box.appendChild(header);

  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  const instructions = createElement('div', { class: 'card deceerre-instructions' });
  const instructionsImg = createElement('img', { src: 'assets/deceerre-instructions.png', alt: 'Deceerre' });
  const instructionsBody = createElement('div', { class: 'instructions-body' });
  instructionsBody.innerHTML = instructionsHTML;
  instructions.appendChild(instructionsImg);
  instructions.appendChild(instructionsBody);
  box.appendChild(instructions);

  const result = createElement('div', { class: 'feedback' });
  box.appendChild(result);

  return { box, status, result };
}
