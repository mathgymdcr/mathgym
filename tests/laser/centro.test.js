import { describe, it, expect } from 'vitest'
import { simularTodos, resuelto, crearPiezas, normalizaConfig, PIEZA } from '../../scripts/laser-triangular-logic.js'

// Emisor en (0,0) disparando 'se'. Un espejo '\' en (1,1) lo desvia hacia
// 'right'; entra en la diana (0-index fila2? no, sigue en fila1) por su
// borde IZQUIERDO a ly=0 (esquina), no por el centro: antes de este cambio
// contaba como resuelto, ahora no debe contar.
const CONFIG = normalizaConfig({
  size: 4, modo: 'clasico',
  lasers: [{ emitter: { row: 0, col: 0, dir: 'se' }, target: { row: 1, col: 3 } }],
  blocks: []
})

describe('llegada obligatoria al centro', () => {
  it('una diana entra desalineada: no cuenta como resuelto, el rayo sigue de largo', () => {
    const piezas = crearPiezas(4)
    piezas[1][1] = PIEZA.BACKSLASH // desvia 'se' -> 'right' desde (1,1)
    const { tramos } = simularTodos(CONFIG, piezas)
    // El rayo llega a la celda de la diana (1,3) pero por su borde, no por
    // el centro (ly=0 al entrar desde la izquierda en horizontal exige 0.5).
    expect(tramos[0].resultado).not.toBe('diana')
    expect(resuelto(CONFIG, piezas)).toBe(false)
  })

  it('la misma diana, alcanzada en linea recta horizontal (alineada), si resuelve', () => {
    const configRecto = normalizaConfig({
      size: 4, modo: 'clasico',
      lasers: [{ emitter: { row: 1, col: 0, dir: 'right' }, target: { row: 1, col: 3 } }],
      blocks: []
    })
    const piezas = crearPiezas(4)
    const { tramos } = simularTodos(configRecto, piezas)
    expect(tramos[0].resultado).toBe('diana')
    expect(resuelto(configRecto, piezas)).toBe(true)
  })
})
