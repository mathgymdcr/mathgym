import { describe, it, expect } from 'vitest'
import { simularHaz, simularTodos, normalizaConfig, crearPiezas, PIEZA } from '../../scripts/laser-triangular-logic.js'

// Emisor en (3,0) disparando a la derecha, tablero 7x7.
const BASE = {
  size: 7,
  modo: 'condensador',
  lasers: [{ emitter: { row: 3, col: 0, dir: 'right' }, color: 'neutro' }],
  targets: [{ row: 3, col: 6, color: 'magenta' }],
  blocks: []
}

describe('condensador', () => {
  it('con un solo rayo deja pasar recto y sin cambiar de color', () => {
    // El brief original ponia target color "neutro-1" mientras el laser es
    // "neutro": con esos dos colores distintos el resultado real es
    // "diana-ajena" (el trazador hace bien su trabajo: el rayo SI llega sin
    // cambiar de color, pero la diana no es la suya). Se corrige aqui el
    // color de la diana para que coincida con el del laser, que es lo que el
    // texto del comportamiento realmente quiere comprobar.
    const c = normalizaConfig({
      ...BASE,
      targets: [{ row: 3, col: 6, color: 'neutro' }]
    })
    const piezas = crearPiezas(c.size)
    piezas[3][3] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    // Se afirma el trayecto antes del resultado: el rayo pasa por el
    // condensador en (3,3) y sigue en linea recta hasta la diana en (3,6).
    expect(tramos).toHaveLength(2)
    expect(tramos[0].resultado).toBe('condensador')
    expect(tramos[0].squaresPath[tramos[0].squaresPath.length - 1]).toEqual({ row: 3, col: 3 })
    const salida = tramos[tramos.length - 1]
    expect(salida.squaresPath).toEqual([{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }])
    expect(salida.color).toBe(c.lasers[0].color)
    expect(salida.resultado).toBe('diana')
  })

  it('dos colores distintos salen como uno magenta, en la direccion del ultimo en llegar', () => {
    const c = normalizaConfig(BASE)
    const piezas = crearPiezas(c.size)
    piezas[3][2] = PIEZA.PRISMA
    // Trayectos reales del prisma solo (comprobados con un script de traza en
    // el scratchpad, no vienen del brief):
    //   azul 'ne': (3,2) (3,3) (2,3) (2,4) (1,4) (1,5) (0,5) (0,6)  resultado 'fuera'
    //   rojo 'se': (3,2) (4,2) (4,3) (5,3) (5,4) (6,4) (6,5)        resultado 'fuera'
    // Ninguna celda es comun a los dos (fuera del propio prisma), asi que se
    // anade un espejo HORIZ en (4,3) -- en el camino del rojo -- que convierte
    // su direccion 'se' (bajando) en 'ne' (subiendo en diagonal), la MISMA
    // direccion que ya lleva el azul. Con eso ambos hijos cruzan por (2,4).
    piezas[4][3] = PIEZA.HORIZ
    piezas[2][4] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    const azul = tramos.find((t) => t.color === 'azul')
    const rojo = tramos.find((t) => t.color === 'rojo')
    // Se afirma que los dos hijos realmente llegan al condensador antes de
    // afirmar el color de salida: si el trazador cambiara y dejara de
    // cruzarlos por (2,4), el test tiene que fallar aqui, no mas abajo.
    expect(azul.squaresPath.some((p) => p.row === 2 && p.col === 4)).toBe(true)
    expect(rojo.squaresPath.some((p) => p.row === 2 && p.col === 4)).toBe(true)
    expect(azul.resultado).toBe('condensador')          // el azul llega primero
    expect(rojo.resultado).toBe('condensador-mezcla')    // el rojo, segundo, mezcla
    const magenta = tramos.find((t) => t.color === 'magenta')
    expect(magenta).toBeDefined()
    expect(magenta.squaresPath[0]).toEqual({ row: 2, col: 4 })
    // El rojo (el ultimo en llegar) entra en (2,4) en diagonal 'ne' -- el
    // espejo HORIZ en (4,3) convierte su 'se' original en 'ne', la misma
    // direccion que ya llevaba el azul (por eso ambos cruzan el mismo punto).
    // El magenta sale en esa direccion: el siguiente punto es (2,5).
    expect(magenta.squaresPath[1]).toEqual({ row: 2, col: 5 })
  })

  it('la celda del condensador no cuenta como cruce', () => {
    const c = normalizaConfig(BASE)
    const piezas = crearPiezas(c.size)
    piezas[3][2] = PIEZA.PRISMA
    // El hijo rojo (ver test anterior) pasa por (4,2) y (4,3) sin ningun
    // espejo extra. Se pone el condensador justo en (4,3): la propia entrada
    // y la continuacion que genera son DOS tramos distintos que comparten esa
    // celda, asi que sin la excepcion de pieza esto SI seria un cruce.
    piezas[4][3] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    const rojo = tramos.find((t) => t.color === 'rojo')
    const continuacion = tramos.find((t) => t.squaresPath[0].row === 4 && t.squaresPath[0].col === 3 && t !== rojo)
    // Se afirma que (4,3) esta realmente visitada por dos tramos distintos
    // antes de comprobar que no cuenta como cruce -- si no, la asercion de
    // "no cruce" seria trivial por falta de segunda visita, no por la regla.
    expect(rojo.squaresPath.some((p) => p.row === 4 && p.col === 3)).toBe(true)
    expect(continuacion).toBeDefined()
    expect(simularTodos(c, piezas).cruces.has('4,3')).toBe(false)
  })

  it('el tope global corta cualquier realimentacion sin colgarse', () => {
    // Anillo cerrado de espejos (sin salida) con un condensador en uno de sus
    // lados: /, \, /, \ en las cuatro esquinas de un bloque 3x3 (filas y
    // columnas 1-3) hacen que un rayo que entra quede dando vueltas dentro
    // del anillo para siempre -- realimentacion de verdad, no solo un tablero
    // sembrado al azar. Se comprobo con un script de traza en el scratchpad
    // que, sin el tope de produccion, esta configuracion nunca termina sola
    // (se probo hasta 400 tramos con una copia instrumentada del trazador
    // y seguia generando mas).
    const size = 5
    const c = normalizaConfig({
      size,
      modo: 'condensador',
      lasers: [{ emitter: { row: 0, col: 2, dir: 'se' }, color: 'neutro' }],
      targets: [{ row: 4, col: 4, color: 'imposible' }],
      blocks: []
    })
    const piezas = crearPiezas(size)
    piezas[1][1] = PIEZA.SLASH
    piezas[1][3] = PIEZA.BACKSLASH
    piezas[3][3] = PIEZA.SLASH
    piezas[3][1] = PIEZA.BACKSLASH
    piezas[1][2] = PIEZA.CONDENSADOR

    const t0 = Date.now()
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(Date.now() - t0).toBeLessThan(500)
    expect(tramos.length).toBeLessThanOrEqual(4 * size * size)
    // El anillo es realimentacion de verdad: sin el tope se generarian mas de
    // 4*n^2 tramos, asi que llegar exactamente a ese limite (y no menos)
    // demuestra que el tope es lo que esta cortando, no que el rayo se
    // hubiera parado solo.
    expect(tramos.length).toBe(4 * size * size)
    expect(tramos.every((t) => typeof t.resultado === 'string')).toBe(true)
  })
})
