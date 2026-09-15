import { describe, it, expect, beforeAll } from 'vitest';
import { buildTrazoPuzzle } from '../../scripts/trazo-logic.js';

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
// plantillas/trazo_perimetral.js: monta el tablero, activa exactamente las
// aristas reales del `solucion` (frontera entre colores) clic a clic y
// comprueba que la plantilla lo da por bueno.
describe('plantillas/trazo_perimetral.js con el payload del generador', () => {
  it('pinta puntos, pistas y aristas; trazar el circuito real dispara onSuccess', async () => {
    const mod = await import('../../plantillas/trazo_perimetral.js');
    const { payload } = buildTrazoPuzzle(2); // mismo seed que el muestrario (5x5)
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, {
      tablero: payload.tablero,
      pistas: payload.pistas,
      solucion: payload.solucion
    }, {
      onSuccess: (info) => { exito = info; }
    });

    expect(root.querySelectorAll('.trazo-punto')).toHaveLength((n + 1) * (n + 1));
    expect(root.querySelectorAll('.trazo-numero')).toHaveLength(payload.pistas.length);

    const botonesH = [...root.querySelectorAll('.trazo-arista-h')];
    const botonesV = [...root.querySelectorAll('.trazo-arista-v')];
    expect(botonesH).toHaveLength((n + 1) * n);
    expect(botonesV).toHaveLength(n * (n + 1));

    function colorEn(f, c) {
      if (f < 0 || f >= n || c < 0 || c >= n) return false;
      return payload.solucion[f][c];
    }

    // botonesH esta en orden de creacion: r de 0..n, c de 0..n-1 (fila a fila).
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c < n; c++) {
        if (colorEn(r - 1, c) !== colorEn(r, c)) botonesH[r * n + c].click();
      }
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n; c++) {
        if (colorEn(r, c - 1) !== colorEn(r, c)) botonesV[r * (n + 1) + c].click();
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
