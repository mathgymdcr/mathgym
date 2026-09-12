import { describe, it, expect, beforeAll } from 'vitest';
import { buildDronPuzzle } from '../../scripts/dron-logic.js';

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

// Contrato entre el payload que escribe el generador y lo que lee
// plantillas/ruta_dron.js: monta el tablero, toca la baldosa solucion y
// comprueba que la plantilla la da por buena.
describe('plantillas/ruta_dron.js con el payload del generador', () => {
  it('pinta la rejilla y la meta; tocar la baldosa solucion y comprobar dispara onSuccess', async () => {
    const mod = await import('../../plantillas/ruta_dron.js');
    const { payload } = buildDronPuzzle(2); // mismo seed que el muestrario (5x5)
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, {
      tablero: payload.tablero,
      meta: payload.meta,
      instrucciones: payload.instrucciones,
      solucion: payload.solucion
    }, {
      onSuccess: (info) => { exito = info; }
    });

    const celdas = [...root.querySelectorAll('.dron-celda')];
    expect(celdas).toHaveLength(n * n);
    expect(celdas[payload.meta.f * n + payload.meta.c].classList.contains('meta')).toBe(true);

    celdas[payload.solucion.f * n + payload.solucion.c].click();

    const botones = [...root.querySelectorAll('button')];
    const btnComprobar = botones.find((b) => b.textContent === 'Comprobar');
    btnComprobar.click();

    expect(exito).toEqual({ fallos: 0 });
    expect(root.querySelector('.feedback.ok')).toBeTruthy();
    expect(root.querySelector('.feedback.ko')).toBeNull();
  });
});
