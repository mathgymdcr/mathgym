import { describe, it, expect } from 'vitest'
import {
  rachasColor,
  pistasColorDe,
  resolverNonograma,
  colocacionesDeLinea
} from '../../scripts/nonograma-logic.js'

// En un nonograma en color un bloque no es solo una tira de celdas pintadas:
// es una tira del MISMO color. Dos colores pegados son dos bloques, aunque no
// haya hueco entre ellos -- y eso es justo lo que hace legibles las pistas.

describe('rachasColor', () => {
  it('parte en dos bloques al cambiar de color, aunque no haya hueco', () => {
    expect(rachasColor([1, 1, 2, 2, 2])).toEqual([{ n: 2, color: 1 }, { n: 3, color: 2 }])
  })

  it('un hueco parte el bloque aunque el color sea el mismo', () => {
    expect(rachasColor([1, 1, 0, 1])).toEqual([{ n: 2, color: 1 }, { n: 1, color: 1 }])
  })

  it('la línea vacía no tiene bloques', () => {
    expect(rachasColor([0, 0, 0])).toEqual([])
  })
})

describe('pistasColorDe', () => {
  it('saca las pistas con color de filas y columnas', () => {
    const grid = [
      [1, 2, 0],
      [0, 2, 2]
    ]
    expect(pistasColorDe(grid)).toEqual({
      filas: [
        [{ n: 1, color: 1 }, { n: 1, color: 2 }],
        [{ n: 2, color: 2 }]
      ],
      columnas: [
        [{ n: 1, color: 1 }],
        [{ n: 2, color: 2 }],
        [{ n: 1, color: 2 }]
      ]
    })
  })
})

// Rejillas en color escritas como dibujos: '.' vacía, 'a'/'b'/'c' los colores.
const parseColor = (filas) =>
  filas.map((f) => [...f].map((ch) => (ch === '.' ? 0 : ch.charCodeAt(0) - 96)))

describe('resolverNonograma en color', () => {
  it('deja pegados dos bloques de colores distintos', () => {
    // 2a 3b en cinco celdas: solo cabe si van pegados, sin hueco.
    const grid = parseColor(['aabbb'])
    const { filas, columnas } = pistasColorDe(grid)
    const res = resolverNonograma(filas, columnas)
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual(grid)
  })

  it('sigue exigiendo hueco entre dos bloques del mismo color', () => {
    // 2a 2a no cabe en cuatro celdas: el hueco obligatorio pide una quinta.
    const fila = [[{ n: 2, color: 1 }, { n: 2, color: 1 }]]
    const cuatro = [[{ n: 1, color: 1 }], [{ n: 1, color: 1 }], [{ n: 1, color: 1 }], [{ n: 1, color: 1 }]]
    expect(resolverNonograma(fila, cuatro).soluciones).toBe(0)
  })

  it('con una celda más, los dos bloques del mismo color caben separados', () => {
    const grid = parseColor(['aa.aa'])
    const { filas, columnas } = pistasColorDe(grid)
    const res = resolverNonograma(filas, columnas)
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual(grid)
  })

  it('distingue dos dibujos que en monocromo serían el mismo', () => {
    // Las mismas rachas, distinto reparto de color: si el solver ignorara el
    // color, estas pistas admitirían las dos rejillas y no serían únicas.
    const grid = parseColor(['ab', 'ba'])
    const { filas, columnas } = pistasColorDe(grid)
    const res = resolverNonograma(filas, columnas)
    expect(res.soluciones).toBe(1)
    expect(res.primera).toEqual(grid)
  })
})

// La regla de contacto vive en el colocador de líneas: es lo que decide qué
// deduce el solver sin adivinar. Contarla por el número de soluciones no
// sirve -- la comprobación final descarta igualmente las rejillas ilegales --,
// así que se prueba aquí, en la operación básica.
const DESCONOCIDA = -1
const enBlanco = (n) => new Array(n).fill(DESCONOCIDA)

describe('colocacionesDeLinea', () => {
  it('no coloca dos bloques del mismo color sin hueco entre ellos', () => {
    const dos = [{ n: 2, color: 1 }, { n: 2, color: 1 }]
    expect(colocacionesDeLinea(dos, 4, enBlanco(4))).toEqual([])
    expect(colocacionesDeLinea(dos, 5, enBlanco(5))).toEqual([[1, 1, 0, 1, 1]])
  })

  it('coloca dos colores distintos pegados y también separados', () => {
    const mixto = [{ n: 1, color: 1 }, { n: 1, color: 2 }]
    expect(colocacionesDeLinea(mixto, 2, enBlanco(2))).toEqual([[1, 2]])
    expect(colocacionesDeLinea(mixto, 3, enBlanco(3))).toEqual([
      [1, 2, 0],
      [1, 0, 2],
      [0, 1, 2]
    ])
  })

  it('respeta lo que ya se sabe de la línea', () => {
    const uno = [{ n: 1, color: 1 }]
    const estado = [DESCONOCIDA, 0, DESCONOCIDA]
    expect(colocacionesDeLinea(uno, 3, estado)).toEqual([[1, 0, 0], [0, 0, 1]])
  })
})
