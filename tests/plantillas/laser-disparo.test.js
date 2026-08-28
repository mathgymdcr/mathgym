import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// happy-dom no implementa <canvas> y la celebracion pinta confeti en uno.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

const CLASICO = {
  variant: 'medio', size: 5,
  lasers: [
    { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
    { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
  ],
  blocks: [], min_espejos: 2
}

describe('boton de disparo', () => {
  it('en medio y grande hay boton y el tablero arranca sin rayo dibujado', async () => {
    const host = await montar(CLASICO)
    expect(host.querySelector('.laser-btn-lanzar')).not.toBeNull()
    expect(host.querySelector('.laser-beams').children).toHaveLength(0)
  })

  it('al pulsar el boton se dibuja el rayo', async () => {
    const host = await montar(CLASICO)
    host.querySelector('.laser-btn-lanzar').click()
    expect(host.querySelector('.laser-beams').children.length).toBeGreaterThan(0)
  })

  it('colocar una pieza apaga el rayo dibujado', async () => {
    const host = await montar(CLASICO)
    host.querySelector('.laser-btn-lanzar').click()
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    expect(host.querySelector('.laser-beams').children).toHaveLength(0)
  })

  it('en pequeno no hay boton y el rayo se dibuja solo', async () => {
    const host = await montar({ ...CLASICO, variant: 'pequeno' })
    expect(host.querySelector('.laser-btn-lanzar')).toBeNull()
    expect(host.querySelector('.laser-beams').children.length).toBeGreaterThan(0)
  })

  it('la victoria solo se canta al disparar, no al colocar la ultima pieza', async () => {
    const { resolverPiezas, normalizaConfig } = await import('../../scripts/laser-triangular-logic.js')
    const sol = resolverPiezas(normalizaConfig(CLASICO), CLASICO.min_espejos)
    let ganado = 0
    const host = await montar(CLASICO, { onSuccess: () => { ganado++ } })
    const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
    sol.piezas.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (!tipo) return
      host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
      host.querySelectorAll('.laser-cell')[r * CLASICO.size + c].click()
    }))
    expect(ganado, 'ha cantado victoria sin disparar').toBe(0)
    host.querySelector('.laser-btn-lanzar').click()
    expect(ganado).toBe(1)
  })
})
