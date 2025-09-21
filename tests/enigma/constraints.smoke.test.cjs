// Usamos require porque la plantilla está en CommonJS
const { describe, it, expect } = require('vitest')
const mod = require('../../../plantillas/enigma_einstein.js')

// Accedemos al objeto de pruebas
const solver = mod.__test__

describe('Enigma Einstein - smoke test', () => {
  it('debería tener el método solvePuzzle', () => {
    expect(typeof solver.solvePuzzle).toBe('function')
  })

  it('solvePuzzle debería retornar un objeto', () => {
    const result = solver.solvePuzzle?.()
    expect(result).toBeTypeOf('object')
  })
})

