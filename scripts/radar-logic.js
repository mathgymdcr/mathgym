// ===== scripts/radar-logic.js =====
// Radar de Asteroides · Buscaminas por pistas. Rejilla NxN con asteroides
// escondidos; cada celda revelada muestra cuántos de sus hasta 8 vecinas
// tienen asteroide (0 incluido -- una pista en 0 es justo lo que el informe
// original llamaba "celda escaneada y vacía", así que no hace falta un
// campo aparte para eso). Compartido entre el generador y el validador,
// mismo patrón mulberry32 + eligeEje que el resto del catálogo.

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

const TAMANO_OPCIONES = [5, 6, 7];

export function ejesDeSeed(seed) {
  return {
    tamano: eligeEje(TAMANO_OPCIONES, seed, 0x6c2e91af)
  };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

const DENSIDAD = 0.18;

// Coloca asteroides al azar con densidad ~18%, con un minimo de 3 para que
// el reto no sea trivial y un maximo que deje huecos de verdad (nunca todo
// el tablero).
export function colocaAsteroides(n, rng) {
  const objetivo = Math.max(3, Math.min(n * n - 1, Math.round(n * n * DENSIDAD)));
  const minas = Array.from({ length: n }, () => Array(n).fill(false));
  let colocadas = 0;
  while (colocadas < objetivo) {
    const f = Math.floor(rng() * n);
    const c = Math.floor(rng() * n);
    if (!minas[f][c]) {
      minas[f][c] = true;
      colocadas++;
    }
  }
  return minas;
}

// Cuenta minas entre las hasta 8 celdas adyacentes a (f,c) -- (f,c) puede
// ser ella misma una mina o no, cuentaVecinos no lo comprueba ni le importa.
function vecinosDe(n, f, c) {
  const res = [];
  for (let df = -1; df <= 1; df++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (df === 0 && dc === 0) continue;
      const nf = f + df;
      const nc = c + dc;
      if (nf >= 0 && nf < n && nc >= 0 && nc < n) res.push([nf, nc]);
    }
  }
  return res;
}

// C(total, elegidos) acotado: en cuanto el resultado parcial supera
// `limite` deja de multiplicar y devuelve algo por encima de `limite` (no
// hace falta el valor exacto para saber que ya sobra) -- evita calcular un
// binomial real cuando puede tener decenas de celdas de por medio.
function combinacionesConTope(total, elegidos, limite) {
  if (elegidos < 0 || elegidos > total) return 0;
  const k = Math.min(elegidos, total - elegidos);
  let resultado = 1;
  for (let i = 1; i <= k; i++) {
    resultado = (resultado * (total - k + i)) / i;
    if (resultado > limite) return limite + 1;
  }
  return Math.round(resultado);
}

// Cuenta reparticiones de asteroides validas hasta `tope`: cada pista
// revelada es una celda SIN asteroide cuyo numero dice cuantas de sus
// vecinas si lo tienen, y el total de asteroides del tablero es
// `asteroidesTotales`.
//
// Backtracking SOLO sobre las celdas libres que toca alguna pista (en ese
// orden -- una pista se comprueba en cuanto su ultima vecina sin revelar
// queda decidida, mismo patron que fabrica-de-bloques con sus regiones);
// las celdas libres que ninguna pista mira nunca estrechan nada, así que
// en cuanto se agotan las primeras se cuenta cuántas formas quedan de
// repartir las minas que faltan entre las segundas con un combinatorio
// directo en vez de seguir backtrackeando bit a bit -- sin esto, un
// tablero con una zona grande sin pistas (frecuente al podar de más)
// tardaba hasta 28s en vez de milisegundos.
export function contarSoluciones(n, pistas, asteroidesTotales, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;

  const esPista = Array.from({ length: n }, () => Array(n).fill(false));
  for (const p of pistas) esPista[p.f][p.c] = true;

  const tocadaPorPista = Array.from({ length: n }, () => Array(n).fill(false));
  const comprobacionesPorCelda = []; // { celdas: [f,c][], valor } antes de resolver indices
  for (const p of pistas) {
    const vecinasLibres = vecinosDe(n, p.f, p.c).filter(([vf, vc]) => !esPista[vf][vc]);
    if (vecinasLibres.length === 0) {
      if (p.valor !== 0) return { soluciones: 0, primera: null };
      continue;
    }
    for (const [vf, vc] of vecinasLibres) tocadaPorPista[vf][vc] = true;
    comprobacionesPorCelda.push({ celdas: vecinasLibres, valor: p.valor });
  }

  // Orden: primero las celdas que alguna pista mira, luego el resto -- así
  // el atajo combinatorio puede activarse en cuanto se acaban las primeras.
  const celdasLibres = [];
  const posDe = Array.from({ length: n }, () => Array(n).fill(-1));
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!esPista[f][c] && tocadaPorPista[f][c]) {
        posDe[f][c] = celdasLibres.length;
        celdasLibres.push([f, c]);
      }
    }
  }
  const numTocadas = celdasLibres.length;
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!esPista[f][c] && !tocadaPorPista[f][c]) {
        posDe[f][c] = celdasLibres.length;
        celdasLibres.push([f, c]);
      }
    }
  }

  const porUltimoIndice = new Map();
  for (const chk of comprobacionesPorCelda) {
    const idxs = chk.celdas.map(([f, c]) => posDe[f][c]);
    const ultimo = Math.max(...idxs);
    if (!porUltimoIndice.has(ultimo)) porUltimoIndice.set(ultimo, []);
    porUltimoIndice.get(ultimo).push({ idxs, valor: chk.valor });
  }

  const asignado = new Array(numTocadas).fill(false);
  let minasPuestas = 0;
  let soluciones = 0;
  let primera = null;

  function construyePrimera(minasEnColaLibre) {
    primera = Array.from({ length: n }, () => Array(n).fill(false));
    celdasLibres.forEach(([f, c], i) => {
      if (i < numTocadas) primera[f][c] = asignado[i];
    });
    // De las celdas sin pista, las primeras `minasEnColaLibre` llevan mina
    // -- una elección arbitraria entre las que dan igual, solo para tener
    // UN ejemplo concreto de solución.
    for (let i = 0; i < minasEnColaLibre; i++) {
      const [f, c] = celdasLibres[numTocadas + i];
      primera[f][c] = true;
    }
  }

  // true si hay que parar (se alcanzo el tope).
  function rec(k) {
    if (k === numTocadas) {
      const libresSinPista = celdasLibres.length - numTocadas;
      const minasQueFaltan = asteroidesTotales - minasPuestas;
      const presupuesto = tope - soluciones;
      const formas = combinacionesConTope(libresSinPista, minasQueFaltan, presupuesto);
      if (formas <= 0) return false;
      const nuevas = Math.min(formas, presupuesto);
      if (!primera && nuevas > 0) construyePrimera(Math.max(minasQueFaltan, 0));
      soluciones += nuevas;
      return soluciones >= tope;
    }
    if (minasPuestas > asteroidesTotales) return false;
    if (minasPuestas + (celdasLibres.length - k) < asteroidesTotales) return false;

    for (const valor of [false, true]) {
      asignado[k] = valor;
      if (valor) minasPuestas++;

      let ok = true;
      const pendientes = porUltimoIndice.get(k);
      if (pendientes) {
        for (const chk of pendientes) {
          const cuenta = chk.idxs.reduce((total, i) => total + (asignado[i] ? 1 : 0), 0);
          if (cuenta !== chk.valor) { ok = false; break; }
        }
      }

      if (ok && rec(k + 1)) {
        if (valor) minasPuestas--;
        return true;
      }
      if (valor) minasPuestas--;
    }
    return false;
  }

  rec(0);
  return { soluciones, primera };
}

function baraja(array, rng) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function dificultadDe(tamano) {
  return Math.min(5, { 5: 2, 6: 3, 7: 4 }[tamano]);
}

// Empieza revelando TODAS las celdas sin asteroide (la solvencia sale
// gratis: cada pista es el conteo real sobre la solución) y quita pistas
// una a una, en orden al azar, mientras el resto siga determinando una
// única solución -- mismo patrón de recorte que riego-plantas (ahí guiado
// por cuántas alternativas mata cada recorte; aquí, con tableros de hasta
// 7x7, basta con volver a contar soluciones en cada intento). Varias
// pasadas hasta que una pasada entera no quita nada más.
export function buildRadarPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const minas = colocaAsteroides(tamano, rng);
  let asteroidesTotales = 0;
  for (const fila of minas) for (const v of fila) if (v) asteroidesTotales++;

  let pistas = [];
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (!minas[f][c]) pistas.push({ f, c, valor: cuentaVecinos(minas, f, c) });
    }
  }

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const candidata of baraja(pistas, rng)) {
      const restantes = pistas.filter((p) => p !== candidata);
      const { soluciones } = contarSoluciones(tamano, restantes, asteroidesTotales, { tope: 2 });
      if (soluciones === 1) {
        pistas = restantes;
        cambio = true;
      }
    }
  }

  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(tamano),
    payload: {
      tablero: { ancho: tamano, alto: tamano },
      pistas,
      asteroides_totales: asteroidesTotales,
      solucion: minas
    }
  };
}

export function cuentaVecinos(minas, f, c) {
  const n = minas.length;
  let total = 0;
  for (let df = -1; df <= 1; df++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (df === 0 && dc === 0) continue;
      const nf = f + df;
      const nc = c + dc;
      if (nf >= 0 && nf < n && nc >= 0 && nc < n && minas[nf][nc]) total++;
    }
  }
  return total;
}
