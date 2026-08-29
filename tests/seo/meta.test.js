import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Las etiquetas sociales son estáticas y viven en el <head>. Se comprueban
// con regex sobre el texto crudo, sin montar el HTML en happy-dom: el head
// trae <link rel="stylesheet"> de verdad (Google Fonts, style.css), y
// parsearlo como documento vivo hace que happy-dom intente cargarlas y
// reviente con un rechazo async ("Cannot read properties of null").
//
// __dirname (no import.meta.url) porque el URL global que trae happy-dom
// resuelve las relativas contra http://localhost:3000, no contra el archivo.

const raiz = path.resolve(__dirname, '../..')
const SITIO = 'https://mathgym.es/'

function cabecera(nombre) {
  const html = readFileSync(path.join(raiz, nombre), 'utf8')
  return html.match(/<head[^>]*>([\s\S]*)<\/head>/i)[1]
}

function meta(head, propiedad) {
  const re = new RegExp(`<meta[^>]*(?:property|name)=["']${propiedad}["'][^>]*content=["']([^"']*)["']`)
  const m = head.match(re)
  return m ? m[1] : null
}

function canonical(head) {
  const m = head.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/)
  return m ? m[1] : null
}

describe('metadatos sociales', () => {
  it('index.html trae la tarjeta completa con imagen absoluta', () => {
    const head = cabecera('index.html')
    expect(meta(head, 'og:type')).toBe('website')
    expect(meta(head, 'og:title')).toBeTruthy()
    expect(meta(head, 'og:description')).toBeTruthy()
    expect(meta(head, 'og:url')).toBe(SITIO)
    expect(meta(head, 'og:image')).toBe(SITIO + 'assets/og-mathgym.jpg')
    expect(meta(head, 'twitter:card')).toBe('summary_large_image')
  })

  it('archivo.html trae la suya, con su propia url', () => {
    const head = cabecera('archivo.html')
    expect(meta(head, 'og:url')).toBe(SITIO + 'archivo.html')
    expect(meta(head, 'og:image')).toBe(SITIO + 'assets/og-mathgym.jpg')
    expect(meta(head, 'twitter:card')).toBe('summary_large_image')
  })

  it('cada página se declara canónica de sí misma', () => {
    expect(canonical(cabecera('index.html'))).toBe(SITIO)
    expect(canonical(cabecera('archivo.html'))).toBe(SITIO + 'archivo.html')
  })

  it('la imagen social es absoluta en las dos: una relativa no la resuelve ningún scraper', () => {
    for (const pagina of ['index.html', 'archivo.html']) {
      expect(meta(cabecera(pagina), 'og:image').startsWith('https://')).toBe(true)
    }
  })

  it('index.html declara la app en JSON-LD y el JSON es válido', () => {
    const head = cabecera('index.html')
    const bloque = head.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/)
    expect(bloque).not.toBeNull()
    const datos = JSON.parse(bloque[1])
    expect(datos['@context']).toBe('https://schema.org')
    expect(datos['@type']).toBe('WebApplication')
    expect(datos.applicationCategory).toBe('GameApplication')
    expect(datos.url).toBe(SITIO)
    expect(datos.offers.price).toBe('0')
  })

  it('index.html enlaza el manifest, que hasta ahora existía sin que lo leyera nadie', () => {
    expect(cabecera('index.html')).toMatch(/<link[^>]*rel=["']manifest["']/)
  })
})

describe('manifest.json', () => {
  const manifest = JSON.parse(readFileSync(path.join(raiz, 'manifest.json'), 'utf8'))

  it('arranca en la raíz del dominio propio (mathgym.es), no en un subdirectorio', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
  })

  it('los iconos cuelgan de la raíz', () => {
    for (const icono of manifest.icons) {
      expect(icono.src.startsWith('/assets/')).toBe(true)
    }
  })
})
