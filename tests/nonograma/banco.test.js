import { describe, it, expect } from 'vitest'
import { BANCO_FIGURAS, gridDeFigura, pistasDe, resolverNonograma } from '../../scripts/nonograma-logic.js'

// El banco es contenido escrito a mano, así que se comprueba entero: una
// figura ambigua colada en el banco haría injugable el reto de ese día,
// porque la plantilla exige la rejilla exacta para dar la victoria.
describe('BANCO_FIGURAS', () => {
  it('tiene figuras de los tres tamaños', () => {
    const tamanos = BANCO_FIGURAS.map((f) => gridDeFigura(f).length)
    expect(tamanos.filter((t) => t === 5).length).toBeGreaterThanOrEqual(3)
    expect(tamanos.filter((t) => t === 8).length).toBeGreaterThanOrEqual(3)
    expect(tamanos.filter((t) => t === 10).length).toBeGreaterThanOrEqual(2)
  })

  it('no repite nombres', () => {
    const nombres = BANCO_FIGURAS.map((f) => f.nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('define rejillas cuadradas de solo # y .', () => {
    for (const figura of BANCO_FIGURAS) {
      const alto = figura.filas.length
      for (const fila of figura.filas) {
        expect(fila.length, `${figura.nombre}: "${fila}"`).toBe(alto)
        expect(/^[#.]+$/.test(fila), `${figura.nombre}: "${fila}"`).toBe(true)
      }
      const pintadas = figura.filas.join('').split('#').length - 1
      expect(pintadas, `${figura.nombre} está casi vacía`).toBeGreaterThan(alto)
    }
  })

  it('cada figura tiene solución única, también espejada', () => {
    for (const figura of BANCO_FIGURAS) {
      const grid = gridDeFigura(figura)
      const espejo = grid.map((fila) => [...fila].reverse())
      for (const [etiqueta, g] of [['normal', grid], ['espejo', espejo]]) {
        const { filas, columnas } = pistasDe(g)
        const res = resolverNonograma(filas, columnas, { tope: 2 })
        expect(res.soluciones, `${figura.nombre} (${etiqueta})`).toBe(1)
      }
    }
  })
})
