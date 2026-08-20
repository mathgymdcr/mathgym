import { describe, it, expect } from 'vitest'
import { rachas, pistasDe, resolverNonograma } from '../../scripts/nonograma-logic.js'

// Rejillas escritas como strings para que se vea el dibujo en el propio test.
const parse = (filas) => filas.map((f) => [...f].map((ch) => (ch === '#' ? 1 : 0)))

describe('rachas', () => {
  it('cuenta las tiras seguidas de celdas pintadas', () => {
    expect(rachas([1, 1, 0, 1])).toEqual([2, 1])
    expect(rachas([1, 1, 1])).toEqual([3])
    expect(rachas([0, 1, 0, 1, 1, 0])).toEqual([1, 2])
  })

  it('devuelve [0] para una línea vacía, como hace la plantilla', () => {
    expect(rachas([0, 0, 0])).toEqual([0])
  })
})

describe('pistasDe', () => {
  it('saca las pistas de filas y columnas de una rejilla', () => {
    const grid = parse([
      '.#.',
      '###',
      '.#.'
    ])
    expect(pistasDe(grid)).toEqual({
      filas: [[1], [3], [1]],
      columnas: [[1], [3], [1]]
    })
  })
})

describe('resolverNonograma', () => {
  it('resuelve una cruz de 3x3 y devuelve la rejilla original', () => {
    const grid = parse([
      '.#.',
      '###',
      '.#.'
    ])
    const { filas, columnas } = pistasDe(grid)
    const res = resolverNonograma(filas, columnas)
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual(grid)
  })

  it('marca como resoluble solo con lógica de líneas la cruz de 3x3', () => {
    const grid = parse([
      '.#.',
      '###',
      '.#.'
    ])
    const { filas, columnas } = pistasDe(grid)
    expect(resolverNonograma(filas, columnas).soloLogica).toBe(true)
  })

  it('detecta la ambigüedad del damero de 2x2', () => {
    // Con una celda pintada por fila y por columna, la diagonal y la
    // antidiagonal encajan igual de bien: dos dibujos distintos.
    const res = resolverNonograma([[1], [1]], [[1], [1]])
    expect(res.soluciones).toBe(2)
  })

  it('no encuentra solución si las pistas se contradicen', () => {
    // Una fila de dos celdas pintadas contra una columna que exige estar vacía.
    const res = resolverNonograma([[2]], [[1], [0]])
    expect(res.soluciones).toBe(0)
    expect(res.primera).toBeNull()
  })

  it('resuelve una rejilla llena y otra vacía', () => {
    expect(resolverNonograma([[3], [3]], [[2], [2], [2]]).soluciones).toBe(1)
    expect(resolverNonograma([[0], [0]], [[0], [0]]).soluciones).toBe(1)
  })

  it('para de contar al llegar al tope indicado', () => {
    expect(resolverNonograma([[1], [1]], [[1], [1]], { tope: 1 }).soluciones).toBe(1)
  })
})
