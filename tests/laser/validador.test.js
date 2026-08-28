import { describe, it, expect } from 'vitest'
import { RetoValidator } from '../../scripts/validate-retos.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const escribe = async (data) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laser-'))
  const ruta = path.join(dir, 'laser.json')
  await fs.writeFile(ruta, JSON.stringify(data))
  return ruta
}

const reto = (json_url) => ({ tipo: 'laser-triangular', data: { json_url } })

describe('validateLaserData', () => {
  it('acepta un payload viejo, sin modo ni targets', async () => {
    const ruta = await escribe({
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [],
      min_espejos: 2
    })
    await expect(new RetoValidator().validateLaserData(reto(ruta))).resolves.toBeUndefined()
  })

  it('rechaza un modo prisma con una sola diana', async () => {
    const ruta = await escribe({
      size: 6, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'azul' }],
      blocks: [], min_piezas: 2
    })
    await expect(new RetoValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/prisma.*dos dianas/i)
  })

  it('rechaza un color de diana que no existe', async () => {
    const ruta = await escribe({
      size: 6, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 5, color: 'turquesa' }, { row: 5, col: 4, color: 'rojo' }],
      blocks: [], min_piezas: 2
    })
    await expect(new RetoValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/color/i)
  })

  // Fixture clásico cuyo mínimo real es 2 piezas (comprobado aparte con
  // piezasMinimas: tope=1 -> null, tope=2..4 -> 2). Las dos pruebas de abajo
  // declaran un min_piezas distinto de ese 2 real, una por cada rama del
  // gate en validate-retos.js -- y comprueban el mensaje exacto de cada
  // una, para que una regresión que confunda las dos ramas (o que afloje
  // `minimo !== declarados` a `minimo > declarados`) no pueda pasar las dos
  // pruebas a la vez.
  const fixtureDosPiezas = {
    size: 5,
    lasers: [
      { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
      { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
    ],
    blocks: []
  }

  it('rechaza un min_piezas inflado: el reto se resuelve con menos de lo declarado', async () => {
    const ruta = await escribe({ ...fixtureDosPiezas, min_piezas: 3 })
    await expect(new RetoValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/min_piezas=3.*se resuelve con 2.*el par anunciado no es el real/i)
  })

  it('rechaza un min_piezas insuficiente: no hay solución con ese tope', async () => {
    const ruta = await escribe({ ...fixtureDosPiezas, min_piezas: 1 })
    await expect(new RetoValidator().validateLaserData(reto(ruta)))
      .rejects.toThrow(/not solvable.*con 1 piezas o menos/i)
  })
})
