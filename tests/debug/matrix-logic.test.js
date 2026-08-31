import { describe, it, expect } from 'vitest'
import { descubreVariantes } from '../../scripts/debug-matrix-logic.js'

describe('descubreVariantes', () => {
  it('se queda con la primera semilla de cada variante distinta', async () => {
    const generar = async (seed) => ({ variant: seed % 3 === 0 ? 'a' : 'b', seed })

    const encontradas = await descubreVariantes(generar)

    expect(encontradas).toEqual([
      { seed: 0, variant: 'a' },
      { seed: 1, variant: 'b' }
    ])
  })

  it('para en cuanto encuentra maxVariantes distintas, sin seguir escaneando', async () => {
    let llamadas = 0
    const generar = async (seed) => { llamadas++; return { variant: `v${seed}`, seed } }

    const encontradas = await descubreVariantes(generar, { maxVariantes: 2, maxSeeds: 1000 })

    expect(encontradas).toHaveLength(2)
    expect(llamadas).toBe(2)
  })

  it('para en maxSeeds aunque no haya alcanzado maxVariantes', async () => {
    const generar = async (seed) => ({ variant: `v${seed}`, seed })

    const encontradas = await descubreVariantes(generar, { maxVariantes: 100, maxSeeds: 5 })

    expect(encontradas).toHaveLength(5)
  })

  it('para tras muchas semillas seguidas sin variante nueva, sin llegar a maxSeeds', async () => {
    // Solo 2 variantes posibles de verdad (como hashi): seguir mil semillas
    // más no va a descubrir una tercera que no existe.
    let llamadas = 0
    const generar = async (seed) => { llamadas++; return { variant: seed % 2 === 0 ? 'a' : 'b', seed } }

    const encontradas = await descubreVariantes(generar, { maxSeeds: 5000, maxSinNuevas: 20 })

    expect(encontradas).toEqual([{ seed: 0, variant: 'a' }, { seed: 1, variant: 'b' }])
    expect(llamadas).toBe(22)
  })
})
