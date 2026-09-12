import { describe, it, expect, beforeAll } from 'vitest';
import { buildRadarPuzzle } from '../../scripts/radar-logic.js';

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
// plantillas/radar_asteroides.js: monta el tablero, marca cada asteroide
// real de la solucion clic a clic y comprueba que la plantilla lo da por
// bueno.
describe('plantillas/radar_asteroides.js con el payload del generador', () => {
  it('pinta la rejilla y las pistas; marcar los asteroides reales dispara onSuccess', async () => {
    const mod = await import('../../plantillas/radar_asteroides.js');
    const { payload } = buildRadarPuzzle(2); // mismo seed que el muestrario (5x5)
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, {
      tablero: payload.tablero,
      pistas: payload.pistas,
      asteroides_totales: payload.asteroides_totales,
      solucion: payload.solucion
    }, {
      onSuccess: (info) => { exito = info; }
    });

    const celdas = [...root.querySelectorAll('.radar-celda')];
    expect(celdas).toHaveLength(n * n);

    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (payload.solucion[f][c]) celdas[f * n + c].click();
      }
    }

    const botones = [...root.querySelectorAll('button')];
    const btnComprobar = botones.find((b) => b.textContent === 'Comprobar');
    btnComprobar.click();

    expect(exito).toEqual({ fallos: 0 });
    expect(root.querySelector('.feedback.ok')).toBeTruthy();
    expect(root.querySelector('.feedback.ko')).toBeNull();
  });
});
