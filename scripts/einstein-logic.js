// ===== scripts/einstein-logic.js =====
// Banco temático, generación y solver del enigma de Einstein (4x4),
// compartidos entre el generador y el validador.
//
// Estructura del puzzle: 4 grupos ("casas"), cada uno con una Persona
// (que actúa de ancla) y un valor de cada una de las 3 categorías
// temáticas elegidas ese día. La plantilla valida comparando conjuntos
// por columna e IGNORA el orden de las columnas, así que "solución
// única" significa un único AGRUPAMIENTO: se ancla `personas` y se
// permutan de forma independiente las 3 categorías restantes ->
// 24^3 = 13.824 candidatos.
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
  { nombre: 'Camiseta',    valores: ['Roja', 'Azul', 'Verde', 'Amarilla'],                 frase: (v) => `viste camiseta ${v.toLowerCase()}` },
  { nombre: 'Bebida',      valores: ['Café', 'Té', 'Agua', 'Zumo'],                        frase: (v) => `bebe ${v.toLowerCase()}` },
  { nombre: 'Mascota',     valores: ['Perro', 'Gato', 'Pez', 'Pájaro'],                    frase: (v) => `tiene un ${v.toLowerCase()}` },
  { nombre: 'Profesión',   valores: ['Periodista', 'Dentista', 'Electricista', 'Taxista'], frase: (v) => `es ${v.toLowerCase()}` },
  { nombre: 'País',        valores: ['Japón', 'Brasil', 'Egipto', 'Noruega'],              frase: (v) => `viajó a ${v}` },
  { nombre: 'Deporte',     valores: ['Natación', 'Ciclismo', 'Escalada', 'Judo'],          frase: (v) => `practica ${v.toLowerCase()}` },
  { nombre: 'Instrumento', valores: ['Piano', 'Violín', 'Saxofón', 'Acordeón'],            frase: (v) => `toca el ${v.toLowerCase()}` },
  { nombre: 'Flor',        valores: ['Rosas', 'Tulipanes', 'Orquídeas', 'Girasoles'],      frase: (v) => `cultiva ${v.toLowerCase()}` },
  { nombre: 'Postre',      valores: ['Tarta', 'Helado', 'Flan', 'Natillas'],               frase: (v) => `come de postre ${v.toLowerCase()}` },
  { nombre: 'Transporte',  valores: ['Bicicleta', 'Metro', 'Patinete', 'Tranvía'],         frase: (v) => `se mueve en ${v.toLowerCase()}` },
  { nombre: 'Lectura',     valores: ['Poesía', 'Cómic', 'Ensayo', 'Biografía'],            frase: (v) => `lee ${v.toLowerCase()}` },
  { nombre: 'Estación',    valores: ['Primavera', 'Verano', 'Otoño', 'Invierno'],          frase: (v) => `prefiere ${v === 'Primavera' ? 'la' : 'el'} ${v.toLowerCase()}` }
];

export const BANCO_NOMBRES = [
  ['Ana', 'Carlos', 'Elena', 'David'],
  ['María', 'Pedro', 'Sofía', 'Miguel'],
  ['Laura', 'Andrés', 'Carmen', 'Javier']
];

const CATEGORIAS_POR_PUZZLE = 3; // + Persona = 4 filas, sin tocar la plantilla

// ---------------------------------------------------------------------
// ESPACIO DE CANDIDATOS
// ---------------------------------------------------------------------
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

const PERMS = todasLasPermutaciones(4);      // 24
const NUM_CANDIDATOS = 24 * 24 * 24;         // 13.824
const PALABRAS = Math.ceil(NUM_CANDIDATOS / 32);

// Candidato -> las 3 permutaciones (una por categoría temática).
function candidato(idx) {
  return [
    PERMS[Math.floor(idx / 576)],
    PERMS[Math.floor(idx / 24) % 24],
    PERMS[idx % 24]
  ];
}

// Índice de valor de la categoría `c` en el grupo `i`.
// c === 0 es Persona (ancla: el grupo i contiene siempre la persona i).
function valorEnGrupo(cand, c, i) {
  return c === 0 ? i : cand[c - 1][i];
}

// ---------------------------------------------------------------------
// PISTAS
// ---------------------------------------------------------------------
// Pool completo derivable de una solución: para cada par de categorías
// y cada grupo, la pista positiva que las relaciona; y para cada par de
// valores que NO comparten grupo, la negativa. Con 4 categorías:
// C(4,2)=6 pares -> 6*4 = 24 positivas + 6*12 = 72 negativas = 96.
//
// El pool completo determina la solución de forma trivial, así que la
// poda siempre arranca desde un estado con unicidad garantizada.
function construirPoolPistas(solucion) {
  const pistas = [];
  const nCats = solucion.length; // 4 (Persona + 3)
  for (let cA = 0; cA < nCats; cA++) {
    for (let cB = cA + 1; cB < nCats; cB++) {
      for (let vA = 0; vA < 4; vA++) {
        const grupoA = solucion[cA].indexOf(vA);
        for (let vB = 0; vB < 4; vB++) {
          const grupoB = solucion[cB].indexOf(vB);
          pistas.push({ cA, vA, cB, vB, positiva: grupoA === grupoB });
        }
      }
    }
  }
  return pistas;
}

function satisface(cand, pista) {
  let grupo = -1;
  for (let i = 0; i < 4; i++) {
    if (valorEnGrupo(cand, pista.cA, i) === pista.vA) { grupo = i; break; }
  }
  const coincide = valorEnGrupo(cand, pista.cB, grupo) === pista.vB;
  return pista.positiva ? coincide : !coincide;
}

// Máscara de bits: qué candidatos satisface cada pista. Se calcula UNA
// vez (96 x 13.824 comprobaciones) y a partir de ahí cada verificación
// de unicidad es intersectar máscaras, no reevaluar predicados.
function construirMascaras(pistas) {
  return pistas.map((pista) => {
    const mask = new Uint32Array(PALABRAS);
    for (let idx = 0; idx < NUM_CANDIDATOS; idx++) {
      if (satisface(candidato(idx), pista)) {
        mask[idx >>> 5] |= (1 << (idx & 31));
      }
    }
    return mask;
  });
}

// Nº de candidatos que sobreviven a la intersección de las pistas
// activas. Corta en cuanto pasa de 1: para decidir unicidad no hace
// falta contarlos todos.
function contarSoluciones(mascaras, activas, tope = 2) {
  const acc = new Uint32Array(PALABRAS).fill(0xFFFFFFFF);
  for (const k of activas) {
    const m = mascaras[k];
    for (let w = 0; w < PALABRAS; w++) acc[w] &= m[w];
  }
  // El último word puede tener bits de relleno por encima de NUM_CANDIDATOS.
  const sobra = PALABRAS * 32 - NUM_CANDIDATOS;
  if (sobra > 0) acc[PALABRAS - 1] &= (0xFFFFFFFF >>> sobra);

  let n = 0;
  for (let w = 0; w < PALABRAS; w++) {
    let x = acc[w];
    while (x) { x &= x - 1; n++; if (n >= tope) return n; }
  }
  return n;
}

// ---------------------------------------------------------------------
// GENERACIÓN
// ---------------------------------------------------------------------
export function generarEnigma(seed) {
  // Derivaciones de seed independientes entre sí y distintas de las que
  // ya usan los otros generadores (balanza/trasvase/luces-fuera), para
  // que ninguna decisión quede correlacionada con otra.
  const randNombres = mulberry32((seed * 22695477 + 1) >>> 0);
  const randCats    = mulberry32((seed * 1103515245 + 12345) >>> 0);
  const randSol     = mulberry32((seed * 214013 + 2531011) >>> 0);
  const randPoda    = mulberry32((seed * 69069 + 1) >>> 0);

  const personas = BANCO_NOMBRES[Math.floor(randNombres() * BANCO_NOMBRES.length)];
  const catsElegidas = shuffle(BANCO_CATEGORIAS, randCats).slice(0, CATEGORIAS_POR_PUZZLE);

  // Solución: personas ancladas (grupo i -> persona i) y una permutación
  // INDEPENDIENTE por categoría temática.
  const solucion = [
    [0, 1, 2, 3],
    ...catsElegidas.map(() => shuffle([0, 1, 2, 3], randSol))
  ];

  const nombresCats = ['Persona', ...catsElegidas.map((c) => c.nombre)];
  const valoresCats = [personas, ...catsElegidas.map((c) => c.valores)];

  const pool = construirPoolPistas(solucion);
  const mascaras = construirMascaras(pool);

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
    if (contarSoluciones(mascaras, activas) !== 1) activas.add(k);
  }

  const indicesFinales = [...activas];
  const numSoluciones = contarSoluciones(mascaras, activas, Infinity);

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
// VERIFICACIÓN (la usa el validador; no confía en que el generador
// lo hiciera bien, recalcula la unicidad desde las pistas estructuradas)
// ---------------------------------------------------------------------
export function contarSolucionesDesdePistas(pistas) {
  const mascaras = construirMascaras(pistas);
  return contarSoluciones(mascaras, pistas.map((_, k) => k), Infinity);
}
