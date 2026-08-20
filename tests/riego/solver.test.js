import { describe, it, expect } from 'vitest'
import { combinacionesPlanta, contarSoluciones } from '../../scripts/riego-logic.js'

// Reglas: cada planta necesita EXACTAMENTE sus dosis, solo puede regarse en
// los ciclos de su ventana, nunca dos ciclos seguidos (tiene que secarse), y
// cada ciclo admite como mucho `capacity` riegos en total.

describe('combinacionesPlanta', () => {
  it('enumera los repartos válidos dentro de la ventana', () => {
    const combos = combinacionesPlanta({ doses: 2, ventana: [0, 2, 4] })
    expect(combos).toEqual([[0, 2], [0, 4], [2, 4]])
  })

  it('descarta los repartos con dos riegos seguidos', () => {
    const combos = combinacionesPlanta({ doses: 2, ventana: [0, 1, 3] })
    expect(combos).toEqual([[0, 3], [1, 3]])   // [0,1] queda fuera
  })

  it('no encuentra nada si la ventana no da para las dosis', () => {
    expect(combinacionesPlanta({ doses: 3, ventana: [0, 1] })).toEqual([])
    expect(combinacionesPlanta({ doses: 2, ventana: [2, 3] })).toEqual([])
  })

  it('una ventana justa deja una sola posibilidad', () => {
    expect(combinacionesPlanta({ doses: 2, ventana: [1, 4] })).toEqual([[1, 4]])
  })
})

describe('contarSoluciones', () => {
  const config = (plants, cycles = 5, capacity = 1) => ({ cycles, capacity, plants })

  it('cuenta la única forma de encajar dos plantas apretadas', () => {
    const res = contarSoluciones(config([
      { id: 'A', doses: 2, ventana: [0, 2] },
      { id: 'B', doses: 2, ventana: [1, 3] }
    ]))
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual([[0, 2], [1, 3]])
  })

  it('respeta la capacidad por ciclo', () => {
    // Las dos plantas solo pueden regarse en los ciclos 0 y 2, pero cabe una
    // sola por ciclo: no hay forma.
    const res = contarSoluciones(config([
      { id: 'A', doses: 2, ventana: [0, 2] },
      { id: 'B', doses: 2, ventana: [0, 2] }
    ], 5, 1))
    expect(res.soluciones).toBe(0)
    expect(res.primera).toBeNull()
  })

  it('con más capacidad, ese mismo reparto sí cabe', () => {
    const res = contarSoluciones(config([
      { id: 'A', doses: 2, ventana: [0, 2] },
      { id: 'B', doses: 2, ventana: [0, 2] }
    ], 5, 2))
    expect(res.soluciones).toBe(1)
  })

  it('detecta cuando hay más de una solución', () => {
    const res = contarSoluciones(config([
      { id: 'A', doses: 1, ventana: [0, 2, 4] }
    ], 5, 1))
    expect(res.soluciones).toBe(3)
  })

  it('para de contar al llegar al tope', () => {
    const res = contarSoluciones(config([
      { id: 'A', doses: 1, ventana: [0, 2, 4] }
    ], 5, 1), { tope: 2 })
    expect(res.soluciones).toBe(2)
  })
})
