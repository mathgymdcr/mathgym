// ===== scripts/laser-triangular-logic.js =====
// Trazador de rayos sobre malla triangular, extraído de
// plantillas/laser_triangular.js para que el juego, el generador y el
// validador usen EXACTAMENTE el mismo código. Con dos copias del trazador,
// cualquier diferencia -- un signo, un epsilon -- significaría publicar un
// reto imposible el día que tocara.
//
// Cada celda del tablero se trata como 4 triángulos (sus dos diagonales
// completas), así que el rayo puede entrar y salir por cualquiera de las 8
// direcciones. Espejos por celda: 0 = vacío, 1 = '/', 2 = '\', 3 = '|'
// (vertical), 4 = '—' (horizontal). Un rayo que llega paralelo al espejo
// activo lo atraviesa; si llega perpendicular, rebota.

export const DIR_VECTOR = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1]
};

const EPS = 1e-9;

export function crearEspejos(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

// Primer borde de la celda actual (coordenadas locales 0..1) que cruza el
// rayo siguiendo (dx,dy) desde (lx,ly). Se prueban las 4 aristas del
// cuadrado, sus 2 diagonales y las 2 medianas; por convexidad de cada
// triángulo, el cruce más cercano es siempre una arista real.
function siguienteCruce(lx, ly, dx, dy) {
  const candidatos = [];
  const add = (k, line, x, y) => {
    if (k > EPS && x >= -EPS && x <= 1 + EPS && y >= -EPS && y <= 1 + EPS) {
      candidatos.push({ k, line, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    }
  };
  if (dy !== 0) {
    let k = (0 - ly) / dy; add(k, 'top', lx + k * dx, 0);
    k = (1 - ly) / dy; add(k, 'bottom', lx + k * dx, 1);
  }
  if (dx !== 0) {
    let k = (0 - lx) / dx; add(k, 'left', 0, ly + k * dy);
    k = (1 - lx) / dx; add(k, 'right', 1, ly + k * dy);
  }
  if (dx !== dy) {
    const k = (lx - ly) / (dy - dx);
    add(k, 'bs', lx + k * dx, ly + k * dy); // diagonal '\'
  }
  if (dx !== -dy) {
    const k = (1 - lx - ly) / (dx + dy);
    add(k, 'fs', lx + k * dx, ly + k * dy); // diagonal '/'
  }
  if (dy !== 0) {
    const k = (0.5 - ly) / dy;
    add(k, 'hc', lx + k * dx, 0.5); // espejo plano horizontal
  }
  if (dx !== 0) {
    const k = (0.5 - lx) / dx;
    add(k, 'vc', 0.5, ly + k * dy); // espejo plano vertical
  }
  candidatos.sort((a, b) => a.k - b.k);
  return candidatos[0];
}

// Traza un láser celda a celda con geometría real. `puntos` son coordenadas
// globales para poder dibujar cada tramo como una recta.
export function simularLaser(config, espejos, laser) {
  const n = config.size;
  const bloqueadas = new Set((config.blocks || []).map((b) => `${b.row},${b.col}`));
  const dentro = (r, c) => r >= 0 && r < n && c >= 0 && c < n;
  const esObjetoAjeno = (r, c) => (config.lasers || []).some((l) => l !== laser && (
    (l.emitter.row === r && l.emitter.col === c) || (l.target.row === r && l.target.col === c)
  ));

  let [dx, dy] = DIR_VECTOR[laser.emitter.dir];
  let r = laser.emitter.row, c = laser.emitter.col;
  // Arranque desplazado del centro: evita los puntos singulares de las 8 direcciones.
  let lx = 0.501, ly = 0.502;
  const squaresPath = [{ row: r, col: c }];
  const puntos = [{ x: c + lx, y: r + ly }];
  const maxSteps = n * n * 12;

  for (let step = 0; step < maxSteps; step++) {
    const hit = siguienteCruce(lx, ly, dx, dy);
    if (!hit) return { squaresPath, puntos, resultado: 'bucle' };

    if (hit.line === 'bs' || hit.line === 'fs' || hit.line === 'hc' || hit.line === 'vc') {
      const m = espejos[r][c];
      const activa = (hit.line === 'bs' && m === 2) || (hit.line === 'fs' && m === 1) ||
        (hit.line === 'vc' && m === 3) || (hit.line === 'hc' && m === 4);
      lx = hit.x; ly = hit.y;
      puntos.push({ x: c + lx, y: r + ly });
      if (activa) {
        if (hit.line === 'bs') { const [ndx, ndy] = [dy, dx]; dx = ndx; dy = ndy; }
        else if (hit.line === 'fs') { const [ndx, ndy] = [-dy, -dx]; dx = ndx; dy = ndy; }
        else if (hit.line === 'hc') { dy = -dy; }
        else { dx = -dx; } // vc
      }
      continue;
    }

    let nr = r, nc = c, nlx = lx, nly = ly;
    if (hit.line === 'top') { nr = r - 1; nly = 1; nlx = hit.x; }
    else if (hit.line === 'bottom') { nr = r + 1; nly = 0; nlx = hit.x; }
    else if (hit.line === 'left') { nc = c - 1; nlx = 1; nly = hit.y; }
    else if (hit.line === 'right') { nc = c + 1; nlx = 0; nly = hit.y; }

    puntos.push({ x: c + hit.x, y: r + hit.y });
    if (!dentro(nr, nc)) return { squaresPath, puntos, resultado: 'fuera' };
    if (bloqueadas.has(`${nr},${nc}`)) return { squaresPath, puntos, resultado: 'bloqueo' };
    if (nr === laser.target.row && nc === laser.target.col) {
      squaresPath.push({ row: nr, col: nc });
      puntos.push({ x: nc + 0.5, y: nr + 0.5 });
      return { squaresPath, puntos, resultado: 'diana' };
    }
    if (esObjetoAjeno(nr, nc)) return { squaresPath, puntos, resultado: 'obstaculo' };
    r = nr; c = nc; lx = nlx; ly = nly;
    squaresPath.push({ row: r, col: c });
  }
  return { squaresPath, puntos, resultado: 'bucle' };
}

// Traza todos los láseres y marca las celdas por las que pasa más de uno:
// los rayos no pueden cruzarse.
export function simularTodos(config, espejos) {
  const resultados = (config.lasers || []).map((l) => simularLaser(config, espejos, l));
  const ocupacion = new Map();
  const cruces = new Set();
  resultados.forEach(({ squaresPath }, idx) => {
    squaresPath.forEach(({ row, col }) => {
      const key = `${row},${col}`;
      const previo = ocupacion.get(key);
      if (previo !== undefined && previo !== idx) cruces.add(key);
      ocupacion.set(key, idx);
    });
  });
  return { resultados, cruces };
}

// Condición de victoria de la plantilla: todos en su diana y sin cruces.
export function resuelto(config, espejos) {
  const { resultados, cruces } = simularTodos(config, espejos);
  return resultados.length > 0 && resultados.every((r) => r.resultado === 'diana') && cruces.size === 0;
}

// --- Búsqueda de soluciones ------------------------------------------------

// Celdas donde el jugador puede poner espejo: ni emisores, ni dianas, ni
// bloques (la plantilla las marca igual en `sinEspejo`).
export function celdasLibres(config) {
  const ocupadas = new Set();
  for (const b of config.blocks || []) ocupadas.add(`${b.row},${b.col}`);
  for (const l of config.lasers || []) {
    ocupadas.add(`${l.emitter.row},${l.emitter.col}`);
    ocupadas.add(`${l.target.row},${l.target.col}`);
  }
  const libres = [];
  for (let r = 0; r < config.size; r++) {
    for (let c = 0; c < config.size; c++) {
      if (!ocupadas.has(`${r},${c}`)) libres.push({ row: r, col: c });
    }
  }
  return libres;
}

// Menor número de espejos con el que se puede resolver, probando 0, 1, 2...
// hasta `tope`. Devuelve null si no se resuelve con `tope` espejos o menos.
// Es lo que convierte el "par" del reto en un dato comprobado en vez de en
// el número de espejos que casualmente usó el generador al construirlo.
//
// Poda: en una solución MÍNIMA todos los espejos los toca algún rayo (si no,
// sobraría uno y no sería mínima), y el primero que toca cada rayo está por
// fuerza en el trayecto que ese rayo recorre con los espejos ya colocados.
// Así que en cada nivel solo se prueban las celdas de los trayectos actuales,
// no el tablero entero. `espejosMinimosExhaustivo` conserva la búsqueda sin
// podar y tests/laser comprueba que las dos coinciden.
export function espejosMinimos(config, tope) {
  const sol = resolverEspejos(config, tope);
  return sol === null ? null : sol.espejos.flat().filter(Boolean).length;
}

// Igual que espejosMinimos pero devolviendo la colocación encontrada, para
// poder comprobar de punta a punta que la plantilla da la victoria con ella.
export function resolverEspejos(config, tope) {
  const espejos = crearEspejos(config.size);
  if (resuelto(config, espejos)) return { espejos, total: 0 };

  const libres = new Set(celdasLibres(config).map((c) => `${c.row},${c.col}`));

  const buscar = (restantes) => {
    if (restantes === 0) return resuelto(config, espejos);

    const { resultados } = simularTodos(config, espejos);
    const vistas = new Set();
    const candidatas = [];
    for (const res of resultados) {
      for (const { row, col } of res.squaresPath) {
        const k = `${row},${col}`;
        if (vistas.has(k) || !libres.has(k) || espejos[row][col] !== 0) continue;
        vistas.add(k);
        candidatas.push({ row, col });
      }
    }

    for (const { row, col } of candidatas) {
      for (let tipo = 1; tipo <= 4; tipo++) {
        espejos[row][col] = tipo;
        if (buscar(restantes - 1)) return true;
        espejos[row][col] = 0;
      }
    }
    return false;
  };

  for (let k = 1; k <= tope; k++) {
    if (buscar(k)) return { espejos: espejos.map((f) => [...f]), total: k };
  }
  return null;
}

// Versión sin podar: prueba todas las combinaciones de celdas libres. Se usa
// solo en los tests, como contraste de la anterior.
export function espejosMinimosExhaustivo(config, tope) {
  const libres = celdasLibres(config);
  const espejos = crearEspejos(config.size);

  if (resuelto(config, espejos)) return 0;

  const buscar = (restantes, desde) => {
    if (restantes === 0) return resuelto(config, espejos);
    for (let i = desde; i <= libres.length - restantes; i++) {
      const { row, col } = libres[i];
      for (let tipo = 1; tipo <= 4; tipo++) {
        espejos[row][col] = tipo;
        if (buscar(restantes - 1, i + 1)) return true;
        espejos[row][col] = 0;
      }
    }
    return false;
  };

  for (let k = 1; k <= tope; k++) {
    if (buscar(k, 0)) return k;
  }
  return null;
}

// --- Generador ------------------------------------------------------------

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

// El eje se sortea con el PRNG, NO con aritmética sobre el seed.
//
// `selectTemplate` es `templates[seed % 12]`, así que este tipo solo recibe
// una clase módulo 12. Dentro de ella, `seed % 3` es constante -- y también
// lo es `Math.floor(seed / k) % 2`, porque los seeds se diferencian en
// múltiplos de 12. Con `VARIANTES[seed % 3]` el tipo publicaba SIEMPRE la
// misma variante y las otras dos no eran alcanzables desde ninguna fecha.
function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

export const VARIANTES = ['pequeno', 'medio', 'grande'];

export function varianteDeSeed(seed) {
  return eligeEje(VARIANTES, seed, 0x24c7b0e9);
}
const TAMANO = { pequeno: 5, medio: 6, grande: 7 };
const DIRECCIONES = Object.keys(DIR_VECTOR);
const MAX_INTENTOS = 600;

const elegir = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// Construcción inversa: se coloca el emisor, se ponen espejos y se traza el
// rayo con el trazador de verdad; la diana se planta donde el rayo acaba.
// Así la solución existe por construcción y es la que el jugador tiene que
// reencontrar.
function construirLaser(rand, size, espejos, ocupadas, prohibidas, maxEspejos) {
  const libre = (r, c) => r >= 0 && r < size && c >= 0 && c < size && !ocupadas.has(`${r},${c}`);

  // El emisor tampoco puede caer sobre el trayecto de un rayo ya construido:
  // sería un objeto en medio y lo cortaría, tirando abajo la solución que ya
  // teníamos montada.
  const fila = Math.floor(rand() * size), col = Math.floor(rand() * size);
  if (!libre(fila, col) || prohibidas.has(`${fila},${col}`)) return null;

  // La dirección no se elige a ciegas: se prueban las ocho y se descartan las
  // que sacan el rayo del tablero en dos celdas, que era de lejos el motivo
  // más común de intento fallido (el 83% de los descartes).
  const laser = { emitter: { row: fila, col, dir: 'right' }, target: { row: -1, col: -1 } };
  const conRecorrido = DIRECCIONES.filter((dir) => {
    laser.emitter.dir = dir;
    return simularLaser({ size, lasers: [laser], blocks: [] }, espejos, laser).squaresPath.length >= 3;
  });
  if (!conRecorrido.length) return null;
  laser.emitter.dir = elegir(rand, conRecorrido);

  const puestos = [];
  const cuantos = 1 + Math.floor(rand() * maxEspejos);
  for (let k = 0; k < cuantos; k++) {
    const { squaresPath } = simularLaser({ size, lasers: [laser], blocks: [] }, espejos, laser);
    // Se evita la celda del emisor y las que ya usa otro rayo.
    const candidatas = squaresPath.slice(1).filter(({ row, col: c }) =>
      !ocupadas.has(`${row},${c}`) && !prohibidas.has(`${row},${c}`) && espejos[row][c] === 0);
    if (!candidatas.length) break;
    const celda = elegir(rand, candidatas);
    espejos[celda.row][celda.col] = 1 + Math.floor(rand() * 4);
    puestos.push(celda);
  }
  if (!puestos.length) return null;

  const { squaresPath } = simularLaser({ size, lasers: [laser], blocks: [] }, espejos, laser);
  if (squaresPath.length < 4) return null;

  const fin = squaresPath[squaresPath.length - 1];
  if (!libre(fin.row, fin.col) || (fin.row === fila && fin.col === col)) return null;
  if (prohibidas.has(`${fin.row},${fin.col}`)) return null;   // cortaría el otro rayo
  if (espejos[fin.row][fin.col] !== 0) return null;

  laser.target = { row: fin.row, col: fin.col };
  return { laser, espejos: puestos, camino: squaresPath };
}

export function buildLaserPuzzle(seed) {
  const variant = varianteDeSeed(seed);
  const size = TAMANO[variant];

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 15485863) >>> 0);
    const espejos = crearEspejos(size);
    const ocupadas = new Set();
    const prohibidas = new Set();
    const lasers = [];
    let total = 0;

    let ok = true;
    for (let i = 0; i < 2; i++) {
      const construido = construirLaser(rand, size, espejos, ocupadas, prohibidas, 2);
      if (!construido) { ok = false; break; }
      const { laser, espejos: puestos, camino } = construido;
      lasers.push(laser);
      total += puestos.length;
      ocupadas.add(`${laser.emitter.row},${laser.emitter.col}`);
      ocupadas.add(`${laser.target.row},${laser.target.col}`);
      // El segundo rayo no puede pasar por donde pasa el primero: la
      // plantilla considera cruce cualquier celda compartida.
      camino.forEach(({ row, col }) => prohibidas.add(`${row},${col}`));
    }
    if (!ok || total < 2 || total > 3) continue;

    // Bloques decorativos que además cierran caminos alternativos, siempre
    // fuera de los trayectos y de los objetos.
    const blocks = [];
    for (let intentosBloque = 0; intentosBloque < size; intentosBloque++) {
      const r = Math.floor(rand() * size), c = Math.floor(rand() * size);
      const clave = `${r},${c}`;
      if (ocupadas.has(clave) || prohibidas.has(clave) || espejos[r][c] !== 0) continue;
      if (blocks.some((b) => b.row === r && b.col === c)) continue;
      blocks.push({ row: r, col: c });
      if (blocks.length === 2) break;
    }

    const config = { size, lasers, blocks };
    // Colocar la diana cambió el recorrido (el rayo ahora se detiene ahí) y
    // el segundo rayo pudo alterar el primero: se comprueba de verdad.
    if (!resuelto(config, espejos)) continue;

    // El par solo vale si no hay una solución más corta.
    if (espejosMinimos(config, total - 1) !== null) continue;

    return {
      variant,
      size,
      lasers,
      blocks,
      min_espejos: total,
      dificultad: size === 5 ? 2 : (size === 6 ? 3 : 4),
      solucion: { espejos: espejos.map((f) => [...f]) },
      intentos: intento + 1
    };
  }

  throw new Error(`No se pudo generar un reto de láser triangular para seed=${seed}`);
}

// --- Pistas ---------------------------------------------------------------

const NOMBRE_DIR = {
  up: 'hacia arriba', down: 'hacia abajo', left: 'hacia la izquierda', right: 'hacia la derecha',
  ne: 'en diagonal hacia arriba y a la derecha', nw: 'en diagonal hacia arriba y a la izquierda',
  se: 'en diagonal hacia abajo y a la derecha', sw: 'en diagonal hacia abajo y a la izquierda'
};

// Tres pistas derivadas del tablero concreto, sin decir en qué celda va cada
// espejo: eso es justo lo que hay que descubrir.
export function buildLaserHints(puzzle) {
  const { size, lasers, blocks, min_espejos } = puzzle;
  const config = { size, lasers, blocks };

  // Se traza sin espejos para poder contar por dónde va cada rayo "de fábrica".
  const { resultados } = simularTodos(config, crearEspejos(size));
  const idx = resultados.findIndex((r) => r.resultado !== 'diana');
  const i = idx === -1 ? 0 : idx;
  const laser = lasers[i];
  const recorrido = resultados[i].squaresPath.length;

  const primera = `Empieza por el emisor de la fila ${laser.emitter.row + 1}, columna ${laser.emitter.col + 1}, que dispara ${NOMBRE_DIR[laser.emitter.dir]}: ` +
    `tal cual está el tablero recorre ${recorrido} celda${recorrido === 1 ? '' : 's'} y ${resultados[i].resultado === 'fuera' ? 'se sale del tablero' : 'se queda cortado'}. ` +
    'Mira dónde tendría que torcer para acabar en su diana.';

  const segunda = 'Los cuatro espejos no hacen lo mismo: las diagonales / y \\ desvían el rayo 90 grados cuando le llegan de frente, ' +
    'y los planos | y — lo devuelven por donde vino. Un rayo que llega paralelo a un espejo lo atraviesa sin enterarse, así que la orientación importa tanto como la celda.';

  const tercera = `Bastan ${min_espejos} espejos bien puestos: si necesitas más, seguramente estás corrigiendo un rayo que ya iba bien. ` +
    'Y ojo, que los dos trayectos no pueden cruzarse: si comparten una sola celda, el reto no se da por resuelto aunque los dos lleguen a su diana.';

  return [primera, segunda, tercera];
}
