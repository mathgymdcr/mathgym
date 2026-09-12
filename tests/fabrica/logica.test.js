import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, generaCuadradoLatino, construyeRegiones, calculaOperacion, contarSoluciones, buildFabricaPuzzle } from '../../scripts/fabrica-logic.js';

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

  it('el tamano cae siempre en 4, 5 o 6', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { tamano } = ejesDeSeed(seed);
      expect([4, 5, 6]).toContain(tamano);
    }
  });

  it('varianteDeSeed combina tamano y nivel de operaciones en un string estable', () => {
    const v1 = varianteDeSeed(1);
    const v2 = varianteDeSeed(1);
    expect(v1).toBe(v2);
    expect(typeof v1).toBe('string');
  });
});

describe('generaCuadradoLatino', () => {
  it('produce un cuadrado latino valido: sin repetidos en ninguna fila ni columna', () => {
    for (const n of [4, 5, 6]) {
      const rng = mulberry32(n * 7919 + 3);
      const cuadrado = generaCuadradoLatino(n, rng);
      expect(cuadrado).toHaveLength(n);
      for (const fila of cuadrado) {
        expect(fila).toHaveLength(n);
        expect(new Set(fila).size).toBe(n);
        for (const v of fila) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(n);
        }
      }
      for (let c = 0; c < n; c++) {
        const columna = cuadrado.map((fila) => fila[c]);
        expect(new Set(columna).size).toBe(n);
      }
    }
  });

  it('con rng distinto produce cuadrados distintos (no siempre el mismo patron)', () => {
    const distintos = new Set();
    for (let i = 0; i < 10; i++) {
      const rng = mulberry32(1000 + i);
      distintos.add(JSON.stringify(generaCuadradoLatino(5, rng)));
    }
    expect(distintos.size).toBeGreaterThan(1);
  });
});

function sonAdyacentes([f1, c1], [f2, c2]) {
  return (Math.abs(f1 - f2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && f1 === f2);
}

function esConexa(celdas) {
  const restantes = celdas.slice(1).map((c) => c.join(','));
  const vistas = new Set([celdas[0].join(',')]);
  let cambio = true;
  while (cambio && restantes.length) {
    cambio = false;
    for (let i = restantes.length - 1; i >= 0; i--) {
      const [f, c] = restantes[i].split(',').map(Number);
      if ([...vistas].some((v) => sonAdyacentes(v.split(',').map(Number), [f, c]))) {
        vistas.add(restantes[i]);
        restantes.splice(i, 1);
        cambio = true;
      }
    }
  }
  return restantes.length === 0;
}

describe('calculaOperacion', () => {
  it('una region de una celda no lleva operacion: el objetivo es el propio valor', () => {
    const rng = mulberry32(1);
    const { operacion, objetivo } = calculaOperacion([7], true, rng);
    expect(operacion).toBeNull();
    expect(objetivo).toBe(7);
  });

  it('en nivel basico nunca elige multiplicacion ni division', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = mulberry32(seed);
      const { operacion } = calculaOperacion([2, 3], false, rng);
      expect(['suma', 'resta']).toContain(operacion);
    }
  });

  it('con mas de 2 celdas nunca elige resta ni division (no estan definidas ahi)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = mulberry32(seed);
      const { operacion } = calculaOperacion([2, 3, 4], true, rng);
      expect(['suma', 'multiplicacion']).toContain(operacion);
    }
  });

  it('el objetivo siempre coincide con el resultado real de la operacion elegida', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const valores = [4, 2];
      const { operacion, objetivo } = calculaOperacion(valores, true, rng);
      if (operacion === 'suma') expect(objetivo).toBe(6);
      if (operacion === 'multiplicacion') expect(objetivo).toBe(8);
      if (operacion === 'resta') expect(objetivo).toBe(2);
      if (operacion === 'division') expect(objetivo).toBe(2);
    }
  });

  it('division solo se elige cuando divide exacto', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      // 3 y 5 no dividen exacto en ningun sentido.
      const { operacion } = calculaOperacion([3, 5], true, rng);
      expect(operacion).not.toBe('division');
    }
  });
});

describe('buildFabricaPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildFabricaPuzzle(20260912);
    const b = buildFabricaPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: cuadrado latino valido, regiones que cubren todo y solucion unica', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { variant, dificultad, payload } = buildFabricaPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([4, 5, 6]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      const vistas = new Set();
      for (const region of payload.regiones) {
        for (const [f, c] of region.celdas) vistas.add(`${f},${c}`);
      }
      expect(vistas.size).toBe(n * n);

      for (const fila of payload.solucion) {
        expect(new Set(fila).size).toBe(n);
      }
      for (let c = 0; c < n; c++) {
        const columna = payload.solucion.map((fila) => fila[c]);
        expect(new Set(columna).size).toBe(n);
      }

      const { soluciones, primera } = contarSoluciones(n, payload.regiones, { tope: 2 });
      expect(soluciones).toBe(1);
      expect(primera).toEqual(payload.solucion);
    }
  });
});

describe('contarSoluciones', () => {
  it('sin regiones, cuenta todos los cuadrados latinos posibles (2x2 = 2)', () => {
    const { soluciones } = contarSoluciones(2, [], { tope: 10 });
    expect(soluciones).toBe(2);
  });

  it('sin regiones, cuenta todos los cuadrados latinos posibles (3x3 = 12)', () => {
    const { soluciones } = contarSoluciones(3, [], { tope: 20 });
    expect(soluciones).toBe(12);
  });

  it('fijar una celda con una region de un solo valor reduce el 2x2 a una unica solucion', () => {
    const regiones = [
      { id: 1, celdas: [[0, 0]], operacion: null, objetivo: 1 },
      { id: 2, celdas: [[0, 1], [1, 0], [1, 1]], operacion: 'suma', objetivo: 5 }
    ];
    const { soluciones, primera } = contarSoluciones(2, regiones, { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[1, 2], [2, 1]]);
  });

  it('una region con objetivo imposible da cero soluciones', () => {
    const regiones = [
      { id: 1, celdas: [[0, 0]], operacion: null, objetivo: 1 },
      { id: 2, celdas: [[0, 1], [1, 0], [1, 1]], operacion: 'suma', objetivo: 999 }
    ];
    const { soluciones } = contarSoluciones(2, regiones, { tope: 5 });
    expect(soluciones).toBe(0);
  });

  it('respeta el tope: no sigue contando de mas alla del limite pedido', () => {
    const { soluciones } = contarSoluciones(3, [], { tope: 2 });
    expect(soluciones).toBe(2);
  });
});

describe('construyeRegiones', () => {
  it('cubre cada celda del tablero exactamente una vez, en regiones conexas de tamano 1 a 4', () => {
    const rng = mulberry32(42);
    const n = 5;
    const regiones = construyeRegiones(n, rng, 4);

    const vistas = new Set();
    for (const region of regiones) {
      expect(region.celdas.length).toBeGreaterThanOrEqual(1);
      expect(region.celdas.length).toBeLessThanOrEqual(4);
      expect(esConexa(region.celdas)).toBe(true);
      for (const [f, c] of region.celdas) {
        const clave = `${f},${c}`;
        expect(vistas.has(clave)).toBe(false);
        vistas.add(clave);
      }
    }
    expect(vistas.size).toBe(n * n);
  });
});
