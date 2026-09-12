import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, generaParticion, contarSoluciones, buildInvernaderoPuzzle } from '../../scripts/invernadero-logic.js';

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

  it('el tamano cae siempre en 6, 8 o 10', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { tamano } = ejesDeSeed(seed);
      expect([6, 8, 10]).toContain(tamano);
    }
  });

  it('varianteDeSeed es un string estable a partir del tamano', () => {
    expect(varianteDeSeed(1)).toBe(varianteDeSeed(1));
    expect(typeof varianteDeSeed(1)).toBe('string');
  });
});

describe('generaParticion', () => {
  it('cubre el tablero entero sin huecos ni solapes, con rectangulos dentro de los limites', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const n = 8;
      const rects = generaParticion(n, rng, 9);

      const cubierta = Array.from({ length: n }, () => Array(n).fill(0));
      for (const r of rects) {
        expect(r.ancho).toBeGreaterThanOrEqual(1);
        expect(r.alto).toBeGreaterThanOrEqual(1);
        expect(r.f + r.alto).toBeLessThanOrEqual(n);
        expect(r.c + r.ancho).toBeLessThanOrEqual(n);
        for (let f = r.f; f < r.f + r.alto; f++) {
          for (let c = r.c; c < r.c + r.ancho; c++) {
            expect(cubierta[f][c], `celda [${f},${c}] cubierta dos veces`).toBe(0);
            cubierta[f][c] = 1;
          }
        }
      }
      for (const fila of cubierta) {
        for (const v of fila) expect(v).toBe(1);
      }
    }
  });

  it('respeta el area maxima por rectangulo', () => {
    const rng = mulberry32(7);
    const rects = generaParticion(10, rng, 6);
    for (const r of rects) {
      expect(r.ancho * r.alto).toBeLessThanOrEqual(6);
    }
  });
});

describe('buildInvernaderoPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildInvernaderoPuzzle(20260912);
    const b = buildInvernaderoPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: una pista por rectangulo y solucion unica', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { variant, dificultad, payload } = buildInvernaderoPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([6, 8, 10]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      // Cada pista cae dentro de su propio rectangulo de la solucion, y
      // cada rectangulo lleva exactamente una.
      const contadas = payload.solucion.map(() => 0);
      for (const pista of payload.pistas) {
        const idx = payload.solucion.findIndex(
          (r) => pista.f >= r.f && pista.f < r.f + r.alto && pista.c >= r.c && pista.c < r.c + r.ancho
        );
        expect(idx, `pista [${pista.f},${pista.c}] sin rectangulo`).toBeGreaterThanOrEqual(0);
        expect(pista.valor).toBe(payload.solucion[idx].ancho * payload.solucion[idx].alto);
        contadas[idx]++;
      }
      expect(contadas.every((c) => c === 1)).toBe(true);

      const { soluciones, primera } = contarSoluciones(n, payload.pistas, { tope: 2 });
      expect(soluciones).toBe(1);
      // primera puede traer las pistas en otro orden que payload.solucion
      // (ver contarSoluciones), asi que se compara como conjunto.
      const normaliza = (rects) => rects.map((r) => `${r.f},${r.c},${r.ancho},${r.alto}`).sort();
      expect(normaliza(primera)).toEqual(normaliza(payload.solucion));
    }
  });
});

describe('contarSoluciones', () => {
  it('una unica pista que cubre todo el tablero tiene una unica solucion', () => {
    const { soluciones, primera } = contarSoluciones(2, [{ f: 0, c: 0, valor: 4 }], { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([{ f: 0, c: 0, ancho: 2, alto: 2 }]);
  });

  it('una pista con area que no cabe en el tablero no tiene solucion', () => {
    const { soluciones } = contarSoluciones(2, [{ f: 0, c: 0, valor: 3 }], { tope: 5 });
    expect(soluciones).toBe(0);
  });

  it('dos pistas simetricas de area 8 en un 4x4 admiten dos repartos (horizontal y vertical)', () => {
    const clues = [{ f: 1, c: 1, valor: 8 }, { f: 2, c: 2, valor: 8 }];
    const { soluciones } = contarSoluciones(4, clues, { tope: 5 });
    expect(soluciones).toBe(2);
  });

  it('respeta el tope sin seguir contando de mas', () => {
    const clues = [{ f: 1, c: 1, valor: 8 }, { f: 2, c: 2, valor: 8 }];
    const { soluciones } = contarSoluciones(4, clues, { tope: 1 });
    expect(soluciones).toBe(1);
  });
});
