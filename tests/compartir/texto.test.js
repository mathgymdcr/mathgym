import { describe, it, expect } from 'vitest'
import { numeroDeReto, tiraDelCarne, textoCompartible, SITIO, EPOCA } from '../../compartir.js'
import { diasDelCarne } from '../../home.js'
import { SITIO as SITIO_SITEMAP } from '../../scripts/generate-sitemap.js'

describe('la URL del sitio', () => {
  it('es la misma en el navegador y en el generador del sitemap', () => {
    // Está escrita en dos sitios a propósito: scripts/generate-sitemap.js se
    // creó antes que compartir.js y no debe depender de él. Este test es lo
    // que impide que las dos copias se separen.
    expect(SITIO).toBe(SITIO_SITEMAP)
  })

  it('acaba en barra: todo lo demás se concatena detrás', () => {
    expect(SITIO.endsWith('/')).toBe(true)
  })
})

describe('numeroDeReto', () => {
  it('el primer reto del archivo es el #1', () => {
    expect(numeroDeReto(EPOCA)).toBe(1)
  })

  it('cuenta días, no entradas del archivo: un día sin publicar no descuadra la serie', () => {
    expect(numeroDeReto('2026-08-28')).toBe(9)
    expect(numeroDeReto('2026-09-19')).toBe(31)
  })

  it('cruza el cambio de mes y de año sin desviarse', () => {
    expect(numeroDeReto('2026-09-01')).toBe(13)
    expect(numeroDeReto('2027-08-20')).toBe(366)
  })

  it('devuelve null antes de la época, en vez de un número negativo sin sentido', () => {
    expect(numeroDeReto('2026-08-19')).toBeNull()
    expect(numeroDeReto('2020-01-01')).toBeNull()
  })
})

describe('tiraDelCarne', () => {
  const dia = (hecho, estrellas) => ({ hecho, estrellas })

  it('un emoji por día, siempre siete', () => {
    const dias = Array.from({ length: 7 }, () => dia(false, 0))
    expect([...tiraDelCarne(dias)].length).toBe(7)
  })

  it('cada marca tiene su color y el día sin hacer se ve vacío', () => {
    expect(tiraDelCarne([dia(true, 3)])).toBe('🟩')
    expect(tiraDelCarne([dia(true, 2)])).toBe('🟨')
    expect(tiraDelCarne([dia(true, 1)])).toBe('🟧')
    expect(tiraDelCarne([dia(false, 0)])).toBe('⬜')
  })

  it('un día completado antes de que existieran las estrellas se ve hecho, no vacío', () => {
    // progress.js guarda esos días sin `estrellas`: dárselos por no hechos
    // sería borrarle a alguien una racha que sí hizo.
    expect(tiraDelCarne([dia(true, 0)])).toBe('🟦')
  })

  it('encadena la semana en orden', () => {
    const semana = [dia(true, 3), dia(true, 3), dia(false, 0), dia(true, 1), dia(true, 2), dia(true, 3), dia(true, 3)]
    expect(tiraDelCarne(semana)).toBe('🟩🟩⬜🟧🟨🟩🟩')
  })
})

describe('textoCompartible', () => {
  const reto = {
    fecha: '2026-08-28',
    titulo: 'Los Cuadrados Luminosos',
    tipo: 'luces-fuera',
    objectives: { parMoves: 10, maxMovesFor3Stars: 10, maxMovesFor2Stars: 13 }
  }
  const progreso = {
    currentStreak: 3,
    completed: {
      '2026-08-26': { estrellas: 3 },
      '2026-08-27': { estrellas: 2 },
      '2026-08-28': { estrellas: 3 }
    }
  }

  it('abre con el número y el título del reto', () => {
    const texto = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 }, progreso })
    expect(texto.split('\n')[0]).toBe('MathGym #9 · Los Cuadrados Luminosos')
  })

  it('enseña las estrellas ganadas y la marca frente al mínimo', () => {
    const texto = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 }, progreso })
    expect(texto).toContain('⭐⭐⭐ · 10 movimientos (mínimo 10)')
  })

  it('con dos estrellas pinta dos, no tres', () => {
    const texto = textoCompartible({ reto, estrellas: 2, marca: { movimientos: 12 }, progreso })
    expect(texto).toContain('⭐⭐ · 12 movimientos (mínimo 10)')
    expect(texto).not.toContain('⭐⭐⭐')
  })

  it('la balanza se cuenta en pesadas, no en movimientos', () => {
    const balanza = { fecha: '2026-08-28', titulo: 'Descubre el impostor', tipo: 'balanza-logica',
                      objectives: { maxWeighingsFor3Stars: 3 } }
    const texto = textoCompartible({ reto: balanza, estrellas: 3, marca: { pesadas: 3 }, progreso })
    expect(texto).toContain('⭐⭐⭐ · 3 pesadas (mínimo 3)')
  })

  it('un tipo que se mide por fallos no inventa una marca: solo estrellas', () => {
    // El enigma y el polígono no tienen nada que optimizar salvo acertar, y
    // parDe() devuelve null a propósito para no enseñar "0 fallos de 0".
    const enigma = { fecha: '2026-08-28', titulo: 'Resuelve el enigma', tipo: 'enigma-einstein',
                     objectives: { maxErrorsFor3Stars: 0 } }
    const texto = textoCompartible({ reto: enigma, estrellas: 3, marca: { fallos: 0 }, progreso })
    expect(texto).toContain('⭐⭐⭐')
    expect(texto).not.toContain('mínimo')
    expect(texto).not.toContain('undefined')
  })

  it('la tira del carné es la de los 7 días que acaban en la fecha DEL RETO', () => {
    const texto = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 }, progreso })
    expect(texto).toContain(tiraDelCarne(diasDelCarne('2026-08-28', progreso.completed)))
  })

  it('la racha se enseña solo si la hay', () => {
    const con = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 }, progreso })
    expect(con).toContain('🔥 3')
    const sin = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 },
                                   progreso: { currentStreak: 0, completed: {} } })
    expect(sin).not.toContain('🔥')
  })

  it('cierra SIEMPRE con el enlace de inicio, nunca con el del día', () => {
    // El og:image cacheado tiene que ser el mismo en todos los links que se
    // comparten: si cada día se comparte otra URL, ningún caché se calienta.
    const texto = textoCompartible({ reto, estrellas: 3, marca: { movimientos: 10 }, progreso })
    expect(texto.trimEnd().endsWith(SITIO)).toBe(true)
    expect(texto).not.toContain('?fecha=')
  })

  it('aguanta un reto sin objectives y otro sin marca sin escupir undefined ni NaN', () => {
    const pelado = { fecha: '2026-08-28', titulo: 'Sin metas', tipo: 'nonograma' }
    const texto = textoCompartible({ reto: pelado, estrellas: 1, marca: {}, progreso })
    expect(texto).not.toMatch(/undefined|NaN|null/)
    expect(texto).toContain('MathGym #9')
  })
})
