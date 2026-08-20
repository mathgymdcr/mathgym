import { describe, it, expect } from 'vitest'
import { buildRelojesPuzzle, solveRelojes } from '../../scripts/relojes-logic.js'

// Reimplementación independiente del bucle de plantillas/relojes_arena.js:
// tops en SEGUNDOS, un tick baja SIM_SECONDS_PER_TICK a cada reloj con arena
// arriba, y la ronda termina en cuanto uno llega a 0 (se paran todos a la vez).
const SIM_SECONDS_PER_TICK = 2

function reproducir(glasses, pasos, cronoEnRonda) {
  const duraciones = glasses.map(g => g * 60)
  const tops = glasses.map(() => 0)
  let cronoSegundos = 0
  let cronoArrancado = false

  pasos.forEach((paso, ronda) => {
    if (ronda === cronoEnRonda) {
      cronoArrancado = true
      cronoSegundos = 0
    }
    for (const i of paso.voltear || []) {
      tops[i] = duraciones[i] - tops[i]
    }
    if (!tops.some(t => t > 0)) {
      throw new Error(`ronda ${ronda}: ningun reloj corriendo, la plantilla no dejaria pulsar Iniciar`)
    }
    let vaciado = false
    while (!vaciado) {
      if (cronoArrancado) cronoSegundos += SIM_SECONDS_PER_TICK
      for (let i = 0; i < tops.length; i++) {
        if (tops[i] > 0) {
          tops[i] = Math.max(0, tops[i] - SIM_SECONDS_PER_TICK)
          if (tops[i] === 0) vaciado = true
        }
      }
    }
  })

  return cronoSegundos / 60
}

describe('la solucion del solver se reproduce en la simulacion de la plantilla', () => {
  it('mide el objetivo exacto en el clasico de 7 y 11', () => {
    const sol = solveRelojes([7, 11], 15, 'clasico')
    expect(reproducir([7, 11], sol.pasos, sol.cronoEnRonda)).toBe(15)
  })

  it('mide el objetivo exacto en cada puzzle generado', () => {
    for (let seed = 20260301; seed < 20260331; seed++) {
      const p = buildRelojesPuzzle(seed)
      const medido = reproducir(p.glasses, p.solucion.pasos, p.solucion.cronoEnRonda)
      expect(medido, `seed=${seed} glasses=${p.glasses} variant=${p.variant}`).toBe(p.target)
    }
  })

  it('el margen de tolerancia de la plantilla cubre el error de la simulacion', () => {
    for (let seed = 20260401; seed < 20260431; seed++) {
      const p = buildRelojesPuzzle(seed)
      const medido = reproducir(p.glasses, p.solucion.pasos, p.solucion.cronoEnRonda)
      expect(Math.abs(medido - p.target), `seed=${seed}`).toBeLessThanOrEqual(0.25)
    }
  })
})
