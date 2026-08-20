// ===== scripts/cajas-logic.js =====
// Solver y generador de "cajas apiladas", compartidos entre
// scripts/generate-daily-reto.js y scripts/validate-retos.js.
//
// La base es Hanói, pero con dos cambios que rompen el 2^n - 1:
//   - cada caja pesa unos kilos concretos (no 1..n), y
//   - un movimiento puede llevarse VARIAS cajas del tope a la vez, mientras
//     la suma de sus pesos no pase de la capacidad de carga.
// Se mantiene la regla de apilado de la plantilla: nunca una caja sobre otra
// más ligera. Las zonas se escriben siempre de abajo arriba.

// Estado -> texto, para el conjunto de visitados del BFS.
const clave = (zonas) => zonas.map((z) => z.join(',')).join('|');

// Todos los movimientos legales desde un estado: coger las k cajas de arriba
// de una zona (k >= 1) sin pasarse de carga, y dejarlas en otra zona cuyo
// tope aguante la caja inferior del bloque.
function movimientos(zonas, capacidad) {
  const res = [];
  for (let i = 0; i < zonas.length; i++) {
    const origen = zonas[i];
    let suma = 0;
    for (let k = 1; k <= origen.length; k++) {
      const bloque = origen.slice(origen.length - k);
      suma = bloque.reduce((a, b) => a + b, 0);
      // Al añadir cajas hacia abajo la suma solo crece: en cuanto se pasa,
      // ningún bloque mayor va a caber tampoco.
      if (suma > capacidad) break;
      for (let j = 0; j < zonas.length; j++) {
        if (j === i) continue;
        const tope = zonas[j][zonas[j].length - 1];
        if (tope !== undefined && tope < bloque[0]) continue;
        res.push({ desde: i, hacia: j, cajas: bloque });
      }
    }
  }
  return res;
}

function aplicar(zonas, mov) {
  const copia = zonas.map((z) => [...z]);
  copia[mov.desde].splice(copia[mov.desde].length - mov.cajas.length);
  copia[mov.hacia].push(...mov.cajas);
  return copia;
}

// BFS por número de movimientos. Devuelve el mínimo real y una secuencia que
// lo alcanza, o null si el reto no tiene solución (típicamente porque la
// capacidad no llega ni para la caja más pesada).
export function solveCajas({ zonas, capacidad, destino }) {
  const total = zonas.reduce((acc, z) => acc + z.length, 0);
  const inicio = zonas.map((z) => [...z]);
  if (inicio[destino].length === total) return { movimientos: 0, pasos: [] };

  const vistos = new Map([[clave(inicio), null]]);
  let frontera = [inicio];

  while (frontera.length) {
    const siguiente = [];
    for (const estado of frontera) {
      for (const mov of movimientos(estado, capacidad)) {
        const nuevo = aplicar(estado, mov);
        const k = clave(nuevo);
        if (vistos.has(k)) continue;
        vistos.set(k, { previo: clave(estado), mov });

        if (nuevo[destino].length === total) {
          const pasos = [];
          let cur = k;
          while (vistos.get(cur)) {
            const { previo, mov: m } = vistos.get(cur);
            pasos.unshift(m);
            cur = previo;
          }
          return { movimientos: pasos.length, pasos };
        }
        siguiente.push(nuevo);
      }
    }
    frontera = siguiente;
  }

  return null;
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

const VARIANTES = ['ligero', 'medio', 'pesado'];
const CAJAS_POR_VARIANTE = { ligero: 4, medio: 5, pesado: 6 };
const DIFICULTAD_POR_VARIANTE = { ligero: 2, medio: 3, pesado: 4 };
const MAX_INTENTOS = 300;

// Elige pesos y capacidad de forma determinista y se queda con el primer
// reto que cumple las dos condiciones que lo hacen interesante: que la
// capacidad sirva para algo (mínimo por debajo del 2^n - 1 de Hanói) y que
// aun así no se resuelva de dos tirones.
export function buildCajasPuzzle(seed) {
  const variant = VARIANTES[seed % VARIANTES.length];
  const n = CAJAS_POR_VARIANTE[variant];
  const hanoi = Math.pow(2, n) - 1;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rand = mulberry32((seed + intento * 104729) >>> 0);

    // Pesos crecientes con saltos irregulares: nada de 1, 2, 3... que
    // delataría que el peso es solo el tamaño de siempre.
    const pesos = [];
    let peso = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      pesos.push(peso);
      peso += 2 + Math.floor(rand() * 5);
    }

    const masPesada = pesos[pesos.length - 1];
    // La capacidad tiene que levantar la caja más pesada -- si no, esa caja
    // no se movería nunca y el reto sería irresoluble -- y algo más, para
    // que agrupar sea posible. El margen se sortea sobre TODO el resto del
    // montón, no solo sobre las dos cajas más ligeras: con un margen
    // estrecho el reto acababa colapsando siempre al mismo mínimo (con 4
    // cajas salía 7 en todas las fechas), que es justo lo previsible que
    // esta mecánica viene a romper.
    const restoDelMonton = pesos.slice(0, -1).reduce((a, b) => a + b, 0);
    const capacidad = masPesada + Math.floor(rand() * (restoDelMonton + 1));

    // Reparto inicial entre las tres zonas, de la caja más pesada a la más
    // ligera: así cada pila queda ordenada sola. Con todo apilado en la Zona
    // A el mínimo solo podía valer 1, 3, 7, 15 o 31 -- las potencias de
    // Hanói -- porque la capacidad únicamente decidía en cuántos grupos se
    // partía la torre. Repartiendo, el mínimo puede caer en cualquier punto
    // del rango y deja de reconocerse el patrón.
    const zonas = [[], [], []];
    for (const p of [...pesos].reverse()) zonas[Math.floor(rand() * 3)].push(p);

    const destino = 2;
    const res = solveCajas({ zonas: zonas.map((z) => [...z]), capacidad, destino });
    if (!res) continue;
    if (res.movimientos >= hanoi) continue;   // la capacidad no aportaba nada
    if (res.movimientos < n) continue;        // demasiado fácil

    return {
      variant,
      zonas,
      capacidad,
      destino,
      nombresZonas: ['Zona A', 'Zona B', 'Zona C'],
      dificultad: DIFICULTAD_POR_VARIANTE[variant],
      solucion: res,
      hanoi,
      intentos: intento + 1
    };
  }

  throw new Error(`No se pudo generar un reto de cajas apiladas para seed=${seed}`);
}

// --- Pistas ---------------------------------------------------------------

const NOMBRES_ZONAS = ['Zona A', 'Zona B', 'Zona C'];

// Tres pistas derivadas del reparto concreto: qué grupos caben en un viaje,
// qué manda en el orden y cuánto cuesta hacerlo bien.
export function buildCajasHints(puzzle) {
  const { zonas, capacidad, destino, solucion } = puzzle;
  const nombres = puzzle.nombresZonas || NOMBRES_ZONAS;
  const todas = zonas.flat();
  const masPesada = Math.max(...todas);

  // Grupo real más grande que se puede levantar ahora mismo de una zona.
  let mejor = { zona: -1, cajas: [], suma: 0 };
  zonas.forEach((zona, i) => {
    for (let k = 1; k <= zona.length; k++) {
      const bloque = zona.slice(zona.length - k);
      const suma = bloque.reduce((a, b) => a + b, 0);
      if (suma > capacidad) break;
      if (bloque.length > mejor.cajas.length) mejor = { zona: i, cajas: bloque, suma };
    }
  });

  const primera = mejor.cajas.length > 1
    ? `Puedes cargar hasta ${capacidad} kg de una vez, y eso cambia las cuentas: en la ${nombres[mejor.zona]} las ${mejor.cajas.length} cajas de arriba suman ${mejor.suma} kg (${mejor.cajas.join(' + ')}), así que viajan juntas en un solo movimiento.`
    : `Puedes cargar hasta ${capacidad} kg de una vez, pero ahora mismo no hay ninguna zona cuyas dos cajas de arriba quepan juntas: empieza moviendo de una en una hasta dejar arriba dos ligeras que sí sumen menos de ${capacidad}.`;

  const enDestino = zonas[destino];
  const faltaLaPesada = !enDestino.includes(masPesada);
  const segunda = faltaLaPesada
    ? `La caja de ${masPesada} kg es la más pesada, así que tiene que acabar en el suelo de la ${nombres[destino]} y nada puede ir debajo de ella: colócala pronto y con la ${nombres[destino]} vacía, o te tocará deshacer el camino.`
    : `La caja de ${masPesada} kg ya está en el suelo de la ${nombres[destino]}, que es su sitio definitivo: no la toques y ve trayendo el resto encima en orden de peso decreciente.`;

  const m = solucion.movimientos;
  const tercera = `Se puede resolver en ${m} movimiento${m === 1 ? '' : 's'} contando cada viaje, lleves una caja o varias. Si vas muy por encima, casi siempre es que estás moviendo de una en una cajas que cabían juntas.`;

  return [primera, segunda, tercera];
}
