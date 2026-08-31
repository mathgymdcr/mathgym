// ===== scripts/riego-logic.js =====
// Riego de plantas por ciclos, compartido entre el generador y el validador.
//
// Reglas (las mismas que aplica plantillas/riego_plantas.js):
//   - cada planta necesita EXACTAMENTE sus dosis;
//   - solo se puede regar en los ciclos de su ventana;
//   - nunca dos ciclos seguidos: la tierra tiene que secarse;
//   - cada ciclo admite como mucho `capacity` riegos en total.
//
// Sin ventanas ni descanso, el reto no tenía nada que deducir: repartir las
// dosis en los ciclos con más hueco funcionaba siempre que hubiera solución
// (comprobado sobre 3000 instancias aleatorias contra búsqueda exhaustiva).
// Son esas dos reglas las que lo convierten en un puzzle.

// Todos los repartos de riego válidos para UNA planta, en orden estable.
export function combinacionesPlanta(planta) {
  const ventana = [...planta.ventana].sort((a, b) => a - b);
  const res = [];

  const rec = (desde, elegidos) => {
    if (elegidos.length === planta.doses) {
      res.push([...elegidos]);
      return;
    }
    for (let i = desde; i < ventana.length; i++) {
      const ciclo = ventana[i];
      // Descanso obligatorio: nada de dos ciclos consecutivos.
      if (elegidos.length && ciclo - elegidos[elegidos.length - 1] < 2) continue;
      elegidos.push(ciclo);
      rec(i + 1, elegidos);
      elegidos.pop();
    }
  };

  rec(0, []);
  return res;
}

// Cuenta calendarios completos válidos hasta `tope` y devuelve el primero.
// Con tope 2 basta para distinguir "imposible" / "único" / "hay varios".
//
// `config.incompatibles`, si viene, es el par de `id` de dos plantas que no
// pueden regarse en el mismo ciclo -- además de la ventana, el descanso y la
// capacidad. Es opcional: sin él, el comportamiento es el de siempre.
export function contarSoluciones(config, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;
  const plants = config.plants || [];
  const opciones = plants.map(combinacionesPlanta);
  if (opciones.some((o) => o.length === 0)) return { soluciones: 0, primera: null };

  const parIncompatible = config.incompatibles
    ? config.incompatibles.map((id) => plants.findIndex((p) => p.id === id))
    : null;

  const usoCiclo = Array(config.cycles).fill(0);
  let soluciones = 0;
  let primera = null;
  const elegidas = [];

  const rec = (i) => {
    if (soluciones >= tope) return;
    if (i === plants.length) {
      soluciones++;
      if (!primera) primera = elegidas.map((c) => [...c]);
      return;
    }
    for (const combo of opciones[i]) {
      if (combo.some((c) => usoCiclo[c] >= config.capacity)) continue;
      if (parIncompatible && parIncompatible.includes(i)) {
        const otro = parIncompatible[0] === i ? parIncompatible[1] : parIncompatible[0];
        if (otro < i && combo.some((c) => elegidas[otro].includes(c))) continue;
      }
      combo.forEach((c) => usoCiclo[c]++);
      elegidas.push(combo);
      rec(i + 1);
      elegidas.pop();
      combo.forEach((c) => usoCiclo[c]--);
      if (soluciones >= tope) return;
    }
  };

  rec(0);
  return { soluciones, primera };
}

// --- Generador ------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nombres de plantas de verdad: el reto se lee mucho mejor con "Albahaca"
// que con "Planta A".
const BANCO_PLANTAS = [
  'Albahaca', 'Tomatera', 'Cactus', 'Orquídea', 'Helecho', 'Romero',
  'Lavanda', 'Menta', 'Aloe', 'Petunia', 'Jazmín', 'Perejil'
];

const VARIANTES = [
  { nombre: 'huerto', cycles: 6, capacity: 2, plantas: 3, dificultad: 2 },
  { nombre: 'invernadero', cycles: 7, capacity: 2, plantas: 4, dificultad: 3 },
  { nombre: 'vivero', cycles: 8, capacity: 3, plantas: 5, dificultad: 4 }
];

// Medido sobre 1008 fechas: la media son 30 intentos, pero la cola es larga
// (algún seed ha llegado a 379) y con el tope en 400 fallaban 2 fechas de
// 1008. El coste de un tope alto solo se paga en esos casos raros.
const MAX_INTENTOS = 3000;

function barajar(rand, arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Calendario de partida: se sortea un reparto que ya cumple descanso y
// capacidad. De ahí salen las ventanas, así que la solución existe por
// construcción y solo queda podar hasta que sea la única.
function calendarioAleatorio(rand, cfg) {
  const usoCiclo = Array(cfg.cycles).fill(0);
  const calendario = [];

  for (let i = 0; i < cfg.plantas; i++) {
    const dosis = 2 + Math.floor(rand() * 2); // 2 o 3 riegos
    const elegidos = [];
    for (const ciclo of barajar(rand, [...Array(cfg.cycles).keys()])) {
      if (elegidos.length === dosis) break;
      if (usoCiclo[ciclo] >= cfg.capacity) continue;
      if (elegidos.some((c) => Math.abs(c - ciclo) < 2)) continue;
      elegidos.push(ciclo);
      usoCiclo[ciclo]++;
    }
    if (elegidos.length < dosis) return null;
    calendario.push(elegidos.sort((a, b) => a - b));
  }

  return calendario;
}

// El eje se sortea con el PRNG, NO con aritmética sobre el seed.
//
// `selectTemplate` es `templates[seed % 12]`, así que este tipo solo recibe
// una clase módulo 12. Dentro de ella, `seed % n` es constante para todo n
// divisor de 12 -- y también lo es `Math.floor(seed / k) % 2`, porque los
// seeds se diferencian en múltiplos de 12. Así el tipo publicaba SIEMPRE la
// misma variante, con las otras escritas y ninguna alcanzable.
function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

export function configDeSeed(seed) {
  return eligeEje(VARIANTES, seed, 0x5a92e6d1);
}

// Eje independiente del tamaño (mismo patrón: PRNG con su propia máscara, no
// aritmética sobre el seed). Cuando toca, dos plantas concretas no pueden
// regarse en el mismo ciclo -- además de ventana, descanso y capacidad.
function incompatibilidadDeSeed(seed) {
  return eligeEje([true, false], seed, 0x2f7c8b31);
}

export function varianteDeSeed(seed) {
  const nombre = configDeSeed(seed).nombre;
  return incompatibilidadDeSeed(seed) ? `${nombre}-incompatible` : nombre;
}

export function buildRiegoPuzzle(seed) {
  const cfg = configDeSeed(seed);
  const incompatibilidad = incompatibilidadDeSeed(seed);

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 86243) >>> 0);

    const calendario = calendarioAleatorio(rand, cfg);
    if (!calendario) continue;

    const nombres = barajar(rand, BANCO_PLANTAS).slice(0, cfg.plantas);
    const plants = calendario.map((ciclos, i) => {
      // La ventana empieza generosa: los riegos de verdad más ruido.
      const extra = barajar(rand, [...Array(cfg.cycles).keys()]).filter((c) => !ciclos.includes(c));
      const cuantos = 2 + Math.floor(rand() * 3);
      return {
        id: nombres[i],
        doses: ciclos.length,
        ventana: [...ciclos, ...extra.slice(0, cuantos)].sort((a, b) => a - b)
      };
    });

    const config = { cycles: cfg.cycles, capacity: cfg.capacity, plants };

    // Si toca incompatibilidad, hace falta una pareja cuyos riegos REALES ya
    // sean disjuntos -- si no, el calendario de partida ya la incumpliría.
    // Sin ninguna pareja así en este calendario, se descarta el intento
    // entero (el bucle ya reintenta con otro calendario, es el mismo camino
    // que cualquier otra causa de descarte de aquí abajo).
    if (incompatibilidad) {
      const candidatas = [];
      for (let i = 0; i < calendario.length; i++) {
        for (let j = i + 1; j < calendario.length; j++) {
          if (!calendario[i].some((c) => calendario[j].includes(c))) candidatas.push([i, j]);
        }
      }
      if (!candidatas.length) continue;
      const [i, j] = barajar(rand, candidatas)[0];
      config.incompatibles = [nombres[i], nombres[j]];
    }

    // Se recorta el ruido de las ventanas hasta que solo quede un calendario
    // posible: mientras haya varios, el jugador acierta por casualidad. Cada
    // recorte se elige mirando cuál mata más alternativas, no al azar: así
    // hacen falta menos recortes y las ventanas quedan más anchas, que es lo
    // que deja margen de decisión. Con recortes al azar la holgura acababa
    // en 1 de mediana y se descartaba el 87% de los intentos.
    let vueltas = 0;
    while (contarSoluciones(config, { tope: 2 }).soluciones > 1 && vueltas < 60) {
      vueltas++;
      const candidatas = [];
      plants.forEach((p, i) => {
        p.ventana.forEach((c) => {
          if (!calendario[i].includes(c)) candidatas.push({ i, c });
        });
      });
      if (!candidatas.length) break;

      let mejor = null;
      for (const cand of candidatas) {
        const original = plants[cand.i].ventana;
        plants[cand.i].ventana = original.filter((x) => x !== cand.c);
        const cuentan = contarSoluciones(config, { tope: 6 }).soluciones;
        plants[cand.i].ventana = original;
        if (cuentan >= 1 && (mejor === null || cuentan < mejor.cuentan)) mejor = { ...cand, cuentan };
        if (cuentan === 1) break;
      }
      if (!mejor) break;
      plants[mejor.i].ventana = plants[mejor.i].ventana.filter((x) => x !== mejor.c);
    }

    const res = contarSoluciones(config, { tope: 2 });
    if (res.soluciones !== 1) continue;

    // Con las ventanas clavadas al calendario no habría nada que decidir.
    const holgura = plants.reduce((acc, p) => acc + (p.ventana.length - p.doses), 0);
    if (holgura < plants.length) continue;

    return {
      variant: cfg.nombre,
      cycles: cfg.cycles,
      capacity: cfg.capacity,
      plants,
      ...(config.incompatibles ? { incompatibles: config.incompatibles } : {}),
      solucion: res.primera,
      // Una regla más que rastrear sube la dificultad un punto, tope 5 --
      // mismo patrón que el color en nonograma o el modo en el láser.
      dificultad: config.incompatibles ? Math.min(5, cfg.dificultad + 1) : cfg.dificultad,
      intentos: intento + 1
    };
  }

  throw new Error(`No se pudo generar un reto de riego para seed=${seed}`);
}

// --- Pistas ---------------------------------------------------------------

// Tres pistas derivadas del calendario concreto: por dónde entrar, qué ciclo
// aprieta y qué regla se olvida más.
export function buildRiegoHints(puzzle) {
  const { plants, cycles, capacity } = puzzle;

  // Mejor entrada: la planta con menos calendarios posibles, que es por donde
  // se empieza a deducir.
  const opciones = plants.map((p) => combinacionesPlanta(p).length);
  const minimo = Math.min(...opciones);
  const idx = opciones.indexOf(minimo);
  const planta = plants[idx];
  const ciclosTxt = planta.ventana.map((c) => c + 1).join(', ');

  const primera = minimo === 1
    ? `Empieza por ${planta.id}: con su ventana (ciclos ${ciclosTxt}) y el descanso obligatorio solo hay UNA forma de repartir sus ${planta.doses} riegos, así que esos días ya están decididos.`
    : `Empieza por ${planta.id}, que es la que menos margen tiene: solo ${minimo} repartos posibles de sus ${planta.doses} riegos entre los ciclos ${ciclosTxt}. Fija esos y el resto se va estrechando.`;

  // Ciclo más disputado: en cuántas ventanas aparece.
  const demanda = Array(cycles).fill(0);
  plants.forEach((p) => p.ventana.forEach((c) => { demanda[c]++; }));
  const masDisputado = demanda.indexOf(Math.max(...demanda));

  const segunda = `El ciclo ${masDisputado + 1} lo tienen en su ventana ${demanda[masDisputado]} plantas, pero la regadera solo da para ${capacity} riego${capacity === 1 ? '' : 's'} por ciclo. ` +
    'Mira quién puede permitirse regar otro día y quién no, porque ahí es donde se rompe el empate.';

  const tercera = 'La regla que más se olvida: ninguna planta puede regarse dos ciclos seguidos. ' +
    'Si te cuadran todas las dosis pero el reto no se da por bueno, casi siempre hay una planta con dos riegos pegados.';

  return [primera, segunda, tercera];
}
