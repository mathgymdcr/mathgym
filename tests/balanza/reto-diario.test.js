import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { VARIANTES_BALANZA } from '../../scripts/balanza-logic.js'
import { RetoValidator } from '../../scripts/validate-retos.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function generarEn(fecha) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-balanza-'))
  process.chdir(dir)
  const gen = new MathGymGenerator()
  const reto = await gen.generateBalanza(gen.dateToSeed(fecha), fecha)
  const data = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
  return { reto, data }
}

describe('el reto diario de balanza se escribe en español', () => {
  it('la variante es una de las del catálogo y los parámetros van en español', async () => {
    // Cinco fechas seguidas recorren las cinco configuraciones (seed % 5).
    for (const fecha of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']) {
      const { reto, data } = await generarEn(fecha)
      expect(VARIANTES_BALANZA).toContain(reto.variant)
      expect(data.variant).toBe(reto.variant)
      expect(data.n_monedas).toBeGreaterThanOrEqual(3)
      expect(data.max_pesadas).toBeGreaterThanOrEqual(3)
      // Y ni rastro de las claves viejas.
      expect(data.N).toBeUndefined()
      expect(data.k).toBeUndefined()
      expect(data.maxWeighings).toBeUndefined()
      expect(data.anomalies.length).toBeGreaterThan(0)
    }
  })

  it('salen las cuatro variantes que el generador sortea', async () => {
    const vistas = new Set()
    for (const fecha of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']) {
      vistas.add((await generarEn(fecha)).reto.variant)
    }
    expect([...vistas].sort()).toEqual(['desconocida', 'ligera', 'pesada', 'pesadas-multiples'])
  })

  it('el payload que escribe pasa el validador', async () => {
    const { reto } = await generarEn('2026-09-04')
    await expect(new RetoValidator().validateBalanzaData(reto)).resolves.toBeUndefined()
  })

  it('las pistas siguen dando el mínimo real de pesadas', async () => {
    const { reto } = await generarEn('2026-09-05')
    const minimo = reto.objectives.maxWeighingsFor3Stars
    expect(reto.hints.join(' ')).toContain(String(minimo))
  })
})
