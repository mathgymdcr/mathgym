import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, ORIENTACION_INICIAL, rollCube, bfsDesde, buildCuboPuzzle } from '../../scripts/cubo-logic.js';

describe('ejesDeSeed / varianteDeSeed', () => {
  it('es determinista: la misma semilla da siempre los mismos ejes', () => {
    const a = ejesDeSeed(20260912);
    const b = ejesDeSeed(20260912);
    expect(a).toEqual(b);
  });

  it('el tamano cae siempre en 5 o 6', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { tamano } = ejesDeSeed(seed);
      expect([5, 6]).toContain(tamano);
    }
  });

  it('varianteDeSeed es un string estable a partir del tamano', () => {
    expect(varianteDeSeed(1)).toBe(varianteDeSeed(1));
    expect(typeof varianteDeSeed(1)).toBe('string');
  });
});

describe('rollCube', () => {
  it('rodar al norte: la cara de arriba pasa a mirar al norte', () => {
    const nueva = rollCube(ORIENTACION_INICIAL, 'N');
    expect(nueva.N).toBe(ORIENTACION_INICIAL.U);
    expect(nueva.D).toBe(ORIENTACION_INICIAL.N);
    expect(nueva.S).toBe(ORIENTACION_INICIAL.D);
    expect(nueva.U).toBe(ORIENTACION_INICIAL.S);
    expect(nueva.E).toBe(ORIENTACION_INICIAL.E);
    expect(nueva.O).toBe(ORIENTACION_INICIAL.O);
  });

  it('rodar 4 veces seguidas en la misma direccion vuelve a la orientacion de partida', () => {
    for (const direccion of ['N', 'S', 'E', 'O']) {
      let o = ORIENTACION_INICIAL;
      for (let i = 0; i < 4; i++) o = rollCube(o, direccion);
      expect(o).toEqual(ORIENTACION_INICIAL);
    }
  });

  it('rodar norte y luego sur deshace el movimiento', () => {
    const o = rollCube(rollCube(ORIENTACION_INICIAL, 'N'), 'S');
    expect(o).toEqual(ORIENTACION_INICIAL);
  });

  it('cada orientacion sigue teniendo las 6 caras originales, sin repetir', () => {
    const o = rollCube(rollCube(ORIENTACION_INICIAL, 'N'), 'E');
    const caras = [o.U, o.D, o.N, o.S, o.E, o.O];
    expect(new Set(caras)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});

describe('buildCuboPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildCuboPuzzle(20260912);
    const b = buildCuboPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: la meta es alcanzable en el minimo declarado, y no en menos', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { variant, dificultad, payload } = buildCuboPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([5, 6]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);
      expect(payload.minimo).toBeGreaterThanOrEqual(2);
      expect(payload.meta.f === payload.inicio.f && payload.meta.c === payload.inicio.c).toBe(false);

      const estados = bfsDesde(n, payload.inicio);
      const enMeta = estados.filter(
        (e) => e.f === payload.meta.f && e.c === payload.meta.c && e.orientacion.U === payload.meta.cara
      );
      expect(enMeta.length).toBeGreaterThan(0);
      const mejor = Math.min(...enMeta.map((e) => e.distancia));
      expect(mejor).toBe(payload.minimo);
    }
  });
});

describe('bfsDesde', () => {
  it('el propio inicio tiene distancia 0 con su orientacion original', () => {
    const estados = bfsDesde(3, { f: 0, c: 0, orientacion: ORIENTACION_INICIAL });
    const propio = estados.find((e) => e.f === 0 && e.c === 0 && e.distancia === 0);
    expect(propio).toBeTruthy();
    expect(propio.orientacion).toEqual(ORIENTACION_INICIAL);
  });

  it('desde una esquina, solo dos vecinos son alcanzables en 1 movimiento', () => {
    const estados = bfsDesde(3, { f: 0, c: 0, orientacion: ORIENTACION_INICIAL });
    const aDistancia1 = estados.filter((e) => e.distancia === 1);
    expect(aDistancia1).toHaveLength(2);
    const celdas = aDistancia1.map((e) => `${e.f},${e.c}`).sort();
    expect(celdas).toEqual(['0,1', '1,0']);
  });

  it('la orientacion a un paso coincide con la que calcula rollCube', () => {
    const estados = bfsDesde(3, { f: 0, c: 0, orientacion: ORIENTACION_INICIAL });
    const este = estados.find((e) => e.f === 0 && e.c === 1 && e.distancia === 1);
    expect(este.orientacion).toEqual(rollCube(ORIENTACION_INICIAL, 'E'));
  });

  it('nunca visita fuera del tablero', () => {
    const n = 3;
    const estados = bfsDesde(n, { f: 0, c: 0, orientacion: ORIENTACION_INICIAL });
    for (const e of estados) {
      expect(e.f).toBeGreaterThanOrEqual(0);
      expect(e.f).toBeLessThan(n);
      expect(e.c).toBeGreaterThanOrEqual(0);
      expect(e.c).toBeLessThan(n);
    }
  });
});
