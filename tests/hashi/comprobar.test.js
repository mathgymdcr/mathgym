import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

// Tres chips en fila: conectar el 0 (grado 1) con el 1 (grado 2) satisface
// el 0 sin completar el tablero entero (el 2 se queda sin tocar), así que no
// dispara la celebración final -- lo que se prueba aquí es el aviso
// intermedio, no la victoria.
const CONFIG = {
  rows: 1,
  cols: 5,
  islands: [
    { row: 0, col: 0, grado: 1 },
    { row: 0, col: 2, grado: 2 },
    { row: 0, col: 4, grado: 1 }
  ]
}

async function montar(dificultad) {
  const mod = await import('../../plantillas/hashi.js')
  const root = document.createElement('div')
  await mod.render(root, { ...CONFIG, dificultad }, {})
  return root
}

function botones(root) {
  return [...root.querySelectorAll('.hashi-island-btn')]
}

function celdaDe(root, idx) {
  return botones(root)[idx].closest('.hashi-cell')
}

function click(el) {
  el.dispatchEvent(new Event('click', { bubbles: true }))
}

describe('boton Comprobar segun dificultad en puentes-hashi', () => {
  it('el boton Comprobar existe en cualquier nivel', async () => {
    const root = await montar(1)
    expect([...root.querySelectorAll('button')].some((b) => b.textContent === 'Comprobar')).toBe(true)
  })

  it('sin dificultad, el aro verde sale en vivo', async () => {
    const root = await montar(undefined)
    const btns = botones(root)
    click(btns[0]); click(btns[1])
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(true)
  })

  it('en nivel 1-2, el aro verde sale en vivo sin pulsar Comprobar', async () => {
    const root = await montar(2)
    const btns = botones(root)
    click(btns[0]); click(btns[1])
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(true)
  })

  it('en nivel 3+, el aro verde NO sale hasta pulsar Comprobar', async () => {
    const root = await montar(3)
    const btns = botones(root)
    click(btns[0]); click(btns[1])
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(false)

    const btnComprobar = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar')
    click(btnComprobar)
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(true)
  })

  it('en nivel 3+, tender otro cable borra el verde hasta volver a comprobar', async () => {
    const root = await montar(3)
    const btns = botones(root)
    click(btns[0]); click(btns[1])
    const btnComprobar = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar')
    click(btnComprobar)
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(true)

    click(btns[1]); click(btns[2])
    expect(celdaDe(root, 0).classList.contains('is-satisfied')).toBe(false)
  })

  it('el aro rojo de sobrepasado sigue en vivo en nivel 3+', async () => {
    const root = await montar(3)
    const btns = botones(root)
    // Dos cables entre 0 (grado 1) y 1 (grado 2) dejan al 0 con grado 2 > 1: sobrepasado.
    click(btns[0]); click(btns[1])
    click(btns[0]); click(btns[1])
    expect(celdaDe(root, 0).classList.contains('is-over')).toBe(true)
  })
})
