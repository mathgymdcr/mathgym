import { describe, it, expect, beforeAll } from 'vitest'

let mod
const data = {
  level: 'medio',
  categories: {
    Persona: ['Ana', 'Beto', 'Cora', 'Damian'],
    Camiseta: ['Roja', 'Verde', 'Azul', 'Amarilla'],
    Bebida: ['Cafe', 'Te', 'Agua', 'Zumo'],
    Mascota: ['Perro', 'Gato', 'Pez', 'Tortuga']
  },
  clues: ['Damian tiene tortuga.']
}

beforeAll(async () => {
  mod = await import('../../plantillas/enigma_einstein.js')
})

describe('Smoke tests plantillas MathGym', () => {
  it('plantillas/enigma_einstein.js expone render(root, data, hooks)', () => {
    expect(typeof mod.render).toBe('function')
  })

  it('render monta el tablero en el contenedor sin lanzar', async () => {
    const root = document.createElement('div')
    await mod.render(root, data, {})
    expect(root.children.length).toBeGreaterThan(0)
  })
})
