import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { construirSitemap, SITIO } from '../../scripts/generate-sitemap.js'
import { TIPOS } from '../../catalogo-tipos.js'

const raiz = path.resolve(__dirname, '../..')
const TIPOS_SLUG = TIPOS.map(t => t.tipo)

describe('construirSitemap', () => {
  const xml = construirSitemap(TIPOS_SLUG, ['2026-08-20', '2026-08-21'], '2026-08-21')

  it('lleva las dos páginas reales del sitio', () => {
    expect(xml).toContain(`<loc>${SITIO}</loc>`)
    expect(xml).toContain(`<loc>${SITIO}archivo.html</loc>`)
  })

  it('no lleva el muestrario, que se eliminó del sitio', () => {
    expect(xml).not.toContain('muestrario')
  })

  it('lleva el ejemplo de cada uno de los 12 tipos', () => {
    for (const tipo of TIPOS_SLUG) {
      expect(xml).toContain(`<loc>${SITIO}?tipo=${tipo}</loc>`)
    }
  })

  it('lleva un reto del archivo por fecha, con su fecha como lastmod', () => {
    expect(xml).toContain(`<loc>${SITIO}?fecha=2026-08-20</loc>`)
    expect(xml).toContain(`<loc>${SITIO}?fecha=2026-08-21</loc>`)
    expect(xml).toMatch(/\?fecha=2026-08-20<\/loc>\s*<lastmod>2026-08-20<\/lastmod>/)
  })

  it('la portada se marca modificada hoy: cambia cada día con el reto', () => {
    expect(xml).toMatch(/<loc>https:\/\/[^<]*mathgym\/<\/loc>\s*<lastmod>2026-08-21<\/lastmod>/)
  })

  it('es XML bien formado y con el namespace que pide el estándar', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    const abiertas = (xml.match(/<url>/g) || []).length
    const cerradas = (xml.match(/<\/url>/g) || []).length
    expect(abiertas).toBe(cerradas)
    expect(abiertas).toBe(2 + TIPOS_SLUG.length + 2)
  })

  it('sin fechas de archivo sigue saliendo un sitemap válido', () => {
    const solo = construirSitemap(TIPOS_SLUG, [], '2026-08-21')
    expect((solo.match(/<url>/g) || []).length).toBe(2 + TIPOS_SLUG.length)
  })
})

describe('robots.txt', () => {
  const ruta = path.join(raiz, 'robots.txt')

  it('existe', () => {
    expect(existsSync(ruta)).toBe(true)
  })

  it('deja pasar a todo el mundo y apunta al sitemap con la ruta del subdirectorio', () => {
    const texto = readFileSync(ruta, 'utf8')
    expect(texto).toContain('User-agent: *')
    expect(texto).toContain('Allow: /')
    expect(texto).toContain(`Sitemap: ${SITIO}sitemap.xml`)
  })
})
