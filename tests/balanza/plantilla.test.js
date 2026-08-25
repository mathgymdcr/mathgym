import { describe, it, expect, beforeAll } from 'vitest'
import { balanzaMinWeighings } from '../../scripts/balanza-logic.js'

let mod
beforeAll(async () => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
  mod = await import('../../plantillas/balanza_logica.js')
})

const monedas = (root) => root.querySelectorAll('.balance-coin').length
const boton = (root, re) => [...root.querySelectorAll('button')].find((b) => re.test(b.textContent))
const comprobar = (root) => boton(root, /comprobar/i).click()
const mensajes = (root) => [...root.querySelectorAll('.feedback, .status, [class*="message"]')]
  .map((e) => e.textContent).join(' | ')

// Una pesada de verdad: se elige una moneda, se suelta en un plato y se
// pulsa Pesar. onCheck no envía nada mientras no haya al menos una.
function pesar(root, indice = 0) {
  root.querySelectorAll('.balance-coin')[indice].click()
  root.querySelector('#left-plate').click()
  boton(root, /pesar/i).click()
}

describe('la plantilla lee el payload nuevo y el viejo', () => {
  it('monta el reto escrito en español', async () => {
    const root = document.createElement('div')
    await mod.render(root, {
      variant: 'desconocida', n_monedas: 7, max_pesadas: 3, anomalies: [{ i: 2, sign: -1 }]
    }, {})
    expect(monedas(root)).toBe(7)
    // La variante "desconocida" es la única que pregunta también el signo.
    expect(root.textContent).toMatch(/más pesada|más ligera/i)
  })

  it('monta igual un reto publicado con las claves viejas', async () => {
    const root = document.createElement('div')
    await mod.render(root, {
      variant: 'oddUnknown', N: 7, maxWeighings: 3, anomalies: [{ i: 2, sign: -1 }]
    }, {})
    expect(monedas(root)).toBe(7)
    expect(root.textContent).toMatch(/más pesada|más ligera/i)
  })

  it('pinta el selector de varias monedas en las variantes múltiples', async () => {
    const root = document.createElement('div')
    await mod.render(root, {
      variant: 'pesadas-multiples', n_monedas: 8, k_impostoras: 2, max_pesadas: 4,
      anomalies: [{ i: 1, sign: 1 }, { i: 5, sign: 1 }]
    }, {})
    expect(monedas(root)).toBe(8)
    expect(root.textContent).toMatch(/2 monedas/i)
  })

  it('avisa si el payload no trae variante ni monedas', async () => {
    const root = document.createElement('div')
    await mod.render(root, { anomalies: [] }, {})
    expect(root.textContent).toMatch(/Error/)
    expect(monedas(root)).toBe(0)
  })
})

describe('el mínimo de pesadas sale del módulo compartido', () => {
  // La plantilla calculaba el suyo con Math.ceil(log(n)/log(3)), que se
  // pasa por uno cuando los escenarios son potencia exacta de 3:
  // log(27)/log(3) da 3.0000000000000004 en coma flotante.
  it('27 escenarios son 3 pesadas, no 4', async () => {
    const cfg = { variant: 'pesada', n_monedas: 27, max_pesadas: 5, anomalies: [{ i: 0, sign: 1 }] }
    expect(balanzaMinWeighings(cfg)).toBe(3)

    const root = document.createElement('div')
    await mod.render(root, cfg, {})
    // A la cuarta pesada el aviso tiene que hablar de 3, no de 4: con
    // Math.ceil(log(27)/log(3)) la plantilla creía que el mínimo era 4 y
    // no avisaba todavía.
    for (let i = 0; i < 4; i++) pesar(root, i)
    expect(mensajes(root)).toMatch(/resolverlo en 3 pesadas/)
  })

  it('el payload de onSubmit también habla español', async () => {
    let enviado = null
    const root = document.createElement('div')
    await mod.render(root, {
      variant: 'pesada', n_monedas: 6, k_impostoras: 1, max_pesadas: 3,
      anomalies: [{ i: 2, sign: 1 }]
    }, { onSubmit: (p) => { enviado = p } })
    pesar(root)
    root.querySelectorAll('.answer-coin')[2].click()
    comprobar(root)
    expect(enviado).toMatchObject({
      variant: 'pesada', n_monedas: 6, k_impostoras: 1, max_pesadas: 3, success: true
    })
    expect(enviado.N).toBeUndefined()
    expect(enviado.maxWeighings).toBeUndefined()
  })
})
