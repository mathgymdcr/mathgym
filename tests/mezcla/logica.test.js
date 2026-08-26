import { describe, it, expect } from 'vitest'
import { solveMezcla, isMezclaSolvable, initialLevelsMezcla } from '../../scripts/mezcla-logic.js'

// El motor es un BFS sobre el espacio de estados: cada movimiento es vaciar un
// matraz, trasvasar entre dos, verter en el reactor, o -- solo si hay
// dosificador (`grifo`) -- llenar uno hasta arriba. La meta es haber vertido
// todos los objetivos; verter cuenta como movimiento, igual que en la
// plantilla, así que un reto de un objetivo cuesta un movimiento más que
// llegar a tenerlo en un matraz.

describe('solveMezcla, con dosificador', () => {
  const conGrifo = (extra = {}) => ({
    grifo: true,
    capacities: [7, 4, 3],
    target: 5,
    initialLevels: [0, 0, 0],
    ...extra
  })

  it('resuelve el clásico de 7/4/3 para 5 mL', () => {
    // llena el 4 -> lo vuelca en el 7 -> el 7 llena el 3 (le queda 1) ->
    // llena el 4 -> lo vuelca otra vez en el 7: 1 + 4 = 5, y verterlo.
    expect(solveMezcla(conGrifo())).toBe(6)
  })

  it('un objetivo servido de salida solo cuesta verterlo', () => {
    expect(solveMezcla(conGrifo({ initialLevels: [5, 0, 0] }))).toBe(1)
  })

  it('llena directo cuando el objetivo es una capacidad entera', () => {
    expect(solveMezcla(conGrifo({ target: 4 }))).toBe(2)
  })

  it('con dosificador, cualquier objetivo múltiplo del mcd es alcanzable', () => {
    expect(isMezclaSolvable(conGrifo({ capacities: [8, 5, 3], target: 4 }))).toBe(true)
  })

  it('rechaza el objetivo que no es múltiplo del mcd de las capacidades', () => {
    expect(solveMezcla(conGrifo({ capacities: [8, 4, 2], target: 5 }))).toBe(null)
    expect(isMezclaSolvable(conGrifo({ capacities: [8, 4, 2], target: 5 }))).toBe(false)
  })

  it('rechaza el objetivo que no cabe en ningún matraz', () => {
    expect(isMezclaSolvable(conGrifo({ target: 9 }))).toBe(false)
  })
})

describe('solveMezcla, sin dosificador', () => {
  const sinGrifo = (extra = {}) => ({
    grifo: false,
    capacities: [8, 5, 3],
    target: 4,
    initialLevels: [8, 0, 0],
    ...extra
  })

  it('reparte los 8 mL de partida hasta dejar 4 en un matraz', () => {
    // Ojo: no es el clásico de 7 movimientos, que parte los 8 en 4+4. Aquí
    // basta con que UN matraz llegue a 4, y eso sale en 6, más el vertido.
    expect(solveMezcla(sinGrifo())).toBe(7)
  })

  it('no puede alcanzar un objetivo mayor que el reactivo disponible', () => {
    expect(isMezclaSolvable(sinGrifo({ target: 9 }))).toBe(false)
  })

  it('sin dosificador el mismo reto puede ser imposible y con él no', () => {
    const caps = { capacities: [7, 4, 3], target: 5 }
    expect(isMezclaSolvable({ ...caps, grifo: false, initialLevels: [3, 0, 0] })).toBe(false)
    expect(isMezclaSolvable({ ...caps, grifo: true, initialLevels: [3, 0, 0] })).toBe(true)
  })
})

describe('solveMezcla con cuatro matraces', () => {
  it('resuelve un reparto de cuatro sin dosificador', () => {
    const min = solveMezcla({
      grifo: false,
      capacities: [12, 8, 5, 3],
      target: 6,
      initialLevels: [12, 0, 0, 0]
    })
    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThan(20)
  })

  it('el cuarto matraz puede acortar el camino, nunca alargarlo', () => {
    const tres = solveMezcla({
      grifo: true, capacities: [12, 7, 5], target: 6, initialLevels: [0, 0, 0]
    })
    const cuatro = solveMezcla({
      grifo: true, capacities: [12, 7, 5, 3], target: 6, initialLevels: [0, 0, 0, 0]
    })
    expect(cuatro).toBeLessThanOrEqual(tres)
  })
})

describe('el campo `grifo` es el que manda', () => {
  it('ignora un `variant` heredado: sin `grifo` no hay dosificador', () => {
    const cfg = {
      variant: 'clasico',           // esquema viejo, ya no se lee
      capacities: [7, 4, 3],
      target: 5,
      initialLevels: [0, 0, 0]
    }
    expect(isMezclaSolvable(cfg)).toBe(false)   // sin reactivo y sin grifo, nada que hacer
  })
})

describe('initialLevelsMezcla', () => {
  it('con dosificador se arranca en seco', () => {
    expect(initialLevelsMezcla([7, 4, 3], true)).toEqual([0, 0, 0])
  })

  it('sin dosificador, todo el reactivo está en el primer matraz', () => {
    expect(initialLevelsMezcla([12, 8, 5, 3], false)).toEqual([12, 0, 0, 0])
  })
})
