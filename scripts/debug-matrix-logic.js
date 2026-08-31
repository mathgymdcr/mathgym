// ===== scripts/debug-matrix-logic.js =====
// Barrido puro de semillas para la página de debug: por cada semilla entera
// creciente, llama a `generar(seed)` y se queda con la primera que produce
// cada `variant` distinta. Separado de generate-debug-matrix.js (que sí toca
// disco) para poder probarlo sin generar retos de verdad.

export async function descubreVariantes(generar, { maxSeeds = 4000, maxVariantes = 60, maxSinNuevas = 200 } = {}) {
  const vistas = new Set();
  const encontradas = [];
  let sinNuevas = 0;

  for (let seed = 0; seed < maxSeeds && encontradas.length < maxVariantes; seed++) {
    const resultado = await generar(seed);
    if (vistas.has(resultado.variant)) {
      sinNuevas++;
      // Un espacio de variantes cerrado (como hashi, con solo 2) no gana
      // nada escaneando hasta maxSeeds: si lleva muchas semillas seguidas
      // sin encontrar nada nuevo, ya no queda nada que encontrar.
      if (sinNuevas >= maxSinNuevas) break;
      continue;
    }
    vistas.add(resultado.variant);
    encontradas.push(resultado);
    sinNuevas = 0;
  }

  return encontradas;
}
