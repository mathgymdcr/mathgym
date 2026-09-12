import { describe, it, expect, beforeAll } from 'vitest';
import { buildFabricaPuzzle } from '../../scripts/fabrica-logic.js';

// happy-dom no implementa <canvas>; celebration.js dibuja confeti ahí al
// disparar onSuccess. Mismo stub minimo que usan riego/poligono/balanza.
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
    arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
  });
});

// Contrato entre el payload que escribe el generador y lo que lee
// plantillas/fabrica_bloques.js: monta el tablero, rellena la solución de
// verdad clic a clic (celda -> numpad) y comprueba que la plantilla la da
// por buena -- no solo que no reviente al montar.
describe('plantillas/fabrica_bloques.js con el payload del generador', () => {
  it('pinta rejilla, bordes de región y celdas dadas; resolverla dispara onSuccess', async () => {
    const mod = await import('../../plantillas/fabrica_bloques.js');
    const { payload } = buildFabricaPuzzle(9); // 4-basicas, mismo seed que el muestrario
    const n = payload.tablero.ancho;

    const root = document.createElement('div');
    let exito = null;
    await mod.render(root, { tablero: payload.tablero, regiones: payload.regiones, solucion: payload.solucion }, {
      onSuccess: (info) => { exito = info; }
    });

    const celdas = [...root.querySelectorAll('.fabrica-celda')];
    expect(celdas).toHaveLength(n * n);

    const regionDeCelda = Array.from({ length: n }, () => Array(n).fill(null));
    payload.regiones.forEach((region) => {
      region.celdas.forEach(([f, c]) => { regionDeCelda[f][c] = region; });
    });

    // Las celdas de una región de una sola celda vienen ya rellenas y
    // deshabilitadas -- no hay nada que el jugador tenga que deducir ahí.
    let dadas = 0;
    payload.regiones.forEach((region) => {
      if (region.operacion === null) {
        const [f, c] = region.celdas[0];
        const celda = celdas[f * n + c];
        expect(celda.classList.contains('fija')).toBe(true);
        expect(celda.disabled).toBe(true);
        dadas++;
      }
    });
    expect(dadas).toBeGreaterThan(0);

    const numpad = [...root.querySelectorAll('.fabrica-num')].filter((b) => !b.classList.contains('fabrica-num-borrar'));
    expect(numpad).toHaveLength(n);

    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        const celda = celdas[f * n + c];
        if (celda.disabled) continue;
        celda.click();
        const valor = payload.solucion[f][c];
        const boton = numpad.find((b) => b.textContent === String(valor));
        boton.click();
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
