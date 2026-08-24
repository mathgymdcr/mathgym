import { describe, it, expect, beforeEach } from 'vitest'
import { recordCompletion, getProgress } from '../../progress.js'

// La racha mide "lo hiciste", no "lo bordaste": las estrellas son
// reconocimiento aparte y nunca la rompen. Y el reto del día se puede rejugar
// para subir la marca, quedándose siempre con la mejor.

const RETO = { fecha: '2026-08-21', tipo: 'mezcla-quimica', titulo: 'Mezcla Exacta' }

beforeEach(() => {
  localStorage.clear()
})

describe('recordCompletion con estrellas', () => {
  it('guarda las estrellas del día junto al tipo y el título', () => {
    recordCompletion(RETO, 2)
    expect(getProgress().completed['2026-08-21'])
      .toEqual({ tipo: 'mezcla-quimica', titulo: 'Mezcla Exacta', estrellas: 2 })
  })

  it('rejugar mejor sube la marca', () => {
    recordCompletion(RETO, 1)
    recordCompletion(RETO, 3)
    expect(getProgress().completed['2026-08-21'].estrellas).toBe(3)
  })

  it('rejugar peor no la baja', () => {
    recordCompletion(RETO, 3)
    recordCompletion(RETO, 1)
    expect(getProgress().completed['2026-08-21'].estrellas).toBe(3)
  })

  it('rejugar no infla la racha', () => {
    recordCompletion(RETO, 1)
    recordCompletion(RETO, 3)
    recordCompletion(RETO, 3)
    expect(getProgress().currentStreak).toBe(1)
  })

  it('la racha avanza con días encadenados, saque las estrellas que saque', () => {
    recordCompletion({ ...RETO, fecha: '2026-08-21' }, 1)
    recordCompletion({ ...RETO, fecha: '2026-08-22' }, 1)
    recordCompletion({ ...RETO, fecha: '2026-08-23' }, 1)
    const p = getProgress()
    expect(p.currentStreak).toBe(3)
    expect(p.bestStreak).toBe(3)
  })

  it('sin estrellas explícitas guarda el máximo, como antes de que existieran', () => {
    recordCompletion(RETO)
    expect(getProgress().completed['2026-08-21'].estrellas).toBe(3)
  })

  it('tolera un día ya guardado sin estrellas y le pone las nuevas', () => {
    localStorage.setItem('mathgym_progress_v1', JSON.stringify({
      completed: { '2026-08-21': { tipo: 'mezcla-quimica', titulo: 'Mezcla Exacta' } },
      currentStreak: 1,
      bestStreak: 1,
      lastCompletedFecha: '2026-08-21'
    }))
    recordCompletion(RETO, 2)
    const dia = getProgress().completed['2026-08-21']
    expect(dia.estrellas).toBe(2)
    expect(getProgress().currentStreak).toBe(1)
  })

  it('cuenta el total de estrellas ganadas', () => {
    recordCompletion({ ...RETO, fecha: '2026-08-21' }, 3)
    recordCompletion({ ...RETO, fecha: '2026-08-22' }, 2)
    expect(getProgress().totalEstrellas).toBe(5)
  })
})
