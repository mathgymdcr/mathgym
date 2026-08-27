import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { buildPoligonoPuzzle } from '../../scripts/poligono-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

// El generador ESCRIBE al llamarlo: se le da un directorio temporal para
// no ensuciar el repo.
async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

describe('generatePoligono', () => {
  it('escribe variante, dificultad y pistas, que antes no existian', async () => {
    for (const seed of [20260103, 20260215, 20260620, 20261111]) {
      const reto = await enTemporal(() => new MathGymGenerator().generatePoligono(seed, 'v'))
      const esperado = buildPoligonoPuzzle(seed)
      expect(reto.variant, `seed ${seed}`).toBe(esperado.variant)
      expect(reto.dificultad, `seed ${seed}`).toBe(esperado.dificultad)
      expect(Array.isArray(reto.hints) && reto.hints.length > 0, `seed ${seed}`).toBe(true)
    }
  })

  it('guarda el payload con n_figuras y formas, y sin la solucion', async () => {
    const { reto, data } = await enTemporal(async () => {
      const r = await new MathGymGenerator().generatePoligono(20260103, 'v')
      return { reto: r, data: JSON.parse(await fs.readFile(r.data.json_url, 'utf8')) }
    })
    expect(data.n_figuras).toBeGreaterThanOrEqual(1)
    expect(typeof data.formas).toBe('string')
    expect(data.solucion).toBeUndefined()
    expect(reto.objectives.winCondition).toBe('matching_figure')
  })
})
