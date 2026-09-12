// ===== scripts/cubo-logic.js =====
// El Cubo Transportista. Un cubo con 6 caras distintas (1-6) rueda sobre
// una rejilla NxN: cada movimiento lo vuelca sobre la arista correspondiente
// y cambia su orientación de forma predecible. El reto es llegar a la
// celda meta mostrando una cara concreta hacia arriba en el mínimo de
// movimientos -- BFS sobre el espacio de estados (posición + orientación),
// mismo patrón que ya usan anillas-encadenadas y cajas-apiladas en este
// catálogo. Compartido entre el generador, la plantilla y el validador.

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
  return { tamano: eligeEje(TAMANO_OPCIONES, seed, 0x1d6ef839) };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

// Orientacion de referencia: que cara (1-6) mira hacia cada lado. No hace
// falta que sea un dado "de verdad" (caras opuestas sumando 7) -- son 6
// colores cualquiera, y lo unico que importa es que las reglas de rodar se
// apliquen siempre igual en generador, plantilla y validador.
export const ORIENTACION_INICIAL = { U: 1, D: 6, N: 2, S: 5, E: 3, O: 4 };

// Cada rueda pivota sobre una arista y cicla 4 de las 6 caras; las otras
// dos (el eje de giro) no cambian. Las cuatro reglas son la misma rotacion
// vista desde cada uno de los 4 lados.
export function rollCube(o, direccion) {
  switch (direccion) {
    case 'N': return { U: o.S, S: o.D, D: o.N, N: o.U, E: o.E, O: o.O };
    case 'S': return { U: o.N, N: o.D, D: o.S, S: o.U, E: o.E, O: o.O };
    case 'E': return { U: o.O, O: o.D, D: o.E, E: o.U, N: o.N, S: o.S };
    case 'O': return { U: o.E, E: o.D, D: o.O, O: o.U, N: o.N, S: o.S };
    default: throw new Error(`Dirección desconocida: ${direccion}`);
  }
}

const DIR_VECTOR = { N: [-1, 0], S: [1, 0], E: [0, 1], O: [0, -1] };
const DIRECCIONES = ['N', 'S', 'E', 'O'];

// Clave de estado para el BFS: posicion + orientacion. Basta con U y N
// (arriba y norte) para identificar una de las 24 orientaciones -- el
// resto de caras quedan fijadas por la geometria del cubo, que rollCube ya
// respeta de forma consistente.
function claveEstado(f, c, o) {
  return `${f},${c},${o.U},${o.N}`;
}

// BFS por numero de movimientos desde `inicio` sobre un tablero NxN sin
// obstaculos. Devuelve TODOS los estados alcanzables (posicion +
// orientacion + distancia minima) -- mismo patron de solveCajas/
// resolverAnillas, aplicado al espacio (posicion, orientacion) en vez de
// (zonas) o (anillas enganchadas).
export function bfsDesde(n, inicio) {
  const inicial = { f: inicio.f, c: inicio.c, orientacion: inicio.orientacion, distancia: 0 };
  const vistos = new Map([[claveEstado(inicial.f, inicial.c, inicial.orientacion), inicial]]);
  const cola = [inicial];

  while (cola.length) {
    const actual = cola.shift();
    for (const dir of DIRECCIONES) {
      const [df, dc] = DIR_VECTOR[dir];
      const f = actual.f + df;
      const c = actual.c + dc;
      if (f < 0 || f >= n || c < 0 || c >= n) continue;

      const orientacion = rollCube(actual.orientacion, dir);
      const clave = claveEstado(f, c, orientacion);
      if (vistos.has(clave)) continue;

      const nuevo = { f, c, orientacion, distancia: actual.distancia + 1 };
      vistos.set(clave, nuevo);
      cola.push(nuevo);
    }
  }

  return [...vistos.values()];
}

function dificultadDe(tamano) {
  return Math.min(5, tamano === 5 ? 2 : 3);
}

// BFS desde una posicion inicial fija (orientacion siempre la de
// referencia: solo importa relativa al tablero, no hay "orientacion de
// partida" que sortear aparte) y se elige la meta AL AZAR entre los
// estados alcanzables -- la solvencia sale gratis (el BFS ya demuestra que
// se llega) y el "par" es literalmente la distancia BFS minima para esa
// combinacion (posicion, cara arriba), agrupando las orientaciones que
// comparten cara -- puede haber mas de una orientacion con la misma cara
// arriba en la misma celda, y el par es la mas corta de todas ellas.
export function buildCuboPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const inicio = {
    f: Math.floor(rng() * tamano),
    c: Math.floor(rng() * tamano),
    orientacion: ORIENTACION_INICIAL
  };

  const estados = bfsDesde(tamano, inicio);
  // El minimo real por (celda, cara-arriba) hay que calcularlo sobre TODOS
  // los estados, sin descartar los de distancia < 2 antes de tiempo -- si
  // se descartan ahi, un camino mas corto por una orientacion distinta a
  // la misma (celda, cara) queda invisible y el "minimo" declarado sale
  // mayor del real (bug real, visto en el barrido de 1000 seeds: seed 67
  // declaraba minimo 5 cuando el BFS de verdad daba 1).
  const mejorPorObjetivo = new Map(); // "f,c,U" -> distancia minima
  for (const e of estados) {
    const clave = `${e.f},${e.c},${e.orientacion.U}`;
    const actual = mejorPorObjetivo.get(clave);
    if (actual == null || e.distancia < actual) mejorPorObjetivo.set(clave, e.distancia);
  }

  const candidatos = [...mejorPorObjetivo.entries()].filter(([clave, distancia]) => {
    const [f, c] = clave.split(',').map(Number);
    return distancia >= 2 && !(f === inicio.f && c === inicio.c);
  });
  const [claveElegida, minimo] = candidatos[Math.floor(rng() * candidatos.length)];
  const [f, c, cara] = claveElegida.split(',').map(Number);

  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(tamano),
    payload: {
      tablero: { ancho: tamano, alto: tamano },
      inicio: { f: inicio.f, c: inicio.c, orientacion: inicio.orientacion },
      meta: { f, c, cara },
      minimo
    }
  };
}
