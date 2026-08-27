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
