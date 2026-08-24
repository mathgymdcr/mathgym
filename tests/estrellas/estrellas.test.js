import { describe, it, expect } from 'vitest'
import { estrellasDe, parDe, MAX_ESTRELLAS } from '../../estrellas.js'

// Las estrellas salen de los umbrales que los generadores YA escriben en cada
// reto (maxMovesFor3Stars y compañía), no de tolerancias inventadas aquí.
// Hay dos varas de medir en el catálogo: "te pasaste del par" (movimientos o
// pesadas) y "fallaste al comprobar" (enigma y polígono).

describe('estrellasDe, por movimientos', () => {
  const obj = { parMoves: 6, maxMovesFor3Stars: 6, maxMovesFor2Stars: 8 }

  it('clavarlo en el mínimo da las tres', () => {
    expect(estrellasDe(obj, { movimientos: 6 })).toBe(3)
  })

  it('por debajo del mínimo también da tres (no debería pasar, pero no rompe)', () => {
    expect(estrellasDe(obj, { movimientos: 4 })).toBe(3)
  })

  it('acercarse da dos', () => {
    expect(estrellasDe(obj, { movimientos: 7 })).toBe(2)
    expect(estrellasDe(obj, { movimientos: 8 })).toBe(2)
  })

  it('resolverlo dando vueltas da una: nunca cero', () => {
    expect(estrellasDe(obj, { movimientos: 9 })).toBe(1)
    expect(estrellasDe(obj, { movimientos: 300 })).toBe(1)
  })
})

describe('estrellasDe, por pesadas', () => {
  const obj = { maxWeighingsFor3Stars: 3, maxWeighingsFor2Stars: 4 }

  it('usa los umbrales de la balanza', () => {
    expect(estrellasDe(obj, { pesadas: 3 })).toBe(3)
    expect(estrellasDe(obj, { pesadas: 4 })).toBe(2)
    expect(estrellasDe(obj, { pesadas: 5 })).toBe(1)
  })
})

describe('estrellasDe, por comprobaciones fallidas', () => {
  const obj = { maxErrorsFor3Stars: 0, maxErrorsFor2Stars: 2 }

  it('acertar a la primera da las tres', () => {
    expect(estrellasDe(obj, { fallos: 0 })).toBe(3)
  })

  it('un par de fallos deja dos', () => {
    expect(estrellasDe(obj, { fallos: 1 })).toBe(2)
    expect(estrellasDe(obj, { fallos: 2 })).toBe(2)
  })

  it('a la tercera ya es una', () => {
    expect(estrellasDe(obj, { fallos: 3 })).toBe(1)
  })
})

describe('estrellasDe, casos de borde', () => {
  it('sin marca, resolverlo vale las tres', () => {
    expect(estrellasDe({ parMoves: 6, maxMovesFor3Stars: 6, maxMovesFor2Stars: 8 })).toBe(3)
  })

  it('sin objectives, resolverlo vale las tres', () => {
    expect(estrellasDe(null, { movimientos: 99 })).toBe(3)
    expect(estrellasDe({}, { movimientos: 99 })).toBe(3)
  })

  it('con parMoves pero sin umbrales, el par hace de listón de tres estrellas', () => {
    // Retos viejos del archivo: el generador siempre escribe los umbrales,
    // pero un JSON editado a mano puede no tenerlos.
    expect(estrellasDe({ parMoves: 5 }, { movimientos: 5 })).toBe(3)
    expect(estrellasDe({ parMoves: 5 }, { movimientos: 7 })).toBe(2)
    expect(estrellasDe({ parMoves: 5 }, { movimientos: 8 })).toBe(1)
  })

  it('la marca que no corresponde a la medida del reto se ignora', () => {
    // Un tipo de movimientos no se puntúa con "fallos" ni al revés.
    expect(estrellasDe({ maxErrorsFor3Stars: 0, maxErrorsFor2Stars: 2 }, { movimientos: 40 })).toBe(3)
  })

  it('nunca pasa de MAX_ESTRELLAS ni baja de una', () => {
    expect(MAX_ESTRELLAS).toBe(3)
    for (const m of [0, 1, 5, 6, 7, 99]) {
      const e = estrellasDe({ maxMovesFor3Stars: 6, maxMovesFor2Stars: 8 }, { movimientos: m })
      expect(e).toBeGreaterThanOrEqual(1)
      expect(e).toBeLessThanOrEqual(MAX_ESTRELLAS)
    }
  })
})

describe('parDe', () => {
  it('describe la meta de los tipos de movimientos', () => {
    expect(parDe({ parMoves: 6, maxMovesFor3Stars: 6 })).toEqual({ valor: 6, unidad: 'movimientos' })
  })

  it('describe la meta de la balanza en pesadas', () => {
    expect(parDe({ maxWeighingsFor3Stars: 3 })).toEqual({ valor: 3, unidad: 'pesadas' })
  })

  it('no hay meta que enseñar donde se mide por fallos', () => {
    // "Fallos: 0 / máximo 0" antes de fallar no dice nada: el marcador se calla.
    expect(parDe({ maxErrorsFor3Stars: 0, maxErrorsFor2Stars: 2 })).toBeNull()
    expect(parDe(null)).toBeNull()
  })
})
