# Espejo-vértice y llegada obligatoria al centro (laser-triangular) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los espejos `|`/`—` de `laser-triangular` ganan un segundo anclaje (un vértice de la rejilla, además del centro de celda de hoy), y diana/prisma/condensador solo activan su efecto cuando el rayo entra alineado con su centro exacto — eliminando el salto visual que hoy fuerza cualquier entrada al centro sin más.

**Architecture:** Todo el cambio de reglas vive en `scripts/laser-triangular-logic.js`, que ya es el único trazador compartido por plantilla, generador y validador. Se añade una segunda rejilla mutable `piezasVertice` (paralela a `piezas`, mismo patrón), un chequeo de alineación al centro dentro de `simularHaz`, y se extiende la búsqueda de piezas mínimas y el generador para usar el espejo-vértice. La plantilla y la CSS ganan una capa de overlay para colocar/dibujar piezas de vértice. Un script nuevo, separado, audita el archivo publicado bajo la regla nueva sin tocarlo.

**Tech Stack:** JavaScript ES modules (sin build), Vitest, DOM/happy-dom para tests de plantilla.

**Spec:** `docs/superpowers/specs/2026-09-06-laser-vertice-alineacion-design.md`

## Global Constraints

- El esquema del payload público (`lasers`/`targets`/`blocks`/`size`/`modo`/`min_piezas`) no cambia — `piezasVertice` es estado mutable de juego, igual que `piezas`, nunca viaja en el JSON del reto.
- El emisor sigue absorbiendo cualquier rayo que le llega, alineado o no — la regla de centro obligatorio solo aplica a diana, prisma y condensador.
- Solo `|` y `—` ganan anclaje de vértice; `/` y `\` se quedan solo en celda.
- Un vértice admite un único tipo a la vez (no se apilan horizontal y vertical en el mismo punto).
- El archivo publicado (`retos/`, `data/`) no se regenera ni se edita a mano por este cambio — se audita con un script aparte (Tarea 9) que solo escribe un reporte.
- Todo cambio en `scripts/laser-triangular-logic.js` mantiene el trazador como la única fuente de verdad para plantilla, generador y validador — no se duplica lógica en ningún sitio.

---

## Task 1: Espejo-vértice — geometría del trazador

**Files:**
- Modify: `scripts/laser-triangular-logic.js:59-61` (añadir `crearPiezasVertice` tras `crearPiezas`)
- Modify: `scripts/laser-triangular-logic.js:195-301` (`simularHaz`: nuevo parámetro `piezasVertice` y chequeo de reflexión en los cruces de borde)
- Test: `tests/laser/vertice.test.js` (nuevo)

**Interfaces:**
- Produce: `crearPiezasVertice(size) -> number[][]`, matriz `(size+1)×(size+1)` de ceros.
- Produce: `simularHaz(config, piezas, laser, piezasVertice)` — cuarto parámetro **opcional**; si se omite, se usa `crearPiezasVertice(config.size)` (ningún llamador existente se rompe).
- Consume: `PIEZA.VERT` (3), `PIEZA.HORIZ` (4), ya exportados.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/laser/vertice.test.js
import { describe, it, expect } from 'vitest'
import {
  simularHaz, crearPiezas, crearPiezasVertice, normalizaConfig, PIEZA
} from '../../scripts/laser-triangular-logic.js'

// Tablero 3x3: emisor en (1,0) disparando 'right'. Sin nada en el camino,
// el rayo se sale del tablero por la derecha en línea recta.
const TABLERO = { size: 3, modo: 'clasico', lasers: [], targets: [], blocks: [] }
const LASER = { emitter: { row: 1, col: 0, dir: 'right' }, color: 'neutro-1' }

describe('espejo-vertice: geometria', () => {
  it('sin espejo-vertice, el rayo recto se sale del tablero', () => {
    const config = normalizaConfig({ ...TABLERO, lasers: [LASER] })
    const piezas = crearPiezas(3)
    const { tramos } = simularHaz(config, piezas, LASER, crearPiezasVertice(3))
    expect(tramos[0].resultado).toBe('fuera')
  })

  it('un espejo-vertice horizontal en (2,2) refleja el rayo hacia arriba', () => {
    // El emisor arranca en (0.501,0.502) local (ARRANQUE): un rayo 'down'
    // cruza cada borde horizontal con x local ligeramente MAYOR que 0.5,
    // asi que para un emisor en columna 1 el vertice relevante es C=2 (la
    // mitad derecha del vertice), no C=1. Tablero 4x4, emisor en (1,1),
    // para que el rebote hacia arriba no salga inmediatamente del tablero
    // por el otro lado.
    const laserAbajo = { emitter: { row: 1, col: 1, dir: 'down' }, color: 'neutro-1' }
    const config = normalizaConfig({ size: 4, modo: 'clasico', lasers: [laserAbajo], targets: [], blocks: [] })
    const piezas = crearPiezas(4)
    const piezasVertice = crearPiezasVertice(4)
    piezasVertice[2][2] = PIEZA.HORIZ
    const { tramos } = simularHaz(config, piezas, laserAbajo, piezasVertice)
    // Reflejado (dy invertido), el rayo vuelve hacia arriba: visita la fila
    // 0 y nunca llega a la fila 3, al contrario que sin el vertice.
    expect(tramos[0].squaresPath.some(p => p.row === 0)).toBe(true)
    expect(tramos[0].squaresPath.some(p => p.row === 3)).toBe(false)
  })

  it('un vertice sin pieza no afecta nada: el mismo rayo sigue derecho', () => {
    const laserAbajo = { emitter: { row: 1, col: 1, dir: 'down' }, color: 'neutro-1' }
    const config = normalizaConfig({ size: 4, modo: 'clasico', lasers: [laserAbajo], targets: [], blocks: [] })
    const piezas = crearPiezas(4)
    const { tramos } = simularHaz(config, piezas, laserAbajo, crearPiezasVertice(4))
    expect(tramos[0].squaresPath.some(p => p.row === 3)).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/vertice.test.js`
Expected: FAIL — `crearPiezasVertice is not a function` (no existe todavía).

- [ ] **Step 3: Añadir `crearPiezasVertice`**

En `scripts/laser-triangular-logic.js`, justo después de `crearPiezas` (línea 61):

```js
export function crearPiezas(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function crearPiezasVertice(size) {
  return Array.from({ length: size + 1 }, () => Array(size + 1).fill(0));
}
```

- [ ] **Step 4: Añadir el parámetro y el chequeo de reflexión en `simularHaz`**

`simularHaz` (línea 195) gana el cuarto parámetro:

```js
export function simularHaz(config, piezas, laser, piezasVertice) {
  const n = config.size;
  const pv = piezasVertice || crearPiezasVertice(n);
  const bloqueadas = new Set(config.blocks.map((b) => `${b.row},${b.col}`));
  // ... (resto de las constantes de arriba, sin cambios) ...
```

Dentro del bucle `for (let step = 0; step < maxSteps; step++)` (línea 238), justo **después** del bloque que maneja `hit.line === 'bs' || 'fs' || 'hc' || 'vc'` (que termina en `continue;`, línea 256) y **antes** de `let nr = r, nc = c, ...` (línea 259), insertar:

```js
      // Espejo-vertice: vive en el borde compartido por dos celdas, no
      // dentro de ninguna, asi que se prueba en el momento de cruzar ese
      // borde, antes de decidir a que celda se transiciona.
      if (hit.line === 'top' || hit.line === 'bottom') {
        const R = hit.line === 'top' ? r : r + 1;
        const C = hit.x <= 0.5 ? c : c + 1;
        if (pv[R] && pv[R][C] === PIEZA.HORIZ) {
          lx = hit.x; ly = hit.y; dy = -dy;
          puntos.push({ x: c + lx, y: r + ly });
          continue;
        }
      } else if (hit.line === 'left' || hit.line === 'right') {
        const C = hit.line === 'left' ? c : c + 1;
        const R = hit.y <= 0.5 ? r : r + 1;
        if (pv[R] && pv[R][C] === PIEZA.VERT) {
          lx = hit.x; ly = hit.y; dx = -dx;
          puntos.push({ x: c + lx, y: r + ly });
          continue;
        }
      }

```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/laser/vertice.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Confirmar que nada existente se rompió**

Run: `npx vitest run tests/laser/`
Expected: PASS — todos los tests existentes siguen verdes (el cuarto parámetro es opcional, ningún llamador actual lo pasa).

- [ ] **Step 7: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/vertice.test.js
git commit -m "feat(laser): espejo-vertice, geometria del trazador"
```

---

## Task 2: Llegada obligatoria al centro

**Files:**
- Modify: `scripts/laser-triangular-logic.js:19` (nueva constante `EPS_ALINEADO`)
- Modify: `scripts/laser-triangular-logic.js:259-295` (bloque de transición de celda en `simularHaz`)
- Test: `tests/laser/centro.test.js` (nuevo)

**Interfaces:**
- Consume: `siguienteCruce` (sin cambios, ya exportado internamente en el módulo).
- Cambia el comportamiento observable de `simularHaz`/`simularTodos`/`resuelto`: una entrada desalineada a diana/prisma/condensador deja de contar como llegada.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/laser/centro.test.js
import { describe, it, expect } from 'vitest'
import { simularTodos, resuelto, crearPiezas, normalizaConfig, PIEZA } from '../../scripts/laser-triangular-logic.js'

describe('llegada obligatoria al centro', () => {
  it('un hijo de prisma entra a su diana desalineado: no cuenta, el rayo sigue de largo', () => {
    // Prisma en (2,4): su hijo azul (giro 'ne') visita la celda de la diana
    // (2,5) pero por su borde, no por el centro -- es el mismo patron
    // geometrico que motivo esta funcionalidad (ver el spec). Antes de este
    // cambio cualquier visita bastaba para contar como diana; ahora hace
    // falta pasar por el centro.
    const config = normalizaConfig({
      size: 7, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 3, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 2, col: 5, color: 'azul' }, { row: 5, col: 6, color: 'rojo' }],
      blocks: []
    })
    const piezas = crearPiezas(7)
    piezas[2][4] = PIEZA.PRISMA
    const { tramos } = simularTodos(config, piezas)
    const azul = tramos.find((t) => t.color === 'azul')
    // Visita la celda destino (sigue en su squaresPath) pero no se detiene
    // ahi: continua hasta salir del tablero.
    expect(azul.squaresPath.some((p) => p.row === 2 && p.col === 5)).toBe(true)
    expect(azul.resultado).not.toBe('diana')
    expect(resuelto(config, piezas)).toBe(false)
  })

  it('la misma diana, alcanzada en linea recta horizontal (alineada), si resuelve', () => {
    const configRecto = normalizaConfig({
      size: 4, modo: 'clasico',
      lasers: [{ emitter: { row: 1, col: 0, dir: 'right' }, target: { row: 1, col: 3 } }],
      blocks: []
    })
    const piezas = crearPiezas(4)
    const { tramos } = simularTodos(configRecto, piezas)
    expect(tramos[0].resultado).toBe('diana')
    expect(resuelto(configRecto, piezas)).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/centro.test.js`
Expected: FAIL en el primer test — `resultado` es `'diana'` porque hoy cualquier entrada cuenta.

- [ ] **Step 3: Añadir la constante de tolerancia**

Junto a `const EPS = 1e-9;` (línea 19):

```js
const EPS = 1e-9;
// Tolerancia para "¿el rayo pasó por el centro exacto?". Mayor que EPS a
// propósito: el punto de arranque de emisor/prisma/condensador está
// deliberadamente desplazado del centro (ARRANQUE, más abajo) para evitar
// singularidades, y ese desplazamiento se propaga como un residuo del
// orden de una milésima de celda tras una reflexión. 0.02 lo absorbe sin
// aceptar una entrada genuinamente descentrada.
const EPS_ALINEADO = 0.02;
```

- [ ] **Step 4: Reescribir el tramo de transición de celda**

Sustituir, en `simularHaz` (líneas 259-295 del archivo original — ya desplazadas por el Task 1, buscar por el contenido), este bloque:

```js
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
```

por:

```js
      let nr = r, nc = c, nlx = lx, nly = ly;
      if (hit.line === 'top') { nr = r - 1; nly = 1; nlx = hit.x; }
      else if (hit.line === 'bottom') { nr = r + 1; nly = 0; nlx = hit.x; }
      else if (hit.line === 'left') { nc = c - 1; nlx = 1; nly = hit.y; }
      else if (hit.line === 'right') { nc = c + 1; nlx = 0; nly = hit.y; }

      puntos.push({ x: c + hit.x, y: r + hit.y });
      if (!dentro(nr, nc)) { resultado = 'fuera'; break; }

      const clave = `${nr},${nc}`;
      if (bloqueadas.has(clave)) { resultado = 'bloqueo'; break; }
      // Cualquier emisor, propio o ajeno, absorbe el rayo, alineado o no:
      // esta regla no depende de la geometria fina. Una sola regla.
      if (emisores.has(clave)) {
        squaresPath.push({ row: nr, col: nc });
        puntos.push({ x: nc + 0.5, y: nr + 0.5 });
        resultado = 'emisor';
        break;
      }

      // Diana, prisma y condensador YA NO disparan al cruzar hacia su
      // celda: hace falta entrar Y llegar al centro exacto antes de tocar
      // cualquier borde. Si no, la pieza no hace nada -- el rayo sigue
      // marchando dentro de esta celda como si estuviera vacia.
      r = nr; c = nc; lx = nlx; ly = nly;
      squaresPath.push({ row: r, col: c });

      const diana = dianas.get(`${r},${c}`);
      const pieza = piezas[r][c];
      if (diana || pieza === PIEZA.PRISMA || pieza === PIEZA.CONDENSADOR) {
        const hitCentro = siguienteCruce(lx, ly, dx, dy);
        const alineado = hitCentro
          && Math.abs(hitCentro.x - 0.5) < EPS_ALINEADO
          && Math.abs(hitCentro.y - 0.5) < EPS_ALINEADO;
        if (alineado) {
          puntos.push({ x: c + 0.5, y: r + 0.5 });
          if (diana) {
            resultado = diana.color === seg.color ? 'diana' : 'diana-ajena';
          } else {
            resultado = pieza === PIEZA.PRISMA
              ? entraEnPrisma(seg, r, c, dx, dy, pendientes)
              : entraEnCondensador(seg, r, c, dx, dy, pendientes, llegadasCondensador);
          }
          break;
        }
        // no alineado: no cuenta como llegada, se sigue marchando dentro
        // de esta misma celda con el siguiente `hit` (siguiente vuelta del
        // for).
      }
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/laser/centro.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/centro.test.js
git commit -m "feat(laser): diana/prisma/condensador exigen llegar al centro"
```

---

## Task 3: Verificación de regresión sobre el trazador existente

**Files:**
- Modify (si hace falta): `tests/laser/trazador.test.js`, `tests/laser/prisma.test.js`, `tests/laser/condensador.test.js`, `tests/laser/generador.test.js`, `tests/laser/busqueda.test.js`, `tests/laser/validador.test.js`, `tests/laser/hints.test.js`, `tests/laser/compatibilidad.test.js`, `tests/laser/ejes.test.js`, `tests/laser/normaliza.test.js`
- Modify (si hace falta): `scripts/generate-daily-reto.js` no debería tocarse; si `scripts/test-generator.js` falla, ver Task 5 primero.

Este task es de verificación, no de features nuevas: las Tareas 1 y 2 pueden haber dejado sin resolver algún fixture que dependía de una entrada desalineada (poco probable en clásico con espejos de celda normales, porque un espejo de celda ya realinea al reflejar — pero hay que comprobarlo, no asumirlo).

- [ ] **Step 1: Correr toda la suite de láser**

Run: `npx vitest run tests/laser/`
Expected: si algo falla, anota qué test y qué aserción.

- [ ] **Step 2: Por cada fallo, diagnosticar antes de tocar nada**

Para cada test que falle: comprobar con un script suelto (`node -e "..."`, como en la sesión de diseño) si la entrada a la diana en ese fixture es realmente desalineada. Si lo es, el fixture necesita un espejo-vértice adicional para seguir siendo un reto válido bajo la regla nueva — añadirlo al test, no relajar la regla. Si el test fallaba por un motivo distinto (typo, orden de argumentos), corregir el test.

- [ ] **Step 3: Correr `scripts/test-generator.js`**

Run: `node scripts/test-generator.js`
Expected: PASS. Si falla generando `laser-triangular`, es señal de que `construirPrisma`/`construirCondensador` producen con frecuencia soluciones desalineadas que hoy se aceptaban — anotarlo, se resuelve en la Tarea 5 (no relajar la regla de centro para que este script pase).

- [ ] **Step 4: Commit (solo si hubo cambios)**

```bash
git add tests/laser/
git commit -m "test(laser): ajusta fixtures a la llegada obligatoria al centro"
```

---

## Task 4: Espejo-vértice en la búsqueda de piezas mínimas

**Files:**
- Modify: `scripts/laser-triangular-logic.js:353-369` (`celdasLibres` — añadir equivalente para vértices)
- Modify: `scripts/laser-triangular-logic.js:392-460` (`resolverPiezas`)
- Modify: `scripts/laser-triangular-logic.js:385-388` (`piezasMinimas`, para pasar por la cuenta total de vértices también)
- Test: `tests/laser/busqueda.test.js` (extender)

(Números de línea contra el archivo antes de las Tasks 1-2; ubicar por nombre de función, que no cambia de sitio.)

**Interfaces:**
- Produce: `verticesLibres(config) -> {row, col}[]` (nombrados `row`/`col` para no introducir un tercer vocabulario — representan `R`/`C`).
- `resolverPiezas(config, tope)` sigue devolviendo `{ piezas, total }`, pero ahora `total` cuenta piezas de celda **más** piezas de vértice, y el resultado gana un campo `piezasVertice` junto a `piezas`.

- [ ] **Step 1: Escribir el test que falla**

```js
// en tests/laser/busqueda.test.js, añadir:
import { resolverPiezas, normalizaConfig } from '../../scripts/laser-triangular-logic.js'

describe('busqueda con espejo-vertice', () => {
  it('encuentra una solucion que solo es alcanzable con un espejo-vertice', () => {
    // Emisor 'ne' en (2,0); diana 'neutro-1' en (0,2). En linea recta 'ne'
    // desde (2,0) se sale del tablero por arriba sin tocar (0,2): hace
    // falta desviar con un espejo-vertice para entrar alineado.
    const config = normalizaConfig({
      size: 3, modo: 'clasico',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'ne' }, target: { row: 0, col: 2 } }],
      blocks: []
    })
    const sol = resolverPiezas(config, 3)
    expect(sol).not.toBeNull()
    expect(sol.piezasVertice).toBeDefined()
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/busqueda.test.js`
Expected: FAIL — `sol.piezasVertice` es `undefined` (la búsqueda de hoy no coloca vértices).

- [ ] **Step 3: Añadir `verticesLibres` junto a `celdasLibres`**

Después de `celdasLibres` (línea 369):

```js
// Vertices donde se puede anclar un espejo-vertice: para horizontal hacen
// falta columna-1 y columna dentro del tablero (necesita celda a cada
// lado); para vertical, fila-1 y fila. Un mismo vertice puede admitir uno
// u otro tipo (o ninguno) segun esa disponibilidad; celdasLibres no aplica
// aqui porque un vertice no "pertenece" a una celda concreta.
export function verticesLibres(config) {
  const libres = [];
  for (let R = 0; R <= config.size; R++) {
    for (let C = 0; C <= config.size; C++) {
      const horizPosible = C >= 1 && C <= config.size - 1;
      const vertPosible = R >= 1 && R <= config.size - 1;
      if (horizPosible || vertPosible) libres.push({ row: R, col: C });
    }
  }
  return libres;
}
```

- [ ] **Step 4: Extender `resolverPiezas` para probar vértices**

`resolverPiezas` (línea 392) gana `piezasVertice` junto a `piezas`, y el bucle de búsqueda prueba también los vértices que tocan los tramos actuales. Reemplazar el cuerpo de la función (392-460) por:

```js
export function resolverPiezas(config, tope) {
  const c = normalizaConfig(config);
  const piezas = crearPiezas(c.size);
  const piezasVertice = crearPiezasVertice(c.size);
  if (resuelto(c, piezas, piezasVertice)) return { piezas, piezasVertice, total: 0 };

  const libres = new Set(celdasLibres(c).map((x) => `${x.row},${x.col}`));
  const verticesPosibles = verticesLibres(c);
  const tipos = tiposDisponibles(c.modo);
  const puestas = [];
  const fallidos = new Set();

  const buscar = (restantes) => {
    if (restantes === 0) return resuelto(c, piezas, piezasVertice);
    const firma = `${restantes}|${[...puestas].sort().join(' ')}`;
    if (fallidos.has(firma)) return false;

    const { tramos } = simularTodos(c, piezas, piezasVertice);
    const vistas = new Set();
    const candidatasCelda = [];
    const recogeDe = (lista) => {
      for (const tramo of lista) {
        for (const { row, col } of tramo.squaresPath) {
          const k = `${row},${col}`;
          if (vistas.has(k) || !libres.has(k) || piezas[row][col] !== PIEZA.VACIO) continue;
          vistas.add(k);
          candidatasCelda.push({ row, col });
        }
      }
    };
    const sinResolver = tramos.filter((t) => t.resultado !== 'diana');
    const resueltos = tramos.filter((t) => t.resultado === 'diana');
    recogeDe(sinResolver);
    recogeDe(resueltos);

    for (const { row, col } of candidatasCelda) {
      for (const tipo of tipos) {
        piezas[row][col] = tipo;
        puestas.push(`c${row},${col}:${tipo}`);
        if (buscar(restantes - 1)) return true;
        puestas.pop();
        piezas[row][col] = PIEZA.VACIO;
      }
    }

    // Vertices: mismos dos tipos, sin diagonales. Se prueban todos los
    // vertices posibles (no solo los que tocan squaresPath, porque un
    // vertice vive en el BORDE, no dentro de una celda del camino) --
    // acotado por verticesLibres, que ya descarta los que no admiten
    // ningun tipo.
    for (const { row: R, col: C } of verticesPosibles) {
      if (piezasVertice[R][C] !== PIEZA.VACIO) continue;
      const opciones = [];
      if (C >= 1 && C <= c.size - 1) opciones.push(PIEZA.HORIZ);
      if (R >= 1 && R <= c.size - 1) opciones.push(PIEZA.VERT);
      for (const tipo of opciones) {
        piezasVertice[R][C] = tipo;
        puestas.push(`v${R},${C}:${tipo}`);
        if (buscar(restantes - 1)) return true;
        puestas.pop();
        piezasVertice[R][C] = PIEZA.VACIO;
      }
    }

    fallidos.add(firma);
    return false;
  };

  for (let k = 1; k <= tope; k++) {
    if (buscar(k)) {
      return {
        piezas: piezas.map((f) => [...f]),
        piezasVertice: piezasVertice.map((f) => [...f]),
        total: k
      };
    }
  }
  return null;
}
```

- [ ] **Step 5: Propagar `piezasVertice` por `simularTodos`/`resuelto`/`piezasMinimas`**

`simularTodos` (línea 308) y `resuelto` (línea 341) ganan el mismo parámetro opcional que `simularHaz` (Task 1 ya lo dejó opcional ahí; aquí se propaga hacia arriba):

```js
export function simularTodos(config, piezas, piezasVertice) {
  const c = normalizaConfig(config);
  const pv = piezasVertice || crearPiezasVertice(c.size);
  const tramos = c.lasers.flatMap((l) => simularHaz(c, piezas, l, pv).tramos);
  // ... resto sin cambios ...
}

export function resuelto(config, piezas, piezasVertice) {
  const c = normalizaConfig(config);
  const { cruces, dianasAlcanzadas } = simularTodos(c, piezas, piezasVertice);
  return c.targets.length > 0 && cruces.size === 0 &&
    c.targets.every((t) => dianasAlcanzadas.has(`${t.row},${t.col}`));
}
```

`piezasMinimas` (línea 385) no cambia de firma — sigue devolviendo solo el conteo total, que ahora incluye vértices porque delega en `resolverPiezas`:

```js
export function piezasMinimas(config, tope) {
  const sol = resolverPiezas(config, tope);
  return sol === null ? null : sol.piezas.flat().filter(Boolean).length
    + sol.piezasVertice.flat().filter(Boolean).length;
}
```

- [ ] **Step 6: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/laser/busqueda.test.js`
Expected: PASS

- [ ] **Step 7: Correr toda la suite de láser otra vez**

Run: `npx vitest run tests/laser/`
Expected: PASS. `piezasMinimasExhaustivo` (usado solo como contraste en tests) no se toca — si algún test lo compara contra `piezasMinimas` sobre un tablero con vértice necesario, fallará por diseño (exhaustivo no conoce vértices); si eso ocurre, acotar ese test a tableros sin necesidad de vértice, dejando anotado por qué.

- [ ] **Step 8: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/busqueda.test.js
git commit -m "feat(laser): la busqueda de piezas minimas prueba tambien espejos-vertice"
```

---

## Task 5: Generador — insertar espejo-vértice cuando hace falta

**Files:**
- Modify: `scripts/laser-triangular-logic.js:649-695` (`construirPrisma`, partido en `construirArbolPrisma` + `construirPrisma`)
- Modify: `scripts/laser-triangular-logic.js:699-730` (`construirCondensador`, reescrito sobre `construirArbolPrisma`)
- Modify: `scripts/laser-triangular-logic.js:616-644` (`construirClasico`)
- Modify: `scripts/laser-triangular-logic.js:760-790` (`buildLaserPuzzle`)
- Test: `tests/laser/generador.test.js` (extender)

Los números de línea de arriba son los del archivo **antes** de las Tareas 1-4; usarlos solo para ubicarse por contenido (nombre de función), no como offsets exactos, ya que Tasks 1-4 ya insertaron código antes de este punto.

**Interfaces:**
- Cada `construir*` sigue devolviendo `{ modo, size, lasers, targets, piezas }`, y gana `piezasVertice` en ese mismo objeto.
- `buildLaserPuzzle(seed)` gana `solucion.piezasVertice` junto a `solucion.piezas`.

- [ ] **Step 1: Escribir el test que falla**

```js
// en tests/laser/generador.test.js, añadir:
import { buildLaserPuzzle, resuelto, crearPiezas, crearPiezasVertice } from '../../scripts/laser-triangular-logic.js'

describe('generador: llegada alineada por construccion', () => {
  it('barriendo 200 seeds, todo puzzle de prisma/condensador resuelve con su solucion guardada', () => {
    let vistos = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let puzzle;
      try { puzzle = buildLaserPuzzle(seed); } catch { continue; }
      if (puzzle.modo === 'clasico') continue;
      vistos++;
      const config = { size: puzzle.size, modo: puzzle.modo, lasers: puzzle.lasers, targets: puzzle.targets, blocks: puzzle.blocks };
      const pv = puzzle.solucion.piezasVertice || crearPiezasVertice(puzzle.size);
      expect(resuelto(config, puzzle.solucion.piezas, pv)).toBe(true);
    }
    expect(vistos).toBeGreaterThan(20); // el barrido de verdad toco casos prisma/condensador
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/generador.test.js`
Expected: FAIL en algunos seeds — `resuelto(...)` da `false` porque la construcción de hoy no realinea.

- [ ] **Step 3: Función compartida para realinear una pierna**

Recibe el árbol completo ya construido (`config` con sus dianas/condensador reales, o vacías si aún no existen — ver Steps 4-5), el `color` del tramo a comprobar y el `destino` exacto (`{row,col}`) al que ese tramo debe llegar. Se necesita `destino` explícito porque, bajo la regla de llegada al centro (Task 2), un tramo que entra desalineado **no se detiene** en esa celda — sigue de largo — así que ni "el último punto de `squaresPath`" ni "`resultado === 'diana'`" identifican por sí solos dónde estaba tratando de llegar. Añadir antes de `construirPrisma` (línea 649):

```js
// Resultados que cuentan como "el tramo se detuvo aqui, a proposito": el
// mismo criterio que usa la victoria (diana) mas los dos de piezas
// intermedias (prisma se ve solo desde la raiz; condensador y su segunda
// llegada, desde un hijo).
const RESULTADOS_DETENIDOS = new Set(['diana', 'prisma', 'condensador', 'condensador-mezcla']);

// Traza el arbol y mira si el tramo de `color` se detiene exactamente en
// `destino`. Devuelve null si ese color ni aparece en el arbol (algo
// previo fue mal); si no, { propio, idx, ok }, con `idx` la posicion de
// `destino` dentro de squaresPath (para localizar el borde de entrada si
// `ok` es false).
function llegaA(config, piezas, piezasVertice, laserRaiz, color, destino) {
  const { tramos } = simularHaz(config, piezas, laserRaiz, piezasVertice);
  const propio = tramos.find((t) => t.color === color);
  if (!propio) return null;
  const idx = propio.squaresPath.findIndex((p) => p.row === destino.row && p.col === destino.col);
  if (idx === -1) return { propio, idx, ok: false };
  const ok = idx === propio.squaresPath.length - 1 && RESULTADOS_DETENIDOS.has(propio.resultado);
  return { propio, idx, ok };
}

// Si `llegaA` ya da ok, no hace nada. Si no, calcula el espejo-vertice que
// realinea la entrada a `destino` y lo coloca (mutando `piezasVertice`).
// `null` si no hay hueco o si, tras colocarlo, sigue sin alinear.
function realineaSiHaceFalta(config, piezas, piezasVertice, laserRaiz, color, destino) {
  const estado = llegaA(config, piezas, piezasVertice, laserRaiz, color, destino);
  if (!estado) return null;
  if (estado.ok) return { piezas, piezasVertice };
  if (estado.idx <= 0) return null; // sin celda previa, no hay borde que corregir

  const fin = estado.propio.squaresPath[estado.idx];
  const previo = estado.propio.squaresPath[estado.idx - 1];

  // Vertice y orientacion salen del borde compartido entre `previo` y
  // `fin`: si comparten fila, el borde es vertical (columna constante); si
  // comparten columna, es horizontal (fila constante).
  let R, C, tipo;
  if (previo.row === fin.row) {
    tipo = PIEZA.VERT;
    C = Math.max(previo.col, fin.col);
    R = fin.row; // se prueban los dos vertices R y R+1 de ese borde
  } else {
    tipo = PIEZA.HORIZ;
    R = Math.max(previo.row, fin.row);
    C = fin.col;
  }

  for (const [rr, cc] of tipo === PIEZA.VERT ? [[R, C], [R + 1, C]] : [[R, C], [R, C + 1]]) {
    if (rr < 0 || rr > config.size || cc < 0 || cc > config.size) continue;
    if (piezasVertice[rr][cc] !== PIEZA.VACIO) continue;
    piezasVertice[rr][cc] = tipo;
    const retrazado = llegaA(config, piezas, piezasVertice, laserRaiz, color, destino);
    if (retrazado && retrazado.ok) return { piezas, piezasVertice };
    piezasVertice[rr][cc] = PIEZA.VACIO;
  }
  return null;
}
```

- [ ] **Step 4: Separar la construcción del árbol, y usar `realineaSiHaceFalta` en `construirPrisma`**

`construirCondensador` reutiliza hoy `construirPrisma` entero (línea 700-701: `const previo = construirPrisma(rand, size); ...`), pero eso ya no vale: la realineación de `construirPrisma` apunta a las dianas **propias** del modo prisma, que el modo condensador ni usa ni necesita, y podría fallar (o desviar los hijos) por una razón que no le afecta. Hace falta partir `construirPrisma` en dos: el árbol compartido (emisor + prisma + espejos opcionales, sin dianas todavía) y el cierre específico de cada modo.

Sustituir `construirPrisma` completo (línea 649-695) por:

```js
// Emisor + prisma en su trayecto + hasta un espejo opcional por hijo, SIN
// decidir todavia donde van las dianas: eso es distinto en prisma (cada
// hijo a la suya) y en condensador (los dos al mismo condensador, y solo
// despues una diana para el magenta resultante).
function construirArbolPrisma(rand, size) {
  const piezas = crearPiezas(size);
  const emisor = colocaEmisor(rand, size, piezas);
  if (!emisor) return null;
  const laser = { emitter: emisor, color: 'neutro' };
  const base = { size, modo: 'prisma', lasers: [laser], targets: [], blocks: [] };

  const tronco = simularHaz(base, piezas, laser).tramos[0].squaresPath.slice(1);
  if (!tronco.length) return null;
  const sitio = elegir(rand, tronco);
  piezas[sitio.row][sitio.col] = PIEZA.PRISMA;

  for (let k = 0; k < 2; k++) {
    const hijosParciales = simularHaz(base, piezas, laser).tramos.filter((t) => t.color !== 'neutro');
    if (hijosParciales.length < 2) return null;
    const hijo = hijosParciales[k];
    const libres = hijo.squaresPath.slice(1).filter((p) => piezas[p.row][p.col] === PIEZA.VACIO);
    if (!libres.length || rand() < 0.3) continue;
    const celda = elegir(rand, libres);
    piezas[celda.row][celda.col] = elegir(rand, [PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ]);
  }

  const hijos = simularHaz(base, piezas, laser).tramos.filter((t) => t.color !== 'neutro');
  if (hijos.length !== 2) return null;
  return { laser, piezas, hijos };
}

function construirPrisma(rand, size) {
  const arbol = construirArbolPrisma(rand, size);
  if (!arbol) return null;
  const { laser, piezas, hijos } = arbol;

  const targets = hijos.map((h) => {
    const fin = h.squaresPath[h.squaresPath.length - 1];
    return { row: fin.row, col: fin.col, color: h.color };
  });
  if (targets[0].row === targets[1].row && targets[0].col === targets[1].col) return null;
  if (targets.some((t) => piezas[t.row][t.col] !== PIEZA.VACIO)) return null;
  if (targets.some((t) => t.row === laser.emitter.row && t.col === laser.emitter.col)) return null;
  const ocupadas = [laser.emitter, ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  const piezasVertice = crearPiezasVertice(size);
  const baseConTargets = { size, modo: 'prisma', lasers: [laser], targets, blocks: [] };
  for (const hijo of hijos) {
    const destino = targets.find((t) => t.color === hijo.color);
    const ok = realineaSiHaceFalta(baseConTargets, piezas, piezasVertice, laser, hijo.color, destino);
    if (!ok) return null;
  }

  return { modo: 'prisma', size, lasers: [laser], targets, piezas, piezasVertice };
}
```

- [ ] **Step 5: Reescribir `construirCondensador` sobre `construirArbolPrisma`**

Sustituir `construirCondensador` completo (línea 699-730) por:

```js
function construirCondensador(rand, size) {
  const arbol = construirArbolPrisma(rand, size);
  if (!arbol) return null;
  const { laser, piezas, hijos } = arbol;
  const lasers = [laser];
  const base = { size, modo: 'condensador', lasers, targets: [], blocks: [] };

  const enAzul = new Set(hijos[0].squaresPath.map((p) => `${p.row},${p.col}`));
  const comunes = hijos[1].squaresPath.filter((p) =>
    enAzul.has(`${p.row},${p.col}`) && piezas[p.row][p.col] === PIEZA.VACIO);
  if (!comunes.length) return null;
  const sitio = elegir(rand, comunes);
  piezas[sitio.row][sitio.col] = PIEZA.CONDENSADOR;

  // Los dos hijos tienen que entrar alineados al condensador ANTES de que
  // nada dependa de la mezcla: sin esto, un hijo desalineado simplemente
  // no cuenta como llegada (Task 2) y el condensador nunca funde nada.
  const piezasVertice = crearPiezasVertice(size);
  for (const hijo of hijos) {
    const ok = realineaSiHaceFalta(base, piezas, piezasVertice, laser, hijo.color, sitio);
    if (!ok) return null;
  }

  const magenta = simularHaz(base, piezas, laser, piezasVertice).tramos.find((t) => t.color === 'magenta');
  if (!magenta) return null;
  const fin = magenta.squaresPath[magenta.squaresPath.length - 1];
  if (piezas[fin.row][fin.col] !== PIEZA.VACIO) return null;
  if (fin.row === laser.emitter.row && fin.col === laser.emitter.col) return null;
  const targets = [{ row: fin.row, col: fin.col, color: 'magenta' }];

  const ocupadas = [laser.emitter, ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  // Y el propio magenta, ya fundido, tiene que entrar alineado a SU diana.
  const baseConDiana = { size, modo: 'condensador', lasers, targets, blocks: [] };
  const okFinal = realineaSiHaceFalta(baseConDiana, piezas, piezasVertice, laser, 'magenta', fin);
  if (!okFinal) return null;

  return { modo: 'condensador', size, lasers, targets, piezas, piezasVertice };
}
```

- [ ] **Step 6: `construirClasico` también puede necesitarlo**

En `construirClasico` (línea 616), cada láser ya tiene su propio color (`neutro-1`/`neutro-2`) y su propio `target`, calculados por `construirUnLaser` (sin cambios). Sustituir el cuerpo de `construirClasico` (línea 616-644) por:

```js
function construirClasico(rand, size) {
  const piezas = crearPiezas(size);
  const piezasVertice = crearPiezasVertice(size);
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

    const baseUno = { size, modo: 'clasico', lasers: [hecho.laser], targets: [hecho.target], blocks: [] };
    const ok = realineaSiHaceFalta(baseUno, piezas, piezasVertice, hecho.laser, hecho.laser.color, hecho.target);
    if (!ok) return null;
    // El camino real (tras la posible realineacion) es el que hay que
    // vetar para el siguiente laser, no `hecho.camino` (que es de antes).
    simularHaz(baseUno, piezas, hecho.laser, piezasVertice).tramos[0]
      .squaresPath.forEach(({ row, col }) => vetadas.add(`${row},${col}`));
  }

  const ocupadas = [...lasers.map((l) => l.emitter), ...targets];
  if (ocupadas.some((p) => piezas[p.row][p.col] !== PIEZA.VACIO)) return null;

  return { modo: 'clasico', size, lasers, targets, piezas, piezasVertice };
}
```

- [ ] **Step 7: Propagar en `buildLaserPuzzle`**

En `buildLaserPuzzle` (línea 760), donde hoy se hace:

```js
    if (resuelto(config, crearPiezas(size))) continue;
    if (!resuelto(config, hecho.piezas)) continue;
    if (piezasMinimas(config, total - 1) !== null) continue;
```

pasar el tercer argumento en las dos llamadas a `resuelto`:

```js
    if (resuelto(config, crearPiezas(size), crearPiezasVertice(size))) continue;
    if (!resuelto(config, hecho.piezas, hecho.piezasVertice)) continue;
    if (piezasMinimas(config, total - 1) !== null) continue;
```

y en el objeto devuelto, `total` debe contar también los vértices:

```js
    const total = hecho.piezas.flat().filter(Boolean).length
      + hecho.piezasVertice.flat().filter(Boolean).length;
    // ...
    return {
      variant, modo, size, lasers: hecho.lasers, targets: hecho.targets, blocks,
      min_piezas: total,
      dificultad: Math.min(5, base + (modo === 'clasico' ? 0 : 1)),
      solucion: { piezas: hecho.piezas.map((f) => [...f]), piezasVertice: hecho.piezasVertice.map((f) => [...f]) },
      intentos: intento + 1
    };
```

- [ ] **Step 8: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/laser/generador.test.js`
Expected: PASS

- [ ] **Step 9: Correr el smoke test del generador**

Run: `node scripts/test-generator.js`
Expected: PASS. Si `MAX_INTENTOS` empieza a agotarse con frecuencia (porque ahora se descartan más intentos cuando ni siquiera la realineación encuentra hueco), medirlo aquí y anotarlo — no subir `MAX_INTENTOS` sin medir antes, siguiendo el patrón que ya documenta el propio archivo junto a esa constante.

- [ ] **Step 10: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/generador.test.js
git commit -m "feat(laser): el generador inserta espejo-vertice cuando la llegada no alinea"
```

---

## Task 6: Interfaz — estado y dibujo de piezas de vértice

**Files:**
- Modify: `plantillas/laser_triangular.js:163-169` (estado inicial)
- Modify: `plantillas/laser_triangular.js:236-247` (montaje del tablero: capa de vértices)
- Modify: `plantillas/laser_triangular.js:452-454` (`simularTodos` local)
- Modify: `plantillas/laser_triangular.js:397-413, 474-482` (`onCellClick`, `lanzar`: pasar `piezasVertice`)
- Modify: `plantillas/laser_triangular.js:484-535` (`refresh`: repintar vértices)
- Modify: `style.css` (nueva clase `.laser-vertice`)
- Test: `tests/plantillas/laser-vertice.test.js` (nuevo, monta la plantilla con happy-dom)

**Interfaces:**
- Produce: `state.piezasVertice` (mismo ciclo de vida que `state.piezas`).
- Consume: `crearPiezasVertice`, `PIEZA` (ya importados o a importar de `scripts/laser-triangular-logic.js`).

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/plantillas/laser-vertice.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '../../plantillas/laser_triangular.js'

// Payload minimo, modo clasico, tamaño pequeño para autoTraza.
const DATA = {
  variant: 'pequeno', modo: 'clasico', size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 0, col: 4 } },
    { emitter: { row: 4, col: 0, dir: 'right' }, target: { row: 4, col: 4 } }
  ],
  blocks: []
}

describe('plantilla laser: overlay de vertices', () => {
  let root
  beforeEach(() => { root = document.createElement('div') })

  it('monta una capa de vertices clicable dentro de laser-board-stack', async () => {
    await render(root, DATA, {})
    const capa = root.querySelector('.laser-vertice-layer')
    expect(capa).not.toBeNull()
    // (size+1)^2 = 36 vertices posibles como blancos clicables.
    expect(capa.querySelectorAll('.laser-vertice').length).toBe(36)
  })

  it('tocar un vertice interior lo arma y lo coloca', async () => {
    await render(root, DATA, {})
    const trayHoriz = root.querySelector('[aria-label="Espejo horizontal"]')
    trayHoriz.click()
    const vertice = root.querySelector('.laser-vertice[data-r="2"][data-c="2"]')
    vertice.click()
    expect(vertice.dataset.pieza).toBe('horiz')
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/plantillas/laser-vertice.test.js`
Expected: FAIL — no existe `.laser-vertice-layer`.

- [ ] **Step 3: Importar `crearPiezasVertice` y añadir estado**

En el bloque de imports (línea 29-32):

```js
import {
  DIR_VECTOR, normalizaConfig, crearPiezas, crearPiezasVertice, resuelto, PIEZA, tiposDisponibles,
  simularTodos as trazarTodos
} from '../scripts/laser-triangular-logic.js';
```

En `state` (línea 163-169):

```js
  const state = {
    piezas: crearPiezas(n),
    piezasVertice: crearPiezasVertice(n),
    won: false,
    trazado: autoTraza,
    armada: null,
    arrastrando: false
  };
```

- [ ] **Step 4: Montar la capa de vértices**

Tras `boardStack.appendChild(svg);` (línea 245), antes de `boardWrap.appendChild(boardStack);` (línea 246):

```js
  const verticeLayer = createElement('div', { class: 'laser-vertice-layer' });
  const verticeEls = [];
  for (let R = 0; R <= n; R++) {
    const fila = [];
    for (let C = 0; C <= n; C++) {
      const horizPosible = C >= 1 && C <= n - 1;
      const vertPosible = R >= 1 && R <= n - 1;
      const btn = createElement('button', { class: 'laser-vertice', type: 'button' });
      btn.dataset.r = R;
      btn.dataset.c = C;
      btn.style.left = `calc(var(--laser-cell-size) * ${C})`;
      btn.style.top = `calc(var(--laser-cell-size) * ${R})`;
      if (!horizPosible && !vertPosible) btn.hidden = true;
      btn.addEventListener('click', () => onVerticeClick(R, C, horizPosible, vertPosible));
      verticeLayer.appendChild(btn);
      fila.push(btn);
    }
    verticeEls.push(fila);
  }
  boardStack.appendChild(verticeLayer);
```

- [ ] **Step 5: Añadir `onVerticeClick`, junto a `onCellClick`**

Después de `onCellClick` (línea 413):

```js
  // Igual que onCellClick, pero para un vertice: tocar uno ocupado lo
  // retira; con una pieza armada de tipo VERT u HORIZ (las unicas que
  // tienen anclaje de vertice) y hueco disponible para ese tipo, lo coloca.
  function onVerticeClick(R, C, horizPosible, vertPosible) {
    if (state.won) return;
    if (state.piezasVertice[R][C] !== PIEZA.VACIO) {
      state.piezasVertice[R][C] = PIEZA.VACIO;
    } else if (state.armada === PIEZA.HORIZ && horizPosible) {
      state.piezasVertice[R][C] = PIEZA.HORIZ;
    } else if (state.armada === PIEZA.VERT && vertPosible) {
      state.piezasVertice[R][C] = PIEZA.VERT;
    } else {
      return;
    }
    apagaTrazo();
    if (!autoTraza) return;
    if (resuelto(config, state.piezas, state.piezasVertice)) { declararVictoria(); return; }
    const { cruces, tramos } = simularTodos();
    const estado = mensajeDeEstado(tramos, cruces);
    setStatus(ui.status, estado ? estado.texto : 'Sigue ajustando los espejos', estado ? estado.tipo : 'ok');
  }
```

- [ ] **Step 6: Pasar `piezasVertice` en cada llamada al trazador**

`simularTodos` local (línea 452-454):

```js
  function simularTodos() {
    return trazarTodos(config, state.piezas, state.piezasVertice);
  }
```

`onCellClick` (línea 409) y `lanzar` (línea 479), cambiar `resuelto(config, state.piezas)` por `resuelto(config, state.piezas, state.piezasVertice)` en ambos sitios.

`btnReset` (línea 344-359), añadir `state.piezasVertice = crearPiezasVertice(n);` junto a `state.piezas = crearPiezas(n);`.

- [ ] **Step 7: Repintar vértices en `refresh`**

Al principio de `refresh()` (tras el bucle de celdas, línea 493, antes del `if (!autoTraza && !state.trazado) return;`):

```js
    for (let R = 0; R <= n; R++) {
      for (let C = 0; C <= n; C++) {
        const v = state.piezasVertice[R][C];
        verticeEls[R][C].dataset.pieza = v === PIEZA.HORIZ ? 'horiz' : v === PIEZA.VERT ? 'vert' : '';
      }
    }
```

- [ ] **Step 8: CSS para la capa de vértices**

Añadir en `style.css`, cerca de `.laser-cell` (línea ~2421):

```css
.laser-vertice-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.laser-vertice {
  position: absolute;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  z-index: 2;
}
.laser-vertice::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #8891a3;
  opacity: 0;
  border-radius: 2px;
}
.laser-vertice:hover::after { opacity: .5; }
.laser-vertice[data-pieza="horiz"]::after { width: 18px; height: 3px; opacity: 1; background: #ffd23b; }
.laser-vertice[data-pieza="vert"]::after { width: 3px; height: 18px; opacity: 1; background: #ffd23b; }
```

- [ ] **Step 9: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/plantillas/laser-vertice.test.js tests/plantillas/`
Expected: PASS — incluye el resto de `tests/plantillas/` para confirmar que la capa nueva no rompe el montaje de las otras 11 plantillas ni el smoke test de láser existente.

- [ ] **Step 10: Commit**

```bash
git add plantillas/laser_triangular.js style.css tests/plantillas/laser-vertice.test.js
git commit -m "feat(laser): overlay de vertices en la interfaz"
```

---

## Task 7: Interfaz — arrastrar una pieza hasta un vértice

**Files:**
- Modify: `plantillas/laser_triangular.js` (`soltarArrastre`, función del Task 6)

**Interfaces:**
- Consume: `verticeEls` (Task 6), `onVerticeClick` (Task 6).

- [ ] **Step 1: Escribir el test que falla**

```js
// añadir a tests/plantillas/laser-vertice.test.js
it('arrastrar una pieza hasta un vertice lo coloca (con elementFromPoint simulado)', async () => {
  await render(root, DATA, {})
  const vertice = root.querySelector('.laser-vertice[data-r="2"][data-c="2"]')
  const original = document.elementFromPoint
  document.elementFromPoint = () => vertice
  const trayVert = root.querySelector('[aria-label="Espejo vertical"]')
  trayVert.dispatchEvent(new Event('pointerdown'))
  trayVert.dispatchEvent(new Event('pointerup'))
  document.elementFromPoint = original
  expect(vertice.dataset.pieza).toBe('vert')
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/plantillas/laser-vertice.test.js`
Expected: FAIL — `soltarArrastre` solo busca `.closest('.laser-cell')`, ignora `.laser-vertice`.

- [ ] **Step 3: Extender `soltarArrastre`**

Sustituir el cuerpo de `soltarArrastre` (líneas 380-395) por:

```js
  function soltarArrastre(ev) {
    if (!state.arrastrando) return;
    state.arrastrando = false;
    gestoConsumido = true;
    if (typeof document.elementFromPoint !== 'function') return;
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    const vertice = bajo && bajo.closest && bajo.closest('.laser-vertice');
    if (vertice) {
      const R = Number(vertice.dataset.r), C = Number(vertice.dataset.c);
      const horizPosible = C >= 1 && C <= n - 1;
      const vertPosible = R >= 1 && R <= n - 1;
      onVerticeClick(R, C, horizPosible, vertPosible);
      return;
    }
    const celda = bajo && bajo.closest && bajo.closest('.laser-cell');
    if (celda && celda.dataset.fila !== undefined) {
      onCellClick(Number(celda.dataset.fila), Number(celda.dataset.col));
    }
  }
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/plantillas/laser-vertice.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plantillas/laser_triangular.js tests/plantillas/laser-vertice.test.js
git commit -m "feat(laser): arrastrar una pieza hasta un vertice tambien la coloca"
```

---

## Task 8: Validador — cobertura de extremo a extremo

**Files:**
- Test: `tests/laser/validador.test.js` (extender)

`validateLaserData` (`scripts/validate-retos.js:788-884`) no necesita cambios de código: ya delega toda la comprobación de solvencia en `piezasMinimas(c, declarados)`, que las Tareas 1-4 ya volvieron consciente de vértices y de la llegada al centro. Este task es solo prueba de que esa cadena funciona junta.

- [ ] **Step 1: Escribir el test**

`validateLaserData` lee `reto.data.json_url` con `fs.readFile` (es una ruta de fichero real, no una URL de red — ver `scripts/validate-retos.js:793`), así que el test escribe un fichero temporal con el helper `escribe` que el propio fichero ya define (línea 7-12), igual que el resto de tests de este `describe`:

```js
// en tests/laser/validador.test.js, añadir:
import { buildLaserPuzzle } from '../../scripts/laser-triangular-logic.js'

describe('validador: reto de condensador que necesita espejo-vertice', () => {
  it('un reto real generado (seed que cae en condensador) valida sin lanzar', async () => {
    let puzzle;
    for (let seed = 1; seed < 3000; seed++) {
      try {
        const p = buildLaserPuzzle(seed);
        if (p.modo === 'condensador') { puzzle = p; break; }
      } catch { /* sigue */ }
    }
    expect(puzzle).toBeDefined()
    const ruta = await escribe({
      variant: puzzle.variant, modo: puzzle.modo, size: puzzle.size,
      lasers: puzzle.lasers, targets: puzzle.targets, blocks: puzzle.blocks,
      min_piezas: puzzle.min_piezas
    })
    await expect(new RetoValidator().validateLaserData(reto(ruta))).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Ejecutar**

Run: `npx vitest run tests/laser/validador.test.js`
Expected: PASS sin cambios de código en `scripts/validate-retos.js` — es la prueba de que `piezasMinimas` ya extendido (Task 4) es suficiente.

- [ ] **Step 3: Commit**

```bash
git add tests/laser/validador.test.js
git commit -m "test(laser): cobertura de extremo a extremo para un reto con espejo-vertice"
```

---

## Task 9: Auditoría del archivo publicado (sin modificarlo)

**Files:**
- Create: `scripts/audita-laser-alineacion.js`
- Test: `tests/laser/compatibilidad.test.js` (extender)

**Interfaces:**
- Produce: `auditaAlineacion(retos) -> { total, alineados, desalineados: [{fecha, motivo}] }`, función pura, testable sin tocar disco.
- El script CLI (`node scripts/audita-laser-alineacion.js`) lee `lista_retos.json` + `data/`, llama a la función pura, y escribe `data/debug/auditoria-laser-alineacion.json` (un reporte, no un reto).

- [ ] **Step 1: Escribir el test de la función pura**

```js
// en tests/laser/compatibilidad.test.js, añadir:
import { auditaAlineacion } from '../../scripts/audita-laser-alineacion.js'
import { crearPiezas, crearPiezasVertice } from '../../scripts/laser-triangular-logic.js'

describe('auditoria de alineacion sobre configs sueltas', () => {
  it('marca alineado un reto clasico simple sin piezas', () => {
    const config = {
      fecha: '2099-01-01', size: 4, modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 0, col: 3 } }],
      blocks: []
    }
    const r = auditaAlineacion([config])
    expect(r.total).toBe(1)
    expect(r.alineados).toBe(1)
    expect(r.desalineados).toEqual([])
  })

  it('marca desalineado un reto cuya unica solucion minima no alinea', () => {
    // Construido a mano: emisor 'se' con un espejo '\' que lo manda recto
    // hacia una diana con la que solo se encuentra por la esquina, sin
    // hueco para un espejo-vertice (tablero 2x2 no deja vertices interiores
    // en size=2: verticesLibres da vacio).
    const config = {
      fecha: '2099-01-02', size: 2, modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'se' }, target: { row: 1, col: 1 } }],
      blocks: [], min_piezas: 0
    }
    const r = auditaAlineacion([config])
    expect(r.desalineados.map(d => d.fecha)).toContain('2099-01-02')
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/compatibilidad.test.js`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Escribir `scripts/audita-laser-alineacion.js`**

```js
// ===== scripts/audita-laser-alineacion.js =====
// Barrido de solo lectura sobre el archivo publicado de laser-triangular:
// para cada reto, comprueba si la solucion minima real (piezasMinimas, que
// ya conoce la regla de llegada al centro y el espejo-vertice) sigue
// existiendo. No modifica retos/ ni data/ -- solo escribe un reporte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezasMinimas, normalizaConfig } from './laser-triangular-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

// Funcion pura: recibe una lista de configs YA CARGADOS (size/modo/
// lasers/targets/blocks/fecha/min_piezas) y devuelve el diagnostico, sin
// tocar disco -- asi el test la ejercita sin depender de lista_retos.json.
export function auditaAlineacion(configs) {
  const desalineados = [];
  for (const config of configs) {
    const c = normalizaConfig(config);
    const declarado = Number.isInteger(config.min_piezas) ? config.min_piezas : 6;
    const minimo = piezasMinimas(c, Math.max(declarado, 6));
    if (minimo === null) {
      desalineados.push({ fecha: config.fecha, motivo: 'sin solucion bajo la regla nueva' });
    }
  }
  return { total: configs.length, alineados: configs.length - desalineados.length, desalineados };
}

async function main() {
  const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'lista_retos.json'), 'utf8'));
  const configs = [];
  for (const entrada of lista) {
    if (entrada.tipo !== 'laser-triangular') continue;
    const retoPath = path.join(RAIZ, 'retos', `${entrada.fecha}.json`);
    if (!fs.existsSync(retoPath)) continue;
    const reto = JSON.parse(fs.readFileSync(retoPath, 'utf8'));
    const dataPath = path.join(RAIZ, reto.data.json_url);
    if (!fs.existsSync(dataPath)) continue;
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    configs.push({ ...data, fecha: entrada.fecha });
  }
  const reporte = auditaAlineacion(configs);
  const outDir = path.join(RAIZ, 'data', 'debug');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'auditoria-laser-alineacion.json'),
    JSON.stringify(reporte, null, 2)
  );
  console.log(`laser-triangular: ${reporte.alineados}/${reporte.total} alineados, ${reporte.desalineados.length} marcados`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/laser/compatibilidad.test.js`
Expected: PASS

- [ ] **Step 5: Correr el script de verdad sobre el archivo**

Run: `node scripts/audita-laser-alineacion.js`
Expected: imprime el resumen; anotar el número de retos marcados — es la cifra que decide qué hacer con ellos (fuera de alcance de este plan, ver spec sección 9).

- [ ] **Step 6: Commit**

```bash
git add scripts/audita-laser-alineacion.js tests/laser/compatibilidad.test.js
git commit -m "feat(laser): script de auditoria de alineacion sobre el archivo publicado (solo lectura)"
```

---

## Task 10: Muestrario, matriz de debug y verificación final

**Files:**
- No modifica código de producción — regenera artefactos derivados.

- [ ] **Step 1: Regenerar el muestrario**

Run: `node scripts/generate-muestrario.js`
Expected: sale sin error; revisar `git diff data/muestra/laser-triangular.json` — como el esquema del payload no cambió (Constraint global), el diff debería ser vacío o mínimo. Si `min_piezas` cambia para la semilla fija del ejemplo, es señal de que esa semilla ahora necesita un espejo-vértice: normal, dejar el diff.

- [ ] **Step 2: Regenerar la matriz de debug**

Run: `node scripts/generate-debug-matrix.js`
Expected: sale sin error.

- [ ] **Step 3: Suite completa**

Run: `npx vitest run`
Expected: PASS en todo el repo, no solo en `tests/laser/` y `tests/plantillas/`.

- [ ] **Step 4: Smoke test y validación completa**

Run: `node scripts/test-generator.js && node scripts/validate-retos.js --latest`
Expected: PASS.

- [ ] **Step 5: Commit de los artefactos regenerados**

```bash
git add data/muestra/laser-triangular.json data/debug/
git commit -m "chore(laser): regenera muestrario y matriz de debug tras el espejo-vertice"
```
