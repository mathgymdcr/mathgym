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
