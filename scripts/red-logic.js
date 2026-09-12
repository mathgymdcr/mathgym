// ===== scripts/red-logic.js =====
// Desenreda la Red. Un grafo (árbol) de nodos y cables, sin rejilla de por
// medio -- el único tipo del catálogo con este mecanismo. El árbol es
// planar por construcción (todo árbol lo es), así que no hace falta ningún
// test de planaridad ni solver de unicidad: cualquier disposición final
// sin cruces vale, no hay "la" solución. Compartido entre el generador, la
// plantilla (que cuenta cruces en vivo mientras el jugador arrastra) y el
// validador.

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

const NODOS_OPCIONES = [8, 10];

export function ejesDeSeed(seed) {
  return { nodos: eligeEje(NODOS_OPCIONES, seed, 0x7f2c4d81) };
}

export function varianteDeSeed(seed) {
  const { nodos } = ejesDeSeed(seed);
  return `${nodos}`;
}

// Arbol aleatorio: cada nodo nuevo (1..n-1) se engancha a un nodo YA
// EXISTENTE elegido al azar (0..i-1) -- construccion incremental clasica
// que da siempre un arbol valido (n-1 aristas, conexo, sin ciclos) sin
// necesidad de comprobarlo aparte.
export function generaArbol(n, rng) {
  const aristas = [];
  for (let i = 1; i < n; i++) {
    const padre = Math.floor(rng() * i);
    aristas.push([padre, i]);
  }
  return aristas;
}

function orientacion(a, b, c) {
  const valor = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (valor > 0) return 1;
  if (valor < 0) return -1;
  return 0;
}

// Cruce PROPIO de dos segmentos (test de orientaciones clasico). Casos
// colineales/de contacto en un extremo se leen como "no cruce" -- con
// coordenadas reales aleatorias son medida cero, y en este puzzle un
// contacto en un extremo compartido nunca debe contar como cruce de todos
// modos (lo filtra cuentaCruces antes de llamar aqui).
export function segmentosSeCruzan(p1, p2, p3, p4) {
  const o1 = orientacion(p1, p2, p3);
  const o2 = orientacion(p1, p2, p4);
  const o3 = orientacion(p3, p4, p1);
  const o4 = orientacion(p3, p4, p2);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

// Cuenta cuantos pares de aristas (sin nodo en comun) se cruzan de verdad,
// dadas las posiciones actuales de los nodos -- esto es lo que la
// plantilla recalcula en vivo mientras el jugador arrastra.
function dificultadDe(nodos) {
  return Math.min(5, nodos === 8 ? 2 : 3);
}

// Posiciones al azar (en porcentaje, 8-92 para dejar margen a los nodos) y
// reintenta hasta que haya al menos un cruce real -- si el primer intento
// ya sale sin cruces (posible pero infrecuente con nodos al azar), no hay
// nada que desenredar.
function posicionesAlAzar(n, rng) {
  return Array.from({ length: n }, () => ({
    x: 8 + rng() * 84,
    y: 8 + rng() * 84
  }));
}

export function buildRedPuzzle(seed) {
  const { nodos } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const MAX_INTENTOS = 200;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    // El arbol se REGENERA en cada intento, no solo las posiciones: una
    // estrella pura (todas las aristas desde el mismo nodo, posible con
    // generaArbol -- visto de verdad en el barrido de 30 seeds) no tiene
    // NINGUN par de aristas sin nodo en comun, asi que ninguna disposicion
    // podria darle jamas un cruce por mucho que se reintente solo la
    // posicion.
    const aristas = generaArbol(nodos, rng);
    const posiciones = posicionesAlAzar(nodos, rng);
    if (cuentaCruces(posiciones, aristas) >= 1) {
      return {
        variant: varianteDeSeed(seed),
        dificultad: dificultadDe(nodos),
        payload: {
          nodos,
          aristas,
          posiciones_iniciales: posiciones
        }
      };
    }
  }

  throw new Error(`buildRedPuzzle: no se encontró una disposición con cruces tras ${MAX_INTENTOS} intentos (seed=${seed})`);
}

export function cuentaCruces(posiciones, aristas) {
  let total = 0;
  for (let i = 0; i < aristas.length; i++) {
    const [a, b] = aristas[i];
    for (let j = i + 1; j < aristas.length; j++) {
      const [c, d] = aristas[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentosSeCruzan(posiciones[a], posiciones[b], posiciones[c], posiciones[d])) total++;
    }
  }
  return total;
}
