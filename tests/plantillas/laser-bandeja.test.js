import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs/promises'

const montar = async (data, hooks = {}) => {
  const mod = await import('../../plantillas/laser_triangular.js')
  const host = document.createElement('div')
  await mod.render(host, data, hooks)
  return host
}

const muestra = async () => JSON.parse(await fs.readFile('data/muestra/laser-triangular.json', 'utf8'))

// La última prueba de este archivo llega a ganar la partida de verdad (para
// comprobar que el conteo de movimientos no queda inflado), y la celebración
// de la victoria pinta confeti en un <canvas> que happy-dom no implementa.
// Mismo stub que tests/plantillas/laser-muestra.test.js.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  })
})

describe('bandeja de piezas', () => {
  it('en clasico solo ofrece los cuatro espejos', async () => {
    const host = await montar({
      size: 5,
      lasers: [
        { emitter: { row: 0, col: 0, dir: 'down' }, target: { row: 3, col: 4 } },
        { emitter: { row: 0, col: 4, dir: 'left' }, target: { row: 2, col: 1 } }
      ],
      blocks: [], min_espejos: 2
    })
    const piezas = [...host.querySelectorAll('.laser-tray-pieza')].map((b) => b.dataset.pieza)
    expect(piezas).toEqual(['slash', 'backslash', 'vert', 'horiz'])
  })

  // Payload de prisma en linea, NO data/muestra: la muestra sigue siendo un
  // reto clasico hasta la Task 13, asi que ofreceria cuatro piezas.
  const PRISMA = {
    size: 5, modo: 'prisma',
    lasers: [{ emitter: { row: 2, col: 0, dir: 'right' }, color: 'neutro' }],
    targets: [{ row: 0, col: 4, color: 'azul' }, { row: 4, col: 4, color: 'rojo' }],
    blocks: [], min_piezas: 2
  }

  it('con prisma ofrece las seis', async () => {
    const host = await montar(PRISMA)
    expect(host.querySelectorAll('.laser-tray-pieza')).toHaveLength(6)
  })

  it('tocar una pieza y luego una celda la coloca', async () => {
    const host = await montar(PRISMA)
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const celdas = host.querySelectorAll('.laser-cell')
    const libre = [...celdas].find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    expect(libre.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')
  })

  it('tocar una pieza ya colocada la retira', async () => {
    const host = await montar(await muestra())
    host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))
    libre.click()
    libre.click()
    expect(libre.querySelector('.laser-pieza')).toBeNull()
  })

  // Las celdas de emisor/diana/bloque no llevan listener de 'click' (solo las
  // celdas libres lo tienen), así que tocarlas con .click() no ejercita el
  // guardia de sinPieza -- pasaría igual si el guardia no existiera. El único
  // camino que de verdad llega ahí es el de soltar un arrastre: se simula
  // soltando sobre la celda protegida (con document.elementFromPoint
  // apuntado a mano, porque happy-dom no lo implementa) y pasa por el mismo
  // onCellClick que usa el toque.
  //
  // Que no aparezca un .laser-pieza ahí NO basta para probar que el guardia
  // hizo su trabajo: refresh() se salta esas celdas al pintar pase lo que
  // pase, así que aunque el guardia de onCellClick desapareciera, la celda
  // seguiría viéndose vacía (comprobado a mano quitando ese guardia: escribe
  // en state.piezas y el reto lo cuenta, pero no se ve). La prueba real es
  // resolver el reto de verdad después del intento de arrastre ilegal y
  // comprobar que el número de movimientos reportado es exactamente el de la
  // solución -- si el guardia hubiera dejado colar una pieza fantasma en una
  // celda protegida, ese conteo (que suma TODAS las celdas no vacías de
  // state.piezas) saldría inflado aunque el tablero se viera igual.
  it('soltar un arrastre sobre un emisor, una diana o un bloque no coloca nada ni corrompe la partida', async () => {
    const { resolverPiezas } = await import('../../scripts/laser-triangular-logic.js')
    const data = await muestra()
    // resolverPiezas normaliza `data` entero (normalizaConfig), no una copia
    // parcial: desde que la muestra puede ser prisma/condensador hace falta
    // `targets` y `modo`, que un subconjunto a mano se dejaba fuera.
    const sol = resolverPiezas(data, data.min_piezas ?? data.min_espejos)
    expect(sol, 'el ejemplo de láser no tiene solución').not.toBeNull()
    const piezasSolucion = sol.piezas.flat().filter(Boolean).length

    let ganado = 0
    let movimientos = null
    const host = await montar(data, { onSuccess: (r) => { ganado++; movimientos = r.movimientos } })
    const btn = host.querySelector('.laser-tray-pieza[data-pieza="slash"]')
    const protegidas = [...host.querySelectorAll('.laser-cell.is-emitter, .laser-cell.is-target, .laser-cell.is-block')]
    expect(protegidas.length).toBeGreaterThan(0)

    const elementFromPointOriginal = document.elementFromPoint
    try {
      protegidas.forEach((celda) => {
        document.elementFromPoint = () => celda
        btn.dispatchEvent(new Event('pointerdown'))
        btn.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 0 }))
        expect(celda.querySelector('.laser-pieza')).toBeNull()
      })
    } finally {
      document.elementFromPoint = elementFromPointOriginal
    }

    // Ahora se resuelve el reto de verdad, tocando la bandeja y las celdas
    // como haría quien juega.
    const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
    sol.piezas.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (!tipo) return
      host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
      host.querySelectorAll('.laser-cell')[r * data.size + c].click()
    }))
    // El ejemplo es "medio": la victoria no se canta hasta pulsar el botón.
    host.querySelector('.laser-btn-lanzar').click()

    expect(ganado, 'la plantilla no dio la victoria con la solución encontrada').toBe(1)
    expect(movimientos, 'el conteo de movimientos incluye una pieza colada en una celda protegida').toBe(piezasSolucion)
  })

  // El manejador que "levanta" una pieza ya colocada del tablero (para
  // arrastrarla) no debe tocar nada una vez ganada la partida -- igual que
  // onCellClick. happy-dom no expone drag real, pero sí permite disparar
  // pointerdown/pointermove a mano con clientX/clientY, que es todo lo que
  // ese código lee (no usa setPointerCapture para decidir nada, solo para
  // no perder el gesto si el navegador lo soporta), así que el camino SÍ se
  // puede ejercitar de verdad aquí, no solo "leer con cuidado".
  it('ganada la partida, arrastrar una pieza ya colocada no la retira del tablero', async () => {
    const { resolverPiezas } = await import('../../scripts/laser-triangular-logic.js')
    const data = await muestra()
    const sol = resolverPiezas(data, data.min_piezas ?? data.min_espejos)
    expect(sol, 'el ejemplo de láser no tiene solución').not.toBeNull()

    let ganado = 0
    const host = await montar(data, { onSuccess: () => { ganado++ } })
    const NOMBRE = { 1: 'slash', 2: 'backslash', 3: 'vert', 4: 'horiz', 5: 'prisma', 6: 'condensador' }
    sol.piezas.forEach((fila, r) => fila.forEach((tipo, c) => {
      if (!tipo) return
      host.querySelector(`.laser-tray-pieza[data-pieza="${NOMBRE[tipo]}"]`).click()
      host.querySelectorAll('.laser-cell')[r * data.size + c].click()
    }))
    // El ejemplo es "medio": la victoria no se canta hasta pulsar el botón.
    host.querySelector('.laser-btn-lanzar').click()
    expect(ganado, 'la plantilla no dio la victoria con la solución encontrada').toBe(1)

    // Se intenta levantar (con movimiento real, para cruzar UMBRAL_ARRASTRE)
    // la primera celda con pieza que se encuentre.
    const celdas = host.querySelectorAll('.laser-cell')
    const conPieza = [...celdas].find((c) => c.querySelector('.laser-pieza'))
    expect(conPieza, 'no quedó ninguna pieza en el tablero tras ganar').toBeTruthy()

    conPieza.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100 }))
    conPieza.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 130 }))

    expect(conPieza.querySelector('.laser-pieza'), 'una partida ganada se pudo desmontar arrastrando').not.toBeNull()
  })

  // Un toque simple (pointerdown + pointerup SIN moverse, seguido del click
  // nativo que dispara el navegador) sobre una celda ocupada debe limitarse
  // a retirar su pieza -- no debe tocar lo que está armado en la bandeja.
  // Si el manejador de "recoger" armara en el propio pointerdown (como en
  // una versión anterior), este toque dejaría "slash" armado otra vez tras
  // retirarlo, aunque justo antes se hubiera armado "backslash" a propósito.
  it('tocar una pieza para retirarla no rearma nada en la bandeja', async () => {
    const host = await montar(await muestra())
    const btnSlash = host.querySelector('.laser-tray-pieza[data-pieza="slash"]')
    const btnBackslash = host.querySelector('.laser-tray-pieza[data-pieza="backslash"]')
    const libre = [...host.querySelectorAll('.laser-cell')]
      .find((c) => !c.className.match(/is-emitter|is-target|is-block/))

    btnSlash.click()
    libre.click() // coloca 'slash' en `libre`
    expect(libre.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')

    btnBackslash.click() // arma 'backslash' para el siguiente movimiento
    expect(btnBackslash.classList.contains('is-armada')).toBe(true)

    // Toque simple sobre la celda ocupada: pointerdown, pointerup sin
    // moverse, y el click nativo que el navegador dispara detrás.
    libre.dispatchEvent(new MouseEvent('pointerdown', { clientX: 50, clientY: 50 }))
    libre.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 50 }))
    libre.dispatchEvent(new MouseEvent('click'))

    expect(libre.querySelector('.laser-pieza'), 'el toque no retiró la pieza').toBeNull()
    expect(btnBackslash.classList.contains('is-armada'), 'el toque desarmó lo que ya estaba armado').toBe(true)
    expect(btnSlash.classList.contains('is-armada'), 'el toque rearmó la pieza que se acaba de retirar').toBe(false)
  })

  // Si el navegador cancela el gesto a media (scroll, multitouch, UI del
  // sistema) nunca llega pointerup, y sin un manejador de pointercancel la
  // bandera de arrastre se queda en `true`. El siguiente pointerup suelto en
  // cualquier sitio -- de un gesto totalmente distinto -- pasaría entonces
  // el `if (!state.arrastrando) return` y colocaría una pieza que nadie pidió.
  it('un pointercancel no deja el siguiente pointerup suelto en cualquier sitio colocando piezas', async () => {
    const host = await montar(PRISMA)
    const btnSlash = host.querySelector('.laser-tray-pieza[data-pieza="slash"]')
    const celdas = [...host.querySelectorAll('.laser-cell')].filter(
      (c) => !c.className.match(/is-emitter|is-target|is-block/))
    const destino = celdas[0]

    const elementFromPointOriginal = document.elementFromPoint
    document.elementFromPoint = () => destino
    try {
      btnSlash.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }))
      btnSlash.dispatchEvent(new Event('pointercancel'))
      // Un pointerup suelto después, de un gesto sin relación con el anterior.
      btnSlash.dispatchEvent(new MouseEvent('pointerup', { clientX: 999, clientY: 999 }))

      expect(destino.querySelector('.laser-pieza'), 'el pointerup posterior al cancel colocó una pieza de todos modos').toBeNull()
    } finally {
      document.elementFromPoint = elementFromPointOriginal
    }
  })

  // setPointerCapture retargetea TODO evento posterior del gesto -- incluido
  // el 'click' de compatibilidad que el navegador dispara detrás de
  // pointerdown+pointerup -- al elemento donde empezó el gesto. Capturado en
  // un navegador real, para un arrastre de la celda (3,1) a la (2,1):
  //   pointerdown target=3,1 / pointermove x5 target=3,1 / pointerup target=3,1
  //   / lostpointercapture target=3,1 / click target=3,1
  // Las tres pruebas de abajo reproducen ese patrón a mano (happy-dom no
  // retargetea eventos de verdad): pointerdown en A, pointermove más allá de
  // UMBRAL_ARRASTRE, se apunta elementFromPoint al destino, pointerup, y
  // luego el 'click' retargeteado se dispara EN A -- el origen, no el
  // destino -- que es justo lo que hace la captura.
  describe('el click retargeteado por setPointerCapture tras un arrastre', () => {
    const arrastra = (origen, destino, elementFromPointStub) => {
      const elementFromPointOriginal = document.elementFromPoint
      origen.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }))
      origen.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 20 })) // > UMBRAL_ARRASTRE (6px)
      document.elementFromPoint = elementFromPointStub
      origen.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 20 }))
      origen.dispatchEvent(new MouseEvent('click')) // el retargeteo: SIEMPRE en el origen
      document.elementFromPoint = elementFromPointOriginal
    }

    it('arrastrar una pieza de una celda a otra no la deja en las dos', async () => {
      const host = await montar(PRISMA)
      const [A, B] = [...host.querySelectorAll('.laser-cell')].filter(
        (c) => !c.className.match(/is-emitter|is-target|is-block/))

      host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
      A.click()
      expect(A.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')

      arrastra(A, B, () => B)

      expect(B.querySelector('.laser-pieza')?.dataset.pieza, 'la pieza no llegó a B').toBe('slash')
      expect(A.querySelector('.laser-pieza'), 'el click retargeteado volvió a colocar una pieza en A').toBeNull()
    })

    it('arrastrar una pieza fuera del tablero la retira sin volver a colocarla', async () => {
      const host = await montar(PRISMA)
      const [A] = [...host.querySelectorAll('.laser-cell')].filter(
        (c) => !c.className.match(/is-emitter|is-target|is-block/))

      host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
      A.click()
      expect(A.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')

      // Fuera del tablero: nada bajo el punto de soltar.
      arrastra(A, null, () => null)

      expect(A.querySelector('.laser-pieza'), 'el click retargeteado volvió a colocar la pieza en A').toBeNull()
    })

    it('un arrastre que vuelve a la misma celda no la vacía por el click retargeteado', async () => {
      const host = await montar(PRISMA)
      const [A] = [...host.querySelectorAll('.laser-cell')].filter(
        (c) => !c.className.match(/is-emitter|is-target|is-block/))

      host.querySelector('.laser-tray-pieza[data-pieza="slash"]').click()
      A.click()
      expect(A.querySelector('.laser-pieza')?.dataset.pieza).toBe('slash')

      arrastra(A, A, () => A)

      expect(A.querySelector('.laser-pieza')?.dataset.pieza, 'el click retargeteado retiró la pieza que el arrastre ya había vuelto a dejar en A').toBe('slash')
    })
  })
})
