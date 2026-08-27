// ===== scripts/lightsout-logic.js =====
// Construcción y solver de Lights Out (luces-fuera), compartidos entre
// el generador y el validador. Solver por eliminación gaussiana sobre
// GF(2): pulsar una casilla es su propia inversa, así que el estado
// final solo depende de la paridad de pulsaciones por casilla -- y una
// solución óptima nunca pulsa la misma casilla más de una vez (pulsarla
// una tercera vez deshace la segunda sin ahorrar nada), así que
// minimizar pulsaciones = minimizar el peso de Hamming entre todas las
// soluciones de A·x = b (mod 2).
//
// n = rows*cols puede llegar a 36 (tablero 6x6) -- por encima del límite
// de 32 bits de los operadores bitwise nativos de JS, así que las filas
// de la matriz se representan como arrays planos de 0/1, no como
// máscaras de bits. Para n<=36 la eliminación es O(n^3), trivial.

// PRNG determinista (mulberry32), sin dependencias externas. Duplicado a
// propósito (no importado de generate-daily-reto.js) para que este
// módulo sea autocontenido.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Aplica `numPresses` pulsaciones seedeadas sobre una COPIA de `origen` y
// la devuelve; el tablero recibido no se toca.
//
// Es la receta de la que salen los tres modos del tipo: se parte del
// tablero OBJETIVO y se desordena hacia atrás, así que el resultado es
// siempre resoluble de vuelta al objetivo por construcción (la diferencia
// entre ambos es A·y para el vector y de pulsaciones aplicadas, luego
// está por definición en la imagen de A). Eso no exime de comprobarlo de
// verdad en el validador, ver solveLightsOutFor.
export function aplicarPulsaciones(origen, seed, numPresses) {
  const rows = origen.length, cols = origen[0].length;
  const board = origen.map((row) => row.slice());
  const rand = mulberry32(seed);

  function toggle(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    board[r][c] = !board[r][c];
  }
  function press(r, c) {
    toggle(r, c); toggle(r - 1, c); toggle(r + 1, c); toggle(r, c - 1); toggle(r, c + 1);
  }

  const n = rows * cols;
  for (let k = 0; k < numPresses; k++) {
    const idx = Math.floor(rand() * n);
    press(Math.floor(idx / cols), idx % cols);
  }

  return board;
}

// Caso particular de aplicarPulsaciones desde tablero apagado, que es el
// objetivo del modo `all_off`.
export function buildPattern(rows, cols, seed, numPresses) {
  const apagado = Array.from({ length: rows }, () => Array(cols).fill(false));
  return aplicarPulsaciones(apagado, seed, numPresses);
}

// Matriz de adyacencia n x n: A[i][j] = 1 si pulsar la casilla j cambia
// la casilla i (misma regla que press() en plantillas/luces_fuera.js: la
// propia casilla + las 4 ortogonales, sin wraparound). Simétrica.
function buildAdjacency(rows, cols) {
  const n = rows * cols;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const vecinos = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of vecinos) {
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          A[nr * cols + nc][i] = 1;
        }
      }
    }
  }
  return A;
}

// Eliminación gaussiana de [A|b] sobre GF(2) hasta forma escalonada
// reducida (RREF). Devuelve null si el sistema es inconsistente (no
// debería pasar nunca para un board construido con buildPattern, pero
// el validador puede recibir cualquier cosa). Si es consistente,
// devuelve la matriz reducida + qué columnas son pivote/libres.
function gaussianEliminationGF2(A, b, n) {
  const M = A.map((row, i) => [...row, b[i]]);
  let pivotRow = 0;
  const pivotCols = [];

  for (let col = 0; col < n && pivotRow < n; col++) {
    let sel = -1;
    for (let r = pivotRow; r < n; r++) {
      if (M[r][col] === 1) { sel = r; break; }
    }
    if (sel === -1) continue;

    [M[pivotRow], M[sel]] = [M[sel], M[pivotRow]];

    for (let r = 0; r < n; r++) {
      if (r !== pivotRow && M[r][col] === 1) {
        for (let cc = col; cc <= n; cc++) M[r][cc] ^= M[pivotRow][cc];
      }
    }

    pivotCols.push(col);
    pivotRow++;
  }

  // Fila de ceros en la parte de A con un 1 en b -> sistema inconsistente.
  for (let r = pivotRow; r < n; r++) {
    if (M[r][n] === 1) return null;
  }

  const isPivot = new Array(n).fill(false);
  pivotCols.forEach((c) => { isPivot[c] = true; });
  const freeCols = [];
  for (let col = 0; col < n; col++) {
    if (!isPivot[col]) freeCols.push(col);
  }

  return { M, pivotCols, freeCols };
}

// Mínimo real de pulsaciones para apagar `board` (interpretado como "qué
// casillas necesitan un número impar de pulsaciones que las afecten").
// Devuelve null si no hay solución. Si A es singular (dim. del núcleo
// d > 0), prueba las 2^d combinaciones de la base del núcleo sobre la
// solución particular y se queda con la de menor peso de Hamming -- es
// el mínimo real, no una aproximación.
// Vector de pulsaciones de peso mínimo que apaga `board` (x[i] = 1 -> la
// casilla i se pulsa una vez). Devuelve null si no hay solución.
function mejorSolucion(board) {
  const rows = board.length, cols = board[0].length;
  const n = rows * cols;
  const A = buildAdjacency(rows, cols);
  const b = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) b.push(board[r][c] ? 1 : 0);
  }

  const elim = gaussianEliminationGF2(A, b, n);
  if (elim == null) return null;

  const { M, pivotCols, freeCols } = elim;

  const particular = new Array(n).fill(0);
  pivotCols.forEach((col, k) => { particular[col] = M[k][n]; });

  const nullBasis = freeCols.map((f) => {
    const v = new Array(n).fill(0);
    v[f] = 1;
    pivotCols.forEach((col, k) => { v[col] = M[k][f]; });
    return v;
  });

  const d = nullBasis.length;
  let mejor = null;
  let minWeight = Infinity;
  const total = Math.pow(2, d);
  for (let mask = 0; mask < total; mask++) {
    const x = particular.slice();
    for (let bit = 0; bit < d; bit++) {
      if (mask & (1 << bit)) {
        for (let i = 0; i < n; i++) x[i] ^= nullBasis[bit][i];
      }
    }
    let weight = 0;
    for (let i = 0; i < n; i++) weight += x[i];
    if (weight < minWeight) { minWeight = weight; mejor = x; }
  }

  return mejor;
}

export function solveLightsOut(board) {
  const x = mejorSolucion(board);
  return x == null ? null : x.reduce((a, v) => a + v, 0);
}

// Mínimo real de pulsaciones para un `modo` completo (patron_inicial +
// objetivo + patron_objetivo si aplica), replicando la misma lógica de
// isWin() de plantillas/luces_fuera.js para saber cuál es el tablero
// objetivo real -- no asume que el objetivo sea siempre "todo apagado".
// Devuelve null si patron_inicial no es un tablero concreto (los strings
// 'todo_apagado'/'aleatorio' no tienen una instancia fija que resolver).
// Casillas en las que el tablero difiere de su objetivo: resolver el modo
// es exactamente apagar esa diferencia, sea cual sea el objetivo.
function tableroDiferencia(modo) {
  if (!Array.isArray(modo.patron_inicial)) return null;

  const rows = modo.patron_inicial.length;
  const cols = modo.patron_inicial[0].length;

  let target;
  if (modo.objetivo === 'all_on') {
    target = Array.from({ length: rows }, () => Array(cols).fill(true));
  } else if (modo.objetivo === 'pattern_match') {
    target = modo.patron_objetivo || modo.patron_inicial;
  } else {
    target = Array.from({ length: rows }, () => Array(cols).fill(false));
  }

  return modo.patron_inicial.map((row, r) =>
    row.map((v, c) => (!!v !== !!target[r][c] ? 1 : 0))
  );
}

export function solveLightsOutFor(modo) {
  const diff = tableroDiferencia(modo);
  return diff == null ? null : solveLightsOut(diff);
}

// Las casillas [fila, columna] que hay que pulsar, una vez cada una, para
// llevar el tablero a su objetivo. Devuelve null si no hay solución.
export function solucionLightsOut(modo) {
  const diff = tableroDiferencia(modo);
  if (diff == null) return null;

  const x = mejorSolucion(diff);
  if (x == null) return null;

  const cols = diff[0].length;
  const celdas = [];
  x.forEach((v, i) => { if (v) celdas.push([Math.floor(i / cols), i % cols]); });
  return celdas;
}

export function isLightsOutSolvable(board) {
  return solveLightsOut(board) !== null;
}

// ===== Construcción del reto =====
// Dos ejes independientes: el tamaño del tablero y el objetivo. La
// plantilla y el solver ya sabían jugar los tres objetivos desde el
// principio; lo que faltaba era que el generador los emitiera.

const TAMANOS = [
  { rows: 4, cols: 4, dificultad: 2 },
  { rows: 5, cols: 5, dificultad: 3 },
  { rows: 6, cols: 6, dificultad: 4 }
];

const MODOS = [
  { id: 'apagar_todo', objetivo: 'all_off', sufijo: 'apagar' },
  { id: 'encender_todo', objetivo: 'all_on', sufijo: 'encender' },
  { id: 'reproducir_patron', objetivo: 'pattern_match', sufijo: 'patron' }
];

// Los dos ejes se sortean con el PRNG, NO con aritmética sobre el seed.
//
// `seed % 3` no vale aquí: el generador solo llama a este módulo para los
// seeds que selectTemplate le asigna a luces-fuera, y esos son UNA clase
// módulo el número de tipos (12). Como 3 divide a 12, `seed % 3` es
// constante en toda esa clase -- el eje queda clavado en un único valor
// para siempre. Es lo que pasaba con el tamaño: todos los retos de luces
// publicados salieron 5x5, y siempre habrían salido 5x5.
//
// Cada eje lleva su propia máscara para que no queden correlacionados
// entre sí.
function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

// Tablero objetivo de cada modo. En `pattern_match` es un tablero
// sorteado; en los otros dos, la rejilla constante que les da nombre.
function tableroObjetivo(spec, rows, cols, seed) {
  if (spec.objetivo === 'all_on') {
    return Array.from({ length: rows }, () => Array(cols).fill(true));
  }
  if (spec.objetivo === 'pattern_match') {
    const rand = mulberry32(seed);
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => rand() > 0.5));
  }
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

function esPatronMixto(board) {
  const plano = board.flat();
  return plano.some((v) => v) && plano.some((v) => !v);
}

export function buildLucesPuzzle(seed) {
  const { rows, cols, dificultad } = eligeEje(TAMANOS, seed, 0x2f1b7c4d);
  const spec = eligeEje(MODOS, seed, 0x5bf03635);

  // Seed de las pulsaciones, distinto de las máscaras de los dos ejes (y
  // de los multiplicadores ya usados en balanza/mezcla) para que el
  // desorden del tablero no quede correlacionado con tamaño ni modo.
  const patternSeed = (seed * 1597334677 + 987654321) >>> 0;
  const numPulsaciones = Math.ceil(rows * cols * 0.4);

  // Un puñado de intentos porque las pulsaciones pueden cancelarse entre
  // sí y dejar el tablero ya en el objetivo -- un reto que vendría
  // resuelto de fábrica.
  for (let intento = 0; intento < 40; intento++) {
    const paso = (patternSeed + intento * 2654435761) >>> 0;
    const objetivo = tableroObjetivo(spec, rows, cols, paso);

    // Una diana sorteada todo-apagada o todo-encendida no es "reproduce
    // este patrón": es all_off/all_on disfrazado, con el objetivo
    // dibujado arriba mintiendo sobre qué reto se está jugando.
    if (spec.objetivo === 'pattern_match' && !esPatronMixto(objetivo)) continue;

    const patronInicial = aplicarPulsaciones(objetivo, paso, numPulsaciones);

    const modo = {
      id: spec.id,
      tamano: [rows, cols],
      objetivo: spec.objetivo,
      patron_inicial: patronInicial,
      ...(spec.objetivo === 'pattern_match' ? { patron_objetivo: objetivo } : {})
    };

    const minPulsaciones = solveLightsOutFor(modo);
    if (minPulsaciones == null || minPulsaciones === 0) continue;

    modo.min_pulsaciones = minPulsaciones;
    return {
      variant: `${rows}x${cols}-${spec.sufijo}`,
      rows,
      cols,
      dificultad,
      modo,
      minPulsaciones
    };
  }

  throw new Error(`No se pudo generar un reto de luces para seed=${seed}`);
}

// Pistas específicas del modo y del mínimo real -- no un texto genérico.
// La técnica de barrido fila a fila vale para los tres objetivos, pero
// hay que enunciarla hacia el que toca: decir "para apagar una casilla"
// en un reto de encender es una pista que despista.
export function buildLucesHints(puzzle) {
  const { rows, cols, minPulsaciones, modo } = puzzle;
  const regla = 'Cada pulsación cambia la casilla y sus vecinas ortogonales (arriba, abajo, izquierda, derecha) -- piensa en el efecto combinado antes de pulsar al azar.';
  const cierre = `El mínimo real para este tablero de ${rows}x${cols} es ${minPulsaciones} pulsaci${minPulsaciones === 1 ? 'ón' : 'ones'} -- una solución óptima nunca pulsa la misma casilla dos veces.`;

  if (modo.objetivo === 'all_on') {
    return [
      regla,
      'Trabajar fila por fila desde arriba suele funcionar bien: para encender de una vez una casilla que se resiste, pulsa la que tiene justo debajo.',
      cierre
    ];
  }

  if (modo.objetivo === 'pattern_match') {
    return [
      regla,
      'No mires el tablero entero: solo cuentan las casillas que difieren de la diana. Trabájalas fila por fila desde arriba, pulsando la de justo debajo de cada diferencia.',
      cierre
    ];
  }

  return [
    regla,
    'Trabajar fila por fila desde arriba suele funcionar bien: para apagar definitivamente una casilla, pulsa la que tiene justo debajo.',
    cierre
  ];
}
