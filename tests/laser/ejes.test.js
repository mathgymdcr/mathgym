import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { tamanoDeSeed, modoDeSeed, varianteDeSeed, MODOS, VARIANTES } from '../../scripts/laser-triangular-logic.js'

const seedsReales = () => {
  const g = new MathGymGenerator()
  const seeds = []
  const d = new Date(Date.UTC(2026, 0, 1))
  for (let i = 0; i < 1460; i++) {
    const s = g.dateToSeed(d.toISOString().slice(0, 10))
    if (g.selectTemplate(s) === 'laser-triangular') seeds.push(s)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return seeds
}

describe('ejes de laser-triangular', () => {
  // El archivo NO es reproducible (ver la nota de memoria): regenerar una
  // fecha ya publicada da otro puzzle, y de hecho tamanoDeSeed(20260822) da
  // 'grande' mientras que data/laser_2026-08-22.json quedo publicado con
  // size: 6 (medio) -- el tamano publicado de una fecha pasada no sale de
  // esta mascara ni antes ni despues de esta prueba. Lo que protege es que
  // la mascara no cambie por accidente y resiembre que tamano le toca a
  // cada fecha TODAVIA no generada. Por eso se fijan valores literales
  // sobre seeds concretos en vez de comprobar solo el tipo del resultado:
  // la version anterior aceptaba `typeof tamanoDeSeed(seed) === 'string'`,
  // que sigue en verde aunque se cambie la mascara entera.
  it('la mascara del tamano no cambia: valores fijados sobre seeds concretas', () => {
    expect(VARIANTES).toEqual(['pequeno', 'medio', 'grande'])
    expect(tamanoDeSeed(20260114)).toBe('medio')
    expect(tamanoDeSeed(20260830)).toBe('pequeno')
    expect(tamanoDeSeed(33)).toBe('grande')
    expect(tamanoDeSeed(88)).toBe('medio')
  })

  it('sobre fechas reales salen los tres tamanos y los tres modos', () => {
    const seeds = seedsReales()
    expect(seeds.length).toBeGreaterThan(20)
    expect(new Set(seeds.map(tamanoDeSeed)).size).toBe(3)
    expect(new Set(seeds.map(modoDeSeed)).size).toBe(MODOS.length)
  })

  it('los dos ejes son independientes: salen al menos 6 combinaciones', () => {
    expect(new Set(seedsReales().map(varianteDeSeed)).size).toBeGreaterThanOrEqual(6)
  })
})
