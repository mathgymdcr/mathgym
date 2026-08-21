import { describe, it, expect } from 'vitest'
import { TIPOS } from '../../catalogo-tipos.js'
import { metaDeReto, diasDelCarne, tiposPorGrupo, GRUPOS } from '../../home.js'

// La home v2 pinta con datos reales lo que el mockup traía escrito a mano.
// Estas son las tres derivaciones que hacen falta, separadas del DOM para
// poder comprobarlas sin montar la página.

describe('metaDeReto', () => {
  const base = { tipo: 'puentes-hashi', dificultad: 2, categorias: ['logica', 'grafos'] }

  it('saca el mínimo de jugadas del par, que es lo que guardan casi todos', () => {
    const meta = metaDeReto({ ...base, objectives: { parMoves: 12 } })
    expect(meta.minimo).toEqual({ valor: 12, unidad: 'movimientos' })
  })

  it('en el enigma el mínimo son las pistas, no los movimientos', () => {
    const meta = metaDeReto({ tipo: 'enigma-einstein', dificultad: 3, objectives: { numPistas: 11 } })
    expect(meta.minimo).toEqual({ valor: 11, unidad: 'pistas' })
  })

  it('en la balanza son las pesadas', () => {
    const meta = metaDeReto({ tipo: 'balanza-logica', dificultad: 3, objectives: { maxWeighingsFor3Stars: 3 } })
    expect(meta.minimo).toEqual({ valor: 3, unidad: 'pesadas' })
  })

  it('se calla el dato en vez de inventarlo si el reto no lo trae', () => {
    expect(metaDeReto({ ...base, objectives: {} }).minimo).toBeNull()
    expect(metaDeReto({ ...base }).minimo).toBeNull()
  })

  it('pasa dificultad y categorías tal cual', () => {
    const meta = metaDeReto({ ...base, objectives: { parMoves: 4 } })
    expect(meta.dificultad).toBe(2)
    expect(meta.categorias).toEqual(['logica', 'grafos'])
  })
})

describe('diasDelCarne', () => {
  // "Hoy" es la fecha del reto del día, no la del reloj del navegador: así el
  // carné no se desfasa con el reto cuando cambia el día en Madrid pero no en
  // UTC (o al revés).
  it('devuelve los siete últimos días, con hoy el último', () => {
    const dias = diasDelCarne('2026-08-21', {})
    expect(dias).toHaveLength(7)
    expect(dias[0].fecha).toBe('2026-08-15')
    expect(dias[6].fecha).toBe('2026-08-21')
    expect(dias[6].esHoy).toBe(true)
    expect(dias.filter((d) => d.esHoy)).toHaveLength(1)
  })

  it('marca hecho el día que está en el progreso', () => {
    const dias = diasDelCarne('2026-08-21', { '2026-08-19': { tipo: 'nonograma' } })
    expect(dias.find((d) => d.fecha === '2026-08-19').hecho).toBe(true)
    expect(dias.find((d) => d.fecha === '2026-08-18').hecho).toBe(false)
  })

  it('cruza el cambio de mes sin saltarse días', () => {
    const dias = diasDelCarne('2026-03-02', {})
    expect(dias.map((d) => d.fecha)).toEqual([
      '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'
    ])
  })

  it('da la inicial del día de la semana en castellano', () => {
    // 2026-08-21 es viernes.
    expect(diasDelCarne('2026-08-21', {})[6].inicial).toBe('V')
  })
})

describe('tiposPorGrupo', () => {
  it('reparte los doce tipos sin perder ni repetir ninguno', () => {
    const repartidos = tiposPorGrupo().flatMap((g) => g.tipos.map((t) => t.tipo))
    expect(repartidos.sort()).toEqual(TIPOS.map((t) => t.tipo).sort())
  })

  it('respeta el orden de grupos del diseño', () => {
    expect(tiposPorGrupo().map((g) => g.grupo)).toEqual(GRUPOS)
  })

  it('no deja ningún grupo vacío', () => {
    for (const g of tiposPorGrupo()) {
      expect(g.tipos.length, g.grupo).toBeGreaterThan(0)
    }
  })
})
