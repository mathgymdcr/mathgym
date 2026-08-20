import { describe, it, expect } from 'vitest'
import { buildRelojesHints, buildRelojesPuzzle, solveRelojes, enumerateMeasurable } from '../../scripts/relojes-logic.js'

const cfg = (glasses, target, variant) => ({ glasses, target, variant })

describe('buildRelojesHints', () => {
  it('enumera los relojes con comas y una sola "y" final', () => {
    const c = cfg([3, 8, 9], 2, 'diferido')
    const hints = buildRelojesHints(c, solveRelojes(c.glasses, c.target, c.variant))
    expect(hints[0]).toContain('3 min, 8 min y 9 min')
    expect(hints[0]).not.toContain('min y 8 min y')
  })

  it('nunca describe un reloj volteado de 0 minutos', () => {
    for (const glasses of [[2, 3], [2, 5], [3, 4], [2, 3, 4]]) {
      // El objetivo da igual aquí; lo que se comprueba es la frase sobre el
      // reloj mayor volteado a medias, que con duraciones pequeñas es donde
      // puede degenerar en "un reloj de 0 min".
      const target = [...enumerateMeasurable(glasses, { modo: 'diferido', maxRondas: 3, maxTotal: 12 }).keys()][0]
      const c = cfg(glasses, target, 'diferido')
      const hints = buildRelojesHints(c, solveRelojes(glasses, target, 'diferido'))
      expect(hints.join(' '), `glasses=${glasses}`).not.toMatch(/de 0 min/)
    }
  })

  it('distingue las vueltas totales de los tramos cronometrados', () => {
    const c = cfg([3, 8, 9], 2, 'diferido')
    const sol = solveRelojes(c.glasses, c.target, c.variant)
    const texto = buildRelojesHints(c, sol).join(' ')
    expect(sol.rondasTotales).toBeGreaterThan(sol.rondas)
    expect(texto).toContain(`${sol.rondasTotales} vueltas`)
    expect(texto).toContain(`${sol.tramos.join(' + ')} = ${c.target} min`)
  })

  it('concuerda el singular de "vuelta" cuando solo hay una', () => {
    const c = cfg([4, 7], 7, 'clasico')
    const sol = solveRelojes(c.glasses, c.target, c.variant)
    const texto = buildRelojesHints(c, sol).join(' ')
    expect(texto).toContain('1 vuelta de arena')
    expect(texto).not.toContain('1 vueltas')
  })

  it('concuerda el verbo con una sola vuelta', () => {
    const c = cfg([4, 7], 7, 'clasico')
    const texto = buildRelojesHints(c, solveRelojes(c.glasses, c.target, c.variant)).join(' ')
    expect(texto).toContain('La solución mínima es 1 vuelta')
  })

  it('no arrastra concordancias rotas cuando el objetivo es 1 minuto', () => {
    for (const variant of ['clasico', 'diferido']) {
      const c = cfg([4, 9], 1, variant)
      const sol = solveRelojes(c.glasses, c.target, variant)
      if (!sol) continue
      const texto = buildRelojesHints(c, sol).join(' ')
      expect(texto, variant).not.toMatch(/Los 1 min|1 min no salen|1 min se cuentan/)
    }
  })

  it('no escribe sumas degeneradas cuando solo se cronometra un tramo', () => {
    const c = cfg([2, 5, 7], 1, 'diferido')
    const sol = solveRelojes(c.glasses, c.target, c.variant)
    expect(sol.tramos).toHaveLength(1)
    const texto = buildRelojesHints(c, sol).join(' ')
    expect(texto).not.toMatch(/1 = 1 min/)
    expect(texto).toContain('1 min')
  })

  it('da tres pistas para cualquier puzzle generado', () => {
    for (let seed = 20260101; seed < 20260131; seed++) {
      const p = buildRelojesPuzzle(seed)
      const hints = buildRelojesHints(p, p.solucion)
      expect(hints, `seed=${seed}`).toHaveLength(3)
      expect(hints.every(h => typeof h === 'string' && h.length > 20), `seed=${seed}`).toBe(true)
    }
  })
})
