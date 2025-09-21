import { describe, it, expect } from 'vitest'

const plantillas = [
  '../../../plantillas/enigma_einstein.js',
  // Puedes agregar más plantillas aquí si quieres testearlas
]

describe('Smoke tests plantillas MathGym', () => {
  plantillas.forEach((path) => {
    it(`Importar ${path} sin errores`, async () => {
      const modulo = await import(path)
      expect(modulo).toBeDefined()
    })

    it(`Comprobar que ${path} tiene "tipo" y "titulo"`, async () => {
      const modulo = await import(path)
      const obj = modulo.default || modulo
      expect(obj.tipo || obj.title || obj.titulo).toBeDefined()
    })
  })
})




