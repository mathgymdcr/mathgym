import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import {
  VARIANTES,
  buildPoligonoPuzzle,
  buildPoligonoHints,
  repartos,
  alcanzable,
  clasifica
} from '../../scripts/poligono-logic.js'

const SEEDS = Array.from({ length: 80 }, (_, i) => 20260101 + i * 5)

describe('buildPoligonoPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(JSON.stringify(buildPoligonoPuzzle(seed)), `seed ${seed}`)
        .toBe(JSON.stringify(buildPoligonoPuzzle(seed)))
    }
  })

  it('publica las cinco variantes a lo largo de los seeds', () => {
    const vistas = new Set(SEEDS.map((s) => buildPoligonoPuzzle(s).variant))
    expect([...vistas].sort()).toEqual([...VARIANTES].sort())
  })

  it('en dos figuras el reparto es unico, que es lo que hay que deducir', () => {
    for (const seed of SEEDS) {
      const { config } = buildPoligonoPuzzle(seed)
      if (config.n_figuras !== 2) continue
      expect(repartos(config.area, config.perimeter, config.formas).length, `seed ${seed}`).toBe(1)
    }
  })

  it('en una figura el par es alcanzable y cumple la forma pedida', () => {
    for (const seed of SEEDS) {
      const { config } = buildPoligonoPuzzle(seed)
      if (config.n_figuras !== 1) continue
      expect(alcanzable(config.area, config.perimeter), `seed ${seed}`).toBe(true)
      const c = clasifica(config.area, config.perimeter)
      expect(config.formas === 'convexa' ? c.convexa : c.concava, `seed ${seed}`).toBe(true)
    }
  })

  it('nunca escribe formas libre: eso es solo para los payloads publicados', () => {
    for (const seed of SEEDS) {
      expect(buildPoligonoPuzzle(seed).config.formas, `seed ${seed}`).not.toBe('libre')
    }
  })

  // El eje muerto que tenia el tipo: configs[seed % 6] quedaba constante
  // dentro de la clase modulo 12 que selectTemplate le asigna, y en 4 anos
  // se publicaba SIEMPRE A=12 P=14. Los seeds sinteticos de arriba recorren
  // todos los residuos y por eso no lo verian.
  it('reparte las variantes sobre las fechas que de verdad tocan poligono', () => {
    const g = new MathGymGenerator()
    const seeds = []
    const d = new Date(Date.UTC(2026, 0, 1))
    for (let i = 0; i < 1460; i++) {
      const seed = g.dateToSeed(d.toISOString().slice(0, 10))
      if (g.selectTemplate(seed) === 'poligono-geometrico') seeds.push(seed)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const vistas = new Set(seeds.map((s) => buildPoligonoPuzzle(s).variant))
    expect([...vistas].sort()).toEqual([...VARIANTES].sort())
  })
})

describe('buildPoligonoHints', () => {
  it('nunca revela el reparto, que es la respuesta', () => {
    for (const seed of SEEDS) {
      const p = buildPoligonoPuzzle(seed)
      if (p.config.n_figuras !== 2) continue
      const texto = buildPoligonoHints(p).join(' ')
      for (const [area, perimetro] of p.solucion) {
        // Con limite de palabra: la pista nombra el TOTAL, y "19 celdas"
        // contiene "9 celdas" como subcadena sin revelar nada.
        expect(texto, `seed ${seed}: area ${area}`).not.toMatch(new RegExp(`(^|\\D)${area} celdas`))
        expect(texto, `seed ${seed}: perimetro ${perimetro}`).not.toMatch(new RegExp(`perímetro ${perimetro}(\\D|$)`))
      }
    }
  })

  it('explica que en esta reticula convexo significa rectangulo', () => {
    const seed = SEEDS.find((s) => buildPoligonoPuzzle(s).config.n_figuras === 2)
    expect(buildPoligonoHints(buildPoligonoPuzzle(seed)).join(' ')).toContain('rectángulo')
  })
})
