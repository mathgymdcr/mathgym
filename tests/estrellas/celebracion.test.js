import { describe, it, expect, beforeEach } from 'vitest'
import { celebrate, pintarEstrellas } from '../../plantillas/celebration.js'

// Las estrellas se añaden a la celebración que la plantilla ya ha abierto: es
// el shell quien sabe la marca, así que se pintan desde fuera.

beforeEach(() => {
  document.body.innerHTML = ''
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

describe('pintarEstrellas', () => {
  it('pinta siempre las tres, marcando solo las ganadas', () => {
    celebrate({ ok: true })
    pintarEstrellas(2)

    const huecos = document.querySelectorAll('.celebration-estrellas .estrella')
    expect(huecos).toHaveLength(3)
    expect(document.querySelectorAll('.celebration-estrellas .estrella.is-ganada')).toHaveLength(2)
  })

  it('las cuenta para quien no ve la pantalla', () => {
    celebrate({ ok: true })
    pintarEstrellas(1)
    expect(document.querySelector('.celebration-estrellas').getAttribute('aria-label'))
      .toBe('1 de 3 estrellas')
  })

  it('va justo debajo del titular', () => {
    celebrate({ ok: true })
    pintarEstrellas(3)
    const titulo = document.querySelector('.celebration-title')
    expect(titulo.nextElementSibling.className).toBe('celebration-estrellas')
  })

  it('sin celebración abierta no revienta', () => {
    expect(pintarEstrellas(3)).toBeNull()
  })
})
