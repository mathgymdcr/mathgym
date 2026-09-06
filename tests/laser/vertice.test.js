import { describe, it, expect } from 'vitest'
import {
  simularHaz, crearPiezas, crearPiezasVertice, normalizaConfig, PIEZA
} from '../../scripts/laser-triangular-logic.js'

// Tablero 3x3: emisor en (1,0) disparando 'right'. Sin nada en el camino,
// el rayo se sale del tablero por la derecha en línea recta.
const TABLERO = { size: 3, modo: 'clasico', lasers: [], targets: [], blocks: [] }
const LASER = { emitter: { row: 1, col: 0, dir: 'right' }, color: 'neutro-1' }

describe('espejo-vertice: geometria', () => {
  it('sin espejo-vertice, el rayo recto se sale del tablero', () => {
    const config = normalizaConfig({ ...TABLERO, lasers: [LASER] })
    const piezas = crearPiezas(3)
    const { tramos } = simularHaz(config, piezas, LASER, crearPiezasVertice(3))
    expect(tramos[0].resultado).toBe('fuera')
  })

  it('un espejo-vertice horizontal en (1,1) refleja el rayo hacia arriba', () => {
    // El rayo viaja por dentro de la fila 1 (y=1.5 constante). El vertice
    // horizontal (R=1,C=1) cubre x en [0.5,1.5] sobre la linea y=1 -- pero
    // el rayo va por y=1.5, no por y=1: para que lo cruce hace falta que
    // vaya en diagonal. Se dispara en 'ne' desde (1,0) para que cruce y=1.
    const laserDiag = { emitter: { row: 1, col: 0, dir: 'ne' }, color: 'neutro-1' }
    const config = normalizaConfig({ ...TABLERO, lasers: [laserDiag] })
    const piezas = crearPiezas(3)
    const piezasVertice = crearPiezasVertice(3)
    piezasVertice[1][1] = PIEZA.HORIZ
    const { tramos } = simularHaz(config, piezas, laserDiag, piezasVertice)
    // Reflejado (dy invertido), el rayo vuelve hacia abajo-derecha (se) y
    // sigue dentro del tablero en vez de salir por arriba.
    expect(tramos[0].resultado).not.toBe('fuera')
    expect(tramos[0].squaresPath.some(p => p.row === 1 && p.col === 0)).toBe(true)
  })

  it('un vertice sin pieza no afecta nada', () => {
    const laserDiag = { emitter: { row: 1, col: 0, dir: 'ne' }, color: 'neutro-1' }
    const config = normalizaConfig({ ...TABLERO, lasers: [laserDiag] })
    const piezas = crearPiezas(3)
    const { tramos } = simularHaz(config, piezas, laserDiag, crearPiezasVertice(3))
    expect(tramos[0].resultado).toBe('fuera')
  })
})
