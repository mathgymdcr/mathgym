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

  it('cada numero lleva su propio color, dentro de una paleta fija de ocho', async () => {
    const host = await monta()
    const tono = (g) => chipDe(host, g).dataset.color
    expect(tono(1)).toBe('azul')
    expect(tono(4)).toBe('morado')
    expect(tono(6)).toBe('naranja')
    expect(tono(1)).not.toBe(tono(4))
    expect(tono(4)).not.toBe(tono(6))
  })

  it('pone el numero oscuro sobre el oro, donde el blanco seria ilegible', async () => {
    const host = await monta()
    const texto = (g) => chipDe(host, g).querySelector('text').getAttribute('fill')
    expect(texto(6)).not.toBe('#fff')
    expect(texto(1)).toBe('#fff')
    expect(texto(4)).toBe('#fff')
  })
})

// Un tablero con las tres formas fijas más un chip libre, para comprobar
// que cada una se dibuja distinta y que solo el libre lleva número.
const CONFIG_FORMAS = {
  rows: 9,
  cols: 9,
  islands: [
    { row: 0, col: 0, grado: 4, forma: 'cuadrado' },
    { row: 0, col: 8, grado: 3, forma: 'triangulo' },
    { row: 8, col: 0, grado: 2, forma: 'rectangulo' },
    { row: 8, col: 8, grado: 6 }
  ]
}

describe('chips con forma fija', () => {
  it('cuadrado, triangulo y rectangulo no muestran numero; el chip libre si', async () => {
    const host = await monta(CONFIG_FORMAS)
    const cuadrado = chipDe(host, 4)
    const triangulo = chipDe(host, 3)
    const rectangulo = chipDe(host, 2)
    const libre = chipDe(host, 6)
    expect(cuadrado.querySelector('text'), 'cuadrado').toBeFalsy()
    expect(triangulo.querySelector('text'), 'triangulo').toBeFalsy()
    expect(rectangulo.querySelector('text'), 'rectangulo').toBeFalsy()
    expect(libre.querySelector('text'), 'libre').toBeTruthy()
    expect(libre.textContent.trim()).toBe('6')
  })

  it('triangulo se dibuja como un poligono, no como un rectangulo', async () => {
    const host = await monta(CONFIG_FORMAS)
    const triangulo = chipDe(host, 3)
    expect(triangulo.querySelector('svg > polygon')).toBeTruthy()
  })

  it('rectangulo es un cuerpo no cuadrado, a diferencia de cuadrado', async () => {
    const host = await monta(CONFIG_FORMAS)
    const cuerpoDe = (chip) => {
      const rects = [...chip.querySelectorAll('svg > rect')]
      // El cuerpo es el rect grande; las patillas son las 12 rect pequeñas
      // (10x16 o 16x10, ver plantillas/hashi.js).
      return rects.find(r => Number(r.getAttribute('width')) > 20)
    }
    const cuadrado = cuerpoDe(chipDe(host, 4))
    const rectangulo = cuerpoDe(chipDe(host, 2))
    expect(cuadrado.getAttribute('width')).toBe(cuadrado.getAttribute('height'))
    expect(rectangulo.getAttribute('width')).not.toBe(rectangulo.getAttribute('height'))
  })

  it('marca la forma en dataset para que el CSS/tests puedan distinguirla', async () => {
    const host = await monta(CONFIG_FORMAS)
    expect(chipDe(host, 4).dataset.forma).toBe('cuadrado')
    expect(chipDe(host, 3).dataset.forma).toBe('triangulo')
    expect(chipDe(host, 2).dataset.forma).toBe('rectangulo')
    expect(chipDe(host, 6).dataset.forma).toBeFalsy()
  })

  it('en rectangulo las patillas de arriba/abajo se acortan para seguir tocando el cuerpo (36 de alto, no 60)', async () => {
    const host = await monta(CONFIG_FORMAS)
    const rectangulo = chipDe(host, 2)
    // El cuerpo va de y=32 a y=68 (ver cuerpoDeForma); una patilla vertical
    // fija a la altura del cuerpo cuadrado (y=6..22 / y=78..94) dejaría un
    // hueco de 10px sin tocarlo.
    const verticales = [...rectangulo.querySelectorAll('svg > rect')]
      .filter(r => Number(r.getAttribute('height')) > Number(r.getAttribute('width')))
    expect(verticales.length).toBeGreaterThan(0)
    for (const pin of verticales) {
      const y = Number(pin.getAttribute('y'))
      const y1 = y + Number(pin.getAttribute('height'))
      const esDeArriba = y < 50
      if (esDeArriba) expect(y1, `patilla de arriba en y=${y}`).toBe(32)
      else expect(y, `patilla de abajo en y=${y}`).toBe(68)
    }
  })

  it('el triangulo no lleva patillas laterales ancladas fuera de su silueta', async () => {
    const host = await monta(CONFIG_FORMAS)
    const triangulo = chipDe(host, 3)
    // x=6/x=78 es donde van las patillas laterales del cuerpo cuadrado; el
    // triángulo no tiene lado vertical al que anclarlas sin que floten.
    const laterales = [...triangulo.querySelectorAll('svg > rect')]
      .filter(r => ['6', '78'].includes(r.getAttribute('x')))
    expect(laterales).toHaveLength(0)
  })

  it('el triangulo lleva patillas en la base ancha y una unica en el vertice', async () => {
    const host = await monta(CONFIG_FORMAS)
    const triangulo = chipDe(host, 3)
    const rects = [...triangulo.querySelectorAll('svg > rect')]
    // Base: y=80 es la arista ancha del polígono (14,80)-(86,80).
    const base = rects.filter(r => Number(r.getAttribute('y')) === 78)
    expect(base).toHaveLength(3)
    // Vértice: (50,14) es la punta del polígono.
    const vertice = rects.filter(r => {
      const y1 = Number(r.getAttribute('y')) + Number(r.getAttribute('height'))
      return y1 === 14
    })
    expect(vertice).toHaveLength(1)
  })

  it('las instrucciones explican el grado fijo de cada forma solo cuando el reto las usa', async () => {
    const conFormas = await monta(CONFIG_FORMAS)
    expect(conFormas.textContent).toMatch(/cuadrado/i)
    expect(conFormas.textContent).toMatch(/tri[aá]ngulo/i)
    expect(conFormas.textContent).toMatch(/rect[aá]ngulo/i)

    const sinFormas = await monta(CONFIG)
    expect(sinFormas.textContent).not.toMatch(/cuadrado/i)
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
