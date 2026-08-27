import { describe, it, expect } from 'vitest'
import { buildLucesPuzzle, solveLightsOutFor } from '../../scripts/lightsout-logic.js'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'

// Rango ancho de seeds: el eje de modo se deriva del seed, así que hacen
// falta bastantes para ver las tres opciones y sus cruces con el tamaño.
const SEEDS = Array.from({ length: 60 }, (_, i) => 20260101 + i * 7)

describe('buildLucesPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(JSON.stringify(buildLucesPuzzle(seed)), `seed ${seed}`)
        .toBe(JSON.stringify(buildLucesPuzzle(seed)))
    }
  })

  it('publica los tres objetivos a lo largo de los seeds', () => {
    const vistos = new Set(SEEDS.map((s) => buildLucesPuzzle(s).modo.objetivo))
    expect([...vistos].sort()).toEqual(['all_off', 'all_on', 'pattern_match'])
  })

  it('declara el minimo real, y nunca un reto que venga ya resuelto', () => {
    for (const seed of SEEDS) {
      const p = buildLucesPuzzle(seed)
      expect(p.minPulsaciones, `seed ${seed}`).toBe(solveLightsOutFor(p.modo))
      expect(p.minPulsaciones, `seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('lleva patron_objetivo solo en modo patron, y con el tamano del tablero', () => {
    for (const seed of SEEDS) {
      const { modo } = buildLucesPuzzle(seed)
      const [rows, cols] = modo.tamano
      if (modo.objetivo === 'pattern_match') {
        expect(Array.isArray(modo.patron_objetivo), `seed ${seed}`).toBe(true)
        expect(modo.patron_objetivo.length, `seed ${seed}`).toBe(rows)
        expect(modo.patron_objetivo.every((f) => f.length === cols), `seed ${seed}`).toBe(true)
      } else {
        expect(modo.patron_objetivo, `seed ${seed}`).toBeUndefined()
      }
    }
  })
})

describe('buildLucesPuzzle: eje de modo', () => {
  // Sin guarda, el azar saca a veces una diana todo-apagada o
  // todo-encendida: eso no es "reproduce este patrón", es otro modo
  // disfrazado, con el objetivo mintiendo sobre qué reto es. Estos dos
  // seeds la producían (hallados barriendo 4M).
  it('en modo patron la diana nunca es todo apagado ni todo encendido', () => {
    for (const seed of [36891, 347439, 1100103, 1713768, 2775123, ...SEEDS]) {
      const { modo } = buildLucesPuzzle(seed)
      if (modo.objetivo !== 'pattern_match') continue
      const plano = modo.patron_objetivo.flat()
      expect(plano.some((v) => v), `seed ${seed}: diana todo apagada`).toBe(true)
      expect(plano.some((v) => !v), `seed ${seed}: diana todo encendida`).toBe(true)
    }
  })

  it('compone la variante con los dos ejes, y coincide con lo emitido', () => {
    const sufijos = { all_off: 'apagar', all_on: 'encender', pattern_match: 'patron' }
    for (const seed of SEEDS) {
      const p = buildLucesPuzzle(seed)
      expect(p.variant, `seed ${seed}`).toBe(`${p.rows}x${p.cols}-${sufijos[p.modo.objetivo]}`)
    }
  })

  it('cruza los dos ejes de verdad: salen las nueve combinaciones', () => {
    const vistas = new Set(SEEDS.map((s) => buildLucesPuzzle(s).variant))
    expect(vistas.size).toBe(9)
  })

  it('saca la dificultad del tamano, no del modo', () => {
    const esperada = { 4: 2, 5: 3, 6: 4 }
    for (const seed of SEEDS) {
      const p = buildLucesPuzzle(seed)
      expect(p.dificultad, `seed ${seed}`).toBe(esperada[p.rows])
    }
  })
})

// Los seeds sintéticos de arriba recorren todos los residuos, pero el
// generador solo llama a luces-fuera para los seeds que selectTemplate le
// asigna -- y esos son una única clase módulo el número de tipos. Si el
// tamaño se eligiera con `seed % 3`, quedaría clavado para siempre en un
// solo tablero: es lo que pasaba, todos los retos publicados eran 5x5.
describe('buildLucesPuzzle sobre las fechas que de verdad tocan luces', () => {
  const seedsReales = () => {
    const g = new MathGymGenerator()
    const seeds = []
    const d = new Date(Date.UTC(2026, 0, 1))
    for (let i = 0; i < 730; i++) {
      const fecha = d.toISOString().slice(0, 10)
      const seed = g.dateToSeed(fecha)
      if (g.selectTemplate(seed) === 'luces-fuera') seeds.push(seed)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return seeds
  }

  it('reparte los tres tamanos, no siempre el mismo tablero', () => {
    const tamanos = new Set(seedsReales().map((s) => `${buildLucesPuzzle(s).rows}`))
    expect([...tamanos].sort()).toEqual(['4', '5', '6'])
  })

  it('reparte tambien los tres modos', () => {
    const modos = new Set(seedsReales().map((s) => buildLucesPuzzle(s).modo.objetivo))
    expect([...modos].sort()).toEqual(['all_off', 'all_on', 'pattern_match'])
  })
})
