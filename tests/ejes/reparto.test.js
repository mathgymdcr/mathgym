import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import * as anillas from '../../scripts/anillas-logic.js'
import * as cajas from '../../scripts/cajas-logic.js'
import * as laser from '../../scripts/laser-triangular-logic.js'
import * as nonograma from '../../scripts/nonograma-logic.js'
import * as hashi from '../../scripts/hashi-logic.js'
import * as riego from '../../scripts/riego-logic.js'

// El fallo que este test existe para impedir:
//
// `selectTemplate` es `templates[seed % 12]`, asi que cada tipo recibe UNA
// clase modulo 12. Cualquier eje elegido con aritmetica sobre el seed queda
// entonces constante dentro de esa clase: `seed % 3` con 3 divisor de 12,
// pero tambien `Math.floor(seed / 3) % 2`, porque los seeds del tipo se
// diferencian en multiplos de 12. Seis tipos publicaban asi una sola
// variante durante anos, con las demas escritas y ningua alcanzable.
//
// Los seeds sinteticos NO lo ven: recorren todos los residuos. Hay que
// barrer las fechas que de verdad le tocan a cada tipo.

const MODULOS = {
  'anillas-encadenadas': anillas,
  'cajas-apiladas': cajas,
  'laser-triangular': laser,
  'nonograma': nonograma,
  'puentes-hashi': hashi,
  'riego-plantas': riego
}

// Cuantas variantes distintas tiene que publicar cada tipo. nonograma tiene
// tres ejes (tamano, espejo y color) y por eso mas combinaciones. laser tiene
// dos ejes (tamano y modo). riego-plantas tambien tiene dos (tamano e
// incompatibilidad de pareja) -- la paridad (solo ciclos pares/impares) no
// cuenta como eje aparte: no la sortea el generador, sale sola del ruido de
// la ventana (ver tests/riego/generador.test.js), asi que no tiene una
// varianteDeSeed que verificar aqui.
const ESPERADAS = {
  'anillas-encadenadas': 3,
  'cajas-apiladas': 3,
  'laser-triangular': 8,
  'nonograma': 5,
  'puentes-hashi': 2,
  'riego-plantas': 6
}

function seedsRealesDe(tipo, dias = 1460) {
  const g = new MathGymGenerator()
  const seeds = []
  const d = new Date(Date.UTC(2026, 0, 1))
  for (let i = 0; i < dias; i++) {
    const seed = g.dateToSeed(d.toISOString().slice(0, 10))
    if (g.selectTemplate(seed) === tipo) seeds.push(seed)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return seeds
}

describe('los ejes de variante estan vivos sobre fechas reales', () => {
  for (const [tipo, mod] of Object.entries(MODULOS)) {
    it(`${tipo} publica al menos ${ESPERADAS[tipo]} variantes`, () => {
      const seeds = seedsRealesDe(tipo)
      expect(seeds.length, `${tipo}: no le toca ninguna fecha`).toBeGreaterThan(20)
      const vistas = new Set(seeds.map((s) => mod.varianteDeSeed(s)))
      expect(vistas.size, `${tipo}: solo ${[...vistas].join(', ')}`)
        .toBeGreaterThanOrEqual(ESPERADAS[tipo])
    })
  }

  it('ningun tipo se queda con una sola variante', () => {
    for (const [tipo, mod] of Object.entries(MODULOS)) {
      const vistas = new Set(seedsRealesDe(tipo).map((s) => mod.varianteDeSeed(s)))
      expect(vistas.size, `${tipo} publica siempre "${[...vistas][0]}"`).toBeGreaterThan(1)
    }
  })
})
