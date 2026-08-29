import { describe, it, expect } from 'vitest'
import { mensajeSocial, facetDelEnlace } from '../../scripts/publicar-social.js'
import { SITIO } from '../../compartir.js'
import { TIPOS } from '../../catalogo-tipos.js'

const reto = {
  fecha: '2026-08-28',
  titulo: 'Los Cuadrados Luminosos',
  tipo: 'luces-fuera',
  dificultad: 3,
  categorias: ['logica', 'tablero'],
  objectives: { parMoves: 10 }
}

describe('mensajeSocial', () => {
  it('dice qué reto es, con su número', () => {
    const texto = mensajeSocial(reto)
    expect(texto).toContain('MathGym #9')
    expect(texto).toContain('Los Cuadrados Luminosos')
  })

  it('no repite el nombre del tipo: el titulo del reto YA es el del catálogo', () => {
    // generarReto() escribe como `titulo` el `nombre` de la ficha del
    // catálogo, así que meter tipoInfo(tipo).nombre además del titulo
    // imprimiría la misma cadena dos veces.
    const texto = mensajeSocial(reto)
    expect(texto.split('Los Cuadrados Luminosos').length - 1).toBe(1)
  })

  it('enseña la dificultad en puntos y las categorías', () => {
    const texto = mensajeSocial(reto)
    expect(texto).toContain('●●●○○')
    expect(texto).toContain('logica · tablero')
  })

  it('sin categorías no deja el separador colgando', () => {
    const texto = mensajeSocial({ ...reto, categorias: [] })
    expect(texto).toContain('●●●○○')
    expect(texto).not.toMatch(/·\s*$/m)
  })

  it('acaba con el enlace de inicio', () => {
    expect(mensajeSocial(reto).trimEnd().endsWith(SITIO)).toBe(true)
  })

  it('NO destripa las pistas ni la solución', () => {
    const conPistas = { ...reto, hints: ['Empieza por la esquina de arriba a la izquierda'] }
    expect(mensajeSocial(conPistas)).not.toContain('esquina')
  })

  it('cabe en un post de Bluesky (300 caracteres) para cualquier tipo del catálogo', () => {
    for (const t of TIPOS) {
      const largo = mensajeSocial({ ...reto, tipo: t.tipo, titulo: t.nombre })
      expect([...largo].length).toBeLessThanOrEqual(300)
    }
  })

  it('no revienta con un reto sin dificultad', () => {
    const texto = mensajeSocial({ fecha: '2026-08-28', titulo: 'X', tipo: 'nonograma' })
    expect(texto).not.toMatch(/undefined|NaN/)
  })
})

describe('facetDelEnlace', () => {
  it('marca el enlace para que Bluesky lo haga clicable', () => {
    const texto = `Hola\n${SITIO}`
    const facet = facetDelEnlace(texto, SITIO)
    expect(facet.features[0].$type).toBe('app.bsky.richtext.facet#link')
    expect(facet.features[0].uri).toBe(SITIO)
  })

  it('los índices son BYTES UTF-8, no caracteres: con emojis delante no se descuadra', () => {
    // Bluesky corta por bytes. Si se le pasan índices de caracteres, un post
    // con un solo emoji delante deja el enlace partido por la mitad.
    const texto = `🧩 reto\n${SITIO}`
    const facet = facetDelEnlace(texto, SITIO)
    const bytes = new TextEncoder().encode(texto)
    const trozo = new TextDecoder().decode(bytes.slice(facet.index.byteStart, facet.index.byteEnd))
    expect(trozo).toBe(SITIO)
  })

  it('devuelve null si el enlace no está en el texto, en vez de un rango inventado', () => {
    expect(facetDelEnlace('sin enlace', SITIO)).toBeNull()
  })
})
