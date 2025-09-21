import { describe, it, expect, beforeAll } from 'vitest'

let solver

beforeAll(async () => {
  // Import dinámico de la plantilla CommonJS sin cambiarla
  const mod = await import('../../plantillas/enigma_einstein.js')
  // Comprobamos si tiene default (export default) o es un módulo CommonJS
  solver = mod.default ?? mod
})

describe('Smoke tests plantillas MathGym', () => {
  it('Comprobar que ../../plantillas/enigma_einstein.js tiene "tipo" y "titulo"', () => {
    expect(solver.tipo).toBeDefined()
    expect(solver.titulo).toBeDefined()
  })

  it('Debería tener el método solvePuzzle', () => {
    expect(typeof solver.solvePuzzle).toBe('function')
  })

  it('solvePuzzle debería retornar un objeto', () => {
    const result = solver.solvePuzzle()
    expect(result).toBeTypeOf('object')
  })
})









