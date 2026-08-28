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

export const COLORES = ['neutro', 'azul', 'rojo', 'magenta'];

// 0 = vacio, 1..4 espejos, 5 prisma, 6 condensador.
export const PIEZA = {
  VACIO: 0, SLASH: 1, BACKSLASH: 2, VERT: 3, HORIZ: 4, PRISMA: 5, CONDENSADOR: 6
};

// En clasico el jugador solo tiene espejos: si la busqueda de minimos pudiera
// usar prisma ahi, anunciaria un par que el jugador no puede alcanzar.
export function tiposDisponibles(modo) {
  return modo === 'clasico'
    ? [PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ]
    : [PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ, PIEZA.PRISMA, PIEZA.CONDENSADOR];
}

// Unico sitio que conoce el esquema viejo (`lasers[].target`, sin colores ni
// modo). Todo lo demas -- trazador, generador, validador -- ve solo el nuevo.
// En clasico cada laser recibe un color propio para que la regla de cruce sea
// una sola en los tres modos.
export function normalizaConfig(config) {
  const modo = config.modo || 'clasico';
  // `variant` (el TAMANO: pequeno/medio/grande) viaja intacto: la plantilla lo
  // lee para decidir si traza el rayo sola. No confundirlo con la variante
  // combinada de `varianteDeSeed`, que solo existe para el test de reparto.
  const variant = config.variant;
  if (Array.isArray(config.targets)) {
    return { size: config.size, variant, modo, lasers: config.lasers, targets: config.targets, blocks: config.blocks || [] };
  }
  const lasers = [];
  const targets = [];
  (config.lasers || []).forEach((l, i) => {
    const color = `neutro-${i + 1}`;
    lasers.push({ emitter: { ...l.emitter }, color });
    targets.push({ row: l.target.row, col: l.target.col, color });
  });
  return { size: config.size, variant, modo, lasers, targets, blocks: config.blocks || [] };
}

export function crearPiezas(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

// Primer borde de la celda actual (coordenadas locales 0..1) que cruza el
// rayo siguiendo (dx,dy) desde (lx,ly). Se prueban las 4 aristas del
// cuadrado, sus 2 diagonales y las 2 medianas; por convexidad de cada
// triángulo, el cruce más cercano es siempre una arista real.
//
// Se queda con el mejor candidato a medida que los prueba en vez de meterlos
// todos en una lista y ordenarla: es el bucle mas caliente del trazador --
// la busqueda de minimos lo llama decenas de millones de veces -- y la lista
// costaba nueve objetos y un `sort` por paso de rayo. El orden de las pruebas
// y el `<` estricto reproducen el desempate del `sort` estable que habia
// antes: con dos cruces a la misma distancia gana el que se probo primero.
function siguienteCruce(lx, ly, dx, dy) {
  let mejorK = Infinity, mejorLine = null, mejorX = 0, mejorY = 0;
  const prueba = (k, line, x, y) => {
    if (!(k > EPS) || !(k < mejorK)) return;
    if (x < -EPS || x > 1 + EPS || y < -EPS || y > 1 + EPS) return;
    mejorK = k; mejorLine = line; mejorX = x; mejorY = y;
  };
  if (dy !== 0) {
    let k = (0 - ly) / dy; prueba(k, 'top', lx + k * dx, 0);
    k = (1 - ly) / dy; prueba(k, 'bottom', lx + k * dx, 1);
  }
  if (dx !== 0) {
    let k = (0 - lx) / dx; prueba(k, 'left', 0, ly + k * dy);
    k = (1 - lx) / dx; prueba(k, 'right', 1, ly + k * dy);
  }
  if (dx !== dy) {
    const k = (lx - ly) / (dy - dx);
    prueba(k, 'bs', lx + k * dx, ly + k * dy); // diagonal '\'
  }
  if (dx !== -dy) {
    const k = (1 - lx - ly) / (dx + dy);
    prueba(k, 'fs', lx + k * dx, ly + k * dy); // diagonal '/'
  }
  if (dy !== 0) {
    const k = (0.5 - ly) / dy;
    prueba(k, 'hc', lx + k * dx, 0.5); // espejo plano horizontal
  }
  if (dx !== 0) {
    const k = (0.5 - lx) / dx;
    prueba(k, 'vc', 0.5, ly + k * dy); // espejo plano vertical
  }
  if (mejorLine === null) return undefined;
  return {
    k: mejorK,
    line: mejorLine,
    x: Math.min(1, Math.max(0, mejorX)),
    y: Math.min(1, Math.max(0, mejorY))
  };
}

export const CICLO_DIR = ['right', 'se', 'down', 'sw', 'left', 'nw', 'up', 'ne'];

export function giraDir(dir, pasos) {
  const i = CICLO_DIR.indexOf(dir);
  return CICLO_DIR[(((i + pasos) % 8) + 8) % 8];
}

// Los espejos mandan (dx,dy) a otro de los ocho vectores, asi que siempre hay
// nombre para el vector resultante.
const NOMBRE_DE_VECTOR = new Map(
  Object.entries(DIR_VECTOR).map(([nombre, [x, y]]) => [`${x},${y}`, nombre])
);
const dirDeVector = (dx, dy) => NOMBRE_DE_VECTOR.get(`${dx},${dy}`);

// Arranque desplazado del centro: evita los puntos singulares de las 8
// direcciones. Lo usan el emisor y los hijos de prisma y condensador.
const ARRANQUE = { lx: 0.501, ly: 0.502 };

// Entra un rayo, salen dos: la direccion de entrada girada -45 grados en azul
// y +45 en rojo. La direccion de entrada NO continua recta. Un rayo que ya
// lleva color se corta: dividir dos veces multiplica los tramos sin anadir
// deduccion, y hace crecer el arbol de forma exponencial.
function entraEnPrisma(seg, r, c, dx, dy, pendientes) {
  if (seg.color !== 'neutro' && !seg.color.startsWith('neutro-')) return 'prisma-saturado';
  const entrada = dirDeVector(dx, dy);
  pendientes.push({ row: r, col: c, ...ARRANQUE, dir: giraDir(entrada, -1), color: 'azul' });
  pendientes.push({ row: r, col: c, ...ARRANQUE, dir: giraDir(entrada, 1), color: 'rojo' });
  return 'prisma';
}

// Anota el color que llega. Si ya habia otro DISTINTO, emite un rayo magenta
// en la direccion del ultimo en llegar. Con uno solo, o con dos del mismo
// color, el rayo sigue recto sin cambiar de color.
function entraEnCondensador(seg, r, c, dx, dy, pendientes, llegadas) {
  const clave = `${r},${c}`;
  const previo = llegadas.get(clave);
  const salida = dirDeVector(dx, dy);
  if (previo !== undefined && previo !== seg.color) {
    pendientes.push({ row: r, col: c, ...ARRANQUE, dir: salida, color: 'magenta' });
    return 'condensador-mezcla';
  }
  llegadas.set(clave, seg.color);
  pendientes.push({ row: r, col: c, ...ARRANQUE, dir: salida, color: seg.color });
  return 'condensador';
}

// Traza un laser con geometria real, con lista de trabajo: cada tramo puede
// generar mas tramos (prisma, condensador) que se procesan hasta agotar la
// lista. `puntos` son coordenadas globales para poder dibujar cada tramo
// como una polilinea. `config` debe venir YA normalizada (normalizaConfig).
export function simularHaz(config, piezas, laser) {
  const n = config.size;
  const bloqueadas = new Set(config.blocks.map((b) => `${b.row},${b.col}`));
  const emisores = new Set(config.lasers.map((l) => `${l.emitter.row},${l.emitter.col}`));
  const dianas = new Map(config.targets.map((t) => [`${t.row},${t.col}`, t]));
  const dentro = (r, c) => r >= 0 && r < n && c >= 0 && c < n;

  const tramos = [];
  const pendientes = [{
    row: laser.emitter.row, col: laser.emitter.col,
    lx: ARRANQUE.lx, ly: ARRANQUE.ly,
    dir: laser.emitter.dir, color: laser.color
  }];
  const maxSteps = n * n * 12;
  const maxTramos = 4 * n * n;   // tope global: el punto fijo nunca se cuelga
  const llegadasCondensador = new Map();

  while (pendientes.length && tramos.length < maxTramos) {
    const seg = pendientes.shift();
    let [dx, dy] = DIR_VECTOR[seg.dir];
    let r = seg.row, c = seg.col, lx = seg.lx, ly = seg.ly;
    const squaresPath = [{ row: r, col: c }];
    const puntos = [{ x: c + lx, y: r + ly }];
    let resultado = 'bucle';

    for (let step = 0; step < maxSteps; step++) {
      const hit = siguienteCruce(lx, ly, dx, dy);
      if (!hit) break;

      if (hit.line === 'bs' || hit.line === 'fs' || hit.line === 'hc' || hit.line === 'vc') {
        const m = piezas[r][c];
        const activa = (hit.line === 'bs' && m === PIEZA.BACKSLASH) ||
          (hit.line === 'fs' && m === PIEZA.SLASH) ||
          (hit.line === 'vc' && m === PIEZA.VERT) ||
          (hit.line === 'hc' && m === PIEZA.HORIZ);
        lx = hit.x; ly = hit.y;
        puntos.push({ x: c + lx, y: r + ly });
        if (activa) {
          if (hit.line === 'bs') { const [a, b] = [dy, dx]; dx = a; dy = b; }
          else if (hit.line === 'fs') { const [a, b] = [-dy, -dx]; dx = a; dy = b; }
          else if (hit.line === 'hc') { dy = -dy; }
          else { dx = -dx; }
        }
        continue;
      }

      let nr = r, nc = c, nlx = lx, nly = ly;
      if (hit.line === 'top') { nr = r - 1; nly = 1; nlx = hit.x; }
      else if (hit.line === 'bottom') { nr = r + 1; nly = 0; nlx = hit.x; }
      else if (hit.line === 'left') { nc = c - 1; nlx = 1; nly = hit.y; }
      else if (hit.line === 'right') { nc = c + 1; nlx = 0; nly = hit.y; }

      puntos.push({ x: c + hit.x, y: r + hit.y });
      if (!dentro(nr, nc)) { resultado = 'fuera'; break; }

      const clave = `${nr},${nc}`;
      if (bloqueadas.has(clave)) { resultado = 'bloqueo'; break; }
      // Cualquier emisor, propio o ajeno, absorbe el rayo. Una sola regla.
      if (emisores.has(clave)) {
        squaresPath.push({ row: nr, col: nc });
        puntos.push({ x: nc + 0.5, y: nr + 0.5 });
        resultado = 'emisor';
        break;
      }
      if (dianas.has(clave)) {
        squaresPath.push({ row: nr, col: nc });
        puntos.push({ x: nc + 0.5, y: nr + 0.5 });
        resultado = dianas.get(clave).color === seg.color ? 'diana' : 'diana-ajena';
        break;
      }

      r = nr; c = nc; lx = nlx; ly = nly;
      squaresPath.push({ row: r, col: c });

      const pieza = piezas[r][c];
      if (pieza === PIEZA.PRISMA || pieza === PIEZA.CONDENSADOR) {
        puntos.push({ x: c + 0.5, y: r + 0.5 });
        resultado = pieza === PIEZA.PRISMA
          ? entraEnPrisma(seg, r, c, dx, dy, pendientes)
          : entraEnCondensador(seg, r, c, dx, dy, pendientes, llegadasCondensador);
        break;
      }
    }

    tramos.push({ puntos, color: seg.color, resultado, squaresPath });
  }

  return { tramos };
}

// Traza todos los laseres del reto y aplica la regla de cruce: una celda
// visitada por mas de un tramo es un cruce, salvo si tiene prisma o
// condensador -- que son justamente los sitios donde los rayos se encuentran
// a proposito. En clasico esto es exactamente la regla de hoy ("dos rayos no
// comparten celda").
export function simularTodos(config, piezas) {
  const c = normalizaConfig(config);
  const tramos = c.lasers.flatMap((l) => simularHaz(c, piezas, l).tramos);

  const visitas = new Map();
  tramos.forEach((tramo, idx) => {
    const propias = new Set(tramo.squaresPath.map((p) => `${p.row},${p.col}`));
    propias.forEach((clave) => {
      if (!visitas.has(clave)) visitas.set(clave, new Set());
      visitas.get(clave).add(idx);
    });
  });
  const cruces = new Set();
  for (const [clave, quienes] of visitas) {
    if (quienes.size < 2) continue;
    const [row, col] = clave.split(',').map(Number);
    const pieza = piezas[row][col];
    if (pieza === PIEZA.PRISMA || pieza === PIEZA.CONDENSADOR) continue;
    cruces.add(clave);
  }

  const dianasAlcanzadas = new Set();
  tramos.forEach((t) => {
    if (t.resultado !== 'diana') return;
    const fin = t.squaresPath[t.squaresPath.length - 1];
    dianasAlcanzadas.add(`${fin.row},${fin.col}`);
  });

  return { tramos, cruces, dianasAlcanzadas };
}

// Condición de victoria de la plantilla: todas las dianas alcanzadas por su
// color y sin cruces.
export function resuelto(config, piezas) {
  const c = normalizaConfig(config);
  const { cruces, dianasAlcanzadas } = simularTodos(c, piezas);
  return c.targets.length > 0 && cruces.size === 0 &&
    c.targets.every((t) => dianasAlcanzadas.has(`${t.row},${t.col}`));
}

// --- Búsqueda de soluciones ------------------------------------------------

// Celdas donde el jugador puede poner pieza: ni emisores, ni dianas, ni
// bloques (la plantilla las marca igual en `sinEspejo`). Espera `config`
// normalizado: las dianas se leen de `config.targets`, no de `lasers[].target`.
export function celdasLibres(config) {
  const ocupadas = new Set();
  for (const b of config.blocks || []) ocupadas.add(`${b.row},${b.col}`);
  for (const l of config.lasers || []) {
    ocupadas.add(`${l.emitter.row},${l.emitter.col}`);
  }
  for (const t of config.targets || []) {
    ocupadas.add(`${t.row},${t.col}`);
  }
  const libres = [];
  for (let r = 0; r < config.size; r++) {
    for (let c = 0; c < config.size; c++) {
      if (!ocupadas.has(`${r},${c}`)) libres.push({ row: r, col: c });
    }
  }
  return libres;
}

// Menor número de piezas con el que se puede resolver, probando 0, 1, 2...
// hasta `tope`. Devuelve null si no se resuelve con `tope` piezas o menos.
// Es lo que convierte el "par" del reto en un dato comprobado en vez de en
// el número de piezas que casualmente usó el generador al construirlo.
//
// Poda: en una solución MÍNIMA todas las piezas las toca algún rayo (si no,
// sobraría una y no sería mínima), y la primera que toca cada rayo está por
// fuerza en el trayecto que ese rayo recorre con las piezas ya colocadas.
// Así que en cada nivel solo se prueban las celdas de los trayectos actuales,
// no el tablero entero. El bucle interior recorre `tiposDisponibles(modo)`,
// no un rango fijo: en clásico solo hay espejos en la bandeja, y si la
// búsqueda pudiera usar prisma o condensador anunciaría un par inalcanzable
// para el jugador. `piezasMinimasExhaustivo` conserva la búsqueda sin podar
// y tests/laser comprueba que las dos coinciden.
export function piezasMinimas(config, tope) {
  const sol = resolverPiezas(config, tope);
  return sol === null ? null : sol.piezas.flat().filter(Boolean).length;
}

// Igual que piezasMinimas pero devolviendo la colocación encontrada, para
// poder comprobar de punta a punta que la plantilla da la victoria con ella.
export function resolverPiezas(config, tope) {
  const c = normalizaConfig(config);
  const piezas = crearPiezas(c.size);
  if (resuelto(c, piezas)) return { piezas, total: 0 };

  const libres = new Set(celdasLibres(c).map((x) => `${x.row},${x.col}`));
  const tipos = tiposDisponibles(c.modo);
  // Un tablero descartado con N piezas por colocar se descarta igual llegando
  // a el por otro orden, y la busqueda llega al mismo tablero tantas veces
  // como ordenes tengan sus piezas -- ahi es donde memorizar por
  // (tablero, restantes) ahorra de verdad, dentro de una misma llamada a
  // `buscar(k)`. Entre pasadas de `tope` no hay nada que ahorrar: dentro de
  // una pasada, piezas colocadas + `restantes` vale siempre `k` (`restantes`
  // solo baja de uno en uno desde ese `k`), asi que dos pasadas con `k`
  // distinto nunca comparten un par (tablero, restantes) -- la suma esta
  // atada al `k` de su propia pasada. Solo se memorizan los fallos: el
  // primer exito corta la busqueda.
  const puestas = [];
  const fallidos = new Set();

  const buscar = (restantes) => {
    if (restantes === 0) return resuelto(c, piezas);
    const firma = `${restantes}|${[...puestas].sort().join(' ')}`;
    if (fallidos.has(firma)) return false;

    const { tramos } = simularTodos(c, piezas);
    const vistas = new Set();
    const candidatas = [];
    const recogeDe = (lista) => {
      for (const tramo of lista) {
        for (const { row, col } of tramo.squaresPath) {
          const k = `${row},${col}`;
          if (vistas.has(k) || !libres.has(k) || piezas[row][col] !== PIEZA.VACIO) continue;
          vistas.add(k);
          candidatas.push({ row, col });
        }
      }
    };
    // Primero las celdas de los tramos que TODAVÍA no llegan a su diana --
    // ahí es donde hace falta actuar -- y solo luego las de los que ya la
    // alcanzaron: si hay solución, se encuentra antes. Es una mejora pequeña
    // (medido: un 6% en el caso adversarial de tests/laser/busqueda.test.js),
    // no la que sostiene el tope de tiempo; esa es `siguienteCruce` sin lista
    // de candidatos. Las celdas de los tramos ya resueltos NO se pueden
    // quitar: cuando el tablero falla por un cruce, la pieza que falta puede
    // estar justo en el trayecto del rayo que sí llega a su diana.
    const sinResolver = tramos.filter((t) => t.resultado !== 'diana');
    const resueltos = tramos.filter((t) => t.resultado === 'diana');
    recogeDe(sinResolver);
    recogeDe(resueltos);

    for (const { row, col } of candidatas) {
      for (const tipo of tipos) {
        piezas[row][col] = tipo;
        puestas.push(`${row},${col}:${tipo}`);
        if (buscar(restantes - 1)) return true;
        puestas.pop();
        piezas[row][col] = PIEZA.VACIO;
      }
    }
    fallidos.add(firma);
    return false;
  };

  for (let k = 1; k <= tope; k++) {
    if (buscar(k)) return { piezas: piezas.map((f) => [...f]), total: k };
  }
  return null;
}

// Versión sin podar: prueba todas las combinaciones de celdas libres. Se usa
// solo en los tests, como contraste de la anterior.
export function piezasMinimasExhaustivo(config, tope) {
  const c = normalizaConfig(config);
  const libres = celdasLibres(c);
  const piezas = crearPiezas(c.size);
  const tipos = tiposDisponibles(c.modo);

  if (resuelto(c, piezas)) return 0;

  const buscar = (restantes, desde) => {
    if (restantes === 0) return resuelto(c, piezas);
    for (let i = desde; i <= libres.length - restantes; i++) {
      const { row, col } = libres[i];
      for (const tipo of tipos) {
        piezas[row][col] = tipo;
        if (buscar(restantes - 1, i + 1)) return true;
        piezas[row][col] = PIEZA.VACIO;
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
export const MODOS = ['clasico', 'prisma', 'condensador'];

// La mascara del tamano NO se toca: cambiarla movería de tamaño las fechas ya
// publicadas. El modo lleva la suya propia -- nunca aritmetica sobre el seed.
export function tamanoDeSeed(seed) {
  return eligeEje(VARIANTES, seed, 0x24c7b0e9);
}

export function modoDeSeed(seed) {
  return eligeEje(MODOS, seed, 0x9e3779b1);
}

// Variante COMBINADA: es lo que mira tests/ejes/reparto.test.js, que
// comprueba que ningun eje se ha quedado muerto.
export function varianteDeSeed(seed) {
  return `${tamanoDeSeed(seed)}-${modoDeSeed(seed)}`;
}

const TAMANO = { pequeno: 5, medio: 6, grande: 7 };
const DIRECCIONES = Object.keys(DIR_VECTOR);

const elegir = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// Elige celda y direccion del emisor. La direccion no se elige a ciegas: se
// prueban las ocho y se descartan las que sacan el rayo del tablero en dos
// celdas, que era el 83% de los descartes.
function colocaEmisor(rand, size, piezas, ocupadas = new Set()) {
  const fila = Math.floor(rand() * size), col = Math.floor(rand() * size);
  if (ocupadas.has(`${fila},${col}`)) return null;
  const laser = { emitter: { row: fila, col, dir: 'right' }, color: 'neutro' };
  const base = { size, modo: 'clasico', lasers: [laser], targets: [], blocks: [] };
  const conRecorrido = DIRECCIONES.filter((dir) => {
    laser.emitter.dir = dir;
    return simularHaz(base, piezas, laser).tramos[0].squaresPath.length >= 3;
  });
  if (!conRecorrido.length) return null;
  return { row: fila, col, dir: elegir(rand, conRecorrido) };
}

// Bloques decorativos que ademas cierran caminos alternativos, siempre fuera
// de los trayectos y de los objetos. Es el bucle de hoy, tal cual.
function colocaBloques(rand, size, hecho) {
  const vetadas = new Set();
  hecho.lasers.forEach((l) => vetadas.add(`${l.emitter.row},${l.emitter.col}`));
  hecho.targets.forEach((t) => vetadas.add(`${t.row},${t.col}`));
  const base = { size, modo: hecho.modo, lasers: hecho.lasers, targets: hecho.targets, blocks: [] };
  hecho.lasers.forEach((l) => simularHaz(base, hecho.piezas, l).tramos
    .forEach((t) => t.squaresPath.forEach((p) => vetadas.add(`${p.row},${p.col}`))));

  const blocks = [];
  for (let k = 0; k < size; k++) {
    const r = Math.floor(rand() * size), c = Math.floor(rand() * size);
    if (vetadas.has(`${r},${c}`) || hecho.piezas[r][c] !== PIEZA.VACIO) continue;
    if (blocks.some((b) => b.row === r && b.col === c)) continue;
    blocks.push({ row: r, col: c });
    if (blocks.length === 2) break;
  }
  return blocks;
}

// Un laser con sus espejos, en construccion inversa: se coloca el emisor, se
// ponen espejos en su camino y la diana se planta donde el rayo termina. Es
// el cuerpo de `construirLaser` de hoy, reescrito sobre `colocaEmisor` y sin
// la parte de bloques (que ahora hace `colocaBloques` una vez, no por laser).
// `vetadas` son las celdas -- emisor, diana o camino -- que ya usa OTRO
// laser; se pasan tal cual a `colocaEmisor` porque para elegir emisor da
// igual el motivo por el que una celda esta prohibida.
function construirUnLaser(rand, size, piezas, vetadas, maxEspejos, color) {
  const emisor = colocaEmisor(rand, size, piezas, vetadas);
  if (!emisor) return null;
  const laser = { emitter: emisor, color };
  const base = { size, modo: 'clasico', lasers: [laser], targets: [], blocks: [] };

  const puestos = [];
  const cuantos = 1 + Math.floor(rand() * maxEspejos);
  for (let k = 0; k < cuantos; k++) {
    const { squaresPath } = simularHaz(base, piezas, laser).tramos[0];
    // Se evita la celda del emisor y las que ya usa otro rayo.
    const candidatas = squaresPath.slice(1).filter(({ row, col: c }) =>
      !vetadas.has(`${row},${c}`) && piezas[row][c] === PIEZA.VACIO);
    if (!candidatas.length) break;
    const celda = elegir(rand, candidatas);
    piezas[celda.row][celda.col] = elegir(rand, [PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ]);
    puestos.push(celda);
  }
  if (!puestos.length) return null;

  const { squaresPath } = simularHaz(base, piezas, laser).tramos[0];
  if (squaresPath.length < 4) return null;

  const fin = squaresPath[squaresPath.length - 1];
  if (vetadas.has(`${fin.row},${fin.col}`) || (fin.row === emisor.row && fin.col === emisor.col)) return null;
  if (piezas[fin.row][fin.col] !== PIEZA.VACIO) return null;

  return { laser, target: { row: fin.row, col: fin.col, color }, camino: squaresPath };
}

// Los dos laseres clasicos, cada uno con su color propio (para que la regla
// de cruce distinga "mi diana" de "la diana ajena"), montados sobre
// `construirUnLaser` y `colocaBloques`.
function construirClasico(rand, size) {
  const piezas = crearPiezas(size);
  const vetadas = new Set();
  const lasers = [];
  const targets = [];

  for (let i = 0; i < 2; i++) {
    const hecho = construirUnLaser(rand, size, piezas, vetadas, 2, `neutro-${i + 1}`);
    if (!hecho) return null;
    lasers.push(hecho.laser);
    targets.push(hecho.target);
    vetadas.add(`${hecho.laser.emitter.row},${hecho.laser.emitter.col}`);
    vetadas.add(`${hecho.target.row},${hecho.target.col}`);
    // El rayo ya trazado puede dejar huerfano un espejo de un laser anterior
    // (uno que giraba antes de llegar a el, tras colocar uno posterior): ese
    // espejo no esta en `camino` y por tanto no entra en `vetadas`. Por eso
    // la comprobacion de que ningun espejo pisa un emisor o diana se hace
    // aparte, al final, sobre el tablero completo -- ver mas abajo.
    hecho.camino.forEach(({ row, col }) => vetadas.add(`${row},${col}`));
  }

  // Ningun espejo -- ni el huerfano de arriba -- puede acabar en la celda de
  // un emisor o una diana: `celdasLibres` las excluye, asi que la busqueda de
  // minimos nunca podria reproducir esa pieza y el par anunciado quedaria mal.
  const ocupadas = [...lasers.map((l) => l.emitter), ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  return { modo: 'clasico', size, lasers, targets, piezas };
}

// Construccion inversa, igual que en clasico: se colocan las piezas, se traza
// con el trazador de verdad y las dianas se plantan donde acaban los rayos.
// Asi la solucion existe por construccion.
function construirPrisma(rand, size) {
  const piezas = crearPiezas(size);
  const emisor = colocaEmisor(rand, size, piezas);          // reusa la logica de clasico
  if (!emisor) return null;
  const laser = { emitter: emisor, color: 'neutro' };
  const base = { size, modo: 'prisma', lasers: [laser], targets: [], blocks: [] };

  // El prisma va en el tronco, nunca en la celda del emisor.
  const tronco = simularHaz(base, piezas, laser).tramos[0].squaresPath.slice(1);
  if (!tronco.length) return null;
  const sitio = elegir(rand, tronco);
  piezas[sitio.row][sitio.col] = PIEZA.PRISMA;

  // Un espejo opcional en el camino de cada hijo, para que no sean dos rectas.
  for (let k = 0; k < 2; k++) {
    const hijos = simularHaz(base, piezas, laser).tramos.filter((t) => t.color !== 'neutro');
    if (hijos.length < 2) return null;
    const hijo = hijos[k];
    const libres = hijo.squaresPath.slice(1).filter((p) => piezas[p.row][p.col] === PIEZA.VACIO);
    if (!libres.length || rand() < 0.3) continue;
    const celda = elegir(rand, libres);
    piezas[celda.row][celda.col] = elegir(rand, [PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ]);
  }

  const hijos = simularHaz(base, piezas, laser).tramos.filter((t) => t.color !== 'neutro');
  if (hijos.length !== 2) return null;
  const targets = hijos.map((h) => {
    const fin = h.squaresPath[h.squaresPath.length - 1];
    return { row: fin.row, col: fin.col, color: h.color };
  });
  if (targets[0].row === targets[1].row && targets[0].col === targets[1].col) return null;
  if (targets.some((t) => piezas[t.row][t.col] !== PIEZA.VACIO)) return null;
  if (targets.some((t) => t.row === emisor.row && t.col === emisor.col)) return null;

  // Igual que en clasico: ninguna pieza -- ni siquiera una que llegara a
  // sobrevivir hasta aqui por otro camino -- puede acabar sobre el emisor.
  // La razon no es "el emisor nunca esta en un squaresPath.slice(1)": un
  // hijo puede terminar EN el emisor (cualquier emisor absorbe cualquier
  // rayo, ver simularHaz), lo que pone esa celda al FINAL de su camino, no
  // al principio, y ahi si se muestrean candidatas de espejo. Se comprueba
  // aparte, sobre el tablero completo, en vez de fiarse de por-donde-viene
  // cada pieza.
  const ocupadas = [emisor, ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  return { modo: 'prisma', size, lasers: [laser], targets, piezas };
}

// Como prisma, pero los dos hijos se llevan a una celda comun donde va el
// condensador; el rayo magenta que sale de ahi termina en la unica diana.
function construirCondensador(rand, size) {
  const previo = construirPrisma(rand, size);
  if (!previo) return null;
  const { lasers, piezas } = previo;
  const base = { size, modo: 'condensador', lasers, targets: [], blocks: [] };

  const hijos = simularHaz(base, piezas, lasers[0]).tramos.filter((t) => t.color !== 'neutro');
  if (hijos.length !== 2) return null;
  const enAzul = new Set(hijos[0].squaresPath.map((p) => `${p.row},${p.col}`));
  const comunes = hijos[1].squaresPath.filter((p) =>
    enAzul.has(`${p.row},${p.col}`) && piezas[p.row][p.col] === PIEZA.VACIO);
  if (!comunes.length) return null;                  // sin celda comun, se descarta
  const sitio = elegir(rand, comunes);
  piezas[sitio.row][sitio.col] = PIEZA.CONDENSADOR;

  const magenta = simularHaz(base, piezas, lasers[0]).tramos.find((t) => t.color === 'magenta');
  if (!magenta) return null;
  const fin = magenta.squaresPath[magenta.squaresPath.length - 1];
  if (piezas[fin.row][fin.col] !== PIEZA.VACIO) return null;
  if (fin.row === lasers[0].emitter.row && fin.col === lasers[0].emitter.col) return null;
  const targets = [{ row: fin.row, col: fin.col, color: 'magenta' }];

  // Misma guarda que en prisma/clasico: el condensador se coloca en una
  // celda comun a los dos hijos (ver `comunes` arriba), lo que puede volver
  // a dejar huerfano un espejo que antes estaba en el camino de alguno de
  // ellos. Se comprueba sobre el tablero completo, no confiando en de-donde
  // vino cada pieza.
  const ocupadas = [lasers[0].emitter, ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  return { modo: 'condensador', size, lasers, targets, piezas };
}

// Cuantos intentos de seed (mulberry32(seed + intento*15485863)) hacen falta
// para que cada modo encuentre un reto valido. Medido barriendo seed=1..300
// (ver informe de la Task 7): clasico necesita en media 123.6 intentos (max
// 553 en ese barrido); prisma 13.6 (max 70); condensador -- que exige que
// los dos hijos del prisma compartan una celda libre, con mucho el mas
// exigente -- 335.8 (max 1300). Con 600 fallaban 13 de los 89 seeds de
// condensador; 2000 deja los tres modos en cero fallos sobre esos 300 seeds,
// con margen sobre el maximo observado.
const MAX_INTENTOS = 2000;

export function buildLaserPuzzle(seed) {
  const variant = tamanoDeSeed(seed);
  const modo = modoDeSeed(seed);
  const size = TAMANO[variant];
  const construir = { clasico: construirClasico, prisma: construirPrisma, condensador: construirCondensador }[modo];

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 15485863) >>> 0);
    const hecho = construir(rand, size);
    if (!hecho) continue;

    const blocks = colocaBloques(rand, size, hecho);      // como hoy: fuera de trayectos y objetos
    const config = { size, modo, lasers: hecho.lasers, targets: hecho.targets, blocks };
    const total = hecho.piezas.flat().filter(Boolean).length;
    if (total < 2 || total > 4) continue;

    if (resuelto(config, crearPiezas(size))) continue;     // no puede venir resuelto
    if (!resuelto(config, hecho.piezas)) continue;         // la solucion tiene que valer
    if (piezasMinimas(config, total - 1) !== null) continue; // el par tiene que ser el minimo

    const base = size === 5 ? 2 : (size === 6 ? 3 : 4);
    return {
      variant, modo, size, lasers: hecho.lasers, targets: hecho.targets, blocks,
      min_piezas: total,
      dificultad: Math.min(5, base + (modo === 'clasico' ? 0 : 1)),
      solucion: { piezas: hecho.piezas.map((f) => [...f]) },
      intentos: intento + 1
    };
  }
  throw new Error(`No se pudo generar un reto de laser triangular para seed=${seed}, modo=${modo}`);
}

// --- Pistas ---------------------------------------------------------------

const NOMBRE_DIR = {
  up: 'hacia arriba', down: 'hacia abajo', left: 'hacia la izquierda', right: 'hacia la derecha',
  ne: 'en diagonal hacia arriba y a la derecha', nw: 'en diagonal hacia arriba y a la izquierda',
  se: 'en diagonal hacia abajo y a la derecha', sw: 'en diagonal hacia abajo y a la izquierda'
};

// Tres pistas derivadas del tablero concreto, sin decir en qué celda va cada
// espejo: eso es justo lo que hay que descubrir.
// La segunda pista depende del modo: en clasico habla de los cuatro
// espejos, en prisma y condensador de las piezas que solo existen ahi.
const SEGUNDA_PISTA = {
  clasico: 'Los cuatro espejos no hacen lo mismo: las diagonales / y \\ desvian el rayo 90 grados cuando le llegan de frente, y los planos | y — lo devuelven por donde vino. Un rayo que llega paralelo a un espejo lo atraviesa sin enterarse.',
  prisma: 'El prisma parte el rayo en dos: uno sale 45 grados a la izquierda en azul y otro 45 grados a la derecha en rojo, y la direccion de entrada no continua recta. Cada diana solo la enciende un rayo de su color, asi que lo primero es decidir por donde entra el rayo al prisma.',
  condensador: 'Aqui hacen falta las dos piezas: el prisma parte el rayo en azul y rojo, y el condensador los vuelve a juntar en magenta, que es el color de la unica diana. Los dos rayos tienen que llegar a la misma celda, y solo esa celda puede compartirla dos rayos.'
};

export function buildLaserHints(puzzle) {
  const { size, modo, lasers, targets, blocks, min_piezas } = puzzle;
  const config = { size, modo, lasers, targets, blocks };

  // Se traza sin piezas para poder contar por dónde va cada rayo "de fábrica".
  const { tramos } = simularTodos(config, crearPiezas(size));
  const idx = tramos.findIndex((t) => t.resultado !== 'diana');
  const i = idx === -1 ? 0 : idx;
  // lasers[i] indexado por indice de TRAMO, no de laser: vale porque en un
  // tablero vacio (sin piezas, como aqui) cada laser produce exactamente un
  // tramo, asi que los dos indices coinciden. Dejaria de valer si algun dia
  // se pidiera esto sobre un tablero con piezas ya puestas.
  const laser = lasers[i];
  const recorrido = tramos[i].squaresPath.length;

  const primera = `Empieza por el emisor de la fila ${laser.emitter.row + 1}, columna ${laser.emitter.col + 1}, que dispara ${NOMBRE_DIR[laser.emitter.dir]}: ` +
    `tal cual está el tablero recorre ${recorrido} celda${recorrido === 1 ? '' : 's'} y ${tramos[i].resultado === 'fuera' ? 'se sale del tablero' : 'se queda cortado'}. ` +
    'Mira dónde tendría que torcer para acabar en su diana.';

  const segunda = SEGUNDA_PISTA[modo];

  const tercera = `Bastan ${min_piezas} piezas bien puestas: si necesitas más, seguramente estás corrigiendo un rayo que ya iba bien. ` +
    'Y ojo, que los rayos no pueden cruzarse fuera del prisma o el condensador: si comparten una celda que no sea una de esas dos piezas, el reto no se da por resuelto aunque todo llegue a su diana.';

  return [primera, segunda, tercera];
}
