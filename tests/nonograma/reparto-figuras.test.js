import { describe, it, expect } from 'vitest'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'
import { ORDEN_TEMPLATES, ejesDeSeed, buildNonogramaPuzzle } from '../../scripts/nonograma-logic.js'

// buildNonogramaPuzzle necesita saber cuántas veces le tocó nonograma ANTES
// de cada fecha para no repetir dibujo en dos ocurrencias seguidas (ver
// ocurrenciasPrevias en nonograma-logic.js) -- y eso exige simular
// selectTemplate, que vive en generate-daily-reto.js. Importarlo desde ahí
// crearía un ciclo (el generador ya importa este módulo), así que
// ORDEN_TEMPLATES es una copia local, a propósito, del orden real de
// `this.templates`. Este test es la red que impide que se desincronicen: el
// día que se registre un tipo nuevo y se le olvide tocar ORDEN_TEMPLATES,
// nonograma volvería a repetir dibujo en silencio -- como ya pasó dos veces
// (con codigo-secreto primero, con cinta-transportadora después) -- en vez
// de fallar aquí, con un mensaje directo.
describe('ORDEN_TEMPLATES no se desincroniza de this.templates', () => {
  it('mismos tipos, mismo orden', () => {
    const real = Object.keys(new MathGymGenerator().templates)
    expect(ORDEN_TEMPLATES).toEqual(real)
  })
})

// La garantía de "no repite" depende de que ocurrenciasPrevias cuente
// ocurrencias DE VERDAD (avanza +1 exacto por ocurrencia, nunca por hueco en
// días) -- tests/nonograma/generador.test.js ya barre las fechas reales de 4
// años y comprueba que no hay dos dibujos iguales seguidos; esto solo prueba
// el mecanismo en aislado, con un banco muy pequeño a propósito, para que si
// se rompe sea obvio con qué seeds.
describe('ejesDeSeed sobre nonograma: ida y vuelta con buildNonogramaPuzzle', () => {
  it('lado y color de ejesDeSeed coinciden con lo que construye el puzzle', () => {
    for (let seed = 20260101; seed < 20260101 + 40; seed++) {
      const ejes = ejesDeSeed(seed)
      const puzzle = buildNonogramaPuzzle(seed)
      expect(puzzle.rows, `seed ${seed}`).toBe(ejes.lado)
      expect(Boolean(puzzle.paleta), `seed ${seed}`).toBe(ejes.color)
    }
  })
})
