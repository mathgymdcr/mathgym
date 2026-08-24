// ===== scripts/mezcla-logic.js =====
// BFS puro sobre el espacio de estados de mezcla-quimica, compartido
// entre generador y validador para que la solvencia (y el mínimo de
// movimientos que aparece en objectives) no puedan divergir entre los dos.

function stateKey(levels) {
  return levels.join(',');
}

// Estados alcanzables desde `levels` con un solo movimiento:
// - vaciar cualquier matraz con reactivo (acción siempre disponible, la
//   use la variante que la use -- ver btnEmpty en mezcla_quimica.js)
// - trasvasar entre cualquier par (origen, destino)
// - si hay dosificador (`grifo`): llenar cualquier matraz no lleno
function nextStates(levels, capacities, grifo) {
  const out = [];
  const n = levels.length;

  for (let i = 0; i < n; i++) {
    if (levels[i] > 0) {
      const next = levels.slice();
      next[i] = 0;
      out.push(next);
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const amount = Math.min(levels[i], capacities[j] - levels[j]);
      if (amount > 0) {
        const next = levels.slice();
        next[i] -= amount;
        next[j] += amount;
        out.push(next);
      }
    }
  }

  if (grifo) {
    for (let i = 0; i < n; i++) {
      if (levels[i] < capacities[i]) {
        const next = levels.slice();
        next[i] = capacities[i];
        out.push(next);
      }
    }
  }

  return out;
}

// BFS desde initialLevels hasta el primer estado con algún matraz en
// `target`. Devuelve el nº mínimo de movimientos, o null si no es
// alcanzable -- el espacio de estados es finito (cada nivel está acotado
// por su capacidad), así que el BFS siempre termina.
//
// El dosificador se lee del campo booleano `grifo`, uno de los tres ejes
// del tipo (los otros dos son el nº de matraces -- la longitud de
// `capacities` -- y, cuando se implemente, el nº de objetivos).
export function solveMezcla(cfg) {
  const { capacities, target, initialLevels } = cfg;
  const grifo = cfg.grifo === true;

  if (initialLevels.includes(target)) return 0;

  const visited = new Set([stateKey(initialLevels)]);
  let frontier = [initialLevels];
  let moves = 0;

  while (frontier.length > 0) {
    moves++;
    const nextFrontier = [];
    for (const levels of frontier) {
      for (const next of nextStates(levels, capacities, grifo)) {
        const key = stateKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        if (next.includes(target)) return moves;
        nextFrontier.push(next);
      }
    }
    frontier = nextFrontier;
  }

  return null; // no alcanzable
}

// Capacidades acotadas a 12 mL: el espacio de estados del BFS es el
// producto de (capacidad+1), así que con 4 matraces el peor caso son
// ~28k estados -- instantáneo. Subir el tope lo dispara sin que el
// reto gane nada.
export const CONFIGS_MEZCLA = [
  { capacities: [7, 4, 3], target: 5 },
  { capacities: [8, 5, 3], target: 4 },
  { capacities: [9, 4, 2], target: 6 },
  { capacities: [12, 7, 5], target: 9 },
  { capacities: [10, 6, 4], target: 8 },
  // Las de 4 matraces son dificultad 3, así que tienen que costar MÁS que
  // las de 3, no menos: un cuarto matraz abre caminos y hace trivial casi
  // cualquier objetivo (con [12,9,5,4] los 7 mL salían en un movimiento).
  // Estas son las únicas del espacio de búsqueda que aguantan un mínimo de
  // 6 movimientos con y sin dosificador.
  { capacities: [12, 10, 7, 5], target: 11 },
  { capacities: [11, 9, 7, 2], target: 10 },
  { capacities: [12, 11, 6, 5], target: 9 },
  { capacities: [11, 10, 6, 5], target: 8 },
  { capacities: [12, 10, 7, 5], target: 6 }
];

// Un reto por debajo de esto no es un reto: con 3 matraces el objetivo sale
// de llenar uno y volcarlo, y con 4 -- que dan muchos más caminos -- es aún
// más fácil caer ahí sin darse cuenta. Generador y validador comparten el
// umbral para que ninguna tabla de configuraciones lo esquive.
export const MIN_MOVIMIENTOS_MEZCLA = 3;

// Arranque del reto, parte de la definición del puzzle y no de la interfaz:
// con dosificador se empieza en seco (siempre se puede llenar); sin él, todo
// el reactivo disponible está en el primer matraz. Compartido por generador,
// validador y plantilla para que las tres den el mismo estado inicial.
export function initialLevelsMezcla(capacities, grifo) {
  return grifo
    ? capacities.map(() => 0)
    : [capacities[0], ...capacities.slice(1).map(() => 0)];
}

export function isMezclaSolvable(cfg) {
  return solveMezcla(cfg) !== null;
}
