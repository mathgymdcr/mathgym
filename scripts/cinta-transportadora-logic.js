// ===== scripts/cinta-transportadora-logic.js =====
// La Cinta Sin Fin · problema de Josephus resuelto al revés. El brazo
// robótico recorre la cinta circular volteando una caja y saltándose
// `patron_salto` sin mirarlas, empezando siempre en la posición 1: eso fija
// un ORDEN DE POSICIONES único (qué hueco se voltea 1º, 2º, 3º...), sin
// backtracking ni solver -- es pura simulación de cola circular.
//
// El reto: para que las cajas SALGAN en el orden objetivo, cada hueco debe
// llevar la caja que le toque salir en su turno. Como el orden de posiciones
// es una permutación de 1..n y el objetivo es otra, la colocación es la
// biyección inversa -- siempre existe y es única, para cualquier objetivo.

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

const N_CAJAS_OPCIONES = [6, 8, 10];
const PATRON_SALTO_OPCIONES = [1, 2];
const ORDEN_OPCIONES = ['ascendente', 'descendente', 'intercalado'];

export function ejesDeSeed(seed) {
  return {
    nCajas: eligeEje(N_CAJAS_OPCIONES, seed, 0x3fa1c8e5),
    patronSalto: eligeEje(PATRON_SALTO_OPCIONES, seed, 0x71bd249a),
    ordenTipo: eligeEje(ORDEN_OPCIONES, seed, 0x0c9e5f31)
  };
}

export function varianteDeSeed(seed) {
  const { nCajas, patronSalto, ordenTipo } = ejesDeSeed(seed);
  return `${nCajas}-salto${patronSalto}-${ordenTipo}`;
}

// Orden en el que el brazo voltea las POSICIONES (1..n), empezando en la
// posición 1 y avanzando `m` huecos entre volteo y volteo (m = 1 volteo +
// patron_salto saltados). Simulación de cola circular con splice: n es
// pequeño (6-10), así que el coste cuadrático no importa.
export function ordenEliminacion(n, m) {
  const personas = Array.from({ length: n }, (_, i) => i + 1);
  const orden = [];
  let pos = 0;
  while (personas.length) {
    pos = (pos + m - 1) % personas.length;
    orden.push(personas[pos]);
    personas.splice(pos, 1);
  }
  return orden;
}

// Mismo recorrido que ordenEliminacion, pero leyendo el NÚMERO de caja que
// hay en cada posición en vez de la posición en sí -- esto es lo que
// comparten la plantilla (para comprobar la colocación de quien juega) y el
// validador (para re-comprobar la del generador): una sola fuente de verdad
// para "qué sale y en qué orden".
export function simulaSalida(colocacion, m) {
  const restantes = [...colocacion];
  const salida = [];
  let pos = 0;
  while (restantes.length) {
    pos = (pos + m - 1) % restantes.length;
    salida.push(restantes[pos]);
    restantes.splice(pos, 1);
  }
  return salida;
}

export function ordenObjetivoDe(n, tipo) {
  if (tipo === 'ascendente') return Array.from({ length: n }, (_, i) => i + 1);
  if (tipo === 'descendente') return Array.from({ length: n }, (_, i) => n - i);
  // 'intercalado': alterna desde abajo y desde arriba -- 1, n, 2, n-1, ...
  const salida = [];
  let bajo = 1, alto = n;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) { salida.push(bajo); bajo++; }
    else { salida.push(alto); alto--; }
  }
  return salida;
}

// La única colocación que hace salir las cajas en `ordenObjetivo`: en la
// posición que el brazo voltea i-ésima va la caja que debe salir i-ésima.
export function colocacionSolucion(n, m, ordenObjetivo) {
  const orden = ordenEliminacion(n, m);
  const colocacion = new Array(n);
  for (let i = 0; i < n; i++) {
    colocacion[orden[i] - 1] = ordenObjetivo[i];
  }
  return colocacion;
}

function dificultadDe(nCajas, ordenTipo, patronSalto) {
  const base = { 6: 2, 8: 3, 10: 4 }[nCajas];
  const extra = (ordenTipo === 'intercalado' ? 1 : 0) + (patronSalto === 2 ? 1 : 0);
  return Math.min(5, base + extra);
}

export function buildCintaPuzzle(seed) {
  const { nCajas, patronSalto, ordenTipo } = ejesDeSeed(seed);
  const ordenObjetivo = ordenObjetivoDe(nCajas, ordenTipo);
  const colocacion = colocacionSolucion(nCajas, patronSalto + 1, ordenObjetivo);

  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(nCajas, ordenTipo, patronSalto),
    payload: {
      n_cajas: nCajas,
      patron_salto: patronSalto,
      orden_objetivo: ordenObjetivo,
      solucion_colocacion: colocacion
    }
  };
}
