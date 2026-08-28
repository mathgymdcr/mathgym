import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

const muestra = async () => JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))

describe('bandeja de piezas', () => {
  it('en clasico solo ofrece los cuatro espejos', async () => {
    const host = await montar({
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [], min_espejos: 2
    })
    const piezas = [...host.querySelectorAll('.laser-tray-pieza')].map((b) => b.dataset.pieza)
    expect(piezas).toEqual(['slash', 'backslash', 'vert', 'horiz'])
  })

  // Payload de prisma en linea, NO data/muestra: la muestra sigue siendo un
  // reto clasico hasta la Task 13, asi que ofreceria cuatro piezas.
  const PRISMA = {
    size: 5, modo: 'prisma',
    lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
    targets: [{ row: 0, col: 4, color: 'azul' }, { row: 4, col: 4, color: 'rojo' }],
    blocks: [], min_piezas: 2
  }

  it('con prisma ofrece las seis', async () => {
    const host = await montar(PRISMA)
    expect(host.querySelectorAll('.laser-tray-pieza')).toHaveLength(6)
  })

  it('tocar una pieza y luego una celda la coloca', async () => {
    const host = await montar(PRISMA)
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const celdas = host.querySelectorAll('.laser-cell')
    const libre = [...celdas].find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    expect(libre.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')
  })

  it('tocar una pieza ya colocada la retira', async () => {
    const host = await montar(await muestra())
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    libre.click()
    expect(libre.querySelector('.laser-pieza')).toBeNull()
  })

  it('no deja colocar sobre un emisor, una diana ni un bloque', async () => {
    const host = await montar(await muestra())
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const emisor = host.querySelector('.laser-cell.is-emitter')
    emisor.click()
    expect(emisor.querySelector('.laser-pieza')).toBeNull()
  })
})
