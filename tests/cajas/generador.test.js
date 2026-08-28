import { describe, it, expect } from 'vitest'
import { buildCajasPuzzle, solveCajas, VARIANTES, varianteDeSeed } from '../../scripts/cajas-logic.js'

const SEEDS = [20260824, 20260907, 20261120, 20270305, 5, 13, 91, 20280214]

describe('buildCajasPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildCajasPuzzle(20260824)))
      .toBe(JSON.stringify(buildCajasPuzzle(20260824)))
  })

  it('reparte las cajas entre las zonas con cada pila ordenada y pesos distintos', () => {
    for (const seed of SEEDS) {
      const p = buildCajasPuzzle(seed)
      const todas = p.zonas.flat()
      expect(new Set(todas).size, `seed ${seed}`).toBe(todas.length)
      expect(todas.every((peso) => Number.isInteger(peso) && peso > 0)).toBe(true)
      for (const zona of p.zonas) {
        for (let i = 1; i < zona.length; i++) {
          // Nadie puede empezar con una caja pesada sobre una ligera.
          expect(zona[i], `seed ${seed}: [${zona}]`).toBeLessThan(zona[i - 1])
        }
      }
      // Y no puede venir ya resuelto ni casi.
      expect(p.zonas[p.destino].length, `seed ${seed}`).toBeLessThan(todas.length)
    }
  })

  it('deja una capacidad que al menos levanta la caja más pesada', () => {
    for (const seed of SEEDS) {
      const p = buildCajasPuzzle(seed)
      expect(p.capacidad, `seed ${seed}`).toBeGreaterThanOrEqual(Math.max(...p.zonas.flat()))
    }
  })

  it('guarda el mínimo real, que coincide con el del solver', () => {
    for (const seed of SEEDS) {
      const p = buildCajasPuzzle(seed)
      const res = solveCajas({ zonas: p.zonas, capacidad: p.capacidad, destino: p.destino })
      expect(res, `seed ${seed}`).not.toBeNull()
      expect(p.solucion.movimientos, `seed ${seed}`).toBe(res.movimientos)
      expect(p.solucion.pasos).toHaveLength(p.solucion.movimientos)
    }
  })

  it('siempre queda por debajo del 2^n - 1 de Hanói: la carga tiene que importar', () => {
    for (const seed of SEEDS) {
      const p = buildCajasPuzzle(seed)
      const n = p.zonas.flat().length
      const hanoi = Math.pow(2, n) - 1
      expect(p.solucion.movimientos, `seed ${seed}`).toBeLessThan(hanoi)
      // ...pero tampoco se resuelve de un par de tirones.
      expect(p.solucion.movimientos, `seed ${seed}`).toBeGreaterThanOrEqual(n)
    }
  })

  it('no repite siempre el mismo mínimo dentro de una misma variante', () => {
    // El sentido de la capacidad de carga es que el reto deje de ser
    // previsible. Si todas las fechas de una variante salieran con el mismo
    // número de movimientos, el jugador habitual lo aprendería de memoria
    // igual que se aprende el 2^n - 1 de Hanói.
    // Los seeds de cada variante se buscan preguntando por la variante, no
    // calculándolos con `seed % 3`: el eje se sortea con el PRNG justo para
    // que no sea aritmética sobre el seed.
    for (const variante of VARIANTES) {
      const minimos = new Set()
      let vistos = 0
      for (let seed = 20260800; seed < 20261000 && vistos < 20; seed++) {
        if (varianteDeSeed(seed) !== variante) continue
        vistos++
        const p = buildCajasPuzzle(seed)
        expect(p.variant).toBe(variante)
        minimos.add(p.solucion.movimientos)
      }
      expect(vistos, `${variante}: no salió ninguna vez`).toBeGreaterThan(10)
      expect(minimos.size, `${variante}: siempre ${[...minimos]}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('reparte las tres variantes con su número de cajas', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildCajasPuzzle(seed)
      vistas.add(p.variant)
      const esperado = { ligero: 4, medio: 5, pesado: 6 }[p.variant]
      expect(esperado, `variante desconocida: ${p.variant}`).toBeDefined()
      expect(p.zonas.flat()).toHaveLength(esperado)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)
    }
    expect([...vistas].sort()).toEqual(['ligero', 'medio', 'pesado'])
  })
})
