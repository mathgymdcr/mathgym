import { describe, it, expect } from 'vitest'
import { solveCajas } from '../../scripts/cajas-logic.js'

// Las zonas se escriben de abajo arriba: [9, 5, 3] es la de 9 kg en el suelo
// y la de 3 kg encima del todo.
const puzzle = (zonas, capacidad, destino = 2) => ({ zonas, capacidad, destino })

describe('solveCajas', () => {
  it('lleva dos cajas de una vez si su peso junto cabe en la carga', () => {
    const res = solveCajas(puzzle([[5, 3], [], []], 8))
    expect(res.movimientos).toBe(1)
    expect(res.pasos).toEqual([{ desde: 0, hacia: 2, cajas: [5, 3] }])
  })

  it('se convierte en Hanói cuando solo cabe una caja por viaje', () => {
    // 5 + 3 = 8 no cabe en 5 kg, así que hay que moverlas de una en una.
    expect(solveCajas(puzzle([[5, 3], [], []], 5)).movimientos).toBe(3)
  })

  it('da el 2^n - 1 de Hanói con tres cajas que nunca se agrupan', () => {
    // Cualquier par del montón pasa de 9 kg, así que siempre se viaja solo.
    expect(solveCajas(puzzle([[9, 8, 7], [], []], 9)).movimientos).toBe(7)
  })

  it('no necesita ningún movimiento si ya está resuelto', () => {
    expect(solveCajas(puzzle([[], [], [9, 5, 3]], 9)).movimientos).toBe(0)
  })

  it('no encuentra solución si la caja más pesada no se puede levantar', () => {
    expect(solveCajas(puzzle([[9, 5, 3], [], []], 4))).toBeNull()
  })

  it('devuelve pasos que, aplicados, dejan todas las cajas en el destino', () => {
    const inicio = [[20, 9, 5, 2], [], []]
    // 22 kg de carga: caben 9+5+2 juntas, pero la de 20 viaja sola.
    const res = solveCajas(puzzle(inicio.map((z) => [...z]), 22))
    const zonas = inicio.map((z) => [...z])
    for (const paso of res.pasos) {
      const bloque = zonas[paso.desde].splice(zonas[paso.desde].length - paso.cajas.length)
      expect(bloque).toEqual(paso.cajas)
      expect(bloque.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(22)
      const tope = zonas[paso.hacia][zonas[paso.hacia].length - 1]
      if (tope !== undefined) expect(tope).toBeGreaterThan(bloque[0])
      zonas[paso.hacia].push(...bloque)
    }
    expect(zonas[2]).toEqual([20, 9, 5, 2])
    expect(res.pasos).toHaveLength(res.movimientos)
  })

  it('aprovecha la carga para bajar del mínimo de Hanói', () => {
    // Con 4 cajas, Hanói exigiría 15 movimientos; agrupando salen menos.
    const res = solveCajas(puzzle([[20, 9, 5, 2], [], []], 22))
    expect(res.movimientos).toBeLessThan(15)
    expect(res.movimientos).toBeGreaterThan(0)
  })
})
