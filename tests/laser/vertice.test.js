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

  it('un espejo-vertice horizontal en (2,2) refleja el rayo hacia arriba', () => {
    // El emisor arranca en (0.501,0.502) local (ARRANQUE): un rayo 'down'
    // cruza cada borde horizontal con x local ligeramente MAYOR que 0.5,
    // asi que para un emisor en columna 1 el vertice relevante es C=2 (la
    // mitad derecha del vertice), no C=1. Tablero 4x4, emisor en (1,1),
    // para que el rebote hacia arriba no salga inmediatamente del tablero
    // por el otro lado.
    const laserAbajo = { emitter: { row: 1, col: 1, dir: 'down' }, color: 'neutro-1' }
    const config = normalizaConfig({ size: 4, modo: 'clasico', lasers: [laserAbajo], targets: [], blocks: [] })
    const piezas = crearPiezas(4)
    const piezasVertice = crearPiezasVertice(4)
    piezasVertice[2][2] = PIEZA.HORIZ
    const { tramos } = simularHaz(config, piezas, laserAbajo, piezasVertice)
    // Reflejado (dy invertido), el rayo vuelve hacia arriba: visita la fila
    // 0 y nunca llega a la fila 3, al contrario que sin el vertice.
    expect(tramos[0].squaresPath.some(p => p.row === 0)).toBe(true)
    expect(tramos[0].squaresPath.some(p => p.row === 3)).toBe(false)
  })

  it('un vertice sin pieza no afecta nada: el mismo rayo sigue derecho', () => {
    const laserAbajo = { emitter: { row: 1, col: 1, dir: 'down' }, color: 'neutro-1' }
    const config = normalizaConfig({ size: 4, modo: 'clasico', lasers: [laserAbajo], targets: [], blocks: [] })
    const piezas = crearPiezas(4)
    const { tramos } = simularHaz(config, piezas, laserAbajo, crearPiezasVertice(4))
    expect(tramos[0].squaresPath.some(p => p.row === 3)).toBe(true)
  })
})
