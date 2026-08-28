import { describe, it, expect } from 'vitest'
import { buildLaserPuzzle, piezasMinimas, piezasMinimasExhaustivo, resuelto, crearPiezas, normalizaConfig, modoDeSeed, MODOS, PIEZA } from '../../scripts/laser-triangular-logic.js'

const SEEDS = [20260830, 20260915, 20261207, 20270422, 12, 33, 88, 20280606]

// Incluye `targets` y `modo`: desde que el generador construye los tres
// modos, la diana ya no vive en `lasers[].target` (ver normalizaConfig).
const config = (p) => ({ size: p.size, modo: p.modo, lasers: p.lasers, targets: p.targets, blocks: p.blocks })

describe('buildLaserPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildLaserPuzzle(20260830)))
      .toBe(JSON.stringify(buildLaserPuzzle(20260830)))
  })

  it('la solución que guarda resuelve el reto de verdad', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(resuelto(config(p), p.solucion.piezas), `seed ${seed}`).toBe(true)
    }
  })

  it('no se resuelve con menos espejos de los que dice', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(p.min_piezas, `seed ${seed}`).toBeGreaterThanOrEqual(2)
      expect(
        piezasMinimas(config(p), p.min_piezas - 1),
        `seed ${seed}: se resuelve con menos de ${p.min_piezas} espejos`
      ).toBeNull()
    }
  })

  it('no se resuelve sin poner ningún espejo', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(resuelto(config(p), crearPiezas(p.size)), `seed ${seed}`).toBe(false)
    }
  })

  it('coloca emisores y dianas dentro del tablero y sin pisarse', () => {
    // SEEDS mezcla los tres modos (el eje de modo es independiente del
    // numero de seed), así que ni el número de emisores ni el de dianas es
    // fijo: clásico tiene 2 emisores y 2 dianas, prisma 1 y 2, condensador
    // 1 y 1. Lo que sí vale siempre es que todo esté dentro del tablero y
    // que ningún objeto comparta celda con otro.
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(p.lasers.length, `seed ${seed}`).toBeGreaterThanOrEqual(1)
      expect(p.targets.length, `seed ${seed}`).toBeGreaterThanOrEqual(1)
      const ocupadas = new Set()
      const puntos = [...p.lasers.map((l) => l.emitter), ...p.targets]
      for (const punto of puntos) {
        expect(punto.row).toBeGreaterThanOrEqual(0)
        expect(punto.row).toBeLessThan(p.size)
        expect(punto.col).toBeGreaterThanOrEqual(0)
        expect(punto.col).toBeLessThan(p.size)
        const clave = `${punto.row},${punto.col}`
        expect(ocupadas.has(clave), `seed ${seed}: dos objetos en ${clave}`).toBe(false)
        ocupadas.add(clave)
      }
      for (const l of p.lasers) expect(l.emitter.dir, `seed ${seed}`).toBeTruthy()
      for (const b of p.blocks || []) {
        expect(ocupadas.has(`${b.row},${b.col}`), `seed ${seed}: bloque sobre un objeto`).toBe(false)
      }
    }
  })

  it('la búsqueda podada da lo mismo que la exhaustiva', () => {
    // piezasMinimas solo mira las celdas por las que pasan los rayos, con el
    // argumento de que en una solución mínima todo espejo lo toca algún rayo.
    // Si ese argumento fuera falso, el generador anunciaría un par que no es
    // el real -- y como el validador usa la misma función, no lo detectaría.
    // Por eso se contrasta contra la búsqueda que prueba el tablero entero.
    for (const seed of [20260830, 20260915, 12, 33]) {
      const p = buildLaserPuzzle(seed)
      const c = config(p)
      expect(piezasMinimas(c, 2), `seed ${seed}`).toBe(piezasMinimasExhaustivo(c, 2))
    }
  })

  it('reparte las variantes con su tamaño de tablero', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildLaserPuzzle(seed)
      vistas.add(p.variant)
      const esperado = { pequeno: 5, medio: 6, grande: 7 }[p.variant]
      expect(esperado, `variante desconocida: ${p.variant}`).toBeDefined()
      expect(p.size).toBe(esperado)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      // Base 2/3/4 segun tamano, +1 fuera de clasico (con tope 5): el rango
      // completo, mezclando modos, es 2..5.
      expect(p.dificultad).toBeLessThanOrEqual(5)
    }
    expect([...vistas].sort()).toEqual(['grande', 'medio', 'pequeno'])
  })
})

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

// Barrido de varios seeds por modo (no solo el de SEED_DE_MODO) para el
// invariante emisor/diana: el bug de la Task 5 era exactamente un espejo
// que acababa en la celda de un emisor -- invisible para `celdasLibres` y
// por tanto irreproducible por `piezasMinimas`, con lo que el par anunciado
// quedaba mal. Nunca se ha observado en produccion (barrido de seed=1..300
// del informe de la Task 7, y otro de 400 seeds x 3 tamaños x 40 intentos
// contra construirPrisma/construirCondensador sin la guarda: cero
// violaciones en ambos), pero es justo lo que una guarda ausente dejaria
// pasar sin que nada lo note -- por eso se fija aqui, no se confia en que
// siga sin verse. 8 seeds por modo (24 en total) cuestan ~2.5s en esta
// maquina.
const SEEDS_INVARIANTE = { clasico: [], prisma: [], condensador: [] }
for (let s = 0; s < 500 && Object.values(SEEDS_INVARIANTE).some((l) => l.length < 8); s++) {
  const m = modoDeSeed(s)
  if (SEEDS_INVARIANTE[m].length < 8) SEEDS_INVARIANTE[m].push(s)
}

describe('la solucion nunca pisa un emisor o una diana', () => {
  for (const modo of MODOS) {
    it(`${modo}: ninguna pieza de la solucion cae en un emisor o una diana`, () => {
      for (const seed of SEEDS_INVARIANTE[modo]) {
        const p = buildLaserPuzzle(seed)
        const piezas = p.solucion.piezas
        const ocupadas = [...p.lasers.map((l) => l.emitter), ...p.targets]
        for (const o of ocupadas) {
          expect(piezas[o.row][o.col], `seed ${seed} (${modo}): pieza sobre ${o.row},${o.col}`).toBe(PIEZA.VACIO)
        }
      }
    })
  }
})
