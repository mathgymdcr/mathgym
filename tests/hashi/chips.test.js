import { describe, it, expect, beforeAll } from 'vitest'
import { buildHashiPuzzle, buildHashiHints } from '../../scripts/hashi-logic.js'
import { TIPOS } from '../../catalogo-tipos.js'

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

// Un tablero a mano con un chip de cada tramo de color, para poder mirarlos
// todos en el mismo montaje.
const CONFIG = {
  rows: 9,
  cols: 9,
  islands: [
    { row: 0, col: 0, grado: 1 }, { row: 0, col: 8, grado: 1 },
    { row: 4, col: 0, grado: 4 }, { row: 4, col: 8, grado: 4 },
    { row: 8, col: 0, grado: 6 }, { row: 8, col: 8, grado: 6 }
  ]
}

async function monta(config = CONFIG) {
  const mod = await import('../../plantillas/hashi.js')
  const host = document.createElement('div')
  await mod.render(host, config, {})
  return host
}

const chipDe = (host, grado) =>
  [...host.querySelectorAll('.hashi-island-btn')].find(b => b.dataset.grado === String(grado))

describe('chips de puentes-hashi', () => {
  it('dibuja cada chip como un SVG con su numero dentro', async () => {
    const host = await monta()
    for (const grado of [1, 4, 6]) {
      const chip = chipDe(host, grado)
      expect(chip, `grado ${grado}`).toBeTruthy()
      expect(chip.querySelector('svg'), `grado ${grado}`).toBeTruthy()
      expect(chip.textContent.trim(), `grado ${grado}`).toBe(String(grado))
    }
  })

  it('crece con el grado', async () => {
    const host = await monta()
    const lado = (g) => Number(chipDe(host, g).querySelector('svg').getAttribute('width'))
    expect(lado(1)).toBeLessThan(lado(4))
    expect(lado(4)).toBeLessThan(lado(6))
  })

  it('reparte el color por tramos, sin inventarse fuera de la paleta', async () => {
    const host = await monta()
    const tono = (g) => chipDe(host, g).dataset.tramo
    expect(tono(1)).toBe('bajo')
    expect(tono(4)).toBe('medio')
    expect(tono(6)).toBe('alto')
  })

  it('pone el numero oscuro sobre el oro, donde el blanco seria ilegible', async () => {
    const host = await monta()
    const texto = (g) => chipDe(host, g).querySelector('text').getAttribute('fill')
    expect(texto(6)).not.toBe('#fff')
    expect(texto(1)).toBe('#fff')
    expect(texto(4)).toBe('#fff')
  })
})

describe('el tipo ya no habla de islas ni de puentes', () => {
  it('ni en las instrucciones ni en los mensajes de la plantilla', async () => {
    const host = await monta()
    expect(host.textContent).not.toMatch(/isla|archipi|puente/i)
  })

  it('ni en el resumen del catalogo', () => {
    const ficha = TIPOS.find(t => t.tipo === 'puentes-hashi')
    expect(ficha.resumen).not.toMatch(/isla|archipi|puente/i)
  })

  it('ni en las pistas que escribe el generador', () => {
    for (let seed = 20260101; seed < 20260121; seed++) {
      const p = buildHashiPuzzle(seed)
      const texto = buildHashiHints(
        { rows: p.rows, cols: p.cols, islands: p.islands }, p.solucion
      ).join(' ')
      expect(texto, `seed ${seed}`).not.toMatch(/isla|archipi|puente/i)
    }
  })
})
