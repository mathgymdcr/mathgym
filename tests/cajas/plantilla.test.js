import { describe, it, expect } from 'vitest'

// La mecánica de carga múltiple es nueva, así que la plantilla se prueba de
// verdad: clicks reales sobre el DOM, no un smoke de "renderiza algo".
const cargar = async () => (await import('../../plantillas/cajas.js'))

const payload = {
  variant: 'ligero',
  zonas: [[18, 4], [12, 9], [2]],
  nombresZonas: ['Zona A', 'Zona B', 'Zona C'],
  destino: 2,
  capacidad: 20,
  min_movimientos: 6
}

const montar = async (config = payload, hooks = {}) => {
  const mod = await cargar()
  const root = document.createElement('div')
  await mod.render(root, JSON.parse(JSON.stringify(config)), hooks)
  return root
}

const zona = (root, nombre) => root.querySelector(`.cajas-zona[data-zona="${nombre}"]`)
const pesos = (root, nombre) =>
  [...zona(root, nombre).querySelectorAll('.cajas-caja')].map((el) => Number(el.textContent.replace(/\D/g, '')))
const click = (root, nombre) => zona(root, nombre).click()

describe('plantillas/cajas.js con carga por kilos', () => {
  it('pinta cada zona con el reparto inicial, de abajo arriba', async () => {
    const root = await montar()
    expect(pesos(root, 'Zona A')).toEqual([18, 4])
    expect(pesos(root, 'Zona B')).toEqual([12, 9])
    expect(pesos(root, 'Zona C')).toEqual([2])
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })

  it('anuncia la capacidad de carga', async () => {
    const root = await montar()
    expect(root.querySelector('.cajas-info').textContent).toContain('20')
  })

  it('el primer click carga la caja de arriba y muestra sus kilos', async () => {
    const root = await montar()
    click(root, 'Zona A')
    expect(root.querySelectorAll('.cajas-caja.is-selected')).toHaveLength(1)
    expect(root.querySelector('.cajas-carga').textContent).toContain('4')
  })

  it('el segundo click en la misma zona añade la caja de debajo si cabe', async () => {
    // 9 + 12 = 21 kg no cabe en 20; 4 + 18 = 22 tampoco. Con la Zona C:
    // solo hay una caja, así que se prueba con una zona donde sí quepa.
    const root = await montar({ ...payload, zonas: [[18, 6, 4], [], [2]], capacidad: 20 })
    click(root, 'Zona A')
    click(root, 'Zona A')
    expect(root.querySelectorAll('.cajas-caja.is-selected')).toHaveLength(2)
    expect(root.querySelector('.cajas-carga').textContent).toContain('10')
  })

  it('no deja ampliar la carga por encima de la capacidad', async () => {
    const root = await montar()
    click(root, 'Zona A') // coge la de 4
    click(root, 'Zona A') // 4 + 18 = 22 > 20: no puede ampliar
    expect(root.querySelectorAll('.cajas-caja.is-selected')).toHaveLength(0)
  })

  it('deposita el bloque entero en la otra zona conservando el orden', async () => {
    const root = await montar({ ...payload, zonas: [[18, 6, 4], [], [2]], capacidad: 20 })
    click(root, 'Zona A')
    click(root, 'Zona A')
    click(root, 'Zona B')
    expect(pesos(root, 'Zona A')).toEqual([18])
    expect(pesos(root, 'Zona B')).toEqual([6, 4])
    expect(root.querySelector('.cajas-moves').textContent).toBe('1')
  })

  it('rechaza dejar el bloque sobre una caja más ligera', async () => {
    const root = await montar()
    click(root, 'Zona B') // coge la de 9
    click(root, 'Zona C') // encima de la de 2 kg: no aguanta
    expect(pesos(root, 'Zona C')).toEqual([2])
    expect(root.querySelector('.feedback.ko')).not.toBeNull()
    expect(root.querySelector('.cajas-moves').textContent).toBe('0')
  })

  it('muestra el mínimo real del JSON, no el 2^n - 1 de Hanói', async () => {
    const root = await montar()
    const info = root.querySelector('.cajas-info').textContent
    expect(info).toContain('6')
    expect(info).not.toContain('15')
  })

  it('avisa y llama a onSuccess cuando todas llegan al destino', async () => {
    let llamado = 0
    // Solo falta bajar la caja de 2 kg sobre la de 4 kg, que sí la aguanta.
    const root = await montar(
      { ...payload, zonas: [[2], [], [18, 12, 9, 4]], capacidad: 20, min_movimientos: 1 },
      { onSuccess: () => { llamado++ } }
    )
    click(root, 'Zona A')
    click(root, 'Zona C')
    expect(pesos(root, 'Zona C')).toEqual([18, 12, 9, 4, 2])
    expect(llamado).toBe(1)
  })

  it('sigue entendiendo el esquema antiguo de solo un número de cajas', async () => {
    const root = await montar({ cajas: 3, zonas: ['Zona A', 'Zona B', 'Zona C'], destino: 'Zona C' })
    expect(pesos(root, 'Zona A')).toEqual([3, 2, 1])
    expect(pesos(root, 'Zona B')).toEqual([])
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
})
