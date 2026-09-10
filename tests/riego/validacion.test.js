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

describe('validateRiegoData exige margen por planta, no por suma total', () => {
  it('rechaza una planta con holgura cero aunque la suma total cumpliera antes', async () => {
    // REGRESIÓN: el código anterior sumaba holgura total; pasaba si suma >= num_plantas.
    // El nuevo código verifica cada planta por separado; rechaza si alguna tiene
    // holgura < MARGEN_MINIMO[variant] (1 para huerto/invernadero/vivero).
    //
    // Este payload tiene una solución ÚNICA (requiere descanso para forzar Menta):
    // - Helecho: 1 dose, ventana [6] → holgura 0, FORZADA al ciclo 6
    // - Menta: 3 doses, ventana [0,1,2,3,4] → holgura 2, pero el descanso (gap>=2)
    //   obliga a {0,2,4}, la única forma de poner 3 dosis no-consecutivas en 5 ciclos.
    //
    // CONTRASTE DE LA REGRESIÓN:
    // - Suma total: 0 + 2 = 2, plantas: 2 → viejo check: 2 < 2? FALSE → PASA (bug)
    // - Por planta: Helecho 0 < 1 → RECHAZA, nombrando Helecho (correcto)
    const reto = await retoConPayload({
      cycles: 7, capacity: 1,
      plants: [
        { id: 'Helecho', doses: 1, ventana: [6] },           // holgura 0 - VIOLA piso
        { id: 'Menta', doses: 3, ventana: [0, 1, 2, 3, 4] }  // holgura 2 - cumple
      ]
    })
    await expect(new RetoValidator().validateRiegoData(reto))
      .rejects.toThrow(/sin margen.*Helecho/i)
  })
})
