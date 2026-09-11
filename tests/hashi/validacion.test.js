import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { RetoValidator } from '../../scripts/validate-retos.js'
import { formasDeSeed } from '../../scripts/hashi-logic.js'

const cwdOriginal = process.cwd()

// El generador escribe en rutas relativas, así que se le deja un directorio
// para él solo y se vuelve al de siempre en cuanto termina.
async function enTemporal(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-hashi-'))
  process.chdir(dir)
  try { return await fn() } finally { process.chdir(cwdOriginal) }
}

async function generar(seed) {
  return enTemporal(async () => {
    const reto = await new MathGymGenerator().templates['puentes-hashi'](seed, 'prueba')
    const payload = JSON.parse(await fs.readFile(reto.data.json_url, 'utf8'))
    reto.data.json_url = path.resolve(reto.data.json_url)
    return { reto, payload }
  })
}

async function retoConPayload(payload) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-hashi-'))
  const file = path.join(dir, 'hashi.json')
  await fs.writeFile(file, JSON.stringify(payload))
  return { tipo: 'puentes-hashi', data: { json_url: file } }
}

const seedConFormas = async () => {
  for (let seed = 0; seed < 300; seed++) {
    if (!formasDeSeed(seed)) continue
    const g = await generar(seed)
    return g
  }
  throw new Error('ninguna semilla con formas en 300 intentos')
}

describe('validateHashiData con formas de chip', () => {
  it('el payload lleva al menos una isla con forma, y el validador lo acepta', async () => {
    const { reto, payload } = await seedConFormas()
    expect(payload.islands.some((i) => i.forma)).toBe(true)
    const validator = new RetoValidator()
    await expect(validator.validateHashiData(reto)).resolves.toBeUndefined()
  })

  it('marca formas:true en el payload, igual que incompatibles en riego', async () => {
    const { payload } = await seedConFormas()
    expect(payload.formas).toBe(true)
  })

  it('rechaza una forma cuyo grado no coincide con el fijo de esa forma', async () => {
    // grado 2 en ambas islas: soluble de sobra (puente doble entre las dos),
    // así que el único motivo de rechazo posible es el forma='cuadrado'
    // (que exige grado 4) puesto a mano sobre una isla de grado 2.
    const reto = await retoConPayload({
      rows: 3, cols: 3,
      islands: [
        { row: 0, col: 0, grado: 2, forma: 'cuadrado' },
        { row: 0, col: 2, grado: 2 }
      ]
    })
    await expect(new RetoValidator().validateHashiData(reto))
      .rejects.toThrow(/forma.*grado|grado.*forma/i)
  })

  it('rechaza un valor de forma desconocido', async () => {
    const reto = await retoConPayload({
      rows: 3, cols: 3,
      islands: [
        { row: 0, col: 0, grado: 2, forma: 'estrella' },
        { row: 0, col: 2, grado: 2 }
      ]
    })
    await expect(new RetoValidator().validateHashiData(reto))
      .rejects.toThrow(/forma desconocid/i)
  })
})
