import { describe, it, expect } from 'vitest'
import { buildAnillasPuzzle, resolverAnillas, minimoPorFormula } from '../../scripts/anillas-logic.js'

const SEEDS = [20260825, 20260910, 20261101, 20270318, 8, 19, 64, 20280420]

describe('buildAnillasPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildAnillasPuzzle(20260825)))
      .toBe(JSON.stringify(buildAnillasPuzzle(20260825)))
  })

  it('devuelve estados válidos de la longitud declarada', () => {
    for (const seed of SEEDS) {
      const p = buildAnillasPuzzle(seed)
      expect(p.inicial, `seed ${seed}`).toHaveLength(p.rings)
      expect(p.objetivo, `seed ${seed}`).toHaveLength(p.rings)
      expect(p.inicial.every((v) => typeof v === 'boolean')).toBe(true)
      expect(p.objetivo.every((v) => typeof v === 'boolean')).toBe(true)
      expect(p.inicial, `seed ${seed}: ya viene resuelto`).not.toEqual(p.objetivo)
    }
  })

  it('guarda el mínimo real, que coincide con el BFS', () => {
    for (const seed of SEEDS) {
      const p = buildAnillasPuzzle(seed)
      const sol = resolverAnillas(p.inicial, p.objetivo, p.regla)
      expect(sol, `seed ${seed}`).not.toBeNull()
      expect(p.min_movimientos, `seed ${seed}`).toBe(sol.movimientos)
    }
  })

  it('no arranca ni medio resuelto ni clavado en el mínimo clásico', () => {
    for (const seed of SEEDS) {
      const p = buildAnillasPuzzle(seed)
      expect(p.min_movimientos, `seed ${seed}: demasiado fácil`).toBeGreaterThanOrEqual(p.rings + 3)
      if (p.regla === 'clasico' && p.objetivo.every((v) => !v)) {
        const clasico = minimoPorFormula(Array(p.rings).fill(true))
        expect(p.min_movimientos, `seed ${seed}: es el mínimo clásico de siempre`).not.toBe(clasico)
      }
    }
  })

  it('reparte las tres variantes con su regla y su objetivo', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildAnillasPuzzle(seed)
      vistas.add(p.variant)
      expect([4, 5, 6], `seed ${seed}`).toContain(p.rings)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)

      if (p.variant === 'dos-de-golpe') {
        expect(p.regla).toBe('dos-de-golpe')
        expect(p.objetivo.every((v) => !v), 'esta variante suelta todas').toBe(true)
      } else if (p.variant === 'configuracion') {
        expect(p.regla).toBe('clasico')
        expect(p.objetivo.some(Boolean), 'esta variante deja alguna anilla puesta').toBe(true)
      } else {
        expect(p.variant).toBe('clasico')
        expect(p.regla).toBe('clasico')
        expect(p.objetivo.every((v) => !v)).toBe(true)
      }
    }
    expect([...vistas].sort()).toEqual(['clasico', 'configuracion', 'dos-de-golpe'])
  })

  it('no repite siempre el mismo mínimo dentro de una variante', () => {
    for (const resto of [0, 1, 2]) {
      const base = 20260800
      const primero = base + ((resto - (base % 3)) + 3) % 3
      const minimos = new Set()
      for (let k = 0; k < 20; k++) minimos.add(buildAnillasPuzzle(primero + k * 3).min_movimientos)
      expect(minimos.size, `variante ${resto}: siempre ${[...minimos]}`).toBeGreaterThanOrEqual(4)
    }
  })
})
