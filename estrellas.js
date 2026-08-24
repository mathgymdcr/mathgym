// ===== estrellas.js =====
// Cuántas estrellas merece un reto resuelto. Los umbrales NO se inventan aquí:
// los escribe el generador en cada reto (maxMovesFor3Stars y compañía) y hasta
// ahora no los leía nadie.
//
// El catálogo mide de dos maneras, según el tipo:
//   - "te pasaste del par": movimientos (9 tipos) o pesadas (la balanza)
//   - "fallaste al comprobar": el enigma y el polígono, donde no hay nada que
//     optimizar salvo acertar a la primera
//
// Resolver un reto nunca baja de una estrella: la peor marca posible sigue
// siendo haberlo sacado.

export const MAX_ESTRELLAS = 3;

// Cada medida, con el nombre del campo que trae la marca de la partida y los
// dos umbrales del reto. El orden importa: se usa la primera cuyo reto traiga
// umbral, así que un reto de movimientos no se puntúa nunca por fallos.
const MEDIDAS = [
  {
    marca: 'movimientos',
    unidad: 'movimientos',
    tres: (o) => primeroFinito(o.maxMovesFor3Stars, o.parMoves),
    dos: (o) => primeroFinito(o.maxMovesFor2Stars, sumar(o.parMoves, 2))
  },
  {
    marca: 'pesadas',
    unidad: 'pesadas',
    tres: (o) => primeroFinito(o.maxWeighingsFor3Stars),
    dos: (o) => primeroFinito(o.maxWeighingsFor2Stars, sumar(o.maxWeighingsFor3Stars, 1))
  },
  {
    marca: 'fallos',
    unidad: null,   // "Fallos: 0 / máximo 0" antes de fallar no dice nada
    tres: (o) => primeroFinito(o.maxErrorsFor3Stars),
    dos: (o) => primeroFinito(o.maxErrorsFor2Stars, sumar(o.maxErrorsFor3Stars, 2))
  }
];

function primeroFinito(...valores) {
  for (const v of valores) if (Number.isFinite(v)) return v;
  return null;
}

function sumar(valor, delta) {
  return Number.isFinite(valor) ? valor + delta : null;
}

// La medida de este reto, o null si no declara ninguna.
function medidaDe(objectives) {
  if (!objectives) return null;
  return MEDIDAS.find((m) => Number.isFinite(m.tres(objectives))) || null;
}

/**
 * @param {object|null} objectives  el bloque `objectives` del reto
 * @param {{movimientos?: number, pesadas?: number, fallos?: number}} marca
 *        lo que ha hecho quien juega, tal y como lo reporta la plantilla
 * @returns {1|2|3}
 */
export function estrellasDe(objectives, marca = {}) {
  const medida = medidaDe(objectives);
  if (!medida) return MAX_ESTRELLAS;

  const valor = marca ? marca[medida.marca] : undefined;
  // Sin marca no se castiga: una plantilla que aún no reporta su contador da
  // las tres, igual que antes de que existieran las estrellas.
  if (!Number.isFinite(valor)) return MAX_ESTRELLAS;

  if (valor <= medida.tres(objectives)) return 3;
  const dos = medida.dos(objectives);
  if (Number.isFinite(dos) && valor <= dos) return 2;
  return 1;
}

/**
 * La meta que el marcador enseña durante la partida ("7 / mínimo 6"), o null
 * si este reto no tiene una que enseñar sin destripar nada.
 */
export function parDe(objectives) {
  const medida = medidaDe(objectives);
  if (!medida || !medida.unidad) return null;
  return { valor: medida.tres(objectives), unidad: medida.unidad };
}
