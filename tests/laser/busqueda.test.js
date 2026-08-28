import { describe, it, expect } from 'vitest'
import { resolverPiezas, piezasMinimas, piezasMinimasExhaustivo, normalizaConfig, resuelto, PIEZA, simularTodos, crearPiezas } from '../../scripts/laser-triangular-logic.js'

const CLASICO = normalizaConfig({
  size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: []
})

// Un solo emisor y dos dianas: solo un prisma puede partir el rayo en dos.
const DOS_DIANAS = {
  size: 6,
  lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
  targets: [{ row: 0, col: 5, color: 'azul' }, { row: 5, col: 4, color: 'rojo' }],
  blocks: []
}

// 7x7 sin solucion con 3 piezas: los dos rayos salen de la columna 0 hacia
// las esquinas contrarias y no hay forma de cruzarlos sin que compartan celda.
const SIN_SOLUCION = normalizaConfig({
  size: 7,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 6, col: 6 } },
    { emitter: { row: 6, col: 0, dir: 'up' }, target: { row: 0, col: 6 } }
  ],
  blocks: []
})

describe('busqueda de minimos', () => {
  it('encuentra una colocacion que resuelve de verdad', () => {
    const sol = resolverPiezas(CLASICO, 3)
    expect(sol).not.toBeNull()
    expect(resuelto(CLASICO, sol.piezas)).toBe(true)
  })

  it('en clasico nunca propone prisma ni condensador', () => {
    const sol = resolverPiezas(CLASICO, 3)
    const usadas = sol.piezas.flat().filter(Boolean)
    expect(usadas.includes(PIEZA.PRISMA)).toBe(false)
    expect(usadas.includes(PIEZA.CONDENSADOR)).toBe(false)
  })

  it('la version podada y la exhaustiva dan el mismo minimo', () => {
    expect(piezasMinimas(CLASICO, 3)).toBe(piezasMinimasExhaustivo(CLASICO, 3))
  })

  // Este es el test que muere si `resolverPiezas` deja de filtrar por
  // `tiposDisponibles(c.modo)`. El de arriba ("nunca propone prisma ni
  // condensador") no: pasa por el orden del DFS -- los espejos van primero en
  // la bandeja -- y sigue en verde sin filtro. Aqui un solo rayo tiene que
  // llegar a DOS dianas, que sin prisma es imposible con cualquier numero de
  // espejos: en clasico el minimo es null y en prisma es 1. Sin el filtro, el
  // clasico encontraria la solucion de prisma y este test fallaria.
  it('en clasico no hay prisma ni cuando es la unica salida', () => {
    expect(piezasMinimas({ ...DOS_DIANAS, modo: 'clasico' }, 2)).toBeNull()
    const conPrisma = resolverPiezas({ ...DOS_DIANAS, modo: 'prisma' }, 2)
    expect(conPrisma).not.toBeNull()
    expect(conPrisma.piezas.flat().filter(Boolean)).toEqual([PIEZA.PRISMA])
  })

  // El caso caro de verdad: el tablero mas grande que publica el tipo, en el
  // modo con las seis piezas, y SIN solucion -- que es justo lo que el
  // generador comprueba en cada intento al llamar a piezasMinimas(config,
  // total - 1) para descartar un par mas corto. Medir el camino feliz no
  // valdria: se resuelve con dos piezas en 50 ms y no toca el peor caso.
  // El tope no puede ser en milisegundos: medido en un proceso solo la
  // busqueda tarda 1,6 s, pero `npm test` reparte la suite entre varios
  // workers y bajo esa carga la MISMA llamada tarda 4,3 s. Un limite
  // suficientemente ajustado para detectar la regresion no sobrevive a la
  // carga, y uno que la sobrevive ya no detecta nada.
  //
  // Asi que se mide el TRABAJO, no el tiempo: `simularTodos` es lo que la
  // busqueda paga en cada nodo, asi que el cociente entre las dos medidas es
  // en la practica "cuantas simulaciones de tablero le costo", en unidades
  // que no dependen de la maquina. La carga multiplica las dos mitades por
  // igual: medido, el cociente es 4,4 en un proceso solo y 3,6-4,3 con
  // cuatro procesos compitiendo, mientras que la version anterior a la
  // optimizacion que este test protege estaba en 7,3.
  it('el caso sin solucion en 7x7 con seis piezas no dispara el trabajo', () => {
    const prisma = { ...SIN_SOLUCION, modo: 'prisma' }
    const piezas = crearPiezas(7)
    piezas[3][3] = PIEZA.SLASH
    piezas[2][4] = PIEZA.BACKSLASH
    piezas[4][2] = PIEZA.PRISMA

    const N = 20000
    const t0 = Date.now()
    for (let i = 0; i < N; i++) simularTodos(prisma, piezas)
    const referencia = Date.now() - t0

    const t1 = Date.now()
    expect(piezasMinimas(prisma, 3)).toBeNull()
    const busqueda = Date.now() - t1

    expect(busqueda / referencia, `la busqueda cuesta ${(busqueda / referencia).toFixed(1)} veces la referencia de ${N} trazados`).toBeLessThan(6)
  })
})
