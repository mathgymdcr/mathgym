import { describe, it, expect } from 'vitest'
import { simularHaz, simularTodos, normalizaConfig, crearPiezas, PIEZA } from '../../scripts/laser-triangular-logic.js'

// Emisor en (2,0) disparando a la derecha; el prisma va en (2,2).
const BASE = {
  size: 6,
  modo: 'prisma',
  lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
  targets: [{ row: 0, col: 5, color: 'azul' }, { row: 5, col: 4, color: 'rojo' }],
  blocks: []
}

const conPrisma = () => {
  const p = crearPiezas(BASE.size)
  p[2][2] = PIEZA.PRISMA
  return p
}

// Trayecto real (comprobado con un script de traza, no viene del brief):
// tronco    (2,0) (2,1) (2,2)                         resultado 'prisma'
// azul 'ne' (2,2) (2,3) (1,3) (1,4) (0,4) (0,5)        resultado 'diana'
// rojo 'se' (2,2) (3,2) (3,3) (4,3) (4,4) (5,4)        resultado 'diana'
//
// El azul pasa una celda extra por la fila 2 -- (2,3) -- antes de subir a la
// fila 1. No es un bug: el punto de arranque de un hijo de prisma es siempre
// ARRANQUE (0.501, 0.502), fijo dentro de la celda. Para la direccion 'ne'
// (dx=1,dy=-1) esto hace que el borde derecho de la celda (a 0.499 de
// distancia) se cruce antes que el borde superior (a 0.502 de distancia),
// asi que el rayo -- que es una linea recta a -45 grados de verdad -- roza
// una celda de mas antes de que el cruce de fila se note en `squaresPath`.
// Para 'se' (dx=1,dy=1) el borde inferior esta mas cerca (0.498 < 0.499) y
// el cambio de fila se ve ya en el segundo punto. Por eso el test comprueba
// "no sigue por la fila 2" a partir del tercer punto (slice(2)) y no del
// segundo: la afirmacion de fondo -- que el hijo gira a 45 grados y no sigue
// recto para siempre -- se sostiene igual, la unica diferencia es cuantas
// celdas tarda en notarse en la discretizacion.
describe('prisma', () => {
  it('un rayo que entra sale como dos, en azul y rojo', () => {
    const c = normalizaConfig(BASE)
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    expect(tramos).toHaveLength(3)          // tronco + dos hijos
    expect(tramos[0].resultado).toBe('prisma')
    expect(tramos.slice(1).map((t) => t.color).sort()).toEqual(['azul', 'rojo'])
  })

  it('los dos hijos salen a 45 grados de la entrada, no rectos', () => {
    const c = normalizaConfig(BASE)
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    // Entrada 'right'; -45 es 'ne' (sube) y +45 es 'se' (baja).
    const [azul, rojo] = tramos.slice(1)
    const finAzul = azul.squaresPath[azul.squaresPath.length - 1]
    const finRojo = rojo.squaresPath[rojo.squaresPath.length - 1]
    expect(finAzul.row).toBeLessThan(2)     // el azul sube
    expect(finRojo.row).toBeGreaterThan(2)  // el rojo baja
    // A partir de la tercera celda ninguno sigue por la fila 2, que es la
    // direccion de entrada (ver comentario de trayectos reales mas arriba:
    // el azul roza una celda extra en la fila 2 antes de girar).
    expect(azul.squaresPath.slice(2).every((p) => p.row !== 2)).toBe(true)
    expect(rojo.squaresPath.slice(2).every((p) => p.row !== 2)).toBe(true)
  })

  it('un rayo ya coloreado que entra en un segundo prisma se corta', () => {
    const c = normalizaConfig(BASE)
    const piezas = conPrisma()
    piezas[1][3] = PIEZA.PRISMA          // en el camino del hijo azul
    const { tramos } = simularHaz(c, piezas, c.lasers[0])
    expect(tramos.some((t) => t.resultado === 'prisma-saturado')).toBe(true)
    // Y no aparecen nietos: el arbol no crece.
    expect(tramos.filter((t) => t.color === 'azul' || t.color === 'rojo')).toHaveLength(2)
  })

  it('la celda del prisma no cuenta como cruce', () => {
    const c = normalizaConfig(BASE)
    const { cruces } = simularTodos(c, conPrisma())
    expect(cruces.has('2,2')).toBe(false)
  })

  it('una diana solo se da por alcanzada por un rayo de su color', () => {
    const c = normalizaConfig({ ...BASE, targets: [{ row: 0, col: 5, color: 'rojo' }, { row: 5, col: 4, color: 'rojo' }] })
    const { tramos } = simularHaz(c, conPrisma(), c.lasers[0])
    const azul = tramos.find((t) => t.color === 'azul')
    // Trayecto determinista (documentado en el informe de la tarea): el hijo
    // azul llega a (0,5), que aqui es diana rojo. Se afirma el trayecto antes
    // de afirmar el resultado para que, si el trazador cambia y deja de pasar
    // por ahi, el test falle en vez de callarse.
    expect(azul.squaresPath.some((p) => p.row === 0 && p.col === 5)).toBe(true)
    expect(azul.resultado).toBe('diana-ajena')
  })
})
