import { describe, it, expect } from 'vitest'
import { solveRelojes, enumerateMeasurable } from '../../scripts/relojes-logic.js'

describe('solveRelojes', () => {
  it('resuelve el clasico 7 y 11 para medir 15 en 3 rondas desde t=0', () => {
    const sol = solveRelojes([7, 11], 15, 'clasico')
    expect(sol).not.toBeNull()
    expect(sol.rondas).toBe(3)
    expect(sol.tramos).toEqual([7, 4, 4])
  })

  it('mide una duracion suelta en una sola ronda', () => {
    const sol = solveRelojes([4, 7], 7, 'clasico')
    expect(sol.rondas).toBe(1)
    expect(sol.tramos).toEqual([7])
  })

  it('no puede medir 3 con relojes de 4 y 7 si el crono corre desde el principio', () => {
    expect(solveRelojes([4, 7], 3, 'clasico')).toBeNull()
  })

  it('mide 3 con relojes de 4 y 7 arrancando el crono a mitad', () => {
    const sol = solveRelojes([4, 7], 3, 'diferido')
    expect(sol).not.toBeNull()
    expect(sol.tramos).toEqual([3])
  })

  it('no puede medir un tiempo impar con relojes de duracion par', () => {
    expect(solveRelojes([4, 6], 5, 'clasico')).toBeNull()
    expect(solveRelojes([4, 6], 5, 'diferido')).toBeNull()
  })

  it('devuelve una secuencia de pasos cuya suma de tramos es el objetivo', () => {
    const sol = solveRelojes([7, 11], 15, 'clasico')
    const suma = sol.tramos.reduce((a, b) => a + b, 0)
    expect(suma).toBe(15)
    expect(sol.pasos).toHaveLength(sol.rondas)
    expect(sol.pasos[0].voltear).toEqual([0, 1])
  })
})

describe('enumerateMeasurable', () => {
  it('lista los tiempos medibles desde t=0 con su minimo de rondas', () => {
    const medibles = enumerateMeasurable([7, 11], { modo: 'clasico', maxRondas: 4, maxTotal: 30 })
    expect(medibles.get(7)).toBe(1)
    expect(medibles.get(11)).toBe(1)
    expect(medibles.get(15)).toBe(3)
    expect(medibles.has(3)).toBe(false)
  })

  it('en modo diferido incluye tiempos inalcanzables desde t=0', () => {
    const clasico = enumerateMeasurable([4, 7], { modo: 'clasico', maxRondas: 4, maxTotal: 30 })
    const diferido = enumerateMeasurable([4, 7], { modo: 'diferido', maxRondas: 4, maxTotal: 30 })
    expect(clasico.has(3)).toBe(false)
    expect(diferido.get(3)).toBe(1)
  })

  it('nunca devuelve el tiempo 0 como medible', () => {
    const medibles = enumerateMeasurable([4, 7], { modo: 'diferido', maxRondas: 3, maxTotal: 20 })
    expect(medibles.has(0)).toBe(false)
  })
})
