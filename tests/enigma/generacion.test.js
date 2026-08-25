import { describe, it, expect } from 'vitest'
import {
  generarEnigma,
  construirPoolPistas,
  contarSolucionesDesdePistas,
  BANCO_CATEGORIAS,
  BANCO_NOMBRES
} from '../../scripts/einstein-logic.js'

// El tablero se describe como filas x casas, donde las filas incluyen a
// Persona: el 4x4 de siempre son 3 categorías temáticas y 4 casas; el
// 5x5, 4 categorías y 5 casas.
const TAMANOS = ['4x4', '5x4', '4x5', '5x5']

describe('formas del tablero', () => {
  it('cada enigma dice con qué forma se generó y el payload la respeta', () => {
    for (let seed = 20260101; seed < 20260141; seed++) {
      const e = generarEnigma(seed)
      const { filas, casas } = e.meta.forma
      expect(e.meta.tamano).toBe(`${filas}x${casas}`)
      expect(TAMANOS).toContain(e.meta.tamano)

      const cats = Object.keys(e.categories)
      expect(cats.length).toBe(filas)
      for (const c of cats) expect(e.categories[c].length).toBe(casas)

      const personas = Object.keys(e.solution)
      expect(personas.length).toBe(casas)
      for (const p of personas) {
        expect(Object.keys(e.solution[p]).length).toBe(filas - 1)
      }
    }
  })

  it('salen las cuatro, sesgadas al 4x4', () => {
    const cuenta = Object.fromEntries(TAMANOS.map((t) => [t, 0]))
    const N = 240
    for (let seed = 20260101; seed < 20260101 + N; seed++) {
      cuenta[generarEnigma(seed).meta.tamano]++
    }
    for (const t of TAMANOS) expect(cuenta[t]).toBeGreaterThan(0)
    // Pesos 4/2/2/1 sobre 9.
    expect(cuenta['4x4'] / N).toBeGreaterThan(0.33)
    expect(cuenta['4x4'] / N).toBeLessThan(0.56)
    expect(cuenta['5x5'] / N).toBeLessThan(0.18)
    expect(cuenta['4x4']).toBeGreaterThan(cuenta['5x5'])
  })

  it('una categoría de solo 4 valores nunca entra en un tablero de 5 casas', () => {
    const cortas = BANCO_CATEGORIAS.filter((c) => c.valores.length < 5).map((c) => c.nombre)
    expect(cortas).toContain('Estación')   // solo hay cuatro estaciones
    for (let seed = 20260101; seed < 20260201; seed++) {
      const e = generarEnigma(seed)
      if (e.meta.forma.casas < 5) continue
      for (const nombre of e.meta.categoriasElegidas) {
        expect(cortas).not.toContain(nombre)
      }
    }
  })

  it('el banco da de sí para cinco casas', () => {
    expect(BANCO_CATEGORIAS.filter((c) => c.valores.length >= 5).length).toBeGreaterThanOrEqual(5)
    for (const terna of BANCO_NOMBRES) expect(terna.length).toBeGreaterThanOrEqual(5)
    for (const cat of BANCO_CATEGORIAS) {
      expect(new Set(cat.valores).size).toBe(cat.valores.length)
    }
  })
})

describe('unicidad', () => {
  it('todo enigma generado tiene exactamente una solución', () => {
    for (let seed = 20260301; seed < 20260331; seed++) {
      const e = generarEnigma(seed)
      expect(e.meta.numSoluciones).toBe(1)
      expect(contarSolucionesDesdePistas(e.meta.pistasEstructuradas, e.meta.forma)).toBe(1)
    }
  })

  it('quitar una pista cualquiera del puzzle publicado rompe la unicidad', () => {
    // La poda deja el puzzle irreducible salvo por el ancla protegida.
    const e = generarEnigma(20260415)
    const pistas = e.meta.pistasEstructuradas
    let irreducibles = 0
    for (let i = 0; i < pistas.length; i++) {
      const sin = pistas.filter((_, k) => k !== i)
      if (contarSolucionesDesdePistas(sin, e.meta.forma, 2) > 1) irreducibles++
    }
    expect(irreducibles).toBeGreaterThanOrEqual(pistas.length - 1)
  })
})

// ---------------------------------------------------------------------
// Dificultad. Sigue saliendo del nº de pistas -- menos pistas, más
// difícil -- pero medido contra la horquilla de SU tamaño: un 5x5 con 15
// pistas no es un paseo por traer más pistas que un 4x4 con 12.
// ---------------------------------------------------------------------
import { dificultadDe } from '../../scripts/einstein-logic.js'

describe('dificultadDe', () => {
  it('el 4x4 conserva la tabla de siempre', () => {
    expect(dificultadDe('4x4', 7)).toBe(4)
    expect(dificultadDe('4x4', 9)).toBe(4)
    expect(dificultadDe('4x4', 10)).toBe(3)
    expect(dificultadDe('4x4', 11)).toBe(3)
    expect(dificultadDe('4x4', 12)).toBe(2)
    expect(dificultadDe('4x4', 15)).toBe(2)
  })

  it('a igual número de pistas, un tablero mayor nunca sale más fácil', () => {
    for (let pistas = 7; pistas <= 26; pistas++) {
      expect(dificultadDe('5x4', pistas)).toBeGreaterThanOrEqual(dificultadDe('4x4', pistas))
      expect(dificultadDe('5x5', pistas)).toBeGreaterThanOrEqual(dificultadDe('5x4', pistas))
      expect(dificultadDe('5x5', pistas)).toBeGreaterThanOrEqual(dificultadDe('4x5', pistas))
    }
  })

  it('el 5x5 nunca baja de 4 y nada se sale de la escala 1-5', () => {
    for (let pistas = 10; pistas <= 30; pistas++) {
      expect(dificultadDe('5x5', pistas)).toBeGreaterThanOrEqual(4)
      for (const t of TAMANOS) {
        const d = dificultadDe(t, pistas)
        expect(d).toBeGreaterThanOrEqual(1)
        expect(d).toBeLessThanOrEqual(5)
      }
    }
  })

  it('dentro de cada tamaño, más pistas nunca sube la dificultad', () => {
    for (const t of TAMANOS) {
      for (let pistas = 7; pistas < 30; pistas++) {
        expect(dificultadDe(t, pistas + 1)).toBeLessThanOrEqual(dificultadDe(t, pistas))
      }
    }
  })
})
