import { describe, it, expect, beforeAll } from 'vitest';
import { buildCuboPuzzle, rollCube } from '../../scripts/cubo-logic.js';

// happy-dom no implementa <canvas>; celebration.js dibuja confeti ahi al
// disparar onSuccess. Mismo stub minimo que usan riego/poligono/fabrica.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  });
});

// Reconstruye un camino minimo real desde `inicio` hasta `meta` con el
// mismo BFS que usa el generador/validador -- evita tener que fijar a mano
// la secuencia de flechas para cada seed.
function caminoMinimo(n, inicio, meta, rollCube) {
  const DIRV = { N: [-1, 0], S: [1, 0], E: [0, 1], O: [0, -1] };
  const clave = (f, c, o) => `${f},${c},${o.U},${o.N}`;
  const arranque = { ...inicio, camino: [] };
  const vistos = new Map([[clave(arranque.f, arranque.c, arranque.orientacion), arranque]]);
  const cola = [arranque];
  while (cola.length) {
    const actual = cola.shift();
    if (actual.f === meta.f && actual.c === meta.c && actual.orientacion.U === meta.cara) {
      return actual.camino;
    }
    for (const dir of ['N', 'S', 'E', 'O']) {
      const [df, dc] = DIRV[dir];
      const f = actual.f + df;
      const c = actual.c + dc;
      if (f < 0 || f >= n || c < 0 || c >= n) continue;
      const orientacion = rollCube(actual.orientacion, dir);
      const k = clave(f, c, orientacion);
      if (vistos.has(k)) continue;
      const nuevo = { f, c, orientacion, camino: [...actual.camino, dir] };
      vistos.set(k, nuevo);
      cola.push(nuevo);
    }
  }
  throw new Error('sin camino');
}

// Contrato entre el payload que escribe el generador y lo que lee
// plantillas/cubo_transportista.js: monta el tablero, reproduce un camino
// minimo real clic a clic sobre las flechas y comprueba que dispara
// onSuccess exactamente en `minimo` movimientos.
describe('plantillas/cubo_transportista.js con el payload del generador', () => {
  it('reproducir el camino minimo lleva el cubo a la meta y dispara onSuccess', async () => {
    const mod = await import('../../plantillas/cubo_transportista.js');
    const { payload } = buildCuboPuzzle(2); // mismo seed que el muestrario (5x5)
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, {
      tablero: payload.tablero,
      inicio: payload.inicio,
      meta: payload.meta,
      minimo: payload.minimo
    }, {
      onSuccess: (info) => { exito = info; }
    });

    const camino = caminoMinimo(n, payload.inicio, payload.meta, rollCube);
    expect(camino).toHaveLength(payload.minimo);

    const boton = { N: '.cubo-flecha-n', S: '.cubo-flecha-s', E: '.cubo-flecha-e', O: '.cubo-flecha-o' };
    for (const dir of camino) {
      root.querySelector(boton[dir]).click();
    }

    expect(exito).toEqual({ movimientos: payload.minimo });
    expect(root.querySelector('.feedback.ok')).toBeTruthy();
  });
});
