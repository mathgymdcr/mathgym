import { describe, it, expect } from 'vitest'
import {
  aplicarPulsaciones,
  buildPattern,
  buildLucesPuzzle,
  solucionLightsOut,
  solveLightsOut,
  solveLightsOutFor
} from '../../scripts/lightsout-logic.js'

const SEEDS = [20260107, 20260828, 20270314, 7, 91, 1234, 555555]
const apagado = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(false))
const encendido = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(true))

describe('aplicarPulsaciones', () => {
  it('desde tablero apagado coincide con buildPattern (mismo seed, mismas pulsaciones)', () => {
    for (const seed of SEEDS) {
      expect(JSON.stringify(aplicarPulsaciones(apagado(5, 5), seed, 8)), `seed ${seed}`)
        .toBe(JSON.stringify(buildPattern(5, 5, seed, 8)))
    }
  })

  it('no muta el tablero que recibe', () => {
    const original = encendido(4, 4)
    const copia = JSON.stringify(original)
    aplicarPulsaciones(original, 42, 5)
    expect(JSON.stringify(original)).toBe(copia)
  })

  it('deja el resultado siempre resoluble de vuelta al tablero de partida', () => {
    for (const seed of SEEDS) {
      const partida = aplicarPulsaciones(apagado(5, 5), seed * 3 + 1, 11)
      const revuelto = aplicarPulsaciones(partida, seed, 6)
      const min = solveLightsOutFor({
        patron_inicial: revuelto,
        objetivo: 'pattern_match',
        patron_objetivo: partida
      })
      expect(min, `seed ${seed}`).not.toBeNull()
      expect(min, `seed ${seed}`).toBeLessThanOrEqual(6)
    }
  })
})

// Misma regla que press() en plantillas/luces_fuera.js.
function pulsar(board, r, c) {
  const rows = board.length, cols = board[0].length
  for (const [rr, cc] of [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
    if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) board[rr][cc] = !board[rr][cc]
  }
}

describe('solucionLightsOut', () => {
  it('devuelve tantas pulsaciones como dice el minimo, en los tres modos', () => {
    for (const seed of [20260101, 20260108, 20260115, 20260122, 20260129, 20260205, 20260212]) {
      const { modo } = buildLucesPuzzle(seed)
      expect(solucionLightsOut(modo).length, `seed ${seed}`).toBe(solveLightsOutFor(modo))
    }
  })

  it('aplicada al tablero inicial, alcanza de verdad el objetivo', () => {
    for (const seed of [20260101, 20260108, 20260115, 20260122, 20260129, 20260205, 20260212]) {
      const { modo } = buildLucesPuzzle(seed)
      const board = modo.patron_inicial.map((f) => f.slice())
      for (const [r, c] of solucionLightsOut(modo)) pulsar(board, r, c)

      const [rows, cols] = modo.tamano
      const diana = modo.objetivo === 'all_on'
        ? Array.from({ length: rows }, () => Array(cols).fill(true))
        : modo.objetivo === 'pattern_match'
          ? modo.patron_objetivo
          : Array.from({ length: rows }, () => Array(cols).fill(false))

      expect(board.map((f) => f.map(Boolean)), `seed ${seed}`).toEqual(diana.map((f) => f.map(Boolean)))
    }
  })

  it('nunca repite casilla: pulsarla dos veces se anula', () => {
    for (const seed of [20260101, 20260108, 20260115]) {
      const { modo } = buildLucesPuzzle(seed)
      const celdas = solucionLightsOut(modo).map(([r, c]) => `${r},${c}`)
      expect(new Set(celdas).size, `seed ${seed}`).toBe(celdas.length)
    }
  })
})
