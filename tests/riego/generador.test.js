import { describe, it, expect } from 'vitest'
import { buildRiegoPuzzle, contarSoluciones } from '../../scripts/riego-logic.js'

const SEEDS = [20260831, 20260918, 20261210, 20270501, 21, 44, 97, 20280707]
const config = (p) => ({ cycles: p.cycles, capacity: p.capacity, plants: p.plants })

describe('buildRiegoPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildRiegoPuzzle(20260831)))
      .toBe(JSON.stringify(buildRiegoPuzzle(20260831)))
  })

  it('produce un calendario con solución única', () => {
    for (const seed of SEEDS) {
      const p = buildRiegoPuzzle(seed)
      const res = contarSoluciones(config(p), { tope: 2 })
      expect(res.soluciones, `seed ${seed}`).toBe(1)
    }
  })

  it('describe plantas coherentes con el tablero', () => {
    for (const seed of SEEDS) {
      const p = buildRiegoPuzzle(seed)
      expect(p.plants.length, `seed ${seed}`).toBeGreaterThanOrEqual(3)
      const nombres = new Set()
      for (const planta of p.plants) {
        expect(planta.id, `seed ${seed}`).toBeTruthy()
        expect(nombres.has(planta.id), `seed ${seed}: planta repetida ${planta.id}`).toBe(false)
        nombres.add(planta.id)
        expect(planta.doses).toBeGreaterThanOrEqual(1)
        expect(planta.ventana.length).toBeGreaterThanOrEqual(planta.doses)
        for (const c of planta.ventana) {
          expect(c).toBeGreaterThanOrEqual(0)
          expect(c).toBeLessThan(p.cycles)
        }
        expect(new Set(planta.ventana).size).toBe(planta.ventana.length)
      }
    }
  })

  it('deja holgura: las ventanas no vienen ya resueltas', () => {
    for (const seed of SEEDS) {
      const p = buildRiegoPuzzle(seed)
      const holgura = p.plants.reduce((acc, pl) => acc + (pl.ventana.length - pl.doses), 0)
      expect(holgura, `seed ${seed}: cada planta tiene su ventana clavada`).toBeGreaterThanOrEqual(p.plants.length)
    }
  })

  it('la solución guardada cumple las reglas', () => {
    for (const seed of SEEDS) {
      const p = buildRiegoPuzzle(seed)
      const usoCiclo = Array(p.cycles).fill(0)
      p.solucion.forEach((ciclos, i) => {
        expect(ciclos, `seed ${seed}`).toHaveLength(p.plants[i].doses)
        ciclos.forEach((c, k) => {
          expect(p.plants[i].ventana).toContain(c)
          if (k > 0) expect(c - ciclos[k - 1], `seed ${seed}: riegos seguidos`).toBeGreaterThanOrEqual(2)
          usoCiclo[c]++
        })
      })
      expect(Math.max(...usoCiclo), `seed ${seed}: se pasa de capacidad`).toBeLessThanOrEqual(p.capacity)
    }
  })

  it('reparte las variantes con su tamaño', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildRiegoPuzzle(seed)
      vistas.add(p.variant)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)
      expect(p.cycles).toBeGreaterThanOrEqual(6)
      expect(p.capacity).toBeGreaterThanOrEqual(1)
    }
    expect(vistas.size).toBe(3)
  })
})
