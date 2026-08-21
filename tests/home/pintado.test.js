import { describe, it, expect, beforeEach } from 'vitest'
import { TIPOS } from '../../catalogo-tipos.js'
import { pintarSala } from '../../home.js'

// El mockup traía los textos escritos a mano; aquí se comprueba que en la home
// real salen del reto del día y del catálogo, sin literales duplicados.

const RETO = {
  fecha: '2026-08-21',
  tipo: 'enigma-einstein',
  titulo: 'Resuelve el enigma',
  dificultad: 3,
  categorias: ['deduccion', 'logica'],
  objectives: { numPistas: 11 }
}

const PROGRESO = { completed: { '2026-08-19': { tipo: 'nonograma' } }, currentStreak: 4, bestStreak: 9 }

describe('pintarSala', () => {
  let root

  beforeEach(() => {
    root = document.createElement('div')
  })

  it('anuncia el reto del día con su nombre y el resumen de su tipo', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    const tipo = TIPOS.find((t) => t.tipo === RETO.tipo)
    expect(root.querySelector('.workout-name').textContent).toBe(RETO.titulo)
    expect(root.querySelector('.workout-desc').textContent).toBe(tipo.resumen)
  })

  it('pinta la dificultad sobre la escala de 5 que usa el archivo', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    const puntos = root.querySelectorAll('.difficulty-dots span')
    expect(puntos).toHaveLength(5)
    expect(root.querySelectorAll('.difficulty-dots span.on')).toHaveLength(3)
  })

  it('enseña el mínimo con la unidad que le toca al tipo', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    expect(root.querySelector('.meta-row').textContent).toContain('11')
    expect(root.querySelector('.meta-row').textContent).toContain('pistas')
  })

  it('omite el mínimo en vez de dejar un hueco vacío si el reto no lo trae', () => {
    pintarSala(root, { reto: { ...RETO, objectives: {} }, progreso: PROGRESO })
    expect(root.querySelector('.meta-row').textContent).not.toContain('undefined')
    expect(root.querySelector('[data-meta="minimo"]')).toBeNull()
  })

  it('marca en el carné hoy y los días completados', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    const punches = root.querySelectorAll('.punch')
    expect(punches).toHaveLength(7)
    expect(root.querySelectorAll('.punch.today')).toHaveLength(1)
    expect(punches[6].classList.contains('today')).toBe(true)
    expect(root.querySelectorAll('.punch.done')).toHaveLength(1)
  })

  it('enseña la racha actual y la mejor', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    const counts = root.querySelector('.streak-counts').textContent
    expect(counts).toContain('4')
    expect(counts).toContain('9')
  })

  it('lista los doce tipos repartidos en sus grupos, enlazados a su ejemplo', () => {
    pintarSala(root, { reto: RETO, progreso: PROGRESO })
    const fichas = root.querySelectorAll('.exercise')
    expect(fichas).toHaveLength(TIPOS.length)
    expect(root.querySelectorAll('.group')).toHaveLength(4)
    for (const ficha of fichas) {
      expect(ficha.getAttribute('href')).toBe(`?tipo=${ficha.dataset.tipo}`)
    }
  })

  it('no se cae si el reto no se pudo cargar: lo dice donde va el nombre', () => {
    pintarSala(root, { reto: null, progreso: PROGRESO })
    expect(root.querySelector('.workout-name').textContent).toMatch(/no se pudo cargar/i)
    // El resto de la sala sigue en pie.
    expect(root.querySelectorAll('.exercise')).toHaveLength(TIPOS.length)
    expect(root.querySelectorAll('.punch')).toHaveLength(7)
  })
})

describe('el bocadillo de Deceerre', () => {
  it('no asoma las pistas del reto: son media solución y esto es la portada', () => {
    const root = document.createElement('div')
    const conPistas = { ...RETO, hints: ['Empieza por la anilla 4, y luego la 1.'] }
    pintarSala(root, { reto: conPistas, progreso: PROGRESO })
    expect(root.querySelector('.coach-bubble').textContent).not.toContain('anilla 4')
  })
})
