// ===== scripts/androides-logic.js =====
// Androides en la Fábrica. Rejilla NxN de salas; cada una tiene DOS
// atributos independientes, sin restricción cruzada entre ellos:
//   - modelo: cuadrado latino (número 1..n, sin repetir en fila ni columna),
//     igual mecánica que fabrica-de-bloques sin regiones.
//   - clase: color libre (sin restricción de fila/columna), con pistas de
//     adyacencia sobre PARES CONCRETOS de salas vecinas ("misma clase" /
//     "distinta clase") y unos pocos dígitos absolutos de clase por celda.
//
// Los dígitos absolutos de clase son imprescindibles, no un adorno: con
// 2+ clases realmente usadas, cualquier PERMUTACIÓN de las etiquetas de
// clase preserva TODOS los hechos relativos entre pares -- son solo
// nombres, no hay "clase 0" objetivamente distinta de "clase 1". Revelar
// solo pares relativos, por muchos que sean, nunca puede dar una solución
// única (confirmado con un prototipo real: con las 12 pistas de un 3x3
// completas seguían saliendo 2 soluciones, exactamente las 2 permutaciones
// supervivientes de las 3! de partida). Hace falta anclar al menos algunos
// puntos absolutos, igual que un dígito dado ancla un cuadrado latino.

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

const TAMANO_OPCIONES = [3, 4];

export function ejesDeSeed(seed) {
  return { tamano: eligeEje(TAMANO_OPCIONES, seed, 0x4e8b2c17) };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

function baraja(array, rng) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ---------- CAPA 1: modelo (cuadrado latino + digitos dados) ----------

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

// dados: Map "f,c" -> digito (los que el jugador ya ve puestos). Backtracking
// celda a celda con poda de fila/columna -- mismo cuadrado latino que
// fabrica-de-bloques, sin regiones que comprobar.
export function contarSolucionesModelo(n, dados, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  const usadoFila = Array.from({ length: n }, () => new Set());
  const usadoCol = Array.from({ length: n }, () => new Set());
  let soluciones = 0;
  let primera = null;

  function rec(k) {
    if (k === n * n) {
      soluciones++;
      if (!primera) primera = grid.map((fila) => [...fila]);
      return soluciones >= tope;
    }
    const f = Math.floor(k / n);
    const c = k % n;
    const fijo = dados.get(`${f},${c}`);
    const candidatos = fijo != null ? [fijo] : Array.from({ length: n }, (_, i) => i + 1);

    for (const v of candidatos) {
      if (usadoFila[f].has(v) || usadoCol[c].has(v)) continue;
      grid[f][c] = v;
      usadoFila[f].add(v); usadoCol[c].add(v);
      if (rec(k + 1)) { usadoFila[f].delete(v); usadoCol[c].delete(v); return true; }
      usadoFila[f].delete(v); usadoCol[c].delete(v);
    }
    return false;
  }
  rec(0);
  return { soluciones, primera };
}

// Empieza revelando TODOS los digitos (la solvencia sale gratis: cada uno
// es el valor real del cuadrado latino) y quita al azar mientras el
// solver siga confirmando unicidad -- mismo patron que fabrica-de-bloques.
export function construyeModelo(n, rng) {
  const solucion = generaCuadradoLatino(n, rng);
  const dados = new Map();
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) dados.set(`${f},${c}`, solucion[f][c]);

  const orden = baraja([...dados.keys()], rng);
  for (const clave of orden) {
    const valor = dados.get(clave);
    dados.delete(clave);
    const { soluciones } = contarSolucionesModelo(n, dados, { tope: 2 });
    if (soluciones !== 1) dados.set(clave, valor);
  }
  return { solucion, dados };
}

// ---------- CAPA 2: clase (asignacion libre + pares revelados) ----------

function vecinos4(n, f, c) {
  const res = [];
  if (f > 0) res.push([f - 1, c]);
  if (f < n - 1) res.push([f + 1, c]);
  if (c > 0) res.push([f, c - 1]);
  if (c < n - 1) res.push([f, c + 1]);
  return res;
}

export function asignaClases(n, numClases, rng) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rng() * numClases)));
}

// dadosClase: Map "f,c" -> clase absoluta (rompe la simetria de relabeling
// -- ver nota en construyeClase). pistasPares: hechos relativos
// {a:[f,c], b:[f,c], misma:boolean} sobre pares ADYACENTES, comprobados
// en cuanto su ULTIMA celda (en orden de lectura) queda decidida -- poda
// diferida, mismo patron que fabrica-de-bloques/planos-del-invernadero.
export function contarSolucionesClase(n, numClases, dadosClase, pistasPares, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;
  const porUltimoIndice = new Map();
  for (const p of pistasPares) {
    const ia = p.a[0] * n + p.a[1];
    const ib = p.b[0] * n + p.b[1];
    const ultimo = Math.max(ia, ib);
    if (!porUltimoIndice.has(ultimo)) porUltimoIndice.set(ultimo, []);
    porUltimoIndice.get(ultimo).push(p);
  }

  const color = Array.from({ length: n }, () => Array(n).fill(-1));
  let soluciones = 0;
  let primera = null;

  function rec(k) {
    if (k === n * n) {
      soluciones++;
      if (!primera) primera = color.map((fila) => [...fila]);
      return soluciones >= tope;
    }
    const f = Math.floor(k / n);
    const c = k % n;
    const fijo = dadosClase.get(`${f},${c}`);
    const candidatos = fijo != null ? [fijo] : Array.from({ length: numClases }, (_, i) => i);

    for (const v of candidatos) {
      color[f][c] = v;
      let ok = true;
      const pendientes = porUltimoIndice.get(k);
      if (pendientes) {
        for (const p of pendientes) {
          const va = color[p.a[0]][p.a[1]];
          const vb = color[p.b[0]][p.b[1]];
          const iguales = va === vb;
          if (iguales !== p.misma) { ok = false; break; }
        }
      }
      if (ok && rec(k + 1)) return true;
    }
    return false;
  }
  rec(0);
  return { soluciones, primera };
}

// Con 2+ clases realmente usadas, cualquier PERMUTACION de las etiquetas
// de clase preserva TODOS los hechos relativos (misma/distinta) -- son
// simples nombres, no hay "clase 0" objetivamente distinta de "clase 1".
// Revelar solo pares relativos, por muchos que sean, NUNCA puede dar
// unicidad (confirmado en el prototipo: con las 12 pistas de un 3x3
// reveladas seguian saliendo 2 soluciones, las 2 permutaciones
// supervivientes de las 3! de partida). Igual que un digito dado ancla
// el cuadrado latino del modelo, aqui hacen falta unos pocos "dados" de
// clase por celda para romper esa simetria.
export function construyeClase(n, numClases, rng) {
  const solucion = asignaClases(n, numClases, rng);

  const dadosClase = new Map();
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) dadosClase.set(`${f},${c}`, solucion[f][c]);

  const paresPosibles = [];
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      for (const [vf, vc] of vecinos4(n, f, c)) {
        if (vf > f || (vf === f && vc > c)) paresPosibles.push([[f, c], [vf, vc]]);
      }
    }
  }
  let pistasPares = paresPosibles.map(([a, b]) => ({ a, b, misma: solucion[a[0]][a[1]] === solucion[b[0]][b[1]] }));

  // Pool combinado: cada candidato a quitar es un dado (clave de
  // dadosClase) o una pista de par (objeto de pistasPares), barajados
  // juntos para no favorecer sistematicamente a un tipo sobre el otro.
  const candidatos = baraja(
    [...[...dadosClase.keys()].map((clave) => ({ tipo: 'dado', clave })),
     ...pistasPares.map((pista) => ({ tipo: 'par', pista }))],
    rng
  );

  for (const candidata of candidatos) {
    if (candidata.tipo === 'dado') {
      const valor = dadosClase.get(candidata.clave);
      dadosClase.delete(candidata.clave);
      const { soluciones } = contarSolucionesClase(n, numClases, dadosClase, pistasPares, { tope: 2 });
      if (soluciones !== 1) dadosClase.set(candidata.clave, valor);
    } else {
      const restantes = pistasPares.filter((p) => p !== candidata.pista);
      const { soluciones } = contarSolucionesClase(n, numClases, dadosClase, restantes, { tope: 2 });
      if (soluciones === 1) pistasPares = restantes;
    }
  }

  return { solucion, dadosClase, pistasPares };
}

// ---------- Orquestador: combina las dos capas en un payload publicable ----------

function dificultadDe(tamano) {
  return tamano === 3 ? 3 : 4;
}

function mapAArray(mapa) {
  return [...mapa].map(([clave, valor]) => {
    const [f, c] = clave.split(',').map(Number);
    return { f, c, valor };
  });
}

// modelo y clase son capas independientes (sin restriccion cruzada), asi
// que comparten un unico rng avanzando en secuencia -- mismo patron que
// el resto del catalogo cuando un tipo combina varios sub-generadores.
export function buildAndroidesPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);

  const { solucion: solucionModelo, dados: dadosModeloMap } = construyeModelo(tamano, rng);
  const { solucion: solucionClase, dadosClase: dadosClaseMap, pistasPares } = construyeClase(tamano, tamano, rng);

  return {
    variant: varianteDeSeed(seed),
    dificultad: dificultadDe(tamano),
    payload: {
      tablero: { ancho: tamano, alto: tamano },
      numClases: tamano,
      dadosModelo: mapAArray(dadosModeloMap),
      dadosClase: mapAArray(dadosClaseMap),
      pistasPares,
      solucionModelo,
      solucionClase
    }
  };
}
