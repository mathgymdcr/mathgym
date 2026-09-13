import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, generaArbol, segmentosSeCruzan, cuentaCruces, buildRedPuzzle } from '../../scripts/red-logic.js';

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

  it('el numero de nodos cae siempre en 8 o 10', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { nodos } = ejesDeSeed(seed);
      expect([8, 10]).toContain(nodos);
    }
  });

  it('varianteDeSeed es un string estable a partir de los nodos', () => {
    expect(varianteDeSeed(1)).toBe(varianteDeSeed(1));
    expect(typeof varianteDeSeed(1)).toBe('string');
  });
});

function esConexo(n, aristas) {
  const vecinos = Array.from({ length: n }, () => []);
  for (const [a, b] of aristas) { vecinos[a].push(b); vecinos[b].push(a); }
  const vistos = new Set([0]);
  const cola = [0];
  while (cola.length) {
    const actual = cola.pop();
    for (const v of vecinos[actual]) {
      if (!vistos.has(v)) { vistos.add(v); cola.push(v); }
    }
  }
  return vistos.size === n;
}

describe('buildRedPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildRedPuzzle(20260912);
    const b = buildRedPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: arbol conexo y posiciones iniciales con al menos un cruce', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { variant, dificultad, payload } = buildRedPuzzle(seed);
      const n = payload.nodos;
      expect([8, 10]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      expect(payload.aristas).toHaveLength(n - 1);
      expect(esConexo(n, payload.aristas)).toBe(true);
      expect(payload.posiciones_iniciales).toHaveLength(n);
      for (const p of payload.posiciones_iniciales) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }

      const cruces = cuentaCruces(payload.posiciones_iniciales, payload.aristas);
      expect(cruces).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('generaArbol', () => {
  it('produce n-1 aristas, sin bucles ni repetidos, conexo', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const n = 8;
      const aristas = generaArbol(n, rng);
      expect(aristas).toHaveLength(n - 1);

      const vistas = new Set();
      for (const [a, b] of aristas) {
        expect(a).not.toBe(b);
        const clave = [a, b].sort().join('-');
        expect(vistas.has(clave)).toBe(false);
        vistas.add(clave);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(n);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(n);
      }
      expect(esConexo(n, aristas)).toBe(true);
    }
  });
});

describe('segmentosSeCruzan', () => {
  it('detecta una X clara', () => {
    expect(segmentosSeCruzan({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(true);
  });

  it('dos segmentos paralelos no cruzan', () => {
    expect(segmentosSeCruzan({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('dos segmentos que no se tocan no cruzan', () => {
    expect(segmentosSeCruzan({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false);
  });
});

describe('cuentaCruces', () => {
  it('cuenta 1 cruce en un cuadrado con sus dos diagonales', () => {
    const posiciones = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const aristas = [[0, 2], [1, 3]];
    expect(cuentaCruces(posiciones, aristas)).toBe(1);
  });

  it('no cuenta cruces entre lados opuestos de un cuadrado', () => {
    const posiciones = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const aristas = [[0, 1], [2, 3]];
    expect(cuentaCruces(posiciones, aristas)).toBe(0);
  });

  it('dos aristas que comparten un nodo nunca cuentan como cruce', () => {
    // Aunque geometricamente "se toquen" en el nodo compartido, eso no es
    // un cruce real -- cuentaCruces debe ignorar pares con nodo en comun.
    const posiciones = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
    const aristas = [[0, 1], [1, 2]];
    expect(cuentaCruces(posiciones, aristas)).toBe(0);
  });
});
