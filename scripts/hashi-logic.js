// ===== scripts/hashi-logic.js =====
// Solver y generador de "Puentes de Hashi" (Hashiwokakero), compartidos
// entre scripts/generate-daily-reto.js y scripts/validate-retos.js.
//
// Modelo fiel a plantillas/hashi.js: el tablero es una retícula rows x cols
// con islas en celdas concretas, cada una con un `grado` (los puentes que
// deben llegarle, contando el doble como 2). Un puente une dos islas
// alineadas en fila o columna sin ninguna otra isla entre medias, puede ser
// simple o doble, y dos puentes perpendiculares no pueden cruzarse. La
// solución debe además dejar todas las islas en un único archipiélago.

const MAX_PUENTES_POR_PAR = 2;
const MAX_GRADO = 8;

// --- Pares candidatos y cruces -------------------------------------------

// Devuelve los pares de islas que PODRÍAN unirse (alineadas y sin isla en
// medio) y qué parejas de esos pares se cortarían entre sí. Todo lo demás
// del solver trabaja sobre estos índices, no sobre coordenadas.
export function construirPares({ rows, cols, islands }) {
  const pares = [];

  const porFila = new Map();
  const porColumna = new Map();
  islands.forEach((isla, idx) => {
    if (!porFila.has(isla.row)) porFila.set(isla.row, []);
    if (!porColumna.has(isla.col)) porColumna.set(isla.col, []);
    porFila.get(isla.row).push(idx);
    porColumna.get(isla.col).push(idx);
  });

  // Dos islas consecutivas en su fila (o columna) son, por definición, las
  // únicas que no tienen otra isla entre medias.
  for (const [row, idxs] of porFila) {
    idxs.sort((a, b) => islands[a].col - islands[b].col);
    for (let k = 0; k + 1 < idxs.length; k++) {
      const a = idxs[k], b = idxs[k + 1];
      const celdas = [];
      for (let c = islands[a].col + 1; c < islands[b].col; c++) celdas.push(`${row},${c}`);
      pares.push({ a, b, horizontal: true, celdas });
    }
  }
  for (const [col, idxs] of porColumna) {
    idxs.sort((a, b) => islands[a].row - islands[b].row);
    for (let k = 0; k + 1 < idxs.length; k++) {
      const a = idxs[k], b = idxs[k + 1];
      const celdas = [];
      for (let r = islands[a].row + 1; r < islands[b].row; r++) celdas.push(`${r},${col}`);
      pares.push({ a, b, horizontal: false, celdas });
    }
  }

  // Solo se cruzan pares de orientación distinta: dos paralelos que
  // compartieran tramo tendrían una isla en medio y no serían pares.
  const cruces = [];
  for (let i = 0; i < pares.length; i++) {
    for (let j = i + 1; j < pares.length; j++) {
      if (pares[i].horizontal === pares[j].horizontal) continue;
      const otras = new Set(pares[j].celdas);
      if (pares[i].celdas.some((c) => otras.has(c))) cruces.push([i, j]);
    }
  }

  return { pares, cruces, rows, cols };
}

// --- Solver ---------------------------------------------------------------

// Cuenta soluciones válidas (grados exactos, sin cruces, todo conectado)
// hasta `tope` y devuelve la primera encontrada. Con tope 2 basta para
// distinguir "sin solución" / "única" / "ambigua".
export function solveHashi(puzzle, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 2;
  const islands = puzzle.islands || [];
  if (islands.length < 2) return { soluciones: 0, primera: null };

  const { pares, cruces } = construirPares(puzzle);

  const paresDeIsla = islands.map(() => []);
  pares.forEach((par, p) => {
    paresDeIsla[par.a].push(p);
    paresDeIsla[par.b].push(p);
  });

  const cruzaCon = pares.map(() => []);
  cruces.forEach(([i, j]) => {
    cruzaCon[i].push(j);
    cruzaCon[j].push(i);
  });

  const valor = pares.map(() => -1);       // -1 = sin decidir
  const grado = islands.map((i) => i.grado);
  const deg = islands.map(() => 0);

  let soluciones = 0;
  let primera = null;

  // Un par bloqueado por un cruce ya construido no puede llevar puentes.
  const maxPosible = (p) => (cruzaCon[p].some((q) => valor[q] > 0) ? 0 : MAX_PUENTES_POR_PAR);

  const capacidadRestante = (isla) =>
    paresDeIsla[isla].reduce((acc, p) => (valor[p] === -1 ? acc + maxPosible(p) : acc), 0);

  // Ninguna isla puede haberse pasado de grado ni quedarse sin margen para
  // alcanzarlo con lo que le queda por decidir.
  const viable = () => islands.every((_, i) =>
    deg[i] <= grado[i] && deg[i] + capacidadRestante(i) >= grado[i]);

  function conectado() {
    const vistos = new Set([0]);
    const pila = [0];
    while (pila.length) {
      const cur = pila.pop();
      for (const p of paresDeIsla[cur]) {
        if (valor[p] <= 0) continue;
        const otra = pares[p].a === cur ? pares[p].b : pares[p].a;
        if (!vistos.has(otra)) {
          vistos.add(otra);
          pila.push(otra);
        }
      }
    }
    return vistos.size === islands.length;
  }

  function anotarSolucion() {
    soluciones++;
    if (primera) return;
    primera = pares
      .map((par, p) => ({ a: par.a, b: par.b, count: valor[p] }))
      .filter((b) => b.count > 0)
      .sort((x, y) => x.a - y.a || x.b - y.b);
  }

  // Isla pendiente con menos pares por decidir: el orden que menos ramas abre.
  function siguienteIsla() {
    let mejor = -1, mejorPendientes = Infinity;
    for (let i = 0; i < islands.length; i++) {
      const pendientes = paresDeIsla[i].filter((p) => valor[p] === -1).length;
      if (pendientes > 0 && pendientes < mejorPendientes) {
        mejor = i;
        mejorPendientes = pendientes;
      }
    }
    return mejor;
  }

  function backtrack() {
    if (soluciones >= tope) return;
    const isla = siguienteIsla();
    if (isla === -1) {
      if (islands.every((_, i) => deg[i] === grado[i]) && conectado()) anotarSolucion();
      return;
    }

    const pendientes = paresDeIsla[isla].filter((p) => valor[p] === -1);
    const falta = grado[isla] - deg[isla];

    // Reparte `falta` puentes entre los pares que le quedan a esta isla.
    const asignar = (k, restante) => {
      if (soluciones >= tope) return;
      if (k === pendientes.length) {
        if (restante === 0 && viable()) backtrack();
        return;
      }
      const p = pendientes[k];
      const tope_p = Math.min(maxPosible(p), restante);
      for (let v = 0; v <= tope_p; v++) {
        valor[p] = v;
        deg[pares[p].a] += v;
        deg[pares[p].b] += v;
        if (viable()) asignar(k + 1, restante - v);
        deg[pares[p].a] -= v;
        deg[pares[p].b] -= v;
        valor[p] = -1;
      }
    };

    if (falta >= 0) asignar(0, falta);
  }

  backtrack();
  return { soluciones, primera };
}

export { MAX_PUENTES_POR_PAR, MAX_GRADO };

// --- Generador ------------------------------------------------------------

// PRNG determinista (mulberry32), igual que en el resto de generadores:
// misma semilla -> misma secuencia siempre.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VARIANTES = {
  pequeno: { rows: 7, cols: 7, minIslas: 8, maxIslas: 10 },
  clasico: { rows: 9, cols: 9, minIslas: 12, maxIslas: 16 }
};

const DIRECCIONES = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const MAX_INTENTOS = 400;

// Construye un archipiélago válido por crecimiento: se planta una isla y se
// van colgando islas nuevas de las ya puestas con puentes que no cruzan nada
// ni pisan a nadie. Así la solución existe POR CONSTRUCCIÓN (es la que
// acabamos de dibujar) y solo queda comprobar que no haya otra distinta.
function construirArchipielago(rand, cfg) {
  const { rows, cols, minIslas, maxIslas } = cfg;
  const islas = [];
  const enCelda = new Map();
  const celdaPuente = new Set();
  const puentes = new Map();

  const clave = (r, c) => `${r},${c}`;
  const claveP = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  const plantar = (row, col) => {
    enCelda.set(clave(row, col), islas.length);
    islas.push({ row, col, grado: 0 });
    return islas.length - 1;
  };

  plantar(Math.floor(rand() * rows), Math.floor(rand() * cols));

  const objetivo = minIslas + Math.floor(rand() * (maxIslas - minIslas + 1));
  let fallos = 0;
  while (islas.length < objetivo && fallos < 600) {
    const src = Math.floor(rand() * islas.length);
    const [dr, dc] = DIRECCIONES[Math.floor(rand() * DIRECCIONES.length)];
    const dist = 2 + Math.floor(rand() * 3);
    const row = islas[src].row + dr * dist;
    const col = islas[src].col + dc * dist;

    const camino = [];
    for (let k = 1; k < dist; k++) camino.push(clave(islas[src].row + dr * k, islas[src].col + dc * k));
    const libre = row >= 0 && row < rows && col >= 0 && col < cols &&
      !enCelda.has(clave(row, col)) && !celdaPuente.has(clave(row, col)) &&
      camino.every((c) => !enCelda.has(c) && !celdaPuente.has(c));
    if (!libre) {
      fallos++;
      continue;
    }

    const count = rand() < 0.35 ? 2 : 1;
    if (islas[src].grado + count > MAX_GRADO) {
      fallos++;
      continue;
    }

    const dst = plantar(row, col);
    puentes.set(claveP(src, dst), count);
    camino.forEach((c) => celdaPuente.add(c));
    islas[src].grado += count;
    islas[dst].grado += count;
  }

  if (islas.length < minIslas) return null;

  // Segunda pasada: cerrar algún ciclo y doblar algún puente. Un árbol de
  // puentes simples se resuelve casi solo; los ciclos son los que obligan a
  // razonar.
  const { pares } = construirPares({ rows, cols, islands: islas });
  const orden = pares.map((p, i) => i);
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  for (const idx of orden) {
    const par = pares[idx];
    const key = claveP(par.a, par.b);
    const actual = puentes.get(key) || 0;
    const cabe = islas[par.a].grado < MAX_GRADO && islas[par.b].grado < MAX_GRADO;
    if (!cabe) continue;

    if (actual === 1) {
      if (rand() < 0.25) {
        puentes.set(key, 2);
        islas[par.a].grado++;
        islas[par.b].grado++;
      }
    } else if (actual === 0 && rand() < 0.45) {
      if (par.celdas.some((c) => celdaPuente.has(c))) continue;
      puentes.set(key, 1);
      par.celdas.forEach((c) => celdaPuente.add(c));
      islas[par.a].grado++;
      islas[par.b].grado++;
    }
  }

  if (islas.some((i) => i.grado === 0)) return null;

  // Ordenar por posición para que el JSON no dependa del orden de plantado.
  const orden2 = islas.map((_, i) => i)
    .sort((x, y) => islas[x].row - islas[y].row || islas[x].col - islas[y].col);
  const nuevoIndice = new Map(orden2.map((viejo, nuevo) => [viejo, nuevo]));
  const islands = orden2.map((i) => ({ ...islas[i] }));
  const listaPuentes = [...puentes.entries()]
    .map(([key, count]) => {
      const [i, j] = key.split('-').map(Number);
      const a = nuevoIndice.get(i), b = nuevoIndice.get(j);
      return { a: Math.min(a, b), b: Math.max(a, b), count };
    })
    .sort((x, y) => x.a - y.a || x.b - y.b);

  return { rows, cols, islands, puentes: listaPuentes };
}

// Elige variante y puzzle de forma determinista a partir del seed de fecha.
// Reintenta hasta dar con uno de solución ÚNICA: el estándar del Hashi.
// El eje se sortea con el PRNG, NO con aritmética sobre el seed.
//
// `selectTemplate` es `templates[seed % 12]`, así que este tipo solo recibe
// una clase módulo 12. Dentro de ella, `seed % n` es constante para todo n
// divisor de 12 -- y también lo es `Math.floor(seed / k) % 2`, porque los
// seeds se diferencian en múltiplos de 12. Así el tipo publicaba SIEMPRE la
// misma variante, con las otras escritas y ninguna alcanzable.
function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

// VARIANTES (arriba) es el mapa de configuraciones; esto es solo la lista de
// nombres, que es lo que se sortea.
export const NOMBRES_VARIANTE = Object.keys(VARIANTES);

export function varianteDeSeed(seed) {
  return eligeEje(NOMBRES_VARIANTE, seed, 0x71b3d40f);
}

export function buildHashiPuzzle(seed) {
  const variant = varianteDeSeed(seed);
  const cfg = VARIANTES[variant];

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 7919) >>> 0);
    const cand = construirArchipielago(rand, cfg);
    if (!cand) continue;

    // Un archipiélago sin dobles ni ciclos es un árbol de puentes simples:
    // demasiado plano para un reto diario.
    const hayDoble = cand.puentes.some((p) => p.count === 2);
    const hayCiclo = cand.puentes.length >= cand.islands.length;
    if (!hayDoble && !hayCiclo) continue;

    const res = solveHashi({ rows: cand.rows, cols: cand.cols, islands: cand.islands }, { tope: 2 });
    if (res.soluciones !== 1) continue;

    const total = cand.puentes.reduce((acc, p) => acc + p.count, 0);
    return {
      variant,
      rows: cand.rows,
      cols: cand.cols,
      islands: cand.islands,
      dificultad: variant === 'pequeno' ? 2 : (cand.islands.length >= 15 ? 4 : 3),
      solucion: { puentes: cand.puentes, total },
      intentos: intento + 1
    };
  }

  throw new Error(`No se pudo generar un puzzle de hashi único para seed=${seed}`);
}

// --- Pistas ---------------------------------------------------------------

// Tres pistas en escalera: por dónde empezar, qué regla desatasca el medio
// y qué comprobar al final. Se derivan del puzzle concreto, nunca son texto
// fijo.
export function buildHashiHints(config, solucion) {
  const { rows, cols, islands } = config;
  const { pares } = construirPares({ rows, cols, islands });

  const vecinos = islands.map(() => 0);
  pares.forEach((par) => { vecinos[par.a]++; vecinos[par.b]++; });

  // Mejor arranque: un chip saturado (su grado agota la capacidad de todos
  // sus vecinos), porque sus puentes se colocan sin pensar. Si no hay
  // ninguno, se señala el chip de mayor grado, que es el más restringido.
  const saturadas = islands
    .map((isla, idx) => ({ isla, idx }))
    .filter(({ isla, idx }) => vecinos[idx] > 0 && isla.grado === 2 * vecinos[idx]);
  const elegida = saturadas.length
    ? saturadas.reduce((mejor, cur) => (cur.isla.grado > mejor.isla.grado ? cur : mejor))
    : islands.map((isla, idx) => ({ isla, idx }))
        .reduce((mejor, cur) => (cur.isla.grado > mejor.isla.grado ? cur : mejor));

  const donde = `fila ${elegida.isla.row + 1}, columna ${elegida.isla.col + 1}`;
  const n = vecinos[elegida.idx];

  const primera = saturadas.length
    ? `Empieza por el chip de ${elegida.isla.grado} de la ${donde}: solo tiene ${n} ${n === 1 ? 'vecino alineado' : 'vecinos alineados'}, ` +
      `así que necesita el máximo con ${n === 1 ? 'él' : 'todos ellos'} y sus cables son dobles sin más que mirarlo.`
    : `Empieza por el chip de ${elegida.isla.grado} de la ${donde}: es el de grado más alto del tablero y con ${n} ${n === 1 ? 'vecino' : 'vecinos'} ` +
      `le queda muy poco margen, así que casi todos sus cables están decididos de entrada.`;

  const dobles = solucion.puentes.filter((p) => p.count === 2).length;
  const segunda = `En total hay que tender ${solucion.total} cables, de los cuales ${dobles} ${dobles === 1 ? 'es doble' : 'son dobles'}. ` +
    'Cuando dudes, mira los cruces: si un cable vertical tapa el paso a uno horizontal, uno de los dos sobra, y muchas veces eso decide el otro.';

  const tercera = 'Que cuadren todos los números no basta: al final todos los chips tienen que quedar unidos en una sola red. ' +
    'Si te salen dos grupos separados con las cuentas correctas, hay que deshacer algún cable doble y repartirlo hacia el otro grupo.';

  return [primera, segunda, tercera];
}
