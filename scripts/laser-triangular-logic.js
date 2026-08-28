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
  // como ordenes tengan sus piezas. La firma vale tambien entre pasadas de
  // `tope`: el tablero determina el subarbol y `restantes` lo que queda de
  // presupuesto, asi que la pasada de tope 3 no re-explora lo que la de 2 ya
  // agoto. Solo se memorizan los fallos: el primer exito corta la busqueda.
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

export function varianteDeSeed(seed) {
  return eligeEje(VARIANTES, seed, 0x24c7b0e9);
}
const TAMANO = { pequeno: 5, medio: 6, grande: 7 };
const DIRECCIONES = Object.keys(DIR_VECTOR);
const MAX_INTENTOS = 600;

const elegir = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// Traza un único láser aislado (sin el resto del tablero todavía construido),
// para explorar direcciones y candidatas durante la construcción del reto.
// Usa el mismo simularHaz que el juego: no hay una segunda implementación de
// trazado. Como el láser va solo en su config, el único tramo que produce es
// el suyo.
function trazaSuelto(size, espejos, laser) {
  const config = normalizaConfig({ size, lasers: [laser], blocks: [] });
  return simularHaz(config, espejos, config.lasers[0]).tramos[0];
}

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
    return trazaSuelto(size, espejos, laser).squaresPath.length >= 3;
  });
  if (!conRecorrido.length) return null;
  laser.emitter.dir = elegir(rand, conRecorrido);

  const puestos = [];
  const cuantos = 1 + Math.floor(rand() * maxEspejos);
  for (let k = 0; k < cuantos; k++) {
    const { squaresPath } = trazaSuelto(size, espejos, laser);
    // Se evita la celda del emisor y las que ya usa otro rayo.
    const candidatas = squaresPath.slice(1).filter(({ row, col: c }) =>
      !ocupadas.has(`${row},${c}`) && !prohibidas.has(`${row},${c}`) && espejos[row][c] === 0);
    if (!candidatas.length) break;
    const celda = elegir(rand, candidatas);
    espejos[celda.row][celda.col] = 1 + Math.floor(rand() * 4);
    puestos.push(celda);
  }
  if (!puestos.length) return null;

  const { squaresPath } = trazaSuelto(size, espejos, laser);
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
    const espejos = crearPiezas(size);
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
    if (piezasMinimas(config, total - 1) !== null) continue;

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
  const { tramos } = simularTodos(config, crearPiezas(size));
  const idx = tramos.findIndex((t) => t.resultado !== 'diana');
  const i = idx === -1 ? 0 : idx;
  const laser = lasers[i];
  const recorrido = tramos[i].squaresPath.length;

  const primera = `Empieza por el emisor de la fila ${laser.emitter.row + 1}, columna ${laser.emitter.col + 1}, que dispara ${NOMBRE_DIR[laser.emitter.dir]}: ` +
    `tal cual está el tablero recorre ${recorrido} celda${recorrido === 1 ? '' : 's'} y ${tramos[i].resultado === 'fuera' ? 'se sale del tablero' : 'se queda cortado'}. ` +
    'Mira dónde tendría que torcer para acabar en su diana.';

  const segunda = 'Los cuatro espejos no hacen lo mismo: las diagonales / y \\ desvían el rayo 90 grados cuando le llegan de frente, ' +
    'y los planos | y — lo devuelven por donde vino. Un rayo que llega paralelo a un espejo lo atraviesa sin enterarse, así que la orientación importa tanto como la celda.';

  const tercera = `Bastan ${min_espejos} espejos bien puestos: si necesitas más, seguramente estás corrigiendo un rayo que ya iba bien. ` +
    'Y ojo, que los dos trayectos no pueden cruzarse: si comparten una sola celda, el reto no se da por resuelto aunque los dos lleguen a su diana.';

  return [primera, segunda, tercera];
}
