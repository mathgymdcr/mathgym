import { describe, it, expect, beforeAll } from 'vitest'
import { buildLucesPuzzle, solucionLightsOut } from '../../scripts/lightsout-logic.js'

// El diseño de los modos se apoya en que plantillas/luces_fuera.js ya sabe
// jugar los tres objetivos (isWin() los cubre desde el principio). Esto lo
// comprueba en vez de darlo por hecho: se resuelve cada modo pulsando de
// verdad en el DOM y se espera la victoria.

// happy-dom no implementa <canvas> y la celebración pinta confeti en uno.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const SEEDS = Array.from({ length: 60 }, (_, i) => 20260101 + i * 7)
const seedDe = (objetivo) => SEEDS.find((s) => buildLucesPuzzle(s).modo.objetivo === objetivo)

async function jugar(objetivo) {
  const mod = await import('../../plantillas/luces_fuera.js')
  const { modo } = buildLucesPuzzle(seedDe(objetivo))
  const host = document.createElement('div')

  let ganado = 0
  let movimientos = null
  await mod.render(host, { modos: [modo] }, {
    onSuccess: ({ movimientos: m }) => { ganado++; movimientos = m }
  })

  const cols = modo.tamano[1]
  const chips = host.querySelectorAll('.chip')
  for (const [r, c] of solucionLightsOut(modo)) chips[r * cols + c].click()

  return { ganado, movimientos, modo, host }
}

describe('plantilla de luces-fuera con los tres objetivos', () => {
  it('reconoce la victoria al aplicar la solucion minima', async () => {
    for (const objetivo of ['all_off', 'all_on', 'pattern_match']) {
      const { ganado, movimientos, modo } = await jugar(objetivo)
      expect(ganado, `${objetivo}: no reconoció la victoria`).toBe(1)
      expect(movimientos, objetivo).toBe(modo.min_pulsaciones)
    }
  })

  it('dibuja la diana solo en modo patron', async () => {
    const patron = await jugar('pattern_match')
    expect(patron.host.querySelector('.pattern-preview').textContent).toContain('Patrón objetivo')

    const apagar = await jugar('all_off')
    expect(apagar.host.querySelector('.pattern-preview').textContent).toBe('')
  })

  it('escribe en las instrucciones el objetivo de cada modo', async () => {
    const texto = async (o) => (await jugar(o)).host.querySelector('#lo-instructions').textContent
    expect(await texto('all_off')).toContain('apagar todas las luces')
    expect(await texto('all_on')).toContain('encender todas las luces')
    expect(await texto('pattern_match')).toContain('reproducir exactamente el patrón')
  })
})
