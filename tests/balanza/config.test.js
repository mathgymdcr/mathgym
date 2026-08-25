import { describe, it, expect } from 'vitest'
import {
  leerConfigBalanza,
  VARIANTES_BALANZA,
  balanzaScenarios,
  balanzaMinWeighings
} from '../../scripts/balanza-logic.js'

// El payload de la balanza pasa a estar entero en español -- `variant`
// en kebab y los parámetros como `n_monedas` / `k_impostoras` /
// `max_pesadas` -- pero los retos ya publicados traen las claves viejas
// y tienen que seguir abriendo. `leerConfigBalanza` es el único sitio
// donde se traduce: todo lo demás (generador, validador, plantilla)
// trabaja ya con las nuevas.

describe('leerConfigBalanza', () => {
  it('traduce el payload viejo entero', () => {
    const cfg = leerConfigBalanza({ variant: 'kHeaviest', N: 8, k: 2, maxWeighings: 4 })
    expect(cfg).toMatchObject({
      variant: 'pesadas-multiples', n_monedas: 8, k_impostoras: 2, max_pesadas: 4
    })
  })

  it('deja pasar el payload nuevo tal cual', () => {
    const nuevo = { variant: 'desconocida', n_monedas: 7, k_impostoras: 1, max_pesadas: 3 }
    expect(leerConfigBalanza(nuevo)).toMatchObject(nuevo)
  })

  it('traduce las seis variantes', () => {
    const esperado = {
      oddUnknown: 'desconocida',
      heaviest: 'pesada',
      lightest: 'ligera',
      kHeaviest: 'pesadas-multiples',
      kLightest: 'ligeras-multiples',
      kOddUnknown: 'desconocidas-multiples'
    }
    for (const [viejo, nuevo] of Object.entries(esperado)) {
      expect(leerConfigBalanza({ variant: viejo, N: 6 }).variant).toBe(nuevo)
      expect(VARIANTES_BALANZA).toContain(nuevo)
    }
    expect(VARIANTES_BALANZA.length).toBe(6)
  })

  it('conserva lo que no traduce, como las anomalías', () => {
    const cfg = leerConfigBalanza({ variant: 'heaviest', N: 6, anomalies: [{ i: 2, sign: 1 }] })
    expect(cfg.anomalies).toEqual([{ i: 2, sign: 1 }])
  })

  it('una variante que no existe se queda sin traducir, para que el validador la cace', () => {
    expect(leerConfigBalanza({ variant: 'inventada', N: 6 }).variant).toBe('inventada')
    expect(balanzaScenarios({ variant: 'inventada', n_monedas: 6 })).toBe(null)
  })
})

describe('la cota de pesadas habla el idioma nuevo', () => {
  it('cuenta escenarios con las claves nuevas', () => {
    expect(balanzaScenarios({ variant: 'pesada', n_monedas: 6 })).toBe(6)
    expect(balanzaScenarios({ variant: 'desconocida', n_monedas: 7 })).toBe(14)
    expect(balanzaScenarios({ variant: 'pesadas-multiples', n_monedas: 8, k_impostoras: 2 })).toBe(28)
    expect(balanzaScenarios({ variant: 'desconocidas-multiples', n_monedas: 5, k_impostoras: 2 })).toBe(40)
  })

  it('da el mismo mínimo para el payload viejo y para el nuevo', () => {
    const viejo = { variant: 'kHeaviest', N: 8, k: 2, maxWeighings: 4 }
    expect(balanzaMinWeighings(leerConfigBalanza(viejo))).toBe(4)
    expect(balanzaMinWeighings({ variant: 'pesadas-multiples', n_monedas: 8, k_impostoras: 2 })).toBe(4)
  })
})
