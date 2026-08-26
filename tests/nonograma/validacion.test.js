import { describe, it, expect, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'

const cwdOriginal = process.cwd()
afterAll(() => process.chdir(cwdOriginal))

// El generador escribe en rutas relativas, así que se le deja un directorio
// para él solo y se vuelve al de siempre en cuanto termina.
async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-nono-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

async function generar(seed) {
  return enTemporal(async () => {
    const reto = await new MathGymGenerator().templates['nonograma'](seed, 'prueba')
    const payload = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
    // El generador escribe rutas relativas; el validador lo lee ya fuera del
    // directorio temporal, así que se guarda la ruta absoluta.
    reto.data.json_url = path.resolve(reto.data.json_url)
    return { reto, payload }
  })
}

// Un reto escrito a mano, para probar al validador con lo que el generador
// nunca produciría.
async function retoConPayload(payload) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-nono-'))
  const file = path.join(dir, 'nonograma.json')
  await fs.writeFile(file, JSON.stringify(payload))
  return { tipo: 'nonograma', data: { json_url: file } }
}

const seedColor = async () => {
  for (let seed = 0; seed < 30; seed++) {
    const g = await generar(seed)
    if (g.reto.variant.endsWith('-color')) return g
  }
  throw new Error('ninguna semilla da un nonograma en color')
}

describe('el payload del nonograma en color', () => {
  it('lleva la paleta, y el monocromo no', async () => {
    const { payload } = await seedColor()
    expect(payload.paleta.length).toBeGreaterThanOrEqual(2)
    expect(payload.grid.flat().some((v) => v === 2)).toBe(true)

    const mono = await generar(2)   // 10x10, siempre monocromo
    expect(mono.reto.variant).not.toContain('color')
    expect(mono.payload.paleta).toBeUndefined()
  })
})

describe('validateNonogramaData', () => {
  it('acepta lo que escribe el generador, en color y en monocromo', async () => {
    const validator = new RetoValidator()
    for (let seed = 0; seed < 8; seed++) {
      const { reto } = await generar(seed)
      await expect(validator.validateNonogramaData(reto), `seed ${seed}`).resolves.toBeUndefined()
    }
  })

  it('rechaza un color que no está en la paleta', async () => {
    const reto = await retoConPayload({
      rows: 2, cols: 2, paleta: ['#f8c818'], grid: [[1, 2], [0, 1]]
    })
    await expect(new RetoValidator().validateNonogramaData(reto))
      .rejects.toThrow(/paleta/i)
  })

  it('rechaza un dibujo en color ambiguo', async () => {
    // Un solo color repartido en diagonal: la antidiagonal cumple las mismas
    // pistas, así que la plantilla dejaría al jugador sin poder ganar.
    const reto = await retoConPayload({
      rows: 2, cols: 2, paleta: ['#f8c818', '#1788c7'], grid: [[1, 0], [0, 1]]
    })
    await expect(new RetoValidator().validateNonogramaData(reto))
      .rejects.toThrow(/ambiguo/i)
  })
})
