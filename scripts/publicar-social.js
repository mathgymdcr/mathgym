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

async function pedirJSON(url, opciones) {
  const respuesta = await fetch(url, opciones);
  const cuerpo = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`${respuesta.status} ${respuesta.statusText} — ${cuerpo.slice(0, 300)}`);
  }
  return cuerpo ? JSON.parse(cuerpo) : {};
}

// Bluesky son dos llamadas: abrir sesión con la app password (NUNCA la
// contraseña de la cuenta) y crear el registro del post.
export async function publicarBluesky({ handle, password, texto }) {
  const sesion = await pedirJSON(`${BLUESKY_HOST}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password })
  });

  const facet = facetDelEnlace(texto, SITIO);
  const record = {
    $type: 'app.bsky.feed.post',
    text: texto,
    createdAt: new Date().toISOString(),
    langs: ['es'],
    // La tarjeta con imagen la saca Bluesky del og:image del sitio (tarea 1):
    // por eso el enlace del post es SIEMPRE el de inicio y no el del día.
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: SITIO,
        title: 'MathGym — Reto de lógica del día',
        description: 'Un reto de lógica nuevo cada día, gratis y sin registro.'
      }
    }
  };
  if (facet) record.facets = [facet];

  return pedirJSON(`${BLUESKY_HOST}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesion.accessJwt}`
    },
    body: JSON.stringify({ repo: sesion.did, collection: 'app.bsky.feed.post', record })
  });
}

// Mastodon es una sola llamada con el token de la app.
export async function publicarMastodon({ instancia, token, texto }) {
  const base = instancia.startsWith('http') ? instancia : `https://${instancia}`;
  return pedirJSON(`${base.replace(/\/$/, '')}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: texto, language: 'es', visibility: 'public' })
  });
}

async function main() {
  const seco = process.argv.includes('--dry-run');
  const reto = JSON.parse(await fs.readFile(path.join(RAIZ, 'reto.json'), 'utf8'));
  const texto = mensajeSocial(reto);

  console.log('--- mensaje ---');
  console.log(texto);
  console.log(`--- ${[...texto].length} caracteres ---`);

  if (seco) return;

  const { BLUESKY_HANDLE, BLUESKY_APP_PASSWORD, MASTODON_INSTANCIA, MASTODON_TOKEN } = process.env;
  const destinos = [];
  if (BLUESKY_HANDLE && BLUESKY_APP_PASSWORD) {
    destinos.push(['Bluesky', () => publicarBluesky({
      handle: BLUESKY_HANDLE, password: BLUESKY_APP_PASSWORD, texto
    })]);
  }
  if (MASTODON_INSTANCIA && MASTODON_TOKEN) {
    destinos.push(['Mastodon', () => publicarMastodon({
      instancia: MASTODON_INSTANCIA, token: MASTODON_TOKEN, texto
    })]);
  }

  if (!destinos.length) {
    console.log('ℹ️  Sin credenciales de redes: no se publica nada. No es un fallo.');
    return;
  }

  // Cada red por su cuenta: que Mastodon esté caído no debe impedir el post
  // de Bluesky, y ninguna de las dos debe tumbar el reto del día.
  let fallos = 0;
  for (const [nombre, publicar] of destinos) {
    try {
      await publicar();
      console.log(`✅ Publicado en ${nombre}`);
    } catch (err) {
      fallos++;
      console.error(`❌ ${nombre}: ${err.message}`);
    }
  }
  if (fallos === destinos.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Bot social:', err.message);
    process.exit(1);
  });
}
