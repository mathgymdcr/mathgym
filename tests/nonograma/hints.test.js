import { describe, it, expect } from 'vitest'
import { buildNonogramaPuzzle, buildNonogramaHints, pistasDe } from '../../scripts/nonograma-logic.js'

const SEEDS = [20260822, 20260903, 20261212, 20270214, 77]

const pistasDe_ = (seed) => {
  const p = buildNonogramaPuzzle(seed)
  return { p, hints: buildNonogramaHints(p) }
}

describe('buildNonogramaHints', () => {
  it('devuelve tres pistas de texto no vacías', () => {
    for (const seed of SEEDS) {
      const { hints } = pistasDe_(seed)
      expect(hints, `seed ${seed}`).toHaveLength(3)
      for (const h of hints) {
        expect(typeof h).toBe('string')
        expect(h.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('la primera pista señala la línea por la que se puede entrar', () => {
    // No todas las figuras tienen una línea forzada del todo (los bloques y
    // sus huecos llenando la línea entera): 'luna' y 'llave', por ejemplo, no
    // la tienen. Cuando existe, la pista debe apuntar a una de ellas; cuando
    // no, a la línea con el bloque más largo, que es la más restrictiva.
    const espacioMinimo = (pista) => {
      const bloques = pista.filter((n) => n > 0)
      return bloques.length ? bloques.reduce((a, b) => a + b, 0) + bloques.length - 1 : 0
    }

    for (const seed of SEEDS) {
      const { p, hints } = pistasDe_(seed)
      const m = hints[0].match(/(fila|columna) (\d+)/)
      expect(m, `seed ${seed}: ${hints[0]}`).not.toBeNull()

      const { filas, columnas } = pistasDe(p.grid)
      const senalada = m[1] === 'fila' ? filas[Number(m[2]) - 1] : columnas[Number(m[2]) - 1]
      const todas = [...filas, ...columnas]
      const hayForzada = todas.some((pista) => espacioMinimo(pista) === p.cols)

      if (hayForzada) {
        expect(espacioMinimo(senalada), `seed ${seed}: ${hints[0]}`).toBe(p.cols)
      } else {
        const mayor = Math.max(...todas.map((pista) => Math.max(...pista)))
        expect(Math.max(...senalada), `seed ${seed}: ${hints[0]}`).toBe(mayor)
      }
    }
  })

  it('la pista del solapamiento no señala una línea ya forzada', () => {
    // El solapamiento solo tiene sentido en una línea con margen: aplicarlo a
    // una fila que ya va pintada entera no enseña nada y además repite la
    // primera pista.
    const espacioMinimo = (pista) => {
      const bloques = pista.filter((n) => n > 0)
      return bloques.length ? bloques.reduce((a, b) => a + b, 0) + bloques.length - 1 : 0
    }

    for (const seed of SEEDS) {
      const { p, hints } = pistasDe_(seed)
      const m = hints[1].match(/(fila|columna) (\d+)/)
      if (!m) continue // el texto genérico, sin línea concreta, es válido

      const { filas, columnas } = pistasDe(p.grid)
      const senalada = m[1] === 'fila' ? filas[Number(m[2]) - 1] : columnas[Number(m[2]) - 1]
      expect(espacioMinimo(senalada), `seed ${seed}: ${hints[1]}`).toBeLessThan(p.cols)
      expect(hints[1].match(/(fila|columna) \d+/)[0], `seed ${seed}`)
        .not.toBe(hints[0].match(/(fila|columna) \d+/)[0])
    }
  })

  it('alguna pista dice cuántas celdas hay que pintar en total', () => {
    for (const seed of SEEDS) {
      const { p, hints } = pistasDe_(seed)
      const total = p.grid.flat().filter((v) => v === 1).length
      expect(hints.join(' '), `seed ${seed}`).toContain(String(total))
    }
  })

  it('no desvela qué dibujo es', () => {
    for (const seed of SEEDS) {
      const { p, hints } = pistasDe_(seed)
      expect(hints.join(' ').toLowerCase(), `seed ${seed}`).not.toContain(p.figura)
    }
  })

  it('es determinista para el mismo puzzle', () => {
    const p = buildNonogramaPuzzle(20260822)
    expect(buildNonogramaHints(p)).toEqual(buildNonogramaHints(p))
  })
})
