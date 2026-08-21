import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TIPOS } from '../../catalogo-tipos.js'

// Este test es la única red que cubre TODAS las plantillas, incluidas las
// cuatro que no tienen generador y que hasta ahora no probaba nadie: si
// alguien rompe una, aquí salta.

const raiz = path.resolve(__dirname, '../..')

describe('catálogo del muestrario', () => {
  it('cubre exactamente los tipos registrados en plantillas/base.js', async () => {
    const src = await fs.readFile(path.join(raiz, 'plantillas/base.js'), 'utf8')
    const registrados = src.split('\n')
      .filter((linea) => /=>\s*import\(/.test(linea) && !linea.includes('alias legado'))
      .map((linea) => linea.match(/'([^']+)'/)[1])

    expect([...new Set(TIPOS.map((t) => t.tipo))].sort()).toEqual([...new Set(registrados)].sort())
  })

  it('describe cada tipo con nombre, icono y resumen', () => {
    for (const t of TIPOS) {
      expect(t.nombre, t.tipo).toBeTruthy()
      expect(t.icono, t.tipo).toBeTruthy()
      expect(t.resumen.length, t.tipo).toBeGreaterThan(20)
      expect(typeof t.generado, t.tipo).toBe('boolean')
    }
  })
})

describe('muestras de data/muestra', () => {
  let Templates

  beforeAll(async () => {
    // happy-dom no implementa <canvas>, y poligono_geometrico.js dibuja la
    // retícula ahí. Se le da un contexto 2D de mentira -- solo los métodos
    // que usa -- para poder comprobar que la plantilla monta. Lo que se
    // pinta dentro del canvas queda fuera de este test por definición.
    window.HTMLCanvasElement.prototype.getContext = () => ({
      beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: ''
    })

    await import('../../plantillas/base.js')
    Templates = window.Templates
  })

  it('hay un JSON de muestra por cada tipo', async () => {
    for (const t of TIPOS) {
      const ruta = path.join(raiz, 'data/muestra', `${t.tipo}.json`)
      const contenido = JSON.parse(await fs.readFile(ruta, 'utf8'))
      expect(contenido, t.tipo).toBeTruthy()
    }
  })

  it('cada plantilla monta su muestra sin reventar', async () => {
    for (const t of TIPOS) {
      const data = JSON.parse(await fs.readFile(path.join(raiz, 'data/muestra', `${t.tipo}.json`), 'utf8'))
      const host = document.createElement('div')
      await Templates.render(t.tipo, data, host, {})

      // base.js se traga las excepciones y pinta su propio aviso, así que
      // no basta con que no lance: hay que mirar lo que ha quedado en el DOM.
      expect(host.innerHTML, `${t.tipo}: plantilla vacía`).not.toBe('')
      expect(host.innerHTML, `${t.tipo}: error de carga`).not.toContain('Error al cargar la plantilla')
      expect(host.querySelector('.feedback.ko'), `${t.tipo}: config rechazada`).toBeNull()
    }
  })
})
