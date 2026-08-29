import { describe, it, expect } from 'vitest'
import { buildRelojesPuzzle, solveRelojes } from '../../scripts/relojes-logic.js'

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13)

describe('buildRelojesPuzzle', () => {
  it('es determinista: el mismo seed da el mismo puzzle', () => {
    const a = buildRelojesPuzzle(12345)
    const b = buildRelojesPuzzle(12345)
    expect(a).toEqual(b)
  })

  it('siempre produce un puzzle resoluble en su propia variante', () => {
    for (const seed of SEEDS) {
      const p = buildRelojesPuzzle(seed)
      const sol = solveRelojes(p.glasses, p.target, p.variant)
      expect(sol, `seed=${seed} variant=${p.variant} glasses=${p.glasses} target=${p.target}`).not.toBeNull()
    }
  })

  it('en la variante diferido el objetivo NO se puede medir desde t=0', () => {
    const diferidos = SEEDS.map(buildRelojesPuzzle).filter(p => p.variant === 'diferido')
    expect(diferidos.length).toBeGreaterThan(0)
    for (const p of diferidos) {
      expect(solveRelojes(p.glasses, p.target, 'clasico'), `glasses=${p.glasses} target=${p.target}`).toBeNull()
    }
  })

  it('nunca propone un objetivo trivial de una o dos rondas', () => {
    // Con MIN_RONDAS=2 el reto se resolvia a veces en dos rondas -- "voltea
    // uno y espera" en la practica, pese a la intencion original del
    // umbral. Subido a 3.
    for (const seed of SEEDS) {
      const p = buildRelojesPuzzle(seed)
      expect(p.glasses, `seed=${seed}`).not.toContain(p.target)
      expect(p.solucion.rondasTotales, `seed=${seed}`).toBeGreaterThan(2)
    }
  })

  it('genera ambas variantes a lo largo del espacio de seeds', () => {
    const variantes = new Set(SEEDS.map(s => buildRelojesPuzzle(s).variant))
    expect(variantes).toEqual(new Set(['clasico', 'diferido']))
  })

  it('respeta los limites de duracion y de tiempo total de partida', () => {
    for (const seed of SEEDS) {
      const p = buildRelojesPuzzle(seed)
      expect(p.glasses.length).toBeGreaterThanOrEqual(2)
      expect(p.glasses.length).toBeLessThanOrEqual(3)
      expect(Math.max(...p.glasses)).toBeLessThanOrEqual(15)
      expect(p.target).toBeLessThanOrEqual(20)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)
    }
  })
})
