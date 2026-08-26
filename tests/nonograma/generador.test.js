import { describe, it, expect } from 'vitest'
import {
  buildNonogramaPuzzle,
  pistasDe,
  pistasColorDe,
  resolverNonograma,
  COLORES_MARCA
} from '../../scripts/nonograma-logic.js'

// El eje de color va en el nombre de la variante, como en los demás tipos.
const esColor = (p) => p.variant.endsWith('-color')

const SEEDS = [20260822, 20260903, 20261212, 20270214, 3, 11, 77, 20280101]

describe('buildNonogramaPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildNonogramaPuzzle(20260822)))
      .toBe(JSON.stringify(buildNonogramaPuzzle(20260822)))
  })

  it('produce siempre un puzzle con solución única', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      const { filas, columnas } = esColor(p) ? pistasColorDe(p.grid) : pistasDe(p.grid)
      const res = resolverNonograma(filas, columnas, { tope: 2 })
      expect(res.soluciones, `seed ${seed} (${p.figura})`).toBe(1)
      expect(res.primera).toEqual(p.grid)
    }
  })

  it('devuelve una rejilla cuadrada coherente con rows/cols y con su paleta', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      const tope = esColor(p) ? p.paleta.length : 1
      expect(p.grid).toHaveLength(p.rows)
      for (const fila of p.grid) {
        expect(fila).toHaveLength(p.cols)
        expect(fila.every((v) => v >= 0 && v <= tope), `seed ${seed}`).toBe(true)
      }
    }
  })

  it('reparte las tres variantes con su tamaño', () => {
    const tamanos = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildNonogramaPuzzle(seed)
      const esperado = { pequeno: 5, medio: 8, grande: 10 }[p.variant.replace('-color', '')]
      expect(esperado, `variante desconocida: ${p.variant}`).toBeDefined()
      expect(p.rows).toBe(esperado)
      expect(p.cols).toBe(esperado)
      tamanos.add(esperado)
    }
    expect([...tamanos].sort((a, b) => a - b)).toEqual([5, 8, 10])
  })

  it('sortea el color en los tamaños pequeños y nunca en el 10x10', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildNonogramaPuzzle(seed)
      vistas.add(p.variant)
      if (p.rows === 10) expect(esColor(p), `seed ${seed}`).toBe(false)
    }
    expect(vistas.has('pequeno-color'), 'ningún 5x5 en color en 30 fechas').toBe(true)
    expect(vistas.has('medio-color'), 'ningún 8x8 en color en 30 fechas').toBe(true)
    expect(vistas.has('pequeno'), 'ningún 5x5 monocromo en 30 fechas').toBe(true)
    expect(vistas.has('medio'), 'ningún 8x8 monocromo en 30 fechas').toBe(true)
  })

  it('el puzzle en color trae su paleta, sacada de los colores de marca', () => {
    const marca = Object.values(COLORES_MARCA)
    let vistos = 0
    for (let seed = 0; seed < 30; seed++) {
      const p = buildNonogramaPuzzle(seed)
      if (!esColor(p)) { expect(p.paleta, `seed ${seed}`).toBeUndefined(); continue }
      vistos++
      expect(p.paleta.length, `seed ${seed}`).toBeGreaterThanOrEqual(2)
      for (const hex of p.paleta) expect(marca, `seed ${seed}`).toContain(hex)
      // Todos los índices de la rejilla existen en la paleta, y todos los
      // colores de la paleta se usan.
      const usados = new Set(p.grid.flat().filter((v) => v > 0))
      expect([...usados].sort(), `seed ${seed}`)
        .toEqual(p.paleta.map((_, i) => i + 1))
    }
    expect(vistos, 'ningún puzzle en color en 30 fechas').toBeGreaterThan(0)
  })

  it('el color sube un punto la dificultad sobre el mismo tamaño', () => {
    // Mismo tamaño y misma necesidad de suponer: lo único que separa las dos
    // dificultades es el eje de color.
    const base = { 5: 2, 8: 3, 10: 4 }
    for (let seed = 0; seed < 30; seed++) {
      const p = buildNonogramaPuzzle(seed)
      const esperada = Math.min(5, base[p.rows] + (esColor(p) ? 1 : 0) + (p.soloLogica ? 0 : 1))
      expect(p.dificultad, `seed ${seed} (${p.variant})`).toBe(esperada)
    }
  })

  it('da una dificultad entre 2 y 5 y dice si hace falta suponer', () => {
    for (const seed of SEEDS) {
      const p = buildNonogramaPuzzle(seed)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(5)
      expect(typeof p.soloLogica).toBe('boolean')
    }
  })

  it('usa figuras distintas para fechas consecutivas del mismo tamaño', () => {
    // Dos retos seguidos con el mismo dibujo se notarían enseguida.
    const figuras = []
    for (let d = 1; d <= 12; d++) figuras.push(buildNonogramaPuzzle(20260800 + d).figura)
    for (let i = 1; i < figuras.length; i++) {
      expect(figuras[i], `posición ${i}`).not.toBe(figuras[i - 1])
    }
  })
})
