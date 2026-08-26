import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'
import { solveMezcla, initialLevelsMezcla } from '../../scripts/mezcla-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-mezcla-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

// Un reto a mano, escrito a un payload temporal, para probar al validador
// con casos que el generador nunca produciría.
async function retoConPayload(payload, objectives) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-mezcla-'))
  const file = path.join(dir, 'mezcla.json')
  await fs.writeFile(file, JSON.stringify(payload))
  return { tipo: 'mezcla-quimica', objectives, data: { json_url: file } }
}

describe('validateMezclaData con varios objetivos', () => {
  it('acepta lo que escribe el generador, con uno y con dos compuestos', async () => {
    for (let seed = 20260901; seed < 20260909; seed++) {
      const reto = await enTemporal(async () => {
        const r = await new MathGymGenerator().generateMezcla(seed, 'v')
        // El validador lee el payload por su ruta relativa, así que se
        // valida dentro del mismo directorio temporal.
        await new RetoValidator().validateMezclaData(r)
        return r
      })
      expect(reto.objectives.parMoves).toBeGreaterThan(0)
    }
  })

  it('rechaza el par de compuestos que sale con el trabajo de uno', async () => {
    // [7,4,3] con dosificador: 4 y 3 son capacidades, o sea llenar y verter.
    const capacities = [7, 4, 3]
    const payload = {
      grifo: true, capacities, targets: [4, 3],
      initialLevels: initialLevelsMezcla(capacities, true)
    }
    const min = solveMezcla(payload)
    const reto = await retoConPayload(payload, { parMoves: min })
    await expect(new RetoValidator().validateMezclaData(reto)).rejects.toThrow(/trivial/i)
  })

  it('rechaza el payload sin ningún objetivo', async () => {
    const capacities = [7, 4, 3]
    const reto = await retoConPayload({
      grifo: true, capacities, initialLevels: initialLevelsMezcla(capacities, true)
    }, { parMoves: 5 })
    await expect(new RetoValidator().validateMezclaData(reto)).rejects.toThrow()
  })

  it('sigue aceptando el payload de un solo objetivo escrito como `target`', async () => {
    const capacities = [7, 4, 3]
    const payload = {
      grifo: true, capacities, target: 5,
      initialLevels: initialLevelsMezcla(capacities, true)
    }
    const reto = await retoConPayload(payload, { parMoves: solveMezcla(payload) })
    await expect(new RetoValidator().validateMezclaData(reto)).resolves.toBeUndefined()
  })

  it('caza el parMoves que no es el mínimo real', async () => {
    const capacities = [7, 4, 3]
    const payload = {
      grifo: true, capacities, targets: [5, 2],
      initialLevels: initialLevelsMezcla(capacities, true)
    }
    const reto = await retoConPayload(payload, { parMoves: solveMezcla(payload) + 1 })
    await expect(new RetoValidator().validateMezclaData(reto)).rejects.toThrow(/parMoves/)
  })
})
