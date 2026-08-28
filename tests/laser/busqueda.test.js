import { describe, it, expect } from 'vitest'
import { resolverPiezas, piezasMinimas, piezasMinimasExhaustivo, normalizaConfig, resuelto, PIEZA } from '../../scripts/laser-triangular-logic.js'

const CLASICO = normalizaConfig({
  size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: []
})

describe('busqueda de minimos', () => {
  it('encuentra una colocacion que resuelve de verdad', () => {
    const sol = resolverPiezas(CLASICO, 3)
    expect(sol).not.toBeNull()
    expect(resuelto(CLASICO, sol.piezas)).toBe(true)
  })

  it('en clasico nunca propone prisma ni condensador', () => {
    const sol = resolverPiezas(CLASICO, 3)
    const usadas = sol.piezas.flat().filter(Boolean)
    expect(usadas.includes(PIEZA.PRISMA)).toBe(false)
    expect(usadas.includes(PIEZA.CONDENSADOR)).toBe(false)
  })

  it('la version podada y la exhaustiva dan el mismo minimo', () => {
    expect(piezasMinimas(CLASICO, 3)).toBe(piezasMinimasExhaustivo(CLASICO, 3))
  })

  it('con seis tipos de pieza la busqueda sigue siendo rapida', () => {
    const t0 = Date.now()
    piezasMinimas({ ...CLASICO, modo: 'prisma' }, 3)
    expect(Date.now() - t0, 'la poda ya no aguanta seis tipos de pieza').toBeLessThan(4000)
  })
})
