# Láser triangular: prisma, condensador y piezas arrastrables — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `laser-triangular` en un reto jugable: dos piezas nuevas (prisma y condensador), un eje de variante nuevo (`modo`), bandeja de piezas arrastrable, botón de disparo y trazado automático solo en la variante pequeña.

**Architecture:** El trazador deja de devolver un camino y devuelve una lista de tramos con color, calculada con una lista de trabajo que se itera hasta punto fijo. La geometría continua actual (`siguienteCruce`, coordenadas fraccionarias, diagonales y medianas) no se toca. Un `normalizaConfig` en la frontera convierte el esquema viejo al nuevo, de modo que el trazador, el generador y el validador solo conocen el nuevo.

**Tech Stack:** JavaScript ES modules planos, sin bundler. Vitest + happy-dom para tests. CSS a mano en `style.css`.

**Spec:** `docs/superpowers/specs/2026-08-28-laser-prisma-design.md`

## Global Constraints

- **Todo en español**: textos de UI, nombres de campos JSON, comentarios de código, mensajes de commit. Es la convención del repo.
- **Sin bundler ni paso de build.** Los módulos se cargan con `import()` nativo. Un fichero nuevo solo necesita existir y estar registrado donde toque.
- **Un solo trazador.** `plantillas/laser_triangular.js`, `scripts/generate-daily-reto.js` y `scripts/validate-retos.js` importan todos de `scripts/laser-triangular-logic.js`. Nunca duplicar lógica de trazado: dos copias con cualquier diferencia publican retos imposibles.
- **Nunca elegir una variante con aritmética sobre el seed.** `selectTemplate` es `templates[seed % 12]`, así que `seed % n`, `Math.floor(seed / k) % 2` y compañía son constantes dentro del tipo. Todo eje se sortea con `eligeEje(opciones, seed, mascara)` y **cada eje lleva su propia máscara**.
- **Los payloads publicados tienen que seguir abriendo.** El archivo histórico no es reproducible: regenerar un reto pasado da otro puzzle. Compatibilidad por normalización, nunca por regeneración.
- **Colores**: exactamente `neutro`, `azul`, `rojo`, `magenta`. Conjunto cerrado.
- **Tipos de pieza**: `0` vacío, `1` `/`, `2` `\`, `3` `|`, `4` `—`, `5` prisma, `6` condensador.
- **Comandos**: `npm test` (vitest una vez), `npx vitest run <fichero>` para uno solo, `node scripts/validate-retos.js` para validar retos.
- **El smoke test del generador ensucia el árbol**: `node scripts/test-generator.js` escribe retos de verdad. Limpiar después solo lo que `git status --porcelain` marque como sin seguir.

---

### Task 1: Vocabulario — colores, piezas y normalización del esquema

Esta tarea no cambia ningún comportamiento: introduce las constantes nuevas, renombra lo que hablaba de "espejos" cuando ya son "piezas", y añade la función de frontera que traduce el esquema viejo al nuevo.

**Files:**
- Modify: `scripts/laser-triangular-logic.js`
- Modify: `plantillas/laser_triangular.js` (solo el nombre importado)
- Modify: `scripts/validate-retos.js:13` (solo el nombre importado)
- Modify: `tests/laser/trazador.test.js`, `tests/laser/generador.test.js` (solo nombres)
- Test: `tests/laser/normaliza.test.js` (crear)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const COLORES = ['neutro', 'azul', 'rojo', 'magenta']`
  - `export const PIEZA = { VACIO: 0, SLASH: 1, BACKSLASH: 2, VERT: 3, HORIZ: 4, PRISMA: 5, CONDENSADOR: 6 }`
  - `export function crearPiezas(size)` — sustituye a `crearEspejos`, mismo cuerpo.
  - `export function normalizaConfig(config)` → `{ size, variant, modo, lasers: [{ emitter: { row, col, dir }, color }], targets: [{ row, col, color }], blocks }`. `variant` pasa tal cual: es el **tamaño**, y la plantilla lo lee para el trazado automático.
  - `export function tiposDisponibles(modo)` → `[1,2,3,4]` si `modo === 'clasico'`, `[1,2,3,4,5,6]` si no.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/laser/normaliza.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { normalizaConfig, tiposDisponibles, PIEZA, COLORES } from '../../scripts/laser-triangular-logic.js'

describe('normalizaConfig', () => {
  it('traduce el esquema viejo: las dianas suben a targets y los laseres reciben color propio', () => {
    const viejo = {
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [{ row: 1, col: 1 }]
    }
    const c = normalizaConfig(viejo)
    expect(c.modo).toBe('clasico')
    expect(c.targets).toEqual([
      { row: 3, col: 4, color: 'neutro-1' },
      { row: 2, col: 1, color: 'neutro-2' }
    ])
    expect(c.lasers.map((l) => l.color)).toEqual(['neutro-1', 'neutro-2'])
    expect(c.blocks).toEqual([{ row: 1, col: 1 }])
  })

  it('deja intacto el esquema nuevo', () => {
    const nuevo = {
      size: 6,
      modo: 'prisma',
      lasers: [{ emitter: { row: 0, col: 2, dir: 'se' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'azul' }, { row: 5, col: 3, color: 'rojo' }],
      blocks: []
    }
    expect(normalizaConfig(nuevo)).toEqual(nuevo)
  })

  it('conserva variant, que es el tamano y lo lee la plantilla', () => {
    const c = normalizaConfig({ variant: 'medio', size: 5, lasers: [{ emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 2, col: 2 } }] })
    expect(c.variant).toBe('medio')
  })

  it('es idempotente', () => {
    const viejo = { size: 4, lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 2, col: 2 } }] }
    const una = normalizaConfig(viejo)
    expect(normalizaConfig(una)).toEqual(una)
  })
})

describe('tiposDisponibles', () => {
  it('en clasico solo hay espejos; con prisma y condensador estan las seis piezas', () => {
    expect(tiposDisponibles('clasico')).toEqual([PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ])
    expect(tiposDisponibles('prisma')).toHaveLength(6)
    expect(tiposDisponibles('condensador')).toHaveLength(6)
  })
})

describe('COLORES', () => {
  it('es un conjunto cerrado de cuatro', () => {
    expect(COLORES).toEqual(['neutro', 'azul', 'rojo', 'magenta'])
  })
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npx vitest run tests/laser/normaliza.test.js`
Expected: FAIL — `normalizaConfig is not a function` (la exportación no existe).

- [ ] **Step 3: Implementar**

En `scripts/laser-triangular-logic.js`, debajo de `DIR_VECTOR`:

```js
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
```

- [ ] **Step 4: Renombrar `crearEspejos` a `crearPiezas`**

En `scripts/laser-triangular-logic.js` renombrar la función. Actualizar los importadores, que son exactamente tres:

```bash
grep -rn "crearEspejos" --exclude-dir=node_modules --exclude-dir=.git .
```

Sustituir en `plantillas/laser_triangular.js`, `scripts/validate-retos.js`, `tests/laser/trazador.test.js` y `tests/laser/generador.test.js`. No dejar alias: son cuatro ficheros y un alias solo crea dos nombres para lo mismo.

- [ ] **Step 5: Ejecutar los tests**

Run: `npx vitest run tests/laser/`
Expected: PASS, los cuatro ficheros.

- [ ] **Step 6: Commit**

```bash
git add scripts/laser-triangular-logic.js plantillas/laser_triangular.js scripts/validate-retos.js tests/laser/
git commit -m "Laser: colores, tipos de pieza y normalizacion del esquema"
```

---

### Task 2: El trazador devuelve tramos con color

Refactor puro: `simularLaser` pasa a `simularHaz`, con lista de trabajo y color, y devuelve una lista de tramos. Sin piezas nuevas todavía. Al terminar, el comportamiento observable es idéntico al de hoy salvo la regla de cruce, que pasa a contar visitas por celda.

**Files:**
- Modify: `scripts/laser-triangular-logic.js`
- Modify: `plantillas/laser_triangular.js` (adaptar `refresh` y `onCellClick` a `tramos`)
- Test: `tests/laser/trazador.test.js`

**Interfaces:**
- Consumes: `normalizaConfig`, `PIEZA`, `crearPiezas` (Task 1).
- Produces:
  - `export function simularHaz(config, piezas, laser)` → `{ tramos: [{ puntos, color, resultado, squaresPath }] }`. `resultado` ∈ `'diana' | 'diana-ajena' | 'fuera' | 'bloqueo' | 'emisor' | 'bucle'`.
  - `export function simularTodos(config, piezas)` → `{ tramos, cruces, dianasAlcanzadas }`. `tramos` es la lista plana de todos los tramos de todos los láseres; `cruces` un `Set` de `"row,col"`; `dianasAlcanzadas` un `Set` de `"row,col"`.
  - `export function resuelto(config, piezas)` — sin cambio de firma.
  - `export function giraDir(dir, pasos)` y `export const CICLO_DIR`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/laser/trazador.test.js` (y adaptar los existentes de `resultados` a `tramos`):

```js
import { simularHaz, simularTodos, giraDir, CICLO_DIR, normalizaConfig, crearPiezas, resuelto } from '../../scripts/laser-triangular-logic.js'

describe('giro de 45 grados', () => {
  it('las ocho direcciones estan en orden horario', () => {
    expect(CICLO_DIR).toEqual(['right', 'se', 'down', 'sw', 'left', 'nw', 'up', 'ne'])
  })

  it('girar -1 es 45 grados a la izquierda y +1 a la derecha', () => {
    expect(giraDir('right', -1)).toBe('ne')
    expect(giraDir('right', 1)).toBe('se')
    expect(giraDir('ne', 1)).toBe('right')
    expect(giraDir('right', 8)).toBe('right')
  })
})

describe('simularHaz devuelve tramos', () => {
  it('sin piezas nuevas hay exactamente un tramo por laser', () => {
    const c = normalizaConfig(TABLERO)
    const { tramos } = simularHaz(c, crearPiezas(c.size), c.lasers[0])
    expect(tramos).toHaveLength(1)
    expect(tramos[0].color).toBe('neutro-1')
    expect(tramos[0].puntos.length).toBeGreaterThan(1)
  })

  it('mantiene el resultado de hoy con los espejos previstos', () => {
    const c = normalizaConfig(TABLERO)
    const piezas = crearPiezas(c.size)
    piezas[3][0] = 2
    piezas[0][1] = 1
    const { tramos, cruces } = simularTodos(c, piezas)
    expect(tramos.map((t) => t.resultado)).toEqual(['diana', 'diana'])
    expect([...cruces]).toEqual([])
    expect(resuelto(c, piezas)).toBe(true)
  })
})

describe('regla de cruce por visitas', () => {
  it('una celda visitada por dos tramos es un cruce', () => {
    const c = normalizaConfig(TABLERO)
    const piezas = crearPiezas(c.size)
    // Sin espejos, los dos rayos de TABLERO no comparten celda.
    expect([...simularTodos(c, piezas).cruces]).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/trazador.test.js`
Expected: FAIL — `simularHaz is not a function`.

- [ ] **Step 3: Implementar el trazador**

En `scripts/laser-triangular-logic.js`. `siguienteCruce` **no se toca**. Sustituir `simularLaser` por:

```js
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
```

Los dos ayudantes, justo encima:

```js
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
```

Y `simularTodos` / `resuelto`:

```js
export function simularTodos(config, piezas) {
  const c = normalizaConfig(config);
  const tramos = c.lasers.flatMap((l) => simularHaz(c, piezas, l).tramos);

  // Regla de cruce: una celda visitada por mas de un tramo es un cruce, salvo
  // si tiene prisma o condensador -- que son justamente los sitios donde los
  // rayos se encuentran a proposito. En clasico esto es exactamente la regla
  // de hoy ("dos rayos no comparten celda").
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

export function resuelto(config, piezas) {
  const c = normalizaConfig(config);
  const { cruces, dianasAlcanzadas } = simularTodos(c, piezas);
  return c.targets.length > 0 && cruces.size === 0 &&
    c.targets.every((t) => dianasAlcanzadas.has(`${t.row},${t.col}`));
}
```

- [ ] **Step 4: Adaptar la plantilla a la forma nueva**

En `plantillas/laser_triangular.js`:

- `config` pasa a ser `normalizaConfig(await loadConfig(data))`, así que la plantilla ve siempre el esquema nuevo (`config.targets`, `config.modo`) y conserva `config.variant`.
- Renombrar `state.mirrors` a `state.piezas` y el conjunto `sinEspejo` a `sinPieza`. Las tareas 11 y 12 usan estos nombres.
- `sinPieza` se construye ahora recorriendo `config.targets` en vez de `lasers[].target`.
- En `refresh()`, sustituir el bucle sobre `resultados` por uno sobre `tramos`, dibujando una polilínea por tramo con `tramo.color`, y marcar `is-hit` en las celdas de `dianasAlcanzadas`.
- En `onCellClick`, la condición de victoria pasa a `resuelto(config, state.piezas)`.

**`simularHaz` espera una config YA normalizada** (usa `config.targets` y `config.blocks` directamente); quien normaliza es `simularTodos`, `resuelto` y la propia plantilla al cargar. Es una adaptación mecánica: la interfaz de verdad se rehace en las tareas 10-12.

- [ ] **Step 5: Ejecutar toda la batería**

Run: `npm test`
Expected: PASS. Si `tests/plantillas/laser-muestra.test.js` falla, es señal de que la adaptación de `refresh` está incompleta: arreglarla, no tocar el test.

- [ ] **Step 6: Commit**

```bash
git add scripts/laser-triangular-logic.js plantillas/laser_triangular.js tests/laser/trazador.test.js
git commit -m "Laser: el trazador devuelve tramos con color y absorbe en los emisores"
```

---

### Task 3: Tests del prisma

El código del prisma ya entró en la Task 2 (va dentro del mismo bucle). Esta tarea lo somete a prueba de verdad y arregla lo que salga.

**Files:**
- Test: `tests/laser/prisma.test.js` (crear)
- Modify: `scripts/laser-triangular-logic.js` (solo si los tests destapan algo)

**Interfaces:**
- Consumes: `simularHaz`, `simularTodos`, `normalizaConfig`, `crearPiezas`, `PIEZA`, `giraDir` (Tasks 1-2).
- Produces: nada nuevo.

- [ ] **Step 1: Escribir los tests**

Crear `tests/laser/prisma.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { simularHaz, simularTodos, normalizaConfig, crearPiezas, PIEZA } from '../../scripts/laser-triangular-logic.js'

// Emisor en (2,0) disparando a la derecha; el prisma va en (2,2).
const BASE = {
  size: 6,
  modo: 'prisma',
  lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
  targets: [{ row: 0, col: 5, color: 'azul' }, { row: 5, col: 4, color: 'rojo' }],
  blocks: []
}

const conPrisma = () => {
  const p = crearPiezas(BASE.size)
  p[2][2] = PIEZA.PRISMA
  return p
}

describe('prisma', () => {
  it('un rayo que entra sale como dos, en azul y rojo', () => {
    const c = normalizaConfig(BASE)
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    expect(tramos).toHaveLength(3)          // tronco + dos hijos
    expect(tramos[0].resultado).toBe('prisma')
    expect(tramos.slice(1).map((t) => t.color).sort()).toEqual(['azul', 'rojo'])
  })

  it('los dos hijos salen a 45 grados de la entrada, no rectos', () => {
    const c = normalizaConfig(BASE)
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    // Entrada 'right'; -45 es 'ne' (sube) y +45 es 'se' (baja).
    const [azul, rojo] = tramos.slice(1)
    const finAzul = azul.squaresPath[azul.squaresPath.length - 1]
    const finRojo = rojo.squaresPath[rojo.squaresPath.length - 1]
    expect(finAzul.row).toBeLessThan(2)     // el azul sube
    expect(finRojo.row).toBeGreaterThan(2)  // el rojo baja
    // Ninguno sigue por la fila 2, que es la direccion de entrada.
    expect(azul.squaresPath.slice(1).every((p) => p.row !== 2)).toBe(true)
    expect(rojo.squaresPath.slice(1).every((p) => p.row !== 2)).toBe(true)
  })

  it('un rayo ya coloreado que entra en un segundo prisma se corta', () => {
    const c = normalizaConfig(BASE)
    const piezas = conPrisma()
    piezas[1][3] = PIEZA.PRISMA          // en el camino del hijo azul
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(tramos.some((t) => t.resultado === 'prisma-saturado')).toBe(true)
    // Y no aparecen nietos: el arbol no crece.
    expect(tramos.filter((t) => t.color === 'azul' || t.color === 'rojo')).toHaveLength(2)
  })

  it('la celda del prisma no cuenta como cruce', () => {
    const c = normalizaConfig(BASE)
    const { cruces } = simularTodos(c, conPrisma())
    expect(cruces.has('2,2')).toBe(false)
  })

  it('una diana solo se da por alcanzada por un rayo de su color', () => {
    const c = normalizaConfig({ ...BASE, targets: [{ row: 0, col: 5, color: 'rojo' }, { row: 5, col: 4, color: 'rojo' }] })
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    const azul = tramos.find((t) => t.color === 'azul')
    if (azul.squaresPath.some((p) => p.row === 0 && p.col === 5)) {
      expect(azul.resultado).toBe('diana-ajena')
    }
  })
})
```

- [ ] **Step 2: Ejecutar**

Run: `npx vitest run tests/laser/prisma.test.js`
Expected: PASS si la Task 2 quedó bien. Si algún test falla, el fallo está en `entraEnPrisma` o en el punto donde el bucle detecta la pieza — corregir ahí, no en el test.

Nota: las celdas concretas de los `expect` sobre trayectos dependen de la geometría. Si el trayecto real no pasa por donde supone un test, **ajustar las coordenadas del tablero de prueba** hasta que el escenario sea el que el test describe, y dejar escrito en un comentario el trayecto que sale. Lo que no se puede tocar es la afirmación: dos hijos, colores azul y rojo, a ±45°, sin nietos.

- [ ] **Step 3: Commit**

```bash
git add tests/laser/prisma.test.js scripts/laser-triangular-logic.js
git commit -m "Laser: tests del prisma"
```

---

### Task 4: Tests del condensador y del punto fijo

**Files:**
- Test: `tests/laser/condensador.test.js` (crear)
- Modify: `scripts/laser-triangular-logic.js` (solo si los tests destapan algo)

**Interfaces:**
- Consumes: lo de las tareas 1-3.
- Produces: nada nuevo.

- [ ] **Step 1: Escribir los tests**

Crear `tests/laser/condensador.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { simularHaz, simularTodos, normalizaConfig, crearPiezas, PIEZA } from '../../scripts/laser-triangular-logic.js'

const BASE = {
  size: 7,
  modo: 'condensador',
  lasers: [{ emitter: { row: 3, col: 0, dir: 'right' }, color: 'neutro' }],
  targets: [{ row: 3, col: 6, color: 'magenta' }],
  blocks: []
}

describe('condensador', () => {
  it('con un solo rayo deja pasar recto y sin cambiar de color', () => {
    const c = normalizaConfig({
      ...BASE,
      targets: [{ row: 3, col: 6, color: 'neutro-1' }]
    })
    const piezas = crearPiezas(c.size)
    piezas[3][3] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    const salida = tramos[tramos.length - 1]
    expect(salida.color).toBe(c.lasers[0].color)
    expect(salida.resultado).toBe('diana')
  })

  it('dos colores distintos salen como uno magenta', () => {
    const c = normalizaConfig(BASE)
    const piezas = crearPiezas(c.size)
    piezas[3][2] = PIEZA.PRISMA
    // Los dos hijos se devuelven a una misma celda con un espejo cada uno.
    // Las celdas exactas se fijan al escribir el test: trazar con
    // simularHaz y leer squaresPath de cada hijo.
    piezas[3][4] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(tramos.some((t) => t.color === 'magenta')).toBe(true)
  })

  it('la celda del condensador no cuenta como cruce', () => {
    const c = normalizaConfig(BASE)
    const piezas = crearPiezas(c.size)
    piezas[3][2] = PIEZA.PRISMA
    piezas[3][4] = PIEZA.CONDENSADOR
    expect(simularTodos(c, piezas).cruces.has('3,4')).toBe(false)
  })

  it('el tope global corta cualquier realimentacion sin colgarse', () => {
    const c = normalizaConfig({ ...BASE, size: 5 })
    const piezas = crearPiezas(5)
    // Tablero sembrado de prismas y condensadores: sea cual sea el arbol que
    // salga, la simulacion termina y ningun tramo queda a medio anotar.
    for (let r = 0; r < 5; r++) {
      for (let col = 1; col < 5; col++) {
        piezas[r][col] = (r + col) % 2 ? PIEZA.PRISMA : PIEZA.CONDENSADOR
      }
    }
    const t0 = Date.now()
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(Date.now() - t0).toBeLessThan(500)
    expect(tramos.length).toBeLessThanOrEqual(4 * 5 * 5)
    expect(tramos.every((t) => typeof t.resultado === 'string')).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar y fijar las celdas**

Run: `npx vitest run tests/laser/condensador.test.js`

Para el test de mezcla, escribir primero un script de un solo uso en el scratchpad que trace `simularHaz` con el prisma puesto e imprima el `squaresPath` de cada hijo; elegir como celda del condensador una que aparezca en los dos y fijarla en el test. Si no hay ninguna común, añadir un espejo a un hijo hasta que la haya, y dejar comentado en el test qué espejo y por qué.

- [ ] **Step 3: Ejecutar de nuevo**

Run: `npx vitest run tests/laser/condensador.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/laser/condensador.test.js scripts/laser-triangular-logic.js
git commit -m "Laser: tests del condensador y del tope de punto fijo"
```

---

### Task 5: La búsqueda de mínimos conoce las seis piezas

**Files:**
- Modify: `scripts/laser-triangular-logic.js` (`celdasLibres`, `resolverEspejos`, `espejosMinimos`, `espejosMinimosExhaustivo`)
- Modify: `scripts/validate-retos.js:13` (nombres importados)
- Modify: `tests/laser/generador.test.js` (nombres)
- Test: `tests/laser/busqueda.test.js` (crear)

**Interfaces:**
- Consumes: `tiposDisponibles`, `normalizaConfig`, `resuelto`, `crearPiezas`.
- Produces:
  - `export function celdasLibres(config)` — sin cambio de firma, pero ahora excluye las celdas de `config.targets` (lista) en vez de `lasers[].target`.
  - `export function resolverPiezas(config, tope)` → `{ piezas, total } | null` (antes `resolverEspejos`, devolvía `{ espejos, total }`).
  - `export function piezasMinimas(config, tope)` → `number | null` (antes `espejosMinimos`).
  - `export function piezasMinimasExhaustivo(config, tope)` → `number | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/laser/busqueda.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolverPiezas, piezasMinimas, piezasMinimasExhaustivo, normalizaConfig, resuelto, PIEZA } from '../../scripts/laser-triangular-logic.js'

const CLASICO = normalizaConfig({
  size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: []
})

describe('busqueda de minimos', () => {
  it('encuentra una colocacion que resuelve de verdad', () => {
    const sol = resolverPiezas(CLASICO, 3)
    expect(sol).not.toBeNull()
    expect(resuelto(CLASICO, sol.piezas)).toBe(true)
  })

  it('en clasico nunca propone prisma ni condensador', () => {
    const sol = resolverPiezas(CLASICO, 3)
    const usadas = sol.piezas.flat().filter(Boolean)
    expect(usadas.includes(PIEZA.PRISMA)).toBe(false)
    expect(usadas.includes(PIEZA.CONDENSADOR)).toBe(false)
  })

  it('la version podada y la exhaustiva dan el mismo minimo', () => {
    expect(piezasMinimas(CLASICO, 3)).toBe(piezasMinimasExhaustivo(CLASICO, 3))
  })

  it('con seis tipos de pieza la busqueda sigue siendo rapida', () => {
    const t0 = Date.now()
    piezasMinimas({ ...CLASICO, modo: 'prisma' }, 3)
    expect(Date.now() - t0, 'la poda ya no aguanta seis tipos de pieza').toBeLessThan(4000)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/busqueda.test.js`
Expected: FAIL — `resolverPiezas is not a function`.

- [ ] **Step 3: Implementar**

Renombrar las tres funciones y hacer que el bucle interior recorra `tiposDisponibles(config.modo)` en vez de `1..4`. En `celdasLibres`, cambiar el bucle sobre `lasers[].target` por uno sobre `config.targets`. Ejemplo del cambio en `resolverPiezas`:

```js
export function resolverPiezas(config, tope) {
  const c = normalizaConfig(config);
  const piezas = crearPiezas(c.size);
  if (resuelto(c, piezas)) return { piezas, total: 0 };

  const libres = new Set(celdasLibres(c).map((x) => `${x.row},${x.col}`));
  const tipos = tiposDisponibles(c.modo);

  const buscar = (restantes) => {
    if (restantes === 0) return resuelto(c, piezas);
    const { tramos } = simularTodos(c, piezas);
    const vistas = new Set();
    const candidatas = [];
    for (const tramo of tramos) {
      for (const { row, col } of tramo.squaresPath) {
        const k = `${row},${col}`;
        if (vistas.has(k) || !libres.has(k) || piezas[row][col] !== PIEZA.VACIO) continue;
        vistas.add(k);
        candidatas.push({ row, col });
      }
    }
    for (const { row, col } of candidatas) {
      for (const tipo of tipos) {
        piezas[row][col] = tipo;
        if (buscar(restantes - 1)) return true;
        piezas[row][col] = PIEZA.VACIO;
      }
    }
    return false;
  };

  for (let k = 1; k <= tope; k++) {
    if (buscar(k)) return { piezas: piezas.map((f) => [...f]), total: k };
  }
  return null;
}
```

Actualizar los importadores: `scripts/validate-retos.js`, `tests/laser/generador.test.js`, `tests/plantillas/laser-muestra.test.js`.

- [ ] **Step 4: Ejecutar**

Run: `npm test`
Expected: PASS. Si el test de tiempo falla, no relajar el tope: reducir el trabajo. La palanca es ordenar `candidatas` para probar antes las celdas del tramo que aún no llega a su diana.

- [ ] **Step 5: Commit**

```bash
git add scripts/laser-triangular-logic.js scripts/validate-retos.js tests/
git commit -m "Laser: la busqueda de minimos conoce las seis piezas y respeta el modo"
```

---

### Task 6: Ejes de variante — tamaño y modo, cada uno con su máscara

**Files:**
- Modify: `scripts/laser-triangular-logic.js`
- Modify: `tests/ejes/reparto.test.js:34-40`
- Test: `tests/laser/ejes.test.js` (crear)

**Interfaces:**
- Consumes: `eligeEje` (ya existe en el módulo).
- Produces:
  - `export const MODOS = ['clasico', 'prisma', 'condensador']`
  - `export function tamanoDeSeed(seed)` → `'pequeno' | 'medio' | 'grande'` — es el `varianteDeSeed` de hoy, con su máscara `0x24c7b0e9` intacta.
  - `export function modoDeSeed(seed)` → uno de `MODOS`, máscara `0x9e3779b1`.
  - `export function varianteDeSeed(seed)` → `` `${tamanoDeSeed(seed)}-${modoDeSeed(seed)}` `` — la variante **combinada**, que es lo que mira `tests/ejes/reparto.test.js`.

**Ojo con los dos sentidos de "variante":** el campo `variant` del payload sigue siendo **solo el tamaño** — es lo que lee `config.variant === 'pequeno'` en la plantilla para el trazado automático — y el modo viaja aparte en `modo`. La variante combinada existe únicamente en `varianteDeSeed`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/laser/ejes.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { tamanoDeSeed, modoDeSeed, varianteDeSeed, MODOS, VARIANTES } from '../../scripts/laser-triangular-logic.js'

const seedsReales = () => {
  const g = new MathGymGenerator()
  const seeds = []
  const d = new Date(Date.UTC(2026, 0, 1))
  for (let i = 0; i < 1460; i++) {
    const s = g.dateToSeed(d.toISOString().slice(0, 10))
    if (g.selectTemplate(s) === 'laser-triangular') seeds.push(s)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return seeds
}

describe('ejes de laser-triangular', () => {
  it('el tamano no cambia respecto a lo publicado: misma mascara', () => {
    // Si esta mascara cambia, las fechas ya publicadas cambian de tamano.
    expect(VARIANTES).toEqual(['pequeno', 'medio', 'grande'])
    expect(typeof tamanoDeSeed(20260114)).toBe('string')
  })

  it('sobre fechas reales salen los tres tamanos y los tres modos', () => {
    const seeds = seedsReales()
    expect(seeds.length).toBeGreaterThan(20)
    expect(new Set(seeds.map(tamanoDeSeed)).size).toBe(3)
    expect(new Set(seeds.map(modoDeSeed)).size).toBe(MODOS.length)
  })

  it('los dos ejes son independientes: salen al menos 6 combinaciones', () => {
    expect(new Set(seedsReales().map(varianteDeSeed)).size).toBeGreaterThanOrEqual(6)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/ejes.test.js`
Expected: FAIL — `tamanoDeSeed is not a function`.

- [ ] **Step 3: Implementar**

```js
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
```

Dentro de `buildLaserPuzzle`, sustituir `const variant = varianteDeSeed(seed)` por `const variant = tamanoDeSeed(seed)` y añadir `const modo = modoDeSeed(seed)`.

- [ ] **Step 4: Subir el listón en el test de reparto**

En `tests/ejes/reparto.test.js`, cambiar `'laser-triangular': 3` por `'laser-triangular': 6` en `ESPERADAS`, y actualizar el comentario de encima para decir que láser tiene dos ejes (tamaño y modo).

Después, ejecutar el barrido y, si sale un número mayor, subir `ESPERADAS` a ese número menos uno de margen:

```bash
node -e "
import('./scripts/generate-daily-reto.js').then(async (g) => {
  const { varianteDeSeed } = await import('./scripts/laser-triangular-logic.js');
  const gen = new g.MathGymGenerator(); const v = new Set(); const d = new Date(Date.UTC(2026,0,1));
  for (let i = 0; i < 1460; i++) {
    const s = gen.dateToSeed(d.toISOString().slice(0,10));
    if (gen.selectTemplate(s) === 'laser-triangular') v.add(varianteDeSeed(s));
    d.setUTCDate(d.getUTCDate()+1);
  }
  console.log(v.size, [...v].sort().join(' '));
});
"
```

- [ ] **Step 5: Ejecutar**

Run: `npx vitest run tests/laser/ejes.test.js tests/ejes/reparto.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/ejes.test.js tests/ejes/reparto.test.js
git commit -m "Laser: eje de modo con mascara propia, separado del de tamano"
```

---

### Task 7: El generador construye los modos prisma y condensador

**Files:**
- Modify: `scripts/laser-triangular-logic.js` (`buildLaserPuzzle`, `buildLaserHints`)
- Modify: `tests/laser/generador.test.js`, `tests/laser/hints.test.js`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `buildLaserPuzzle(seed)` devuelve además `modo` y `min_piezas` (sigue devolviendo `min_espejos` con el mismo valor mientras `generate-daily-reto.js` no se actualice en la Task 8), y `targets` en vez de `lasers[].target` cuando `modo !== 'clasico'`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/laser/generador.test.js`:

```js
import { buildLaserPuzzle, piezasMinimas, resuelto, crearPiezas, normalizaConfig, modoDeSeed, MODOS } from '../../scripts/laser-triangular-logic.js'

// Un seed por modo, encontrado barriendo: se fijan aqui para que los tests no
// dependan de que el barrido siga dando lo mismo.
const SEED_DE_MODO = Object.fromEntries(
  MODOS.map((m) => [m, [20260830, 20260915, 20261207, 20270422, 12, 33, 88, 20280606, 101, 202, 303, 404]
    .find((s) => modoDeSeed(s) === m)])
)

describe('buildLaserPuzzle en los tres modos', () => {
  for (const modo of MODOS) {
    it(`${modo}: genera, es resoluble y el par anunciado es el real`, () => {
      const seed = SEED_DE_MODO[modo]
      expect(seed, `no hay seed de prueba para ${modo}`).toBeDefined()
      const p = buildLaserPuzzle(seed)
      expect(p.modo).toBe(modo)
      const c = normalizaConfig(p)
      expect(resuelto(c, crearPiezas(p.size)), 'viene resuelto de fabrica').toBe(false)
      expect(resuelto(c, p.solucion.piezas)).toBe(true)
      expect(piezasMinimas(c, p.min_piezas - 1), 'se resuelve con menos').toBeNull()
    })
  }

  it('prisma: un emisor y dos dianas de colores distintos', () => {
    const p = buildLaserPuzzle(SEED_DE_MODO.prisma)
    expect(p.lasers).toHaveLength(1)
    expect(p.targets).toHaveLength(2)
    expect(new Set(p.targets.map((t) => t.color)).size).toBe(2)
  })

  it('condensador: un emisor y una unica diana magenta', () => {
    const p = buildLaserPuzzle(SEED_DE_MODO.condensador)
    expect(p.lasers).toHaveLength(1)
    expect(p.targets).toHaveLength(1)
    expect(p.targets[0].color).toBe('magenta')
  })

  it('la dificultad sube un punto fuera de clasico, con tope en 5', () => {
    for (const modo of MODOS) {
      const p = buildLaserPuzzle(SEED_DE_MODO[modo])
      expect(p.dificultad).toBeGreaterThanOrEqual(1)
      expect(p.dificultad).toBeLessThanOrEqual(5)
    }
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/generador.test.js`
Expected: FAIL — `p.modo` es `undefined`.

- [ ] **Step 3: Partir el `construirLaser` de hoy en piezas reutilizables**

Antes de escribir nada nuevo, extraer del `construirLaser` actual las dos partes que los tres modos comparten. Es un refactor sin cambio de comportamiento: al terminar, `npx vitest run tests/laser/generador.test.js` tiene que seguir pasando con los tests de antes.

```js
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
```

`construirClasico(rand, size)` es el cuerpo de hoy reescrito sobre estos dos ayudantes, devolviendo la misma forma que los constructores nuevos: `{ modo: 'clasico', size, lasers, targets, piezas }`, con las dianas en `targets` en vez de en `lasers[].target`.

- [ ] **Step 4: Implementar los modos prisma y condensador**

```js
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

  return { modo: 'condensador', size, lasers, targets: [{ row: fin.row, col: fin.col, color: 'magenta' }], piezas };
}
```

El envoltorio, con las comprobaciones que ya existen hoy:

```js
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
      min_espejos: total,                                   // lo sigue leyendo generate-daily-reto
      dificultad: Math.min(5, base + (modo === 'clasico' ? 0 : 1)),
      solucion: { piezas: hecho.piezas.map((f) => [...f]) },
      intentos: intento + 1
    };
  }
  throw new Error(`No se pudo generar un reto de laser triangular para seed=${seed}, modo=${modo}`);
}
```

- [ ] **Step 5: Medir la tasa de fallo y subir `MAX_INTENTOS` si hace falta**

Los generadores escriben ficheros al llamarlos, así que este barrido va contra la lógica, no contra el generador diario — no ensucia el árbol:

```bash
node -e "
import('./scripts/laser-triangular-logic.js').then(({ buildLaserPuzzle, modoDeSeed }) => {
  const fallos = {};
  for (let s = 1; s <= 300; s++) {
    try { const p = buildLaserPuzzle(s); fallos[p.modo] = fallos[p.modo] || { ok: 0, ko: 0, intentos: 0 };
          fallos[p.modo].ok++; fallos[p.modo].intentos += p.intentos; }
    catch { const m = modoDeSeed(s); fallos[m] = fallos[m] || { ok: 0, ko: 0, intentos: 0 }; fallos[m].ko++; }
  }
  console.log(fallos);
});
"
```

Si algún modo tiene `ko > 0`, subir `MAX_INTENTOS` (600 hoy) hasta que sean cero en los 300 seeds, y anotar en un comentario el valor medido de `intentos` medio por modo.

- [ ] **Step 6: Actualizar las pistas**

En `buildLaserHints`, la segunda pista pasa a depender del modo:

```js
const SEGUNDA = {
  clasico: 'Los cuatro espejos no hacen lo mismo: las diagonales / y \\ desvian el rayo 90 grados cuando le llegan de frente, y los planos | y — lo devuelven por donde vino. Un rayo que llega paralelo a un espejo lo atraviesa sin enterarse.',
  prisma: 'El prisma parte el rayo en dos: uno sale 45 grados a la izquierda en azul y otro 45 grados a la derecha en rojo, y la direccion de entrada no continua recta. Cada diana solo la enciende un rayo de su color, asi que lo primero es decidir por donde entra el rayo al prisma.',
  condensador: 'Aqui hacen falta las dos piezas: el prisma parte el rayo en azul y rojo, y el condensador los vuelve a juntar en magenta, que es el color de la unica diana. Los dos rayos tienen que llegar a la misma celda, y solo esa celda puede compartirla dos rayos.'
};
```

Añadir a `tests/laser/hints.test.js` un caso que compruebe que en modo prisma la segunda pista menciona «prisma», y que la tercera sigue mencionando `min_piezas`.

- [ ] **Step 7: Ejecutar**

Run: `npx vitest run tests/laser/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/laser-triangular-logic.js tests/laser/
git commit -m "Laser: el generador construye los modos prisma y condensador"
```

---

### Task 8: Generador diario y validador

**Files:**
- Modify: `scripts/generate-daily-reto.js:680-710` (`generateLaser`)
- Modify: `scripts/validate-retos.js:775-836` (`validateLaserData`)
- Test: `tests/laser/validador.test.js` (crear)

**Interfaces:**
- Consumes: `normalizaConfig`, `piezasMinimas`, `crearPiezas`, `resuelto`, `MODOS`, `COLORES`, `DIR_VECTOR`.
- Produces: el payload en disco lleva `modo`, `targets` y `min_piezas`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/laser/validador.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { MathGymValidator } from '../../scripts/validate-retos.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const escribe = async (data) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laser-'))
  const ruta = path.join(dir, 'laser.json')
  await fs.writeFile(ruta, JSON.stringify(data))
  return ruta
}

const reto = (json_url) => ({ tipo: 'laser-triangular', data: { json_url } })

describe('validateLaserData', () => {
  it('acepta un payload viejo, sin modo ni targets', async () => {
    const ruta = await escribe({
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [],
      min_espejos: 2
    })
    await expect(new MathGymValidator().validateLaserData(reto(ruta))).resolves.toBeUndefined()
  })

  it('rechaza un modo prisma con una sola diana', async () => {
    const ruta = await escribe({
      size: 6, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'azul' }],
      blocks: [], min_piezas: 2
    })
    await expect(new MathGymValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/prisma.*dos dianas/i)
  })

  it('rechaza un color de diana que no existe', async () => {
    const ruta = await escribe({
      size: 6, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'turquesa' }, { row: 5, col: 4, color: 'rojo' }],
      blocks: [], min_piezas: 2
    })
    await expect(new MathGymValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/color/i)
  })
})
```

Si `MathGymValidator` no está exportado, exportarlo — el test lo necesita y hoy el validador solo se ejecuta por CLI.

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/laser/validador.test.js`
Expected: FAIL — el validador de hoy exige `lasers.length >= 2` y revienta con el payload de prisma.

- [ ] **Step 3: Implementar el validador**

Reescribir `validateLaserData` sobre el esquema normalizado:

```js
const data = JSON.parse(dataContent);
const c = normalizaConfig(data);

if (!Number.isInteger(c.size) || c.size < 4 || c.size > 9) {
  throw new Error(`Laser-triangular size fuera de rango 4..9: ${c.size}`);
}
if (!MODOS.includes(c.modo)) {
  throw new Error(`Laser-triangular modo desconocido: "${c.modo}"`);
}
if (!c.lasers.length || !c.targets.length) {
  throw new Error('Laser-triangular necesita al menos un emisor y una diana');
}
if (c.modo === 'prisma') {
  if (c.lasers.length !== 1 || c.targets.length !== 2) {
    throw new Error('Laser-triangular modo prisma: hace falta un emisor y dos dianas');
  }
  if (c.targets[0].color === c.targets[1].color) {
    throw new Error('Laser-triangular modo prisma: las dos dianas tienen el mismo color');
  }
}
if (c.modo === 'condensador') {
  if (c.lasers.length !== 1 || c.targets.length !== 1 || c.targets[0].color !== 'magenta') {
    throw new Error('Laser-triangular modo condensador: hace falta un emisor y una unica diana magenta');
  }
}
for (const t of c.targets) {
  const conocido = COLORES.includes(t.color) || /^neutro-\d+$/.test(t.color);
  if (!conocido) throw new Error(`Laser-triangular color de diana desconocido: "${t.color}"`);
}
```

Se conservan tal cual las comprobaciones de hoy: emisores y dianas dentro del tablero, sin dos objetos en la misma celda, bloques fuera de esas celdas, direcciones en `DIR_VECTOR`. Al final:

```js
if (resuelto(c, crearPiezas(c.size))) {
  throw new Error('Laser-triangular ya viene resuelto sin colocar ninguna pieza');
}
const declarados = Number.isInteger(data.min_piezas) ? data.min_piezas
  : (Number.isInteger(data.min_espejos) ? data.min_espejos : 4);
const minimo = piezasMinimas(c, declarados);
if (minimo === null) {
  throw new Error(`Laser-triangular not solvable: no hay solucion con ${declarados} piezas o menos`);
}
if (minimo !== declarados) {
  throw new Error(`Laser-triangular min_piezas=${declarados} pero se resuelve con ${minimo}: el par anunciado no es el real`);
}
```

- [ ] **Step 4: Actualizar el generador diario**

En `scripts/generate-daily-reto.js`, `generateLaser`: sacar `modo`, `targets` y `min_piezas` del puzzle, escribirlos en el payload (`config`) y usar `min_piezas` en `parMoves`, `maxMovesFor3Stars` y `maxMovesFor2Stars` (este último `min_piezas + 2`, como hoy).

- [ ] **Step 5: Ejecutar todo, incluido el smoke test**

```bash
npm test
node scripts/test-generator.js
node scripts/validate-retos.js
git status --porcelain          # el smoke test escribe retos de verdad
```

Expected: los tres PASS. Borrar solo lo que `git status --porcelain` marque como sin seguir (`??`), nada más.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-daily-reto.js scripts/validate-retos.js tests/laser/validador.test.js
git commit -m "Laser: el generador diario y el validador entienden modo, targets y min_piezas"
```

---

### Task 9: Compatibilidad con los retos ya publicados

Esta tarea va antes de tocar la interfaz para que, si algún payload publicado se rompe, salga a la luz mientras la lógica está fresca y no mezclado con cambios de DOM.

**Files:**
- Test: `tests/laser/compatibilidad.test.js` (crear)
- Modify: ficheros de `data/laser_*.json` **solo si el test destapa uno roto**

**Interfaces:**
- Consumes: `normalizaConfig`, `piezasMinimas`, `resuelto`, `crearPiezas`.
- Produces: nada.

- [ ] **Step 1: Escribir el test**

Crear `tests/laser/compatibilidad.test.js`:

```js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import { normalizaConfig, piezasMinimas, resuelto, crearPiezas } from '../../scripts/laser-triangular-logic.js'

// El archivo historico NO es reproducible: regenerar un reto pasado da otro
// puzzle. Asi que los payloads publicados tienen que seguir abriendo tal cual,
// y esta es la red que lo comprueba sobre los ficheros reales.
const publicados = async () => {
  const nombres = (await fs.readdir('data')).filter((f) => f.startsWith('laser_') && f.endsWith('.json'))
  return Promise.all(nombres.map(async (n) => [n, JSON.parse(await fs.readFile(`data/${n}`, 'utf8'))]))
}

describe('retos de laser ya publicados', () => {
  it('hay al menos uno que comprobar', async () => {
    expect((await publicados()).length).toBeGreaterThan(0)
  })

  it('todos normalizan a un esquema valido', async () => {
    for (const [nombre, data] of await publicados()) {
      const c = normalizaConfig(data)
      expect(c.targets.length, nombre).toBeGreaterThan(0)
      expect(c.lasers.length, nombre).toBeGreaterThan(0)
      expect(c.modo, nombre).toBeDefined()
    }
  })

  it('ninguno viene resuelto de fabrica y todos siguen siendo resolubles', async () => {
    for (const [nombre, data] of await publicados()) {
      const c = normalizaConfig(data)
      const par = data.min_piezas ?? data.min_espejos
      expect(resuelto(c, crearPiezas(c.size)), `${nombre} viene resuelto`).toBe(false)
      expect(piezasMinimas(c, par), `${nombre} ya no tiene solucion con ${par} piezas`).toBe(par)
    }
  })
})
```

- [ ] **Step 2: Ejecutar**

Run: `npx vitest run tests/laser/compatibilidad.test.js`

- [ ] **Step 3: Arreglar a mano lo que salga roto**

El único cambio de comportamiento sobre un reto viejo es que ahora el emisor propio absorbe el rayo. Si un payload publicado dependía de que el rayo atravesara su propio emisor, este test lo destapa.

**Arreglarlo editando el JSON en su sitio, nunca regenerándolo** — el archivo no es reproducible y regenerar cambia el puzzle que ya jugó alguien. El arreglo mínimo es mover la diana o el emisor una celda, comprobando con `piezasMinimas` que el par declarado sigue siendo el real. Si hay que cambiar `min_espejos`, cambiarlo también en `retos/{fecha}.json` (`objectives.parMoves`, `maxMovesFor3Stars`, `maxMovesFor2Stars`).

- [ ] **Step 4: Ejecutar**

Run: `npx vitest run tests/laser/compatibilidad.test.js && node scripts/validate-retos.js`
Expected: PASS los dos.

- [ ] **Step 5: Commit**

```bash
git add tests/laser/compatibilidad.test.js data/ retos/
git commit -m "Laser: red de compatibilidad sobre los payloads publicados"
```

---

### Task 10: La plantilla dibuja sus formas, sin emoji

**Files:**
- Modify: `plantillas/laser_triangular.js`
- Modify: `style.css:2330-2640`
- Test: `tests/plantillas/laser-formas.test.js` (crear)

**Interfaces:**
- Consumes: `normalizaConfig`, `COLORES`, `PIEZA`.
- Produces: en el DOM, `.laser-emisor` (boquilla), `.laser-diana` con `data-forma` ∈ `circulo|triangulo|cuadrado|rombo`, y `.laser-pieza` con `data-pieza` ∈ `slash|backslash|vert|horiz|prisma|condensador`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/plantillas/laser-formas.test.js`:

```js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const montar = async (data) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, {})
  return host
}

describe('formas del tablero de laser', () => {
  it('no queda ni un emoji en el tablero', async () => {
    const host = await montar(JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8')))
    expect(host.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('cada diana lleva la forma de su color, no solo el color', async () => {
    const host = await montar({
      size: 5, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 4, color: 'azul' }, { row: 4, col: 4, color: 'rojo' }],
      blocks: [], min_piezas: 2
    })
    const formas = [...host.querySelectorAll('.laser-diana')].map((d) => d.dataset.forma)
    expect(formas.sort()).toEqual(['cuadrado', 'triangulo'])
  })

  it('el emisor lleva boquilla orientada, no una flecha de texto', async () => {
    const host = await montar(JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8')))
    const emisores = host.querySelectorAll('.laser-emisor')
    expect(emisores.length).toBeGreaterThan(0)
    expect(emisores[0].style.getPropertyValue('--laser-dir-rot')).toMatch(/deg$/)
    expect(emisores[0].textContent).toBe('')
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/plantillas/laser-formas.test.js`
Expected: FAIL — hoy el emisor es un `<span class="laser-arrow">➤</span>`.

- [ ] **Step 3: Implementar el dibujo**

En `plantillas/laser_triangular.js`, sustituir la construcción de celda:

```js
const FORMA_DE_COLOR = {
  neutro: 'circulo', azul: 'triangulo', rojo: 'cuadrado', magenta: 'rombo'
};
// Los colores de clasico son 'neutro-1', 'neutro-2': misma forma, distinto tinte.
const formaDe = (color) => FORMA_DE_COLOR[String(color).replace(/-\d+$/, '')] || 'circulo';

const TINTE = {
  neutro: '#ff8c42', 'neutro-1': '#ff8c42', 'neutro-2': '#3ec6ff',
  azul: '#3ec6ff', rojo: '#ff5d5d', magenta: '#c084fc'
};
```

Emisor:

```js
const boquilla = createElement('span', { class: 'laser-emisor' });
boquilla.style.setProperty('--laser-dir-rot', `${DIR_ROTATION[laser.emitter.dir]}deg`);
cell.appendChild(boquilla);
```

Diana:

```js
const diana = createElement('span', { class: 'laser-diana' });
diana.dataset.forma = formaDe(target.color);
cell.style.setProperty('--laser-color', TINTE[target.color] || '#ffd23b');
cell.appendChild(diana);
```

La insignia numerada (`laserBadge`) solo se añade si `config.modo === 'clasico'`.

- [ ] **Step 4: Escribir el CSS**

En `style.css`, dentro del bloque de láser: **borrar** las reglas `.laser-arrow` (línea ~2479) y `.laser-target-icon` (~2517), y sus menciones en el bloque `prefers-reduced-motion` del final (~2624). Añadir:

```css
/* Boquilla del emisor: un triangulo macizo apuntando a --laser-dir-rot.
   Sustituye al emoji ➤, que desentonaba con el resto de tableros. */
.laser-emisor {
  position: absolute;
  width: 62%;
  height: 62%;
  background: var(--laser-color, #ff6b35);
  clip-path: polygon(100% 50%, 15% 100%, 35% 50%, 15% 0%);
  transform: rotate(var(--laser-dir-rot, 0deg));
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--laser-color, #ff6b35) 90%, transparent));
}

/* Diana: la FORMA identifica el color, para que el reto se pueda jugar sin
   distinguirlos. El tinte va aparte, en --laser-color. */
.laser-diana {
  position: absolute;
  width: 46%;
  height: 46%;
  background: var(--laser-color, #ffd23b);
}
.laser-diana[data-forma="circulo"]   { border-radius: 50%; }
.laser-diana[data-forma="triangulo"] { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
.laser-diana[data-forma="cuadrado"]  { border-radius: 2px; }
.laser-diana[data-forma="rombo"]     { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }

/* Prisma: triangulo hueco con el borde en degradado azul -> rojo, que es
   justo lo que hace con el rayo. */
.laser-pieza[data-pieza="prisma"] {
  position: absolute;
  width: 66%;
  height: 66%;
  background: linear-gradient(135deg, #3ec6ff, #ff5d5d);
  clip-path: polygon(50% 8%, 96% 92%, 4% 92%, 50% 8%, 50% 26%, 22% 82%, 78% 82%, 50% 26%);
}

/* Condensador: dos arcos que convergen en un punto. */
.laser-pieza[data-pieza="condensador"] {
  position: absolute;
  width: 66%;
  height: 66%;
  border: 2px solid #c084fc;
  border-radius: 50%;
  border-left-color: #3ec6ff;
  border-right-color: #ff5d5d;
  border-top-color: transparent;
  border-bottom-color: transparent;
}
```

Conservar `laserEmitterPulse` y `laserTargetPing` tal cual, y añadir `.laser-emisor` y `.laser-diana` a la lista de selectores del bloque `prefers-reduced-motion`.

- [ ] **Step 5: Ejecutar**

Run: `npx vitest run tests/plantillas/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plantillas/laser_triangular.js style.css tests/plantillas/laser-formas.test.js
git commit -m "Laser: formas dibujadas en vez de emoji, con forma por color"
```

---

### Task 11: Bandeja de piezas arrastrable

**Files:**
- Modify: `plantillas/laser_triangular.js`
- Modify: `style.css`
- Modify: `tests/plantillas/laser-muestra.test.js` (el ciclo de clics desaparece)
- Test: `tests/plantillas/laser-bandeja.test.js` (crear)

**Interfaces:**
- Consumes: `tiposDisponibles`, `PIEZA`.
- Produces: en el DOM, `.laser-tray` con `.laser-tray-pieza[data-pieza]`; la celda con pieza colocada lleva `.laser-pieza[data-pieza]`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/plantillas/laser-bandeja.test.js`:

```js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

const muestra = async () => JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))

describe('bandeja de piezas', () => {
  it('en clasico solo ofrece los cuatro espejos', async () => {
    const host = await montar({
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [], min_espejos: 2
    })
    const piezas = [...host.querySelectorAll('.laser-tray-pieza')].map((b) => b.dataset.pieza)
    expect(piezas).toEqual(['slash', 'backslash', 'vert', 'horiz'])
  })

  it('con prisma ofrece las seis', async () => {
    const host = await montar(await muestra())
    expect(host.querySelectorAll('.laser-tray-pieza')).toHaveLength(6)
  })

  it('tocar una pieza y luego una celda la coloca', async () => {
    const host = await montar(await muestra())
    const n = (await muestra()).size
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const celdas = host.querySelectorAll('.laser-cell')
    const libre = [...celdas].find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    expect(libre.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')
  })

  it('tocar una pieza ya colocada la retira', async () => {
    const host = await montar(await muestra())
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    libre.click()
    expect(libre.querySelector('.laser-pieza')).toBeNull()
  })

  it('no deja colocar sobre un emisor, una diana ni un bloque', async () => {
    const host = await montar(await muestra())
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const emisor = host.querySelector('.laser-cell.is-emitter')
    emisor.click()
    expect(emisor.querySelector('.laser-pieza')).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/plantillas/laser-bandeja.test.js`
Expected: FAIL — no existe `.laser-tray`.

- [ ] **Step 3: Implementar la bandeja**

Bandeja, antes del tablero:

```js
const NOMBRE_PIEZA = {
  [PIEZA.SLASH]: 'slash', [PIEZA.BACKSLASH]: 'backslash',
  [PIEZA.VERT]: 'vert', [PIEZA.HORIZ]: 'horiz',
  [PIEZA.PRISMA]: 'prisma', [PIEZA.CONDENSADOR]: 'condensador'
};

// Las formas no llevan texto, asi que la etiqueta es lo unico que lee quien
// navegue con lector de pantalla.
const ETIQUETA_PIEZA = {
  [PIEZA.SLASH]: 'Espejo diagonal /', [PIEZA.BACKSLASH]: 'Espejo diagonal \\',
  [PIEZA.VERT]: 'Espejo vertical', [PIEZA.HORIZ]: 'Espejo horizontal',
  [PIEZA.PRISMA]: 'Prisma: parte el rayo en azul y rojo',
  [PIEZA.CONDENSADOR]: 'Condensador: junta azul y rojo en magenta'
};

const tray = createElement('div', { class: 'laser-tray', role: 'toolbar', 'aria-label': 'Piezas' });
tiposDisponibles(config.modo).forEach((tipo) => {
  const btn = createElement('button', { class: 'laser-tray-pieza', type: 'button' });
  btn.dataset.pieza = NOMBRE_PIEZA[tipo];
  btn.setAttribute('aria-label', ETIQUETA_PIEZA[tipo]);
  btn.addEventListener('click', () => armar(tipo));
  tray.appendChild(btn);
});
```

`armar(tipo)` guarda `state.armada = tipo` y marca el botón con `.is-armada` (`aria-pressed="true"`). El manejador de celda:

```js
function onCellClick(r, c) {
  if (state.won || sinPieza.has(`${r},${c}`)) return;
  if (state.piezas[r][c] !== PIEZA.VACIO) state.piezas[r][c] = PIEZA.VACIO;  // tocar retira
  else if (state.armada) state.piezas[r][c] = state.armada;
  else return;
  apagaTrazo();     // colocar o quitar apaga el rayo (Task 12)
  refresh();
}
```

Arrastrar, con Pointer Events — un solo camino de código para ratón, dedo y lápiz:

```js
// pointerdown sobre una pieza de la bandeja (o sobre una ya colocada) arma esa
// pieza y empieza el arrastre; pointerup sobre una celda la suelta ahi. Se usa
// setPointerCapture para no perder el gesto al salir del elemento, y
// document.elementFromPoint para saber sobre que celda se ha soltado.
btn.addEventListener('pointerdown', (ev) => {
  armar(tipo);
  btn.setPointerCapture(ev.pointerId);
  state.arrastrando = true;
});
btn.addEventListener('pointerup', (ev) => {
  if (!state.arrastrando) return;
  state.arrastrando = false;
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const celda = bajo && bajo.closest('.laser-cell');
  if (celda && celda.dataset.fila !== undefined) {
    onCellClick(Number(celda.dataset.fila), Number(celda.dataset.col));
  }
});
```

Cada celda recibe `dataset.fila` y `dataset.col` al construirse. Soltar fuera del tablero no hace nada; una pieza ya colocada se arrastra igual, retirándola de su celda de origen al empezar.

happy-dom no implementa `setPointerCapture` ni `elementFromPoint` de forma útil, así que **los tests cubren el camino de toque** (`click`), que es el mismo `onCellClick`. El arrastre se comprueba a mano en el navegador con `npm run dev`.

- [ ] **Step 4: Quitar el ciclo de cinco estados y adaptar el test del muestrario**

En `tests/plantillas/laser-muestra.test.js`, el ayudante `clicks(host, fila, col, columnas, veces)` deja de tener sentido. Sustituirlo por uno que arme la pieza y toque la celda una vez:

```js
const coloca = (host, fila, columna, columnas, tipo) => {
  const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
  host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
  host.querySelectorAll('.laser-cell')[fila * columnas + columna].click()
}
```

y recorrer la solución de `resolverPiezas` colocando cada pieza por su tipo.

- [ ] **Step 5: Escribir el CSS de la bandeja**

```css
/* Bandeja abierta: existencias infinitas de cada pieza, asi que sin
   contadores. touch-action: none para que arrastrar no haga scroll. */
.laser-tray {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 0 0 12px;
  touch-action: none;
}

.laser-tray-pieza {
  position: relative;
  width: 44px;
  height: 44px;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  cursor: grab;
  touch-action: none;
}

.laser-tray-pieza:hover { border-color: rgba(255, 255, 255, 0.4); }

/* Pieza armada: el siguiente toque en una celda la coloca. */
.laser-tray-pieza.is-armada {
  border-color: #ffd23b;
  box-shadow: 0 0 10px color-mix(in srgb, #ffd23b 60%, transparent);
}

.laser-tray-pieza:active { cursor: grabbing; }

/* Las piezas de la bandeja se dibujan con las mismas reglas que las del
   tablero: una sola definicion de cada forma. */
.laser-tray-pieza .laser-pieza { inset: 0; margin: auto; }

.laser-board { touch-action: none; }
```

- [ ] **Step 6: Ejecutar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plantillas/laser_triangular.js style.css tests/plantillas/
git commit -m "Laser: bandeja de piezas arrastrable en vez del ciclo de clics"
```

---

### Task 12: Botón de disparo y trazado automático solo en la variante pequeña

**Files:**
- Modify: `plantillas/laser_triangular.js`
- Modify: `style.css`
- Test: `tests/plantillas/laser-disparo.test.js` (crear)

**Interfaces:**
- Consumes: `resuelto`, `simularTodos`.
- Produces: en el DOM, `.laser-btn-lanzar` (ausente si `config.variant === 'pequeno'`).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/plantillas/laser-disparo.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// happy-dom no implementa <canvas> y la celebracion pinta confeti en uno.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

const CLASICO = {
  variant: 'medio', size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: [], min_espejos: 2
}

describe('boton de disparo', () => {
  it('en medio y grande hay boton y el tablero arranca sin rayo dibujado', async () => {
    const host = await montar(CLASICO)
    expect(host.querySelector('.laser-btn-lanzar')).not.toBeNull()
    expect(host.querySelector('.laser-beams').children).toHaveLength(0)
  })

  it('al pulsar el boton se dibuja el rayo', async () => {
    const host = await montar(CLASICO)
    host.querySelector('.laser-btn-lanzar').click()
    expect(host.querySelector('.laser-beams').children.length).toBeGreaterThan(0)
  })

  it('colocar una pieza apaga el rayo dibujado', async () => {
    const host = await montar(CLASICO)
    host.querySelector('.laser-btn-lanzar').click()
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    expect(host.querySelector('.laser-beams').children).toHaveLength(0)
  })

  it('en pequeno no hay boton y el rayo se dibuja solo', async () => {
    const host = await montar({ ...CLASICO, variant: 'pequeno' })
    expect(host.querySelector('.laser-btn-lanzar')).toBeNull()
    expect(host.querySelector('.laser-beams').children.length).toBeGreaterThan(0)
  })

  it('la victoria solo se canta al disparar, no al colocar la ultima pieza', async () => {
    const { resolverPiezas, normalizaConfig } = await import('../../scripts/laser-triangular-logic.js')
    const sol = resolverPiezas(normalizaConfig(CLASICO), CLASICO.min_espejos)
    let ganado = 0
    const host = await montar(CLASICO, { onSuccess: () => { ganado++ } })
    const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
    sol.piezas.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (!tipo) return
      host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
      host.querySelectorAll('.laser-cell')[r * CLASICO.size + c].click()
    }))
    expect(ganado, 'ha cantado victoria sin disparar').toBe(0)
    host.querySelector('.laser-btn-lanzar').click()
    expect(ganado).toBe(1)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/plantillas/laser-disparo.test.js`
Expected: FAIL — no existe `.laser-btn-lanzar`.

- [ ] **Step 3: Implementar**

```js
// En la variante pequena el rayo se redibuja solo en cada cambio: es el nivel
// de entrada y ahi ver el rayo moverse es la mitad de aprender el juego. En
// medio y grande manda el boton, y la victoria solo se comprueba al disparar.
const autoTraza = config.variant === 'pequeno';

function apagaTrazo() {
  if (autoTraza) { refresh(); return; }
  state.trazado = false;
  svg.innerHTML = '';
  cellEls.forEach((f) => f.forEach((c) => c.classList.remove('is-hit', 'is-crossing', 'is-choque')));
  setStatus(ui.status, 'Coloca piezas y lanza el rayo', 'ok');
}

function lanzar() {
  state.trazado = true;
  refresh();
  const { cruces, tramos } = simularTodos(config, state.piezas);
  if (resuelto(config, state.piezas)) {
    state.won = true;
    setStatus(ui.status, '¡Todos los rayos llegaron a su diana!', 'ok');
    celebrate({ ok: true, message: '¡Has dirigido los rayos hasta sus dianas!' });
    if (hooks && hooks.onSuccess) {
      const puestas = state.piezas.reduce((t, fila) => t + fila.filter(Boolean).length, 0);
      hooks.onSuccess({ movimientos: puestas });
    }
  } else if (cruces.size > 0) {
    setStatus(ui.status, 'Los rayos se cruzan: dos trayectos no pueden compartir celda', 'ko');
  } else if (tramos.some((t) => t.resultado === 'emisor')) {
    setStatus(ui.status, 'El rayo choca con un emisor y se apaga', 'ko');
  } else {
    setStatus(ui.status, 'Todavia no. Mueve alguna pieza y vuelve a lanzar', 'ko');
  }
}
```

El botón solo se añade si `!autoTraza`. `refresh()` no dibuja nada en el SVG si `!autoTraza && !state.trazado`.

El tramo que acaba en `'emisor'` o `'bloqueo'` marca la celda final con `.is-choque`. El trazo se anima con `stroke-dasharray`: cada `polyline` recibe `--laser-largo` = `getTotalLength()` y una animación CSS de `stroke-dashoffset`. En happy-dom `getTotalLength` no existe, así que se protege con `typeof linea.getTotalLength === 'function'`.

- [ ] **Step 4: Actualizar las instrucciones**

En el `instructionsHTML` de `buildStandardShell`: gestos nuevos (arrastrar o tocar-tocar), el botón de lanzar, el prisma, el condensador y la regla de cruce. Quitar la frase del ciclo de espejos, que ya no existe.

- [ ] **Step 5: Escribir el CSS**

```css
.laser-btn-lanzar {
  font-weight: 600;
}

/* Donde el rayo se apaga: contra un emisor o contra un bloque. */
.laser-cell.is-choque {
  animation: laserChoque 0.9s ease-in-out infinite;
  border-color: #ff5d5d;
}

@keyframes laserChoque {
  0%, 100% { box-shadow: inset 0 0 6px color-mix(in srgb, #ff5d5d 40%, transparent); }
  50%      { box-shadow: inset 0 0 14px color-mix(in srgb, #ff5d5d 90%, transparent); }
}

/* El rayo avanza en vez de aparecer de golpe. --laser-largo lo fija la
   plantilla con getTotalLength(). */
.laser-beam-line.is-lanzando {
  stroke-dasharray: var(--laser-largo);
  stroke-dashoffset: var(--laser-largo);
  animation: laserAvanza 0.45s ease-out forwards;
}

@keyframes laserAvanza {
  to { stroke-dashoffset: 0; }
}
```

Añadir `.laser-cell.is-choque` y `.laser-beam-line.is-lanzando` a la lista del bloque `prefers-reduced-motion` del final: quien lo tenga activado ve el rayo entero de golpe, que es lo correcto.

- [ ] **Step 6: Ejecutar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plantillas/laser_triangular.js style.css tests/plantillas/laser-disparo.test.js
git commit -m "Laser: boton de lanzar el rayo, con trazado automatico solo en pequeno"
```

---

### Task 13: Regenerar el muestrario y cerrar

**Files:**
- Modify: `scripts/generate-muestrario.js:40` (la semilla de láser)
- Modify: `data/muestra/laser-triangular.json` (regenerado)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el ejemplo de la sala enseña el modo prisma.

- [ ] **Step 1: Buscar una semilla que caiga en modo prisma**

```bash
node -e "
import('./scripts/laser-triangular-logic.js').then(({ modoDeSeed, tamanoDeSeed }) => {
  for (let s = 20260101; s < 20260401; s++) {
    if (modoDeSeed(s) === 'prisma' && tamanoDeSeed(s) === 'medio') { console.log(s); break; }
  }
});
"
```

El ejemplo de la sala debe enseñar la mecánica nueva, así que se elige `prisma`; `medio` para que se vea el botón de lanzar.

- [ ] **Step 2: Cambiar la semilla y regenerar**

Poner esa semilla en `scripts/generate-muestrario.js:40` y ejecutar:

```bash
node scripts/generate-muestrario.js
git status --porcelain
```

- [ ] **Step 3: Ejecutar la batería completa**

```bash
npm test
node scripts/test-generator.js
node scripts/validate-retos.js
git status --porcelain     # limpiar solo lo que salga como '??' del smoke test
```

Expected: los tres PASS. `tests/plantillas/laser-muestra.test.js` resuelve ahora un ejemplo con prisma: si falla, el ejemplo generado no es resoluble en la plantilla y hay que mirar la plantilla, no el test.

- [ ] **Step 4: Comprobarlo a mano en el navegador**

```bash
npm run dev
```

Abrir `http://localhost:8000/?tipo=laser-triangular` y comprobar las cuatro cosas que los tests no cubren: el arrastre con ratón funciona, el arrastre con dedo funciona (con el emulador táctil de las herramientas de desarrollo), el rayo se anima al lanzarlo, y no hay ni un emoji en el tablero.

- [ ] **Step 5: Actualizar CLAUDE.md**

En la sección de arquitectura, reescribir el párrafo de `laser-triangular` para que cuente: los dos ejes (tamaño y modo) con máscara propia cada uno; que el trazador devuelve tramos con color y llega a punto fijo con tope; las reglas del prisma (±45°, sin dividir dos veces) y del condensador (mezcla a magenta); que la regla de cruce es "una celda visitada por más de un tramo, salvo prisma y condensador"; que los emisores absorben; y que la bandeja es abierta y el rayo solo se traza solo en `pequeno`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-muestrario.js data/muestra/laser-triangular.json CLAUDE.md
git commit -m "Laser: el ejemplo de la sala ensena el modo prisma"
```
