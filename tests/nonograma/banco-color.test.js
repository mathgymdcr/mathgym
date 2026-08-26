import { describe, it, expect } from 'vitest'
import {
  BANCO_COLOR,
  COLORES_MARCA,
  figuraColorAGrid,
  pistasColorDe,
  resolverNonograma
} from '../../scripts/nonograma-logic.js'

// Igual que el banco monocromo: es contenido escrito a mano, así que se
// comprueba entero. Una figura ambigua haría injugable el reto de ese día,
// porque la plantilla exige la rejilla exacta para dar la victoria.
describe('BANCO_COLOR', () => {
  it('tiene figuras de los dos tamaños que admiten color', () => {
    const lados = BANCO_COLOR.map((f) => f.filas.length)
    expect(lados.filter((l) => l === 5).length).toBeGreaterThanOrEqual(4)
    expect(lados.filter((l) => l === 8).length).toBeGreaterThanOrEqual(4)
    expect(lados.filter((l) => l !== 5 && l !== 8).length).toBe(0)
  })

  it('no repite nombres, ni con el banco monocromo', async () => {
    const { BANCO_FIGURAS } = await import('../../scripts/nonograma-logic.js')
    const nombres = [...BANCO_COLOR.map((f) => f.nombre), ...BANCO_FIGURAS.map((f) => f.nombre)]
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('dibuja rejillas cuadradas con letras de la paleta de marca', () => {
    const letras = Object.keys(COLORES_MARCA).join('')
    for (const figura of BANCO_COLOR) {
      const lado = figura.filas.length
      for (const fila of figura.filas) {
        expect(fila.length, `${figura.nombre}: "${fila}"`).toBe(lado)
        expect(new RegExp(`^[.${letras}]+$`).test(fila), `${figura.nombre}: "${fila}"`).toBe(true)
      }
    }
  })

  it('usa dos o tres colores en cada figura, que si no es un monocromo teñido', () => {
    for (const figura of BANCO_COLOR) {
      const { paleta } = figuraColorAGrid(figura)
      expect(paleta.length, figura.nombre).toBeGreaterThanOrEqual(2)
      expect(paleta.length, figura.nombre).toBeLessThanOrEqual(3)
    }
  })

  it('cada figura tiene solución única, también espejada', () => {
    for (const figura of BANCO_COLOR) {
      const { grid } = figuraColorAGrid(figura)
      const espejo = grid.map((fila) => [...fila].reverse())
      for (const [etiqueta, g] of [['normal', grid], ['espejo', espejo]]) {
        const { filas, columnas } = pistasColorDe(g)
        const res = resolverNonograma(filas, columnas, { tope: 2 })
        expect(res.soluciones, `${figura.nombre} (${etiqueta})`).toBe(1)
      }
    }
  })
})
