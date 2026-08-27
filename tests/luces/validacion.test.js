import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'
import { buildLucesPuzzle } from '../../scripts/lightsout-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-luces-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

// Un reto a mano, para probar al validador con casos que el generador
// nunca produciría.
async function retoConModo(modo, objectives) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-luces-'))
  const file = path.join(dir, 'luces.json')
  await fs.writeFile(file, JSON.stringify({ modos: [modo] }))
  return { tipo: 'luces-fuera', objectives, data: { json_url: file } }
}

const SEEDS = Array.from({ length: 60 }, (_, i) => 20260101 + i * 7)
const seedDe = (objetivo) => SEEDS.find((s) => buildLucesPuzzle(s).modo.objetivo === objetivo)

describe('validateLucesData', () => {
  it('acepta lo que escribe el generador en los tres modos', async () => {
    for (const objetivo of ['all_off', 'all_on', 'pattern_match']) {
      const reto = await enTemporal(async () => {
        const r = await new MathGymGenerator().generateLuces(seedDe(objetivo), 'v')
        await new RetoValidator().validateLucesData(r)
        return r
      })
      expect(reto.objectives.winCondition, objetivo).toBe(objetivo)
    }
  })

  it('rechaza un parMoves que no sea el minimo real', async () => {
    const { modo, minPulsaciones } = buildLucesPuzzle(seedDe('pattern_match'))
    const reto = await retoConModo(modo, { parMoves: minPulsaciones + 1 })
    await expect(new RetoValidator().validateLucesData(reto)).rejects.toThrow(/parMoves/)
  })

  it('rechaza un patron_objetivo que no case con el tamano', async () => {
    const { modo } = buildLucesPuzzle(seedDe('pattern_match'))
    const roto = { ...modo, patron_objetivo: modo.patron_objetivo.slice(0, -1) }
    const reto = await retoConModo(roto, { parMoves: modo.min_pulsaciones })
    await expect(new RetoValidator().validateLucesData(reto)).rejects.toThrow(/patron_objetivo/)
  })
})
