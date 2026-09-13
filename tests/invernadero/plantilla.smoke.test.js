import { describe, it, expect, beforeAll } from 'vitest';
import { buildInvernaderoPuzzle } from '../../scripts/invernadero-logic.js';

// happy-dom no implementa <canvas>; celebration.js dibuja confeti ahi al
// disparar onSuccess. Mismo stub minimo que usan riego/poligono/balanza/fabrica.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  });
});

// Contrato entre el payload que escribe el generador y lo que lee
// plantillas/planos_invernadero.js: monta el tablero, traza cada
// rectangulo de la solucion clic-a-clic (esquina, esquina opuesta -- la
// misma dos veces para un modulo de 1 celda) y comprueba que la plantilla
// lo da por bueno.
describe('plantillas/planos_invernadero.js con el payload del generador', () => {
  it('pinta la rejilla y las pistas; trazar la solucion clic a clic dispara onSuccess', async () => {
    const mod = await import('../../plantillas/planos_invernadero.js');
    const { payload } = buildInvernaderoPuzzle(2); // mismo seed que el muestrario (6x6)
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, { tablero: payload.tablero, pistas: payload.pistas }, {
      onSuccess: (info) => { exito = info; }
    });

    const celdas = [...root.querySelectorAll('.invernadero-celda')];
    expect(celdas).toHaveLength(n * n);

    for (const r of payload.solucion) {
      celdas[r.f * n + r.c].click();
      celdas[(r.f + r.alto - 1) * n + (r.c + r.ancho - 1)].click();
    }

    const botones = [...root.querySelectorAll('button')];
    const btnComprobar = botones.find((b) => b.textContent === 'Comprobar');
    btnComprobar.click();

    expect(exito).toEqual({ fallos: 0 });
    expect(root.querySelector('.feedback.ok')).toBeTruthy();
    expect(root.querySelector('.feedback.ko')).toBeNull();
  });
});
