import { describe, it, expect } from 'vitest'
import {
  ejesDeSeed,
  varianteDeSeed,
  ordenEliminacion,
  simulaSalida,
  ordenObjetivoDe,
  colocacionSolucion,
  buildCintaPuzzle
} from '../../scripts/cinta-transportadora-logic.js'

describe('ordenEliminacion / simulaSalida', () => {
  it('el clasico Josephus(7,3): cada 3ª posicion sale, contando desde la 1ª', () => {
    expect(ordenEliminacion(7, 3)).toEqual([3, 6, 2, 7, 5, 1, 4])
  })

  it('simulaSalida sobre la identidad es lo mismo que ordenEliminacion', () => {
    for (const [n, m] of [[6, 2], [8, 3], [10, 2]]) {
      const identidad = Array.from({ length: n }, (_, i) => i + 1)
      expect(simulaSalida(identidad, m)).toEqual(ordenEliminacion(n, m))
    }
  })

  it('con m=1 no elimina nada fuera de orden (saltar 0 es trivial)', () => {
    expect(ordenEliminacion(5, 1)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('ordenObjetivoDe', () => {
  it('ascendente y descendente', () => {
    expect(ordenObjetivoDe(5, 'ascendente')).toEqual([1, 2, 3, 4, 5])
    expect(ordenObjetivoDe(5, 'descendente')).toEqual([5, 4, 3, 2, 1])
  })

  it('intercalado alterna desde abajo y desde arriba', () => {
    expect(ordenObjetivoDe(6, 'intercalado')).toEqual([1, 6, 2, 5, 3, 4])
  })

  it('es siempre una permutacion de 1..n', () => {
    for (const tipo of ['ascendente', 'descendente', 'intercalado']) {
      for (const n of [6, 8, 10]) {
        const orden = ordenObjetivoDe(n, tipo)
        expect(new Set(orden).size, `${tipo} n=${n}`).toBe(n)
        expect(orden.every((v) => v >= 1 && v <= n), `${tipo} n=${n}`).toBe(true)
      }
    }
  })
})

describe('colocacionSolucion', () => {
  it('la colocacion que devuelve produce exactamente el orden objetivo', () => {
    for (const [n, m] of [[6, 2], [7, 3], [8, 2], [10, 3]]) {
      for (const tipo of ['ascendente', 'descendente', 'intercalado']) {
        const objetivo = ordenObjetivoDe(n, tipo)
        const colocacion = colocacionSolucion(n, m, objetivo)
        expect(new Set(colocacion).size, `n=${n} m=${m} ${tipo}`).toBe(n)
        expect(simulaSalida(colocacion, m), `n=${n} m=${m} ${tipo}`).toEqual(objetivo)
      }
    }
  })
})

describe('ejesDeSeed / varianteDeSeed', () => {
  it('siempre produce ejes dentro de los rangos declarados', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { nCajas, patronSalto, ordenTipo } = ejesDeSeed(seed)
      expect([6, 8, 10]).toContain(nCajas)
      expect([1, 2]).toContain(patronSalto)
      expect(['ascendente', 'descendente', 'intercalado']).toContain(ordenTipo)
    }
  })

  it('cubre las 18 combinaciones sobre un rango amplio de seeds', () => {
    const vistas = new Set()
    for (let seed = 0; seed < 2000; seed++) vistas.add(varianteDeSeed(seed))
    expect(vistas.size).toBe(18)
  })
})

describe('buildCintaPuzzle', () => {
  it('la solucion siempre produce el orden objetivo declarado', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { dificultad, payload } = buildCintaPuzzle(seed)
      const { n_cajas, patron_salto, orden_objetivo, solucion_colocacion } = payload

      expect(orden_objetivo).toHaveLength(n_cajas)
      expect(solucion_colocacion).toHaveLength(n_cajas)
      expect(simulaSalida(solucion_colocacion, patron_salto + 1)).toEqual(orden_objetivo)

      expect(dificultad).toBeGreaterThanOrEqual(1)
      expect(dificultad).toBeLessThanOrEqual(5)
    }
  })

  it('misma semilla, mismo puzzle (determinista)', () => {
    expect(buildCintaPuzzle(4242)).toEqual(buildCintaPuzzle(4242))
  })
})
