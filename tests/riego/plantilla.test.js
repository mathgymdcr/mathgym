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

  it('escribe la ventana de cada planta en texto junto a su nombre', async () => {
    const root = await montar()
    const notas = root.querySelectorAll('.riego-ventana-nota')
    expect(notas).toHaveLength(2)
    // Albahaca: ventana [0,2,3] -> ciclos 1-indexados 1,3,4 -> "1" suelto y "3 a 4" seguidos.
    expect(notas[0].textContent).toBe('Disponible: ciclos 1 y 3 a 4.')
    // Cactus: ventana [1,3,4] -> ciclos 2,4,5.
    expect(notas[1].textContent).toBe('Disponible: ciclos 2 y 4 a 5.')
  })

  it('ya no tacha nada por su cuenta: todas las celdas se pueden tocar', async () => {
    const root = await montar()
    expect(root.querySelectorAll('.riego-cell.is-blocked')).toHaveLength(0)
    // Ciclo 2 (índice 1) no está en la ventana de Albahaca, pero SÍ se puede
    // regar -- lo que antes bloqueaba el click ahora lo detecta problemas().
    celda(root, 0, 1).click()
    expect(celda(root, 0, 1).classList.contains('is-on')).toBe(true)
  })

  it('avisa si se riega un ciclo fuera de la ventana de la planta', async () => {
    const root = await montar()
    celda(root, 0, 1).click()   // Albahaca, ciclo 2: fuera de su ventana [0,2,3]
    expect(root.querySelector('.feedback.ko')).not.toBeNull()
    expect(root.textContent).toContain('Albahaca no admite agua en el ciclo 2')
  })

  it('el click cicla vacía -> regada -> marcada con × -> vacía, y la × no cuenta como riego', async () => {
    const root = await montar()
    const c = celda(root, 0, 1)
    c.click()
    expect(c.classList.contains('is-on')).toBe(true)
    c.click()
    expect(c.classList.contains('is-on')).toBe(false)
    expect(c.classList.contains('is-marked')).toBe(true)
    expect(c.textContent).toBe('×')
    expect(root.querySelector('.riego-planta-0 .riego-dosis').textContent).toBe('0/2')
    c.click()
    expect(c.classList.contains('is-marked')).toBe(false)
    expect(c.textContent).toBe('')
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
    expect(root.querySelectorAll('.riego-ventana-nota')).toHaveLength(0)
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })
})
