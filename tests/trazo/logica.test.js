import { describe, it, expect } from 'vitest';
import { ejesDeSeed, varianteDeSeed, pistaDeCelda, generaRegionA, contarSoluciones, buildTrazoPuzzle } from '../../scripts/trazo-logic.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function esConexaYSinAgujeros(n, enA) {
  let inicio = null;
  let totalA = 0;
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (enA[f][c]) { totalA++; if (!inicio) inicio = [f, c]; }
    }
  }
  if (totalA === 0) return false;
  const vecinos4 = (f, c) => [[f - 1, c], [f + 1, c], [f, c - 1], [f, c + 1]].filter(
    ([vf, vc]) => vf >= 0 && vf < n && vc >= 0 && vc < n
  );
  const vistos = Array.from({ length: n }, () => Array(n).fill(false));
  vistos[inicio[0]][inicio[1]] = true;
  const cola = [inicio];
  let contados = 1;
  while (cola.length) {
    const [f, c] = cola.pop();
    for (const [vf, vc] of vecinos4(f, c)) {
      if (enA[vf][vc] && !vistos[vf][vc]) { vistos[vf][vc] = true; contados++; cola.push([vf, vc]); }
    }
  }
  if (contados !== totalA) return false;

  const vistoB = Array.from({ length: n }, () => Array(n).fill(false));
  const colaB = [];
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      const tocaBorde = f === 0 || f === n - 1 || c === 0 || c === n - 1;
      if (tocaBorde && !enA[f][c] && !vistoB[f][c]) { vistoB[f][c] = true; colaB.push([f, c]); }
    }
  }
  while (colaB.length) {
    const [f, c] = colaB.pop();
    for (const [vf, vc] of vecinos4(f, c)) {
      if (!enA[vf][vc] && !vistoB[vf][vc]) { vistoB[vf][vc] = true; colaB.push([vf, vc]); }
    }
  }
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) if (!enA[f][c] && !vistoB[f][c]) return false;
  }
  return true;
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

describe('pistaDeCelda', () => {
  it('cuenta cuantos de los hasta 4 lados dan a una celda del otro color (el borde cuenta como B)', () => {
    // A . / . .   (A=dentro, .=fuera)
    const enA = [[true, false], [false, false]];
    expect(pistaDeCelda(2, enA, 0, 0)).toBe(4); // los 4 lados de la esquina dan a B (2 vecinas B + 2 lados de borde)
    expect(pistaDeCelda(2, enA, 0, 1)).toBe(1); // solo el lado que da a la A
    expect(pistaDeCelda(2, enA, 1, 0)).toBe(1);
    expect(pistaDeCelda(2, enA, 1, 1)).toBe(0); // toda su vecindad (incluido el borde) es B
  });
});

describe('contarSoluciones', () => {
  it('una pista en 0 fuerza una unica coloracion valida (el resto igual de vacio se descarta por no tener trazo)', () => {
    const { soluciones, primera } = contarSoluciones(2, [['0,0', 0]], { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[false, false], [false, true]]);
  });

  it('una pista en 4 en una esquina solo la cumple esa celda sola como A (el borde nunca cambia de color)', () => {
    // El borde del tablero es SIEMPRE B, sin importar el color de la
    // celda -- por eso una esquina (con 2 lados de borde) solo puede
    // llegar a pista=4 siendo ella misma A y sus 2 vecinas B; la
    // "inversion" (ella B y las vecinas A) es imposible porque los 2
    // lados de borde nunca contarian como distintos de un B.
    const { soluciones, primera } = contarSoluciones(2, [['0,0', 4]], { tope: 5 });
    expect(soluciones).toBe(1);
    expect(primera).toEqual([[true, false], [false, false]]);
  });

  it('respeta el tope de nodos: si se agota, marca `agotado` y no se fia del conteo parcial', () => {
    const { agotado } = contarSoluciones(6, [], { tope: 10, maxNodos: 5 });
    expect(agotado).toBe(true);
  });

  it('sin tope de nodos, un tablero pequeno sin ninguna pista revelada no se agota', () => {
    const { agotado } = contarSoluciones(3, [], { tope: 5 });
    expect(agotado).toBe(false);
  });
});

describe('buildTrazoPuzzle', () => {
  it('es determinista: la misma semilla da exactamente el mismo puzzle', () => {
    const a = buildTrazoPuzzle(20260912);
    const b = buildTrazoPuzzle(20260912);
    expect(a).toEqual(b);
  });

  it('genera un reto real: pistas consistentes con la solucion y solucion unica', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { variant, dificultad, payload } = buildTrazoPuzzle(seed);
      const n = payload.tablero.ancho;
      expect(payload.tablero.alto).toBe(n);
      expect([5, 6, 7]).toContain(n);
      expect(typeof variant).toBe('string');
      expect(dificultad).toBeGreaterThanOrEqual(1);
      expect(dificultad).toBeLessThanOrEqual(5);

      expect(esConexaYSinAgujeros(n, payload.solucion)).toBe(true);

      for (const p of payload.pistas) {
        expect(p.valor).toBe(pistaDeCelda(n, payload.solucion, p.f, p.c));
      }

      const entradas = payload.pistas.map((p) => [`${p.f},${p.c}`, p.valor]);
      const { soluciones, primera, agotado } = contarSoluciones(n, entradas, { tope: 2, maxNodos: 2000000 });
      expect(agotado).toBe(false);
      expect(soluciones).toBe(1);
      expect(primera).toEqual(payload.solucion);
    }
  });
});

describe('generaRegionA', () => {
  it('produce siempre una region conexa y sin agujeros, ni vacia ni completa', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const n = 6;
      const enA = generaRegionA(n, rng);
      expect(esConexaYSinAgujeros(n, enA)).toBe(true);

      let total = 0;
      for (const fila of enA) for (const v of fila) if (v) total++;
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(n * n);
    }
  });
});
