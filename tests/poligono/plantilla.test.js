import { describe, it, expect, beforeAll } from 'vitest'

// happy-dom no implementa <canvas> y la celebracion pinta confeti en uno.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const nodo = (host, r, c) => host.querySelector(`.polygon-node[data-r="${r}"][data-c="${c}"]`)
const segmento = (host, r1, c1, r2, c2) =>
  host.querySelector(`.polygon-edge[data-arista="${r1},${c1}-${r2},${c2}"]`)

// Dibuja el contorno de un rectangulo pulsando nodo a nodo.
function dibujaRectangulo(host, r0, c0, alto, ancho) {
  const camino = []
  for (let c = c0; c <= c0 + ancho; c++) camino.push([r0, c])
  for (let r = r0 + 1; r <= r0 + alto; r++) camino.push([r, c0 + ancho])
  for (let c = c0 + ancho - 1; c >= c0; c--) camino.push([r0 + alto, c])
  for (let r = r0 + alto - 1; r >= r0; r--) camino.push([r, c0])
  for (const [r, c] of camino) nodo(host, r, c).click()
}

async function monta(config) {
  const mod = await import('../../plantillas/poligono_geometrico.js')
  const host = document.createElement('div')
  let ganado = 0
  await mod.render(host, config, { onSuccess: () => { ganado++ } })
  return {
    host,
    ganado: () => ganado,
    validar: () => host.querySelector('#polygon-validate').click()
  }
}

const UNA = { gridSize: 8, n_figuras: 1, area: 12, perimeter: 14, formas: 'convexa' }

describe('plantilla de poligono', () => {
  it('gana al dibujar el 3x4 que se pide', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 0, 0, 3, 4)
    j.validar()
    expect(j.ganado()).toBe(1)
  })

  it('pulsar un segmento dibujado lo borra', async () => {
    const j = await monta(UNA)
    nodo(j.host, 0, 0).click()
    nodo(j.host, 0, 1).click()
    expect(segmento(j.host, 0, 0, 0, 1).classList.contains('puesta')).toBe(true)
    segmento(j.host, 0, 0, 0, 1).click()
    expect(segmento(j.host, 0, 0, 0, 1).classList.contains('puesta')).toBe(false)
  })

  it('quitar una arista de un ciclo deja una cadena por la que seguir', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 0, 0, 3, 4)
    segmento(j.host, 0, 0, 0, 1).click()
    // Los cabos quedan en (0,0) y (0,1); volver a cerrarlos rehace la figura.
    nodo(j.host, 0, 0).click()
    j.validar()
    expect(j.ganado()).toBe(1)
  })

  it('no deja llevar un nodo a grado 3', async () => {
    const j = await monta(UNA)
    dibujaRectangulo(j.host, 0, 0, 3, 4)
    nodo(j.host, 1, 1).click()
    expect(segmento(j.host, 0, 1, 1, 1)).toBeTruthy()
    expect(segmento(j.host, 0, 1, 1, 1).classList.contains('puesta')).toBe(false)
  })

  it('en dos figuras exige las dos, no una sola que sume', async () => {
    const j = await monta({
      gridSize: 8, n_figuras: 2, area: 24, perimeter: 30, formas: 'una-de-cada'
    })
    dibujaRectangulo(j.host, 0, 0, 3, 4)
    j.validar()
    expect(j.ganado()).toBe(0)
  })

  it('rechaza la forma equivocada aunque los numeros cuadren', async () => {
    // (12,16) lo dan el rectangulo 2x6 Y una L: pidiendo concava, el
    // rectangulo no vale.
    const j = await monta({ gridSize: 8, n_figuras: 1, area: 12, perimeter: 16, formas: 'concava' })
    dibujaRectangulo(j.host, 0, 0, 2, 6)
    j.validar()
    expect(j.ganado()).toBe(0)
  })
})
