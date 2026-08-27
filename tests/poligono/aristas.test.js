import { describe, it, expect } from 'vitest'
import {
  claveArista,
  figurasDeAristas,
  medidasDeFigura
} from '../../scripts/poligono-logic.js'

// Contorno de un rectangulo cuya esquina superior izquierda es (r0,c0) y
// que mide alto x ancho CELDAS.
function rectangulo(r0, c0, alto, ancho) {
  const set = new Set()
  const arista = (r1, c1, r2, c2) => set.add(claveArista({ r: r1, c: c1 }, { r: r2, c: c2 }))
  for (let c = c0; c < c0 + ancho; c++) {
    arista(r0, c, r0, c + 1)
    arista(r0 + alto, c, r0 + alto, c + 1)
  }
  for (let r = r0; r < r0 + alto; r++) {
    arista(r, c0, r + 1, c0)
    arista(r, c0 + ancho, r + 1, c0 + ancho)
  }
  return set
}

describe('claveArista', () => {
  it('da la misma clave en los dos sentidos', () => {
    expect(claveArista({ r: 1, c: 2 }, { r: 1, c: 3 }))
      .toBe(claveArista({ r: 1, c: 3 }, { r: 1, c: 2 }))
  })
})

describe('figurasDeAristas', () => {
  it('reconoce un rectangulo como un unico ciclo', () => {
    const res = figurasDeAristas(rectangulo(0, 0, 3, 4))
    expect(res.invalido).toBe(false)
    expect(res.abiertas).toBe(0)
    expect(res.ciclos.length).toBe(1)
  })

  it('reconoce dos rectangulos separados como dos ciclos', () => {
    const dos = new Set([...rectangulo(0, 0, 3, 4), ...rectangulo(0, 5, 2, 2)])
    expect(figurasDeAristas(dos).ciclos.length).toBe(2)
  })

  it('una cadena abierta es un estado normal, no un error', () => {
    const abierto = rectangulo(0, 0, 3, 4)
    abierto.delete(claveArista({ r: 0, c: 0 }, { r: 0, c: 1 }))
    const res = figurasDeAristas(abierto)
    expect(res.invalido).toBe(false)
    expect(res.ciclos.length).toBe(0)
    expect(res.abiertas).toBe(1)
  })

  it('marca invalido si un nodo llega a grado 3', () => {
    const cruce = rectangulo(0, 0, 3, 4)
    cruce.add(claveArista({ r: 0, c: 1 }, { r: 1, c: 1 }))
    expect(figurasDeAristas(cruce).invalido).toBe(true)
  })
})

describe('medidasDeFigura', () => {
  it('mide el 3x4: area 12, perimetro 14, convexa', () => {
    const [ciclo] = figurasDeAristas(rectangulo(0, 0, 3, 4)).ciclos
    expect(medidasDeFigura(ciclo)).toEqual({ area: 12, perimetro: 14, convexa: true })
  })

  it('mide una L de area 12 y perimetro 16 como concava', () => {
    // Cuadrado 4x4 al que se le quita la esquina inferior derecha 2x2.
    const set = new Set()
    const arista = (r1, c1, r2, c2) => set.add(claveArista({ r: r1, c: c1 }, { r: r2, c: c2 }))
    const contorno = [[0, 0], [0, 4], [2, 4], [2, 2], [4, 2], [4, 0], [0, 0]]
    for (let i = 0; i < contorno.length - 1; i++) {
      const [r1, c1] = contorno[i]
      const [r2, c2] = contorno[i + 1]
      const pasos = Math.abs(r2 - r1) + Math.abs(c2 - c1)
      const dr = Math.sign(r2 - r1)
      const dc = Math.sign(c2 - c1)
      for (let k = 0; k < pasos; k++) {
        arista(r1 + dr * k, c1 + dc * k, r1 + dr * (k + 1), c1 + dc * (k + 1))
      }
    }
    const [ciclo] = figurasDeAristas(set).ciclos
    expect(medidasDeFigura(ciclo)).toEqual({ area: 12, perimetro: 16, convexa: false })
  })
})
