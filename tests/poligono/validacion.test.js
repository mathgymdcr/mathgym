import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'
import { buildPoligonoPuzzle, VARIANTES } from '../../scripts/poligono-logic.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

async function retoCon(data) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-poli-'))
  const file = path.join(dir, 'poligono.json')
  await fs.writeFile(file, JSON.stringify(data))
  return { tipo: 'poligono-geometrico', data: { json_url: file } }
}

const SEEDS = Array.from({ length: 80 }, (_, i) => 20260101 + i * 5)
const seedDe = (variant) => SEEDS.find((s) => buildPoligonoPuzzle(s).variant === variant)

describe('validatePoligonoData', () => {
  it('acepta lo que escribe el generador en las cinco variantes', async () => {
    for (const variant of VARIANTES) {
      await enTemporal(async () => {
        const r = await new MathGymGenerator().generatePoligono(seedDe(variant), 'v')
        await new RetoValidator().validatePoligonoData(r)
      })
    }
  })

  it('sigue aceptando los payloads publicados, sin n_figuras ni formas', async () => {
    const reto = await retoCon({ area: 15, perimeter: 16, gridSize: 8 })
    await expect(new RetoValidator().validatePoligonoData(reto)).resolves.toBeUndefined()
  })

  it('rechaza un par que ninguna figura alcanza', async () => {
    // Area 12 con perimetro 12: por debajo del minimo, que es 14.
    const reto = await retoCon({ area: 12, perimeter: 12, gridSize: 8, n_figuras: 1, formas: 'convexa' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/alcanzable|imposible/)
  })

  it('rechaza pedir convexa cuando ningun rectangulo da ese par', async () => {
    // Area 11 con perimetro 14: solo lo dan figuras no rectangulares.
    const reto = await retoCon({ area: 11, perimeter: 14, gridSize: 8, n_figuras: 1, formas: 'convexa' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/formas/)
  })

  it('rechaza el reparto ambiguo en dos figuras', async () => {
    // (9,20) con una-de-cada admite TRES repartos -- (3,8)+(6,12),
    // (4,8)+(5,12) y (4,10)+(5,10) -- asi que no hay nada que deducir.
    const reto = await retoCon({ area: 9, perimeter: 20, gridSize: 8, n_figuras: 2, formas: 'una-de-cada' })
    await expect(new RetoValidator().validatePoligonoData(reto)).rejects.toThrow(/reparto/)
  })
})
