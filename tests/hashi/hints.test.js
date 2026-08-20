import { describe, it, expect } from 'vitest'
import { buildHashiPuzzle, buildHashiHints, construirPares } from '../../scripts/hashi-logic.js'

const SEEDS = [20260821, 20260901, 20261115, 20270102, 42]

function pistasDe(seed) {
  const p = buildHashiPuzzle(seed)
  return { p, hints: buildHashiHints(p, p.solucion) }
}

describe('buildHashiHints', () => {
  it('devuelve tres pistas de texto no vacías', () => {
    for (const seed of SEEDS) {
      const { hints } = pistasDe(seed)
      expect(hints, `seed ${seed}`).toHaveLength(3)
      for (const h of hints) {
        expect(typeof h).toBe('string')
        expect(h.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('la primera pista señala una isla que existe en el tablero', () => {
    for (const seed of SEEDS) {
      const { p, hints } = pistasDe(seed)
      const m = hints[0].match(/fila (\d+), columna (\d+)/)
      expect(m, `seed ${seed}: ${hints[0]}`).not.toBeNull()
      const row = Number(m[1]) - 1
      const col = Number(m[2]) - 1
      expect(p.islands.some((i) => i.row === row && i.col === col), `seed ${seed}`).toBe(true)
    }
  })

  it('la isla de la primera pista está saturada cuando el puzzle tiene alguna', () => {
    for (const seed of SEEDS) {
      const { p, hints } = pistasDe(seed)
      const { pares } = construirPares({ rows: p.rows, cols: p.cols, islands: p.islands })
      const vecinos = p.islands.map(() => 0)
      pares.forEach((par) => { vecinos[par.a]++; vecinos[par.b]++ })
      const saturadas = p.islands
        .map((isla, idx) => ({ isla, idx }))
        .filter(({ isla, idx }) => isla.grado === 2 * vecinos[idx])
      if (!saturadas.length) continue

      const m = hints[0].match(/fila (\d+), columna (\d+)/)
      const row = Number(m[1]) - 1
      const col = Number(m[2]) - 1
      expect(
        saturadas.some(({ isla }) => isla.row === row && isla.col === col),
        `seed ${seed}: ${hints[0]}`
      ).toBe(true)
    }
  })

  it('alguna pista dice cuántos puentes tiene la solución', () => {
    for (const seed of SEEDS) {
      const { p, hints } = pistasDe(seed)
      expect(hints.join(' '), `seed ${seed}`).toContain(String(p.solucion.total))
    }
  })

  it('es determinista para el mismo puzzle', () => {
    const { p } = pistasDe(20260821)
    expect(buildHashiHints(p, p.solucion)).toEqual(buildHashiHints(p, p.solucion))
  })
})
