import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

const PAYLOAD = {
  variant: 'huerto',
  cycles: 5,
  capacity: 1,
  descanso: true,
  plants: [
    { id: 'Albahaca', doses: 2, ventana: [0, 2, 3] },
    { id: 'Cactus', doses: 2, ventana: [1, 3, 4] }
  ]
}

const montar = async (config = PAYLOAD, hooks = {}) => {
  const mod = await import('../../plantillas/riego_plantas.js')
  const root = document.createElement('div')
  await mod.render(root, JSON.parse(JSON.stringify(config)), hooks)
  return root
}

const celda = (root, fila, ciclo) =>
  root.querySelector(`.riego-cell[data-planta="${fila}"][data-ciclo="${ciclo}"]`)

describe('plantillas/riego_plantas.js con ventanas y descanso', () => {
  it('usa el shell estándar del resto del catálogo', async () => {
    const root = await montar()
    expect(root.querySelector('.template-box'), 'sin caja estándar').not.toBeNull()
    expect(root.textContent).toContain('Cómo se juega')
  })

  it('marca como no disponibles los ciclos fuera de la ventana de cada planta', async () => {
    const root = await montar()
    expect(celda(root, 0, 1).classList.contains('is-blocked'), 'ciclo 2 no está en la ventana').toBe(true)
    expect(celda(root, 0, 0).classList.contains('is-blocked')).toBe(false)

    celda(root, 0, 1).click()
    expect(celda(root, 0, 1).classList.contains('is-on'), 'una celda bloqueada no debe regarse').toBe(false)
  })

  it('cuenta las dosis de cada planta al regar', async () => {
    const root = await montar()
    celda(root, 0, 0).click()
    expect(root.querySelector('.riego-planta-0 .riego-dosis').textContent).toBe('1/2')
  })

  it('avisa si se riega dos ciclos seguidos', async () => {
    const root = await montar()
    celda(root, 0, 2).click()
    celda(root, 0, 3).click()
    expect(root.querySelector('.feedback.ko'), 'no avisó del riego seguido').not.toBeNull()
    expect(root.textContent.toLowerCase()).toContain('seguidos')
  })

  it('avisa si un ciclo se pasa de capacidad', async () => {
    const root = await montar()
    celda(root, 0, 3).click()
    celda(root, 1, 3).click()   // capacidad 1: dos riegos en el ciclo 4
    expect(root.querySelector('.feedback.ko')).not.toBeNull()
    expect(root.textContent.toLowerCase()).toContain('capacidad')
  })

  it('gana al completar el calendario válido y llama a onSuccess una vez', async () => {
    let ganado = 0
    const root = await montar(PAYLOAD, { onSuccess: () => { ganado++ } })
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    expect(ganado, 'no dio la victoria con el calendario correcto').toBe(1)
  })

  it('no canta victoria si las dosis cuadran pero se riega dos seguidos', async () => {
    let ganado = 0
    const root = await montar({
      ...PAYLOAD,
      capacity: 2,
      plants: [{ id: 'Menta', doses: 2, ventana: [0, 1, 3] }]
    }, { onSuccess: () => { ganado++ } })
    celda(root, 0, 0).click()
    celda(root, 0, 1).click()
    expect(ganado).toBe(0)
  })

  it('sigue entendiendo el payload antiguo sin ventanas ni descanso', async () => {
    const root = await montar({
      cycles: 4,
      capacity_per_cycle: 2,
      plants: [{ id: 'A', doses: 2 }, { id: 'B', doses: 1 }]
    })
    expect(root.querySelectorAll('.riego-cell.is-blocked')).toHaveLength(0)
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
})
