// ===== scripts/nonograma-logic.js =====
// Solver y generador de nonogramas, compartidos entre
// scripts/generate-daily-reto.js y scripts/validate-retos.js.
//
// La unicidad aquí no es un adorno: plantillas/nonograma.js comprueba la
// victoria comparando celda a celda contra la rejilla guardada (`haGanado`),
// así que si unas pistas admitieran dos dibujos, el jugador que encontrara
// el otro -- igual de válido según los números -- no ganaría nunca.

const DESCONOCIDA = -1;

// Rachas de celdas pintadas de una línea. Devuelve [0] para la línea vacía,
// igual que la función `rachas` de la plantilla, para que las pistas que
// calcula el generador y las que pinta la UI sean idénticas.
export function rachas(linea) {
  const res = [];
  let run = 0;
  for (const v of linea) {
    if (v === 1) run++;
    else if (run > 0) { res.push(run); run = 0; }
  }
  if (run > 0) res.push(run);
  return res.length ? res : [0];
}

export function pistasDe(grid) {
  const columnas = [];
  const nCols = grid[0].length;
  for (let c = 0; c < nCols; c++) columnas.push(rachas(grid.map((fila) => fila[c])));
  return { filas: grid.map(rachas), columnas };
}

// Todas las formas de colocar los bloques de una línea que encajan con lo
// que ya se sabe de ella. Es la operación básica del solver: si todas las
// colocaciones coinciden en una celda, esa celda está decidida.
function colocaciones(pistas, n, estado) {
  const bloques = pistas.filter((p) => p > 0);
  const res = [];
  const linea = new Array(n).fill(0);

  const encaja = (desde, hasta) => {
    for (let i = desde; i < hasta; i++) {
      if (estado[i] !== DESCONOCIDA && estado[i] !== linea[i]) return false;
    }
    return true;
  };

  const rec = (idx, pos) => {
    if (idx === bloques.length) {
      for (let i = pos; i < n; i++) linea[i] = 0;
      if (encaja(pos, n)) res.push(linea.slice());
      return;
    }
    const b = bloques[idx];
    // Hueco mínimo que necesitan los bloques que aún faltan detrás.
    const cola = bloques.slice(idx + 1).reduce((acc, x) => acc + x + 1, 0);
    for (let start = pos; start + b + cola <= n; start++) {
      for (let i = pos; i < start; i++) linea[i] = 0;
      for (let i = start; i < start + b; i++) linea[i] = 1;
      if (!encaja(pos, start + b)) continue;
      let sig = start + b;
      if (sig < n) {
        linea[sig] = 0;
        if (estado[sig] !== DESCONOCIDA && estado[sig] !== 0) continue;
        sig++;
      }
      rec(idx + 1, sig);
    }
  };

  rec(0, 0);
  return res;
}

// Fija todas las celdas que se deducen sin adivinar. Devuelve false si las
// pistas ya se contradicen.
function propagar(estado, pistasFilas, pistasColumnas) {
  const filas = estado.length;
  const cols = estado[0].length;
  let cambio = true;

  while (cambio) {
    cambio = false;

    for (let r = 0; r < filas; r++) {
      const opciones = colocaciones(pistasFilas[r], cols, estado[r]);
      if (!opciones.length) return false;
      for (let c = 0; c < cols; c++) {
        if (estado[r][c] !== DESCONOCIDA) continue;
        const v = opciones[0][c];
        if (opciones.every((op) => op[c] === v)) {
          estado[r][c] = v;
          cambio = true;
        }
      }
    }

    for (let c = 0; c < cols; c++) {
      const columna = estado.map((fila) => fila[c]);
      const opciones = colocaciones(pistasColumnas[c], filas, columna);
      if (!opciones.length) return false;
      for (let r = 0; r < filas; r++) {
        if (estado[r][c] !== DESCONOCIDA) continue;
        const v = opciones[0][r];
        if (opciones.every((op) => op[r] === v)) {
          estado[r][c] = v;
          cambio = true;
        }
      }
    }
  }

  return true;
}

const mismasPistas = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function cumple(grid, pistasFilas, pistasColumnas) {
  const propias = pistasDe(grid);
  return propias.filas.every((p, i) => mismasPistas(p, pistasFilas[i])) &&
    propias.columnas.every((p, i) => mismasPistas(p, pistasColumnas[i]));
}

// Cuenta soluciones hasta `tope`. `soloLogica` dice si la primera solución
// salió únicamente de propagar restricciones, sin ninguna hipótesis: es la
// diferencia entre un nonograma que se razona y uno que obliga a probar.
export function resolverNonograma(pistasFilas, pistasColumnas, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 2;
  const filas = pistasFilas.length;
  const cols = pistasColumnas.length;

  let soluciones = 0;
  let primera = null;
  let necesitoHipotesis = false;

  const buscar = (estado, adivinando) => {
    if (soluciones >= tope) return;
    if (!propagar(estado, pistasFilas, pistasColumnas)) return;

    let rr = -1, cc = -1;
    for (let r = 0; r < filas && rr === -1; r++) {
      for (let c = 0; c < cols; c++) {
        if (estado[r][c] === DESCONOCIDA) { rr = r; cc = c; break; }
      }
    }

    if (rr === -1) {
      if (!cumple(estado, pistasFilas, pistasColumnas)) return;
      soluciones++;
      if (!primera) {
        primera = estado.map((fila) => fila.slice());
        necesitoHipotesis = adivinando;
      }
      return;
    }

    for (const v of [1, 0]) {
      const copia = estado.map((fila) => fila.slice());
      copia[rr][cc] = v;
      buscar(copia, true);
      if (soluciones >= tope) return;
    }
  };

  buscar(Array.from({ length: filas }, () => new Array(cols).fill(DESCONOCIDA)), false);

  return { soluciones, primera, soloLogica: soluciones > 0 && !necesitoHipotesis };
}

// --- Banco de figuras -----------------------------------------------------

// Pixel art escrito a mano: '#' celda pintada, '.' vacía. La plantilla
// promete "revela el dibujo oculto", así que el dibujo tiene que existir de
// verdad. Cada figura la comprueba tests/nonograma/banco.test.js: si alguna
// admitiera dos soluciones, no puede entrar aquí.
export const BANCO_FIGURAS = [
  // --- 5x5 ---
  { nombre: 'corazon', filas: [
    '.#.#.',
    '#####',
    '#####',
    '.###.',
    '..#..'
  ] },
  { nombre: 'casa', filas: [
    '..#..',
    '.###.',
    '#####',
    '##.##',
    '##.##'
  ] },
  { nombre: 'arbol', filas: [
    '..#..',
    '.###.',
    '#####',
    '..#..',
    '..#..'
  ] },
  { nombre: 'diamante', filas: [
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..'
  ] },
  { nombre: 'cruz', filas: [
    '..#..',
    '..#..',
    '#####',
    '..#..',
    '..#..'
  ] },
  { nombre: 'marco', filas: [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####'
  ] },

  // --- 8x8 ---
  { nombre: 'pez', filas: [
    '........',
    '..###...',
    '.#####.#',
    '########',
    '########',
    '.#####.#',
    '..###...',
    '........'
  ] },
  { nombre: 'seta', filas: [
    '..####..',
    '.######.',
    '########',
    '########',
    '...##...',
    '...##...',
    '..####..',
    '........'
  ] },
  { nombre: 'luna', filas: [
    '..####..',
    '.##..##.',
    '##....#.',
    '##......',
    '##......',
    '##....#.',
    '.##..##.',
    '..####..'
  ] },
  { nombre: 'corazon-grande', filas: [
    '.##..##.',
    '########',
    '########',
    '########',
    '.######.',
    '..####..',
    '...##...',
    '........'
  ] },
  { nombre: 'llave', filas: [
    '..####..',
    '.##..##.',
    '.##..##.',
    '..####..',
    '...##...',
    '...####.',
    '...##...',
    '...###..'
  ] },

  // --- 10x10 ---
  { nombre: 'barco', filas: [
    '....#.....',
    '....##....',
    '....###...',
    '....####..',
    '....#####.',
    '....#.....',
    '..........',
    '##########',
    '.########.',
    '..######..'
  ] },
  { nombre: 'corazon-enorme', filas: [
    '..##..##..',
    '.########.',
    '##########',
    '##########',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
    '..........'
  ] },
  { nombre: 'seta-grande', filas: [
    '..........',
    '...####...',
    '..######..',
    '.########.',
    '##########',
    '##########',
    '....##....',
    '....##....',
    '...####...',
    '..........'
  ] }
];

export function gridDeFigura(figura) {
  return figura.filas.map((fila) => [...fila].map((ch) => (ch === '#' ? 1 : 0)));
}

// --- Generador ------------------------------------------------------------

const LADO_POR_VARIANTE = { pequeno: 5, medio: 8, grande: 10 };
const VARIANTES = ['pequeno', 'medio', 'grande'];
const DIFICULTAD_BASE = { 5: 2, 8: 3, 10: 4 };

// Elige tamaño, figura y espejado de forma determinista a partir del seed de
// fecha. El espejo es horizontal a propósito: dado la vuelta en vertical, una
// casa quedaría del revés y el dibujo dejaría de reconocerse.
export function buildNonogramaPuzzle(seed) {
  const variant = VARIANTES[seed % VARIANTES.length];
  const lado = LADO_POR_VARIANTE[variant];
  const candidatas = BANCO_FIGURAS.filter((f) => f.filas.length === lado);
  const espejo = Math.floor(seed / VARIANTES.length) % 2 === 1;
  const inicio = Math.floor(seed / (VARIANTES.length * 2)) % candidatas.length;

  for (let k = 0; k < candidatas.length; k++) {
    const figura = candidatas[(inicio + k) % candidatas.length];
    let grid = gridDeFigura(figura);
    if (espejo) grid = grid.map((fila) => [...fila].reverse());

    const { filas, columnas } = pistasDe(grid);
    const res = resolverNonograma(filas, columnas, { tope: 2 });
    // El banco ya se valida en los tests, pero no se da por supuesto: si una
    // figura se volviera ambigua al editarla, se salta en vez de publicarla.
    if (res.soluciones !== 1) continue;

    return {
      variant,
      rows: lado,
      cols: lado,
      grid,
      figura: figura.nombre,
      espejo,
      soloLogica: res.soloLogica,
      // Un nonograma que obliga a suponer y comprobar es un escalón por
      // encima de uno que sale solo propagando pistas.
      dificultad: Math.min(5, DIFICULTAD_BASE[lado] + (res.soloLogica ? 0 : 1))
    };
  }

  throw new Error(`No hay ninguna figura de ${lado}x${lado} con solución única (seed=${seed})`);
}

// --- Pistas ---------------------------------------------------------------

// Espacio mínimo que ocupan los bloques de una pista: los bloques más un
// hueco obligatorio entre cada dos.
function espacioMinimo(pista) {
  const bloques = pista.filter((n) => n > 0);
  if (!bloques.length) return 0;
  return bloques.reduce((a, b) => a + b, 0) + bloques.length - 1;
}

// Tres pistas en escalera: por dónde entrar, qué técnica desatasca el medio
// y qué recordar al final. Nunca nombran la figura: el dibujo es el premio.
export function buildNonogramaHints(puzzle) {
  const { grid, rows, cols } = puzzle;
  const { filas, columnas } = pistasDe(grid);

  const lineas = [
    ...filas.map((pista, idx) => ({ tipo: 'fila', idx, pista, largo: cols })),
    ...columnas.map((pista, idx) => ({ tipo: 'columna', idx, pista, largo: rows }))
  ];

  // Mejor entrada: una línea sin ningún grado de libertad, donde los bloques
  // y sus huecos ya llenan la línea entera.
  const forzadas = lineas.filter((l) => espacioMinimo(l.pista) === l.largo);
  const entrada = forzadas.length
    ? forzadas.reduce((mejor, cur) =>
        (cur.pista.reduce((a, b) => a + b, 0) > mejor.pista.reduce((a, b) => a + b, 0) ? cur : mejor))
    : lineas.reduce((mejor, cur) =>
        (Math.max(...cur.pista) > Math.max(...mejor.pista) ? cur : mejor));

  const numeros = entrada.pista.join(' ');
  const primera = forzadas.length
    ? (entrada.pista.length === 1 && entrada.pista[0] === entrada.largo
        ? `Empieza por la ${entrada.tipo} ${entrada.idx + 1}: pide ${entrada.largo} seguidas en ${entrada.largo} celdas, así que va pintada entera y te da un apoyo para todas las líneas que la cruzan.`
        : `Empieza por la ${entrada.tipo} ${entrada.idx + 1}, con pistas ${numeros}: los bloques y los huecos obligatorios entre ellos ya ocupan las ${entrada.largo} celdas, así que solo caben de una forma.`)
    : `Empieza por la ${entrada.tipo} ${entrada.idx + 1}, con pistas ${numeros}: es la línea con el bloque más largo del tablero y la que menos margen deja.`;

  // Técnica del solapamiento, sobre el bloque más grande de una línea que
  // AÚN tenga margen: aplicarla a una línea ya forzada no enseña nada y
  // encima repetiría la pista anterior.
  const conMargen = lineas.filter((l) =>
    espacioMinimo(l.pista) < l.largo &&
    !(l.tipo === entrada.tipo && l.idx === entrada.idx));
  const mayor = conMargen.length
    ? conMargen.reduce((mejor, cur) => (Math.max(...cur.pista) > Math.max(...mejor.pista) ? cur : mejor))
    : null;
  const bloque = mayor ? Math.max(...mayor.pista) : 0;
  const solape = mayor ? 2 * bloque - mayor.largo : 0;
  const segunda = solape > 0
    ? `Cuando una línea no esté forzada del todo, usa el solapamiento: en la ${mayor.tipo} ${mayor.idx + 1} hay un bloque de ${bloque} sobre ${mayor.largo} celdas, así que ${solape === 1 ? 'la celda central cae' : `las ${solape} celdas centrales caen`} pintad${solape === 1 ? 'a' : 'as'} se coloque donde se coloque.`
    : 'Cuando una línea no esté forzada del todo, prueba a empujar su bloque hacia los dos extremos: lo que quede pintado en las dos posiciones extremas es seguro, y eso es el solapamiento.';

  const total = grid.flat().filter((v) => v === 1).length;
  const tercera = `El dibujo tiene ${total} celdas pintadas en total, así que puedes ir descontando. Marca con × las que descartes: no cuentan para ganar, pero evitan que vuelvas a dudar sobre la misma celda.`;

  return [primera, segunda, tercera];
}
