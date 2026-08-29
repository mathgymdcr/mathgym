import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { celebrate } from '../../plantillas/celebration.js'
import { pintarCompartir, textoCompartible } from '../../compartir.js'

const reto = {
  fecha: '2026-08-28',
  titulo: 'Los Cuadrados Luminosos',
  tipo: 'luces-fuera',
  objectives: { parMoves: 10, maxMovesFor3Stars: 10, maxMovesFor2Stars: 13 }
}
const progreso = { currentStreak: 3, completed: { '2026-08-28': { estrellas: 3 } } }
const partida = { reto, estrellas: 3, marca: { movimientos: 10 }, progreso }

function montar() {
  celebrate({ ok: true, title: '¡Excelente trabajo!' })
  return pintarCompartir(partida)
}

describe('pintarCompartir', () => {
  let escrito

  beforeEach(() => {
    document.body.innerHTML = ''
    // celebrate() dibuja confeti en un canvas y happy-dom no trae uno: el
    // mismo doble que usa tests/estrellas/celebracion.test.js.
    window.HTMLCanvasElement.prototype.getContext = () => ({
      beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
      arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
    })
    escrito = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { escrito.push(t); return Promise.resolve() } }
    })
  })

  afterEach(() => {
    // Los relojes falsos solo los enciende quien los necesita (el test de
    // que no hay autocierre): mezclarlos con las promesas del portapapeles
    // solo da intermitencias.
    vi.useRealTimers()
    document.querySelectorAll('.celebration-overlay').forEach(o => o.remove())
  })

  it('se monta dentro de la tarjeta de celebración', () => {
    const bloque = montar()
    expect(bloque).not.toBeNull()
    expect(bloque.closest('.celebration-card')).not.toBeNull()
  })

  it('no se monta si no hay celebración en pantalla, en vez de reventar', () => {
    expect(pintarCompartir(partida)).toBeNull()
  })

  it('enseña el mismo texto que se va a copiar', () => {
    const bloque = montar()
    expect(bloque.querySelector('.compartir-preview').textContent)
      .toBe(textoCompartible(partida))
  })

  it('al pulsar, copia ese texto al portapapeles', async () => {
    const bloque = montar()
    bloque.querySelector('[data-action="compartir"]').click()
    await vi.waitFor(() => expect(escrito.length).toBe(1))
    expect(escrito[0]).toBe(textoCompartible(partida))
  })

  it('confirma la copia en el propio botón', async () => {
    const bloque = montar()
    const boton = bloque.querySelector('[data-action="compartir"]')
    boton.click()
    await vi.waitFor(() => expect(boton.textContent).toContain('Copiado'))
  })

  it('si el portapapeles falla, lo dice en vez de fingir que copió', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denegado')) }
    })
    const bloque = montar()
    const boton = bloque.querySelector('[data-action="compartir"]')
    boton.click()
    await vi.waitFor(() => expect(boton.textContent).toContain('a mano'))
  })

  it('pulsarlo NO cierra la celebración: el overlay se cierra a cualquier clic', () => {
    const bloque = montar()
    bloque.querySelector('[data-action="compartir"]').click()
    expect(document.querySelector('.celebration-overlay')).not.toBeNull()
  })

  it('sin tocar nada, la celebración no se cierra sola: hace falta tocarla', () => {
    vi.useFakeTimers()
    montar()
    vi.advanceTimersByTime(20000)
    expect(document.querySelector('.celebration-overlay')).not.toBeNull()
  })

  it('un clic fuera del bloque sigue cerrando, como siempre', () => {
    montar()
    document.querySelector('.celebration-overlay').click()
    expect(document.querySelector('.celebration-overlay')).toBeNull()
  })
})
