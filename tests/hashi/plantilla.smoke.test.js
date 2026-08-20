import { describe, it, expect } from 'vitest'
import { buildHashiPuzzle } from '../../scripts/hashi-logic.js'

// Contrato entre el payload que escribe el generador y lo que lee
// plantillas/hashi.js. La plantilla ya existía, así que esto es una red de
// seguridad contra cambios de esquema en cualquiera de los dos lados.
describe('plantillas/hashi.js con el payload del generador', () => {
  it('monta el tablero y pinta una isla con su grado por cada isla', async () => {
    const mod = await import('../../plantillas/hashi.js')
    const p = buildHashiPuzzle(20260821)
    const root = document.createElement('div')

    await mod.render(root, {
      variant: p.variant,
      rows: p.rows,
      cols: p.cols,
      islands: p.islands,
      min_puentes: p.solucion.total
    }, {})

    expect(root.querySelectorAll('.hashi-cell')).toHaveLength(p.rows * p.cols)
    const botones = [...root.querySelectorAll('.hashi-island-btn')]
    expect(botones).toHaveLength(p.islands.length)
    expect(botones.map((b) => Number(b.textContent))).toEqual(p.islands.map((i) => i.grado))
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
})
