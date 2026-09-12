import { describe, it, expect } from 'vitest';
import { buildRedPuzzle } from '../../scripts/red-logic.js';

// happy-dom no soporta gestos de arrastre reales ni getBoundingClientRect
// con layout de verdad (ver mathgym-happy-dom-no-ve-el-navegador): este
// smoke test solo comprueba que la plantilla monta el lienzo con sus nodos
// y cables. El arrastre en sí se prueba a mano en Chrome real.
describe('plantillas/red_enredada.js con el payload del generador', () => {
  it('pinta un nodo por cada vertice y una linea SVG por cada arista', async () => {
    const mod = await import('../../plantillas/red_enredada.js');
    const { payload } = buildRedPuzzle(2); // mismo seed que el muestrario (8 nodos)

    const root = document.createElement('div');
    await mod.render(root, {
      nodos: payload.nodos,
      aristas: payload.aristas,
      posiciones_iniciales: payload.posiciones_iniciales
    }, {});

    expect(root.querySelectorAll('.red-nodo')).toHaveLength(payload.nodos);
    expect(root.querySelectorAll('.red-cable')).toHaveLength(payload.aristas.length);
    expect(root.querySelector('.feedback.ko')).toBeNull();
  });
});
