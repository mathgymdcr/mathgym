import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, generaCuadradoLatino, contarSolucionesModelo, construyeModelo, asignaClases, contarSolucionesClase, construyeClase, buildAndroidesPuzzle } from '../../scripts/androides-logic.js';

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

  it('el tamano cae siempre en 3 o 4', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { tamano } = ejesDeSeed(seed);
      expect([3, 4]).toContain(tamano);
    }
  });

  it('varianteDeSeed es un string estable a partir del tamano', () => {
    expect(varianteDeSeed(1)).toBe(varianteDeSeed(1));
    expect(typeof varianteDeSeed(1)).toBe('string');
  });
});

describe('generaCuadradoLatino', () => {
  it('produce un cuadrado latino valido: sin repetidos en ninguna fila ni columna', () => {
    for (const n of [3, 4]) {
      const rng = mulberry32(n * 7919 + 3);
      const cuadrado = generaCuadradoLatino(n, rng);
      expect(cuadrado).toHaveLength(n);
      for (const fila of cuadrado) {
        expect(new Set(fila).size).toBe(n);
        for (const v of fila) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(n);
        }
      }
      for (let c = 0; c < n; c++) {
        expect(new Set(cuadrado.map((fila) => fila[c])).size).toBe(n);
      }
    }
  });
});

describe('contarSolucionesModelo', () => {
  it('sin ningun dado, cuenta todos los cuadrados latinos posibles (3x3 = 12)', () => {
    const { soluciones } = contarSolucionesModelo(3, new Map(), { tope: 20 });
    expect(soluciones).toBe(12);
  });

  it('con la esquina fijada en un 2x2, la solucion es unica', () => {
    const dados = new Map([['0,0', 1]]);
    const { soluciones, primera } = contarSolucionesModelo(2, dados, { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[1, 2], [2, 1]]);
  });

  it('respeta el tope sin seguir contando de mas', () => {
    const { soluciones } = contarSolucionesModelo(3, new Map(), { tope: 2 });
    expect(soluciones).toBe(2);
  });
});

describe('construyeModelo', () => {
  it('genera un modelo real: dados consistentes con la solucion y solucion unica', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      for (const n of [3, 4]) {
        const { solucion, dados } = construyeModelo(n, rng);
        for (const [clave, valor] of dados) {
          const [f, c] = clave.split(',').map(Number);
          expect(solucion[f][c]).toBe(valor);
        }
        const { soluciones, primera } = contarSolucionesModelo(n, dados, { tope: 2 });
        expect(soluciones).toBe(1);
        expect(primera).toEqual(solucion);
      }
    }
  });
});

describe('asignaClases', () => {
  it('rellena la rejilla con clases entre 0 y numClases-1', () => {
    const rng = mulberry32(5);
    const grid = asignaClases(4, 3, rng);
    expect(grid).toHaveLength(4);
    for (const fila of grid) {
      expect(fila).toHaveLength(4);
      for (const v of fila) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(3);
      }
    }
  });
});

describe('contarSolucionesClase', () => {
  it('sin dados ni pares, cuenta todas las asignaciones libres (2x1, 2 clases = 4)', () => {
    const { soluciones } = contarSolucionesClase(1, 2, new Map(), [], { tope: 10 });
    expect(soluciones).toBe(2);
  });

  it('con un dado en la unica celda, la solucion es unica', () => {
    const dadosClase = new Map([['0,0', 1]]);
    const { soluciones, primera } = contarSolucionesClase(1, 2, dadosClase, [], { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[1]]);
  });

  it('una pista "misma" entre vecinos filtra las soluciones donde difieren', () => {
    const pistasPares = [{ a: [0, 0], b: [0, 1], misma: true }];
    const dadosClase = new Map([['0,0', 0], ['1,0', 0], ['1,1', 0]]);
    const { soluciones, primera } = contarSolucionesClase(2, 2, dadosClase, pistasPares, { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[0, 0], [0, 0]]);
  });
});

describe('construyeClase', () => {
  it('genera una clase real: dados y pares consistentes con la solucion, unicidad garantizada', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed * 2 + 1);
      for (const n of [3, 4]) {
        const { solucion, dadosClase, pistasPares } = construyeClase(n, n, rng);
        for (const [clave, valor] of dadosClase) {
          const [f, c] = clave.split(',').map(Number);
          expect(solucion[f][c]).toBe(valor);
        }
        for (const p of pistasPares) {
          const va = solucion[p.a[0]][p.a[1]];
          const vb = solucion[p.b[0]][p.b[1]];
          expect(va === vb).toBe(p.misma);
        }
        const { soluciones, primera } = contarSolucionesClase(n, n, dadosClase, pistasPares, { tope: 2 });
        expect(soluciones).toBe(1);
        expect(primera).toEqual(solucion);
      }
    }
  });
});

describe('buildAndroidesPuzzle', () => {
  it('genera un puzzle completo con ambas capas unicas y consistentes', () => {
    for (let seed = 0; seed < 40; seed++) {
      const { variant, dificultad, payload } = buildAndroidesPuzzle(seed);
      const n = payload.tablero.ancho;

      expect(payload.tablero.alto).toBe(n);
      expect([3, 4]).toContain(n);
      expect(payload.numClases).toBe(n);
      expect(variant).toBe(`${n}`);
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      for (const { f, c, valor } of payload.dadosModelo) {
        expect(payload.solucionModelo[f][c]).toBe(valor);
      }
      const dadosModeloMap = new Map(payload.dadosModelo.map(({ f, c, valor }) => [`${f},${c}`, valor]));
      const { soluciones: solsModelo, primera: primModelo } = contarSolucionesModelo(n, dadosModeloMap, { tope: 2 });
      expect(solsModelo).toBe(1);
      expect(primModelo).toEqual(payload.solucionModelo);

      for (const { f, c, valor } of payload.dadosClase) {
        expect(payload.solucionClase[f][c]).toBe(valor);
      }
      for (const p of payload.pistasPares) {
        const va = payload.solucionClase[p.a[0]][p.a[1]];
        const vb = payload.solucionClase[p.b[0]][p.b[1]];
        expect(va === vb).toBe(p.misma);
      }
      const dadosClaseMap = new Map(payload.dadosClase.map(({ f, c, valor }) => [`${f},${c}`, valor]));
      const { soluciones: solsClase, primera: primClase } = contarSolucionesClase(n, n, dadosClaseMap, payload.pistasPares, { tope: 2 });
      expect(solsClase).toBe(1);
      expect(primClase).toEqual(payload.solucionClase);
    }
  });
});
