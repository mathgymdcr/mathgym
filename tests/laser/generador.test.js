import { describe, it, expect } from 'vitest'
import { buildLaserPuzzle, espejosMinimos, espejosMinimosExhaustivo, resuelto, crearPiezas } from '../../scripts/laser-triangular-logic.js'

const SEEDS = [20260830, 20260915, 20261207, 20270422, 12, 33, 88, 20280606]

const config = (p) => ({ size: p.size, lasers: p.lasers, blocks: p.blocks })

describe('buildLaserPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    expect(JSON.stringify(buildLaserPuzzle(20260830)))
      .toBe(JSON.stringify(buildLaserPuzzle(20260830)))
  })

  it('la solución que guarda resuelve el reto de verdad', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(resuelto(config(p), p.solucion.espejos), `seed ${seed}`).toBe(true)
    }
  })

  it('no se resuelve con menos espejos de los que dice', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(p.min_espejos, `seed ${seed}`).toBeGreaterThanOrEqual(2)
      expect(
        espejosMinimos(config(p), p.min_espejos - 1),
        `seed ${seed}: se resuelve con menos de ${p.min_espejos} espejos`
      ).toBeNull()
    }
  })

  it('no se resuelve sin poner ningún espejo', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(resuelto(config(p), crearPiezas(p.size)), `seed ${seed}`).toBe(false)
    }
  })

  it('coloca emisores y dianas dentro del tablero y sin pisarse', () => {
    for (const seed of SEEDS) {
      const p = buildLaserPuzzle(seed)
      expect(p.lasers.length, `seed ${seed}`).toBeGreaterThanOrEqual(2)
      const ocupadas = new Set()
      for (const l of p.lasers) {
        for (const punto of [l.emitter, l.target]) {
          expect(punto.row).toBeGreaterThanOrEqual(0)
          expect(punto.row).toBeLessThan(p.size)
          expect(punto.col).toBeGreaterThanOrEqual(0)
          expect(punto.col).toBeLessThan(p.size)
          const clave = `${punto.row},${punto.col}`
          expect(ocupadas.has(clave), `seed ${seed}: dos objetos en ${clave}`).toBe(false)
          ocupadas.add(clave)
        }
        expect(l.emitter.dir, `seed ${seed}`).toBeTruthy()
      }
      for (const b of p.blocks || []) {
        expect(ocupadas.has(`${b.row},${b.col}`), `seed ${seed}: bloque sobre un objeto`).toBe(false)
      }
    }
  })

  it('la búsqueda podada da lo mismo que la exhaustiva', () => {
    // espejosMinimos solo mira las celdas por las que pasan los rayos, con el
    // argumento de que en una solución mínima todo espejo lo toca algún rayo.
    // Si ese argumento fuera falso, el generador anunciaría un par que no es
    // el real -- y como el validador usa la misma función, no lo detectaría.
    // Por eso se contrasta contra la búsqueda que prueba el tablero entero.
    for (const seed of [20260830, 20260915, 12, 33]) {
      const p = buildLaserPuzzle(seed)
      const c = config(p)
      expect(espejosMinimos(c, 2), `seed ${seed}`).toBe(espejosMinimosExhaustivo(c, 2))
    }
  })

  it('reparte las variantes con su tamaño de tablero', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 30; seed++) {
      const p = buildLaserPuzzle(seed)
      vistas.add(p.variant)
      const esperado = { pequeno: 5, medio: 6, grande: 7 }[p.variant]
      expect(esperado, `variante desconocida: ${p.variant}`).toBeDefined()
      expect(p.size).toBe(esperado)
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)
    }
    expect([...vistas].sort()).toEqual(['grande', 'medio', 'pequeno'])
  })
})
