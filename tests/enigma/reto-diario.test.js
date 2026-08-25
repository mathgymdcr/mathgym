import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { dificultadDe } from '../../scripts/einstein-logic.js'
import { RetoValidator } from '../../scripts/validate-retos.js'

// generateEinstein escribe su payload en data/ relativo al cwd, así que
// el test se lleva el cwd a un directorio temporal y lo devuelve al
// terminar: nada de esto toca el repo.
const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function generarEn(fecha) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-diario-'))
  process.chdir(dir)
  const reto = await new MathGymGenerator().generateEinstein(
    new MathGymGenerator().dateToSeed(fecha), fecha
  )
  return { reto, dir }
}

describe('el reto diario de enigma lleva el tamaño consigo', () => {
  it('la variante empieza por el tamaño y la dificultad sale de su tabla', async () => {
    for (const fecha of ['2026-09-01', '2026-09-07', '2026-10-11', '2026-11-23']) {
      const { reto } = await generarEn(fecha)
      const tamano = reto.variant.split('-')[0]
      expect(['4x4', '5x4', '4x5', '5x5']).toContain(tamano)
      expect(reto.dificultad).toBe(dificultadDe(tamano, reto.objectives.numPistas))
      // Y las categorías siguen ahí detrás, una por fila temática.
      const partes = reto.variant.split('-')
      expect(partes.length).toBe(1 + Number(tamano[0]) - 1)
    }
  })

  it('el payload que escribe pasa el validador', async () => {
    const { reto, dir } = await generarEn('2026-12-05')
    process.chdir(dir)
    await expect(new RetoValidator().validateEinsteinData(reto)).resolves.toBeUndefined()
    const data = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
    expect(data.meta.tamano).toBe(reto.variant.split('-')[0])
    expect(Object.keys(data.categories).length).toBe(data.meta.forma.filas)
  })

  it('las pistas de ayuda dicen de qué tamaño es el tablero', async () => {
    const { reto } = await generarEn('2026-09-07')
    expect(reto.hints.join(' ')).toContain(reto.variant.split('-')[0])
  })
})
