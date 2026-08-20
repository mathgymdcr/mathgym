import { describe, it, expect } from 'vitest'
import { solveHashi, construirPares } from '../../scripts/hashi-logic.js'

// Puzzles montados a mano, con la solución razonada en el comentario.
// `grado` es el número que se pinta dentro de la isla: cuántos puentes
// deben llegarle en total (un puente doble cuenta como 2).

describe('construirPares', () => {
  it('no empareja dos islas si hay una tercera en medio', () => {
    const { pares } = construirPares({
      rows: 1,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 1 },
        { row: 0, col: 1, grado: 2 },
        { row: 0, col: 2, grado: 1 }
      ]
    })
    const conectados = pares.map((p) => [p.a, p.b])
    expect(conectados).toEqual([[0, 1], [1, 2]])
  })

  it('marca como cruce dos pares perpendiculares que comparten una celda', () => {
    // Islas en cruz: el puente vertical 0-1 y el horizontal 2-3 se
    // cortarían en la celda central (1,1).
    const { pares, cruces } = construirPares({
      rows: 3,
      cols: 3,
      islands: [
        { row: 0, col: 1, grado: 1 },
        { row: 2, col: 1, grado: 1 },
        { row: 1, col: 0, grado: 1 },
        { row: 1, col: 2, grado: 1 }
      ]
    })
    expect(pares).toHaveLength(2)
    expect(cruces).toHaveLength(1)
    const [i, j] = cruces[0]
    const cruzados = [[pares[i].a, pares[i].b], [pares[j].a, pares[j].b]].sort()
    expect(cruzados).toEqual([[0, 1], [2, 3]])
  })
})

describe('solveHashi', () => {
  it('une dos islas de grado 1 con un puente simple', () => {
    const res = solveHashi({
      rows: 1,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 1 },
        { row: 0, col: 2, grado: 1 }
      ]
    })
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual([{ a: 0, b: 1, count: 1 }])
  })

  it('une dos islas de grado 2 con un puente doble', () => {
    const res = solveHashi({
      rows: 1,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 2 },
        { row: 0, col: 2, grado: 2 }
      ]
    })
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual([{ a: 0, b: 1, count: 2 }])
  })

  it('descarta por conectividad los dobles del ciclo de grado 2', () => {
    // Cuatro islas en cuadrado, todas de grado 2. Tres asignaciones cumplen
    // los grados: puentes simples por los cuatro lados, o dobles en las dos
    // filas, o dobles en las dos columnas. Las dos últimas parten el
    // archipiélago en dos, así que la única solución válida es la primera.
    const res = solveHashi({
      rows: 3,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 2 },
        { row: 0, col: 2, grado: 2 },
        { row: 2, col: 0, grado: 2 },
        { row: 2, col: 2, grado: 2 }
      ]
    })
    expect(res.soluciones).toBe(1)
    expect(res.primera.every((p) => p.count === 1)).toBe(true)
    expect(res.primera).toHaveLength(4)
  })

  it('detecta la ambigüedad del ciclo de grado 3', () => {
    // Mismo cuadrado con grado 3: cada isla reparte 3 entre sus dos vecinos
    // como 2+1, y hay dos repartos coherentes que dan la vuelta al ciclo.
    const res = solveHashi({
      rows: 3,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 3 },
        { row: 0, col: 2, grado: 3 },
        { row: 2, col: 0, grado: 3 },
        { row: 2, col: 2, grado: 3 }
      ]
    })
    expect(res.soluciones).toBe(2)
  })

  it('no encuentra solución si el grado supera la capacidad de sus vecinos', () => {
    const res = solveHashi({
      rows: 1,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 3 },
        { row: 0, col: 2, grado: 3 }
      ]
    })
    expect(res.soluciones).toBe(0)
    expect(res.primera).toBeNull()
  })

  it('rechaza el reparto que cumple los grados pero deja dos archipiélagos', () => {
    // Cuadrado de grado 1: o se unen por filas o por columnas, y en ambos
    // casos quedan dos parejas sueltas.
    const res = solveHashi({
      rows: 3,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 1 },
        { row: 0, col: 2, grado: 1 },
        { row: 2, col: 0, grado: 1 },
        { row: 2, col: 2, grado: 1 }
      ]
    })
    expect(res.soluciones).toBe(0)
  })

  it('para de contar al llegar al tope indicado', () => {
    const res = solveHashi({
      rows: 3,
      cols: 3,
      islands: [
        { row: 0, col: 0, grado: 3 },
        { row: 0, col: 2, grado: 3 },
        { row: 2, col: 0, grado: 3 },
        { row: 2, col: 2, grado: 3 }
      ]
    }, { tope: 1 })
    expect(res.soluciones).toBe(1)
  })
})
