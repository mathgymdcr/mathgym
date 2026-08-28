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
  it('el tamano no cambia respecto a lo publicado: misma mascara', () => {
    // Si esta mascara cambia, las fechas ya publicadas cambian de tamano.
    expect(VARIANTES).toEqual(['pequeno', 'medio', 'grande'])
    expect(typeof tamanoDeSeed(20260114)).toBe('string')
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
