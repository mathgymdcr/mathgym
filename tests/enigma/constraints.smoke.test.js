import { describe, it, expect } from 'vitest'
import * as mod from '../../..//plantillas/enigma_einstein.js'

const solver = mod.__test__

describe('Enigma solver (smoke)', () => {
  it('exports test hooks', () => {
    expect(solver).toBeDefined()
    expect(typeof solver.solveEinstein).toBe('function')
  })
})
