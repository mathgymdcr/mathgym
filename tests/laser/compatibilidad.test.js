import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import { normalizaConfig, piezasMinimas, resuelto, crearPiezas } from '../../scripts/laser-triangular-logic.js'

// El archivo historico NO es reproducible: regenerar un reto pasado da otro
// puzzle. Asi que los payloads publicados tienen que seguir abriendo tal cual,
// y esta es la red que lo comprueba sobre los ficheros reales.
const publicados = async () => {
  const nombres = (await fs.readdir('data')).filter((f) => f.startsWith('laser_') && f.endsWith('.json'))
  return Promise.all(nombres.map(async (n) => [n, JSON.parse(await fs.readFile(`data/${n}`, 'utf8'))]))
}

describe('retos de laser ya publicados', () => {
  it('hay al menos uno que comprobar', async () => {
    expect((await publicados()).length).toBeGreaterThan(0)
  })

  it('todos normalizan a un esquema valido', async () => {
    for (const [nombre, data] of await publicados()) {
      const c = normalizaConfig(data)
      expect(c.targets.length, nombre).toBeGreaterThan(0)
      expect(c.lasers.length, nombre).toBeGreaterThan(0)
      expect(c.modo, nombre).toBeDefined()
    }
  })

  it('ninguno viene resuelto de fabrica y todos siguen siendo resolubles', async () => {
    for (const [nombre, data] of await publicados()) {
      const c = normalizaConfig(data)
      const par = data.min_piezas ?? data.min_espejos
      expect(resuelto(c, crearPiezas(c.size)), `${nombre} viene resuelto`).toBe(false)
      expect(piezasMinimas(c, par), `${nombre} ya no tiene solucion con ${par} piezas`).toBe(par)
    }
  })
})
