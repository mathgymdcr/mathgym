import { describe, it, expect } from 'vitest'
import { buildHashiPuzzle, solveHashi, construirPares } from '../../scripts/hashi-logic.js'

const SEEDS = [20260821, 20260901, 20261115, 20270102, 1, 7, 42, 12345]

describe('buildHashiPuzzle', () => {
  it('es determinista: el mismo seed da exactamente el mismo puzzle', () => {
    const a = buildHashiPuzzle(20260821)
    const b = buildHashiPuzzle(20260821)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('produce siempre un puzzle con solución única', () => {
    for (const seed of SEEDS) {
      const p = buildHashiPuzzle(seed)
      const res = solveHashi({ rows: p.rows, cols: p.cols, islands: p.islands }, { tope: 2 })
      expect(res.soluciones, `seed ${seed}`).toBe(1)
    }
  })

  it('coloca las islas dentro del tablero y sin repetir celda', () => {
    for (const seed of SEEDS) {
      const p = buildHashiPuzzle(seed)
      expect(p.islands.length, `seed ${seed}`).toBeGreaterThanOrEqual(2)
      const celdas = new Set()
      for (const isla of p.islands) {
        expect(isla.row).toBeGreaterThanOrEqual(0)
        expect(isla.row).toBeLessThan(p.rows)
        expect(isla.col).toBeGreaterThanOrEqual(0)
        expect(isla.col).toBeLessThan(p.cols)
        celdas.add(`${isla.row},${isla.col}`)
      }
      expect(celdas.size, `seed ${seed}`).toBe(p.islands.length)
    }
  })

  it('da a cada isla un grado entre 1 y 8 que cuadra con su solución', () => {
    for (const seed of SEEDS) {
      const p = buildHashiPuzzle(seed)
      const grados = p.islands.map(() => 0)
      for (const puente of p.solucion.puentes) {
        expect(puente.count).toBeGreaterThanOrEqual(1)
        expect(puente.count).toBeLessThanOrEqual(2)
        grados[puente.a] += puente.count
        grados[puente.b] += puente.count
      }
      p.islands.forEach((isla, idx) => {
        expect(isla.grado, `seed ${seed}, isla ${idx}`).toBe(grados[idx])
        expect(isla.grado).toBeGreaterThanOrEqual(1)
        expect(isla.grado).toBeLessThanOrEqual(8)
      })
      expect(p.solucion.total).toBe(p.solucion.puentes.reduce((a, b) => a + b.count, 0))
    }
  })

  it('no deja ningún par de puentes cruzados en la solución', () => {
    for (const seed of SEEDS) {
      const p = buildHashiPuzzle(seed)
      const { pares, cruces } = construirPares({ rows: p.rows, cols: p.cols, islands: p.islands })
      const usados = new Set(p.solucion.puentes.map((b) => `${b.a}-${b.b}`))
      const indiceUsado = (i) => usados.has(`${pares[i].a}-${pares[i].b}`)
      for (const [i, j] of cruces) {
        expect(indiceUsado(i) && indiceUsado(j), `seed ${seed}: cruce ${i}-${j}`).toBe(false)
      }
    }
  })

  it('reparte las dos variantes con su tamaño de tablero', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 20; seed++) {
      const p = buildHashiPuzzle(seed)
      vistas.add(p.variant)
      if (p.variant === 'pequeno') {
        expect(p.rows).toBe(7)
        expect(p.cols).toBe(7)
      } else {
        expect(p.variant).toBe('clasico')
        expect(p.rows).toBe(9)
        expect(p.cols).toBe(9)
      }
      expect(p.dificultad).toBeGreaterThanOrEqual(2)
      expect(p.dificultad).toBeLessThanOrEqual(4)
    }
    expect([...vistas].sort()).toEqual(['clasico', 'pequeno'])
  })

  it('no genera archipiélagos triviales: hay al menos un puente doble o un ciclo', () => {
    for (const seed of SEEDS) {
      const p = buildHashiPuzzle(seed)
      const hayDoble = p.solucion.puentes.some((b) => b.count === 2)
      const hayCiclo = p.solucion.puentes.length >= p.islands.length
      expect(hayDoble || hayCiclo, `seed ${seed}`).toBe(true)
    }
  })
})
