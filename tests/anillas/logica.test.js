import { describe, it, expect } from 'vitest'
import { tocables, resolverAnillas, minimoPorFormula } from '../../scripts/anillas-logic.js'

// El estado es un array de booleanos: true = anilla enganchada en la barra.
// El índice 0 es la anilla 1 (la del extremo que siempre se puede tocar).
const est = (txt) => [...txt].map((ch) => ch === '#')
const todas = (n) => Array(n).fill(true)
const ninguna = (n) => Array(n).fill(false)

describe('tocables', () => {
  it('la anilla 1 siempre se puede tocar', () => {
    expect(tocables(est('####'))).toContain(0)
    expect(tocables(est('....'))).toContain(0)
    expect(tocables(est('.#.#'))).toContain(0)
  })

  it('con la anilla 1 enganchada, la otra tocable es la 2 y ninguna más', () => {
    expect(tocables(est('####')).sort()).toEqual([0, 1])
    expect(tocables(est('#..#')).sort()).toEqual([0, 1])
  })

  it('con la anilla 1 suelta, la tocable es la siguiente a la primera enganchada', () => {
    // Primera enganchada: la 2 (índice 1) -> tocable la 3 (índice 2)
    expect(tocables(est('.###')).sort()).toEqual([0, 2])
    // Primera enganchada: la 3 (índice 2) -> tocable la 4 (índice 3)
    expect(tocables(est('..##')).sort()).toEqual([0, 3])
  })

  it('sin ninguna enganchada solo queda la anilla 1', () => {
    expect(tocables(est('....'))).toEqual([0])
  })
})

describe('resolverAnillas (BFS sobre el grafo de estados)', () => {
  it('reproduce el mínimo clásico de todas enganchadas', () => {
    expect(resolverAnillas(todas(4), ninguna(4)).movimientos).toBe(10)
    expect(resolverAnillas(todas(5), ninguna(5)).movimientos).toBe(21)
    expect(resolverAnillas(todas(6), ninguna(6)).movimientos).toBe(42)
  })

  it('no necesita moverse si ya está en el objetivo', () => {
    expect(resolverAnillas(ninguna(5), ninguna(5)).movimientos).toBe(0)
  })

  it('devuelve pasos que llevan de verdad del inicio al objetivo', () => {
    const inicio = est('#.##')
    const objetivo = ninguna(4)
    const sol = resolverAnillas(inicio, objetivo)
    const estado = [...inicio]
    for (const paso of sol.pasos) {
      expect(tocables(estado), `paso ${JSON.stringify(paso)}`).toEqual(expect.arrayContaining([paso[0]]))
      for (const i of paso) estado[i] = !estado[i]
    }
    expect(estado).toEqual(objetivo)
    expect(sol.pasos).toHaveLength(sol.movimientos)
  })

  it('alcanza también un objetivo que no es "todas sueltas"', () => {
    // El grafo de estados es un camino, así que cualquier objetivo se puede
    // alcanzar desde cualquier inicio.
    const sol = resolverAnillas(todas(5), est('..#..'))
    expect(sol).not.toBeNull()
    expect(sol.movimientos).toBeGreaterThan(0)
  })

  it('con la regla "dos de golpe" el mínimo baja respecto al clásico', () => {
    expect(resolverAnillas(todas(4), ninguna(4), 'dos-de-golpe').movimientos).toBe(7)
    expect(resolverAnillas(todas(5), ninguna(5), 'dos-de-golpe').movimientos).toBe(16)
    expect(resolverAnillas(todas(6), ninguna(6), 'dos-de-golpe').movimientos).toBe(31)
  })
})

describe('minimoPorFormula', () => {
  it('coincide con el BFS en TODOS los estados hasta 8 anillas', () => {
    // El generador usa la fórmula (código de Gray -> binario) y el validador
    // usa el BFS: son dos implementaciones independientes, y este test es el
    // que garantiza que decir lo mismo no es casualidad.
    for (let n = 1; n <= 8; n++) {
      for (let m = 0; m < (1 << n); m++) {
        const estado = Array.from({ length: n }, (_, i) => Boolean(m & (1 << i)))
        const porBFS = resolverAnillas(estado, Array(n).fill(false)).movimientos
        expect(minimoPorFormula(estado), `n=${n}, estado ${estado.map(Number).join('')}`).toBe(porBFS)
      }
    }
  })
})
