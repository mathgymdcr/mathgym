import { describe, it, expect } from 'vitest'
import { buildNonogramaPuzzle, pistasDe, resolverNonograma } from '../../scripts/nonograma-logic.js'

const SEEDS = [20260822, 20260903, 20261212, 20270214, 3, 11, 77, 20280101]

describe('buildNonogramaPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildNonogramaPuzzle(20260822)))
      .toBe(JSON.stringify(buildNonogramaPuzzle(20260822)))
  })

  it('produce siempre un puzzle con solución única', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      const { filas, columnas } = pistasDe(p.grid)
      const res = resolverNonograma(filas, columnas, { tope: 2 })
      expect(res.soluciones, `seed ${seed} (${p.figura})`).toBe(1)
      expect(res.primera).toEqual(p.grid)
    }
  })

  it('devuelve una rejilla cuadrada de 0 y 1 coherente con rows/cols', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      expect(p.grid).toHaveLength(p.rows)
      for (const fila of p.grid) {
        expect(fila).toHaveLength(p.cols)
        expect(fila.every((v) => v === 0 || v === 1), `seed ${seed}`).toBe(true)
      }
    }
  })

  it('reparte las tres variantes con su tamaño', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildNonogramaPuzzle(seed)
      vistas.add(p.variant)
      const esperado = { pequeno: 5, medio: 8, grande: 10 }[p.variant]
      expect(esperado, `variante desconocida: ${p.variant}`).toBeDefined()
      expect(p.rows).toBe(esperado)
      expect(p.cols).toBe(esperado)
    }
    expect([...vistas].sort()).toEqual(['grande', 'medio', 'pequeno'])
  })

  it('da una dificultad entre 2 y 5 y dice si hace falta suponer', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(5)
      expect(typeof p.soloLogica).toBe('boolean')
    }
  })

  it('usa figuras distintas para fechas consecutivas del mismo tamaño', () => {
    // Dos retos seguidos con el mismo dibujo se notarían enseguida.
    const figuras = []
    for (let d = 1; d <= 12; d++) figuras.push(buildNonogramaPuzzle(20260800 + d).figura)
    for (let i = 1; i < figuras.length; i++) {
      expect(figuras[i], `posición ${i}`).not.toBe(figuras[i - 1])
    }
  })
})
