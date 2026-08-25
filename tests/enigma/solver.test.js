import { describe, it, expect } from 'vitest'
import { contarSolucionesDesdePistas } from '../../scripts/einstein-logic.js'

// Las pistas estructuradas son { cA, vA, cB, vB, positiva }: la categoría 0
// es Persona y actúa de ancla (el grupo i contiene siempre la persona i),
// así que un puzzle de `filas` categorías y `casas` grupos tiene
// (casas!)^(filas-1) candidatos.

describe('contarSolucionesDesdePistas: forma explícita', () => {
  it('sin pistas, un 2x2 tiene las dos permutaciones de su única categoría', () => {
    expect(contarSolucionesDesdePistas([], { filas: 2, casas: 2 })).toBe(2)
  })

  it('una pista positiva Persona-Atributo fija el 2x2 entero', () => {
    const pistas = [{ cA: 0, vA: 0, cB: 1, vB: 0, positiva: true }]
    expect(contarSolucionesDesdePistas(pistas, { filas: 2, casas: 2 })).toBe(1)
  })
})

// ---------------------------------------------------------------------
// El solver contra la fuerza bruta. Mismo trato que en láser triangular
// (`espejosMinimos` vs `espejosMinimosExhaustivo`) o en anillas (fórmula
// vs BFS): la implementación rápida solo vale si coincide con la lenta y
// obviamente correcta, sobre puzzles sorteados, no sobre casos elegidos.
// ---------------------------------------------------------------------
import { construirPoolPistas, contarSolucionesExhaustivo } from '../../scripts/einstein-logic.js'

function lcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function solucionAleatoria(filas, casas, rand) {
  const sol = [Array.from({ length: casas }, (_, i) => i)]
  for (let c = 1; c < filas; c++) {
    const p = Array.from({ length: casas }, (_, i) => i)
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    sol.push(p)
  }
  return sol
}

describe('el solver coincide con la enumeración exhaustiva', () => {
  const casos = [
    { forma: { filas: 4, casas: 4 }, semillas: 12 },
    { forma: { filas: 5, casas: 4 }, semillas: 4 },
    { forma: { filas: 4, casas: 5 }, semillas: 2 }
  ]

  for (const { forma, semillas } of casos) {
    it(`sobre subconjuntos de pistas al azar en ${forma.filas}x${forma.casas}`, () => {
      for (let seed = 1; seed <= semillas; seed++) {
        const rand = lcg(seed * 7919)
        const solucion = solucionAleatoria(forma.filas, forma.casas, rand)
        const pool = construirPoolPistas(solucion)
        const sub = pool.filter(() => rand() < 0.35)
        expect(contarSolucionesDesdePistas(sub, forma)).toBe(contarSolucionesExhaustivo(sub, forma))
      }
    })
  }

  it('el pool completo de pistas siempre deja exactamente una solución', () => {
    for (const { forma } of casos) {
      const solucion = solucionAleatoria(forma.filas, forma.casas, lcg(99))
      const pool = construirPoolPistas(solucion)
      expect(contarSolucionesDesdePistas(pool, forma)).toBe(1)
    }
  })
})
