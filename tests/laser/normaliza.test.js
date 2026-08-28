import { describe, it, expect } from 'vitest'
import { normalizaConfig, tiposDisponibles, PIEZA, COLORES } from '../../scripts/laser-triangular-logic.js'

describe('normalizaConfig', () => {
  it('traduce el esquema viejo: las dianas suben a targets y los laseres reciben color propio', () => {
    const viejo = {
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [{ row: 1, col: 1 }]
    }
    const c = normalizaConfig(viejo)
    expect(c.modo).toBe('clasico')
    expect(c.targets).toEqual([
      { row: 3, col: 4, color: 'neutro-1' },
      { row: 2, col: 1, color: 'neutro-2' }
    ])
    expect(c.lasers.map((l) => l.color)).toEqual(['neutro-1', 'neutro-2'])
    expect(c.blocks).toEqual([{ row: 1, col: 1 }])
  })

  it('deja intacto el esquema nuevo', () => {
    const nuevo = {
      size: 6,
      modo: 'prisma',
      lasers: [{ emitter: { row: 0, col: 2, dir: 'se' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'azul' }, { row: 5, col: 3, color: 'rojo' }],
      blocks: []
    }
    expect(normalizaConfig(nuevo)).toEqual(nuevo)
  })

  it('conserva variant, que es el tamano y lo lee la plantilla', () => {
    const c = normalizaConfig({ variant: 'medio', size: 5, lasers: [{ emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 2, col: 2 } }] })
    expect(c.variant).toBe('medio')
  })

  it('es idempotente', () => {
    const viejo = { size: 4, lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 2, col: 2 } }] }
    const una = normalizaConfig(viejo)
    expect(normalizaConfig(una)).toEqual(una)
  })
})

describe('tiposDisponibles', () => {
  it('en clasico solo hay espejos; con prisma y condensador estan las seis piezas', () => {
    expect(tiposDisponibles('clasico')).toEqual([PIEZA.SLASH, PIEZA.BACKSLASH, PIEZA.VERT, PIEZA.HORIZ])
    expect(tiposDisponibles('prisma')).toHaveLength(6)
    expect(tiposDisponibles('condensador')).toHaveLength(6)
  })
})

describe('COLORES', () => {
  it('es un conjunto cerrado de cuatro', () => {
    expect(COLORES).toEqual(['neutro', 'azul', 'rojo', 'magenta'])
  })
})
