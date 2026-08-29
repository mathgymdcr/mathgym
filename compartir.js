// ===== compartir.js =====
// Convierte una partida terminada en un texto pegable en WhatsApp o en un
// grupo de clase. Es la pieza de marketing más barata que existe: cada
// persona que juega genera, sin querer, un anuncio para sus contactos.
//
// Aquí solo va la parte pura (texto); el botón vive más abajo, en
// pintarCompartir, y lo llama script.js cuando el reto es el de HOY.

import { parDe } from './estrellas.js';
import { diasDelCarne } from './home.js';

// Siempre el mismo enlace, nunca el del día concreto: así el og:image que
// cachean WhatsApp y Bluesky es uno solo y se calienta con cada partida.
export const SITIO = 'https://mathgymdcr.github.io/mathgym/';

// El primer reto del archivo. El número del reto se cuenta en DÍAS desde
// aquí, no en entradas de lista_retos.json: si algún día el cron falla y no
// se publica nada, la serie que ve la gente no se descoloca hacia atrás.
export const EPOCA = '2026-08-20';

const MS_POR_DIA = 86400000;

function aUTC(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function numeroDeReto(fecha) {
  if (!fecha) return null;
  const dias = Math.round((aUTC(fecha) - aUTC(EPOCA)) / MS_POR_DIA);
  return dias >= 0 ? dias + 1 : null;
}

// Un color por marca. El 🟦 es el día completado antes de que existieran las
// estrellas: hecho, pero sin nota. Enseñarlo como ⬜ le borraría a alguien un
// día que sí hizo.
function emojiDeDia(dia) {
  if (!dia || !dia.hecho) return '⬜';
  if (dia.estrellas >= 3) return '🟩';
  if (dia.estrellas === 2) return '🟨';
  if (dia.estrellas === 1) return '🟧';
  return '🟦';
}

export function tiraDelCarne(dias = []) {
  return dias.map(emojiDeDia).join('');
}

// "10 movimientos (mínimo 10)", o null si este tipo no tiene marca que
// enseñar. parDe() ya devuelve null para los que se miden por fallos.
function lineaDeMarca(objectives, marca) {
  const par = parDe(objectives);
  if (!par) return null;
  const clave = par.unidad === 'pesadas' ? 'pesadas' : 'movimientos';
  const valor = marca ? marca[clave] : undefined;
  if (!Number.isFinite(valor)) return null;
  return `${valor} ${par.unidad} (mínimo ${par.valor})`;
}

/**
 * @param {{reto: object, estrellas: number, marca: object, progreso: object}} arg
 * @returns {string} el resumen listo para pegar
 */
export function textoCompartible({ reto, estrellas = 1, marca = {}, progreso = {} }) {
  const numero = numeroDeReto(reto.fecha);
  const cabecera = numero
    ? `MathGym #${numero} · ${reto.titulo}`
    : `MathGym · ${reto.titulo}`;

  const partes = ['⭐'.repeat(Math.max(1, estrellas))];
  const marcaTexto = lineaDeMarca(reto.objectives, marca);
  if (marcaTexto) partes.push(marcaTexto);

  const tira = tiraDelCarne(diasDelCarne(reto.fecha, progreso.completed || {}));
  const racha = progreso.currentStreak
    ? `${tira} · 🔥 ${progreso.currentStreak}`
    : tira;

  return `${cabecera}\n${partes.join(' · ')}\n${racha}\n${SITIO}`;
}

const ETIQUETA_INICIAL = '📋 Copiar resultado';

async function copiar(texto) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error('sin portapapeles');
  }
  await navigator.clipboard.writeText(texto);
}

/**
 * Añade el bloque de compartir a la celebración que YA está en pantalla, igual
 * que pintarEstrellas. Devuelve el bloque, o null si no hay celebración.
 *
 * El bloque lleva `data-mantener`: ver plantillas/celebration.js, donde ese
 * atributo es lo que impide que pulsarlo cierre el overlay.
 */
export function pintarCompartir({ reto, estrellas, marca, progreso }) {
  const card = document.querySelector('.celebration-overlay .celebration-card');
  if (!card) return null;

  const texto = textoCompartible({ reto, estrellas, marca, progreso });

  const bloque = document.createElement('div');
  bloque.className = 'celebration-compartir';
  bloque.setAttribute('data-mantener', '');

  const vista = document.createElement('pre');
  vista.className = 'compartir-preview';
  vista.textContent = texto;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn btn-secondary';
  boton.dataset.action = 'compartir';
  boton.textContent = ETIQUETA_INICIAL;

  boton.addEventListener('click', async () => {
    try {
      await copiar(texto);
      boton.textContent = '✅ Copiado';
    } catch {
      // Sin portapapeles (contexto no seguro, permiso denegado) el texto ya
      // está a la vista: se selecciona para que baste con Ctrl+C.
      boton.textContent = '⚠️ Cópialo a mano';
      const sel = window.getSelection && window.getSelection();
      if (sel && document.createRange) {
        const rango = document.createRange();
        rango.selectNodeContents(vista);
        sel.removeAllRanges();
        sel.addRange(rango);
      }
    }
  });

  bloque.appendChild(vista);
  bloque.appendChild(boton);
  card.appendChild(bloque);
  return bloque;
}
