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
    // El grado siempre va en el dataset; el texto visible solo lo lleva el
    // chip libre (sin forma fija) -- ver plantillas/hashi.js:cuerpoDeForma.
    expect(botones.map((b) => Number(b.dataset.grado))).toEqual(p.islands.map((i) => i.grado))
    p.islands.forEach((isla, idx) => {
      const texto = botones[idx].textContent.trim()
      if (isla.forma) expect(texto, `isla ${idx} con forma ${isla.forma}`).toBe('')
      else expect(texto, `isla ${idx} libre`).toBe(String(isla.grado))
    })
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
})
