// ===== scripts/generate-muestrario.js =====
// Escribe los JSON de ejemplo que sirve la portada (?tipo=), uno por tipo con
// generador, en data/muestra/. Los ejemplos salen de los generadores de
// verdad con una semilla fija: así el muestrario nunca enseña un esquema
// distinto del que se publica a diario, y basta con volver a lanzar este
// script cuando un esquema cambie.
//
// Los tipos sin generador (`generado: false` en catalogo-tipos.js) tienen su
// JSON escrito a mano en data/muestra/ y este script no los toca.
//
//   node scripts/generate-muestrario.js
import fs from 'fs/promises';
import path from 'path';
import { MathGymGenerator } from './generate-daily-reto.js';
import { TIPOS } from '../catalogo-tipos.js';

// Semillas elegidas para que el ejemplo de cada tipo sea de los pequeños:
// el muestrario es una vitrina, no el reto del día.
const SEMILLAS = {
  // 4x4: el enigma se sortea entre cuatro tamaños y la vitrina enseña el
  // pequeño, no el 5x5 de 18 pistas.
  'enigma-einstein': 20260104,
  'balanza-logica': 20260103,
  // 20260104 daba el reto minimo del tipo (dos trominos de 3 celdas, con
  // el reparto 3+3 forzado y nada que deducir). Este saca un reparto 3+11,
  // que no se ve venir, y dos figuras que se dibujan bien.
  'poligono-geometrico': 20260112,
  // con-grifo-3-1objetivos: la combinación llana de los tres ejes (el de
  // objetivos incluido), que el ejemplo es una vitrina y no el reto del día.
  'mezcla-quimica': 20260121,
  'luces-fuera': 20260107,
  'relojes-arena': 20260107,
  'puentes-hashi': 20260108,
  // pequeno (monocromo): el nonograma sortea también el eje de color, y la
  // vitrina enseña la combinación llana -- la regla de contacto entre
  // colores se aprende en el reto del día, no en el ejemplo de entrada.
  'nonograma': 20260104,
  'cajas-apiladas': 20260110,
  'anillas-encadenadas': 20260112,
  // prisma medio: el ejemplo de la sala tiene que ensenar la mecanica nueva
  // (no clasico), y medio para que aparezca el boton de lanzar (ver
  // README_TEMPLATES / Task 12) en vez del trazado automatico de pequeno.
  'laser-triangular': 20260102,
  'riego-plantas': 20260116
};

async function main() {
  const generator = new MathGymGenerator();
  await fs.mkdir(path.join('data', 'muestra'), { recursive: true });

  for (const t of TIPOS) {
    const destino = path.join('data', 'muestra', `${t.tipo}.json`);

    if (!t.generado) {
      try {
        await fs.access(destino);
        console.log(`✍️  ${t.tipo}: escrito a mano, se respeta`);
      } catch {
        console.error(`❌ ${t.tipo}: falta ${destino} (los tipos sin generador se escriben a mano)`);
        process.exitCode = 1;
      }
      continue;
    }

    const semilla = SEMILLAS[t.tipo];
    if (semilla == null) {
      console.error(`❌ ${t.tipo}: sin semilla en SEMILLAS`);
      process.exitCode = 1;
      continue;
    }

    const reto = await generator.templates[t.tipo](semilla, 'muestra');
    let payload;
    if (reto.data && reto.data.json_url) {
      payload = await fs.readFile(reto.data.json_url, 'utf8');
      await fs.unlink(reto.data.json_url);   // el archivo temporal del generador
    } else {
      payload = JSON.stringify(reto.data, null, 2);
    }

    await fs.writeFile(destino, payload);
    console.log(`🎲 ${t.tipo}: ${destino} (variante ${reto.variant || '-'} , semilla ${semilla})`);
  }
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
