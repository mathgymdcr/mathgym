// ===== scripts/fabrica-logic.js =====
// Fábrica de Bloques · KenKen/Calcudoku. Cuadrado latino NxN dividido en
// regiones irregulares; cada región debe cerrar una operación (suma, resta,
// multiplicación o división) sobre sus celdas. Compartido entre el
// generador y el validador, igual que el resto del catálogo: mismo patrón
// mulberry32 + eligeEje (máscara propia por eje) que usan todos los demás
// módulos de lógica.

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

const TAMANO_OPCIONES = [4, 5, 6];
const OPERACIONES_COMPLETAS_OPCIONES = [false, true];

export function ejesDeSeed(seed) {
  return {
    tamano: eligeEje(TAMANO_OPCIONES, seed, 0x5a17c3e2),
    operacionesCompletas: eligeEje(OPERACIONES_COMPLETAS_OPCIONES, seed, 0x2d84f97b)
  };
}

export function varianteDeSeed(seed) {
  const { tamano, operacionesCompletas } = ejesDeSeed(seed);
  return `${tamano}-${operacionesCompletas ? 'todas' : 'basicas'}`;
}

function baraja(array, rng) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Cuadrado latino aleatorio: parte de la tabla ciclica (fila i = valores
// desplazados i posiciones) y le aplica una permutacion aleatoria de filas,
// de columnas y de valores -- las tres preservan la propiedad de cuadrado
// latino, y la composicion da variedad real sin backtracking.
export function generaCuadradoLatino(n, rng) {
  const base = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ((i + j) % n) + 1)
  );

  const permFilas = baraja(Array.from({ length: n }, (_, i) => i), rng);
  const permCols = baraja(Array.from({ length: n }, (_, i) => i), rng);
  const permValores = baraja(Array.from({ length: n }, (_, i) => i + 1), rng);

  return permFilas.map((filaOrigen) =>
    permCols.map((colOrigen) => permValores[base[filaOrigen][colOrigen] - 1])
  );
}

function vecinos(n, [f, c]) {
  const res = [];
  if (f > 0) res.push([f - 1, c]);
  if (f < n - 1) res.push([f + 1, c]);
  if (c > 0) res.push([f, c - 1]);
  if (c < n - 1) res.push([f, c + 1]);
  return res;
}

// Reparte el tablero en regiones conexas de tamano 1..tamanoMax por
// crecimiento aleatorio (random walk sobre celdas libres, no backtracking):
// cada region arranca en la primera celda libre en orden de lectura y crece
// anexando un vecino libre al azar hasta llegar a un tamano objetivo
// sorteado o quedarse sin vecinos libres.
export function construyeRegiones(n, rng, tamanoMax = 4) {
  const libre = Array.from({ length: n }, () => Array(n).fill(true));
  const regiones = [];
  let idSiguiente = 1;

  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!libre[f][c]) continue;

      const celdas = [[f, c]];
      libre[f][c] = false;
      const objetivo = 1 + Math.floor(rng() * tamanoMax);

      while (celdas.length < objetivo) {
        const candidatos = [];
        for (const celda of celdas) {
          for (const [vf, vc] of vecinos(n, celda)) {
            if (libre[vf][vc]) candidatos.push([vf, vc]);
          }
        }
        if (candidatos.length === 0) break;
        const [nf, nc] = candidatos[Math.floor(rng() * candidatos.length)];
        libre[nf][nc] = false;
        celdas.push([nf, nc]);
      }

      regiones.push({ id: idSiguiente++, celdas });
    }
  }

  return regiones;
}

// Operacion+objetivo de una region a partir de los valores REALES de sus
// celdas en la solucion -- la solvencia sale gratis por construccion, igual
// que en cinta-transportadora. Resta y division solo existen para pares
// (no hay una unica forma de restar o dividir 3+ numeros) y division exige
// division exacta, o el reto pediria un cociente no entero.
export function calculaOperacion(valores, operacionesCompletas, rng) {
  if (valores.length === 1) {
    return { operacion: null, objetivo: valores[0] };
  }

  const suma = valores.reduce((a, b) => a + b, 0);
  const producto = valores.reduce((a, b) => a * b, 1);

  const disponibles = [
    { operacion: 'suma', objetivo: suma }
  ];
  if (operacionesCompletas) {
    disponibles.push({ operacion: 'multiplicacion', objetivo: producto });
  }

  if (valores.length === 2) {
    const [a, b] = valores;
    const resta = Math.abs(a - b);
    disponibles.push({ operacion: 'resta', objetivo: resta });
    if (operacionesCompletas) {
      const mayor = Math.max(a, b);
      const menor = Math.min(a, b);
      if (menor > 0 && mayor % menor === 0) {
        disponibles.push({ operacion: 'division', objetivo: mayor / menor });
      }
    }
  }

  return disponibles[Math.floor(rng() * disponibles.length)];
}

function cumpleOperacion(operacion, objetivo, valores) {
  if (operacion === null) return valores[0] === objetivo;
  if (operacion === 'suma') return valores.reduce((a, b) => a + b, 0) === objetivo;
  if (operacion === 'multiplicacion') return valores.reduce((a, b) => a * b, 1) === objetivo;
  if (operacion === 'resta') return Math.abs(valores[0] - valores[1]) === objetivo;
  if (operacion === 'division') {
    const [a, b] = valores;
    const mayor = Math.max(a, b);
    const menor = Math.min(a, b);
    return menor > 0 && mayor % menor === 0 && mayor / menor === objetivo;
  }
  throw new Error(`Operacion desconocida: ${operacion}`);
}

// Cuenta soluciones (cuadrado latino NxN + cierre de cada region) hasta
// `tope`, con el mismo patron de early-exit que riego-plantas: tope 2
// basta para distinguir "sin solucion" / "unica" / "varias" sin pagar el
// coste de contarlas todas. Backtracking celda a celda en orden de
// lectura -- una region se comprueba en cuanto se rellena su ULTIMA celda
// en ese orden, momento en el que todas las demas ya estan puestas.
export function contarSoluciones(n, regiones, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;

  const regionDeCelda = Array.from({ length: n }, () => Array(n).fill(-1));
  regiones.forEach((region, idx) => {
    for (const [f, c] of region.celdas) regionDeCelda[f][c] = idx;
  });
  const ultimaCeldaDeRegion = regiones.map((region) =>
    region.celdas.reduce((max, [f, c]) => Math.max(max, f * n + c), -1)
  );

  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  const usadoFila = Array.from({ length: n }, () => new Set());
  const usadoCol = Array.from({ length: n }, () => new Set());

  let soluciones = 0;
  let primera = null;

  function valoresDe(region) {
    return region.celdas.map(([f, c]) => grid[f][c]);
  }

  // true si hay que parar (se alcanzo el tope).
  function rec(k) {
    if (k === n * n) {
      soluciones++;
      if (!primera) primera = grid.map((fila) => [...fila]);
      return soluciones >= tope;
    }

    const f = Math.floor(k / n);
    const c = k % n;

    for (let v = 1; v <= n; v++) {
      if (usadoFila[f].has(v) || usadoCol[c].has(v)) continue;

      grid[f][c] = v;
      usadoFila[f].add(v);
      usadoCol[c].add(v);

      let ok = true;
      const idxRegion = regionDeCelda[f][c];
      if (idxRegion !== -1 && ultimaCeldaDeRegion[idxRegion] === k) {
        const region = regiones[idxRegion];
        ok = cumpleOperacion(region.operacion, region.objetivo, valoresDe(region));
      }

      if (ok && rec(k + 1)) {
        usadoFila[f].delete(v);
        usadoCol[c].delete(v);
        return true;
      }

      usadoFila[f].delete(v);
      usadoCol[c].delete(v);
    }

    return false;
  }

  rec(0);
  return { soluciones, primera };
}

function dificultadDe(tamano, operacionesCompletas) {
  const base = { 4: 2, 5: 3, 6: 4 }[tamano];
  return Math.min(5, base + (operacionesCompletas ? 1 : 0));
}

// Reintenta con reparto de regiones distinto (misma solucion) hasta que
// cierra con exactamente una solucion, igual que hashi/nonograma/riego:
// generar y volver a comprobar es mas simple y mas robusto que intentar
// construir la unicidad a mano region a region.
export function buildFabricaPuzzle(seed) {
  const { tamano, operacionesCompletas } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const solucion = generaCuadradoLatino(tamano, rng);

  const MAX_INTENTOS = 300;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const regionesBase = construyeRegiones(tamano, rng, 4);
    const regiones = regionesBase.map((region) => {
      const valores = region.celdas.map(([f, c]) => solucion[f][c]);
      const { operacion, objetivo } = calculaOperacion(valores, operacionesCompletas, rng);
      return { id: region.id, celdas: region.celdas, operacion, objetivo };
    });

    const { soluciones } = contarSoluciones(tamano, regiones, { tope: 2 });
    if (soluciones === 1) {
      return {
        variant: varianteDeSeed(seed),
        dificultad: dificultadDe(tamano, operacionesCompletas),
        payload: {
          tablero: { ancho: tamano, alto: tamano },
          regiones,
          solucion
        }
      };
    }
  }

  throw new Error(
    `buildFabricaPuzzle: no se encontro un reparto de regiones con solucion unica ` +
    `tras ${MAX_INTENTOS} intentos (seed=${seed}, tamano=${tamano})`
  );
}
