// ===== scripts/dron-logic.js =====
// Ruta del Dron · cadena de instrucciones sobre una rejilla. Cada baldosa
// (salvo la meta) lleva una instrucción "N distancia" que apunta a la
// siguiente baldosa de su cadena; el jugador tiene que encontrar la ÚNICA
// baldosa de inicio cuya cadena llega a la meta -- las demás se salen del
// tablero o entran en un bucle sin llegar nunca. Compartido entre el
// generador y el validador, mismo patrón mulberry32 + eligeEje que el
// resto del catálogo.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

const TAMANO_OPCIONES = [5, 6];

export function ejesDeSeed(seed) {
  return {
    tamano: eligeEje(TAMANO_OPCIONES, seed, 0x4b7ce913)
  };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

const DIR_VECTOR = { N: [-1, 0], S: [1, 0], E: [0, 1], O: [0, -1] };

// Sigue la cadena de instrucciones desde `inicio` hasta llegar a `meta`
// (resultado 'meta'), salirse del tablero (resultado 'fuera') o repetir una
// celda ya visitada en esta misma simulación (resultado 'bucle' -- una
// cadena finita que no sale del tablero y no llega a la meta tiene que
// repetir celda tarde o temprano, así que basta con vigilar eso, sin tope
// de pasos aparte).
export function simulaCadena(n, instrucciones, meta, inicio) {
  const pasos = [[inicio.f, inicio.c]];
  const visitadas = new Set([`${inicio.f},${inicio.c}`]);
  let f = inicio.f;
  let c = inicio.c;

  while (true) {
    if (f === meta.f && c === meta.c) return { resultado: 'meta', pasos };

    const instr = instrucciones[f][c];
    const [df, dc] = DIR_VECTOR[instr.direccion];
    f += df * instr.distancia;
    c += dc * instr.distancia;

    if (f < 0 || f >= n || c < 0 || c >= n) return { resultado: 'fuera', pasos };

    const clave = `${f},${c}`;
    if (visitadas.has(clave)) return { resultado: 'bucle', pasos };
    visitadas.add(clave);
    pasos.push([f, c]);
  }
}

// Simula desde CADA celda que no sea la meta y se queda con la de cadena
// mas larga que llega a la meta -- cualquier celda intermedia de esa misma
// cadena también llega (con una cadena mas corta), así que "llega o no"
// nunca puede ser la pregunta: la pregunta es cual es el INICIO real, y
// eso es quien tiene la cadena mas larga. Si dos celdas EMPATAN en la
// cadena mas larga, el reto es ambiguo -- `ganadores` tendria mas de una.
export function evaluaTablero(n, instrucciones, meta) {
  let mejorLongitud = -1;
  let ganadores = [];

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (f === meta.f && c === meta.c) continue;
      const { resultado, pasos } = simulaCadena(n, instrucciones, meta, { f, c });
      if (resultado !== 'meta') continue;
      const longitud = pasos.length - 1; // saltos, no celdas visitadas
      if (longitud > mejorLongitud) {
        mejorLongitud = longitud;
        ganadores = [{ f, c }];
      } else if (longitud === mejorLongitud) {
        ganadores.push({ f, c });
      }
    }
  }

  return { mejorLongitud, ganadores };
}

const DIRECCIONES = ['N', 'S', 'E', 'O'];
const DISTANCIA_MAX = 3;

function dificultadDe(tamano) {
  return Math.min(5, tamano === 5 ? 2 : 3);
}

// Instrucciones al azar en TODO el tablero (salvo la meta) y se comprueba
// si asi, sin mas, sale un unico ganador -- no hace falta construir la
// cadena a mano: con instrucciones al azar basta reintentar hasta que
// evaluaTablero() confirme un unico maximo, igual de "generar y volver a
// comprobar" que el resto del catalogo.
export function buildDronPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const MAX_INTENTOS = 500;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const meta = { f: Math.floor(rng() * tamano), c: Math.floor(rng() * tamano) };
    const instrucciones = Array.from({ length: tamano }, (_, f) =>
      Array.from({ length: tamano }, (_, c) => {
        if (f === meta.f && c === meta.c) return null;
        return {
          direccion: DIRECCIONES[Math.floor(rng() * DIRECCIONES.length)],
          distancia: 1 + Math.floor(rng() * DISTANCIA_MAX)
        };
      })
    );

    const { ganadores, mejorLongitud } = evaluaTablero(tamano, instrucciones, meta);
    // Un unico ganador Y una cadena de mas de un salto: con un solo salto
    // el reto se resuelve mirando quien apunta directo a la meta, sin
    // deduccion real.
    if (ganadores.length === 1 && mejorLongitud >= 2) {
      return {
        variant: varianteDeSeed(seed),
        dificultad: dificultadDe(tamano),
        payload: {
          tablero: { ancho: tamano, alto: tamano },
          meta,
          instrucciones,
          solucion: ganadores[0]
        }
      };
    }
  }

  throw new Error(
    `buildDronPuzzle: no se encontro un tablero con inicio unico tras ${MAX_INTENTOS} intentos (seed=${seed}, tamano=${tamano})`
  );
}
