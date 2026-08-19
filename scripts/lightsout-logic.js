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

// Construye el tablero inicial aplicando `numPresses` pulsaciones
// seedeadas desde tablero apagado. El resultado SIEMPRE es solvable por
// construcción (b = A·y para el vector y de pulsaciones aplicadas, así
// que b está por definición en la imagen de A) -- pero eso no exime de
// comprobarlo de verdad en el validador, ver solveLightsOut.
export function buildPattern(rows, cols, seed, numPresses) {
  const board = Array.from({ length: rows }, () => Array(cols).fill(false));
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
export function solveLightsOut(board) {
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
    if (weight < minWeight) minWeight = weight;
  }

  return minWeight;
}

// Mínimo real de pulsaciones para un `modo` completo (patron_inicial +
// objetivo + patron_objetivo si aplica), replicando la misma lógica de
// isWin() de plantillas/luces_fuera.js para saber cuál es el tablero
// objetivo real -- no asume que el objetivo sea siempre "todo apagado".
// Devuelve null si patron_inicial no es un tablero concreto (los strings
// 'todo_apagado'/'aleatorio' no tienen una instancia fija que resolver).
export function solveLightsOutFor(modo) {
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

  const diff = modo.patron_inicial.map((row, r) =>
    row.map((v, c) => (!!v !== !!target[r][c] ? 1 : 0))
  );

  return solveLightsOut(diff);
}

export function isLightsOutSolvable(board) {
  return solveLightsOut(board) !== null;
}
