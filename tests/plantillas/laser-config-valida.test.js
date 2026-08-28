import { describe, it, expect } from 'vitest'

// configValida es la unica puerta de entrada de plantillas/laser_triangular.js:
// si es demasiado estricta, un reto real (por ejemplo de modo prisma o
// condensador, con numero de emisores distinto del de dianas) se ve como
// "mal configurado" aunque el JSON sea perfectamente valido. Este archivo
// cubre justo ese agujero -- no habia ningun test que montara la plantilla
// con un payload de esos modos.

const ERROR = 'mal configurado'

async function montar(data) {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, {})
  return host
}

describe('configValida en plantillas/laser_triangular.js', () => {
  it('acepta un reto de modo prisma: 1 emisor, 2 dianas', async () => {
    const host = await montar({
      size: 5,
      modo: 'prisma',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [
        { row: 0, col: 4, color: 'azul' },
        { row: 4, col: 4, color: 'rojo' }
      ],
      blocks: []
    })
    expect(host.innerHTML).not.toContain(ERROR)
  })

  it('acepta un reto de modo condensador: 1 emisor, 1 diana', async () => {
    const host = await montar({
      size: 5,
      modo: 'condensador',
      lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
      targets: [{ row: 2, col: 4, color: 'neutro' }],
      blocks: []
    })
    expect(host.innerHTML).not.toContain(ERROR)
  })

  it('rechaza un reto sin laseres', async () => {
    const host = await montar({
      size: 5,
      modo: 'clasico',
      lasers: [],
      targets: [{ row: 0, col: 0, color: 'neutro-1' }],
      blocks: []
    })
    expect(host.innerHTML).toContain(ERROR)
  })

  it('rechaza un reto sin dianas', async () => {
    const host = await montar({
      size: 5,
      modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, color: 'neutro-1' }],
      targets: [],
      blocks: []
    })
    expect(host.innerHTML).toContain(ERROR)
  })

  it('rechaza una direccion de emisor inventada', async () => {
    const host = await montar({
      size: 5,
      modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'diagonal-imaginaria' }, color: 'neutro-1' }],
      targets: [{ row: 4, col: 4, color: 'neutro-1' }],
      blocks: []
    })
    expect(host.innerHTML).toContain(ERROR)
  })

  it('rechaza una diana fuera del tablero', async () => {
    const host = await montar({
      size: 5,
      modo: 'clasico',
      lasers: [{ emitter: { row: 0, col: 0, dir: 'right' }, color: 'neutro-1' }],
      targets: [{ row: 99, col: 0, color: 'neutro-1' }],
      blocks: []
    })
    expect(host.innerHTML).toContain(ERROR)
  })
})
