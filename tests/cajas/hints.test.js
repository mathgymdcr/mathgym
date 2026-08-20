import { describe, it, expect } from 'vitest'
import { buildCajasPuzzle, buildCajasHints } from '../../scripts/cajas-logic.js'

const SEEDS = [20260824, 20260907, 20261120, 20270305, 91]
const conPistas = (seed) => {
  const p = buildCajasPuzzle(seed)
  return { p, hints: buildCajasHints(p) }
}

describe('buildCajasHints', () => {
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

  it('la primera pista dice cuánto se puede cargar de una vez', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      expect(hints[0], `seed ${seed}`).toContain(String(p.capacidad))
    }
  })

  it('alguna pista habla de la caja más pesada, que manda en el orden', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      const masPesada = Math.max(...p.zonas.flat())
      expect(hints.join(' '), `seed ${seed}`).toContain(String(masPesada))
    }
  })

  it('alguna pista da el mínimo real de movimientos', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      expect(hints.join(' '), `seed ${seed}`).toContain(String(p.solucion.movimientos))
    }
  })

  it('es determinista para el mismo puzzle', () => {
    const p = buildCajasPuzzle(20260824)
    expect(buildCajasHints(p)).toEqual(buildCajasHints(p))
  })
})
