import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// Los dos ejemplos de láser son de los pocos payloads escritos a mano: aquí
// se comprueba que además de pintarse SE PUEDEN RESOLVER, colocando los
// espejos previstos y esperando la victoria. Sin esto, un ejemplo imposible
// pasaría desapercibido.
//
// Cada toque en una celda avanza el tipo de espejo: 1 toque = '/', 2 = '\'.

// happy-dom no implementa <canvas> y la celebración de la victoria pinta
// confeti en uno. Se le da un contexto de mentira para que la animación no
// impida comprobar lo único que interesa aquí: que el puzzle se resuelve.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const clicks = (host, fila, columna, columnas, veces) => {
  const celdas = host.querySelectorAll('.laser-cell')
  const celda = celdas[fila * columnas + columna]
  for (let i = 0; i < veces; i++) celda.click()
}

describe('ejemplos de láser del muestrario', () => {
  it('laser-espejos se resuelve con un espejo por rayo', async () => {
    const mod = await import('../../plantillas/laser.js')
    const data = JSON.parse(await fs.readFile('data/muestra/laser-espejos.json', 'utf8'))
    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    clicks(host, 0, 3, data.cols, 2)   // '\' desvía el rayo naranja hacia abajo
    clicks(host, 1, 0, data.cols, 1)   // '/' desvía el rayo azul hacia la derecha

    expect(ganado, 'el ejemplo no llega a resolverse').toBe(1)
  })

  it('laser-triangular se resuelve con un espejo por rayo', async () => {
    const mod = await import('../../plantillas/laser_triangular.js')
    const data = JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))
    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    clicks(host, 3, 0, data.size, 2)   // '\' manda el rayo naranja a la derecha
    clicks(host, 0, 1, data.size, 1)   // '/' manda el rayo azul hacia abajo

    expect(ganado, 'el ejemplo no llega a resolverse').toBe(1)
  })
})
