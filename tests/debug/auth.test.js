import { describe, it, expect } from 'vitest'
import { hashPassword } from '../../debug-auth.js'

describe('hashPassword', () => {
  it('da el sha-256 en hex de la contraseña', async () => {
    // sha256("Bentrock") calculado aparte con node:crypto.
    expect(await hashPassword('Bentrock'))
      .toBe('97549ef0060e3164d647af0bb7ec8bb57bfc0367e64807a1e5cfadd70f936b2f')
  })

  it('contraseñas distintas dan hashes distintos', async () => {
    expect(await hashPassword('otra-cosa')).not.toBe(await hashPassword('Bentrock'))
  })
})
