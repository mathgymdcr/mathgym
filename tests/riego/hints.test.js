import { describe, it, expect } from 'vitest'
import { buildRiegoPuzzle, buildRiegoHints, combinacionesPlanta } from '../../scripts/riego-logic.js'

const SEEDS = [20260831, 20260918, 20261210, 21, 44]
const conPistas = (seed) => {
  const p = buildRiegoPuzzle(seed)
  return { p, hints: buildRiegoHints(p) }
}

describe('buildRiegoHints', () => {
  it('devuelve tres pistas de texto no vacías', () => {
    for (const seed of SEEDS) {
      const { hints } = conPistas(seed)
      expect(hints, `seed ${seed}`).toHaveLength(3)
      for (const h of hints) {
        expect(typeof h).toBe('string')
        expect(h.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('la primera pista señala la planta con menos margen', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      const opciones = p.plants.map((pl) => combinacionesPlanta(pl).length)
      const minimo = Math.min(...opciones)
      const conMenosMargen = p.plants.filter((_, i) => opciones[i] === minimo).map((pl) => pl.id)
      expect(conMenosMargen.some((id) => hints[0].includes(id)), `seed ${seed}: ${hints[0]}`).toBe(true)
    }
  })

  it('alguna pista recuerda la capacidad por ciclo', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      expect(hints.join(' '), `seed ${seed}`).toContain(String(p.capacity))
    }
  })

  it('alguna pista recuerda que no se riega dos ciclos seguidos', () => {
    for (const seed of SEEDS) {
      const { hints } = conPistas(seed)
      expect(hints.join(' ').toLowerCase(), `seed ${seed}`).toContain('seguidos')
    }
  })

  it('es determinista para el mismo puzzle', () => {
    const p = buildRiegoPuzzle(20260831)
    expect(buildRiegoHints(p)).toEqual(buildRiegoHints(p))
  })
})
