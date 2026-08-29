// ===== scripts/generate-sitemap.js =====
// Escribe sitemap.xml. No se mantiene a mano por dos razones: cada día hay un
// reto más en el archivo, y cada ?tipo= es una landing de cola larga (el
// ejemplo de prueba de ese puzzle) que sin esto Google no sabe que existe.
//
// Lo llama el workflow diario, después del generador y antes del commit, así
// que el sitemap viaja en el mismo commit que el reto que lo hizo cambiar.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TIPOS } from '../catalogo-tipos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

export const SITIO = 'https://mathgym.es/';

function entrada(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * @param {string[]} tipos    slugs del catálogo ('nonograma', 'luces-fuera'...)
 * @param {string[]} fechas   fechas del archivo, "YYYY-MM-DD"
 * @param {string} hoy        la fecha del reto de hoy, "YYYY-MM-DD"
 * @returns {string} el XML completo
 */
export function construirSitemap(tipos, fechas, hoy) {
  const urls = [
    // La portada cambia cada día: es la única que merece "daily".
    entrada(SITIO, hoy, 'daily', '1.0'),
    entrada(`${SITIO}archivo.html`, hoy, 'daily', '0.8')
  ];

  // Los ejemplos no cambian nunca (payload fijo en data/muestra/), pero son
  // la puerta de entrada por búsquedas de "juego de X online".
  for (const tipo of tipos) {
    urls.push(entrada(`${SITIO}?tipo=${tipo}`, hoy, 'monthly', '0.7'));
  }

  // Un reto pasado ya no vuelve a cambiar: su lastmod es su propio día.
  for (const fecha of fechas) {
    urls.push(entrada(`${SITIO}?fecha=${fecha}`, fecha, 'yearly', '0.5'));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

async function main() {
  const lista = JSON.parse(await fs.readFile(path.join(RAIZ, 'lista_retos.json'), 'utf8'));
  const reto = JSON.parse(await fs.readFile(path.join(RAIZ, 'reto.json'), 'utf8'));
  const fechas = lista.map((r) => r.fecha).filter(Boolean).sort();
  const xml = construirSitemap(TIPOS.map((t) => t.tipo), fechas, reto.fecha);
  await fs.writeFile(path.join(RAIZ, 'sitemap.xml'), xml);
  console.log(`🗺️  sitemap.xml escrito con ${(xml.match(/<url>/g) || []).length} URLs`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ No se pudo escribir el sitemap:', err.message);
    process.exit(1);
  });
}
