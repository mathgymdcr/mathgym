import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const montar = async (data) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, {})
  return host
}

describe('formas del tablero de laser', () => {
  it('no queda ni un emoji en el tablero', async () => {
    const host = await montar(JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8')))
    expect(host.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('cada diana lleva la forma de su color, no solo el color', async () => {
    const host = await montar({
      size: 5, modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 0, col: 4, color: 'azul' }, { row: 4, col: 4, color: 'rojo' }],
      blocks: [], min_piezas: 2
    })
    const formas = [...host.querySelectorAll('.laser-diana')].map((d) => d.dataset.forma)
    expect(formas.sort()).toEqual(['cuadrado', 'triangulo'])
  })

  it('el emisor lleva boquilla orientada, no una flecha de texto', async () => {
    const host = await montar(JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8')))
    const emisores = host.querySelectorAll('.laser-emisor')
    expect(emisores.length).toBeGreaterThan(0)
    expect(emisores[0].style.getPropertyValue('--laser-dir-rot')).toMatch(/deg$/)
    expect(emisores[0].textContent).toBe('')
  })
})
