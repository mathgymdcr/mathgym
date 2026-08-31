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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-riego-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

async function generar(seed) {
  return enTemporal(async () => {
    const reto = await new MathGymGenerator().templates['riego-plantas'](seed, 'prueba')
    const payload = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
    reto.data.json_url = path.resolve(reto.data.json_url)
    return { reto, payload }
  })
}

async function retoConPayload(payload) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-riego-'))
  const file = path.join(dir, 'riego.json')
  await fs.writeFile(file, JSON.stringify(payload))
  return { tipo: 'riego-plantas', data: { json_url: file } }
}

const seedIncompatible = async () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = await generar(seed)
    if (g.payload.incompatibles) return g
  }
  throw new Error('ninguna semilla da un riego con incompatibles en 300 intentos')
}

describe('validateRiegoData con incompatibles', () => {
  it('el payload lleva la pareja, y el validador la acepta sin marcarla ambigua', async () => {
    // Antes de arreglarlo, el validador recontaba soluciones SIN pasar
    // `incompatibles`: la pareja podía volver a compartir ciclo en el
    // reconteo y el reto, perfectamente válido, se rechazaba como ambiguo.
    const { reto, payload } = await seedIncompatible()
    expect(payload.incompatibles).toHaveLength(2)
    const validator = new RetoValidator()
    await expect(validator.validateRiegoData(reto)).resolves.toBeUndefined()
  })

  it('rechaza un incompatibles que referencia una planta inexistente', async () => {
    const reto = await retoConPayload({
      cycles: 6,
      capacity: 2,
      incompatibles: ['Fantasma', 'Albahaca'],
      plants: [
        { id: 'Albahaca', doses: 2, ventana: [0, 2, 4] },
        { id: 'Menta', doses: 2, ventana: [1, 3, 5] }
      ]
    })
    await expect(new RetoValidator().validateRiegoData(reto))
      .rejects.toThrow(/incompatibles.*planta inexistente/i)
  })

  it('rechaza incompatibles que no sea un par', async () => {
    const reto = await retoConPayload({
      cycles: 6,
      capacity: 2,
      incompatibles: ['Albahaca'],
      plants: [
        { id: 'Albahaca', doses: 2, ventana: [0, 2, 4] },
        { id: 'Menta', doses: 2, ventana: [1, 3, 5] }
      ]
    })
    await expect(new RetoValidator().validateRiegoData(reto))
      .rejects.toThrow(/incompatibles debe ser un par/i)
  })
})
