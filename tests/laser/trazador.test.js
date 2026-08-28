import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import { simularTodos, resuelto, crearPiezas, DIR_VECTOR } from '../../scripts/laser-triangular-logic.js'

// El trazador sale de plantillas/laser_triangular.js para que el juego, el
// generador y el validador usen exactamente el mismo código: si el generador
// trazara distinto, publicaría retos imposibles.
//
// Espejos: 0 = vacío, 1 = '/', 2 = '\', 3 = '|', 4 = '—'.

// Tablero fijo escrito aquí (no el del muestrario, que ahora lo genera el
// generador y cambiaría estos tests cada vez que se regenere).
const TABLERO = {
  size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: []
}

describe('trazador de la malla triangular', () => {
  it('conoce las ocho direcciones', () => {
    expect(Object.keys(DIR_VECTOR).sort()).toEqual(
      ['down', 'left', 'ne', 'nw', 'right', 'se', 'sw', 'up'].sort()
    )
  })

  it('sin espejos, ningún rayo llega a su diana', () => {
    const { resultados } = simularTodos(TABLERO, crearPiezas(TABLERO.size))
    expect(resultados.every((r) => r.resultado === 'diana')).toBe(false)
    expect(resuelto(TABLERO, crearPiezas(TABLERO.size))).toBe(false)
  })

  it('con los espejos previstos, los dos rayos llegan y no se cruzan', () => {
    const espejos = crearPiezas(TABLERO.size)
    espejos[3][0] = 2   // '\\' manda el rayo naranja hacia la derecha
    espejos[0][1] = 1   // '/' manda el rayo azul hacia abajo

    const { resultados, cruces } = simularTodos(TABLERO, espejos)
    expect(resultados.map((r) => r.resultado)).toEqual(['diana', 'diana'])
    expect([...cruces]).toEqual([])
    expect(resuelto(TABLERO, espejos)).toBe(true)
  })

  it('un rayo que se sale del tablero no cuenta como diana', () => {
    const espejos = crearPiezas(TABLERO.size)
    espejos[3][0] = 1   // '/' en vez de '\\': lo manda fuera
    const { resultados } = simularTodos(TABLERO, espejos)
    expect(resultados[0].resultado).not.toBe('diana')
  })

  it('un espejo paralelo al rayo lo deja pasar sin desviarlo', () => {
    // El rayo naranja baja por la columna 0; un espejo vertical '|' en su
    // camino es paralelo a su trayectoria, así que no lo toca.
    const sinNada = crearPiezas(TABLERO.size)
    const conVertical = crearPiezas(TABLERO.size)
    conVertical[2][0] = 3
    const a = simularTodos(TABLERO, sinNada).resultados[0]
    const b = simularTodos(TABLERO, conVertical).resultados[0]
    expect(b.squaresPath).toEqual(a.squaresPath)
  })
})
