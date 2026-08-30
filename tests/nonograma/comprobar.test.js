import { describe, it, expect, vi } from 'vitest'

// Grid 3x2 monocromo: solo se pinta la columna 0 en las tres filas. Con más
// de dos celdas por pintar, completar dos filas no termina el reto entero
// (evita disparar la celebración final, que happy-dom no sabe montar).
const GRID = [
  [1, 0],
  [1, 0],
  [1, 0]
]

async function montar(dificultad) {
  const mod = await import('../../plantillas/nonograma.js')
  const root = document.createElement('div')
  await mod.render(root, { variant: 'test', rows: 3, cols: 2, grid: GRID, dificultad }, {})
  return root
}

function primeraFilaEsDone(root) {
  return root.querySelectorAll('.nono-clue-row')[0].classList.contains('is-done')
}

function pintarCelda(root, r, c) {
  const cell = root.querySelectorAll('.nono-cell')[r * 2 + c]
  cell.dispatchEvent(new Event('click', { bubbles: true }))
}

describe('boton Comprobar segun dificultad', () => {
  it('el boton Comprobar existe en cualquier nivel', async () => {
    const root = await montar(1)
    expect([...root.querySelectorAll('button')].some((b) => b.textContent === 'Comprobar')).toBe(true)
  })

  it('sin dificultad, el acierto se ve en vivo (comportamiento previo)', async () => {
    const root = await montar(undefined)
    pintarCelda(root, 0, 0)
    expect(primeraFilaEsDone(root)).toBe(true)
  })

  it('en nivel 1-2, el acierto se ve en vivo sin pulsar Comprobar', async () => {
    const root = await montar(2)
    pintarCelda(root, 0, 0)
    expect(primeraFilaEsDone(root)).toBe(true)
  })

  it('en nivel 3+, el acierto NO se ve hasta pulsar Comprobar', async () => {
    const root = await montar(3)
    pintarCelda(root, 0, 0)
    expect(primeraFilaEsDone(root)).toBe(false)

    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar')
    btn.dispatchEvent(new Event('click', { bubbles: true }))
    expect(primeraFilaEsDone(root)).toBe(true)
  })

  it('en nivel 3+, editar otra celda borra el verde hasta volver a comprobar', async () => {
    const root = await montar(3)
    pintarCelda(root, 0, 0)
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar')
    btn.dispatchEvent(new Event('click', { bubbles: true }))
    expect(primeraFilaEsDone(root)).toBe(true)

    pintarCelda(root, 1, 0)
    expect(primeraFilaEsDone(root)).toBe(false)
  })

  it('con json_url, la dificultad de fuera sobrevive al fetch del payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ variant: 'test', rows: 3, cols: 2, grid: GRID })
    })))
    try {
      const mod = await import('../../plantillas/nonograma.js')
      const root = document.createElement('div')
      await mod.render(root, { json_url: 'data/nonograma_x.json', dificultad: 3 }, {})

      pintarCelda(root, 0, 0)
      expect(primeraFilaEsDone(root)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
