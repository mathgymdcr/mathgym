// ===== scripts/einstein-logic.js =====
// Banco temático, generación y solver del enigma de Einstein,
// compartidos entre el generador y el validador.
//
// Estructura del puzzle: N grupos ("casas"), cada uno con una Persona
// (que actúa de ancla) y un valor de cada una de las categorías
// temáticas elegidas ese día. El tablero se describe como `filas x
// casas` contando a Persona como fila -- 4x4, 5x4, 4x5 o 5x5 -- y se
// sortea del seed con sesgo al 4x4.
//
// La plantilla valida comparando conjuntos por columna e IGNORA el
// orden de las columnas, así que "solución única" significa un único
// AGRUPAMIENTO: se ancla `personas` y se permutan de forma
// independiente las categorías restantes -> (N!)^(filas-1)
// candidatos, de 13.824 en el 4x4 a 207 millones en el 5x5. De ahí que
// la unicidad se decida con un solver de rejilla y no enumerándolos.
//
// El generador anterior producía puzzles con 3-4 soluciones válidas y
// solo 3 puzzles distintos en total (la solución era la identidad y la
// variable `shuffled` no se usaba). Aquí la solución se sortea de
// verdad y las pistas se podan verificando unicidad en cada paso.

// ---------------------------------------------------------------------
// PRNG determinista (mulberry32). Duplicado a propósito para que el
// módulo sea autocontenido, igual que en lightsout-logic.js.
// ---------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates real (a diferencia de shuffleArrayWithSeed, que aplicaba
// la MISMA permutación a todas las categorías y por eso no generaba
// ningún puzzle nuevo).
function shuffle(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------
// BANCO TEMÁTICO
// ---------------------------------------------------------------------
// `frase(v)` devuelve el sintagma verbal de la pista. Se compone así:
//   Persona-Atributo  positivo: "María viste camiseta roja."
//   Persona-Atributo  negativo: "María no viste camiseta roja."
//   Atributo-Atributo positivo: "Quien viste camiseta roja bebe café."
//   Atributo-Atributo negativo: "Quien viste camiseta roja no bebe café."
// Por eso toda `frase` empieza por verbo conjugado en 3ª persona.
//
// Concordancia de género: los valores de cada categoría se eligieron con
// género uniforme donde la frase lleva artículo (Mascota, Instrumento),
// y `Camiseta` usa las formas femeninas porque "camiseta" lo es -- el
// generador anterior producía "viste camiseta rojo" y "El tortuga
// pertenece a...", ambos incorrectos.
export const BANCO_CATEGORIAS = [
  { nombre: 'Camiseta',    valores: ['Roja', 'Azul', 'Verde', 'Amarilla', 'Negra'],                     frase: (v) => `viste camiseta ${v.toLowerCase()}` },
  { nombre: 'Bebida',      valores: ['Café', 'Té', 'Agua', 'Zumo', 'Leche'],                            frase: (v) => `bebe ${v.toLowerCase()}` },
  { nombre: 'Mascota',     valores: ['Perro', 'Gato', 'Pez', 'Pájaro', 'Hámster'],                      frase: (v) => `tiene un ${v.toLowerCase()}` },
  { nombre: 'Profesión',   valores: ['Periodista', 'Dentista', 'Electricista', 'Taxista', 'Guionista'], frase: (v) => `es ${v.toLowerCase()}` },
  { nombre: 'País',        valores: ['Japón', 'Brasil', 'Egipto', 'Noruega', 'Canadá'],                 frase: (v) => `viajó a ${v}` },
  { nombre: 'Deporte',     valores: ['Natación', 'Ciclismo', 'Escalada', 'Judo', 'Remo'],               frase: (v) => `practica ${v.toLowerCase()}` },
  { nombre: 'Instrumento', valores: ['Piano', 'Violín', 'Saxofón', 'Acordeón', 'Clarinete'],            frase: (v) => `toca el ${v.toLowerCase()}` },
  { nombre: 'Flor',        valores: ['Rosas', 'Tulipanes', 'Orquídeas', 'Girasoles', 'Claveles'],       frase: (v) => `cultiva ${v.toLowerCase()}` },
  { nombre: 'Postre',      valores: ['Tarta', 'Helado', 'Flan', 'Natillas', 'Sorbete'],                 frase: (v) => `come de postre ${v.toLowerCase()}` },
  { nombre: 'Transporte',  valores: ['Bicicleta', 'Metro', 'Patinete', 'Tranvía', 'Autobús'],           frase: (v) => `se mueve en ${v.toLowerCase()}` },
  { nombre: 'Lectura',     valores: ['Poesía', 'Cómic', 'Ensayo', 'Biografía', 'Teatro'],               frase: (v) => `lee ${v.toLowerCase()}` },
  { nombre: 'Estación',    valores: ['Primavera', 'Verano', 'Otoño', 'Invierno'],                       frase: (v) => `prefiere ${v === 'Primavera' ? 'la' : 'el'} ${v.toLowerCase()}` }
];

export const BANCO_NOMBRES = [
  ['Ana', 'Carlos', 'Elena', 'David', 'Lucía'],
  ['María', 'Pedro', 'Sofía', 'Miguel', 'Rubén'],
  ['Laura', 'Andrés', 'Carmen', 'Javier', 'Nuria']
];

// ---------------------------------------------------------------------
// FORMA DEL TABLERO
// ---------------------------------------------------------------------
// Un tablero se describe como `filas x casas`, y las filas cuentan a
// Persona: el 4x4 de toda la vida son 3 categorías temáticas y 4 casas.
// El sorteo va sesgado al 4x4 -- sigue siendo el enigma corriente -- y
// el 5x5, que es el más largo de resolver, es el raro.
export const TAMANOS = [
  { filas: 4, casas: 4, peso: 4 },
  { filas: 5, casas: 4, peso: 2 },
  { filas: 4, casas: 5, peso: 2 },
  { filas: 5, casas: 5, peso: 1 }
];

// Dificultad: la vieja tabla del 4x4 (<=9 -> 4, 10-11 -> 3, 12+ -> 2)
// era, mirada de cerca, "base 3, y +-1 según el reto caiga por debajo o
// por encima de los cuartiles del nº de pistas". Se generaliza tal cual:
// cada tamaño trae su base y sus dos umbrales, medidos sobre 500 seeds
// (los del 4x4 salen clavados a los de siempre, así que sus retos no se
// reetiquetan). Menos pistas, más difícil; y un tablero más grande parte
// de una base más alta, porque la rejilla es mayor aunque las pistas
// abunden.
const DIFICULTAD = {
  '4x4': { base: 3, pocas: 9,  muchas: 11 },
  '5x4': { base: 4, pocas: 12, muchas: 14 },
  '4x5': { base: 4, pocas: 12, muchas: 15 },
  '5x5': { base: 5, pocas: 17, muchas: 20 }
};

export function dificultadDe(tamano, numPistas) {
  const t = DIFICULTAD[tamano] || DIFICULTAD['4x4'];
  const ajuste = numPistas <= t.pocas ? 1 : (numPistas > t.muchas ? -1 : 0);
  return Math.min(5, Math.max(1, t.base + ajuste));
}

function sortearForma(rand) {
  const total = TAMANOS.reduce((acc, t) => acc + t.peso, 0);
  let x = rand() * total;
  for (const t of TAMANOS) {
    x -= t.peso;
    if (x < 0) return { filas: t.filas, casas: t.casas };
  }
  return { filas: 4, casas: 4 };
}

// ---------------------------------------------------------------------
// PISTAS
// ---------------------------------------------------------------------
// Pool completo derivable de una solución: para cada par de categorías
// y cada par de valores, la pista que los relaciona -- positiva si
// comparten casa, negativa si no. Con F filas y N casas salen
// C(F,2)*N*N pistas: 96 en el 4x4, 250 en el 5x5.
//
// El pool completo determina la solución de forma trivial, así que la
// poda siempre arranca desde un estado con unicidad garantizada.
export function construirPoolPistas(solucion) {
  const filas = solucion.length;   // Persona + las categorías temáticas
  const casas = solucion[0].length;
  const pistas = [];
  for (let cA = 0; cA < filas; cA++) {
    for (let cB = cA + 1; cB < filas; cB++) {
      for (let vA = 0; vA < casas; vA++) {
        const grupoA = solucion[cA].indexOf(vA);
        for (let vB = 0; vB < casas; vB++) {
          const grupoB = solucion[cB].indexOf(vB);
          pistas.push({ cA, vA, cB, vB, positiva: grupoA === grupoB });
        }
      }
    }
  }
  return pistas;
}

// ---------------------------------------------------------------------
// FUERZA BRUTA
// ---------------------------------------------------------------------
// Enumera TODOS los candidatos -- (casas!)^(filas-1) -- y los filtra por
// las pistas. Es el motor original del 4x4, conservado como oráculo: no
// vale para el 5x5 (207 millones de candidatos), pero es obviamente
// correcto y los tests contrastan el solver contra él, igual que
// `piezasMinimasExhaustivo` en el láser triangular.
function todasLasPermutaciones(n) {
  const base = Array.from({ length: n }, (_, i) => i);
  const out = [];
  (function rec(actual, resto) {
    if (resto.length === 0) { out.push(actual); return; }
    for (let i = 0; i < resto.length; i++) {
      rec([...actual, resto[i]], [...resto.slice(0, i), ...resto.slice(i + 1)]);
    }
  })([], base);
  return out;
}

// Índice de valor de la categoría `c` en el grupo `i`.
// c === 0 es Persona (ancla: el grupo i contiene siempre la persona i).
function valorEnGrupo(cand, c, i) {
  return c === 0 ? i : cand[c - 1][i];
}

function satisface(cand, pista, casas) {
  let grupo = -1;
  for (let i = 0; i < casas; i++) {
    if (valorEnGrupo(cand, pista.cA, i) === pista.vA) { grupo = i; break; }
  }
  const coincide = valorEnGrupo(cand, pista.cB, grupo) === pista.vB;
  return pista.positiva ? coincide : !coincide;
}

export function contarSolucionesExhaustivo(pistas, { filas, casas }) {
  const perms = todasLasPermutaciones(casas);
  const tematicas = filas - 1;
  const total = Math.pow(perms.length, tematicas);
  const cand = new Array(tematicas);
  let n = 0;
  for (let idx = 0; idx < total; idx++) {
    let resto = idx;
    for (let c = 0; c < tematicas; c++) {
      cand[c] = perms[resto % perms.length];
      resto = Math.floor(resto / perms.length);
    }
    let ok = true;
    for (const p of pistas) {
      if (!satisface(cand, p, casas)) { ok = false; break; }
    }
    if (ok) n++;
  }
  return n;
}

// ---------------------------------------------------------------------
// GENERACIÓN
// ---------------------------------------------------------------------
// `forma` normalmente se sortea del seed; el muestrario y los tests la
// fijan para poder pedir un tamaño concreto.
export function generarEnigma(seed, forma = null) {
  // Derivaciones de seed independientes entre sí y distintas de las que
  // ya usan los otros generadores (balanza/trasvase/luces-fuera), para
  // que ninguna decisión quede correlacionada con otra.
  const randForma   = mulberry32((seed * 40692 + 3) >>> 0);
  const randNombres = mulberry32((seed * 22695477 + 1) >>> 0);
  const randCats    = mulberry32((seed * 1103515245 + 12345) >>> 0);
  const randSol     = mulberry32((seed * 214013 + 2531011) >>> 0);
  const randPoda    = mulberry32((seed * 69069 + 1) >>> 0);

  const { filas, casas } = forma || sortearForma(randForma);
  const casillas = Array.from({ length: casas }, (_, i) => i);

  const personas = BANCO_NOMBRES[Math.floor(randNombres() * BANCO_NOMBRES.length)].slice(0, casas);
  // Una categoría solo entra si tiene un valor por casa: `Estación` son
  // cuatro y punto, así que se queda fuera de los tableros de 5.
  const banco = BANCO_CATEGORIAS.filter((c) => c.valores.length >= casas);
  const catsElegidas = shuffle(banco, randCats).slice(0, filas - 1);

  // Solución: personas ancladas (grupo i -> persona i) y una permutación
  // INDEPENDIENTE por categoría temática.
  const solucion = [
    [...casillas],
    ...catsElegidas.map(() => shuffle(casillas, randSol))
  ];

  const nombresCats = ['Persona', ...catsElegidas.map((c) => c.nombre)];
  const valoresCats = [personas, ...catsElegidas.map((c) => c.valores.slice(0, casas))];

  const pool = construirPoolPistas(solucion);
  const formaReal = { filas: solucion.length, casas };
  const pistasDe = (indices) => [...indices].map((k) => pool[k]);

  // Ancla protegida: una asignación directa Persona<->Atributo positiva,
  // excluida de la poda. Garantiza que el puzzle siempre tenga un punto
  // de entrada legible, en vez de quedarse solo con pistas negativas.
  // Por eso el resultado es "irreducible salvo por el ancla", no mínimo.
  const candidatasAncla = pool
    .map((p, k) => ({ p, k }))
    .filter(({ p }) => p.positiva && p.cA === 0);
  const ancla = candidatasAncla[Math.floor(randPoda() * candidatasAncla.length)].k;

  // Poda: se recorren TODAS las pistas en orden aleatorio seedeado. Si
  // quitar una rompe la unicidad se devuelve y se sigue con la
  // siguiente (no se aborta al primer fallo: que una pista sea
  // imprescindible no dice nada de las que vienen detrás).
  const activas = new Set(pool.map((_, k) => k));
  const orden = shuffle(pool.map((_, k) => k), randPoda);

  for (const k of orden) {
    if (k === ancla) continue;
    activas.delete(k);
    if (contarSolucionesDesdePistas(pistasDe(activas), formaReal, 2) !== 1) activas.add(k);
  }

  const indicesFinales = [...activas];
  const numSoluciones = contarSolucionesDesdePistas(pistasDe(activas), formaReal);

  const clues = indicesFinales.map((k) => textoPista(pool[k], nombresCats, valoresCats, catsElegidas));

  // solution en el formato que espera plantillas/enigma_einstein.js:
  // { persona: { Categoria: valor, ... } }
  const solutionObj = {};
  personas.forEach((persona, i) => {
    const attrs = {};
    catsElegidas.forEach((cat, c) => {
      attrs[cat.nombre] = cat.valores[solucion[c + 1][i]];
    });
    solutionObj[persona] = attrs;
  });

  const categories = {};
  nombresCats.forEach((n, c) => { categories[n] = valoresCats[c]; });

  return {
    categories,
    clues,
    solution: solutionObj,
    // Metadatos para el generador/validador (no los usa la plantilla).
    meta: {
      tamano: `${formaReal.filas}x${formaReal.casas}`,
      forma: formaReal,
      categoriasElegidas: catsElegidas.map((c) => c.nombre),
      numPistas: clues.length,
      numSoluciones,
      pistasEstructuradas: indicesFinales.map((k) => pool[k]),
      solucionIndices: solucion
    }
  };
}

function textoPista(pista, nombresCats, valoresCats, catsElegidas) {
  const valorA = valoresCats[pista.cA][pista.vA];
  const valorB = valoresCats[pista.cB][pista.vB];
  const negacion = pista.positiva ? '' : 'no ';

  // Persona como sujeto: "María (no) bebe café."
  if (pista.cA === 0) {
    const fraseB = catsElegidas[pista.cB - 1].frase(valorB);
    return `${valorA} ${negacion}${fraseB}.`;
  }
  // Atributo como sujeto: "Quien bebe café (no) toca el piano."
  // (cB nunca es 0: el pool se construye con cA < cB, así que Persona
  // siempre aparece como sujeto, nunca como objeto.)
  const fraseA = catsElegidas[pista.cA - 1].frase(valorA);
  const fraseB = catsElegidas[pista.cB - 1].frase(valorB);
  return `Quien ${fraseA} ${negacion}${fraseB}.`;
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// SOLVER (recuento exacto de soluciones para cualquier forma)
// ---------------------------------------------------------------------
// La enumeración de candidatos de más arriba solo vale para el 4x4: a
// 5 casas y 4 categorías temáticas son 120^4 = 207 millones de
// candidatos, y una sola máscara ocuparía 26 MB. Aquí el puzzle se
// resuelve como la rejilla lógica que es: cada celda (categoría, casa)
// guarda un mapa de bits con los valores que aún puede tomar, se
// propaga hasta punto fijo y se ramifica por la celda con menos
// candidatos, contando soluciones hasta `tope`.
//
// La categoría 0 es Persona y va anclada: la casa i contiene siempre a
// la persona i, igual que en el resto del módulo.

function bits(x) {
  let n = 0;
  while (x) { x &= x - 1; n++; }
  return n;
}

// Recorta `dom` hasta punto fijo. Devuelve false si el estado es
// imposible (alguna celda sin valores, o algún valor sin casa).
function propagar(dom, pistas, filas, casas) {
  let cambio = true;
  while (cambio) {
    cambio = false;

    // Unicidad dentro de cada categoría: un valor colocado no puede
    // repetirse en otra casa, y un valor que solo cabe en una casa va ahí.
    for (let c = 0; c < filas; c++) {
      const base = c * casas;
      for (let h = 0; h < casas; h++) {
        const d = dom[base + h];
        if (d === 0) return false;
        if (bits(d) !== 1) continue;
        for (let otra = 0; otra < casas; otra++) {
          if (otra === h) continue;
          const previo = dom[base + otra];
          const nuevo = previo & ~d;
          if (nuevo !== previo) { dom[base + otra] = nuevo; cambio = true; }
        }
      }
      for (let v = 0; v < casas; v++) {
        const bit = 1 << v;
        let cuantas = 0, unica = -1;
        for (let h = 0; h < casas; h++) {
          if (dom[base + h] & bit) { cuantas++; unica = h; }
        }
        if (cuantas === 0) return false;
        if (cuantas === 1 && dom[base + unica] !== bit) {
          dom[base + unica] = bit;
          cambio = true;
        }
      }
    }

    // Pistas. La positiva es fuerte en las dos direcciones (los dos
    // valores viven en la MISMA casa, así que donde no quepa uno no cabe
    // el otro); la negativa solo descarta cuando el otro valor ya está
    // colocado.
    for (const p of pistas) {
      const bitA = 1 << p.vA;
      const bitB = 1 << p.vB;
      const baseA = p.cA * casas;
      const baseB = p.cB * casas;
      for (let h = 0; h < casas; h++) {
        const puedeA = (dom[baseA + h] & bitA) !== 0;
        const puedeB = (dom[baseB + h] & bitB) !== 0;
        if (p.positiva) {
          if (!puedeA && puedeB) { dom[baseB + h] &= ~bitB; cambio = true; }
          if (!puedeB && puedeA) { dom[baseA + h] &= ~bitA; cambio = true; }
        } else {
          if (dom[baseA + h] === bitA && puedeB) { dom[baseB + h] &= ~bitB; cambio = true; }
          if (dom[baseB + h] === bitB && puedeA) { dom[baseA + h] &= ~bitA; cambio = true; }
        }
      }
    }
  }
  return true;
}

// Cuenta soluciones a partir de un estado ya propagado. Corta en cuanto
// llega a `tope`: para decidir unicidad basta con encontrar dos.
function ramificar(dom, pistas, filas, casas, tope) {
  let mejor = -1, mejorBits = Infinity;
  for (let i = 0; i < dom.length; i++) {
    const n = bits(dom[i]);
    if (n > 1 && n < mejorBits) { mejor = i; mejorBits = n; }
  }
  // Todo colocado: propagar ya ha comprobado unicidad y pistas, así que
  // este estado ES una solución.
  if (mejor === -1) return 1;

  let total = 0;
  const opciones = dom[mejor];
  for (let v = 0; v < casas; v++) {
    const bit = 1 << v;
    if ((opciones & bit) === 0) continue;
    const copia = Int32Array.from(dom);
    copia[mejor] = bit;
    if (!propagar(copia, pistas, filas, casas)) continue;
    total += ramificar(copia, pistas, filas, casas, tope - total);
    if (total >= tope) return total;
  }
  return total;
}

// ---------------------------------------------------------------------
// VERIFICACIÓN (la usa el validador; no confía en que el generador
// lo hiciera bien, recalcula la unicidad desde las pistas estructuradas)
// ---------------------------------------------------------------------
export function contarSolucionesDesdePistas(pistas, forma, tope = Infinity) {
  const { filas, casas } = forma;
  const dom = new Int32Array(filas * casas).fill((1 << casas) - 1);
  for (let h = 0; h < casas; h++) dom[h] = 1 << h;   // Persona anclada
  if (!propagar(dom, pistas, filas, casas)) return 0;
  return ramificar(dom, pistas, filas, casas, tope);
}
