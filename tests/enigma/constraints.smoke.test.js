import { describe, it, expect, beforeAll } from 'vitest'

let solver

// Import dinámico de la plantilla ES Module
beforeAll(async () => {
  const mod = await import('../../plantillas/enigma_einstein.js')
  solver = mod.default ?? mod  // Asegura compatibilidad con export default o export nombrado
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








