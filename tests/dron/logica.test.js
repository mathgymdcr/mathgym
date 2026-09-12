import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, simulaCadena, evaluaTablero, buildDronPuzzle } from '../../scripts/dron-logic.js';

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

describe('simulaCadena', () => {
  const filler = { direccion: 'N', distancia: 1 };
  const instrucciones = [
    [{ direccion: 'E', distancia: 2 }, { direccion: 'S', distancia: 5 }, { direccion: 'S', distancia: 2 }],
    [{ direccion: 'E', distancia: 1 }, { direccion: 'O', distancia: 1 }, filler],
    [filler, filler, null]
  ];
  const meta = { f: 2, c: 2 };

  it('llega a la meta encadenando instrucciones', () => {
    const { resultado, pasos } = simulaCadena(3, instrucciones, meta, { f: 0, c: 0 });
    expect(resultado).toBe('meta');
    expect(pasos).toEqual([[0, 0], [0, 2], [2, 2]]);
  });

  it('se sale del tablero si una distancia excede el borde', () => {
    const { resultado } = simulaCadena(3, instrucciones, meta, { f: 0, c: 1 });
    expect(resultado).toBe('fuera');
  });

  it('detecta un bucle entre dos celdas que se apuntan mutuamente', () => {
    const { resultado } = simulaCadena(3, instrucciones, meta, { f: 1, c: 0 });
    expect(resultado).toBe('bucle');
  });
});

describe('buildDronPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildDronPuzzle(20260912);
    const b = buildDronPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: un unico inicio con la cadena mas larga hasta la meta', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { variant, dificultad, payload } = buildDronPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([5, 6]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      expect(payload.instrucciones).toHaveLength(n);
      for (const fila of payload.instrucciones) expect(fila).toHaveLength(n);
      expect(payload.instrucciones[payload.meta.f][payload.meta.c]).toBeNull();

      const { ganadores, mejorLongitud } = evaluaTablero(n, payload.instrucciones, payload.meta);
      expect(ganadores).toEqual([payload.solucion]);
      expect(mejorLongitud).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('evaluaTablero', () => {
  const fuera = { direccion: 'N', distancia: 5 };
  const meta = { f: 2, c: 2 };

  it('el inicio de la cadena mas larga que llega a la meta es el unico ganador', () => {
    const instrucciones = [
      [{ direccion: 'S', distancia: 1 }, fuera, fuera],
      [{ direccion: 'S', distancia: 1 }, fuera, fuera],
      [{ direccion: 'E', distancia: 2 }, fuera, null]
    ];
    // (0,0) -> (1,0) -> (2,0) -> meta: 3 saltos, la cadena mas larga.
    // (1,0) -> (2,0) -> meta: 2 saltos. (2,0) -> meta: 1 salto. Ambas mas
    // cortas que la de (0,0), asi que (0,0) es el unico ganador.
    const { ganadores, mejorLongitud } = evaluaTablero(3, instrucciones, meta);
    expect(mejorLongitud).toBe(3);
    expect(ganadores).toEqual([{ f: 0, c: 0 }]);
  });

  it('dos cadenas independientes de la misma longitud maxima empatan', () => {
    const instrucciones = [
      [{ direccion: 'S', distancia: 1 }, { direccion: 'E', distancia: 1 }, { direccion: 'S', distancia: 1 }],
      [{ direccion: 'S', distancia: 1 }, fuera, { direccion: 'S', distancia: 1 }],
      [{ direccion: 'E', distancia: 2 }, fuera, null]
    ];
    const { ganadores, mejorLongitud } = evaluaTablero(3, instrucciones, meta);
    expect(mejorLongitud).toBe(3);
    expect(ganadores).toHaveLength(2);
    expect(ganadores).toContainEqual({ f: 0, c: 0 });
    expect(ganadores).toContainEqual({ f: 0, c: 1 });
  });
});
