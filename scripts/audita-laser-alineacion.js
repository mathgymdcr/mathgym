// ===== scripts/audita-laser-alineacion.js =====
// Barrido de solo lectura sobre el archivo publicado de laser-triangular:
// para cada reto, comprueba si la solucion minima real (piezasMinimas, que
// ya conoce la regla de llegada al centro y el espejo-vertice) sigue
// existiendo. No modifica retos/ ni data/ -- solo escribe un reporte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezasMinimas, normalizaConfig } from './laser-triangular-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

// Funcion pura: recibe una lista de configs YA CARGADOS (size/modo/
// lasers/targets/blocks/fecha/min_piezas) y devuelve el diagnostico, sin
// tocar disco -- asi el test la ejercita sin depender de lista_retos.json.
export function auditaAlineacion(configs) {
  const desalineados = [];
  for (const config of configs) {
    const c = normalizaConfig(config);
    const declarado = Number.isInteger(config.min_piezas) ? config.min_piezas : 6;
    const minimo = piezasMinimas(c, Math.max(declarado, 6));
    if (minimo === null) {
      desalineados.push({ fecha: config.fecha, motivo: 'sin solucion bajo la regla nueva' });
    }
  }
  return { total: configs.length, alineados: configs.length - desalineados.length, desalineados };
}

async function main() {
  // lista_retos.json (fecha/titulo/dificultad/categorias) no lleva `tipo` --
  // el tipo solo vive en retos/{fecha}.json, asi que hay que abrir cada uno
  // para filtrar, no se puede filtrar sobre la propia entrada de la lista.
  const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'lista_retos.json'), 'utf8'));
  const configs = [];
  for (const entrada of lista) {
    const retoPath = path.join(RAIZ, 'retos', `${entrada.fecha}.json`);
    if (!fs.existsSync(retoPath)) continue;
    const reto = JSON.parse(fs.readFileSync(retoPath, 'utf8'));
    if (reto.tipo !== 'laser-triangular') continue;
    const dataPath = path.join(RAIZ, reto.data.json_url);
    if (!fs.existsSync(dataPath)) continue;
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    configs.push({ ...data, fecha: entrada.fecha });
  }
  const reporte = auditaAlineacion(configs);
  const outDir = path.join(RAIZ, 'data', 'debug');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'auditoria-laser-alineacion.json'),
    JSON.stringify(reporte, null, 2)
  );
  console.log(`laser-triangular: ${reporte.alineados}/${reporte.total} alineados, ${reporte.desalineados.length} marcados`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
