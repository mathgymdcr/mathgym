import { describe, it, expect, beforeAll } from 'vitest'

let solver

describe('Smoke tests plantillas MathGym', () => {
  beforeAll(async () => {
    // Import dinámico de la plantilla CommonJS
    const mod = await import('../../plantillas/enigma_einstein.js')
    solver = mod.__test__ || mod  // por si exporta directamente
  })

  it('Importar ../../plantillas/enigma_einstein.js sin errores', () => {
    expect(solver).toBeDefined()
  })

  it('Comprobar que ../../plantillas/enigma_einstein.js tiene "tipo" y "titulo"', () => {
    expect(solver.tipo).toBeDefined()
    expect(solver.titulo).toBeDefined()
  })

  it('debería tener el método solvePuzzle', () => {
    expect(typeof solver.solvePuzzle).toBe('function')
  })

  it('solvePuzzle debería retornar un objeto', () => {
    const result = solver.solvePuzzle?.()
    expect(result).toBeTypeOf('object')
  })
})





