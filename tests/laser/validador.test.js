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
})
