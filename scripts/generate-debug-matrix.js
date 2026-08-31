// ===== scripts/generate-debug-matrix.js =====
// Escribe data/debug/matrix.json y un payload por variante encontrada, para
// la página de debug (debug.html): un tablero con un enlace por variante
// conocida de cada tipo, en vez de esperar a que le toque el turno en el
// calendario real.
//
// Mismo principio que generate-muestrario.js (generadores reales, no
// inventar el esquema a mano), generalizado a MUCHAS semillas por tipo en
// vez de una fija: se prueban semillas 0,1,2… y se guarda la primera que
// produce cada `reto.variant` distinta -- ese campo ya lo escriben los 12
// generadores. `descubreVariantes` (debug-matrix-logic.js) hace el barrido
// puro; este script solo lo conecta con el generador real y con disco.
//
//   node scripts/generate-debug-matrix.js
import fs from 'fs/promises';
import path from 'path';
import { MathGymGenerator } from './generate-daily-reto.js';
import { descubreVariantes } from './debug-matrix-logic.js';
import { TIPOS, tipoInfo } from '../catalogo-tipos.js';

function slug(variant) {
  return String(variant).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  const generator = new MathGymGenerator();
  const matrix = [];

  for (const t of TIPOS) {
    if (!t.generado) continue;

    const destinoDir = path.join('data', 'debug', t.tipo);
    await fs.mkdir(destinoDir, { recursive: true });

    // La misma etiqueta 'debug' en cada llamada: cada generador escribe su
    // archivo de datos con un nombre fijo por etiqueta, así que hay que leer
    // y borrar antes de probar la siguiente semilla o la pisaría.
    const generar = async (seed) => {
      const reto = await generator.templates[t.tipo](seed, 'debug');
      const contenido = await fs.readFile(reto.data.json_url, 'utf8');
      await fs.unlink(reto.data.json_url);

      // La mayoría de tipos ya componen `reto.variant` con todos sus ejes
      // (nonograma con el color, luces-fuera con el objetivo...). Pero
      // laser-triangular deja el modo (clasico/prisma/condensador) solo en
      // el payload, así que sin esto la "variante" solo distinguiría
      // tamaño y nunca se vería ninguna combinación con prisma o
      // condensador. Regla genérica en vez de un `if (tipo === ...)`: si el
      // payload trae su propio campo `modo` y la variante no lo menciona ya,
      // se añade.
      let variant = reto.variant;
      let modo;
      try { modo = JSON.parse(contenido).modo; } catch { /* payload no es JSON de config plano */ }
      if (typeof modo === 'string' && !variant.includes(modo)) variant = `${variant}-${modo}`;

      return { seed, variant, dificultad: reto.dificultad, contenido };
    };

    const encontradas = await descubreVariantes(generar);

    for (const { seed, variant, dificultad, contenido } of encontradas) {
      const nombreArchivo = `${slug(variant)}.json`;
      await fs.writeFile(path.join(destinoDir, nombreArchivo), contenido);
      matrix.push({
        tipo: t.tipo,
        titulo: tipoInfo(t.tipo).nombre,
        variant,
        seed,
        dificultad,
        json_url: `data/debug/${t.tipo}/${nombreArchivo}`
      });
    }

    console.log(`🔍 ${t.tipo}: ${encontradas.length} variantes`);
  }

  await fs.writeFile(path.join('data', 'debug', 'matrix.json'), JSON.stringify(matrix, null, 2));
  console.log(`✅ data/debug/matrix.json (${matrix.length} entradas)`);
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
