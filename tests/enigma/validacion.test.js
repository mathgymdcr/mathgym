import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { generarEnigma, TAMANOS } from '../../scripts/einstein-logic.js'
import { RetoValidator } from '../../scripts/validate-retos.js'

// El validador no se fía del generador: recalcula la unicidad sobre el
// archivo publicado. Con cuatro formas de tablero, lo que antes daba por
// hecho (4 categorías de 4 valores) pasa a leerse del propio payload.

async function payloadTemporal(enigma) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-enigma-'))
  const file = path.join(dir, 'enigma.json')
  await fs.writeFile(file, JSON.stringify({
    categories: enigma.categories,
    clues: enigma.clues,
    solution: enigma.solution,
    meta: {
      tamano: enigma.meta.tamano,
      forma: enigma.meta.forma,
      categoriasElegidas: enigma.meta.categoriasElegidas,
      pistasEstructuradas: enigma.meta.pistasEstructuradas
    }
  }))
  return file
}

describe('validateEinsteinData con las cuatro formas', () => {
  for (const { filas, casas } of TAMANOS) {
    it(`acepta un ${filas}x${casas} recién generado`, async () => {
      const enigma = generarEnigma(20260707, { filas, casas })
      expect(enigma.meta.tamano).toBe(`${filas}x${casas}`)
      const reto = { tipo: 'enigma-einstein', data: { json_url: await payloadTemporal(enigma) } }
      await expect(new RetoValidator().validateEinsteinData(reto)).resolves.toBeUndefined()
    })
  }

  it('rechaza un puzzle cuyas pistas admiten más de una solución', async () => {
    const enigma = generarEnigma(20260707, { filas: 5, casas: 5 })
    // Quitar dos pistas de un puzzle irreducible lo vuelve ambiguo.
    enigma.meta.pistasEstructuradas = enigma.meta.pistasEstructuradas.slice(0, -2)
    enigma.clues = enigma.clues.slice(0, -2)
    const reto = { tipo: 'enigma-einstein', data: { json_url: await payloadTemporal(enigma) } }
    await expect(new RetoValidator().validateEinsteinData(reto)).rejects.toThrow(/solución única/)
  })

  it('rechaza un payload cuya forma declarada no cuadra con el tablero', async () => {
    const enigma = generarEnigma(20260707, { filas: 4, casas: 4 })
    enigma.meta.forma = { filas: 5, casas: 5 }
    enigma.meta.tamano = '5x5'
    const reto = { tipo: 'enigma-einstein', data: { json_url: await payloadTemporal(enigma) } }
    await expect(new RetoValidator().validateEinsteinData(reto)).rejects.toThrow(/forma/i)
  })

  it('rechaza categorías con distinto número de valores', async () => {
    const enigma = generarEnigma(20260707, { filas: 4, casas: 4 })
    const primera = Object.keys(enigma.categories)[1]
    enigma.categories[primera] = enigma.categories[primera].slice(0, 3)
    const reto = { tipo: 'enigma-einstein', data: { json_url: await payloadTemporal(enigma) } }
    await expect(new RetoValidator().validateEinsteinData(reto)).rejects.toThrow()
  })
})
