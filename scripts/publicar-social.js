// ===== scripts/publicar-social.js =====
// Bot de publicación diaria. Lo llama el workflow del reto diario justo
// después de commitear el reto, así que lee el reto.json recién escrito.
//
// Solo Bluesky y Mastodon: las dos tienen API de publicación gratuita y sin
// revisión de app. X/Twitter queda fuera a propósito -- su API de publicación
// dejó de ser gratuita.
//
// Si faltan los secretos (un fork, un PR de fuera), no publica y sale con 0:
// que no haya credenciales no es un fallo del reto del día.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numeroDeReto, SITIO } from '../compartir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

const BLUESKY_HOST = 'https://bsky.social';

function puntosDificultad(n) {
  const nivel = Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
  return '●'.repeat(nivel) + '○'.repeat(5 - nivel);
}

/**
 * El post del día. Corto a propósito: Bluesky corta en 300 caracteres, y el
 * mensaje tiene que caber entero con cualquiera de los 12 tipos.
 * NO se asoman las pistas del reto: son media solución.
 */
export function mensajeSocial(reto) {
  const numero = numeroDeReto(reto.fecha);
  const cabecera = numero ? `🧩 MathGym #${numero}` : '🧩 MathGym';

  // El `titulo` del reto ES el `nombre` de la ficha del catálogo (lo escribe
  // así generarReto), de modo que nombrar además el tipo repetiría la misma
  // cadena. Lo que sí añade información es la dificultad y las categorías.
  const segunda = [`Dificultad ${puntosDificultad(reto.dificultad)}`]
    .concat(reto.categorias || [])
    .join(' · ');

  return [
    `${cabecera} — ${reto.titulo}`,
    segunda,
    'Un reto de lógica nuevo cada día, gratis y sin registro.',
    SITIO
  ].join('\n');
}

/**
 * El facet que hace clicable el enlace en Bluesky. Los índices van en BYTES
 * UTF-8 y no en caracteres: con un emoji en el mensaje, contar caracteres
 * deja el enlace partido.
 */
export function facetDelEnlace(texto, url) {
  const posicion = texto.indexOf(url);
  if (posicion < 0) return null;
  const codificador = new TextEncoder();
  const byteStart = codificador.encode(texto.slice(0, posicion)).length;
  const byteEnd = byteStart + codificador.encode(url).length;
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
  };
}
