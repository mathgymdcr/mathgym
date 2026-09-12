// ===== scripts/trazo-logic.js =====
// El Trazo Perimetral · Slitherlink. Rejilla de celdas donde algunas llevan
// una pista (0-3): cuántos de sus hasta 4 lados forman parte del trazo. El
// trazo tiene que ser un único circuito cerrado simple.
//
// LA CLAVE que evita el problema clásico de Slitherlink (backtracking sobre
// ARISTAS comprobando "es un solo bucle" como restricción global, lenta en
// rejillas grandes -- justo lo que señalaba el informe original): en vez de
// eso, se reformula como 2-COLOREADO DE CELDAS (dentro/fuera del trazo, A/B,
// técnica estándar de solvers de Slitherlink de verdad):
//   - Una arista forma parte del trazo exactamente cuando separa dos celdas
//     de distinto color (el borde del tablero cuenta siempre como "fuera").
//   - La pista de una celda = cuántos de sus vecinos (o el borde) tienen el
//     OTRO color.
//   - Si "dentro" es una única región conexa SIN AGUJEROS, su frontera es
//     automáticamente UN SOLO circuito cerrado simple -- la restricción
//     global sale gratis de la CONSTRUCCIÓN, no hay que comprobarla en cada
//     intento del generador.
// La UNICIDAD sí hace falta comprobarla aparte (varias coloraciones pueden
// cumplir las mismas pistas reveladas): solver por backtracking sobre color
// de celda, con las pistas comprobándose en cuanto la última celda relevante
// de cada una queda decidida (mismo patrón de poda diferida que
// fabrica-de-bloques/planos-del-invernadero/radar-asteroides).

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
  return { tamano: eligeEje(TAMANO_OPCIONES, seed, 0x9a4e7c21) };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

function vecinos4(n, f, c) {
  const res = [];
  if (f > 0) res.push([f - 1, c]);
  if (f < n - 1) res.push([f + 1, c]);
  if (c > 0) res.push([f, c - 1]);
  if (c < n - 1) res.push([f, c + 1]);
  return res;
}

// Pista de una celda: cuantos de sus hasta 4 lados dan a una celda del
// OTRO color -- el borde del tablero cuenta siempre como B ("fuera").
export function pistaDeCelda(n, enA, f, c) {
  let total = 0;
  const propio = enA[f][c];
  const direcciones = [[f - 1, c], [f + 1, c], [f, c - 1], [f, c + 1]];
  for (const [vf, vc] of direcciones) {
    const fuera = vf < 0 || vf >= n || vc < 0 || vc >= n;
    const otro = fuera ? false : enA[vf][vc];
    if (otro !== propio) total++;
  }
  return total;
}

// Crece la region "dentro" (A) por flood-fill aleatorio desde una celda
// semilla, hasta un tamano objetivo entre 35%-65% del tablero (en los
// extremos las pistas salen casi todas 0 o casi todas iguales -- poco
// interesante). Termina rellenando cualquier agujero de B que quede
// encerrado por A (una celda B que no llega al borde del tablero pasando
// solo por B) para garantizar la propiedad que hace que la frontera de A
// sea un único circuito simple: rellenar un agujero nunca desconecta A,
// porque un agujero está por definición rodeado de A.
export function generaRegionA(n, rng) {
  const total = n * n;
  const objetivo = Math.floor(total * (0.35 + rng() * 0.3));
  const enA = Array.from({ length: n }, () => Array(n).fill(false));

  const f0 = Math.floor(rng() * n);
  const c0 = Math.floor(rng() * n);
  enA[f0][c0] = true;
  let tam = 1;
  const frontera = new Set(vecinos4(n, f0, c0).map(([f, c]) => `${f},${c}`));

  while (tam < objetivo && frontera.size > 0) {
    const candidatos = [...frontera];
    const clave = candidatos[Math.floor(rng() * candidatos.length)];
    frontera.delete(clave);
    const [f, c] = clave.split(',').map(Number);
    if (enA[f][c]) continue;
    enA[f][c] = true;
    tam++;
    for (const [vf, vc] of vecinos4(n, f, c)) {
      if (!enA[vf][vc]) frontera.add(`${vf},${vc}`);
    }
  }

  let cambio = true;
  while (cambio) {
    cambio = false;
    const alcanzaBorde = Array.from({ length: n }, () => Array(n).fill(false));
    const cola = [];
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        const tocaBorde = f === 0 || f === n - 1 || c === 0 || c === n - 1;
        if (tocaBorde && !enA[f][c] && !alcanzaBorde[f][c]) {
          alcanzaBorde[f][c] = true;
          cola.push([f, c]);
        }
      }
    }
    while (cola.length) {
      const [f, c] = cola.pop();
      for (const [vf, vc] of vecinos4(n, f, c)) {
        if (!enA[vf][vc] && !alcanzaBorde[vf][vc]) {
          alcanzaBorde[vf][vc] = true;
          cola.push([vf, vc]);
        }
      }
    }
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (!enA[f][c] && !alcanzaBorde[f][c]) {
          enA[f][c] = true;
          cambio = true;
        }
      }
    }
  }

  return enA;
}

// Comprueba que el color A resultante es una unica region conexa sin
// agujeros -- la propiedad que garantiza "un solo circuito simple". No
// basta con que las pistas cuadren: una asignacion de colores cualquiera
// que las cumpla podria estar partida en varios trozos.
function esColoreadoValido(n, color) {
  let inicio = null;
  let totalA = 0;
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (color[f][c]) { totalA++; if (!inicio) inicio = [f, c]; }
    }
  }
  if (totalA === 0) return false; // sin celdas dentro no hay trazo que cerrar

  const vistos = Array.from({ length: n }, () => Array(n).fill(false));
  vistos[inicio[0]][inicio[1]] = true;
  const cola = [inicio];
  let contados = 1;
  while (cola.length) {
    const [f, c] = cola.pop();
    for (const [vf, vc] of vecinos4(n, f, c)) {
      if (color[vf][vc] && !vistos[vf][vc]) { vistos[vf][vc] = true; contados++; cola.push([vf, vc]); }
    }
  }
  if (contados !== totalA) return false; // A no es conexa

  const vistoB = Array.from({ length: n }, () => Array(n).fill(false));
  const colaB = [];
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const tocaBorde = f === 0 || f === n - 1 || c === 0 || c === n - 1;
      if (tocaBorde && !color[f][c] && !vistoB[f][c]) { vistoB[f][c] = true; colaB.push([f, c]); }
    }
  }
  while (colaB.length) {
    const [f, c] = colaB.pop();
    for (const [vf, vc] of vecinos4(n, f, c)) {
      if (!color[vf][vc] && !vistoB[vf][vc]) { vistoB[vf][vc] = true; colaB.push([vf, vc]); }
    }
  }
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) if (!color[f][c] && !vistoB[f][c]) return false; // agujero
  }
  return true;
}

// Cuenta coloraciones validas (color de celda + pistas reveladas
// cumplidas + un unico circuito simple) hasta `tope`. Backtracking celda
// a celda en orden de lectura -- cada pista se comprueba en cuanto su
// ULTIMA celda relevante (ella + hasta 4 vecinas) queda decidida, mismo
// patron de poda diferida que fabrica-de-bloques/planos-del-invernadero.
//
// `maxNodos` acota el trabajo: si se agota antes de terminar, `agotado`
// sale true y `soluciones`/`primera` no son de fiar -- quien llama debe
// tratarlo como "no se pudo confirmar nada", nunca como "hay 0 o 1".
export function contarSoluciones(n, pistasReveladas, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;
  const maxNodos = opts.maxNodos != null ? opts.maxNodos : Infinity;
  let nodos = 0;
  let agotado = false;

  const comprobaciones = [];
  for (const [clave, valor] of pistasReveladas) {
    const [f, c] = clave.split(',').map(Number);
    const celdas = [[f, c], ...vecinos4(n, f, c)];
    const indices = celdas.map(([ff, cc]) => ff * n + cc);
    comprobaciones.push({ f, c, valor, ultimo: Math.max(...indices) });
  }
  const porUltimoIndice = new Map();
  for (const chk of comprobaciones) {
    if (!porUltimoIndice.has(chk.ultimo)) porUltimoIndice.set(chk.ultimo, []);
    porUltimoIndice.get(chk.ultimo).push(chk);
  }

  const color = Array.from({ length: n }, () => Array(n).fill(false));
  let soluciones = 0;
  let primera = null;

  function rec(k) {
    if (agotado) return true;
    if (++nodos > maxNodos) { agotado = true; return true; }

    if (k === n * n) {
      if (!esColoreadoValido(n, color)) return false;
      soluciones++;
      if (!primera) primera = color.map((fila) => [...fila]);
      return soluciones >= tope;
    }

    const f = Math.floor(k / n);
    const c = k % n;

    for (const valor of [false, true]) {
      color[f][c] = valor;

      let ok = true;
      const pendientes = porUltimoIndice.get(k);
      if (pendientes) {
        for (const chk of pendientes) {
          if (pistaDeCelda(n, color, chk.f, chk.c) !== chk.valor) { ok = false; break; }
        }
      }

      if (ok && rec(k + 1)) return true;
    }
    return false;
  }

  rec(0);
  return { soluciones, primera, agotado };
}

function dificultadDe(tamano) {
  return Math.min(5, { 5: 2, 6: 3, 7: 4 }[tamano]);
}

// Empieza revelando TODAS las pistas (la solvencia sale gratis: cada una
// es el conteo real sobre la solución) y quita pistas al azar mientras el
// solver siga confirmando unicidad -- mismo patrón de recorte que
// radar-asteroides. Cada intento de quitar lleva su propio tope de nodos:
// la comprobación de conexión/agujeros solo se hace al final de cada
// intento del solver, así que con pocas pistas reveladas el backtracking
// puede explorar muchísimas coloraciones localmente válidas pero
// desconectadas antes de descartarlas (medido de verdad con un
// prototipo: una sola llamada pasaba de <200ms a varios segundos al
// bajar de cierta densidad de pistas). Si el presupuesto se agota sin
// confirmar unicidad, esa pista NO se quita -- más conservador, nunca
// menos riguroso -- y se sigue probando con el resto del orden en vez de
// parar de golpe.
const MAX_NODOS_PODA = 40000;

export function buildTrazoPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);
  const solucion = generaRegionA(tamano, rng);

  const reveladas = new Map();
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) reveladas.set(`${f},${c}`, pistaDeCelda(tamano, solucion, f, c));
  }

  const orden = [...reveladas.keys()];
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  for (const clave of orden) {
    const valor = reveladas.get(clave);
    reveladas.delete(clave);
    const { soluciones, agotado } = contarSoluciones(tamano, [...reveladas], { tope: 2, maxNodos: MAX_NODOS_PODA });
    if (soluciones !== 1 || agotado) reveladas.set(clave, valor);
  }

  const pistas = [...reveladas].map(([clave, valor]) => {
    const [f, c] = clave.split(',').map(Number);
    return { f, c, valor };
  });

  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(tamano),
    payload: {
      tablero: { ancho: tamano, alto: tamano },
      pistas,
      solucion
    }
  };
}
