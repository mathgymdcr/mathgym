import { describe, it, expect } from 'vitest'
import {
  PALETA,
  comparaCombinacion,
  ejesDeSeed,
  varianteDeSeed,
  buildCodigoSecretoPuzzle
} from '../../scripts/codigo-secreto-logic.js'

describe('comparaCombinacion', () => {
  it('acierto total: todos exactos, ninguno de color', () => {
    const solucion = ['rojo', 'azul', 'verde', 'amarillo']
    expect(comparaCombinacion(solucion, solucion)).toEqual({ exactos: 4, colores: 0 })
  })

  it('ningún color en común', () => {
    expect(comparaCombinacion(
      ['rojo', 'rojo', 'rojo', 'rojo'],
      ['azul', 'azul', 'azul', 'azul']
    )).toEqual({ exactos: 0, colores: 0 })
  })

  it('colores repetidos: cada pin de la solución cuenta como mucho una vez', () => {
    // Ejemplo clásico de Mastermind con repetición: la solución solo tiene
    // un 'rojo' y un 'azul', así que el intento no puede cobrar dos veces
    // por el mismo pin.
    const solucion = ['rojo', 'rojo', 'azul', 'verde']
    const intento = ['azul', 'rojo', 'rojo', 'amarillo']
    // Posición 1 (índice 1) es el único exacto: rojo==rojo.
    // Del resto (azul,rojo,amarillo vs rojo,azul,verde) casan azul y rojo,
    // amarillo no está en el resto de la solución.
    expect(comparaCombinacion(intento, solucion)).toEqual({ exactos: 1, colores: 2 })
  })
})

describe('ejesDeSeed', () => {
  it('siempre produce ejes dentro de los rangos declarados', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { longitud, coloresDisponibles, repeticion } = ejesDeSeed(seed)
      expect([4, 5, 6]).toContain(longitud)
      expect(coloresDisponibles).toBeGreaterThanOrEqual(longitud)
      expect(coloresDisponibles).toBeLessThanOrEqual(longitud + 2)
      expect(coloresDisponibles).toBeLessThanOrEqual(PALETA.length)
      expect(typeof repeticion).toBe('boolean')
    }
  })

  it('varianteDeSeed cubre combinaciones distintas sobre un rango amplio de seeds', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 2000; seed++) vistas.add(varianteDeSeed(seed))
    // 3 longitudes x 3 opciones de colores x 2 (repetición) = 18 como máximo.
    expect(vistas.size).toBeGreaterThan(10)
    expect(vistas.size).toBeLessThanOrEqual(18)
  })
})

describe('buildCodigoSecretoPuzzle', () => {
  it('la solución respeta longitud, paleta permitida y la regla de repetición', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { dificultad, parIntentos, payload } = buildCodigoSecretoPuzzle(seed)
      const { longitud, colores_disponibles, permite_repeticion, solucion } = payload

      expect(solucion).toHaveLength(longitud)
      const paletaValida = new Set(PALETA.slice(0, colores_disponibles))
      for (const color of solucion) expect(paletaValida.has(color)).toBe(true)
      if (!permite_repeticion) expect(new Set(solucion).size).toBe(solucion.length)

      expect(dificultad).toBeGreaterThanOrEqual(1)
      expect(dificultad).toBeLessThanOrEqual(5)
      expect(Number.isInteger(parIntentos)).toBe(true)
      expect(parIntentos).toBeGreaterThan(0)
    }
  })

  it('misma semilla, mismo puzzle (determinista)', () => {
    expect(buildCodigoSecretoPuzzle(12345)).toEqual(buildCodigoSecretoPuzzle(12345))
  })
})
