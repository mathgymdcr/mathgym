// ===== scripts/poligono-logic.js =====
// Geometría de polígonos rectilíneos en retícula, compartida entre el
// generador, el validador y la plantilla.
//
// En una retícula donde solo se dan pasos ortogonales, un polígono
// rectilíneo convexo es NECESARIAMENTE un rectángulo: sin ángulos de 270°
// no hay otra cosa. De ahí sale el eje de forma del tipo.

export const LADO = 7;        // gridSize 8 nodos -> 7x7 celdas
export const AREA_MAX = 12;   // tope por figura: mantiene la enumeración barata
export const AREA_MIN = 3;    // figuras de 1-2 celdas no son un reto

// ¿Existe algún poliominó simplemente conexo con esta área y este perímetro?
//
// Aritmética pura: el perímetro en retícula siempre es par, el mínimo para
// área A es 2*ceil(2*sqrt(A)) (Harary-Harborth) y el máximo es 2A+2 (la
// tira). Contrastado contra la enumeración exhaustiva en todo A<=AREA_MAX
// sin una sola discrepancia, así que no hace falta enumerar para esto --
// y al no tener tope de área, sirve para los payloads ya publicados, que
// llegan a A=15.
export function alcanzable(area, perimetro) {
  if (!Number.isInteger(area) || !Number.isInteger(perimetro)) return false;
  if (area < 1 || perimetro % 2 !== 0) return false;
  const min = 2 * Math.ceil(2 * Math.sqrt(area));
  return perimetro >= min && perimetro <= 2 * area + 2;
}

export function perimetrosDe(area) {
  const salida = [];
  for (let p = 2 * Math.ceil(2 * Math.sqrt(area)); p <= 2 * area + 2; p += 2) {
    salida.push(p);
  }
  return salida;
}

// ---------- Enumeración exhaustiva ----------
// Rellena la tabla de qué formas alcanzan cada (área, perímetro). Es el
// oráculo del módulo: la aritmética de `alcanzable` se contrasta contra
// esto en los tests.
//
// Enumera por crecimiento canónico (Redelmeier): cada figura se genera
// UNA sola vez, obligando a que su celda más arriba-izquierda sea el
// origen, así que no hay que normalizar ni deduplicar. La versión ingenua
// -- generar todas las ampliaciones y deduplicar por clave -- tardaba 109
// segundos para rellenar una tabla de noventa booleanos; esta tarda menos
// de un segundo.

// ¿El complemento de la figura es conexo? Si no, encierra un agujero, y el
// juego dibuja un único lazo cerrado, que no puede encerrarlo.
function sinAgujeros(celdas, W) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  const dentro = new Set(celdas);
  for (const i of celdas) {
    const r = Math.floor(i / W), c = i % W;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (c < minC) minC = c; if (c > maxC) maxC = c;
  }
  const vistos = new Set();
  const pila = [[minR - 1, minC - 1]];
  let n = 0;
  while (pila.length) {
    const [r, c] = pila.pop();
    if (r < minR - 1 || r > maxR + 1 || c < minC - 1 || c > maxC + 1) continue;
    const k = r * W + c;
    if (vistos.has(k) || dentro.has(k)) continue;
    vistos.add(k); n++;
    pila.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return n === (maxR - minR + 3) * (maxC - minC + 3) - celdas.length;
}

let _tabla = null;

export function enumeraPoliominos() {
  if (_tabla) return _tabla;
  const tabla = new Map();

  const n = AREA_MAX;
  const OFF = n + 1;
  const W = 2 * n + 3;
  const H = n + 2;
  const TOTAL = W * H;

  // Canónico: solo se admiten celdas por debajo del origen, o a su derecha
  // en la misma fila. Eso fija la celda más arriba-izquierda en el origen y
  // es lo que hace que cada figura salga una única vez.
  const permitido = new Uint8Array(TOTAL);
  for (let r = 0; r < H; r++) {
    for (let cc = 0; cc < W; cc++) {
      const c = cc - OFF;
      if (r > 0 || c >= 0) permitido[r * W + cc] = 1;
    }
  }

  const enPoly = new Uint8Array(TOTAL);
  const bloqueado = new Uint8Array(TOTAL);
  const celdas = [];
  let perimetro = 0;

  function anota() {
    const a = celdas.length;
    if (a < 1) return;
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const i of celdas) {
      const r = Math.floor(i / W), c = i % W;
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (c < minC) minC = c; if (c > maxC) maxC = c;
    }
    const alto = maxR - minR + 1, ancho = maxC - minC + 1;
    if (alto > LADO || ancho > LADO) return;

    const clave = `${a},${perimetro}`;
    const e = tabla.get(clave) || { convexa: false, concava: false };
    // Convexo rectilíneo == rectángulo == la figura llena su caja.
    const esRect = a === alto * ancho;
    // sinAgujeros hace un flood fill y hay cientos de miles de figuras: si
    // esta firma ya está anotada, esta figura no puede aportar nada.
    if (esRect ? e.convexa : e.concava) return;
    if (!sinAgujeros(celdas, W)) return;
    if (esRect) e.convexa = true; else e.concava = true;
    tabla.set(clave, e);
  }

  function crecer(candidatos) {
    const usados = [];
    while (candidatos.length) {
      const cel = candidatos.pop();

      let vecinosDentro = 0;
      for (const v of [cel - W, cel + W, cel - 1, cel + 1]) if (enPoly[v]) vecinosDentro++;
      celdas.push(cel); enPoly[cel] = 1;
      perimetro += 4 - 2 * vecinosDentro;
      anota();

      if (celdas.length < n) {
        const extra = [];
        for (const v of [cel - W, cel + W, cel - 1, cel + 1]) {
          if (v >= 0 && v < TOTAL && permitido[v] && !enPoly[v] && !bloqueado[v]) {
            bloqueado[v] = 1;
            extra.push(v);
          }
        }
        crecer([...candidatos, ...extra]);
        for (const v of extra) bloqueado[v] = 0;
      }

      perimetro -= 4 - 2 * vecinosDentro;
      celdas.pop(); enPoly[cel] = 0;
      // Bloqueada para lo que queda de este bucle: ya se han visto todas las
      // figuras que la contienen.
      bloqueado[cel] = 1;
      usados.push(cel);
    }
    for (const c of usados) bloqueado[c] = 0;
  }

  const origen = 0 * W + OFF;
  bloqueado[origen] = 1;
  crecer([origen]);

  _tabla = tabla;
  return _tabla;
}

// Qué formas alcanzan este (área, perímetro).
//
// Esto NO se puede hacer con aritmética. Se probó la regla "si el perímetro
// es el mínimo para esa área y hay rectángulo, entonces solo cabe el
// rectángulo" y es FALSA en A=3 P=8, A=8 P=12 y A=10 P=14 -- con 3 celdas y
// perímetro 8 valen el 1x3 y el tromino en L. Con esa regla se publicarían
// retos cuya restricción de forma es imposible de cumplir.
export function clasifica(area, perimetro) {
  if (area > AREA_MAX) {
    throw new Error(`clasifica: area=${area} supera AREA_MAX=${AREA_MAX}`);
  }
  return enumeraPoliominos().get(`${area},${perimetro}`) || { convexa: false, concava: false };
}

// ---------- Repartir un objetivo entre dos figuras ----------

export const FORMAS_DOS = ['ambas-convexas', 'una-de-cada', 'ambas-concavas'];

const COMBOS = {
  'ambas-convexas': (x, y) => x.convexa && y.convexa,
  'una-de-cada': (x, y) => (x.convexa && y.concava) || (x.concava && y.convexa),
  'ambas-concavas': (x, y) => x.concava && y.concava
};

// Todos los repartos de (areaTotal, perimetroTotal) en dos figuras que
// cumplen la restricción de forma. El reto solo es válido si esto devuelve
// exactamente uno: lo que hay que deducir es CÓMO se parte, y con varios
// repartos posibles no habría nada que deducir.
export function repartos(areaTotal, perimetroTotal, formas) {
  const ok = COMBOS[formas];
  if (!ok) throw new Error(`repartos: formas desconocida "${formas}"`);

  const salida = [];
  for (let a1 = AREA_MIN; a1 <= AREA_MAX; a1++) {
    const a2 = areaTotal - a1;
    if (a2 < a1 || a2 < AREA_MIN || a2 > AREA_MAX) continue;
    if (a1 + a2 > LADO * LADO) continue;

    for (const p1 of perimetrosDe(a1)) {
      const p2 = perimetroTotal - p1;
      if (!alcanzable(a2, p2)) continue;
      // Pareja no ordenada: (a,p)+(a,q) y (a,q)+(a,p) son el mismo reparto.
      if (a1 === a2 && p2 < p1) continue;
      if (!ok(clasifica(a1, p1), clasifica(a2, p2))) continue;
      salida.push([[a1, p1], [a2, p2]]);
    }
  }
  return salida;
}

// ---------- El tablero como conjunto de aristas ----------
// La plantilla dibuja aristas, no una secuencia de nodos: así se puede
// borrar un segmento de en medio (una secuencia se partiría en dos) y dos
// figuras son simplemente dos componentes conexas.
//
// Estas funciones las importa también la plantilla. Igual que el trazador
// de láser: si el juego decidiera por su cuenta qué es convexo y el
// generador por otra vía, se publicarían retos imposibles de cumplir.

export function claveArista(a, b) {
  const [p, q] = (a.r < b.r || (a.r === b.r && a.c < b.c)) ? [a, b] : [b, a];
  return `${p.r},${p.c}-${q.r},${q.c}`;
}

export function nodosDeArista(clave) {
  return clave.split('-').map((s) => {
    const [r, c] = s.split(',').map(Number);
    return { r, c };
  });
}

export function figurasDeAristas(aristas) {
  const vecinos = new Map();   // "r,c" -> [ "r,c", ... ]
  for (const clave of aristas) {
    const [a, b] = nodosDeArista(clave);
    const ka = `${a.r},${a.c}`, kb = `${b.r},${b.c}`;
    if (!vecinos.has(ka)) vecinos.set(ka, []);
    if (!vecinos.has(kb)) vecinos.set(kb, []);
    vecinos.get(ka).push(kb);
    vecinos.get(kb).push(ka);
  }

  // Grado > 2 es un cruce: no es una figura simple. Es lo que impide el
  // ocho que la versión por secuencia de nodos sí dejaba dibujar, y con el
  // que el área por shoelace daba un número sin significado.
  for (const lista of vecinos.values()) {
    if (lista.length > 2) return { ciclos: [], abiertas: 0, invalido: true };
  }

  const ciclos = [];
  let abiertas = 0;
  const vistos = new Set();

  for (const inicio of vecinos.keys()) {
    if (vistos.has(inicio)) continue;

    // Recorre la componente para saber si es ciclo (todos grado 2) o cadena
    // abierta, que es un estado normal a medio dibujar y no un error.
    const componente = [];
    const pila = [inicio];
    let esCiclo = true;
    while (pila.length) {
      const k = pila.pop();
      if (vistos.has(k)) continue;
      vistos.add(k);
      componente.push(k);
      if (vecinos.get(k).length !== 2) esCiclo = false;
      for (const v of vecinos.get(k)) if (!vistos.has(v)) pila.push(v);
    }

    if (!esCiclo) { abiertas++; continue; }

    // Camina el ciclo en orden para poder medirlo.
    const orden = [];
    let previo = null;
    let actual = componente[0];
    do {
      orden.push(actual);
      const [x, y] = vecinos.get(actual);
      const siguiente = (x === previo) ? y : x;
      previo = actual;
      actual = siguiente;
    } while (actual !== componente[0]);

    ciclos.push(orden.map((k) => {
      const [r, c] = k.split(',').map(Number);
      return { r, c };
    }));
  }

  return { ciclos, abiertas, invalido: false };
}

export function medidasDeFigura(ciclo) {
  const n = ciclo.length;

  let doble = 0;
  for (let i = 0; i < n; i++) {
    const a = ciclo[i], b = ciclo[(i + 1) % n];
    doble += a.c * b.r - b.c * a.r;
  }

  // Un ciclo rectilíneo simple es convexo si y solo si tiene exactamente
  // cuatro esquinas: cualquier quinta obliga a un ángulo de 270°.
  let esquinas = 0;
  for (let i = 0; i < n; i++) {
    const prev = ciclo[(i - 1 + n) % n], act = ciclo[i], sig = ciclo[(i + 1) % n];
    if (act.r - prev.r !== sig.r - act.r || act.c - prev.c !== sig.c - act.c) esquinas++;
  }

  return { area: Math.abs(doble) / 2, perimetro: n, convexa: esquinas === 4 };
}
