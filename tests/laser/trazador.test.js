import { describe, it, expect } from 'vitest'
import { simularHaz, simularTodos, giraDir, CICLO_DIR, normalizaConfig, crearPiezas, resuelto, DIR_VECTOR } from '../../scripts/laser-triangular-logic.js'

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
    const { tramos } = simularTodos(TABLERO, crearPiezas(TABLERO.size))
    expect(tramos.every((t) => t.resultado === 'diana')).toBe(false)
    expect(resuelto(TABLERO, crearPiezas(TABLERO.size))).toBe(false)
  })

  it('con los espejos previstos, los dos rayos llegan y no se cruzan', () => {
    const espejos = crearPiezas(TABLERO.size)
    espejos[3][0] = 2   // '\\' manda el rayo naranja hacia la derecha
    espejos[0][1] = 1   // '/' manda el rayo azul hacia abajo

    const { tramos, cruces } = simularTodos(TABLERO, espejos)
    expect(tramos.map((t) => t.resultado)).toEqual(['diana', 'diana'])
    expect([...cruces]).toEqual([])
    expect(resuelto(TABLERO, espejos)).toBe(true)
  })

  it('un rayo que se sale del tablero no cuenta como diana', () => {
    const espejos = crearPiezas(TABLERO.size)
    espejos[3][0] = 1   // '/' en vez de '\\': lo manda fuera
    const { tramos } = simularTodos(TABLERO, espejos)
    expect(tramos[0].resultado).not.toBe('diana')
  })

  it('un espejo paralelo al rayo lo deja pasar sin desviarlo', () => {
    // El rayo naranja baja por la columna 0; un espejo vertical '|' en su
    // camino es paralelo a su trayectoria, así que no lo toca.
    const sinNada = crearPiezas(TABLERO.size)
    const conVertical = crearPiezas(TABLERO.size)
    conVertical[2][0] = 3
    const a = simularTodos(TABLERO, sinNada).tramos[0]
    const b = simularTodos(TABLERO, conVertical).tramos[0]
    expect(b.squaresPath).toEqual(a.squaresPath)
  })
})

describe('giro de 45 grados', () => {
  it('las ocho direcciones estan en orden horario', () => {
    expect(CICLO_DIR).toEqual(['right', 'se', 'down', 'sw', 'left', 'nw', 'up', 'ne'])
  })

  it('girar -1 es 45 grados a la izquierda y +1 a la derecha', () => {
    expect(giraDir('right', -1)).toBe('ne')
    expect(giraDir('right', 1)).toBe('se')
    expect(giraDir('ne', 1)).toBe('right')
    expect(giraDir('right', 8)).toBe('right')
  })
})

describe('simularHaz devuelve tramos', () => {
  it('sin piezas nuevas hay exactamente un tramo por laser', () => {
    const c = normalizaConfig(TABLERO)
    const { tramos } = simularHaz(c, crearPiezas(c.size), c.lasers[0])
    expect(tramos).toHaveLength(1)
    expect(tramos[0].color).toBe('neutro-1')
    expect(tramos[0].puntos.length).toBeGreaterThan(1)
  })

  it('mantiene el resultado de hoy con los espejos previstos', () => {
    const c = normalizaConfig(TABLERO)
    const piezas = crearPiezas(c.size)
    piezas[3][0] = 2
    piezas[0][1] = 1
    const { tramos, cruces } = simularTodos(c, piezas)
    expect(tramos.map((t) => t.resultado)).toEqual(['diana', 'diana'])
    expect([...cruces]).toEqual([])
    expect(resuelto(c, piezas)).toBe(true)
  })
})

describe('regla de cruce por visitas', () => {
  // Tablero propio para este test: en TABLERO, sin espejos, el rayo de la
  // fila 0 corre en línea recta hasta el emisor ajeno de (0,0) y lo
  // absorbe ahí -- correcto (cualquier emisor absorbe), pero esa celda
  // también es el punto de partida del otro rayo, así que TABLERO sin
  // espejos ya cuenta como un cruce por sí solo y no sirve para probar el
  // caso "no hay cruce". Aquí los dos rayos van por filas separadas y ni
  // se cruzan ni se topan con ningún emisor.
  const SIN_CRUCE = {
    size: 5,
    lasers: [
      { emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 0, col: 4 } },
      { emitter: { row: 4, col: 0, dir: 'right' }, target: { row: 4, col: 4 } }
    ],
    blocks: []
  }

  it('dos rayos que no comparten celda no cruzan', () => {
    const c = normalizaConfig(SIN_CRUCE)
    const piezas = crearPiezas(c.size)
    // Sin espejos, los dos rayos de SIN_CRUCE no comparten celda.
    expect([...simularTodos(c, piezas).cruces]).toEqual([])
  })

  it('un rayo que se topa con un emisor ajeno en la celda de partida del otro cuenta como cruce', () => {
    // TABLERO es justo ese caso: el rayo de (0,4) corre sin espejos hasta
    // absorberse en el emisor de (0,0), que también es donde arranca el
    // otro rayo -- las dos celdas coinciden.
    const c = normalizaConfig(TABLERO)
    const piezas = crearPiezas(c.size)
    expect([...simularTodos(c, piezas).cruces]).toEqual(['0,0'])
  })
})
