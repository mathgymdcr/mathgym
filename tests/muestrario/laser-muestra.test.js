import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// El ejemplo de láser triangular es uno de los pocos payloads escritos a
// mano: aquí se comprueba que además de pintarse SE PUEDE RESOLVER,
// colocando los espejos previstos y esperando la victoria. Sin esto, un
// ejemplo imposible pasaría desapercibido.
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

describe('ejemplo de láser triangular del muestrario', () => {
  it('se puede resolver de verdad en la propia plantilla', async () => {
    const { resolverEspejos } = await import('../../scripts/laser-triangular-logic.js')
    const mod = await import('../../plantillas/laser_triangular.js')
    const data = JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))

    // La solución no está en el payload (sería el spoiler): se busca con el
    // mismo buscador que usa el validador y luego se juega en el DOM.
    const sol = resolverEspejos(
      { size: data.size, lasers: data.lasers, blocks: data.blocks || [] },
      data.min_espejos
    )
    expect(sol, 'el ejemplo del muestrario no tiene solución').not.toBeNull()

    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    // Cada toque avanza el tipo de espejo: 1 toque = '/', 2 = '\\', 3 = '|', 4 = '—'.
    sol.espejos.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (tipo) clicks(host, r, c, data.size, tipo)
    }))

    expect(ganado, 'la plantilla no dio la victoria con la solución encontrada').toBe(1)
  })
})
