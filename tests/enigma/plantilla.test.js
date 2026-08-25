import { describe, it, expect, beforeAll } from 'vitest'
import { generarEnigma, TAMANOS } from '../../scripts/einstein-logic.js'

let mod
// happy-dom no implementa <canvas> y la celebración de la victoria pinta
// confeti en uno; mismo apaño que en el test del láser.
beforeAll(async () => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
  mod = await import('../../plantillas/enigma_einstein.js')
})

// Montar el tablero de verdad es la única red que cubre los tamaños
// nuevos: la plantilla llevaba el 4 metido a mano en cuatro sitios
// (BOARD_SIZE, el guard, los slice y la comprobación de la solución).
function resolver(root, enigma, { intercambiar = null } = {}) {
  const personas = Object.keys(enigma.solution)
  personas.forEach((persona, casa) => {
    const pares = [['Persona', persona], ...Object.entries(enigma.solution[persona])]
    for (const [cat, valor] of pares) {
      // Con `intercambiar` se cruzan los valores de esa categoría entre
      // las dos primeras casas: el relleno deja de ser una solución.
      if (cat === intercambiar && casa < 2) {
        const otra = personas[1 - casa]
        const cruzado = enigma.solution[otra][cat]
        root.querySelector(`.card[data-category="${cat}"][data-value="${cruzado}"]`).click()
        root.querySelector(`td.cell[data-house="${casa}"][data-category="${cat}"]`).click()
        continue
      }
      root.querySelector(`.card[data-category="${cat}"][data-value="${valor}"]`).click()
      root.querySelector(`td.cell[data-house="${casa}"][data-category="${cat}"]`).click()
    }
  })
}

function comprobar(root) {
  const validar = [...root.querySelectorAll('button')].find((b) => /comprob|validar/i.test(b.textContent))
  validar.click()
}

describe('la plantilla monta cualquiera de las cuatro formas', () => {
  for (const { filas, casas } of TAMANOS) {
    it(`pinta un ${filas}x${casas} y da por bueno el relleno correcto`, async () => {
      const enigma = generarEnigma(20260909, { filas, casas })
      const root = document.createElement('div')
      await mod.render(root, {
        categories: enigma.categories,
        clues: enigma.clues,
        solution: enigma.solution
      }, {})

      // El nº de casas viaja al DOM: de ahí cuelgan el reparto de la
      // rejilla y el tamaño de celda, para que las 5 columnas quepan sin
      // obligar a arrastrar el tablero de lado.
      expect(root.querySelector('.ein-grid').dataset.casas).toBe(String(casas))
      expect(root.querySelectorAll('th.house-header').length).toBe(casas)
      expect(root.querySelectorAll('.ein-table tbody tr').length).toBe(filas)
      expect(root.querySelectorAll('.ein-group').length).toBe(filas)
      expect(root.querySelectorAll('.ein-cards .card').length).toBe(filas * casas)
      expect(root.querySelector('.feedback').textContent).not.toMatch(/Error/)

      resolver(root, enigma)
      comprobar(root)
      expect(root.querySelector('.feedback').textContent).toMatch(/resuelto/i)
    })
  }

  it('un relleno con dos casas cruzadas se rechaza', async () => {
    const enigma = generarEnigma(20260909, { filas: 5, casas: 5 })
    const root = document.createElement('div')
    await mod.render(root, {
      categories: enigma.categories,
      clues: enigma.clues,
      solution: enigma.solution
    }, {})
    resolver(root, enigma, { intercambiar: enigma.meta.categoriasElegidas[0] })
    comprobar(root)
    expect(root.querySelector('.feedback').textContent).toMatch(/error/i)
  })

  it('avisa en vez de pintar medio tablero si las categorías no cuadran', async () => {
    const enigma = generarEnigma(20260909, { filas: 4, casas: 4 })
    const categories = { ...enigma.categories }
    const cat = enigma.meta.categoriasElegidas[0]
    categories[cat] = categories[cat].slice(0, 3)
    const root = document.createElement('div')
    await mod.render(root, { categories, clues: enigma.clues, solution: enigma.solution }, {})
    expect(root.querySelector('.feedback').textContent).toMatch(new RegExp(cat))
    expect(root.querySelectorAll('.ein-table').length).toBe(0)
  })
})
