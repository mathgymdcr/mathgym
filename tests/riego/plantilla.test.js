import { describe, it, expect, beforeAll, vi } from 'vitest'

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

const tarjeta = (root, i) => root.querySelector(`.riego-planta-card[data-planta="${i}"]`)

// La victoria ya no se declara sola al completar el tablero: hace falta
// pulsar «Comprobar».
const comprobar = (root) => root.querySelector('.riego-btn-comprobar').click()

describe('plantillas/riego_plantas.js con ventanas y descanso', () => {
  it('usa el shell estándar del resto del catálogo', async () => {
    const root = await montar()
    expect(root.querySelector('.template-box'), 'sin caja estándar').not.toBeNull()
    expect(root.textContent).toContain('Cómo se juega')
  })

  it('escribe la ventana de cada planta en el bocadillo de Deceerre, no en la fila', async () => {
    const root = await montar()
    expect(root.textContent).not.toContain('Disponible: ciclos')
    tarjeta(root, 0).click()
    // Albahaca: ventana [0,2,3] -> ciclos 1-indexados 1,3,4 -> "1" suelto y "3 a 4" seguidos.
    expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('Disponible: ciclos 1 y 3 a 4.')
    tarjeta(root, 1).click()
    // Cactus: ventana [1,3,4] -> ciclos 2,4,5.
    expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('Disponible: ciclos 2 y 4 a 5.')
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

  it('no gana solo con completar el tablero: hace falta pulsar Comprobar', async () => {
    let ganado = 0
    const root = await montar(PAYLOAD, { onSuccess: () => { ganado++ } })
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    expect(ganado, 'no debería ganar sin pulsar Comprobar').toBe(0)
    expect(root.textContent).toContain('Todo listo')
  })

  it('gana al pulsar Comprobar con el calendario válido y llama a onSuccess una vez', async () => {
    let ganado = 0
    const root = await montar(PAYLOAD, { onSuccess: () => { ganado++ } })
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    comprobar(root)
    expect(ganado, 'no dio la victoria con el calendario correcto').toBe(1)
    comprobar(root)
    expect(ganado, 'volver a pulsar Comprobar tras ganar no debería sumar otra vez').toBe(1)
  })

  it('Comprobar avisa si el tablero aún no está completo', async () => {
    const root = await montar(PAYLOAD)
    celda(root, 0, 0).click()
    comprobar(root)
    expect(root.textContent.toLowerCase()).toContain('faltan riegos')
  })

  // celebrate() (que crea .celebration-overlay) tiene que haberse llamado YA
  // cuando se dispara onSuccess: script.js pinta las estrellas y el botón de
  // compartir DENTRO de ese overlay (pintarEstrellas/pintarCompartir hacen
  // querySelector('.celebration-overlay .celebration-card')), así que si el
  // orden se invierte esas dos cosas se quedan sin pintar en silencio -- sin
  // que ningún error avise. Bug real: llegó a producción con este orden al
  // revés.
  it('el overlay de celebracion ya existe cuando se llama a onSuccess', async () => {
    let habiaOverlay = null
    const root = await montar(PAYLOAD, {
      onSuccess: () => { habiaOverlay = !!document.querySelector('.celebration-overlay .celebration-card') }
    })
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    comprobar(root)
    expect(habiaOverlay, 'onSuccess se llamo antes de que celebrate() montara el overlay').toBe(true)
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
    comprobar(root)
    expect(ganado).toBe(0)
  })

  it('sigue entendiendo el payload antiguo sin ventanas ni descanso', async () => {
    const root = await montar({
      cycles: 4,
      capacity_per_cycle: 2,
      plants: [{ id: 'A', doses: 2 }, { id: 'B', doses: 1 }]
    })
    tarjeta(root, 0).click()
    expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('Sin restricción de ventana')
    expect(root.querySelector('.feedback.ko')).toBeNull()
  })

  it('dice "solo ciclos pares/impares" cuando la ventana cae exacta en esa paridad', async () => {
    const root = await montar({
      cycles: 6,
      capacity: 2,
      plants: [
        { id: 'Par', doses: 2, ventana: [1, 3, 5] },    // 1-indexado: 2, 4, 6 -> pares
        { id: 'Impar', doses: 2, ventana: [0, 2, 4] }   // 1-indexado: 1, 3, 5 -> impares
      ]
    })
    tarjeta(root, 0).click()
    expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('Disponible: solo ciclos pares.')
    tarjeta(root, 1).click()
    expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('Disponible: solo ciclos impares.')
  })

  describe('con pareja incompatible', () => {
    const PAYLOAD_INCOMPATIBLE = {
      cycles: 6,
      capacity: 2,
      incompatibles: ['Albahaca', 'Cactus'],
      plants: [
        { id: 'Albahaca', doses: 1, ventana: [0, 2] },
        { id: 'Cactus', doses: 1, ventana: [0, 2] }
      ]
    }

    it('anuncia la pareja en el bocadillo de cada una, no en las instrucciones', async () => {
      const root = await montar(PAYLOAD_INCOMPATIBLE)
      expect(root.querySelector('.template-box').textContent).not.toContain('no pueden regarse en el mismo ciclo')
      tarjeta(root, 0).click() // Albahaca
      expect(document.querySelector('.riego-deceerre-overlay').textContent).toContain('No puede regarse el mismo ciclo que Cactus.')
    })

    it('avisa si las dos riegan el mismo ciclo', async () => {
      const root = await montar(PAYLOAD_INCOMPATIBLE)
      celda(root, 0, 0).click()   // Albahaca, ciclo 1
      celda(root, 1, 0).click()   // Cactus, ciclo 1: mismo ciclo, pareja incompatible
      expect(root.querySelector('.feedback.ko')).not.toBeNull()
      expect(root.textContent).toContain('comparten el ciclo 1')
    })

    it('no avisa si riegan en ciclos distintos', async () => {
      const root = await montar(PAYLOAD_INCOMPATIBLE)
      celda(root, 0, 0).click()   // Albahaca, ciclo 1
      celda(root, 1, 2).click()   // Cactus, ciclo 3
      expect(root.querySelector('.feedback.ko')).toBeNull()
    })

    it('ignora un incompatibles que referencia una planta inexistente, sin romper el reto', async () => {
      const root = await montar({ ...PAYLOAD_INCOMPATIBLE, incompatibles: ['Fantasma', 'Albahaca'] })
      expect(root.textContent).not.toContain('no pueden regarse en el mismo ciclo')
      celda(root, 0, 0).click()
      celda(root, 1, 0).click()
      expect(root.querySelector('.feedback.ko')).toBeNull()
    })
  })
})

describe('tarjetas de planta repartidas alrededor del tablero', () => {
  it('reparte una tarjeta por planta entre los dos laterales', async () => {
    const root = await montar()
    const izquierda = root.querySelectorAll('.riego-cards-left .riego-planta-card')
    const derecha = root.querySelectorAll('.riego-cards-right .riego-planta-card')
    expect(izquierda.length + derecha.length).toBe(PAYLOAD.plants.length)
    // Albahaca (índice 0) va a la izquierda, Cactus (índice 1) a la derecha.
    expect(izquierda[0].getAttribute('data-planta')).toBe('0')
    expect(derecha[0].getAttribute('data-planta')).toBe('1')
  })

  it('cada tarjeta lleva el icono grande y el nombre de su planta', async () => {
    const root = await montar()
    const carta = tarjeta(root, 0)
    expect(carta.querySelector('img')).not.toBeNull()
    expect(carta.textContent).toContain('Albahaca')
  })

  it('el nombre en la fila de la tabla ya no lleva icono ni es lo que se toca', async () => {
    const root = await montar()
    expect(root.querySelectorAll('.riego-nombre img')).toHaveLength(0)
    root.querySelectorAll('.riego-nombre')[0].click()
    expect(document.querySelector('.riego-deceerre-overlay'), 'la fila ya no abre nada').toBeNull()
  })
})

describe('bocadillo de Deceerre (ventana, incompatibilidad) en vez de texto fijo', () => {
  it('la ventana ya no sale en las instrucciones fijas', async () => {
    const root = await montar()
    expect(root.textContent).not.toContain('Disponible: ciclos')
  })

  it('la pareja incompatible ya no sale en las instrucciones fijas', async () => {
    const root = await montar({
      cycles: 6, capacity: 2,
      incompatibles: ['Albahaca', 'Cactus'],
      plants: [
        { id: 'Albahaca', doses: 1, ventana: [0, 2] },
        { id: 'Cactus', doses: 1, ventana: [0, 2] }
      ]
    })
    const instrucciones = root.querySelector('.template-box').textContent
    expect(instrucciones).not.toContain('no pueden regarse en el mismo ciclo')
  })

  it('tocar una tarjeta abre el bocadillo de Deceerre con la cara y la ventana de esa planta', async () => {
    const root = await montar()
    tarjeta(root, 0).click()
    const overlay = document.querySelector('.riego-deceerre-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay.querySelector('img[alt="Deceerre"]')).not.toBeNull()
    expect(overlay.textContent).toContain('Disponible')
  })

  it('el bocadillo se autocierra a los 5 segundos', async () => {
    vi.useFakeTimers()
    const root = await montar()
    tarjeta(root, 0).click()
    expect(document.querySelector('.riego-deceerre-overlay')).not.toBeNull()
    vi.advanceTimersByTime(5000)
    expect(document.querySelector('.riego-deceerre-overlay')).toBeNull()
    vi.useRealTimers()
  })

  it('pulsar el propio overlay (clic fuera de la tarjeta) lo cierra antes de tiempo', async () => {
    const root = await montar()
    tarjeta(root, 0).click()
    const overlay = document.querySelector('.riego-deceerre-overlay')
    overlay.click()
    expect(document.querySelector('.riego-deceerre-overlay')).toBeNull()
  })

  it('la primera consulta de cada planta es gratis', async () => {
    let marca = null
    const root = await montar(PAYLOAD, { onSuccess: (m) => { marca = m } })
    tarjeta(root, 0).click()
    tarjeta(root, 1).click()
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    comprobar(root)
    expect(marca.consultas).toBe(0)
  })

  it('volver a consultar la misma planta suma al contador', async () => {
    let marca = null
    const root = await montar(PAYLOAD, { onSuccess: (m) => { marca = m } })
    // Pulsar la MISMA tarjeta mientras su bocadillo ya está abierto lo cierra
    // (toggle) en vez de recargarlo, así que para sumar dos consultas de más
    // hay que intercalar con la otra planta -- cada vez que se reabre
    // Albahaca/Cactus ya estaban en `consultadas`.
    tarjeta(root, 0).click() // Albahaca, gratis (primera vez)
    tarjeta(root, 1).click() // Cactus, gratis (primera vez), cierra la de Albahaca
    tarjeta(root, 0).click() // Albahaca otra vez, +1
    tarjeta(root, 1).click() // Cactus otra vez, +1
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    comprobar(root)
    expect(marca.consultas).toBe(2)
  })

  it('tocar la tarjeta de la planta cuyo bocadillo ya está abierto lo cierra sin recargarlo', async () => {
    let marca = null
    const root = await montar(PAYLOAD, { onSuccess: (m) => { marca = m } })
    tarjeta(root, 0).click() // Albahaca, gratis, abre el bocadillo
    expect(document.querySelector('.riego-deceerre-overlay')).not.toBeNull()
    tarjeta(root, 0).click() // misma planta, mismo bocadillo abierto: toggle-close
    expect(document.querySelector('.riego-deceerre-overlay'), 'debería cerrarlo, no recargarlo').toBeNull()
    celda(root, 0, 0).click()
    celda(root, 0, 2).click()
    celda(root, 1, 1).click()
    celda(root, 1, 4).click()
    comprobar(root)
    // La primera vista de Albahaca fue gratis y el toggle-close no cuenta
    // como una segunda consulta.
    expect(marca.consultas).toBe(0)
  })

  it('hay un botón «Comprobar» que decide la victoria, en vez de detectarla sola', async () => {
    const root = await montar()
    const btn = root.querySelector('.riego-btn-comprobar')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toBe('Comprobar')
  })
})
