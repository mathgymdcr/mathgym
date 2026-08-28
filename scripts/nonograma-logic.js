// ===== scripts/nonograma-logic.js =====
// Solver y generador de nonogramas, compartidos entre
// scripts/generate-daily-reto.js y scripts/validate-retos.js.
//
// La unicidad aquí no es un adorno: plantillas/nonograma.js comprueba la
// victoria comparando celda a celda contra la rejilla guardada (`haGanado`),
// así que si unas pistas admitieran dos dibujos, el jugador que encontrara
// el otro -- igual de válido según los números -- no ganaría nunca.

const DESCONOCIDA = -1;

// Bloques de una línea con su color: una tira seguida de celdas DEL MISMO
// color. Dos colores pegados son dos bloques aunque no haya hueco entre
// ellos, que es lo que distingue al nonograma en color del monocromo.
// La línea vacía no tiene bloques.
export function rachasColor(linea) {
  const res = [];
  let previo = 0;
  for (const v of linea) {
    if (v === 0) { previo = 0; continue; }
    if (v === previo) res[res.length - 1].n++;
    else res.push({ n: 1, color: v });
    previo = v;
  }
  return res;
}

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

// Las mismas pistas de `pistasDe`, pero con el color de cada bloque. El
// monocromo es el caso de un solo color, así que esta es la forma general.
export function pistasColorDe(grid) {
  const columnas = [];
  const nCols = grid[0].length;
  for (let c = 0; c < nCols; c++) columnas.push(rachasColor(grid.map((fila) => fila[c])));
  return { filas: grid.map(rachasColor), columnas };
}

export function pistasDe(grid) {
  const columnas = [];
  const nCols = grid[0].length;
  for (let c = 0; c < nCols; c++) columnas.push(rachas(grid.map((fila) => fila[c])));
  return { filas: grid.map(rachas), columnas };
}

// Una pista puede venir en números (monocromo, el esquema publicado hasta
// hoy) o en bloques `{n, color}`. Dentro del motor siempre son bloques: el
// monocromo es el caso de un solo color, no un camino aparte.
function normalizarPista(pista) {
  return pista
    .map((p) => (typeof p === 'number' ? { n: p, color: 1 } : p))
    .filter((b) => b.n > 0);
}

// Espacio que ocupan los bloques a partir de `idx`, contando el hueco que
// cada uno exige del anterior: obligatorio solo entre bloques del MISMO
// color, porque dos colores distintos se distinguen sin separarlos.
function colaMinima(bloques, idx) {
  let total = 0;
  for (let i = idx; i < bloques.length; i++) {
    total += bloques[i].n;
    if (i > idx && bloques[i].color === bloques[i - 1].color) total += 1;
  }
  return total;
}

// Todas las formas de colocar los bloques de una línea que encajan con lo
// que ya se sabe de ella. Es la operación básica del solver: si todas las
// colocaciones coinciden en una celda, esa celda está decidida. Se exporta
// porque es donde vive la regla de contacto entre bloques, y esa regla no se
// distingue mirando el número de soluciones -- `cumple` descarta igualmente
// las rejillas ilegales --, solo mirando lo que se deduce sin adivinar.
export function colocacionesDeLinea(pistas, n, estado) {
  const bloques = normalizarPista(pistas);
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
    const cola = colaMinima(bloques, idx + 1);
    for (let start = pos; start + b.n + cola <= n; start++) {
      for (let i = pos; i < start; i++) linea[i] = 0;
      for (let i = start; i < start + b.n; i++) linea[i] = b.color;
      if (!encaja(pos, start + b.n)) continue;
      let sig = start + b.n;
      const siguiente = bloques[idx + 1];
      // El hueco solo se reserva si el bloque de detrás es del mismo color;
      // si es de otro, puede empezar pegado a este.
      if (siguiente && siguiente.color === b.color) {
        if (sig >= n) continue;
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
      const opciones = colocacionesDeLinea(pistasFilas[r], cols, estado[r]);
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
      const opciones = colocacionesDeLinea(pistasColumnas[c], filas, columna);
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

const mismasPistas = (a, b) =>
  a.length === b.length && a.every((v, i) => v.n === b[i].n && v.color === b[i].color);

function cumple(grid, pistasFilas, pistasColumnas) {
  const propias = pistasColorDe(grid);
  return propias.filas.every((p, i) => mismasPistas(p, normalizarPista(pistasFilas[i]))) &&
    propias.columnas.every((p, i) => mismasPistas(p, normalizarPista(pistasColumnas[i])));
}

// Cuenta soluciones hasta `tope`. `soloLogica` dice si la primera solución
// salió únicamente de propagar restricciones, sin ninguna hipótesis: es la
// diferencia entre un nonograma que se razona y uno que obliga a probar.
export function resolverNonograma(pistasFilas, pistasColumnas, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 2;
  const filas = pistasFilas.length;
  const cols = pistasColumnas.length;

  const colores = new Set();
  for (const pista of [...pistasFilas, ...pistasColumnas]) {
    for (const bloque of normalizarPista(pista)) colores.add(bloque.color);
  }
  const valores = [...[...colores].sort((a, b) => a - b), 0];

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

    // Los valores que puede tomar una celda salen de las propias pistas: los
    // colores que aparecen en ellas, y el vacío. En monocromo son [1, 0], que
    // es el orden de siempre.
    for (const v of valores) {
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

// --- Banco de figuras en color --------------------------------------------

// Los colores salen de la paleta de marca (los mismos rellenos que usan los
// iconos), y la letra con la que se dibuja cada uno ES la clave: el dibujo
// del banco es la única fuente de qué colores lleva una figura.
export const COLORES_MARCA = {
  o: '#f8c818',   // el oro de la M del logo
  a: '#1788c7',   // el azul de las pesas
  m: '#8a2189'    // el morado del hexágono
};

// Pixel art en color, mismo formato que BANCO_FIGURAS pero con una letra por
// color en vez de '#'. Cada figura la comprueba tests/nonograma/banco-color.js:
// si alguna admitiera dos soluciones, no puede entrar aquí.
export const BANCO_COLOR = [
  // --- 5x5 ---
  { nombre: 'vela', filas: [
    '..o..',
    '..o..',
    '.aaa.',
    '.aaa.',
    '.aaa.'
  ] },
  { nombre: 'globo', filas: [
    '.mmm.',
    'mmmmm',
    'mmmmm',
    '.mmm.',
    '..o..'
  ] },
  { nombre: 'flor', filas: [
    '.m.m.',
    'mmmmm',
    '.mom.',
    '..m..',
    '..o..'
  ] },
  { nombre: 'pez-tropical', filas: [
    '....o',
    '.aaao',
    'aaaaa',
    '.aaao',
    '....o'
  ] },

  // --- 8x8 ---
  { nombre: 'seta-lunares', filas: [
    '..mmmm..',
    '.mmommm.',
    'mmommomm',
    'mmmmmmmm',
    '...oo...',
    '...oo...',
    '..oooo..',
    '........'
  ] },
  { nombre: 'velero', filas: [
    '....o...',
    '....oo..',
    '....ooo.',
    '....oooo',
    '....o...',
    '........',
    'mmmmmmmm',
    '.mmmmmm.'
  ] },
  { nombre: 'pez-payaso', filas: [
    '........',
    '..aaaa..',
    '.aaoaaa.',
    'aaaaaaao',
    'aaaaaaao',
    '.aaaaaa.',
    '..aaaa..',
    '........'
  ] },
  { nombre: 'corazon-brillo', filas: [
    '.mm..mm.',
    'mmmmmmmm',
    'mmommmmm',
    'mmmmmmmm',
    '.mmmmmm.',
    '..mmmm..',
    '...mm...',
    '........'
  ] }
];

// Rejilla de índices (0 = vacía, 1..k = color) y la paleta de hex que les
// corresponde, en el orden canónico de COLORES_MARCA para que dos figuras con
// los mismos colores los numeren igual.
export function figuraColorAGrid(figura) {
  const letras = Object.keys(COLORES_MARCA).filter((l) => figura.filas.some((f) => f.includes(l)));
  const grid = figura.filas.map((fila) =>
    [...fila].map((ch) => (ch === '.' ? 0 : letras.indexOf(ch) + 1))
  );
  return { grid, paleta: letras.map((l) => COLORES_MARCA[l]) };
}

export function gridDeFigura(figura) {
  return figura.filas.map((fila) => [...fila].map((ch) => (ch === '#' ? 1 : 0)));
}

// --- Generador ------------------------------------------------------------

const LADO_POR_VARIANTE = { pequeno: 5, medio: 8, grande: 10 };
const VARIANTES = ['pequeno', 'medio', 'grande'];
const DIFICULTAD_BASE = { 5: 2, 8: 3, 10: 4 };

// Tamaños con banco en color. El 10x10 se queda siempre monocromo: no hay
// figuras de ese lado dibujadas en color, y con tres colores el conteo de
// unicidad sobre 100 celdas se encarece de más para el generador diario.
const LADOS_COLOR = [5, 8];

// Elige tamaño, espejado, color y figura de forma determinista a partir del
// seed de fecha, cada uno en un "dígito" distinto del seed para que los ejes
// no queden correlacionados. El espejo es horizontal a propósito: dado la
// vuelta en vertical, una casa quedaría del revés y el dibujo dejaría de
// reconocerse.
// PRNG determinista (mulberry32), sin dependencias externas. Duplicado a
// propósito para que este módulo sea autocontenido.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Los tres ejes se sortean con el PRNG, NO con aritmética sobre el seed.
//
// `selectTemplate` es `templates[seed % 12]`, así que este tipo solo recibe
// una clase módulo 12, y los seeds de esa clase se diferencian en múltiplos
// de 12. Ahí `seed % 3` es constante, pero TAMBIÉN lo son
// `Math.floor(seed / 3) % 2` y `Math.floor(seed / 6) % 2`: sumar 12 al seed
// añade 4 y 2 al cociente, que no cambian la paridad. Los tres ejes de
// nonograma -- tamaño, espejo y color -- estaban muertos a la vez, y el
// tipo publicaba siempre `medio-color`. El eje de color, que se añadió en
// el PR #10, no llegó a verse nunca.
function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

function ejeBooleano(seed, mascara) {
  return mulberry32((seed ^ mascara) >>> 0)() < 0.5;
}

// Los tres ejes juntos, sin construir el puzzle: así los tests pueden
// comprobar el reparto sobre fechas reales sin pagar el solver.
export function ejesDeSeed(seed) {
  const base = eligeEje(VARIANTES, seed, 0x18f5c37b);
  const lado = LADO_POR_VARIANTE[base];
  return {
    base,
    lado,
    espejo: ejeBooleano(seed, 0x4e21a9d6),
    color: LADOS_COLOR.includes(lado) && ejeBooleano(seed, 0x2b6de81f)
  };
}

export function varianteDeSeed(seed) {
  const { base, color } = ejesDeSeed(seed);
  return color ? `${base}-color` : base;
}

export function buildNonogramaPuzzle(seed) {
  const { base, lado, espejo, color } = ejesDeSeed(seed);
  const variant = varianteDeSeed(seed);

  const banco = color ? BANCO_COLOR : BANCO_FIGURAS;
  const candidatas = banco.filter((f) => f.filas.length === lado);
  const inicio = Math.floor(seed / (VARIANTES.length * 4)) % candidatas.length;

  for (let k = 0; k < candidatas.length; k++) {
    const figura = candidatas[(inicio + k) % candidatas.length];
    const { grid: dibujo, paleta } = color
      ? figuraColorAGrid(figura)
      : { grid: gridDeFigura(figura), paleta: null };
    let grid = dibujo;
    if (espejo) grid = grid.map((fila) => [...fila].reverse());

    const { filas, columnas } = color ? pistasColorDe(grid) : pistasDe(grid);
    const res = resolverNonograma(filas, columnas, { tope: 2 });
    // El banco ya se valida en los tests, pero no se da por supuesto: si una
    // figura se volviera ambigua al editarla, se salta en vez de publicarla.
    if (res.soluciones !== 1) continue;

    return {
      variant,
      rows: lado,
      cols: lado,
      grid,
      ...(color ? { paleta } : {}),
      figura: figura.nombre,
      espejo,
      soloLogica: res.soloLogica,
      // Un nonograma que obliga a suponer y comprobar es un escalón por
      // encima de uno que sale solo propagando pistas, y el color es otro:
      // hay que decidir de qué color va cada bloque, no solo dónde cae.
      dificultad: Math.min(5, DIFICULTAD_BASE[lado] + (color ? 1 : 0) + (res.soloLogica ? 0 : 1))
    };
  }

  throw new Error(`No hay ninguna figura de ${lado}x${lado} con solución única (seed=${seed})`);
}

// --- Pistas ---------------------------------------------------------------

// Espacio mínimo que ocupan los bloques de una pista, con la regla de
// contacto: entre dos bloques del mismo color hay hueco obligatorio, entre
// dos colores distintos no.
function espacioMinimo(pista) {
  return colaMinima(normalizarPista(pista), 0);
}

// Tres pistas en escalera: por dónde entrar, qué técnica desatasca el medio
// y qué recordar al final. Nunca nombran la figura: el dibujo es el premio.
export function buildNonogramaHints(puzzle) {
  const { grid, rows, cols } = puzzle;
  // Siempre en bloques con color: en monocromo son todos del mismo, así que
  // el texto sale igual que antes, y en color no se funden dos bloques
  // pegados de colores distintos, que en monocromo parecerían uno solo.
  const { filas, columnas } = pistasColorDe(grid);

  const lineas = [
    ...filas.map((pista, idx) => ({ tipo: 'fila', idx, pista, largo: cols })),
    ...columnas.map((pista, idx) => ({ tipo: 'columna', idx, pista, largo: rows }))
  ];

  // Mejor entrada: una línea sin ningún grado de libertad, donde los bloques
  // y sus huecos ya llenan la línea entera.
  const pintadasDe = (pista) => pista.reduce((a, b) => a + b.n, 0);
  const bloqueMayor = (pista) => (pista.length ? Math.max(...pista.map((b) => b.n)) : 0);

  const forzadas = lineas.filter((l) => espacioMinimo(l.pista) === l.largo);
  const entrada = forzadas.length
    ? forzadas.reduce((mejor, cur) => (pintadasDe(cur.pista) > pintadasDe(mejor.pista) ? cur : mejor))
    : lineas.reduce((mejor, cur) =>
        (bloqueMayor(cur.pista) > bloqueMayor(mejor.pista) ? cur : mejor));

  const numeros = entrada.pista.map((b) => b.n).join(' ');
  const primera = forzadas.length
    ? (entrada.pista.length === 1 && entrada.pista[0].n === entrada.largo
        ? `Empieza por la ${entrada.tipo} ${entrada.idx + 1}: pide ${entrada.largo} seguidas en ${entrada.largo} celdas, así que va pintada entera y te da un apoyo para todas las líneas que la cruzan.`
        : `Empieza por la ${entrada.tipo} ${entrada.idx + 1}, con pistas ${numeros}: los bloques y los huecos obligatorios entre ellos ya ocupan las ${entrada.largo} celdas, así que solo caben de una forma.`)
    : `Empieza por la ${entrada.tipo} ${entrada.idx + 1}, con pistas ${numeros}: es la línea con el bloque más largo del tablero y la que menos margen deja.`;

  // Técnica del solapamiento, sobre el bloque más grande de una línea que
  // AÚN tenga margen: aplicarla a una línea ya forzada no enseña nada y
  // encima repetiría la pista anterior.
  const conMargen = lineas.filter((l) =>
    l.pista.length &&
    espacioMinimo(l.pista) < l.largo &&
    !(l.tipo === entrada.tipo && l.idx === entrada.idx));
  const mayor = conMargen.length
    ? conMargen.reduce((mejor, cur) => (bloqueMayor(cur.pista) > bloqueMayor(mejor.pista) ? cur : mejor))
    : null;
  const bloque = mayor ? bloqueMayor(mayor.pista) : 0;
  const solape = mayor ? 2 * bloque - mayor.largo : 0;
  const segunda = solape > 0
    ? `Cuando una línea no esté forzada del todo, usa el solapamiento: en la ${mayor.tipo} ${mayor.idx + 1} hay un bloque de ${bloque} sobre ${mayor.largo} celdas, así que ${solape === 1 ? 'la celda central cae' : `las ${solape} celdas centrales caen`} pintad${solape === 1 ? 'a' : 'as'} se coloque donde se coloque.`
    : 'Cuando una línea no esté forzada del todo, prueba a empujar su bloque hacia los dos extremos: lo que quede pintado en las dos posiciones extremas es seguro, y eso es el solapamiento.';

  const total = grid.flat().filter((v) => v > 0).length;
  const tercera = `El dibujo tiene ${total} celdas pintadas en total, así que puedes ir descontando. Marca con × las que descartes: no cuentan para ganar, pero evitan que vuelvas a dudar sobre la misma celda.`;

  return [primera, segunda, tercera];
}
