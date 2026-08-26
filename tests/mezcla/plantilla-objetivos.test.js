import { describe, it, expect, beforeAll } from 'vitest'
import { initialLevelsMezcla } from '../../scripts/mezcla-logic.js'

let mod
beforeAll(async () => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
  mod = await import('../../plantillas/mezcla_quimica.js')
})

const CAPS = [7, 4, 3]
const payload = (targets) => ({
  grifo: true, capacities: CAPS, targets, initialLevels: initialLevelsMezcla(CAPS, true)
})

const boton = (root, re) => [...root.querySelectorAll('button, .reactor-button')]
  .find((b) => re.test(b.textContent))
const matraz = (root, i) => root.querySelectorAll('.matraz')[i]
const textos = (root) => root.textContent

// Llena el matraz `i` del dosificador y lo vierte en el reactor.
function llenarYVerter(root, i) {
  matraz(root, i).click()
  boton(root, /llenar/i).click()
  matraz(root, i).click()
  boton(root, /verter/i).click()
}

describe('la plantilla sintetiza varios compuestos en cadena', () => {
  it('enseña los objetivos pendientes, no solo uno', async () => {
    const root = document.createElement('div')
    await mod.render(root, payload([4, 3]), {})
    expect(textos(root)).toContain('4 mL')
    expect(textos(root)).toContain('3 mL')
  })

  it('verter un compuesto no termina el reto si queda otro', async () => {
    let exito = null
    const root = document.createElement('div')
    await mod.render(root, payload([4, 3]), { onSuccess: (r) => { exito = r } })
    llenarYVerter(root, 1)          // el matraz de 4 mL
    expect(exito).toBe(null)
    expect(textos(root)).toMatch(/queda|pendiente|falta/i)
  })

  it('el reto termina cuando se han vertido todos', async () => {
    let exito = null
    const root = document.createElement('div')
    await mod.render(root, payload([4, 3]), { onSuccess: (r) => { exito = r } })
    llenarYVerter(root, 1)          // 4 mL
    llenarYVerter(root, 2)          // 3 mL
    expect(exito).not.toBe(null)
    // Llenar y verter, dos veces: cuatro movimientos.
    expect(exito.movimientos).toBe(4)
  })

  it('el orden lo elige quien juega', async () => {
    let exito = null
    const root = document.createElement('div')
    await mod.render(root, payload([4, 3]), { onSuccess: (r) => { exito = r } })
    llenarYVerter(root, 2)          // primero el 3 mL
    llenarYVerter(root, 1)
    expect(exito).not.toBe(null)
  })

  it('el reactor no admite un volumen que no toca', async () => {
    const root = document.createElement('div')
    await mod.render(root, payload([4]), {})
    matraz(root, 2).click()
    boton(root, /llenar/i).click()  // 3 mL, y el objetivo es 4
    matraz(root, 2).click()
    boton(root, /verter/i).click()
    expect(textos(root)).toMatch(/no tiene el volumen exacto/i)
  })

  it('sigue montando el reto de un solo objetivo escrito como `target`', async () => {
    let exito = null
    const root = document.createElement('div')
    await mod.render(root, {
      grifo: true, capacities: CAPS, target: 4, initialLevels: initialLevelsMezcla(CAPS, true)
    }, { onSuccess: (r) => { exito = r } })
    llenarYVerter(root, 1)
    expect(exito).not.toBe(null)
    expect(exito.movimientos).toBe(2)
  })
})
