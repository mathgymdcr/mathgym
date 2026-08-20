import { describe, it, expect } from 'vitest'
import { buildLaserPuzzle, buildLaserHints } from '../../scripts/laser-triangular-logic.js'

const SEEDS = [20260830, 20260915, 12, 33]
const conPistas = (seed) => {
  const p = buildLaserPuzzle(seed)
  return { p, hints: buildLaserHints(p) }
}

describe('buildLaserHints', () => {
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

  it('la primera pista sitúa un emisor real del tablero', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      const m = hints[0].match(/fila (\d+), columna (\d+)/)
      expect(m, `seed ${seed}: ${hints[0]}`).not.toBeNull()
      const row = Number(m[1]) - 1
      const col = Number(m[2]) - 1
      expect(p.lasers.some((l) => l.emitter.row === row && l.emitter.col === col), `seed ${seed}`).toBe(true)
    }
  })

  it('alguna pista dice cuántos espejos hacen falta', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      expect(hints.join(' '), `seed ${seed}`).toContain(String(p.min_espejos))
    }
  })

  it('alguna pista recuerda que los rayos no pueden cruzarse', () => {
    for (const seed of SEEDS) {
      const { hints } = conPistas(seed)
      expect(hints.join(' ').toLowerCase(), `seed ${seed}`).toContain('cruz')
    }
  })

  it('no desvela dónde van los espejos', () => {
    for (const seed of SEEDS) {
      const { p, hints } = conPistas(seed)
      const texto = hints.join(' ')
      p.solucion.espejos.forEach((fila, r) => fila.forEach((v, c) => {
        if (!v) return
        expect(texto, `seed ${seed}: desvela la celda ${r + 1},${c + 1}`)
          .not.toContain(`fila ${r + 1}, columna ${c + 1}`)
      }))
    }
  })

  it('es determinista para el mismo puzzle', () => {
    const p = buildLaserPuzzle(20260830)
    expect(buildLaserHints(p)).toEqual(buildLaserHints(p))
  })
})
