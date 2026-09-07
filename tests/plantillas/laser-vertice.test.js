import { describe, it, expect } from 'vitest'

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

// Payload minimo, modo clasico, tamano pequeno para autoTraza.
const DATA = {
  size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'right' }, target: { row: 0, col: 4 } },
    { emitter: { row: 4, col: 0, dir: 'right' }, target: { row: 4, col: 4 } }
  ],
  blocks: []
}

describe('plantilla laser: overlay de vertices', () => {
  it('monta una capa de vertices clicable dentro de laser-board-stack', async () => {
    const host = await montar(DATA)
    const capa = host.querySelector('.laser-vertice-layer')
    expect(capa).not.toBeNull()
    // (size+1)^2 = 36 vertices posibles como blancos clicables.
    expect(capa.querySelectorAll('.laser-vertice').length).toBe(36)
  })

  it('tocar un vertice interior lo arma y lo coloca', async () => {
    const host = await montar(DATA)
    const trayHoriz = host.querySelector('[aria-label="Espejo horizontal"]')
    trayHoriz.click()
    const vertice = host.querySelector('.laser-vertice[data-r="2"][data-c="2"]')
    vertice.click()
    expect(vertice.dataset.pieza).toBe('horiz')
  })

  it('tocar un vertice ocupado lo retira', async () => {
    const host = await montar(DATA)
    host.querySelector('[aria-label="Espejo horizontal"]').click()
    const vertice = host.querySelector('.laser-vertice[data-r="2"][data-c="2"]')
    vertice.click()
    expect(vertice.dataset.pieza).toBe('horiz')
    vertice.click()
    expect(vertice.dataset.pieza).toBe('')
  })

  // Un vertice de borde (R=0 o R=n) solo admite HORIZ, no VERT (y viceversa
  // en la columna 0/n): armar el tipo que no admite no debe colocar nada.
  it('un vertice de borde no admite el tipo que no le corresponde', async () => {
    const host = await montar(DATA)
    host.querySelector('[aria-label="Espejo vertical"]').click()
    const verticeBorde = host.querySelector('.laser-vertice[data-r="0"][data-c="2"]')
    verticeBorde.click()
    expect(verticeBorde.dataset.pieza).toBe('')
  })

  it('arrastrar una pieza hasta un vertice lo coloca (con elementFromPoint simulado)', async () => {
    const host = await montar(DATA)
    const vertice = host.querySelector('.laser-vertice[data-r="2"][data-c="2"]')
    const original = document.elementFromPoint
    document.elementFromPoint = () => vertice
    const trayVert = host.querySelector('[aria-label="Espejo vertical"]')
    trayVert.dispatchEvent(new Event('pointerdown'))
    trayVert.dispatchEvent(new Event('pointerup'))
    document.elementFromPoint = original
    expect(vertice.dataset.pieza).toBe('vert')
  })
})
