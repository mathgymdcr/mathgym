import { describe, it, expect } from 'vitest'
import {
  AREA_MAX,
  alcanzable,
  perimetrosDe,
  clasifica,
  enumeraPoliominos
} from '../../scripts/poligono-logic.js'

describe('alcanzable', () => {
  it('coincide con la enumeracion exhaustiva en todo el rango', () => {
    const real = enumeraPoliominos()
    for (let a = 1; a <= AREA_MAX; a++) {
      for (let p = 2; p <= 2 * a + 4; p += 2) {
        expect(alcanzable(a, p), `A=${a} P=${p}`).toBe(real.has(`${a},${p}`))
      }
    }
  })

  it('rechaza el perimetro impar: en una reticula siempre es par', () => {
    expect(alcanzable(12, 15)).toBe(false)
  })
})

describe('clasifica', () => {
  // Estos tres pares tumbaron la regla aritmetica "si el perimetro es el
  // minimo para esa area y hay rectangulo, solo cabe el rectangulo". En los
  // tres hay TAMBIEN una figura no rectangular -- con 3 celdas y perimetro 8
  // valen el 1x3 y el tromino en L. Por eso clasifica() enumera.
  it('reconoce concava en los tres pares que rompen la regla aritmetica', () => {
    for (const [a, p] of [[3, 8], [8, 12], [10, 14]]) {
      expect(clasifica(a, p), `A=${a} P=${p}`).toEqual({ convexa: true, concava: true })
    }
  })

  it('coincide con la enumeracion exhaustiva en todo el rango', () => {
    const real = enumeraPoliominos()
    for (let a = 1; a <= AREA_MAX; a++) {
      for (const p of perimetrosDe(a)) {
        expect(clasifica(a, p), `A=${a} P=${p}`).toEqual(real.get(`${a},${p}`))
      }
    }
  })

  it('marca solo convexa el 3x4, que ninguna otra figura de area 12 alcanza', () => {
    expect(clasifica(12, 14)).toEqual({ convexa: true, concava: false })
  })

  it('marca solo concava el area 11 mas compacta: ningun rectangulo la da', () => {
    expect(clasifica(11, 14)).toEqual({ convexa: false, concava: true })
  })
})
