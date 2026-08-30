import { describe, it, expect, beforeAll } from 'vitest'
import { COLORES_MARCA } from '../../scripts/nonograma-logic.js'

// La celebración pinta confeti en un canvas, que happy-dom no trae.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

// El payload en color: un cuadro de dos colores, pequeño para poder pintarlo
// entero a mano en el test.
//   oo
//   aa
const PALETA = [COLORES_MARCA.o, COLORES_MARCA.a]
const payload = () => ({
  variant: 'pequeno-color', rows: 2, cols: 2, paleta: PALETA,
  grid: [[1, 1], [2, 2]], figura: 'prueba'
})

const celdas = (root) => [...root.querySelectorAll('.nono-cell')]
const botonesColor = (root) => [...root.querySelectorAll('.nono-color')]
// La victoria ya no se dispara sola al completar el dibujo: hace falta
// pulsar "Comprobar".
const comprobar = (root) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar').click()

describe('plantillas/nonograma.js en color', () => {
  it('monta un botón por color de la paleta, el primero activo', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    await mod.render(root, payload(), {})

    const botones = botonesColor(root)
    expect(botones).toHaveLength(2)
    expect(botones[0].classList.contains('is-active')).toBe(true)
    expect(botones[1].classList.contains('is-active')).toBe(false)
  })

  it('pinta la celda del color activo, no de un color fijo', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    await mod.render(root, payload(), {})

    botonesColor(root)[1].click()
    celdas(root)[0].click()
    expect(celdas(root)[0].dataset.color).toBe('2')
  })

  it('cicla la celda: color activo, ×, vacía', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    await mod.render(root, payload(), {})

    const celda = celdas(root)[0]
    celda.click()
    expect(celda.dataset.color).toBe('1')
    celda.click()
    expect(celda.textContent).toBe('×')
    celda.click()
    expect(celda.dataset.color).toBe('0')
    expect(celda.textContent).toBe('')
  })

  it('repinta directamente una celda que ya tiene otro color', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    await mod.render(root, payload(), {})

    celdas(root)[0].click()                 // color 1
    botonesColor(root)[1].click()
    celdas(root)[0].click()                 // sin pasar por × ni por vacía
    expect(celdas(root)[0].dataset.color).toBe('2')
  })

  it('pinta cada número de la pista con el color de su bloque', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    await mod.render(root, payload(), {})

    const primeraFila = root.querySelector('.nono-clue-row')
    expect(primeraFila.textContent).toBe('2')
    expect(primeraFila.querySelector('span').style.color).toBeTruthy()
  })

  it('da la victoria solo al reproducir también los colores', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    let ganado = 0
    await mod.render(root, payload(), { onSuccess: () => { ganado++ } })

    // La forma correcta, pero todo del primer color: el dibujo no es ese.
    for (const celda of celdas(root)) celda.click()
    comprobar(root)
    expect(ganado).toBe(0)

    // Las dos de abajo, al segundo color.
    botonesColor(root)[1].click()
    celdas(root)[2].click()
    celdas(root)[3].click()
    comprobar(root)
    expect(ganado).toBe(1)
  })

  it('el monocromo se sigue jugando sin barra de color', async () => {
    const mod = await import('../../plantillas/nonograma.js')
    const root = document.createElement('div')
    let ganado = 0
    await mod.render(root, {
      variant: 'pequeno', rows: 2, cols: 2, grid: [[1, 1], [0, 1]], figura: 'ele'
    }, { onSuccess: () => { ganado++ } })

    expect(botonesColor(root)).toHaveLength(0)
    celdas(root)[0].click()
    celdas(root)[1].click()
    celdas(root)[3].click()
    comprobar(root)
    expect(ganado).toBe(1)
  })
})
