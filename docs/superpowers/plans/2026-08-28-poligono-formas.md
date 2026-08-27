# Polígono: eje de forma y dos figuras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `poligono-geometrico` deje de publicar un único reto («dibuja un rectángulo de 3×4») y pase a tener dos ejes — forma cóncava/convexa y modo de dos figuras con reparto deducible — sobre un modelo de dibujo que permita borrar segmentos.

**Architecture:** Se crea `scripts/poligono-logic.js`, el módulo compartido que al tipo le falta, y lo importan generador, validador **y plantilla** (como en láser). La plantilla pasa de una secuencia ordenada de nodos a un conjunto de aristas, lo que habilita el borrado de segmentos y hace que dos figuras sean simplemente dos componentes conexas.

**Tech Stack:** Módulos ES planos sin bundler · vitest + happy-dom · Node 18+ · sin dependencias externas.

**Spec:** `docs/superpowers/specs/2026-08-28-poligono-formas-design.md`

## Global Constraints

- **Todo en español**: textos de UI, nombres de campos, nombres de función. Excepción: `objectives` y sus claves (`winCondition`, `parMoves`, `maxErrorsFor3Stars`…) **no se traducen**, es convención entre tipos.
- **Sin dependencias nuevas.** `mulberry32` se duplica en cada módulo de lógica a propósito, para que sea autocontenido (ver cabecera de `scripts/lightsout-logic.js`).
- **Tablero**: `gridSize: 8` nodos → **7×7 celdas**. Constante `LADO = 7`.
- **Tope de área por figura**: `AREA_MAX = 12`. **Área mínima por figura**: `AREA_MIN = 3`.
- **Nunca elegir un eje con `seed % n`.** `selectTemplate` es `templates[seed % 12]`, así que el tipo solo recibe una clase módulo 12 y cualquier `% n` con `n` divisor de 12 queda constante. Sortear siempre con `mulberry32` y una máscara propia por eje.
- **La solución nunca viaja en el payload.**
- Ejecutar tests con `npx vitest run <ruta>`. La suite completa es `npm test`.
- **No ejecutar `node scripts/test-generator.js` ni los generadores sueltos sin limpiar después**: escriben ficheros de verdad en el repo.

---

### Task 1: `poligono-logic.js` — realizabilidad y clasificación de formas

**Files:**
- Create: `scripts/poligono-logic.js`
- Test: `tests/poligono/formas.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `LADO: 7`, `AREA_MAX: 12`, `AREA_MIN: 3` (constantes exportadas)
  - `alcanzable(area: number, perimetro: number) => boolean`
  - `perimetrosDe(area: number) => number[]`
  - `clasifica(area: number, perimetro: number) => { convexa: boolean, concava: boolean }`
  - `enumeraPoliominos() => Map<string, { convexa: boolean, concava: boolean }>` — oráculo exhaustivo, clave `"area,perimetro"`

- [ ] **Step 1: Write the failing test**

`tests/poligono/formas.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  AREA_MAX,
  alcanzable,
  perimetrosDe,
  clasifica,
  enumeraPoliominos
} from '../../scripts/poligono-logic.js'

describe('alcanzable', () => {
  it('coincide con la enumeracion exhaustiva en todo el rango', () => {
    const real = enumeraPoliominos()
    for (let a = 1; a <= AREA_MAX; a++) {
      for (let p = 2; p <= 2 * a + 4; p += 2) {
        const enumerado = real.has(`${a},${p}`)
        expect(alcanzable(a, p), `A=${a} P=${p}`).toBe(enumerado)
      }
    }
  })

  it('rechaza el perimetro impar: en una reticula siempre es par', () => {
    expect(alcanzable(12, 15)).toBe(false)
  })
})

describe('clasifica', () => {
  // Estos tres pares tumbaron la regla aritmetica "si el perimetro es el
  // minimo para esa area y hay rectangulo, solo cabe el rectangulo". En los
  // tres hay TAMBIEN una figura no rectangular -- con 3 celdas y perimetro 8
  // valen el 1x3 y el tromino en L. Por eso clasifica() enumera.
  it('reconoce concava en los tres pares que rompen la regla aritmetica', () => {
    for (const [a, p] of [[3, 8], [8, 12], [10, 14]]) {
      expect(clasifica(a, p), `A=${a} P=${p}`).toEqual({ convexa: true, concava: true })
    }
  })

  it('coincide con la enumeracion exhaustiva en todo el rango', () => {
    const real = enumeraPoliominos()
    for (let a = 1; a <= AREA_MAX; a++) {
      for (const p of perimetrosDe(a)) {
        expect(clasifica(a, p), `A=${a} P=${p}`).toEqual(real.get(`${a},${p}`))
      }
    }
  })

  it('marca solo convexa el 3x4, que ninguna otra figura de area 12 alcanza', () => {
    expect(clasifica(12, 14)).toEqual({ convexa: true, concava: false })
  })

  it('marca solo concava el area 11 mas compacta: ningun rectangulo la da', () => {
    expect(clasifica(11, 14)).toEqual({ convexa: false, concava: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/formas.test.js`
Expected: FAIL — `Failed to load ../../scripts/poligono-logic.js` (el módulo no existe).

- [ ] **Step 3: Write minimal implementation**

`scripts/poligono-logic.js`:

```js
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
// Se usa para clasificar por forma, y los tests la contrastan contra la
// aritmética. Es cara de escribir pero barata de correr (A<=12 tarda menos
// de un segundo) y se memoiza.

function normaliza(celdas) {
  const pts = [...celdas].map((s) => s.split(',').map(Number));
  const mr = Math.min(...pts.map((p) => p[0]));
  const mc = Math.min(...pts.map((p) => p[1]));
  return new Set(pts.map(([r, c]) => `${r - mr},${c - mc}`));
}

function caja(celdas) {
  const pts = [...celdas].map((s) => s.split(',').map(Number));
  return [Math.max(...pts.map((p) => p[0])) + 1, Math.max(...pts.map((p) => p[1])) + 1];
}

function perimetroDeCeldas(celdas) {
  let n = 0;
  for (const s of celdas) {
    const [r, c] = s.split(',').map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!celdas.has(`${r + dr},${c + dc}`)) n++;
    }
  }
  return n;
}

// Sin agujeros: el complemento dentro de la caja ampliada es conexo. El
// juego dibuja un único lazo cerrado, que no puede encerrar un hueco.
function sinAgujeros(celdas) {
  const pts = [...celdas].map((s) => s.split(',').map(Number));
  const MR = Math.max(...pts.map((p) => p[0]));
  const MC = Math.max(...pts.map((p) => p[1]));
  const vistos = new Set();
  const pila = [[-1, -1]];
  let n = 0;
  while (pila.length) {
    const [r, c] = pila.pop();
    const k = `${r},${c}`;
    if (r < -1 || c < -1 || r > MR + 1 || c > MC + 1) continue;
    if (vistos.has(k) || celdas.has(k)) continue;
    vistos.add(k); n++;
    pila.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return n === (MR + 3) * (MC + 3) - celdas.size;
}

let _tabla = null;

export function enumeraPoliominos() {
  if (_tabla) return _tabla;
  const tabla = new Map();
  let nivel = [new Set(['0,0'])];

  for (let a = 1; a <= AREA_MAX; a++) {
    for (const f of nivel) {
      if (!sinAgujeros(f)) continue;
      const [h, w] = caja(f);
      if (h > LADO || w > LADO) continue;
      const clave = `${a},${perimetroDeCeldas(f)}`;
      const e = tabla.get(clave) || { convexa: false, concava: false };
      // Convexo rectilíneo == rectángulo == la figura llena su caja.
      if (f.size === h * w) e.convexa = true; else e.concava = true;
      tabla.set(clave, e);
    }
    if (a === AREA_MAX) break;

    const sig = new Map();
    for (const f of nivel) {
      for (const s of f) {
        const [r, c] = s.split(',').map(Number);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${r + dr},${c + dc}`;
          if (f.has(nk)) continue;
          const nf = normaliza(new Set([...f, nk]));
          sig.set([...nf].sort().join('|'), nf);
        }
      }
    }
    nivel = [...sig.values()];
  }

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/formas.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/poligono-logic.js tests/poligono/formas.test.js
git commit -m "Poligono: realizabilidad aritmetica y clasificacion por enumeracion"
```

---

### Task 2: `repartos` — los repartos válidos de un objetivo entre dos figuras

**Files:**
- Modify: `scripts/poligono-logic.js`
- Test: `tests/poligono/repartos.test.js`

**Interfaces:**
- Consumes: `alcanzable`, `perimetrosDe`, `clasifica`, `AREA_MAX`, `AREA_MIN` (Task 1).
- Produces:
  - `FORMAS_DOS: ['ambas-convexas', 'una-de-cada', 'ambas-concavas']`
  - `repartos(areaTotal: number, perimetroTotal: number, formas: string) => Array<[[number,number],[number,number]]>` — cada elemento es `[[a1,p1],[a2,p2]]`, con `a1 <= a2`

- [ ] **Step 1: Write the failing test**

`tests/poligono/repartos.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { repartos, FORMAS_DOS } from '../../scripts/poligono-logic.js'

describe('repartos', () => {
  it('deja un unico reparto en el caso canonico de una-de-cada', () => {
    // (24,30) solo se parte como el 3x4 convexo mas una figura de area 12
    // y perimetro 16, que no puede ser tambien convexa a la vez que la otra.
    expect(repartos(24, 30, 'una-de-cada')).toEqual([[[12, 14], [12, 16]]])
  })

  it('nunca devuelve figuras de menos de 3 celdas', () => {
    for (const formas of FORMAS_DOS) {
      for (let a = 6; a <= 24; a++) {
        for (let p = 12; p <= 52; p += 2) {
          for (const [[a1], [a2]] of repartos(a, p, formas)) {
            expect(a1, `A=${a} P=${p} ${formas}`).toBeGreaterThanOrEqual(3)
            expect(a2, `A=${a} P=${p} ${formas}`).toBeGreaterThanOrEqual(3)
          }
        }
      }
    }
  })

  it('devuelve cada reparto una sola vez, sin el mismo par al reves', () => {
    const vistos = repartos(24, 28, 'ambas-convexas').map((r) => JSON.stringify(r))
    expect(new Set(vistos).size).toBe(vistos.length)
    for (const [[a1, p1], [a2, p2]] of repartos(24, 28, 'ambas-convexas')) {
      expect(a1 < a2 || (a1 === a2 && p1 <= p2)).toBe(true)
    }
  })

  it('la suma de cada reparto es el objetivo pedido', () => {
    for (const [[a1, p1], [a2, p2]] of repartos(21, 26, 'ambas-convexas')) {
      expect(a1 + a2).toBe(21)
      expect(p1 + p2).toBe(26)
    }
  })

  it('revienta ante una restriccion de forma desconocida', () => {
    expect(() => repartos(24, 30, 'ninguna')).toThrow(/formas/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/repartos.test.js`
Expected: FAIL — `repartos is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `scripts/poligono-logic.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/poligono-logic.js tests/poligono/repartos.test.js
git commit -m "Poligono: repartos de un objetivo entre dos figuras bajo restriccion de forma"
```

---

### Task 3: Figuras a partir de un conjunto de aristas

Esta es la pieza que comparten plantilla, generador y validador. Va antes que la reescritura de la plantilla para que esta ya tenga red.

**Files:**
- Modify: `scripts/poligono-logic.js`
- Test: `tests/poligono/aristas.test.js`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces:
  - `claveArista(a: {r,c}, b: {r,c}) => string` — canónica, el nodo menor primero
  - `nodosDeArista(clave: string) => [{r,c}, {r,c}]`
  - `figurasDeAristas(aristas: Set<string>) => { ciclos: Array<Array<{r,c}>>, abiertas: number, invalido: boolean }`
  - `medidasDeFigura(ciclo: Array<{r,c}>) => { area: number, perimetro: number, convexa: boolean }`

- [ ] **Step 1: Write the failing test**

`tests/poligono/aristas.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  claveArista,
  figurasDeAristas,
  medidasDeFigura
} from '../../scripts/poligono-logic.js'

// Construye el conjunto de aristas del contorno de un rectangulo cuya
// esquina superior izquierda es (r0,c0) y que mide alto x ancho CELDAS.
function rectangulo(r0, c0, alto, ancho) {
  const set = new Set()
  const arista = (r1, c1, r2, c2) => set.add(claveArista({ r: r1, c: c1 }, { r: r2, c: c2 }))
  for (let c = c0; c < c0 + ancho; c++) {
    arista(r0, c, r0, c + 1)
    arista(r0 + alto, c, r0 + alto, c + 1)
  }
  for (let r = r0; r < r0 + alto; r++) {
    arista(r, c0, r + 1, c0)
    arista(r, c0 + ancho, r + 1, c0 + ancho)
  }
  return set
}

describe('claveArista', () => {
  it('da la misma clave en los dos sentidos', () => {
    expect(claveArista({ r: 1, c: 2 }, { r: 1, c: 3 }))
      .toBe(claveArista({ r: 1, c: 3 }, { r: 1, c: 2 }))
  })
})

describe('figurasDeAristas', () => {
  it('reconoce un rectangulo como un unico ciclo', () => {
    const res = figurasDeAristas(rectangulo(0, 0, 3, 4))
    expect(res.invalido).toBe(false)
    expect(res.abiertas).toBe(0)
    expect(res.ciclos.length).toBe(1)
  })

  it('reconoce dos rectangulos separados como dos ciclos', () => {
    const dos = new Set([...rectangulo(0, 0, 3, 4), ...rectangulo(0, 5, 2, 2)])
    expect(figurasDeAristas(dos).ciclos.length).toBe(2)
  })

  it('una cadena abierta es un estado normal, no un error', () => {
    const abierto = rectangulo(0, 0, 3, 4)
    abierto.delete(claveArista({ r: 0, c: 0 }, { r: 0, c: 1 }))
    const res = figurasDeAristas(abierto)
    expect(res.invalido).toBe(false)
    expect(res.ciclos.length).toBe(0)
    expect(res.abiertas).toBe(1)
  })

  it('marca invalido si un nodo llega a grado 3', () => {
    const cruce = rectangulo(0, 0, 3, 4)
    cruce.add(claveArista({ r: 0, c: 1 }, { r: 1, c: 1 }))
    expect(figurasDeAristas(cruce).invalido).toBe(true)
  })
})

describe('medidasDeFigura', () => {
  it('mide el 3x4: area 12, perimetro 14, convexa', () => {
    const [ciclo] = figurasDeAristas(rectangulo(0, 0, 3, 4)).ciclos
    expect(medidasDeFigura(ciclo)).toEqual({ area: 12, perimetro: 14, convexa: true })
  })

  it('mide una L de area 12 y perimetro 16 como concava', () => {
    // Cuadrado 4x4 al que se le quita la esquina inferior derecha 2x2.
    const set = new Set()
    const arista = (r1, c1, r2, c2) => set.add(claveArista({ r: r1, c: c1 }, { r: r2, c: c2 }))
    const contorno = [
      [0, 0], [0, 4], [2, 4], [2, 2], [4, 2], [4, 0], [0, 0]
    ]
    for (let i = 0; i < contorno.length - 1; i++) {
      const [r1, c1] = contorno[i]
      const [r2, c2] = contorno[i + 1]
      const pasos = Math.abs(r2 - r1) + Math.abs(c2 - c1)
      const dr = Math.sign(r2 - r1)
      const dc = Math.sign(c2 - c1)
      for (let k = 0; k < pasos; k++) {
        arista(r1 + dr * k, c1 + dc * k, r1 + dr * (k + 1), c1 + dc * (k + 1))
      }
    }
    const [ciclo] = figurasDeAristas(set).ciclos
    expect(medidasDeFigura(ciclo)).toEqual({ area: 12, perimetro: 16, convexa: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/aristas.test.js`
Expected: FAIL — `claveArista is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `scripts/poligono-logic.js`:

```js
// ---------- El tablero como conjunto de aristas ----------
// La plantilla dibuja aristas, no una secuencia de nodos: así se puede
// borrar un segmento de en medio (una secuencia se partiría en dos) y dos
// figuras son simplemente dos componentes conexas.
//
// Estas dos funciones las importa también la plantilla. Igual que el
// trazador de láser: si el juego decidiera por su cuenta qué es convexo y
// el generador por otra vía, se publicarían retos imposibles de cumplir.

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

  // Grado > 2 es un cruce: no es una figura simple.
  for (const lista of vecinos.values()) {
    if (lista.length > 2) return { ciclos: [], abiertas: 0, invalido: true };
  }

  const ciclos = [];
  let abiertas = 0;
  const vistos = new Set();

  for (const inicio of vecinos.keys()) {
    if (vistos.has(inicio)) continue;

    // Recorre la componente para saber si es ciclo (todos grado 2) o cadena.
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
    const d1r = act.r - prev.r, d1c = act.c - prev.c;
    const d2r = sig.r - act.r, d2c = sig.c - act.c;
    if (d1r !== d2r || d1c !== d2c) esquinas++;
  }

  return { area: Math.abs(doble) / 2, perimetro: n, convexa: esquinas === 4 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/poligono-logic.js tests/poligono/aristas.test.js
git commit -m "Poligono: figuras y medidas a partir de un conjunto de aristas"
```

---

### Task 4: `buildPoligonoPuzzle` y `buildPoligonoHints`

**Files:**
- Modify: `scripts/poligono-logic.js`
- Test: `tests/poligono/generador.test.js`

**Interfaces:**
- Consumes: `repartos`, `clasifica`, `alcanzable`, `perimetrosDe`, `FORMAS_DOS`, `AREA_MIN`, `AREA_MAX`.
- Produces:
  - `VARIANTES: string[]` — `['una-convexa','una-concava','dos-convexas','dos-una-de-cada','dos-concavas']`
  - `buildPoligonoPuzzle(seed: number) => { variant, dificultad, config, solucion }`
    - `config`: `{ gridSize: 8, n_figuras: 1|2, area: number, perimeter: number, formas: string }`
    - `solucion`: `Array<[number, number]>` — los `[area, perimetro]` de cada figura
  - `buildPoligonoHints(puzzle) => string[]`

- [ ] **Step 1: Write the failing test**

`tests/poligono/generador.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import {
  VARIANTES,
  buildPoligonoPuzzle,
  buildPoligonoHints,
  repartos,
  alcanzable,
  clasifica
} from '../../scripts/poligono-logic.js'

const SEEDS = Array.from({ length: 80 }, (_, i) => 20260101 + i * 5)

describe('buildPoligonoPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(JSON.stringify(buildPoligonoPuzzle(seed)), `seed ${seed}`)
        .toBe(JSON.stringify(buildPoligonoPuzzle(seed)))
    }
  })

  it('publica las cinco variantes a lo largo de los seeds', () => {
    const vistas = new Set(SEEDS.map((s) => buildPoligonoPuzzle(s).variant))
    expect([...vistas].sort()).toEqual([...VARIANTES].sort())
  })

  it('en dos figuras el reparto es unico, que es lo que hay que deducir', () => {
    for (const seed of SEEDS) {
      const { config } = buildPoligonoPuzzle(seed)
      if (config.n_figuras !== 2) continue
      expect(repartos(config.area, config.perimeter, config.formas).length, `seed ${seed}`).toBe(1)
    }
  })

  it('en una figura el par es alcanzable y cumple la forma pedida', () => {
    for (const seed of SEEDS) {
      const { config } = buildPoligonoPuzzle(seed)
      if (config.n_figuras !== 1) continue
      expect(alcanzable(config.area, config.perimeter), `seed ${seed}`).toBe(true)
      const c = clasifica(config.area, config.perimeter)
      expect(config.formas === 'convexa' ? c.convexa : c.concava, `seed ${seed}`).toBe(true)
    }
  })

  it('nunca escribe formas libre: eso es solo para los payloads publicados', () => {
    for (const seed of SEEDS) {
      expect(buildPoligonoPuzzle(seed).config.formas, `seed ${seed}`).not.toBe('libre')
    }
  })

  // El eje muerto que tenia el tipo: configs[seed % 6] quedaba constante
  // dentro de la clase modulo 12 que selectTemplate le asigna, y en 4 anos
  // se publicaba SIEMPRE A=12 P=14. Los seeds sinteticos de arriba recorren
  // todos los residuos y por eso no lo verian.
  it('reparte las variantes sobre las fechas que de verdad tocan poligono', () => {
    const g = new MathGymGenerator()
    const seeds = []
    const d = new Date(Date.UTC(2026, 0, 1))
    for (let i = 0; i < 1460; i++) {
      const fecha = d.toISOString().slice(0, 10)
      const seed = g.dateToSeed(fecha)
      if (g.selectTemplate(seed) === 'poligono-geometrico') seeds.push(seed)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const vistas = new Set(seeds.map((s) => buildPoligonoPuzzle(s).variant))
    expect([...vistas].sort()).toEqual([...VARIANTES].sort())
  })
})

describe('buildPoligonoHints', () => {
  it('nunca revela el reparto, que es la respuesta', () => {
    for (const seed of SEEDS) {
      const p = buildPoligonoPuzzle(seed)
      if (p.config.n_figuras !== 2) continue
      const texto = buildPoligonoHints(p).join(' ')
      for (const [area, perimetro] of p.solucion) {
        expect(texto, `seed ${seed}`).not.toContain(`${area} celdas`)
        expect(texto, `seed ${seed}`).not.toContain(`perímetro ${perimetro}`)
      }
    }
  })

  it('explica que en esta reticula convexo significa rectangulo', () => {
    const seed = SEEDS.find((s) => buildPoligonoPuzzle(s).config.n_figuras === 2)
    expect(buildPoligonoHints(buildPoligonoPuzzle(seed)).join(' ')).toContain('rectángulo')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/generador.test.js`
Expected: FAIL — `buildPoligonoPuzzle is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `scripts/poligono-logic.js`:

```js
// ---------- Construcción del reto ----------

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

export const VARIANTES = [
  'una-convexa', 'una-concava', 'dos-convexas', 'dos-una-de-cada', 'dos-concavas'
];

const SPEC = {
  'una-convexa':     { n: 1, formas: 'convexa',        dificultad: 2 },
  'una-concava':     { n: 1, formas: 'concava',        dificultad: 3 },
  'dos-convexas':    { n: 2, formas: 'ambas-convexas', dificultad: 3 },
  'dos-una-de-cada': { n: 2, formas: 'una-de-cada',    dificultad: 4 },
  'dos-concavas':    { n: 2, formas: 'ambas-concavas', dificultad: 4 }
};

// Catálogo de instancias, derivado y memoizado. NO se escribe a mano: si
// cambian LADO o AREA_MAX, se recalcula solo.
let _catalogo = null;

function catalogo() {
  if (_catalogo) return _catalogo;
  const cat = {};

  for (const forma of ['convexa', 'concava']) {
    cat[forma] = [];
    for (let a = AREA_MIN; a <= AREA_MAX; a++) {
      for (const p of perimetrosDe(a)) {
        if (clasifica(a, p)[forma]) cat[forma].push([a, p]);
      }
    }
  }

  for (const formas of FORMAS_DOS) {
    cat[formas] = [];
    for (let at = 2 * AREA_MIN; at <= 2 * AREA_MAX; at++) {
      for (let pt = 4; pt <= 4 * AREA_MAX + 4; pt += 2) {
        const rs = repartos(at, pt, formas);
        if (rs.length === 1) cat[formas].push([at, pt]);
      }
    }
  }

  _catalogo = cat;
  return _catalogo;
}

// Cada eje con su propia máscara, y sorteado con el PRNG. Nunca `seed % n`:
// selectTemplate reparte con `seed % 12`, así que el tipo recibe una sola
// clase módulo 12 y cualquier módulo divisor de 12 queda constante -- es lo
// que dejaba el tipo publicando un único reto.
export function buildPoligonoPuzzle(seed) {
  const variant = VARIANTES[
    Math.floor(mulberry32((seed ^ 0x7a3c91d5) >>> 0)() * VARIANTES.length)
  ];
  const spec = SPEC[variant];
  const opciones = catalogo()[spec.formas];
  const [area, perimeter] = opciones[
    Math.floor(mulberry32((seed ^ 0x1e6b4f27) >>> 0)() * opciones.length)
  ];

  const solucion = spec.n === 2
    ? repartos(area, perimeter, spec.formas)[0]
    : [[area, perimeter]];

  return {
    variant,
    dificultad: spec.dificultad,
    config: {
      gridSize: LADO + 1,
      n_figuras: spec.n,
      area,
      perimeter,
      formas: spec.formas
    },
    solucion
  };
}

// Las pistas NO pueden decir el reparto: es la respuesta. Dicen lo que
// ayuda a deducirlo -- la paridad, el mínimo por área, y que aquí convexo
// significa rectángulo, que es la llave del modo `una-de-cada` y no es
// evidente para quien juega.
export function buildPoligonoHints(puzzle) {
  const { config } = puzzle;
  const comun = [
    'El perímetro de una figura sobre la retícula siempre es par: cada tramo que sube tiene que bajar, y cada uno que va a la derecha tiene que volver.',
    'Aquí solo se dan pasos horizontales y verticales, así que una figura sin entrantes es forzosamente un rectángulo. Para que deje de serlo hace falta al menos una esquina hacia dentro.'
  ];

  if (config.n_figuras === 1) {
    const min = 2 * Math.ceil(2 * Math.sqrt(config.area));
    return [
      ...comun,
      `Con ${config.area} celdas, el perímetro más pequeño posible es ${min}: cuanto más compacta la figura, menos borde tiene. Te piden ${config.perimeter}.`
    ];
  }

  return [
    ...comun,
    `Los números son los totales de las dos figuras juntas. Reparte primero las ${config.area} celdas y el perímetro ${config.perimeter} entre las dos, y comprueba que cada mitad se puede dibujar de verdad: solo hay un reparto que cumpla lo que se pide.`
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/`
Expected: PASS, 26 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/poligono-logic.js tests/poligono/generador.test.js
git commit -m "Poligono: catalogo derivado, cinco variantes y pistas que no revelan el reparto"
```

---

### Task 5: Reconectar el generador

**Files:**
- Modify: `scripts/generate-daily-reto.js` (import y `generatePoligono`)
- Test: `tests/poligono/reto-diario.test.js`

**Interfaces:**
- Consumes: `buildPoligonoPuzzle`, `buildPoligonoHints` (Task 4).
- Produces: `generatePoligono(seed, fecha)` devuelve un reto con `variant`, `dificultad` y `hints`.

- [ ] **Step 1: Write the failing test**

`tests/poligono/reto-diario.test.js`:

```js
import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { buildPoligonoPuzzle } from '../../scripts/poligono-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

// El generador ESCRIBE al llamarlo: se le da un directorio temporal para
// no ensuciar el repo.
async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

describe('generatePoligono', () => {
  it('escribe variante, dificultad y pistas, que antes no existian', async () => {
    for (const seed of [20260103, 20260215, 20260620, 20261111]) {
      const reto = await enTemporal(() => new MathGymGenerator().generatePoligono(seed, 'v'))
      const esperado = buildPoligonoPuzzle(seed)
      expect(reto.variant, `seed ${seed}`).toBe(esperado.variant)
      expect(reto.dificultad, `seed ${seed}`).toBe(esperado.dificultad)
      expect(Array.isArray(reto.hints) && reto.hints.length > 0, `seed ${seed}`).toBe(true)
    }
  })

  it('guarda el payload con n_figuras y formas, y sin la solucion', async () => {
    const { reto, data } = await enTemporal(async () => {
      const r = await new MathGymGenerator().generatePoligono(20260103, 'v')
      return { reto: r, data: JSON.parse(await fs.readFile(r.data.json_url, 'utf8')) }
    })
    expect(data.n_figuras).toBeGreaterThanOrEqual(1)
    expect(typeof data.formas).toBe('string')
    expect(data.solucion).toBeUndefined()
    expect(reto.objectives.winCondition).toBe('matching_figure')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/reto-diario.test.js`
Expected: FAIL — `expected undefined to be 'dos-una-de-cada'` (el generador no escribe `variant`).

- [ ] **Step 3: Write minimal implementation**

En `scripts/generate-daily-reto.js`, añadir al bloque de imports:

```js
import { buildPoligonoPuzzle, buildPoligonoHints } from './poligono-logic.js';
```

Y sustituir **toda** la función `generatePoligono` por:

```js
  async generatePoligono(seed, fecha) {
    // Los dos ejes (nº de figuras y forma), el catálogo de instancias y la
    // comprobación de que el reparto es único viven en poligono-logic.js,
    // que el validador reusa para re-comprobar el reto ya escrito.
    const puzzle = buildPoligonoPuzzle(seed);
    const { variant, dificultad, config } = puzzle;

    const dataFileName = `poligono_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-poligono-geometrico-001`,
      tipo: 'poligono-geometrico',
      variant,
      dificultad,
      categorias: ['geometria'],
      hints: buildPoligonoHints(puzzle),
      // Dibujar la figura pedida no tiene par de movimientos: se mide igual
      // que el enigma, por comprobaciones fallidas.
      objectives: {
        winCondition: 'matching_figure',
        maxErrorsFor3Stars: 0,
        maxErrorsFor2Stars: 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/ && npm test`
Expected: PASS. La suite completa sigue verde.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-daily-reto.js tests/poligono/reto-diario.test.js
git commit -m "Poligono: el generador pasa a ser I/O fina sobre el modulo de logica"
```

---

### Task 6: Validador

**Files:**
- Modify: `scripts/validate-retos.js` (`validatePoligonoData`)
- Test: `tests/poligono/validacion.test.js`

**Interfaces:**
- Consumes: `alcanzable`, `clasifica`, `repartos` (Tasks 1-2); `buildPoligonoPuzzle` (Task 4).
- Produces: `validatePoligonoData(reto)` rechaza el imposible, el ambiguo y la forma insatisfacible.

- [ ] **Step 1: Write the failing test**

`tests/poligono/validacion.test.js`:

```js
import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'
import { buildPoligonoPuzzle, VARIANTES } from '../../scripts/poligono-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

async function retoCon(data) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  const file = path.join(dir, 'poligono.json')
  await fs.writeFile(file, JSON.stringify(data))
  return { tipo: 'poligono-geometrico', data: { json_url: file } }
}

const SEEDS = Array.from({ length: 80 }, (_, i) => 20260101 + i * 5)
const seedDe = (variant) => SEEDS.find((s) => buildPoligonoPuzzle(s).variant === variant)

describe('validatePoligonoData', () => {
  it('acepta lo que escribe el generador en las cinco variantes', async () => {
    for (const variant of VARIANTES) {
      await enTemporal(async () => {
        const r = await new MathGymGenerator().generatePoligono(seedDe(variant), 'v')
        await new RetoValidator().validatePoligonoData(r)
      })
    }
  })

  it('sigue aceptando los payloads publicados, sin n_figuras ni formas', async () => {
    const reto = await retoCon({ area: 15, perimeter: 16, gridSize: 8 })
    await expect(new RetoValidator().validatePoligonoData(reto)).resolves.toBeUndefined()
  })

  it('rechaza un par que ninguna figura alcanza', async () => {
    // Area 12 con perimetro 12: por debajo del minimo, que es 14.
    const reto = await retoCon({ area: 12, perimeter: 12, gridSize: 8, n_figuras: 1, formas: 'convexa' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/alcanzable|imposible/)
  })

  it('rechaza pedir convexa cuando ningun rectangulo da ese par', async () => {
    // Area 11 con perimetro 14: solo lo dan figuras no rectangulares.
    const reto = await retoCon({ area: 11, perimeter: 14, gridSize: 8, n_figuras: 1, formas: 'convexa' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/formas/)
  })

  it('rechaza el reparto ambiguo en dos figuras', async () => {
    // (9,20) con una-de-cada admite TRES repartos -- (3,8)+(6,12),
    // (4,8)+(5,12) y (4,10)+(5,10) -- asi que no hay nada que deducir.
    // Verificado por enumeracion.
    const reto = await retoCon({ area: 9, perimeter: 20, gridSize: 8, n_figuras: 2, formas: 'una-de-cada' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/reparto/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/validacion.test.js`
Expected: FAIL — los tres últimos casos resuelven en vez de rechazar.

- [ ] **Step 3: Write minimal implementation**

En `scripts/validate-retos.js`, añadir al bloque de imports:

```js
import { alcanzable, clasifica, repartos } from './poligono-logic.js';
```

Y sustituir **todo** el cuerpo de `validatePoligonoData` por:

```js
  async validatePoligonoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Poligono reto missing json_url');
    }

    // reto.data solo trae { json_url }: los parámetros reales viven en el
    // archivo referenciado.
    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (data.area == null || data.perimeter == null) {
      throw new Error('Poligono reto missing area or perimeter in data file');
    }

    // Los retos publicados no traen estos campos: se leen como una figura
    // sin restricción de forma, que es exactamente el juego de antes.
    const nFiguras = data.n_figuras ?? 1;
    const formas = data.formas ?? 'libre';

    // Realizabilidad de verdad, no una condición necesaria: comprueba
    // paridad, cota inferior y cota superior de una vez.
    if (!alcanzable(data.area, data.perimeter) && nFiguras === 1) {
      throw new Error(
        `Poligono imposible: no hay figura alcanzable con area=${data.area} y perimetro=${data.perimeter}`
      );
    }

    if (nFiguras === 1) {
      if (formas === 'libre') return;
      const c = clasifica(data.area, data.perimeter);
      if (!c[formas]) {
        throw new Error(
          `Poligono formas="${formas}" insatisfacible para area=${data.area} perimetro=${data.perimeter}`
        );
      }
      return;
    }

    // Con dos figuras lo que se deduce es el reparto, así que tiene que
    // haber exactamente uno -- ni cero (imposible) ni varios (ambiguo). Es
    // lo mismo que hace riego contando calendarios.
    const posibles = repartos(data.area, data.perimeter, formas);
    if (posibles.length !== 1) {
      throw new Error(
        `Poligono reparto no unico: area=${data.area} perimetro=${data.perimeter} ` +
        `formas="${formas}" admite ${posibles.length} repartos`
      );
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/ && node scripts/validate-retos.js`
Expected: PASS, y `✅ All validations passed` sobre los retos publicados.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-retos.js tests/poligono/validacion.test.js
git commit -m "Poligono: el validador comprueba realizabilidad y unicidad del reparto"
```

---

### Task 7: Plantilla — el tablero como conjunto de aristas

La parte más cara, y hoy sin ninguna red: el tipo no tiene tests de plantilla. Por eso van primero.

**Files:**
- Modify: `plantillas/poligono_geometrico.js`
- Test: `tests/poligono/plantilla.test.js`

**Interfaces:**
- Consumes: `claveArista`, `figurasDeAristas`, `medidasDeFigura` (Task 3); `buildPoligonoPuzzle` (Task 4).
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Write the failing test**

`tests/poligono/plantilla.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest'

// happy-dom no implementa <canvas> y la celebracion pinta confeti en uno.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const nodo = (host, r, c) => host.querySelector(`.polygon-node[data-r="${r}"][data-c="${c}"]`)
const segmento = (host, r1, c1, r2, c2) =>
  host.querySelector(`.polygon-edge[data-arista="${r1},${c1}-${r2},${c2}"]`)

// Dibuja el contorno de un rectangulo pulsando nodo a nodo.
function dibujaRectangulo(host, alto, ancho) {
  const camino = []
  for (let c = 0; c <= ancho; c++) camino.push([0, c])
  for (let r = 1; r <= alto; r++) camino.push([r, ancho])
  for (let c = ancho - 1; c >= 0; c--) camino.push([alto, c])
  for (let r = alto - 1; r >= 0; r--) camino.push([r, 0])
  for (const [r, c] of camino) nodo(host, r, c).click()
}

async function monta(config) {
  const mod = await import('../../plantillas/poligono_geometrico.js')
  const host = document.createElement('div')
  let ganado = 0
  await mod.render(host, config, { onSuccess: () => { ganado++ } })
  return { host, ganado: () => ganado, validar: () => host.querySelector('#polygon-validate').click() }
}

const UNA = { gridSize: 8, n_figuras: 1, area: 12, perimeter: 14, formas: 'convexa' }

describe('plantilla de poligono', () => {
  it('gana al dibujar el 3x4 que se pide', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 3, 4)
    j.validar()
    expect(j.ganado()).toBe(1)
  })

  it('pulsar un segmento dibujado lo borra', async () => {
    const j = await monta(UNA)
    nodo(j.host, 0, 0).click()
    nodo(j.host, 0, 1).click()
    expect(segmento(j.host, 0, 0, 0, 1).classList.contains('puesta')).toBe(true)
    segmento(j.host, 0, 0, 0, 1).click()
    expect(segmento(j.host, 0, 0, 0, 1).classList.contains('puesta')).toBe(false)
  })

  it('quitar una arista de un ciclo deja una cadena por la que seguir', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 3, 4)
    segmento(j.host, 0, 0, 0, 1).click()
    // Desde el extremo (0,1) se puede seguir dibujando hacia arriba no --
    // no hay fila -1 -- pero si volver a cerrar por donde estaba.
    nodo(j.host, 0, 0).click()
    j.validar()
    expect(j.ganado()).toBe(1)
  })

  it('no deja llevar un nodo a grado 3', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 3, 4)
    nodo(j.host, 1, 1).click()
    expect(segmento(j.host, 0, 1, 1, 1)).toBeTruthy()
    expect(segmento(j.host, 0, 1, 1, 1).classList.contains('puesta')).toBe(false)
  })

  it('en dos figuras exige las dos, no una sola que sume', async () => {
    const j = await monta({
      gridSize: 8, n_figuras: 2, area: 24, perimeter: 30, formas: 'una-de-cada'
    })
    dibujaRectangulo(j.host, 3, 4)
    j.validar()
    expect(j.ganado()).toBe(0)
  })

  it('rechaza la forma equivocada aunque los numeros cuadren', async () => {
    // (12,16) lo dan el rectangulo 2x6 Y una L: pidiendo concava, el
    // rectangulo no vale.
    const j = await monta({ gridSize: 8, n_figuras: 1, area: 12, perimeter: 16, formas: 'concava' })
    dibujaRectangulo(j.host, 2, 6)
    j.validar()
    expect(j.ganado()).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poligono/plantilla.test.js`
Expected: FAIL — no existe `.polygon-edge`, y `render` no acepta `n_figuras`/`formas`.

- [ ] **Step 3: Write minimal implementation**

En `plantillas/poligono_geometrico.js`:

1. Añadir el import al principio del fichero:

```js
import { claveArista, figurasDeAristas, medidasDeFigura } from '../scripts/poligono-logic.js';
```

2. En `initializeGame`, sustituir `path: []` y `closed: false` por el conjunto de aristas y leer los campos nuevos con sus valores por defecto:

```js
      aristas: new Set(),
      nFiguras: config.n_figuras ?? 1,
      formas: config.formas ?? 'libre',
```

3. Sustituir `onNodeClick` por la versión que añade aristas desde un extremo:

```js
  function onNodeClick(e, state, ui) {
    const dot = e.currentTarget;
    const nodo = { r: +dot.dataset.r, c: +dot.dataset.c };

    const extremos = extremosDe(state);
    // Primer clic del trazo: marca por dónde se empieza.
    if (extremos.length === 0 && state.aristas.size === 0) {
      state.inicio = nodo;
      refresh(ui, state);
      return;
    }

    const desde = extremos.find((p) => Math.abs(p.r - nodo.r) + Math.abs(p.c - nodo.c) === 1)
      || (state.inicio && Math.abs(state.inicio.r - nodo.r) + Math.abs(state.inicio.c - nodo.c) === 1
        ? state.inicio : null);
    if (!desde) return;

    const clave = claveArista(desde, nodo);
    if (state.aristas.has(clave)) return;

    // Ningún nodo puede pasar de grado 2: eso es lo que impide los cruces.
    const prueba = new Set([...state.aristas, clave]);
    if (figurasDeAristas(prueba).invalido) return;

    pushHistory(state);
    state.aristas = prueba;
    state.inicio = null;
    refresh(ui, state);
  }

  // Nodos con grado 1: los cabos por los que se puede seguir dibujando.
  function extremosDe(state) {
    const grado = new Map();
    for (const clave of state.aristas) {
      for (const n of clave.split('-')) grado.set(n, (grado.get(n) || 0) + 1);
    }
    return [...grado.entries()]
      .filter(([, g]) => g === 1)
      .map(([k]) => {
        const [r, c] = k.split(',').map(Number);
        return { r, c };
      });
  }
```

4. Añadir la capa DOM de segmentos, que se construye una vez junto a los nodos:

```js
  function buildEdges(container, state, ui) {
    const grosor = 14;   // área de pulsación generosa; la línea pintada es más fina
    for (let r = 0; r < state.N; r++) {
      for (let c = 0; c < state.N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= state.N || c2 >= state.N) continue;
          const el = document.createElement('div');
          el.className = 'polygon-edge';
          el.dataset.arista = claveArista({ r, c }, { r: r2, c: c2 });
          const x = state.pad + c * state.step, y = state.pad + r * state.step;
          el.style.position = 'absolute';
          el.style.left = `${x - (dc ? 0 : grosor / 2)}px`;
          el.style.top = `${y - (dr ? 0 : grosor / 2)}px`;
          el.style.width = `${dc ? state.step : grosor}px`;
          el.style.height = `${dr ? state.step : grosor}px`;
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => onEdgeClick(el.dataset.arista, state, ui));
          container.appendChild(el);
        }
      }
    }
  }
```

5. El manejador del segmento, que es el gesto pedido:

```js
  function onEdgeClick(clave, state, ui) {
    if (!state.aristas.has(clave)) return;   // solo borra; poner es cosa de los nodos
    pushHistory(state);
    const nuevas = new Set(state.aristas);
    nuevas.delete(clave);
    state.aristas = nuevas;
    refresh(ui, state);
  }
```

6. `refresh` marca qué segmentos están puestos, para que el test (y quien juega) los vea:

```js
  function marcaAristas(container, state) {
    container.querySelectorAll('.polygon-edge').forEach((el) => {
      el.classList.toggle('puesta', state.aristas.has(el.dataset.arista));
    });
  }
```

7. Engancharlas al flujo que ya existe. En `render`, justo detrás de
   `buildNodes(ui.nodesLayer, gameState)`:

```js
  buildEdges(ui.nodesLayer, gameState, ui);
```

   Y dentro de `refresh`, junto a las otras llamadas de repintado:

```js
    marcaAristas(ui.nodesLayer, state);
```

8. Darle un id al botón Validar, que hoy solo tiene clase, para poder
   pulsarlo desde los tests. En `buildShell`:

```js
  const btnValidate = createElement('button', { class: 'btn', id: 'polygon-validate' });
```

9. Y la validación pasa a apoyarse en el módulo compartido:

```js
      ui.btnValidate.addEventListener('click', () => {
        const { ciclos, invalido } = figurasDeAristas(state.aristas);
        if (invalido || ciclos.length !== state.nFiguras) {
          state.fallos = (state.fallos || 0) + 1;
          setStatus(ui.result,
            `Necesitas ${state.nFiguras} figura${state.nFiguras > 1 ? 's' : ''} cerrada${state.nFiguras > 1 ? 's' : ''}.`,
            'ko');
          return;
        }

        const medidas = ciclos.map(medidasDeFigura);
        const area = medidas.reduce((a, m) => a + m.area, 0);
        const perimetro = medidas.reduce((a, m) => a + m.perimetro, 0);
        const convexas = medidas.filter((m) => m.convexa).length;

        const formaOk = {
          'libre': () => true,
          'convexa': () => convexas === 1,
          'concava': () => convexas === 0,
          'ambas-convexas': () => convexas === 2,
          'una-de-cada': () => convexas === 1,
          'ambas-concavas': () => convexas === 0
        }[state.formas]();

        if (area === state.targetArea && perimetro === state.targetPerimeter && formaOk) {
          setStatus(ui.result, `Correcto! A=${area}, P=${perimetro}`, 'ok');
          celebrate({ ok: true, title: '¡Excelente trabajo!' });
          if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos: state.fallos || 0 });
        } else {
          state.fallos = (state.fallos || 0) + 1;
          setStatus(ui.result, `No coincide. A=${area}, P=${perimetro}`, 'ko');
        }
      });
```

10. Borrar `calculateArea` y `calculatePerimeter`: ese cálculo vive ahora en `medidasDeFigura`, y tener dos copias es justo lo que se quiere evitar.

11. En el texto de objetivo (`instructionsP.innerHTML`), decir la restricción y avisar de que en dos figuras los números son totales:

```js
    const totales = (config.n_figuras ?? 1) > 1 ? ' (totales de las dos figuras)' : '';
    const forma = {
      'libre': '', 'convexa': ' · sin entrantes', 'concava': ' · con al menos un entrante',
      'ambas-convexas': ' · las dos sin entrantes',
      'una-de-cada': ' · una sin entrantes y otra con al menos uno',
      'ambas-concavas': ' · las dos con al menos un entrante'
    }[config.formas ?? 'libre'];
    instructionsP.innerHTML =
      `<strong>Objetivo:</strong> Área = ${config.area}, Perímetro = ${config.perimeter}${totales}${forma}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poligono/ && npm test`
Expected: PASS. Si `tests/plantillas/muestra.test.js` falla, es porque el ejemplo de `data/muestra/poligono-geometrico.json` sigue con el esquema viejo — se arregla en la Task 8, así que anótalo y sigue.

- [ ] **Step 5: Commit**

```bash
git add plantillas/poligono_geometrico.js tests/poligono/plantilla.test.js
git commit -m "Poligono: el tablero pasa a ser un conjunto de aristas, con borrado de segmentos"
```

---

### Task 8: Muestrario, documentación y verificación final

**Files:**
- Modify: `data/muestra/poligono-geometrico.json` (regenerado)
- Modify: `README_TEMPLATES.md`
- Modify: `/Users/jlcanton/web/CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Regenerar el ejemplo de la portada**

```bash
node scripts/generate-muestrario.js
git status --short
```

Esperado: solo `data/muestra/poligono-geometrico.json` modificado. Si aparece cualquier otro fichero suelto, **míralo antes de borrar nada**: borra solo lo que `git status` marca como `??`.

- [ ] **Step 2: Comprobar que el ejemplo se puede resolver**

```bash
npx vitest run tests/plantillas/
```

Expected: PASS.

- [ ] **Step 3: Suite completa, validador y smoke del generador**

```bash
npm test
node scripts/validate-retos.js
node scripts/test-generator.js
git checkout -- lista_retos.json reto.json 2>/dev/null
git status --porcelain data/ retos/ | grep '^?? ' | sed 's/^?? //' | tr '\n' '\0' | xargs -0 rm -f
git status --short
```

Expected: los tres pasan, y tras la limpieza `git status` no muestra ficheros sueltos aparte de los que tú has creado.

- [ ] **Step 4: Documentar**

En `README_TEMPLATES.md`, documentar el esquema nuevo del payload de polígono (`n_figuras`, `formas`, y que `area`/`perimeter` son totales con dos figuras).

En `/Users/jlcanton/web/CLAUDE.md`, junto a los párrafos por tipo, añadir uno para polígono que recoja: los dos ejes, que convexo rectilíneo significa rectángulo, que el reparto no va en el payload, que `clasifica` enumera porque la aritmética falla en A=3 P=8 / A=8 P=12 / A=10 P=14, y que la plantilla comparte `medidasDeFigura` con generador y validador.

- [ ] **Step 5: Commit**

```bash
git add data/muestra/poligono-geometrico.json README_TEMPLATES.md
git commit -m "Poligono: ejemplo del muestrario y documentacion del esquema nuevo"
```

---

## Verificación de cierre

- [ ] `npm test` en verde, con `tests/poligono/` incluido
- [ ] `node scripts/validate-retos.js` → `✅ All validations passed`
- [ ] `node scripts/test-generator.js` pasa, y el árbol queda limpio después
- [ ] Barrido de 4 años de fechas reales: las cinco variantes aparecen (lo cubre el test de la Task 4)
- [ ] `git status` sin ficheros sueltos que no sean tuyos
