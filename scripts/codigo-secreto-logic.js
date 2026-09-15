// ===== scripts/codigo-secreto-logic.js =====
// Código Secreto · Mastermind. Motor deliberadamente simple: no hay tablero
// que resolver por backtracking, solo una combinación oculta sorteada y una
// función de comparación (aciertos exactos / aciertos de color) que
// comparte el generador, el validador y la plantilla — para que los tres
// midan un intento exactamente igual.
//
// A diferencia del resto del catálogo, aquí NO hay comprobación de solución
// única: cualquier combinación válida es un reto válido, así que el
// validador solo comprueba forma (longitud, colores dentro de la paleta,
// sin repetidos si `permite_repeticion` es falso), no solvencia.

export const PALETA = ['rojo', 'azul', 'verde', 'amarillo', 'morado', 'naranja', 'marron', 'negro'];

// PRNG determinista (mulberry32), sin dependencias externas. Duplicado a
// propósito en cada módulo de lógica del catálogo, como el resto.
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

function ejeBooleano(seed, mascara) {
  return mulberry32((seed ^ mascara) >>> 0)() < 0.5;
}

// Tres ejes, cada uno con su propia máscara (mismo patrón que el resto del
// catálogo, ver nonograma-logic.js): longitud del código, cuántos colores de
// la paleta entran en juego (relativo a la longitud, para que "sin
// repetición" siempre tenga colores de sobra) y si se admite repetir color
// dentro de la propia combinación.
export function ejesDeSeed(seed) {
  const longitud = eligeEje([4, 5, 6], seed, 0x51a2f001);
  const coloresDisponibles = eligeEje([longitud, longitud + 1, longitud + 2], seed, 0x2d6c9ee4);
  const repeticion = ejeBooleano(seed, 0x7799bb33);
  return { longitud, coloresDisponibles, repeticion };
}

export function varianteDeSeed(seed) {
  const { longitud, coloresDisponibles, repeticion } = ejesDeSeed(seed);
  return `${longitud}-${coloresDisponibles}-${repeticion ? 'con-repeticion' : 'sin-repeticion'}`;
}

function dificultadDe(longitud, repeticion) {
  const base = { 4: 2, 5: 3, 6: 4 }[longitud];
  return repeticion ? base : Math.min(5, base + 1);
}

// Heurística, no cota probada por solver -- a diferencia del resto del
// catálogo, Mastermind no tiene un mínimo analítico simple que este motor
// calcule. La referencia es la de Knuth para el Mastermind clásico (4
// posiciones, 6 colores, con repetición): resoluble en 5 intentos con
// estrategia óptima. Se escala esa referencia con la longitud y los colores
// en juego; es a propósito generosa, no un objetivo demostrado óptimo.
function parIntentosDe(longitud, coloresDisponibles, repeticion) {
  return longitud + Math.ceil(coloresDisponibles / 3) + (repeticion ? 1 : 0);
}

function generaSolucion(seed, longitud, coloresDisponibles, repeticion) {
  const rng = mulberry32((seed ^ 0x9f2c1a55) >>> 0);
  const disponibles = Array.from({ length: coloresDisponibles }, (_, i) => i);
  const solucion = [];
  for (let i = 0; i < longitud; i++) {
    const idx = Math.floor(rng() * disponibles.length);
    solucion.push(disponibles[idx]);
    if (!repeticion) disponibles.splice(idx, 1);
  }
  return solucion.map((i) => PALETA[i]);
}

export function buildCodigoSecretoPuzzle(seed) {
  const { longitud, coloresDisponibles, repeticion } = ejesDeSeed(seed);
  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(longitud, repeticion),
    parIntentos: parIntentosDe(longitud, coloresDisponibles, repeticion),
    payload: {
      longitud,
      colores_disponibles: coloresDisponibles,
      permite_repeticion: repeticion,
      solucion: generaSolucion(seed, longitud, coloresDisponibles, repeticion)
    }
  };
}

// Aciertos exactos (color y posición) y aciertos de color (color presente
// en la solución pero en otra posición), sin contar dos veces el mismo pin
// de la solución. Es el algoritmo estándar de Mastermind: descarta primero
// los aciertos exactos y empareja lo que queda por color, marcando cada pin
// de la solución como usado como mucho una vez.
export function comparaCombinacion(intento, solucion) {
  const restoIntento = [];
  const restoSolucion = [];
  let exactos = 0;

  for (let i = 0; i < solucion.length; i++) {
    if (intento[i] === solucion[i]) exactos++;
    else {
      restoIntento.push(intento[i]);
      restoSolucion.push(solucion[i]);
    }
  }

  let colores = 0;
  const usado = new Array(restoSolucion.length).fill(false);
  for (const color of restoIntento) {
    const idx = restoSolucion.findIndex((c, j) => c === color && !usado[j]);
    if (idx !== -1) {
      usado[idx] = true;
      colores++;
    }
  }

  return { exactos, colores };
}
