import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, colocaAsteroides, cuentaVecinos, contarSoluciones, buildRadarPuzzle } from '../../scripts/radar-logic.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ejesDeSeed / varianteDeSeed', () => {
  it('es determinista: la misma semilla da siempre los mismos ejes', () => {
    const a = ejesDeSeed(20260912);
    const b = ejesDeSeed(20260912);
    expect(a).toEqual(b);
  });

  it('el tamano cae siempre en 5, 6 o 7', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { tamano } = ejesDeSeed(seed);
      expect([5, 6, 7]).toContain(tamano);
    }
  });

  it('varianteDeSeed es un string estable a partir del tamano', () => {
    expect(varianteDeSeed(1)).toBe(varianteDeSeed(1));
    expect(typeof varianteDeSeed(1)).toBe('string');
  });
});

describe('colocaAsteroides', () => {
  it('devuelve una rejilla NxN de booleanos con al menos 3 asteroides y no todo lleno', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const n = 6;
      const minas = colocaAsteroides(n, rng);
      expect(minas).toHaveLength(n);
      let total = 0;
      for (const fila of minas) {
        expect(fila).toHaveLength(n);
        for (const v of fila) {
          expect(typeof v).toBe('boolean');
          if (v) total++;
        }
      }
      expect(total).toBeGreaterThanOrEqual(3);
      expect(total).toBeLessThan(n * n);
    }
  });
});

describe('cuentaVecinos', () => {
  it('cuenta las minas en las hasta 8 celdas adyacentes', () => {
    // . X .
    // . . .
    // X . X
    const minas = [
      [false, true, false],
      [false, false, false],
      [true, false, true]
    ];
    expect(cuentaVecinos(minas, 1, 1)).toBe(3); // ve las 3 minas
    expect(cuentaVecinos(minas, 0, 0)).toBe(1); // solo la de (0,1)
    expect(cuentaVecinos(minas, 2, 1)).toBe(2); // las dos de su fila
  });
});

describe('buildRadarPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildRadarPuzzle(20260912);
    const b = buildRadarPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: pistas consistentes con la solucion y solucion unica', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { variant, dificultad, payload } = buildRadarPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([5, 6, 7]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      let totalReal = 0;
      for (const fila of payload.solucion) {
        for (const v of fila) if (v) totalReal++;
      }
      expect(totalReal).toBe(payload.asteroides_totales);

      for (const p of payload.pistas) {
        expect(payload.solucion[p.f][p.c]).toBe(false);
        expect(p.valor).toBe(cuentaVecinos(payload.solucion, p.f, p.c));
      }

      const { soluciones, primera } = contarSoluciones(n, payload.pistas, payload.asteroides_totales, { tope: 2 });
      expect(soluciones).toBe(1);
      expect(primera).toEqual(payload.solucion);
    }
  });
});

describe('contarSoluciones', () => {
  it('sin pistas, cuenta todas las formas de repartir el total de asteroides', () => {
    // 2x2 sin nada revelado y 1 asteroide en total: puede ir en cualquiera
    // de las 4 celdas -- C(4,1) = 4.
    const { soluciones } = contarSoluciones(2, [], 1, { tope: 10 });
    expect(soluciones).toBe(4);
  });

  it('una pista con valor imposible para su numero de vecinos da cero soluciones', () => {
    // La esquina (0,0) de un 2x2 solo tiene 3 vecinas -- valor 5 es imposible.
    const { soluciones } = contarSoluciones(2, [{ f: 0, c: 0, valor: 5 }], 1, { tope: 5 });
    expect(soluciones).toBe(0);
  });

  it('respeta el tope sin seguir contando de mas', () => {
    const { soluciones } = contarSoluciones(2, [], 1, { tope: 2 });
    expect(soluciones).toBe(2);
  });

  it('una pista en 0 fuerza a que sus vecinas esten todas libres', () => {
    // Centro de un 3x3 en valor 0: las 8 vecinas no pueden tener mina, asi
    // que con total=1 no hay ningun sitio legal -- 0 soluciones.
    const { soluciones } = contarSoluciones(3, [{ f: 1, c: 1, valor: 0 }], 1, { tope: 5 });
    expect(soluciones).toBe(0);
  });
});
