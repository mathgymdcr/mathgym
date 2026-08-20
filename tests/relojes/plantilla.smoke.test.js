import { describe, it, expect } from 'vitest'
import { buildRelojesPuzzle } from '../../scripts/relojes-logic.js'

describe('plantillas/relojes_arena.js con el payload del generador', () => {
  it('monta el tablero y pinta un reloj por duración', async () => {
    const mod = await import('../../plantillas/relojes_arena.js')
    const p = buildRelojesPuzzle(20260919)
    const root = document.createElement('div')

    // Mismo objeto que escribe el generador en data/relojes_{fecha}.json,
    // pasado en línea (la plantilla acepta data.glasses sin json_url).
    await mod.render(root, {
      variant: p.variant,
      glasses: p.glasses,
      target: p.target,
      tolerance: 0.25,
      min_rondas: p.solucion.rondasTotales
    }, {})

    expect(root.querySelectorAll('.sand-glass')).toHaveLength(p.glasses.length)
    expect(root.querySelector('.target-amount').textContent).toBe(`${p.target} min`)
    expect(root.querySelector('.feedback').className).not.toContain('ko')
  })
})
