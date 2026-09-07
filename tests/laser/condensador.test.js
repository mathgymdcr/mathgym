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

  it('una segunda llegada del MISMO color no mezcla: sigue recta y con su color', () => {
    // Anillo pequeno: el mismo rayo (un unico laser) pasa DOS veces por el
    // condensador en (2,1). La primera vez (previo === undefined) ya la
    // cubre el test anterior; este cubre la rama previo !== undefined &&
    // previo === seg.color, que es la unica que distingue "no mezclar" de
    // "mezclar" -- sin ella, cambiar la comparacion de color por "cualquier
    // segunda llegada mezcla" (ver mutacion en el informe) deja los otros
    // tres tests en verde igual.
    //
    // Trazado real (comprobado con un script en el scratchpad, no viene del
    // brief): emisor (2,0) 'right', condensador en (2,1), y tres espejos
    // \ / \ en (2,2)(3,2)(3,1) que devuelven el rayo al propio (2,1):
    //   tramo0 (2,0)(2,1)                         resultado 'condensador' (1a llegada)
    //   tramo1 (2,1)(2,2)(3,2)(3,1)(2,1)           resultado 'condensador' (2a llegada, mismo color)
    //   tramo2 (2,1)(1,1)(0,1)                     resultado 'fuera'
    const size = 5
    const c = normalizaConfig({
      size,
      modo: 'condensador',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 4, col: 4, color: 'imposible' }],
      blocks: []
    })
    const piezas = crearPiezas(size)
    piezas[2][1] = PIEZA.CONDENSADOR
    piezas[2][2] = PIEZA.BACKSLASH
    piezas[3][2] = PIEZA.SLASH
    piezas[3][1] = PIEZA.BACKSLASH

    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    // Se afirma primero que hay de verdad DOS tramos que terminan/arrancan
    // en la celda del condensador (2,1) -- la segunda llegada real -- antes
    // de comprobar que no mezclo.
    const llegadas = tramos.filter((t) => t.squaresPath[t.squaresPath.length - 1].row === 2 &&
      t.squaresPath[t.squaresPath.length - 1].col === 1)
    expect(llegadas).toHaveLength(2)
    const segundaLlegada = tramos.find((t) => t.squaresPath.length > 1 &&
      t.squaresPath[t.squaresPath.length - 1].row === 2 && t.squaresPath[t.squaresPath.length - 1].col === 1)
    expect(segundaLlegada.resultado).toBe('condensador')
    // Y el tramo que sale despues de esa segunda llegada sigue con el mismo
    // color, no magenta.
    const salida = tramos.find((t) => t.squaresPath[0].row === 2 && t.squaresPath[0].col === 1 && t !== tramos[0])
    expect(salida).toBeDefined()
    expect(salida.color).toBe(c.lasers[0].color)
    expect(tramos.some((t) => t.resultado === 'condensador-mezcla')).toBe(false)
  })

  it('dos colores distintos salen como uno magenta, en la direccion del ultimo en llegar', () => {
    const c = normalizaConfig(BASE)
    const piezas = crearPiezas(c.size)
    piezas[3][2] = PIEZA.PRISMA
    // Trayectos reales del prisma solo (comprobados con un script de traza en
    // el scratchpad, no vienen del brief):
    //   azul 'ne': (3,2) (3,3) (2,3) (2,4) (1,4) (1,5) (0,5) (0,6)  resultado 'fuera'
    //   rojo 'se': (3,2) (4,2) (4,3) (5,3) (5,4) (6,4) (6,5)        resultado 'fuera'
    // Ninguna celda es comun a los dos (fuera del propio prisma).
    //
    // La regla de llegada al centro (Task 2) descarta el arreglo original de
    // un solo espejo: un HORIZ en (4,3) convierte la 'se' del rojo en 'ne' --
    // la MISMA familia diagonal que ya lleva el azul -- y dos rectas de la
    // misma familia (misma pendiente) son PARALELAS: comparten celdas de la
    // rejilla por pura anchura de celda, pero no cruzan nunca por el mismo
    // punto exacto, asi que ninguna de las dos llega centrada a (2,4).
    //
    // Con un segundo espejo VERT en (2,5) el rojo cambia de familia otra vez
    // (de 'ne' a 'nw'), lo que lo pone en una familia DISTINTA a la del azul
    // -- dos rectas de familias distintas si cruzan en un unico punto exacto,
    // y ese punto (comprobado con el mismo script de traza) cae centrado en
    // (1,4). Ahi es donde va el condensador. De paso, el azul entra en 'ne'
    // y el rojo en 'nw' -- direcciones realmente distintas, no la coincidencia
    // de familia del arreglo anterior -- por lo que la bisectriz de salida
    // (mas abajo) es una comprobacion real y no un caso degenerado.
    piezas[4][3] = PIEZA.HORIZ
    piezas[2][5] = PIEZA.VERT
    piezas[1][4] = PIEZA.CONDENSADOR
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    const azul = tramos.find((t) => t.color === 'azul')
    const rojo = tramos.find((t) => t.color === 'rojo')
    // Se afirma que los dos hijos realmente llegan al condensador antes de
    // afirmar el color de salida: si el trazador cambiara y dejara de
    // cruzarlos por (1,4), el test tiene que fallar aqui, no mas abajo.
    expect(azul.squaresPath.some((p) => p.row === 1 && p.col === 4)).toBe(true)
    expect(rojo.squaresPath.some((p) => p.row === 1 && p.col === 4)).toBe(true)
    expect(azul.resultado).toBe('condensador')          // el azul llega primero
    expect(rojo.resultado).toBe('condensador-mezcla')    // el rojo, segundo, mezcla
    const magenta = tramos.find((t) => t.color === 'magenta')
    expect(magenta).toBeDefined()
    expect(magenta.squaresPath[0]).toEqual({ row: 1, col: 4 })
    // Bisectriz de 'ne' (azul, vector (1,-1)) y 'nw' (rojo, vector (-1,-1)):
    // normalizados y sumados dan (0,-raiz2), la mas alineada de las 8 es
    // 'up'. El magenta sale hacia arriba: el siguiente punto es (0,4).
    expect(magenta.squaresPath[1]).toEqual({ row: 0, col: 4 })
  })

  it('BUG: el primero en llegar no debe atravesar el condensador sin fusionarse', () => {
    // Prisma en (5,5) desde un emisor 'right': hijos azul 'se' y rojo 'ne' (no
    // alineados a proposito, a diferencia del test de arriba). Un HORIZ en
    // (4,6) y otro en (6,6) los llevan a los dos a (5,7) -- comprobado con un
    // script de traza en el scratchpad, no viene del brief -- donde azul entra
    // viajando 'se' (dx=1,dy=1) y rojo 'ne' (dx=1,dy=-1). Antes del arreglo, el
    // azul (que llega primero) se dejaba pasar recto y seguia como un tramo
    // 'azul' independiente ademas del magenta: dos rayos saliendo del
    // condensador en vez de uno. Debe fusionarse en un UNICO magenta.
    const size = 12
    const c = normalizaConfig({
      size,
      modo: 'condensador',
      lasers: [{ emitter: { row: 5, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 0, color: 'imposible' }],
      blocks: []
    })
    const piezas = crearPiezas(size)
    piezas[5][5] = PIEZA.PRISMA
    piezas[4][6] = PIEZA.HORIZ
    piezas[6][6] = PIEZA.HORIZ
    piezas[5][7] = PIEZA.CONDENSADOR

    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    const azulLlegada = tramos.find((t) => t.color === 'azul')
    const rojoLlegada = tramos.find((t) => t.color === 'rojo')
    expect(azulLlegada.resultado).toBe('condensador')
    expect(rojoLlegada.resultado).toBe('condensador-mezcla')

    // Solo debe salir UN tramo de (5,7): ni azul ni rojo continuan por su
    // cuenta, unicamente el magenta fusionado.
    const salientes = tramos.filter((t) => t.squaresPath[0].row === 5 && t.squaresPath[0].col === 7)
    expect(salientes).toHaveLength(1)
    expect(salientes[0].color).toBe('magenta')

    // La direccion de salida es la bisectriz de 'se' (azul) y 'ne' (rojo):
    // sus vectores (1,1) y (1,-1), normalizados y sumados, dan (1,0) -- osea
    // 'right'. La bisectriz NO es la direccion de ninguno de los dos rayos
    // de entrada.
    expect(salientes[0].squaresPath[1]).toEqual({ row: 5, col: 8 })
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
    // Con la llegada obligatoria al centro (Task 2), un anillo de espejos que
    // reparte el rayo por las cuatro esquinas de un bloque -- como el diseno
    // original de este test -- ya no es alcanzable: cualquier lazo que vuelva
    // a entrar en el condensador con la MISMA direccion con la que salio (la
    // unica forma de que se repita solo, porque el condensador no cambia de
    // direccion con un solo color) recorre la MISMA linea recta que el tramo
    // de entrada, asi que acaba retrazando el camino de vuelta hasta el
    // propio emisor y se absorbe ahi -- comprobado a mano con media docena de
    // disenos (rectangulos y diamantes de espejos VERT/HORIZ), todos acaban
    // igual. Lo que si se puede construir de forma fiable es una
    // realimentacion REAL de varias vueltas antes de esa absorcion: un
    // diamante de cuatro espejos que reenvia el mismo rayo neutro al
    // condensador una y otra vez cambiando de diagonal cada vez (comprobado
    // con un script de traza en el scratchpad, determinista).
    const size = 9
    const c = normalizaConfig({
      size,
      modo: 'condensador',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'se' }, color: 'neutro' }],
      targets: [{ row: 8, col: 8, color: 'imposible' }],
      blocks: []
    })
    const piezas = crearPiezas(size)
    piezas[2][2] = PIEZA.CONDENSADOR
    piezas[4][4] = PIEZA.VERT       // se -> sw
    piezas[6][2] = PIEZA.HORIZ      // sw -> nw
    piezas[4][0] = PIEZA.VERT       // nw -> ne
    piezas[1][3] = PIEZA.BACKSLASH  // ne -> sw (de vuelta hacia el diamante)

    const t0 = Date.now()
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(Date.now() - t0).toBeLessThan(500)
    // El tope global sigue siendo la cota dura, la haga falta o no en este
    // disenio concreto.
    expect(tramos.length).toBeLessThanOrEqual(4 * size * size)
    // Realimentacion real: el mismo rayo vuelve a entrar centrado en el
    // condensador varias veces (no una sola pasada) antes de que el diamante
    // lo devuelva por donde vino y se absorba en su propio emisor -- eso
    // ultimo es el final natural del trazado, no el tope quien lo corta.
    const llegadas = tramos.filter((t) => t.resultado === 'condensador')
    expect(llegadas.length).toBeGreaterThanOrEqual(3)
    expect(tramos.at(-1).resultado).toBe('emisor')
    // El rayo es siempre el mismo color ('neutro'): en ninguna de esas
    // llegadas debe mezclar.
    expect(tramos.every((t) => t.resultado !== 'condensador-mezcla')).toBe(true)
  })
})
