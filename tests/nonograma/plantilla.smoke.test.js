import { describe, it, expect } from 'vitest'
import { buildNonogramaPuzzle, pistasColorDe } from '../../scripts/nonograma-logic.js'

// Contrato entre el payload del generador y plantillas/nonograma.js, que
// deriva las pistas del `grid` por su cuenta.
describe('plantillas/nonograma.js con el payload del generador', () => {
  it('monta la rejilla y pinta las pistas de cada fila y columna', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const p = buildNonogramaPuzzle(20260822)
    const root = document.createElement('div')

    await mod.render(root, {
      variant: p.variant,
      rows: p.rows,
      cols: p.cols,
      grid: p.grid,
      ...(p.paleta ? { paleta: p.paleta } : {}),
      figura: p.figura
    }, {})

    expect(root.querySelectorAll('.nono-cell')).toHaveLength(p.rows * p.cols)
    expect(root.querySelectorAll('.nono-clue-row')).toHaveLength(p.rows)
    expect(root.querySelectorAll('.nono-clue-col')).toHaveLength(p.cols)
    expect(root.querySelector('.feedback.ko')).toBeNull()

    const { filas } = pistasColorDe(p.grid)
    const primeraPista = [...root.querySelectorAll('.nono-clue-row')][0].textContent
    expect(primeraPista).toBe(filas[0].map((b) => b.n).join(''))
  })
})
