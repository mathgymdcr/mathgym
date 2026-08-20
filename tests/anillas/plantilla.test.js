import { describe, it, expect, beforeAll } from 'vitest'

// La plantilla cambia de reglas (arranque arbitrario, objetivo libre y
// movimiento doble), así que se prueba con clicks reales sobre el DOM.
beforeAll(() => {
  // happy-dom no implementa <canvas> y la celebración pinta confeti en uno.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const montar = async (config, hooks = {}) => {
  const mod = await import('../../plantillas/anillas.js')
  const root = document.createElement('div')
  await mod.render(root, JSON.parse(JSON.stringify(config)), hooks)
  return root
}

const anillas = (root) => [...root.querySelectorAll('.anillas-ring')]
const enganchadas = (root) => anillas(root).map((el) => !el.classList.contains('is-off'))
const movimientos = (root) => root.querySelector('.anillas-moves').textContent

describe('plantillas/anillas.js con arranque y objetivo del JSON', () => {
  it('pinta el estado inicial que viene en el payload', async () => {
    const root = await montar({ rings: 4, inicial: [true, false, true, false] })
    expect(enganchadas(root)).toEqual([true, false, true, false])
  })

  it('muestra el mínimo del JSON y no el clásico de la fórmula', async () => {
    const root = await montar({ rings: 4, inicial: [true, false, true, false], min_movimientos: 7 })
    const info = root.querySelector('.anillas-info').textContent
    expect(info).toContain('7')
    expect(info).not.toContain('10')   // el mínimo clásico de 4 anillas
  })

  it('mueve una anilla legal y cuenta el movimiento', async () => {
    const root = await montar({ rings: 4, inicial: [true, true, true, true] })
    anillas(root)[0].click()
    expect(enganchadas(root)).toEqual([false, true, true, true])
    expect(movimientos(root)).toBe('1')
  })

  it('rechaza una anilla que todavía no se puede tocar', async () => {
    const root = await montar({ rings: 4, inicial: [true, true, true, true] })
    anillas(root)[3].click()
    expect(enganchadas(root)).toEqual([true, true, true, true])
    expect(movimientos(root)).toBe('0')
    expect(root.querySelector('.feedback.ko')).not.toBeNull()
  })

  it('en la variante dos-de-golpe hay un control para mover 1 y 2 juntas', async () => {
    const root = await montar({ rings: 4, inicial: [true, true, true, false], regla: 'dos-de-golpe' })
    const btn = root.querySelector('.anillas-doble')
    expect(btn, 'falta el botón del movimiento doble').not.toBeNull()

    btn.click()
    expect(enganchadas(root)).toEqual([false, false, true, false])
    expect(movimientos(root), 'el movimiento doble cuenta como uno').toBe('1')
  })

  it('sin la variante dos-de-golpe ese control no existe', async () => {
    const root = await montar({ rings: 4, inicial: [true, true, true, true] })
    expect(root.querySelector('.anillas-doble')).toBeNull()
  })

  it('gana al alcanzar un objetivo que no es "todas sueltas"', async () => {
    let ganado = 0
    const root = await montar(
      { rings: 3, inicial: [false, false, true], objetivo: [true, false, true], min_movimientos: 1 },
      { onSuccess: () => { ganado++ } }
    )
    anillas(root)[0].click()
    expect(enganchadas(root)).toEqual([true, false, true])
    expect(ganado, 'no dio la victoria al llegar al objetivo').toBe(1)
  })

  it('no canta victoria por dejarlas todas sueltas si el objetivo era otro', async () => {
    let ganado = 0
    const root = await montar(
      { rings: 3, inicial: [true, false, false], objetivo: [false, false, true] },
      { onSuccess: () => { ganado++ } }
    )
    anillas(root)[0].click()   // deja las tres sueltas
    expect(enganchadas(root)).toEqual([false, false, false])
    expect(ganado).toBe(0)
  })

  it('sigue entendiendo el payload antiguo de solo un número de anillas', async () => {
    const root = await montar({ rings: 4 })
    expect(enganchadas(root)).toEqual([true, true, true, true])
    expect(root.querySelector('.anillas-info').textContent).toContain('10')  // el clásico de 4 anillas, por retrocompatibilidad
  })
})
