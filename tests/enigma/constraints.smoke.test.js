import { describe, it, expect, beforeAll } from 'vitest'

let solver

beforeAll(async () => {
  // Import dinámico de la plantilla CommonJS
  const mod = await import('../../../plantillas/enigma_einstein.js')
  solver = mod.__test__
})

describe('Enigma Einstein - smoke test', () => {
  it('debería tener el método solvePuzzle', () => {
    expect(typeof solver.solvePuzzle).toBe('function')
  })

  it('solvePuzzle debería retornar un objeto', () => {
    const result = solver.solvePuzzle?.()
    expect(result).toBeTypeOf('object')
  })
})


