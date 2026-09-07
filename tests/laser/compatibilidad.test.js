import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import { normalizaConfig, piezasMinimas, resuelto, crearPiezas } from '../../scripts/laser-triangular-logic.js'
import { auditaAlineacion } from '../../scripts/audita-laser-alineacion.js'

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

describe('auditoria de alineacion sobre configs sueltas', () => {
  it('marca alineado un reto clasico simple sin piezas', () => {
    const config = {
      fecha: '2099-01-01', size: 4, modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 0, col: 3 } }],
      blocks: []
    }
    const r = auditaAlineacion([config])
    expect(r.total).toBe(1)
    expect(r.alineados).toBe(1)
    expect(r.desalineados).toEqual([])
  })

  it('marca desalineado un reto sin solucion posible', () => {
    // El unico laser emite 'neutro-1'; la diana exige 'neutro-2', que ningun
    // laser produce -- asi que ninguna colocacion de piezas (con o sin
    // vertice) puede alcanzarla nunca. Sin ambiguedad geometrica: es
    // estructuralmente irresoluble.
    const config = {
      fecha: '2099-01-02', size: 4, modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, color: 'neutro-1' }],
      targets: [{ row: 0, col: 3, color: 'neutro-2' }],
      blocks: [], min_piezas: 0
    }
    const r = auditaAlineacion([config])
    expect(r.desalineados.map(d => d.fecha)).toContain('2099-01-02')
  })
})
