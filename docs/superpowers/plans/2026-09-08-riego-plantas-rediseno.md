# Riego de plantas: reglas por ficha y deducción real por planta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna planta de un reto de riego-plantas tenga holgura cero (ventana exacta a sus dosis), que la ventana y la pareja incompatible de cada planta se consulten tocándola en vez de leerse de corrido en las instrucciones, y que consultar de más también cueste estrellas.

**Architecture:** Tres piezas independientes que se enganchan entre sí: (1) el generador y el validador comparten un suelo de holgura por planta (no una suma total); (2) `estrellas.js` se generaliza para tomar la peor nota de varias medidas declaradas a la vez, lo que permite (3) que la plantilla declare una segunda medida (`consultas`) además de `movimientos`, y mueva el texto de reglas de las instrucciones fijas a una ficha por planta con doce iconos nuevos.

**Tech Stack:** JavaScript plano (ES modules, sin bundler), vitest, SVG a mano.

**Spec:** `docs/superpowers/specs/2026-09-08-riego-plantas-rediseno-design.md`

## Global Constraints

- Esquema publicado (`data/riego_*.json`, `objectives`) crece, no rompe: un reto viejo sin los campos nuevos se sigue jugando igual (spec sección 6).
- Sin verde en ningún icono nuevo: `--success` (`#10b981`) es verde y está reservado para estados de acierto en la interfaz; los doce iconos de planta usan solo la paleta ya establecida (`#140A3C` trazo, `#F8C818` oro, `#1788C7`/`#10608E` azul/cian, `#8A2189`/`#5E1660` morado) (spec sección 3).
- `MARGEN_MINIMO` por variante (`{ huerto: 1, invernadero: 1, vivero: 2 }`) es un punto de partida: la Tarea 1 mide el coste real de intentos antes de darlo por bueno, mismo patrón que el comentario ya existente sobre `MAX_INTENTOS` en `scripts/riego-logic.js`.

---

### Task 1: Generador — margen mínimo por planta

**Files:**
- Modify: `scripts/riego-logic.js:106-115` (constantes), `:225-253` (poda y chequeo final)
- Test: `tests/riego/generador.test.js` (extender)

**Interfaces:**
- Produce: `MARGEN_MINIMO` (objeto `{ huerto, invernadero, vivero }`), no exportado — solo lo usa este archivo. `buildRiegoPuzzle(seed)` sigue con la misma firma; su resultado ahora garantiza `plants.every(p => p.ventana.length - p.doses >= MARGEN_MINIMO[variant])`.

- [ ] **Step 1: Escribir el test que falla**

```js
// en tests/riego/generador.test.js, añadir tras la descripción existente 'buildRiegoPuzzle':
import { MARGEN_MINIMO } from '../../scripts/riego-logic.js'

describe('buildRiegoPuzzle: ninguna planta con holgura cero', () => {
  it('cada planta tiene al menos el margen mínimo de su variante', () => {
    for (const seed of SEEDS) {
      const p = buildRiegoPuzzle(seed)
      for (const planta of p.plants) {
        const holgura = planta.ventana.length - planta.doses
        expect(holgura, `seed ${seed} (${p.variant}): ${planta.id} sin margen`)
          .toBeGreaterThanOrEqual(MARGEN_MINIMO[p.variant])
      }
    }
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/riego/generador.test.js`
Expected: FAIL — `MARGEN_MINIMO` no existe todavía (import error), o si se comenta el import, el reto de hoy (seed real con 3 plantas de holgura 0) da el fallo de aserción.

- [ ] **Step 3: Añadir `MARGEN_MINIMO` y exportarlo**

En `scripts/riego-logic.js`, junto a `MAX_INTENTOS` (línea 115):

```js
// Suelo de holgura por planta (ventana.length - doses), no una suma total:
// una suma total dejaba pasar retos con una planta de holgura 5 compensando
// a otras tres con holgura 0 -- exactamente el caso que rompió el reto del
// 2026-09-07 (tres de cinco plantas con ventana == dosis, cero elección).
// Punto de partida por tamaño de tablero, no medido todavía (ver Step 6).
export const MARGEN_MINIMO = { huerto: 1, invernadero: 1, vivero: 2 };
```

- [ ] **Step 4: Acotar la poda para que respete el suelo**

Sustituir el bucle de poda (línea ~225-238, dentro de `buildRiegoPuzzle`) por:

```js
    let vueltas = 0;
    while (contarSoluciones(config, { tope: 2 }).soluciones > 1 && vueltas < 60) {
      vueltas++;
      const candidatas = [];
      plants.forEach((p, i) => {
        // No ofrecer un ciclo si quitarlo dejaría a esta planta por debajo
        // de su suelo de margen -- así la poda reparte los recortes en vez
        // de agotar la ventana de una sola planta.
        if (p.ventana.length - p.doses <= MARGEN_MINIMO[cfg.nombre]) return;
        p.ventana.forEach((c) => {
          if (!calendario[i].includes(c)) candidatas.push({ i, c });
        });
      });
      if (!candidatas.length) break;

      let mejor = null;
      for (const cand of candidatas) {
        const original = plants[cand.i].ventana;
        plants[cand.i].ventana = original.filter((x) => x !== cand.c);
        const cuentan = contarSoluciones(config, { tope: 6 }).soluciones;
        plants[cand.i].ventana = original;
        if (cuentan >= 1 && (mejor === null || cuentan < mejor.cuentan)) mejor = { ...cand, cuentan };
        if (cuentan === 1) break;
      }
      if (!mejor) break;
      plants[mejor.i].ventana = plants[mejor.i].ventana.filter((x) => x !== mejor.c);
    }

    const res = contarSoluciones(config, { tope: 2 });
    if (res.soluciones !== 1) continue;

    // Cierre: por si algún camino esquivara el filtro de arriba.
    if (plants.some((p) => p.ventana.length - p.doses < MARGEN_MINIMO[cfg.nombre])) continue;
```

(Reemplaza también el viejo chequeo de holgura total, líneas 252-253 — el `if (holgura < plants.length) continue;` desaparece, ya no hace falta con el suelo por planta.)

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/riego/generador.test.js`
Expected: PASS

- [ ] **Step 6: Medir el coste de intentos con el suelo nuevo**

```bash
node -e "
import('./scripts/riego-logic.js').then(m => {
  const porVariante = { huerto: [], invernadero: [], vivero: [] };
  for (let seed = 1; seed <= 400; seed++) {
    const p = m.buildRiegoPuzzle(seed);
    porVariante[p.variant].push(p.intentos);
  }
  for (const [v, xs] of Object.entries(porVariante)) {
    const media = xs.reduce((a,b)=>a+b,0) / xs.length;
    console.log(v, 'n=' + xs.length, 'media=' + media.toFixed(1), 'max=' + Math.max(...xs));
  }
});
"
```

Anotar el resultado en el comentario de `MAX_INTENTOS` (línea 115), junto a la medición ya existente ("medido sobre 1008 fechas..."). Si el máximo de alguna variante se acerca a `MAX_INTENTOS` (3000) o si el `for` de arriba tarda más de unos segundos por lanzar `buildRiegoPuzzle` 400 veces, subir `MAX_INTENTOS` con el mismo criterio que ya documenta ese comentario (margen sobre el máximo medido, no un número redondo sin más). Si en cambio el máximo queda cómodo, dejar `MAX_INTENTOS` como está y anotar igualmente la medición.

- [ ] **Step 7: Commit**

```bash
git add scripts/riego-logic.js tests/riego/generador.test.js
git commit -m "feat(riego): margen minimo de holgura por planta, no una suma total"
```

---

### Task 2: Validador — mismo suelo por planta

**Files:**
- Modify: `scripts/validate-retos.js:945-949` (chequeo de holgura), imports en la cabecera del archivo
- Test: `tests/riego/validacion.test.js` (extender)

**Interfaces:**
- Consume: `MARGEN_MINIMO` de `scripts/riego-logic.js` (Task 1).

- [ ] **Step 1: Escribir el test que falla**

Añadir, en un `describe` nuevo al final de `tests/riego/validacion.test.js` (el archivo ya define `retoConPayload(payload)`, que escribe el payload a un fichero temporal y devuelve `{ tipo: 'riego-plantas', data: { json_url } }` listo para `validateRiegoData` — reusar tal cual, es el mismo helper que ya usa `describe('validateRiegoData con incompatibles', ...)`):

```js
describe('validateRiegoData exige margen por planta, no por suma total', () => {
  it('rechaza una planta de holgura cero aunque la suma total cumpliera antes', async () => {
    // Antes: holgura total = 0+0+5 = 5 >= 3 plantas -> pasaba. Ahora: Helecho
    // sola ya viola el suelo de su variante (vivero >= 2), sin importar la suma.
    const reto = await retoConPayload({
      variant: 'vivero', cycles: 8, capacity: 3,
      plants: [
        { id: 'Helecho', doses: 2, ventana: [0, 4] },       // holgura 0
        { id: 'Lavanda', doses: 3, ventana: [0, 5, 7] },    // holgura 0
        { id: 'Menta', doses: 3, ventana: [1, 2, 3, 4, 5, 6, 7, 8] } // holgura 5
      ]
    })
    await expect(new RetoValidator().validateRiegoData(reto))
      .rejects.toThrow(/sin margen.*Helecho/i)
  })
})
```

(El mensaje de error, tal como se escribe en el Step 3, es `"Riego-plantas sin margen de decisión: Helecho solo tiene holgura 0 (mínimo 2 para vivero)"` — `sin margen` aparece antes que `Helecho`, de ahí el orden de la expresión regular.)

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/riego/validacion.test.js`
Expected: FAIL — el chequeo viejo (suma total) deja pasar este payload (holgura total 5 >= 3 plantas), así que no lanza.

- [ ] **Step 3: Importar `MARGEN_MINIMO` y sustituir el chequeo**

En la cabecera de `scripts/validate-retos.js`, localizar el import ya existente de `scripts/riego-logic.js` (`contarSoluciones` u otra función de ese módulo) y añadir `MARGEN_MINIMO` a la misma línea de import.

Sustituir el bloque de holgura (líneas 945-949) por:

```js
    // Con las ventanas clavadas a la solución no hay nada que decidir --
    // por planta, no por suma total (una planta de holgura 5 no puede
    // compensar a otra de holgura 0: ver MARGEN_MINIMO en riego-logic.js).
    const variant = MARGEN_MINIMO[data.variant] !== undefined ? data.variant : 'huerto';
    const falta = data.plants.find((p) => (p.ventana.length - p.doses) < MARGEN_MINIMO[variant]);
    if (falta) {
      throw new Error(
        `Riego-plantas sin margen de decisión: ${falta.id} solo tiene holgura ` +
        `${falta.ventana.length - falta.doses} (mínimo ${MARGEN_MINIMO[variant]} para ${variant})`
      );
    }
```

(El `variant` por defecto a `'huerto'` cubre payloads viejos sin ese campo — `huerto` es el suelo más bajo, así que nunca rechaza de más a un reto antiguo que no declare variante.)

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/riego/validacion.test.js`
Expected: PASS

- [ ] **Step 5: Correr `validate-retos.js` sobre el archivo real**

Run: `node scripts/validate-retos.js`
Expected: PASS — el único reto de riego publicado hasta ahora (o los que haya) deben seguir siendo válidos (el reto de hoy, si sigue siendo el mismo, tenía tres plantas con holgura 0 y **debería fallar aquí** si no se ha regenerado todavía; eso es correcto y esperado — se soluciona regenerando el reto en la Tarea 6, no aquí).

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-retos.js tests/riego/validacion.test.js
git commit -m "fix(riego): el validador exige margen por planta, no una suma total"
```

---

### Task 3: Estrellas combinadas — la peor de varias medidas

**Files:**
- Modify: `estrellas.js` (función `estrellasDe`, array `MEDIDAS`)
- Modify: `scripts/generate-daily-reto.js:734-739` (`generateRiego`, bloque `objectives`)
- Test: `tests/estrellas/estrellas.test.js` (extender)

**Interfaces:**
- Produce: `estrellasDe(objectives, marca)` — misma firma, ahora calcula todas las medidas con umbral declarado en `objectives` y devuelve la peor nota entre las que la `marca` reporte. `parDe(objectives)` no cambia de comportamiento.
- Consume (Task 5 la usará): `marca.consultas`, junto a `marca.movimientos`, en el mismo objeto que ya recibe `estrellasDe`.

- [ ] **Step 1: Escribir el test que falla**

```js
// en tests/estrellas/estrellas.test.js, añadir:
describe('estrellasDe, dos medidas a la vez (riego-plantas)', () => {
  const obj = {
    maxMovesFor3Stars: 14, maxMovesFor2Stars: 16,
    maxConsultasFor3Stars: 0, maxConsultasFor2Stars: 2
  }

  it('las dos en su umbral de tres estrellas dan tres', () => {
    expect(estrellasDe(obj, { movimientos: 14, consultas: 0 })).toBe(3)
  })

  it('movimientos perfectos pero demasiadas consultas: gana la peor', () => {
    expect(estrellasDe(obj, { movimientos: 14, consultas: 5 })).toBe(1)
  })

  it('consultas perfectas pero muchos movimientos: gana la peor', () => {
    expect(estrellasDe(obj, { movimientos: 40, consultas: 0 })).toBe(1)
  })

  it('las dos a medio camino dan dos', () => {
    expect(estrellasDe(obj, { movimientos: 16, consultas: 2 })).toBe(2)
  })

  it('si la marca no reporta consultas, esa medida no penaliza', () => {
    expect(estrellasDe(obj, { movimientos: 14 })).toBe(3)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/estrellas/estrellas.test.js`
Expected: FAIL — `estrellasDe` hoy solo mira la primera medida (`movimientos`), así que "movimientos perfectos pero demasiadas consultas" da 3 en vez de 1.

- [ ] **Step 3: Añadir la medida `consultas` a `MEDIDAS`**

En `estrellas.js`, en el array `MEDIDAS`, añadir tras la entrada de `fallos`:

```js
  {
    marca: 'consultas',
    unidad: null,   // no se enseña como meta en pantalla, solo cuenta al ganar
    tres: (o) => primeroFinito(o.maxConsultasFor3Stars),
    dos: (o) => primeroFinito(o.maxConsultasFor2Stars, sumar(o.maxConsultasFor3Stars, 2))
  }
```

- [ ] **Step 4: Generalizar `estrellasDe` a "la peor de todas las medidas declaradas"**

Sustituir la función `estrellasDe` completa por:

```js
export function estrellasDe(objectives, marca = {}) {
  const medidas = MEDIDAS.filter((m) => Number.isFinite(m.tres(objectives || {})));
  if (!medidas.length) return MAX_ESTRELLAS;

  let peor = MAX_ESTRELLAS;
  for (const medida of medidas) {
    const valor = marca ? marca[medida.marca] : undefined;
    // Esta medida concreta no se reporta (una plantilla que no cuenta
    // consultas, o un reto viejo sin esa medida en marca): no penaliza.
    if (!Number.isFinite(valor)) continue;
    let nota;
    if (valor <= medida.tres(objectives)) nota = 3;
    else {
      const dos = medida.dos(objectives);
      nota = (Number.isFinite(dos) && valor <= dos) ? 2 : 1;
    }
    peor = Math.min(peor, nota);
  }
  return peor;
}
```

`parDe` no se toca — sigue usando `medidaDe` (la función existente, sin cambios) para mostrar solo la primera medida con `unidad`.

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/estrellas/estrellas.test.js`
Expected: PASS — incluye también los tests ya existentes (movimientos solo, pesadas, fallos, casos de borde): deben seguir en verde sin cambios, porque con una sola medida declarada el resultado es idéntico al de antes.

- [ ] **Step 6: Declarar los umbrales de consultas en el generador diario**

En `scripts/generate-daily-reto.js`, en `generateRiego` (línea 734-739), añadir al bloque `objectives`:

```js
      objectives: {
        winCondition: 'watering_schedule_valid',
        parMoves: totalRiegos,
        maxMovesFor3Stars: totalRiegos,
        maxMovesFor2Stars: totalRiegos + 2,
        // Disciplina de memoria, no dificultad del calendario -- fijo,
        // no depende de la semilla (ver spec sección 5).
        maxConsultasFor3Stars: 0,
        maxConsultasFor2Stars: 2
      },
```

- [ ] **Step 7: Commit**

```bash
git add estrellas.js scripts/generate-daily-reto.js tests/estrellas/estrellas.test.js
git commit -m "feat(estrellas): la nota final es la peor de todas las medidas declaradas"
```

---

### Task 4: Doce iconos de planta

**Files:**
- Create: `assets/planta-albahaca.svg`, `assets/planta-tomatera.svg`, `assets/planta-cactus.svg`, `assets/planta-orquidea.svg`, `assets/planta-helecho.svg`, `assets/planta-romero.svg`, `assets/planta-lavanda.svg`, `assets/planta-menta.svg`, `assets/planta-aloe.svg`, `assets/planta-petunia.svg`, `assets/planta-jazmin.svg`, `assets/planta-perejil.svg`
- Test: `tests/riego/iconos.test.js` (nuevo)

**Interfaces:**
- Produce: doce ficheros SVG válidos, `viewBox="0 0 200 200"`, sin ningún `fill` verde. Task 5 los consume mapeando cada nombre de `BANCO_PLANTAS` a su ruta.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/riego/iconos.test.js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const PLANTAS = [
  'albahaca', 'tomatera', 'cactus', 'orquidea', 'helecho', 'romero',
  'lavanda', 'menta', 'aloe', 'petunia', 'jazmin', 'perejil'
]

// Colores con un canal verde dominante (RRGGBB con GG bien por encima de RR
// y BB) -- --success (#10b981) es verde y está reservado para estados de
// acierto en la interfaz; un icono decorativo no debe competir con esa señal.
function tieneVerdeDominante(hex) {
  const m = /#([0-9A-Fa-f]{6})\b/g
  let match
  while ((match = m.exec(hex))) {
    const n = match[1]
    const r = parseInt(n.slice(0, 2), 16)
    const g = parseInt(n.slice(2, 4), 16)
    const b = parseInt(n.slice(4, 6), 16)
    if (g > r + 30 && g > b + 30) return true
  }
  return false
}

describe('iconos de planta', () => {
  for (const nombre of PLANTAS) {
    it(`assets/planta-${nombre}.svg existe y es un icono válido`, async () => {
      const contenido = await fs.readFile(`assets/planta-${nombre}.svg`, 'utf8')
      expect(contenido).toContain('viewBox="0 0 200 200"')
      expect(contenido.startsWith('<svg')).toBe(true)
      expect(tieneVerdeDominante(contenido), `planta-${nombre}.svg usa un color verde`).toBe(false)
    })
  }
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/riego/iconos.test.js`
Expected: FAIL — ninguno de los doce ficheros existe todavía (`ENOENT`).

- [ ] **Step 3: Crear los doce iconos**

Mismo lenguaje visual que `assets/icono-riego-plantas.svg` (trazo `#140A3C` grosor 7, `stroke-linejoin/linecap="round"`, formas rellenas en la paleta ya establecida). Los doce comparten la misma maceta (trapecio azul) y difieren en el follaje:

`assets/planta-albahaca.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V70"/>
    <ellipse cx="76" cy="96" rx="22" ry="14" fill="#F8C818" transform="rotate(-30 76 96)"/>
    <ellipse cx="124" cy="96" rx="22" ry="14" fill="#F8C818" transform="rotate(30 124 96)"/>
    <ellipse cx="70" cy="130" rx="20" ry="13" fill="#F8C818" transform="rotate(-25 70 130)"/>
    <ellipse cx="130" cy="130" rx="20" ry="13" fill="#F8C818" transform="rotate(25 130 130)"/>
    <ellipse cx="100" cy="68" rx="18" ry="24" fill="#F8C818"/>
  </g>
</svg>
```

`assets/planta-tomatera.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V64"/>
    <path d="M100 110 Q76 100 66 78"/>
    <path d="M100 90 Q124 80 134 58"/>
    <circle cx="80" cy="92" r="18" fill="#F8C818"/>
    <circle cx="122" cy="112" r="16" fill="#C99A0F"/>
    <circle cx="100" cy="64" r="15" fill="#F8C818"/>
  </g>
</svg>
```

`assets/planta-cactus.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <rect x="80" y="60" width="40" height="94" rx="20" fill="#10608E"/>
    <path d="M80 100 h-22 a10 10 0 0 0 -10 10 v20 a10 10 0 0 0 10 10 h14" fill="#10608E"/>
    <path d="M120 84 h22 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-14" fill="#10608E"/>
    <path d="M92 70 V150 M108 70 V150" stroke="#0A4A6E" stroke-width="4"/>
  </g>
</svg>
```

`assets/planta-orquidea.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 Q92 110 100 76"/>
    <ellipse cx="100" cy="60" rx="16" ry="20" fill="#8A2189"/>
    <ellipse cx="76" cy="76" rx="18" ry="13" fill="#8A2189" transform="rotate(-40 76 76)"/>
    <ellipse cx="124" cy="76" rx="18" ry="13" fill="#8A2189" transform="rotate(40 124 76)"/>
    <ellipse cx="82" cy="104" rx="16" ry="11" fill="#5E1660" transform="rotate(-20 82 104)"/>
    <ellipse cx="118" cy="104" rx="16" ry="11" fill="#5E1660" transform="rotate(20 118 104)"/>
  </g>
</svg>
```

`assets/planta-helecho.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 Q60 110 54 62" stroke-width="6"/>
    <path d="M100 150 Q78 100 70 56" stroke-width="6"/>
    <path d="M100 150 Q100 90 100 50" stroke-width="6"/>
    <path d="M100 150 Q122 100 130 56" stroke-width="6"/>
    <path d="M100 150 Q140 110 146 62" stroke-width="6"/>
    <path d="M100 130 l-10 -6 M100 130 l10 -6 M100 110 l-10 -6 M100 110 l10 -6 M100 90 l-10 -6 M100 90 l10 -6 M100 70 l-8 -5 M100 70 l8 -5" stroke-width="4"/>
  </g>
</svg>
```

`assets/planta-romero.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V56" stroke-width="6"/>
    <path d="M100 140 l-16 -8 M100 140 l16 -8 M100 122 l-16 -8 M100 122 l16 -8 M100 104 l-16 -8 M100 104 l16 -8 M100 86 l-16 -8 M100 86 l16 -8 M100 68 l-14 -8 M100 68 l14 -8" stroke="#10608E" stroke-width="6"/>
  </g>
</svg>
```

`assets/planta-lavanda.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V78" stroke-width="6"/>
    <ellipse cx="100" cy="66" rx="10" ry="14" fill="#8A2189"/>
    <ellipse cx="100" cy="48" rx="9" ry="12" fill="#8A2189"/>
    <ellipse cx="86" cy="70" rx="8" ry="11" fill="#5E1660" transform="rotate(-30 86 70)"/>
    <ellipse cx="114" cy="70" rx="8" ry="11" fill="#5E1660" transform="rotate(30 114 70)"/>
    <ellipse cx="88" cy="52" rx="7" ry="10" fill="#5E1660" transform="rotate(-25 88 52)"/>
    <ellipse cx="112" cy="52" rx="7" ry="10" fill="#5E1660" transform="rotate(25 112 52)"/>
  </g>
</svg>
```

`assets/planta-menta.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V64"/>
    <path d="M100 118 Q66 108 60 82 Q90 88 100 118 Z" fill="#10608E"/>
    <path d="M100 118 Q134 108 140 82 Q110 88 100 118 Z" fill="#10608E"/>
    <path d="M100 80 Q70 70 64 46 Q92 52 100 80 Z" fill="#1788C7"/>
    <path d="M100 80 Q130 70 136 46 Q108 52 100 80 Z" fill="#1788C7"/>
  </g>
</svg>
```

`assets/planta-aloe.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M64 150 L56 186 a8 8 0 0 0 8 10 h72 a8 8 0 0 0 8 -10 L140 150 Z" fill="#1788C7"/>
    <path d="M100 150 L70 60 Q100 50 100 150 Z" fill="#10608E"/>
    <path d="M100 150 L130 60 Q100 50 100 150 Z" fill="#1788C7"/>
    <path d="M100 150 L58 96 Q92 84 100 150 Z" fill="#0A4A6E" opacity=".8"/>
    <path d="M100 150 L142 96 Q108 84 100 150 Z" fill="#1D9BE0" opacity=".8"/>
  </g>
</svg>
```

`assets/planta-petunia.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V110"/>
    <path d="M100 110 C60 100 56 56 100 46 C144 56 140 100 100 110 Z" fill="#8A2189"/>
    <circle cx="100" cy="78" r="10" fill="#F8C818"/>
  </g>
</svg>
```

`assets/planta-jazmin.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V90"/>
    <g fill="#F0FCFC">
      <ellipse cx="100" cy="60" rx="9" ry="16"/>
      <ellipse cx="100" cy="60" rx="9" ry="16" transform="rotate(72 100 60)"/>
      <ellipse cx="100" cy="60" rx="9" ry="16" transform="rotate(144 100 60)"/>
      <ellipse cx="100" cy="60" rx="9" ry="16" transform="rotate(216 100 60)"/>
      <ellipse cx="100" cy="60" rx="9" ry="16" transform="rotate(288 100 60)"/>
    </g>
    <circle cx="100" cy="60" r="8" fill="#F8C818"/>
  </g>
</svg>
```

`assets/planta-perejil.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <g fill="none" stroke="#140A3C" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 150 L60 188 a8 8 0 0 0 8 10 h64 a8 8 0 0 0 8 -10 L142 150 Z" fill="#1788C7"/>
    <path d="M100 150 V96"/>
    <path d="M100 96 q-30 -6 -34 -34 q26 2 34 26 q8 -24 34 -26 q-4 28 -34 34 Z" fill="#10608E"/>
    <path d="M100 120 q-22 -4 -25 -26 q20 2 25 20 q5 -18 25 -20 q-3 22 -25 26 Z" fill="#1788C7"/>
  </g>
</svg>
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/riego/iconos.test.js`
Expected: PASS

- [ ] **Step 5: Verificación visual rápida**

Abrir cada uno de los doce ficheros directamente en el navegador (arrastrar el `.svg` a una pestaña, o `open assets/planta-albahaca.svg` etc.) y confirmar que se distinguen entre sí a simple vista y no se ven rotos (formas fuera de los 200×200, trazos que no cierran). Si alguno se ve mal, ajustar las coordenadas antes de seguir — no hace falta volver a este Task después de la Tarea 6, así que es el único momento cómodo para retocarlos.

- [ ] **Step 6: Commit**

```bash
git add assets/planta-*.svg tests/riego/iconos.test.js
git commit -m "feat(riego): doce iconos de planta, mismo lenguaje visual que el catalogo"
```

---

### Task 5: Ficha de planta al tocar, contador de consultas

**Files:**
- Modify: `plantillas/riego_plantas.js`
- Test: `tests/riego/plantilla.test.js` (extender)

**Interfaces:**
- Consume: los doce SVG de la Tarea 4, `MARGEN_MINIMO`/`MEDIDAS` no directamente (son de otras capas) — esta tarea solo toca la plantilla.
- Produce: `hooks.onSuccess({ movimientos, consultas })` — `consultas` es nuevo; `movimientos` no cambia.

- [ ] **Step 1: Escribir los tests que fallan, y adaptar cuatro tests existentes que quedan incompatibles**

Este archivo tiene HOY cuatro tests que asumen que la ventana/incompatibilidad se pintan directamente en la fila (`.riego-ventana-nota`) o en las instrucciones — dejan de ser ciertos en cuanto esa información se mueve a la ficha. Hay que adaptarlos ANTES de añadir los tests nuevos, en el mismo archivo:

1. `it('escribe la ventana de cada planta en texto junto a su nombre', ...)` (línea 40-47) — sustituir por, abriendo la ficha de cada planta antes de mirar su contenido:

```js
  it('escribe la ventana de cada planta en su ficha, no en la fila', async () => {
    const root = await montar()
    const filas = root.querySelectorAll('.riego-nombre')
    filas[0].click()
    // Albahaca: ventana [0,2,3] -> ciclos 1-indexados 1,3,4 -> "1" suelto y "3 a 4" seguidos.
    expect(root.querySelector('.riego-ficha').textContent).toContain('Disponible: ciclos 1 y 3 a 4.')
    filas[1].click()
    // Cactus: ventana [1,3,4] -> ciclos 2,4,5.
    expect(root.querySelector('.riego-ficha').textContent).toContain('Disponible: ciclos 2 y 4 a 5.')
  })
```

2. `it('sigue entendiendo el payload antiguo sin ventanas ni descanso', ...)` (línea 144-152) — la aserción `expect(root.querySelectorAll('.riego-ventana-nota')).toHaveLength(0)` deja de distinguir nada (esa clase ya no se pinta en la fila para NINGÚN payload): sustituir esa línea por una comprobación de que la ficha, para una planta sin ventana real, dice que no hay restricción:

```js
  it('sigue entendiendo el payload antiguo sin ventanas ni descanso', async () => {
    const root = await montar({
      cycles: 4,
      capacity_per_cycle: 2,
      plants: [{ id: 'A', doses: 2 }, { id: 'B', doses: 1 }]
    })
    root.querySelectorAll('.riego-nombre')[0].click()
    expect(root.querySelector('.riego-ficha').textContent).toContain('Sin restricción de ventana')
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
```

3. `it('dice "solo ciclos pares/impares"...', ...)` (línea 153-165) — mismo cambio que el (1), abrir la ficha de cada planta:

```js
  it('dice "solo ciclos pares/impares" cuando la ventana cae exacta en esa paridad', async () => {
    const root = await montar({
      cycles: 6,
      capacity: 2,
      plants: [
        { id: 'Par', doses: 2, ventana: [1, 3, 5] },    // 1-indexado: 2, 4, 6 -> pares
        { id: 'Impar', doses: 2, ventana: [0, 2, 4] }   // 1-indexado: 1, 3, 5 -> impares
      ]
    })
    const filas = root.querySelectorAll('.riego-nombre')
    filas[0].click()
    expect(root.querySelector('.riego-ficha').textContent).toContain('Disponible: solo ciclos pares.')
    filas[1].click()
    expect(root.querySelector('.riego-ficha').textContent).toContain('Disponible: solo ciclos impares.')
  })
```

4. `it('anuncia la pareja en las instrucciones', ...)` (dentro de `describe('con pareja incompatible', ...)`) — ya no es cierto (la frase se movió a la ficha, no a las instrucciones): renombrar y adaptar:

```js
    it('anuncia la pareja en la ficha de cada una, no en las instrucciones', async () => {
      const root = await montar(PAYLOAD_INCOMPATIBLE)
      expect(root.querySelector('.template-box').textContent).not.toContain('no pueden regarse en el mismo ciclo')
      root.querySelectorAll('.riego-nombre')[0].click() // Albahaca
      expect(root.querySelector('.riego-ficha').textContent).toContain('No puede regarse el mismo ciclo que Cactus.')
    })
```

Con esos cuatro adaptados, añadir los tests nuevos:

```js
// en tests/riego/plantilla.test.js, añadir:
describe('ficha de planta (icono, ventana, incompatibilidad) en vez de texto fijo', () => {
  it('la ventana ya no sale en las instrucciones fijas', async () => {
    const root = await montar()
    expect(root.textContent).not.toContain('Disponible: ciclos')
  })

  it('la pareja incompatible ya no sale en las instrucciones fijas', async () => {
    const root = await montar({
      cycles: 6, capacity: 2,
      incompatibles: ['Albahaca', 'Cactus'],
      plants: [
        { id: 'Albahaca', doses: 1, ventana: [0, 2] },
        { id: 'Cactus', doses: 1, ventana: [0, 2] }
      ]
    })
    const instrucciones = root.querySelector('.template-box').textContent
    expect(instrucciones).not.toContain('no pueden regarse en el mismo ciclo')
  })

  it('cada planta tiene un icono', async () => {
    const root = await montar()
    const iconos = root.querySelectorAll('.riego-nombre img')
    expect(iconos.length).toBe(PAYLOAD.plants.length)
  })

  it('tocar el icono abre una ficha con la ventana de esa planta', async () => {
    const root = await montar()
    root.querySelectorAll('.riego-nombre')[0].click()
    const ficha = root.querySelector('.riego-ficha')
    expect(ficha).not.toBeNull()
    expect(ficha.textContent).toContain('Disponible')
  })

  it('la ficha se autocierra a los 5 segundos', async () => {
    vi.useFakeTimers()
    const root = await montar()
    root.querySelectorAll('.riego-nombre')[0].click()
    expect(root.querySelector('.riego-ficha')).not.toBeNull()
    vi.advanceTimersByTime(5000)
    expect(root.querySelector('.riego-ficha')).toBeNull()
    vi.useRealTimers()
  })

  it('la primera consulta de cada planta es gratis', async () => {
    let marca = null
    const root = await montar(PAYLOAD, { onSuccess: (m) => { marca = m } })
    root.querySelectorAll('.riego-nombre')[0].click()
    root.querySelectorAll('.riego-nombre')[1].click()
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    expect(marca.consultas).toBe(0)
  })

  it('volver a consultar la misma planta suma al contador', async () => {
    let marca = null
    const root = await montar(PAYLOAD, { onSuccess: (m) => { marca = m } })
    root.querySelectorAll('.riego-nombre')[0].click() // Albahaca, gratis
    root.querySelectorAll('.riego-nombre')[0].click() // Albahaca otra vez, +1
    root.querySelectorAll('.riego-nombre')[0].click() // Albahaca otra vez, +1
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    expect(marca.consultas).toBe(2)
  })
})
```

`tests/riego/plantilla.test.js` hoy empieza con `import { describe, it, expect, beforeAll } from 'vitest'` (sin `vi`, que hace falta para los fake timers del test de autocierre): cambiar esa línea a `import { describe, it, expect, beforeAll, vi } from 'vitest'`.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run tests/riego/plantilla.test.js`
Expected: FAIL en los seis casos nuevos (no existe `.riego-ficha`, no hay `<img>` en `.riego-nombre`, `marca.consultas` es `undefined`) Y en los cuatro adaptados del Step 1 (siguen buscando `.riego-ficha`, que tampoco existe todavía) — diez fallos en total, ninguno en el resto del archivo.

- [ ] **Step 3: Mapa de iconos por nombre de planta**

En `plantillas/riego_plantas.js`, tras los imports (línea 13):

```js
// Mapeo independiente del banco de nombres del generador (scripts/riego-
// logic.js no se importa aquí: la plantilla no necesita saber CÓMO se
// eligen los nombres, solo pintar un icono para cada uno que pueda
// aparecer). Si algún nombre no está aquí (payload editado a mano con un
// nombre nuevo), sencillamente no se pinta icono -- pintarIcono con
// `undefined` deja el texto vacío, no revienta.
const ICONO_PLANTA = {
  Albahaca: 'assets/planta-albahaca.svg',
  Tomatera: 'assets/planta-tomatera.svg',
  Cactus: 'assets/planta-cactus.svg',
  Orquídea: 'assets/planta-orquidea.svg',
  Helecho: 'assets/planta-helecho.svg',
  Romero: 'assets/planta-romero.svg',
  Lavanda: 'assets/planta-lavanda.svg',
  Menta: 'assets/planta-menta.svg',
  Aloe: 'assets/planta-aloe.svg',
  Petunia: 'assets/planta-petunia.svg',
  Jazmín: 'assets/planta-jazmin.svg',
  Perejil: 'assets/planta-perejil.svg'
};
```

- [ ] **Step 4: Quitar la ventana y la pareja incompatible de las instrucciones fijas**

En `instructionsHTML` (línea ~54-61), quitar la línea de la pareja incompatible:

```js
    instructionsHTML: `
      <h3>Cómo se juega</h3>
      <p><strong>Objetivo:</strong> organiza el calendario para que cada planta reciba <strong>exactamente</strong> sus riegos.</p>
      <p>Toca el icono de una planta para ver su ventana de riego (y con quién no puede coincidir, si aplica) durante unos segundos. Toca una celda para regarla; tócala otra vez para marcarla con <strong>×</strong> (para recordar que esa planta no va ahí); una tercera vez la deja vacía. La × no cuenta para ganar, es solo para no dudar dos veces.</p>
      ${descanso ? '<p>Ninguna planta se puede regar <strong>dos ciclos seguidos</strong>: la tierra tiene que secarse entre riego y riego.</p>' : ''}
      <p>Y la regadera da para <strong>${capacity} riego${capacity === 1 ? '' : 's'} por ciclo</strong> como mucho.</p>
    `
```

(El segundo párrafo cambia de contenido: antes explicaba solo el ciclo de clic, ahora también dice que la ventana/incompatibilidad se consultan tocando el icono.)

- [ ] **Step 5: Icono y ficha en vez de la nota de texto fija**

Sustituir estas líneas (`plantillas/riego_plantas.js:91-101`, dentro de `plants.forEach((planta, i) => {...})`):

```js
    const nombre = createElement('td', { class: 'riego-nombre' });
    const nombreTexto = createElement('div', { class: 'riego-nombre-texto' });
    nombreTexto.textContent = planta.id;
    nombre.appendChild(nombreTexto);
    const nota = ventanaTexto(planta, cycles);
    if (nota) {
      const notaEl = createElement('div', { class: 'riego-ventana-nota' });
      notaEl.textContent = nota;
      nombre.appendChild(notaEl);
    }
    tr.appendChild(nombre);
```

por:

```js
    const nombre = createElement('td', { class: 'riego-nombre' });
    nombre.addEventListener('click', () => onNombreClick(i));
    const icono = createElement('span', { class: 'riego-icono' });
    pintarIcono(icono, ICONO_PLANTA[planta.id], planta.id);
    nombre.appendChild(icono);
    const nombreTexto = createElement('div', { class: 'riego-nombre-texto' });
    nombreTexto.textContent = planta.id;
    nombre.appendChild(nombreTexto);
    tr.appendChild(nombre);
```

(`ventanaTexto` sigue existiendo en el archivo — ya no se llama aquí, pero la usa `onNombreClick` en el Step 6.)

Añadir `pintarIcono` al import ya existente de `shell.js` (línea 13): `import { buildStandardShell, createElement, pintarIcono, setStatus } from './shell.js';`.

- [ ] **Step 6: Estado, ficha y contador — `onNombreClick`**

En `state` (donde hoy está `regados`/`won`), añadir:

```js
  const state = {
    grid: plants.map(() => Array(cycles).fill(false)),
    regados: 0,
    consultadas: new Set(),  // ids de planta ya vistas al menos una vez (gratis)
    consultas: 0,            // repeticiones sobre una planta YA vista (la marca de la ficha)
    fichaTimer: null,
    won: false
  };
```

Añadir la función `onNombreClick`, junto a `onCeldaClick`:

```js
  // Tocar el icono/nombre de una planta abre su ficha (ventana + con quién
  // no puede coincidir, si aplica) durante 5s. La primera vez que se ve CADA
  // planta es gratis; volver a abrir una ya vista suma a `consultas`, que
  // cuenta para las estrellas junto a `movimientos` (ver estrellas.js).
  function onNombreClick(i) {
    if (state.won) return;
    const planta = plants[i];
    if (state.consultadas.has(planta.id)) state.consultas += 1;
    else state.consultadas.add(planta.id);

    cerrarFicha();
    const ficha = createElement('div', { class: 'riego-ficha' });
    const ventana = ventanaTexto(planta, cycles);
    if (ventana) {
      const p = createElement('p');
      p.textContent = ventana;
      ficha.appendChild(p);
    }
    if (incompatibles && incompatibles.includes(planta.id)) {
      const otra = incompatibles.find((id) => id !== planta.id);
      const p = createElement('p');
      p.textContent = `No puede regarse el mismo ciclo que ${otra}.`;
      ficha.appendChild(p);
    }
    if (!ficha.childNodes.length) {
      const p = createElement('p');
      p.textContent = 'Sin restricción de ventana: puede regarse en cualquier ciclo.';
      ficha.appendChild(p);
    }
    celdas[i][0].closest('tr').querySelector('.riego-nombre').appendChild(ficha);
    state.fichaTimer = setTimeout(cerrarFicha, 5000);
  }

  function cerrarFicha() {
    if (state.fichaTimer) { clearTimeout(state.fichaTimer); state.fichaTimer = null; }
    const abierta = root.querySelector('.riego-ficha');
    if (abierta) abierta.remove();
  }
```

- [ ] **Step 7: `onSuccess` reporta `consultas`**

Sustituir la línea `if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.regados });` (dentro del bloque de victoria) por:

```js
      if (hooks && hooks.onSuccess) hooks.onSuccess({ movimientos: state.regados, consultas: state.consultas });
```

- [ ] **Step 8: `btnReset` limpia también consultas y ficha**

En el handler de `btnReset`, añadir junto a `state.grid = ...`:

```js
    state.consultadas = new Set();
    state.consultas = 0;
    cerrarFicha();
```

- [ ] **Step 9: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/riego/plantilla.test.js`
Expected: PASS — todos los tests, viejos y nuevos.

- [ ] **Step 10: CSS de la ficha**

En `style.css`, cerca de las reglas ya existentes de `.riego-*` (buscar `.riego-tabla` o similar para ubicarse), añadir:

```css
.riego-nombre {
  position: relative;
  cursor: pointer;
}

.riego-icono {
  display: inline-flex;
  width: 28px;
  height: 28px;
  vertical-align: middle;
  margin-right: 6px;
}

.riego-icono img {
  width: 100%;
  height: 100%;
}

.riego-ficha {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 5;
  min-width: 220px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--card-bg, #1a1a2e);
  border: 1px solid var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, .4);
  font-size: .85rem;
  text-align: left;
  white-space: normal;
}

.riego-ficha p {
  margin: 4px 0;
}
```

(Si `--card-bg` no existe como variable en `style.css`, buscar la que ya usan otros overlays del catálogo — p. ej. `.celebration-card` — y reusar esa en vez de inventar una nueva.)

- [ ] **Step 11: Verificación visual en navegador**

```bash
python3 -m http.server 8123
```

Abrir `http://localhost:8123/?tipo=riego-plantas`, tocar el icono de una planta, confirmar que la ficha se ve bien posicionada (no se corta contra el borde de la tabla, no tapa la fila de abajo de forma confusa) y que desaparece sola. Ajustar el CSS del Step 10 si hace falta. Cerrar el servidor (`pkill` o Ctrl-C) al terminar.

- [ ] **Step 12: Commit**

```bash
git add plantillas/riego_plantas.js style.css tests/riego/plantilla.test.js
git commit -m "feat(riego): ficha por planta al tocar su icono, contador de consultas"
```

---

### Task 6: Verificación final — regenerar el reto roto y correr todo

**Files:**
- No modifica código de producción — regenera artefactos derivados y corrige el reto ya publicado que quedó inválido.

- [ ] **Step 1: Regenerar el muestrario**

Run: `node scripts/generate-muestrario.js`
Expected: sale sin error. Revisar `git diff data/muestra/riego-plantas.json` — con el margen mínimo nuevo, es esperable que la semilla fija del ejemplo cambie de ventanas (o incluso de intento, si la semilla fija ya no alcanza el margen); dejar el diff, es la señal de que el cambio funciona.

- [ ] **Step 2: Regenerar la matriz de debug**

Run: `node scripts/generate-debug-matrix.js`
Expected: sale sin error. **Revisar el diff con cuidado**: este script regenera los 12 tipos, no solo riego-plantas — si aparece un diff en `data/debug/` de otro tipo (p. ej. por un commit ajeno en `main` que tampoco haya regenerado la matriz), revertirlo con `git checkout` antes de comitear; solo interesa el diff de `riego-plantas` en este cambio.

- [ ] **Step 3: Suite completa**

Run: `npx vitest run`
Expected: PASS en todo el repo.

- [ ] **Step 4: Smoke test y validación completa**

Run: `node scripts/test-generator.js && node scripts/validate-retos.js`
Expected: PASS. El smoke test escribe artefactos de prueba (`data/*.json`, `retos/*.json`, actualiza `lista_retos.json`) — limpiar con `git status --porcelain` después y descartar (`git checkout` los tracked, `rm` los untracked) todo lo que ese script haya ensuciado, igual que ya se hace en el resto del proyecto.

- [ ] **Step 5: Regenerar el reto de riego ya publicado (el que motivó este cambio)**

El reto real servido en `origin/main` (`retos/{fecha}.json` + `data/riego_{fecha}.json`, la fecha que tenga en ese momento — comprobar con `git show origin/main:reto.json` cuál es) tiene tres plantas con holgura 0: sigue siendo el mismo problema que arrancó este plan, y con el validador de la Tarea 2 ya no pasaría `validate-retos.js`.

Regenerar ESE archivo puntual con el generador ya corregido (mismo patrón que la rama `laser-vertice-alineacion` usó para su propio reto roto: el archivo histórico se edita en su sitio con el contenido nuevo, no se relanza el pipeline diario a ciegas ni se deja el reto roto en el archivo):

```bash
node -e "
import('./scripts/riego-logic.js').then(m => {
  const { buildRiegoPuzzle, buildRiegoHints } = m;
  // Buscar la PRIMERA semilla que dé variante 'vivero' (mismo tipo/tamaño
  // que el reto a sustituir) y con margen real en las cinco plantas -- el
  // generador ya corregido lo garantiza, así que cualquier vivero vale.
  for (let seed = 1; seed < 500; seed++) {
    const p = buildRiegoPuzzle(seed);
    if (p.variant !== 'vivero') continue;
    console.log(JSON.stringify({ puzzle: p, hints: buildRiegoHints(p) }, null, 2));
    break;
  }
});
" > /tmp/riego-reemplazo.json
```

Con ese resultado, escribir a mano (o con un script corto, siguiendo exactamente el mismo formato que ya usa `generateRiego` en `scripts/generate-daily-reto.js`, líneas 711-739) los tres ficheros:
- `data/riego_{fecha}.json`: `{ variant, cycles, capacity, descanso: true, plants, ...(incompatibles && { incompatibles }) }`.
- `retos/{fecha}.json`: mismo esquema que el reto viejo (`id`, `tipo`, `variant`, `dificultad`, `categorias`, `hints`, `objectives` con los campos de consultas de la Tarea 3, `data.json_url`, `titulo`, `fecha`).
- `reto.json` (raíz): copia exacta de `retos/{fecha}.json`, si esa fecha sigue siendo la más reciente (comprobar contra `origin/main` antes de sobrescribir — no tocar `reto.json` si `origin/main` ya avanzó a una fecha distinta desde que se empezó este plan).

Verificar después: `node scripts/validate-retos.js --latest` y `node scripts/audita-laser-alineacion.js`-equivalente no existe para riego, así que basta con `node scripts/validate-retos.js` completo en verde.

- [ ] **Step 6: Commit**

```bash
git add data/muestra/riego-plantas.json data/debug/ data/riego_*.json retos/*.json reto.json
git commit -m "chore(riego): regenera muestrario, matriz de debug y el reto publicado con margen real"
```
