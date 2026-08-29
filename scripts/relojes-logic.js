// ===== scripts/relojes-logic.js =====
// Solver de "relojes de arena" (relojes-arena), compartido entre el
// generador y el validador.
//
// Modelo fiel a plantillas/relojes_arena.js: el estado de un reloj es
// cuántos minutos de arena le quedan en el bulbo superior (`top`); el
// inferior es siempre `duracion - top`. Voltear intercambia ambos, así
// que voltear un reloj gastado (top=0) lo deja lleno (top=duracion) y
// voltear uno a medias con top=3 de un reloj de 7 lo deja con top=4.
//
// Una RONDA es: voltear un subconjunto cualquiera de relojes (posiblemente
// ninguno) y pulsar Iniciar. La arena cae hasta que el PRIMER reloj se
// vacía y en ese instante se paran todos a la vez -- o sea, el tramo dura
// `min{top_i > 0}` y todos los tops positivos bajan esa cantidad. Para que
// la ronda sea válida tiene que quedar al menos un reloj con top>0 tras
// voltear (la plantilla exige "voltea al menos un reloj antes de iniciar").
//
// Como las duraciones son enteros de minutos y cada tramo es el mínimo de
// un conjunto de enteros, todos los estados alcanzables son enteros: el
// espacio de estados es finito y pequeño (∏(d_i+1) x tiempos posibles).
//
// El cronómetro es independiente: "Empezar tiempo" lo pone a cero en la
// frontera de ronda que el jugador quiera. De ahí los dos modos:
//   - 'clasico':  el cronómetro corre desde la primera ronda.
//   - 'diferido': puede arrancarse en cualquier frontera de ronda.
// Todo lo medible en 'clasico' lo es también en 'diferido'.

const MODOS = ['clasico', 'diferido'];

// Enumera qué tiempos se pueden medir con estos relojes. Devuelve un Map
// tiempo (minutos, >0) -> nº de rondas CRONOMETRADAS de la solución que
// menos rondas totales gasta. En 'clasico' ambos números coinciden porque
// todas las rondas están cronometradas.
export function enumerateMeasurable(durations, opts = {}) {
  return explore(durations, opts).medibles;
}

// Busca la mejor solución para medir `target`. Devuelve null si no existe
// dentro de los límites, o:
//   { rondas, rondasTotales, tramos, pasos, cronoEnRonda }
// donde `tramos` son solo los tramos cronometrados (suman `target`),
// `pasos` describe TODAS las rondas y `cronoEnRonda` es el índice de la
// ronda al principio de la cual se pulsa "Empezar tiempo" (0 en 'clasico').
export function solveRelojes(durations, target, modo = 'clasico', opts = {}) {
  if (!Number.isInteger(target) || target <= 0) return null;
  // El tiempo cronometrado solo crece, así que cualquier camino que se
  // pase del objetivo ya no sirve: podar por `target` es exacto.
  const { destino } = explore(durations, { ...opts, modo, maxTotal: target, objetivo: target });
  return destino ? reconstruir(destino, durations) : null;
}

// BFS por número de rondas TOTALES. Arrancar el cronómetro es una
// transición gratuita (no consume ronda), así que se expande dentro del
// mismo nivel; como solo puede ocurrir una vez por camino, basta con ir
// añadiendo el gemelo "con crono" a la lista del nivel en curso.
function explore(durations, opts = {}) {
  validarDurations(durations);
  const modo = opts.modo || 'clasico';
  if (!MODOS.includes(modo)) {
    throw new Error(`relojes-logic: modo desconocido "${modo}" (esperado: ${MODOS.join(' | ')})`);
  }
  const maxRondas = opts.maxRondas != null ? opts.maxRondas : 12;
  const maxTotal = opts.maxTotal != null ? opts.maxTotal : sum(durations) * 2;
  const objetivo = opts.objetivo != null ? opts.objetivo : null;

  const n = durations.length;
  const subsets = 1 << n;
  const medibles = new Map();
  const visto = new Set();

  const inicial = {
    tops: new Array(n).fill(0),
    crono: modo === 'clasico',
    elapsed: 0,
    rondasTotales: 0,
    rondasCrono: 0,
    padre: null,
    voltear: null,
    tramo: 0
  };
  visto.add(clave(inicial));

  let nivel = [inicial];
  for (let ronda = 0; ronda < maxRondas && nivel.length; ronda++) {
    const siguiente = [];
    // La lista crece mientras se recorre: los gemelos "con crono" son
    // transiciones gratuitas y entran en este mismo nivel.
    for (let i = 0; i < nivel.length; i++) {
      const s = nivel[i];

      if (!s.crono) {
        const arrancado = {
          ...s,
          crono: true,
          elapsed: 0,
          padre: s,
          voltear: null,
          tramo: 0,
          esArranque: true
        };
        const k = clave(arrancado);
        if (!visto.has(k)) {
          visto.add(k);
          nivel.push(arrancado);
        }
      }

      for (let mask = 0; mask < subsets; mask++) {
        const tops = s.tops.slice();
        const voltear = [];
        for (let g = 0; g < n; g++) {
          if (mask & (1 << g)) {
            tops[g] = durations[g] - tops[g];
            voltear.push(g);
          }
        }

        const tramo = minPositivo(tops);
        if (tramo == null) continue; // ningún reloj corriendo: ronda inválida

        for (let g = 0; g < n; g++) {
          if (tops[g] > 0) tops[g] -= tramo;
        }

        const elapsed = s.crono ? s.elapsed + tramo : 0;
        if (elapsed > maxTotal) continue;

        const hijo = {
          tops,
          crono: s.crono,
          elapsed,
          rondasTotales: s.rondasTotales + 1,
          rondasCrono: s.crono ? s.rondasCrono + 1 : 0,
          padre: s,
          voltear,
          tramo
        };

        const k = clave(hijo);
        if (visto.has(k)) continue;
        visto.add(k);

        if (hijo.crono && elapsed > 0 && !medibles.has(elapsed)) {
          medibles.set(elapsed, hijo.rondasCrono);
        }
        if (objetivo != null && hijo.crono && elapsed === objetivo) {
          return { medibles, destino: hijo };
        }

        siguiente.push(hijo);
      }
    }
    nivel = siguiente;
  }

  return { medibles, destino: null };
}

function reconstruir(destino, durations) {
  const pasos = [];
  const tramos = [];
  let cronoEnRonda = 0;

  for (let s = destino; s && s.padre; s = s.padre) {
    // El nodo "arrancar crono" es una transición gratuita, no una ronda:
    // no aparece en `pasos` (su posición queda reflejada en cronoEnRonda).
    if (s.esArranque) continue;
    pasos.unshift({ voltear: s.voltear, tramo: s.tramo, medido: s.crono });
    if (s.crono) tramos.unshift(s.tramo);
  }

  let rondasAntesDelCrono = 0;
  for (const paso of pasos) {
    if (paso.medido) break;
    rondasAntesDelCrono++;
  }
  cronoEnRonda = rondasAntesDelCrono;

  return {
    rondas: tramos.length,
    rondasTotales: pasos.length,
    tramos,
    pasos,
    cronoEnRonda,
    glasses: durations.slice()
  };
}

function clave(s) {
  return `${s.tops.join(',')}|${s.crono ? 1 : 0}|${s.elapsed}`;
}

function minPositivo(tops) {
  let min = null;
  for (const t of tops) {
    if (t > 0 && (min == null || t < min)) min = t;
  }
  return min;
}

function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

export function validarDurations(durations) {
  if (!Array.isArray(durations) || durations.length < 1) {
    throw new Error('relojes-logic: durations debe ser un array no vacío');
  }
  for (const d of durations) {
    if (!Number.isInteger(d) || d <= 0) {
      throw new Error(`relojes-logic: duración inválida "${d}" (enteros de minutos > 0)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Construcción del puzzle diario (usada por el generador; vive aquí para que
// sea pura y testeable sin tocar disco).
// ---------------------------------------------------------------------------

// Configuraciones por dificultad. `maxDur` acota la duración de cada reloj y,
// junto con MAX_TARGET, el tiempo real de una partida: la plantilla simula
// 1 minuto de arena cada 3 segundos reales, así que un objetivo de 20 min son
// 60 s de espera como mucho.
const CONFIGS = [
  { relojes: 2, maxDur: 9, dificultad: 2 },
  { relojes: 2, maxDur: 15, dificultad: 3 },
  { relojes: 3, maxDur: 12, dificultad: 4 }
];
const MAX_TARGET = 20;
const MIN_RONDAS = 3;   // 2 seguia siendo "voltea uno y espera" en la practica
const MAX_RONDAS = 4;   // más que esto es tedioso, no más difícil
const INTENTOS = 40;    // remuestreos de duraciones antes de rendirse

// Deriva de forma determinista un puzzle jugable a partir del seed de la
// fecha. Devuelve { glasses, target, variant, dificultad, solucion }.
export function buildRelojesPuzzle(seed) {
  const config = CONFIGS[seed % CONFIGS.length];

  // Seeds derivados con multiplicadores propios (distintos de los que ya usan
  // balanza/trasvase/luces) para que variante y duraciones no queden
  // correlacionadas entre sí ni con la elección de config de arriba.
  const variant = mulberry32((seed * 22695477 + 1) >>> 0)() < 0.5 ? 'clasico' : 'diferido';
  const rand = mulberry32((seed * 3266489917 + 374761393) >>> 0);

  for (let intento = 0; intento < INTENTOS; intento++) {
    const glasses = elegirDuraciones(config, rand);
    const candidatos = candidatosDeTarget(glasses, variant);
    if (!candidatos.length) continue;

    const target = candidatos[Math.floor(rand() * candidatos.length)];
    const solucion = solveRelojes(glasses, target, variant);
    if (!solucion) continue; // no debería pasar: candidatosDeTarget ya resolvió

    return { glasses, target, variant, dificultad: config.dificultad, solucion };
  }

  throw new Error(
    `buildRelojesPuzzle: no se encontró puzzle jugable para seed=${seed} ` +
    `(variant=${variant}, relojes=${config.relojes}, maxDur=${config.maxDur}) ` +
    `tras ${INTENTOS} intentos -- revisar CONFIGS/filtros`
  );
}

// Duraciones distintas entre sí, todas >= 2 min (un reloj de 1 min no aporta
// nada interesante) y ordenadas para que la plantilla las dibuje de menor a
// mayor.
function elegirDuraciones({ relojes, maxDur }, rand) {
  const pool = [];
  for (let d = 2; d <= maxDur; d++) pool.push(d);
  const elegidas = [];
  for (let i = 0; i < relojes; i++) {
    elegidas.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return elegidas.sort((a, b) => a - b);
}

// Objetivos que dan un reto de verdad con estas duraciones: nada de medir la
// duración de un reloj suelto, entre MIN_RONDAS y MAX_RONDAS rondas, y -- en
// la variante 'diferido' -- imposibles de medir con el cronómetro corriendo
// desde el principio, que es justo lo que esa variante quiere enseñar.
function candidatosDeTarget(glasses, variant) {
  const medibles = enumerateMeasurable(glasses, {
    modo: variant,
    maxRondas: MAX_RONDAS,
    maxTotal: MAX_TARGET
  });

  const out = [];
  for (const target of [...medibles.keys()].sort((a, b) => a - b)) {
    if (glasses.includes(target)) continue;
    const sol = solveRelojes(glasses, target, variant, { maxRondas: MAX_RONDAS });
    if (!sol) continue;
    if (sol.rondasTotales < MIN_RONDAS || sol.rondasTotales > MAX_RONDAS) continue;
    // La exclusión de 'diferido' se comprueba SIN el tope de MAX_RONDAS: la
    // promesa de esa variante es que el objetivo es inalcanzable desde t=0,
    // no que lo sea en pocas rondas.
    if (variant === 'diferido' && solveRelojes(glasses, target, 'clasico', { maxRondas: 20 })) continue;
    out.push(target);
  }
  return out;
}

// PRNG determinista (mulberry32), sin dependencias externas. Duplicado a
// propósito (no importado de generate-daily-reto.js) para que este módulo sea
// autocontenido, igual que en lightsout-logic.js.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pistas específicas de las duraciones, la variante y el mínimo real -- no un
// texto genérico. Vive aquí (y no en el generador, como en las otras
// plantillas) porque la concordancia y los números concretos son fáciles de
// romper y merecen test propio.
export function buildRelojesHints(cfg, solucion) {
  const mayor = Math.max(...cfg.glasses);
  // Arriba se queda algo de arena, pero nunca todo ni nada: así el reloj
  // volteado que se describe siempre dura entre 1 min y mayor-1.
  const arriba = Math.max(1, Math.floor(mayor / 3));

  // Redactadas sin concordar número con verbo ni artículo: el objetivo puede
  // ser 1 min y "los 1 min no salen" chirría.
  const cronometro = cfg.variant === 'diferido'
    ? `El objetivo (${cfg.target} min) no sale contando desde el primer volteo: deja correr la arena y pulsa "Empezar tiempo" más tarde, cuando al reloj que te interesa le quede justo lo que quieres medir.`
    : `Pulsa "Empezar tiempo" antes de la primera vuelta: el objetivo (${cfg.target} min) se cuenta desde ahí.`;

  const totales = solucion.rondasTotales;
  const medidas = solucion.rondas;
  const vueltas = `${totales} ${totales === 1 ? 'vuelta' : 'vueltas'} de arena`;
  // El cronómetro, una vez arrancado, ya no se para: las rondas cronometradas
  // son siempre las últimas. Con un solo tramo la "suma" sería "1 = 1 min".
  const suma = medidas === 1
    ? `${cfg.target} min`
    : `${solucion.tramos.join(' + ')} = ${cfg.target} min`;
  const cronometradas = totales === medidas
    ? `: ${suma}`
    : medidas === 1
      ? `, de las que solo cronometras la última: ${suma}`
      : `, de las que cronometras las ${medidas} últimas: ${suma}`;

  return [
    `Tienes relojes de ${listaEs(cfg.glasses.map((g) => `${g} min`))}. La clave es que un reloj parado a medias sirve como otro reloj distinto: si el de ${mayor} min se para con ${arriba} min de arena arriba y lo volteas, mide ${mayor - arriba} min.`,
    cronometro,
    `La solución mínima ${totales === 1 ? 'es' : 'son'} ${vueltas}${cronometradas}.`
  ];
}

// "a, b y c" -- en español solo lleva "y" antes del último elemento.
function listaEs(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
