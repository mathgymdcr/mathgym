import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TIPOS } from '../../catalogo-tipos.js'

// Comprueba que index.html y script.js encajan de verdad con home.js: que los
// contenedores que el script busca existen en el HTML, que la sala se pinta
// sola al abrir la portada, y que "Empezar serie" la aparta y monta el reto.

const raiz = path.resolve(__dirname, '../..')

const RETO = {
  fecha: '2026-08-21',
  tipo: 'nonograma',
  titulo: 'Objeto Oculto',
  dificultad: 3,
  categorias: ['logica'],
  objectives: { parMoves: 14 },
  data: {}
}

describe('index.html + script.js', () => {
  let html

  beforeEach(async () => {
    html = await fs.readFile(path.join(raiz, 'index.html'), 'utf8')
    // Solo el cuerpo: montar el <head> haría que happy-dom intentara bajarse
    // la hoja de estilos y las fuentes de Google.
    document.body.innerHTML = html
      .match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
      // Fuera los <script>: aquí el módulo se importa a mano, y si se dejan,
      // happy-dom intenta bajárselos por HTTP.
      .replace(/<script[\s\S]*?<\/script>/gi, '')
    localStorage.clear()
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => RETO })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('trae los contenedores que script.js necesita', () => {
    expect(document.getElementById('sala'), 'falta #sala').not.toBeNull()
    expect(document.getElementById('contenedor-interactivo'), 'falta #contenedor-interactivo').not.toBeNull()
    expect(document.getElementById('streak-badge'), 'falta #streak-badge').not.toBeNull()
  })

  it('carga los pesos de fuente que usa la hoja de estilos', () => {
    // El diseño pide Lexend 700 (los nombres de ejercicio) y JetBrains Mono
    // 700 (las cifras del carné): sin ellos el navegador los finge.
    expect(html).toMatch(/Lexend:wght@[^&"]*700/)
    expect(html).toMatch(/JetBrains\+Mono:wght@[^&"]*700/)
  })

  it('pinta la sala con el reto del día al abrir la portada', async () => {
    await import('../../script.js')
    await vi.waitFor(() => {
      expect(document.querySelector('.workout-name')).not.toBeNull()
    })
    expect(document.querySelector('.workout-name').textContent).toBe('Objeto Oculto')
    expect(document.querySelectorAll('.exercise')).toHaveLength(TIPOS.length)
    expect(document.getElementById('contenedor-interactivo').style.display).toBe('none')
  })

  it('al pulsar "Empezar serie" aparta la sala y monta el reto', async () => {
    await import('../../script.js')
    await vi.waitFor(() => {
      expect(document.querySelector('.cta')).not.toBeNull()
    })

    document.querySelector('.cta').click()

    await vi.waitFor(() => {
      expect(document.getElementById('sala').style.display).toBe('none')
    })
    expect(document.getElementById('contenedor-interactivo').style.display).toBe('block')
  })
})
