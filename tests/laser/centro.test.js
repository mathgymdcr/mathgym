import { describe, it, expect } from 'vitest'
import { simularTodos, resuelto, crearPiezas, normalizaConfig, PIEZA } from '../../scripts/laser-triangular-logic.js'

describe('llegada obligatoria al centro', () => {
  it('un hijo de prisma entra a su diana desalineado: no cuenta, el rayo sigue de largo', () => {
    // Prisma en (2,4): su hijo azul (giro 'ne') visita la celda de la diana
    // (2,5) pero por su borde, no por el centro -- es el mismo patron
    // geometrico que motivo esta funcionalidad (ver el spec). Antes de este
    // cambio cualquier visita bastaba para contar como diana; ahora hace
    // falta pasar por el centro.
    const config = normalizaConfig({
      size: 7, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 3, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 2, col: 5, color: 'azul' }, { row: 5, col: 6, color: 'rojo' }],
      blocks: []
    })
    const piezas = crearPiezas(7)
    piezas[2][4] = PIEZA.PRISMA
    const { tramos } = simularTodos(config, piezas)
    const azul = tramos.find((t) => t.color === 'azul')
    // Visita la celda destino (sigue en su squaresPath) pero no se detiene
    // ahi: continua hasta salir del tablero.
    expect(azul.squaresPath.some((p) => p.row === 2 && p.col === 5)).toBe(true)
    expect(azul.resultado).not.toBe('diana')
    expect(resuelto(config, piezas)).toBe(false)
  })

  it('la misma diana, alcanzada en linea recta horizontal (alineada), si resuelve', () => {
    const configRecto = normalizaConfig({
      size: 7, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 3, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 2, col: 5, color: 'neutro' }],
      blocks: []
    })
    const piezas = crearPiezas(7)
    const { tramos } = simularTodos(configRecto, piezas)
    // Sin prisma, el rayo va recto (alineado) y alcanza la diana.
    expect(tramos[0].resultado).toBe('diana')
    expect(resuelto(configRecto, piezas)).toBe(true)
  })
})
