import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// Del ejemplo de láser triangular se comprueba que además de pintarse SE
// PUEDE RESOLVER, colocando los espejos previstos (armados desde la bandeja)
// y esperando la victoria. Sin esto, un ejemplo imposible pasaría
// desapercibido en la portada.
//
// data/muestra/laser-triangular.json tiene variant "medio", así que desde la
// Task 12 el trazado no es automático: colocar la última pieza ya no basta,
// hay que pulsar el botón de disparo para que se compruebe la victoria. Lo
// único que cambia aquí es ESE gesto -- se sigue exigiendo la misma victoria
// real jugando con la bandeja, solo que ahora hace falta un click más.

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

// Arma la pieza `tipo` desde la bandeja y toca la celda (fila, columna) para
// colocarla ahi -- sustituye al viejo ciclo de cinco estados por clic, que
// desaparecio con la bandeja (Task 11).
const coloca = (host, fila, columna, columnas, tipo) => {
  const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
  host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
  host.querySelectorAll('.laser-cell')[fila * columnas + columna].click()
}

describe('ejemplo de láser triangular', () => {
  it('se puede resolver de verdad en la propia plantilla', async () => {
    const { resolverPiezas } = await import('../../scripts/laser-triangular-logic.js')
    const mod = await import('../../plantillas/laser_triangular.js')
    const data = JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))

    // La solución no está en el payload (sería el spoiler): se busca con el
    // mismo buscador que usa el validador y luego se juega en el DOM.
    const sol = resolverPiezas(
      { size: data.size, lasers: data.lasers, blocks: data.blocks || [] },
      data.min_espejos
    )
    expect(sol, 'el ejemplo de láser no tiene solución').not.toBeNull()

    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    sol.piezas.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (tipo) coloca(host, r, c, data.size, tipo)
    }))

    // El ejemplo es "medio": las piezas ya están todas puestas, pero la
    // victoria no se canta hasta pulsar el botón de disparo.
    host.querySelector('.laser-btn-lanzar').click()

    expect(ganado, 'la plantilla no dio la victoria con la solución encontrada').toBe(1)
  })
})
