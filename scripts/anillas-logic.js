// ===== scripts/anillas-logic.js =====
// Anillas encadenadas (Baguenaudier), compartido entre
// scripts/generate-daily-reto.js y scripts/validate-retos.js.
//
// El estado es un array de booleanos: true = anilla enganchada en la barra.
// El índice 0 es la anilla 1, la que siempre se puede tocar.
//
// La propiedad que hace interesante generarlo: los 2^n estados forman UN
// SOLO CAMINO (es un código de Gray), así que cualquier configuración es
// alcanzable desde cualquier otra y cada estado está a una distancia
// distinta del objetivo. Por eso arrancar desde una posición cualquiera --
// en vez de "todas enganchadas", que siempre da el mismo número -- convierte
// el mínimo en algo que hay que calcular de verdad.

export const REGLAS = ['clasico', 'dos-de-golpe'];

// Anillas que se pueden tocar ahora mismo, según la regla del puzzle:
//  - la anilla 1 siempre;
//  - si la 1 está enganchada, además la 2;
//  - si la 1 está suelta, la siguiente a la primera enganchada.
export function tocables(estado) {
  const n = estado.length;
  const res = [0];
  if (estado[0]) {
    if (n > 1) res.push(1);
  } else {
    const primera = estado.findIndex(Boolean);
    if (primera !== -1 && primera + 1 < n) res.push(primera + 1);
  }
  return res;
}

// Movimientos legales como listas de índices. En la variante 'dos-de-golpe'
// se puede mover el par (1, 2) de una sola vez, lo que baja el mínimo a unos
// tres cuartos del clásico y rompe la estrategia aprendida.
export function movimientos(estado, regla = 'clasico') {
  const movs = tocables(estado).map((i) => [i]);
  if (regla === 'dos-de-golpe' && estado.length >= 2) movs.push([0, 1]);
  return movs;
}

const clave = (estado) => estado.map(Number).join('');

// BFS: mínimo real de movimientos del inicio al objetivo, con los pasos.
export function resolverAnillas(inicio, objetivo, regla = 'clasico') {
  const destino = clave(objetivo);
  if (clave(inicio) === destino) return { movimientos: 0, pasos: [] };

  const vistos = new Map([[clave(inicio), null]]);
  let frontera = [inicio];

  while (frontera.length) {
    const siguiente = [];
    for (const estado of frontera) {
      for (const mov of movimientos(estado, regla)) {
        const nuevo = [...estado];
        for (const i of mov) nuevo[i] = !nuevo[i];
        const k = clave(nuevo);
        if (vistos.has(k)) continue;
        vistos.set(k, { previo: clave(estado), mov });

        if (k === destino) {
          const pasos = [];
          let cur = k;
          while (vistos.get(cur)) {
            const { previo, mov: m } = vistos.get(cur);
            pasos.unshift(m);
            cur = previo;
          }
          return { movimientos: pasos.length, pasos };
        }
        siguiente.push(nuevo);
      }
    }
    frontera = siguiente;
  }

  return null;
}

// Mínimo para soltarlas TODAS con la regla clásica, sin explorar nada: el
// estado leído como código de Gray, convertido a binario, ES el número de
// movimientos. La anilla n es el bit más significativo.
//
// A propósito no lo usa el validador, que recorre el BFS: son dos caminos
// independientes y tests/anillas/logica.test.js comprueba que coinciden en
// todos los estados hasta 8 anillas.
export function minimoPorFormula(estado) {
  const n = estado.length;
  let anterior = 0;
  let total = 0;
  for (let i = n - 1; i >= 0; i--) {
    const bit = (estado[i] ? 1 : 0) ^ anterior;
    total += bit * Math.pow(2, i);
    anterior = bit;
  }
  return total;
}

// --- Generador ------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Las tres variantes que rotan por fecha. Todas arrancan desde una
// configuración cualquiera: eso es lo que hace que el mínimo deje de ser la
// fórmula de siempre y haya que calcularlo.
const VARIANTES = ['clasico', 'dos-de-golpe', 'configuracion'];
const TAMANOS = [4, 5, 6];
const MAX_INTENTOS = 400;

const estadoDesde = (rand, n) => Array.from({ length: n }, () => rand() < 0.5);

export function buildAnillasPuzzle(seed) {
  const variant = VARIANTES[seed % VARIANTES.length];
  const rings = TAMANOS[Math.floor(seed / VARIANTES.length) % TAMANOS.length];
  const regla = variant === 'dos-de-golpe' ? 'dos-de-golpe' : 'clasico';
  const minimoClasico = minimoPorFormula(Array(rings).fill(true));

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 40961) >>> 0);

    const inicial = estadoDesde(rand, rings);
    let objetivo = Array(rings).fill(false);
    if (variant === 'configuracion') {
      objetivo = estadoDesde(rand, rings);
      // Un objetivo vacío sería la variante clásica disfrazada.
      if (!objetivo.some(Boolean)) continue;
    }
    if (inicial.every((v, i) => v === objetivo[i])) continue;

    const sol = resolverAnillas(inicial, objetivo, regla);
    if (!sol) continue;

    // Ni un reto que se acaba en cuatro toques, ni justo el número que se
    // saca cualquiera que ya conozca el puzzle clásico.
    if (sol.movimientos < rings + 3) continue;
    if (regla === 'clasico' && !objetivo.some(Boolean) && sol.movimientos === minimoClasico) continue;

    return {
      variant,
      rings,
      regla,
      inicial,
      objetivo,
      min_movimientos: sol.movimientos,
      mostrarPistas: rings <= 5,   // en el tablero grande se juega sin ayudas
      dificultad: sol.movimientos < 15 ? 2 : (sol.movimientos < 32 ? 3 : 4),
      solucion: sol,
      intentos: intento + 1
    };
  }

  throw new Error(`No se pudo generar un reto de anillas para seed=${seed}`);
}

// --- Pistas ---------------------------------------------------------------

export function buildAnillasHints(puzzle) {
  const { rings, regla, inicial, objetivo, min_movimientos, solucion } = puzzle;
  const enganchadas = inicial.filter(Boolean).length;
  const sueltas = rings - enganchadas;
  const objetivoLibre = objetivo.some(Boolean);

  const primeros = solucion.pasos.slice(0, 2)
    .map((p) => (p.length > 1 ? `las anillas ${p.map((i) => i + 1).join(' y ')} a la vez` : `la anilla ${p[0] + 1}`));

  const primera = `No arrancas de cero: hay ${enganchadas} anilla${enganchadas === 1 ? '' : 's'} enganchada${enganchadas === 1 ? '' : 's'} y ${sueltas} ya suelta${sueltas === 1 ? '' : 's'}, ` +
    `así que el número de movimientos de siempre no te sirve aquí. Los dos primeros movimientos de la solución más corta son ${primeros.join(', y luego ')}.`;

  const segunda = regla === 'dos-de-golpe'
    ? 'Recuerda que puedes soltar o poner las anillas 1 y 2 en un solo movimiento: aprovecharlo es lo que separa la solución corta de la larga, porque ese par se repite muchísimo.'
    : 'La clave es que solo hay dos anillas tocables en cada momento, y una de ellas es siempre la 1. Cuando dudes, mira cuál es la primera enganchada: la que puedes mover es la de justo después.';

  const tercera = objetivoLibre
    ? `Aquí no hay que soltarlas todas: el objetivo deja ${objetivo.filter(Boolean).length} anilla${objetivo.filter(Boolean).length === 1 ? '' : 's'} puesta${objetivo.filter(Boolean).length === 1 ? '' : 's'}. ` +
      `Se llega en ${min_movimientos} movimientos, y pasarte de largo cuesta tanto como quedarte corto.`
    : `Se puede resolver en ${min_movimientos} movimientos. Si ves que te alejas, deshacer los últimos pasos suele salir más barato que seguir hacia adelante.`;

  return [primera, segunda, tercera];
}
