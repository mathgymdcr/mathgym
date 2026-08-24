import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import {
  solveMezcla,
  initialLevelsMezcla,
  CONFIGS_MEZCLA,
  MIN_MOVIMIENTOS_MEZCLA
} from '../../scripts/mezcla-logic.js'

const SEEDS = [20260831, 20260918, 20261210, 20270501, 21, 44, 97, 20280707]
const FECHA = 'test-mezcla'   // el payload va a data/mezcla_test-mezcla.json

const minimoDe = (c, grifo) => solveMezcla({
  grifo,
  capacities: c.capacities,
  target: c.target,
  initialLevels: initialLevelsMezcla(c.capacities, grifo)
})

describe('tabla de configuraciones', () => {
  it('cada eje (3/4 matraces × con/sin dosificador) tiene alguna configuración usable', () => {
    for (const nMatraces of [3, 4]) {
      for (const grifo of [true, false]) {
        const usables = CONFIGS_MEZCLA
          .filter((c) => c.capacities.length === nMatraces)
          .filter((c) => {
            const min = minimoDe(c, grifo)
            return min !== null && min >= MIN_MOVIMIENTOS_MEZCLA
          })
        expect(usables.length, `${nMatraces} matraces, grifo=${grifo}`).toBeGreaterThan(0)
      }
    }
  })

  it('las de 4 matraces (dificultad 3) cuestan más que las de 3 (dificultad 2)', () => {
    // El cuarto matraz abre caminos: si las capacidades no se eligen con
    // cuidado, subir de 3 a 4 hace el reto MÁS fácil en vez de más difícil.
    for (const grifo of [true, false]) {
      const minimos = (n) => CONFIGS_MEZCLA
        .filter((c) => c.capacities.length === n)
        .map((c) => minimoDe(c, grifo))
        .filter((m) => m !== null && m >= MIN_MOVIMIENTOS_MEZCLA)

      const tres = minimos(3)
      const cuatro = minimos(4)
      expect(Math.min(...cuatro), `grifo=${grifo}`).toBeGreaterThanOrEqual(Math.max(...tres))
    }
  })

  it('ninguna capacidad pasa de 12 mL, que es lo que mantiene el BFS instantáneo', () => {
    for (const c of CONFIGS_MEZCLA) {
      for (const cap of c.capacities) expect(cap).toBeLessThanOrEqual(12)
      expect(c.target).toBeLessThan(Math.max(...c.capacities))
    }
  })
})

describe('generateMezcla', () => {
  const generar = async (seed) => {
    const reto = await new MathGymGenerator().generateMezcla(seed, FECHA)
    const payload = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
    return { reto, payload }
  }

  afterAll(async () => {
    await fs.unlink(`data/mezcla_${FECHA}.json`).catch(() => {})
  })

  it('es determinista: el mismo seed da exactamente el mismo reto', async () => {
    const a = await generar(20260831)
    const b = await generar(20260831)
    expect(JSON.stringify(b.payload)).toBe(JSON.stringify(a.payload))
    expect(b.reto.variant).toBe(a.reto.variant)
  })

  it('escribe los ejes como campos propios del payload', async () => {
    for (const seed of SEEDS) {
      const { reto, payload } = await generar(seed)
      expect(typeof payload.grifo, `seed ${seed}`).toBe('boolean')
      expect(payload.capacities.length, `seed ${seed}`).toBeGreaterThanOrEqual(3)
      expect(payload.initialLevels, `seed ${seed}`)
        .toEqual(initialLevelsMezcla(payload.capacities, payload.grifo))
      // La variante es solo la etiqueta compuesta de esos ejes.
      expect(reto.variant, `seed ${seed}`)
        .toBe(`${payload.grifo ? 'con-grifo' : 'sin-grifo'}-${payload.capacities.length}`)
    }
  })

  it('publica el mínimo real y nunca un reto trivial', async () => {
    for (const seed of SEEDS) {
      const { reto, payload } = await generar(seed)
      const min = solveMezcla(payload)
      expect(min, `seed ${seed}`).not.toBeNull()
      expect(min, `seed ${seed}`).toBeGreaterThanOrEqual(MIN_MOVIMIENTOS_MEZCLA)
      expect(reto.objectives.parMoves, `seed ${seed}`).toBe(min)
      expect(reto.hints.join(' '), `seed ${seed}`).toContain(`${min} movimiento`)
    }
  })

  it('la dificultad sigue al número de matraces', async () => {
    for (const seed of SEEDS) {
      const { reto, payload } = await generar(seed)
      expect(reto.dificultad, `seed ${seed}`).toBe(payload.capacities.length === 4 ? 3 : 2)
    }
  })

  it('habla de mililitros, no de litros', async () => {
    for (const seed of SEEDS) {
      const { reto } = await generar(seed)
      const texto = reto.hints.join(' ')
      expect(texto, `seed ${seed}`).toContain('mL')
      expect(texto, `seed ${seed}`).not.toMatch(/\d+\s?L\b/)
    }
  })
})
