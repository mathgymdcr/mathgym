import { describe, it, expect } from 'vitest'
import { buildLucesPuzzle, buildLucesHints } from '../../scripts/lightsout-logic.js'

const SEEDS = Array.from({ length: 60 }, (_, i) => 20260101 + i * 7)
const porModo = (objetivo) => {
  const seed = SEEDS.find((s) => buildLucesPuzzle(s).modo.objetivo === objetivo)
  const puzzle = buildLucesPuzzle(seed)
  return { puzzle, hints: buildLucesHints(puzzle), texto: buildLucesHints(puzzle).join(' ') }
}

describe('buildLucesHints', () => {
  it('declara el minimo real en los tres modos', () => {
    for (const objetivo of ['all_off', 'all_on', 'pattern_match']) {
      const { puzzle, texto } = porModo(objetivo)
      expect(texto, objetivo).toContain(String(puzzle.minPulsaciones))
    }
  })

  it('enuncia el barrido hacia el objetivo de cada modo, no siempre hacia apagar', () => {
    expect(porModo('all_off').texto).toContain('apagar')
    expect(porModo('all_on').texto).toContain('encender')
    expect(porModo('all_on').texto).not.toContain('apagar definitivamente')
  })

  it('en modo patron dice que solo cuentan las casillas que difieren de la diana', () => {
    expect(porModo('pattern_match').texto).toContain('difieren')
  })

  it('nunca revela el patron objetivo casilla a casilla', () => {
    const { texto } = porModo('pattern_match')
    expect(texto).not.toMatch(/true|false/)
  })
})
