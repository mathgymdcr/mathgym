import { describe, it, expect } from 'vitest';
import {
  ejesDeSeed, varianteDeSeed, BANCO_PALABRAS, tamanoRejilla,
  cumplePista, contarSoluciones, construyeRetoUnico, generaPistasCandidatas,
  buildSenalPuzzle, pistaTexto
} from '../../scripts/senal-logic.js';

describe('ejesDeSeed / varianteDeSeed', () => {
  it('es determinista: la misma semilla da siempre la misma palabra', () => {
    expect(ejesDeSeed(20260912)).toEqual(ejesDeSeed(20260912));
  });

  it('la palabra siempre sale del banco', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(BANCO_PALABRAS).toContain(ejesDeSeed(seed).palabra);
    }
  });

  it('varianteDeSeed es la palabra en minusculas', () => {
    const { palabra } = ejesDeSeed(5);
    expect(varianteDeSeed(5)).toBe(palabra.toLowerCase());
  });

  it('reparte mas de una palabra en un barrido de seeds', () => {
    const vistas = new Set();
    for (let seed = 0; seed < 200; seed++) vistas.add(varianteDeSeed(seed));
    expect(vistas.size).toBeGreaterThan(1);
  });
});

describe('tamanoRejilla', () => {
  it('nunca baja de 6 -- por debajo, paridad+primo+cuadrado ancla una letra sola', () => {
    expect(tamanoRejilla(4)).toBe(6);
    expect(tamanoRejilla(5)).toBe(6);
  });

  it('crece con el alfabeto por encima de 6', () => {
    expect(tamanoRejilla(8)).toBe(8);
  });
});

describe('cumplePista', () => {
  const asign = { A: [2, 3], B: [5, 1] };

  it('pistas unarias leen solo su propia letra', () => {
    expect(cumplePista({ tipo: 'paridad_x', a: 'A', valor: 'par' }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'paridad_y', a: 'A', valor: 'par' }, asign)).toBe(false);
    expect(cumplePista({ tipo: 'primo_x', a: 'B', valor: true }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'cuadrado_y', a: 'B', valor: true }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'posicion_absoluta', a: 'A', valor: [2, 3] }, asign)).toBe(true);
  });

  it('pistas binarias comparan las dos letras', () => {
    expect(cumplePista({ tipo: 'suma_x', a: 'A', b: 'B', valor: 7 }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'orden_x', a: 'A', b: 'B', valor: true }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'mismo_y', a: 'A', b: 'B', valor: false }, asign)).toBe(true);
    expect(cumplePista({ tipo: 'consecutivos_x', a: 'A', b: 'B', valor: false }, asign)).toBe(true);
  });

  it('rechaza un tipo de pista desconocido', () => {
    expect(() => cumplePista({ tipo: 'inventado', a: 'A' }, asign)).toThrow();
  });
});

describe('contarSoluciones', () => {
  it('sin ninguna pista, cuenta todas las biyecciones letra->celda', () => {
    // 2 letras en una rejilla 2x2 (4 celdas): 4*3 = 12 formas de colocarlas.
    const { soluciones } = contarSoluciones(['A', 'B'], 2, [], { tope: 20 });
    expect(soluciones).toBe(12);
  });

  it('anclar una letra a una celda concreta deja solo las formas de la otra', () => {
    const { soluciones, primera } = contarSoluciones(
      ['A', 'B'], 2, [{ tipo: 'posicion_absoluta', a: 'A', valor: [0, 0] }], { tope: 20 }
    );
    expect(soluciones).toBe(3); // B en cualquiera de las 3 celdas restantes
    expect(primera.A).toEqual([0, 0]);
  });

  it('una pista imposible da cero soluciones', () => {
    const { soluciones } = contarSoluciones(
      ['A'], 2, [
        { tipo: 'paridad_x', a: 'A', valor: 'par' },
        { tipo: 'paridad_x', a: 'A', valor: 'impar' } // contradictorias
      ], { tope: 5 }
    );
    expect(soluciones).toBe(0);
  });

  it('respeta el tope sin seguir contando de mas', () => {
    const { soluciones } = contarSoluciones(['A', 'B'], 2, [], { tope: 2 });
    expect(soluciones).toBe(2);
  });
});

describe('construyeRetoUnico', () => {
  it('con TODAS las candidatas de una solucion real, la unicidad sale gratis', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { palabra } = ejesDeSeed(seed);
      const letras = [...new Set(palabra.split(''))];
      const n = tamanoRejilla(letras.length);
      const pos = {};
      // posiciones ficticias solo para fabricar candidatas coherentes
      const celdas = [];
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) celdas.push([x, y]);
      letras.forEach((l, i) => { pos[l] = celdas[i]; });
      const candidatas = generaPistasCandidatas(letras, pos);
      const { soluciones } = contarSoluciones(letras, n, candidatas, { tope: 2 });
      expect(soluciones).toBe(1);
    }
  });

  it('el resultado podado sigue siendo unico y usa MENOS pistas que el total candidato', () => {
    const { palabra } = ejesDeSeed(0);
    const letras = [...new Set(palabra.split(''))];
    const n = tamanoRejilla(letras.length);
    const celdas = [];
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) celdas.push([x, y]);
    const pos = {};
    letras.forEach((l, i) => { pos[l] = celdas[i]; });
    const candidatas = generaPistasCandidatas(letras, pos);
    const { pistas, soluciones } = construyeRetoUnico(letras, n, candidatas, 2);
    expect(soluciones).toBe(1);
    expect(pistas.length).toBeLessThan(candidatas.length);
  });
});

describe('buildSenalPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    expect(buildSenalPuzzle(20260912)).toEqual(buildSenalPuzzle(20260912));
  });

  it('genera un reto real: solucion unica y el mensaje cifrado descifra la palabra', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { palabra, alfabeto, tablero, solucion, mensajeCifrado, pistas, dificultad } = buildSenalPuzzle(seed);

      expect(tablero.ancho).toBe(tablero.alto);
      expect(tablero.ancho).toBeGreaterThanOrEqual(6);
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      // la solucion cubre justo el alfabeto, sin colisiones de celda
      expect(Object.keys(solucion).sort()).toEqual([...alfabeto].sort());
      const clavesUsadas = new Set(Object.values(solucion).map(([x, y]) => `${x},${y}`));
      expect(clavesUsadas.size).toBe(alfabeto.length);

      // leer el mensaje cifrado sobre la solucion reconstruye la palabra
      const posInversa = {};
      for (const letra of alfabeto) posInversa[`${solucion[letra][0]},${solucion[letra][1]}`] = letra;
      const descifrado = mensajeCifrado.map(([x, y]) => posInversa[`${x},${y}`]).join('');
      expect(descifrado).toBe(palabra);

      // las pistas reveladas son ciertas sobre la solucion real y la dejan unica
      for (const p of pistas) expect(cumplePista(p, solucion)).toBe(true);
      const { soluciones, primera } = contarSoluciones(alfabeto, tablero.ancho, pistas, { tope: 2 });
      expect(soluciones).toBe(1);
      expect(primera).toEqual(solucion);
    }
  });
});

describe('pistaTexto', () => {
  it('da un texto no vacio para cada tipo de pista del banco', () => {
    const pos = { A: [2, 3], B: [4, 1] };
    const candidatas = generaPistasCandidatas(['A', 'B'], pos);
    for (const p of candidatas) {
      const texto = pistaTexto(p);
      expect(typeof texto).toBe('string');
      expect(texto.length).toBeGreaterThan(5);
    }
  });
});
