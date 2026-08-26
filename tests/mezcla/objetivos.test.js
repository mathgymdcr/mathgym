import { describe, it, expect } from 'vitest'
import {
  solveMezcla,
  objetivosMezcla,
  minimoExigidoMezcla,
  initialLevelsMezcla
} from '../../scripts/mezcla-logic.js'

// Con varios objetivos el reto se sintetiza EN CADENA: cada compuesto se
// vierte en el reactor -- que vacía el matraz -- y el siguiente arranca de
// las sobras del anterior. El orden lo elige quien juega.

const base = (targets, grifo = true) => ({
  grifo,
  capacities: [12, 10, 7, 5],
  targets,
  initialLevels: initialLevelsMezcla([12, 10, 7, 5], grifo)
})

describe('objetivosMezcla', () => {
  it('normaliza el payload de un solo objetivo, que es el publicado hasta hoy', () => {
    expect(objetivosMezcla({ target: 5 })).toEqual([5])
  })

  it('deja pasar la lista', () => {
    expect(objetivosMezcla({ targets: [11, 6] })).toEqual([11, 6])
  })

  it('si vienen los dos manda la lista', () => {
    expect(objetivosMezcla({ target: 5, targets: [11, 6] })).toEqual([11, 6])
  })
})

describe('solveMezcla con varios objetivos', () => {
  it('un solo objetivo da lo mismo escrito como target o como targets', () => {
    const conTarget = { ...base([11]), targets: undefined, target: 11 }
    expect(solveMezcla(conTarget)).toBe(solveMezcla(base([11])))
    expect(solveMezcla(base([11]))).toBeGreaterThan(0)
  })

  it('encadenar dos objetivos cuesta más que cualquiera de los dos por separado', () => {
    const uno = solveMezcla(base([11]))
    const otro = solveMezcla(base([6]))
    const ambos = solveMezcla(base([11, 6]))
    expect(ambos).toBeGreaterThan(Math.max(uno, otro))
  })

  it('el orden no está impuesto: la lista al revés cuesta lo mismo', () => {
    expect(solveMezcla(base([11, 6]))).toBe(solveMezcla(base([6, 11])))
  })

  it('el mismo volumen dos veces es un objetivo repetido, no uno solo', () => {
    expect(solveMezcla(base([11, 11]))).toBeGreaterThan(solveMezcla(base([11])))
  })

  it('devuelve null si alguno de los objetivos no cabe en ningún matraz', () => {
    expect(solveMezcla(base([11, 13]))).toBe(null)
  })

  it('verter ya cuenta como movimiento: un objetivo que arranca servido cuesta 1', () => {
    const cfg = {
      grifo: false,
      capacities: [7, 4, 3],
      targets: [7],
      initialLevels: [7, 0, 0]
    }
    expect(solveMezcla(cfg)).toBe(1)
  })
})

describe('minimoExigidoMezcla', () => {
  it('sube con cada objetivo, para que dos no salgan por el precio de uno', () => {
    expect(minimoExigidoMezcla(1)).toBe(3)
    expect(minimoExigidoMezcla(2)).toBeGreaterThan(minimoExigidoMezcla(1) + 1)
  })
})
