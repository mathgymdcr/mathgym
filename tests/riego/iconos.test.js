// tests/riego/iconos.test.js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const PLANTAS = [
  'albahaca', 'tomatera', 'cactus', 'orquidea', 'helecho', 'romero',
  'lavanda', 'menta', 'aloe', 'petunia', 'jazmin', 'perejil'
]

// --success (#10b981) y el verde de "dosis completas" del propio riego
// (#51cf66, .riego-dosis.is-done) son la señal real de "correcto/hecho" en
// esta pantalla -- un icono decorativo con ESE MISMO verde competiría con
// ella. Ya no se prohíbe el verde en general (las plantas reales tienen
// hojas verdes: menta, perejil, romero...), solo acercarse a esos dos tonos
// concretos.
const COLORES_DE_ESTADO = ['10b981', '51cf66']

function chocaConColorDeEstado(hex) {
  const m = /#([0-9A-Fa-f]{6})\b/g
  let match
  while ((match = m.exec(hex))) {
    const n = match[1].toLowerCase()
    const r = parseInt(n.slice(0, 2), 16)
    const g = parseInt(n.slice(2, 4), 16)
    const b = parseInt(n.slice(4, 6), 16)
    for (const estado of COLORES_DE_ESTADO) {
      const er = parseInt(estado.slice(0, 2), 16)
      const eg = parseInt(estado.slice(2, 4), 16)
      const eb = parseInt(estado.slice(4, 6), 16)
      const distancia = Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb)
      if (distancia < 60) return true
    }
  }
  return false
}

describe('iconos de planta', () => {
  for (const nombre of PLANTAS) {
    it(`assets/planta-${nombre}.svg existe y es un icono válido`, async () => {
      const contenido = await fs.readFile(`assets/planta-${nombre}.svg`, 'utf8')
      expect(contenido).toContain('viewBox="0 0 200 200"')
      expect(contenido.startsWith('<svg')).toBe(true)
      expect(chocaConColorDeEstado(contenido), `planta-${nombre}.svg usa un color demasiado parecido al de "completado"`).toBe(false)
    })
  }
})
