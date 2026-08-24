import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

// Del ejemplo de mezcla química se comprueba que además de pintarse SE PUEDE
// RESOLVER: se busca el camino con el mismo BFS que usa el validador y se
// juega en el DOM, matraz a matraz, hasta verter en el reactor. Sin esto, un
// reskin que rompiera los clics pasaría desapercibido en la portada.

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

// Camino de movimientos (no solo su número) hasta que algún matraz tenga el
// objetivo, en el mismo modelo de estados que scripts/mezcla-logic.js.
function caminoHastaObjetivo({ capacities, target, initialLevels, grifo }) {
  const key = (l) => l.join(',')
  const vecinos = (levels) => {
    const out = []
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] > 0) { const x = levels.slice(); x[i] = 0; out.push([x, { tipo: 'vaciar', i }]) }
    }
    for (let i = 0; i < levels.length; i++) for (let j = 0; j < levels.length; j++) {
      if (i === j) continue
      const cabe = Math.min(levels[i], capacities[j] - levels[j])
      if (cabe > 0) { const x = levels.slice(); x[i] -= cabe; x[j] += cabe; out.push([x, { tipo: 'verter', i, j }]) }
    }
    if (grifo) for (let i = 0; i < levels.length; i++) {
      if (levels[i] < capacities[i]) { const x = levels.slice(); x[i] = capacities[i]; out.push([x, { tipo: 'llenar', i }]) }
    }
    return out
  }

  const previo = new Map([[key(initialLevels), null]])
  let frontera = [initialLevels]
  while (frontera.length) {
    const siguiente = []
    for (const levels of frontera) {
      for (const [x, mov] of vecinos(levels)) {
        if (previo.has(key(x))) continue
        previo.set(key(x), [key(levels), mov])
        if (x.includes(target)) {
          const pasos = []
          let k = key(x)
          while (previo.get(k)) { const [padre, m] = previo.get(k); pasos.unshift(m); k = padre }
          return { pasos, final: x }
        }
        siguiente.push(x)
      }
    }
    frontera = siguiente
  }
  return null
}

describe('ejemplo de mezcla química', () => {
  it('se puede resolver de verdad en la propia plantilla', async () => {
    const mod = await import('../../plantillas/mezcla_quimica.js')
    const data = JSON.parse(await fs.readFile('data/muestra/mezcla-quimica.json', 'utf8'))

    const camino = caminoHastaObjetivo(data)
    expect(camino, 'el ejemplo de mezcla no tiene solución').not.toBeNull()

    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    const matraces = host.querySelectorAll('.matraz')
    expect(matraces.length).toBe(data.capacities.length)

    const btn = (texto) => [...host.querySelectorAll('button')]
      .find((b) => b.textContent.includes(texto))

    // Tras «Llenar» el matraz sigue seleccionado (lo normal es llenar y
    // volcar acto seguido), así que la selección se lee del DOM en vez de
    // darla por supuesta: si hay otro marcado, se deselecciona antes.
    const seleccionar = (i) => {
      const marcado = host.querySelector('.matraz.selected')
      if (marcado === matraces[i]) return
      if (marcado) marcado.click()
      matraces[i].click()
    }

    for (const mov of camino.pasos) {
      seleccionar(mov.i)
      if (mov.tipo === 'verter') matraces[mov.j].click()
      else if (mov.tipo === 'llenar') btn('Llenar del dosificador').click()
      else btn('Vaciar matraz').click()
    }

    // El gesto de victoria: seleccionar el matraz con el volumen exacto y
    // verterlo en el reactor. Antes de eso no puede haber victoria.
    expect(ganado, 'la plantilla dio la victoria sin pasar por el reactor').toBe(0)

    const exacto = camino.final.indexOf(data.target)
    seleccionar(exacto)
    host.querySelector('.reactor-button').click()

    expect(ganado, 'verter el volumen exacto en el reactor no dio la victoria').toBe(1)
  })

  it('el reactor rechaza un matraz que no tiene el volumen exacto', async () => {
    const mod = await import('../../plantillas/mezcla_quimica.js')
    const data = JSON.parse(await fs.readFile('data/muestra/mezcla-quimica.json', 'utf8'))

    const host = document.createElement('div')
    let ganado = 0
    await mod.render(host, data, { onSuccess: () => { ganado++ } })

    // Un matraz recién llenado tiene su capacidad, no el objetivo.
    host.querySelectorAll('.matraz')[0].click()
    ;[...host.querySelectorAll('button')].find((b) => b.textContent.includes('Llenar')).click()
    host.querySelector('.reactor-button').click()

    expect(ganado).toBe(0)
    expect(host.querySelector('.panel-message').textContent).toMatch(/no tiene el volumen exacto/)
  })
})
