import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TIPOS } from '../../catalogo-tipos.js'

// Los ejemplos de prueba dejan de vivir en una página aparte: se abren desde
// la propia portada, en el mismo hueco donde se monta el reto del día. Lo que
// no puede pasar es que jugar un ejemplo cuente como haber entrenado hoy.

const raiz = path.resolve(__dirname, '../..')
const TIPO_EJEMPLO = 'luces-fuera'

const RETO = {
  fecha: '2026-08-21',
  tipo: 'nonograma',
  titulo: 'Objeto Oculto',
  dificultad: 3,
  categorias: ['logica'],
  objectives: { parMoves: 14 },
  data: {}
}

describe('ejemplos de prueba desde la portada', () => {
  beforeEach(async () => {
    const html = await fs.readFile(path.join(raiz, 'index.html'), 'utf8')
    document.body.innerHTML = html
      .match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
    localStorage.clear()
    window.happyDOM.setURL('http://localhost/')
    vi.resetModules()

    // El payload del ejemplo se lee del archivo de verdad: así el test monta
    // la plantilla real y no una maqueta que podría no parecerse.
    vi.stubGlobal('fetch', vi.fn(async (ruta) => {
      if (String(ruta).includes('data/muestra/')) {
        const tipo = String(ruta).split('/').pop().replace('.json', '')
        const crudo = await fs.readFile(path.join(raiz, 'data/muestra', `${tipo}.json`), 'utf8')
        return { ok: true, json: async () => JSON.parse(crudo) }
      }
      return { ok: true, json: async () => RETO }
    }))
    window.HTMLCanvasElement.prototype.getContext = () => ({
      beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
      arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.happyDOM.setURL('http://localhost/')
  })

  const abrirPortada = async () => {
    await import('../../script.js')
    await vi.waitFor(() => {
      expect(document.querySelector('.exercise')).not.toBeNull()
    })
  }

  const fichaDe = (tipo) => document.querySelector(`.exercise[href="?tipo=${tipo}"]`)

  it('cada ficha de ejercicio apunta a su ejemplo, no a una página aparte', async () => {
    await abrirPortada()
    for (const t of TIPOS) {
      expect(fichaDe(t.tipo), `${t.tipo}: sin enlace a su ejemplo`).not.toBeNull()
    }
  })

  it('al pinchar una ficha aparta la sala y monta el ejemplo', async () => {
    await abrirPortada()
    fichaDe(TIPO_EJEMPLO).click()

    const cont = document.getElementById('contenedor-interactivo')
    // El montaje de la plantilla es asíncrono: se espera a su cabecera, no a
    // que la sala se esconda, que pasa antes.
    await vi.waitFor(() => {
      expect(cont.querySelector('.enigma-header-dark h2')).not.toBeNull()
    })
    expect(document.getElementById('sala').style.display).toBe('none')
    expect(cont.style.display).toBe('block')
    expect(cont.innerHTML).not.toContain('Error al cargar la plantilla')
  })

  it('deja el tipo en la URL para poder enlazarlo', async () => {
    // happy-dom no refleja pushState en `location`, así que se comprueba la
    // llamada a la API del navegador, que es el efecto que importa aquí.
    const push = vi.spyOn(history, 'pushState')
    await abrirPortada()
    fichaDe(TIPO_EJEMPLO).click()
    await vi.waitFor(() => {
      expect(push).toHaveBeenCalledWith({}, '', `?tipo=${TIPO_EJEMPLO}`)
    })
  })

  it('avisa de que es una prueba y ofrece volver a la sala', async () => {
    await abrirPortada()
    fichaDe(TIPO_EJEMPLO).click()
    await vi.waitFor(() => {
      expect(document.querySelector('.aviso-ejemplo')).not.toBeNull()
    })
    expect(document.querySelector('.aviso-ejemplo').textContent).toMatch(/racha/i)
    expect(document.querySelector('[data-action="volver"]')).not.toBeNull()
  })

  it('volver a la sala la devuelve y limpia la URL', async () => {
    await abrirPortada()
    fichaDe(TIPO_EJEMPLO).click()
    await vi.waitFor(() => {
      expect(document.querySelector('[data-action="volver"]')).not.toBeNull()
    })

    const push = vi.spyOn(history, 'pushState')
    document.querySelector('[data-action="volver"]').click()
    await vi.waitFor(() => {
      expect(document.getElementById('sala').style.display).not.toBe('none')
    })
    expect(push).toHaveBeenCalledWith({}, '', './')
    expect(document.querySelector('.workout-name')).not.toBeNull()
  })

  it('jugar un ejemplo no cuenta como haber entrenado hoy', async () => {
    await abrirPortada()
    fichaDe(TIPO_EJEMPLO).click()
    await vi.waitFor(() => {
      expect(document.querySelector('.aviso-ejemplo')).not.toBeNull()
    })

    // El progreso solo se toca al resolver el reto DEL DÍA; un ejemplo no debe
    // dejar rastro ni aunque se resuelva entero.
    const { getProgress } = await import('../../progress.js')
    expect(getProgress().currentStreak).toBe(0)
    expect(Object.keys(getProgress().completed)).toHaveLength(0)
  })

  it('abrir directamente ?tipo= monta el ejemplo sin pasar por la sala', async () => {
    window.happyDOM.setURL(`http://localhost/?tipo=${TIPO_EJEMPLO}`)
    await import('../../script.js')
    await vi.waitFor(() => {
      expect(document.querySelector('.aviso-ejemplo')).not.toBeNull()
    })
    expect(document.getElementById('contenedor-interactivo').style.display).toBe('block')
  })
})
