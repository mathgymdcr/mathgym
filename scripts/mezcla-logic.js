// ===== scripts/mezcla-logic.js =====
// BFS puro sobre el espacio de estados de mezcla-quimica, compartido
// entre generador y validador para que la solvencia (y el mínimo de
// movimientos que aparece en objectives) no puedan divergir entre los dos.

function stateKey(levels) {
  return levels.join(',');
}

// Objetivos del reto, siempre como lista. Los retos de un solo compuesto
// se escribieron con `target` a secas y siguen valiendo.
export function objetivosMezcla(cfg) {
  if (Array.isArray(cfg.targets)) return cfg.targets;
  return cfg.target != null ? [cfg.target] : [];
}

// Con varios objetivos el reto se sintetiza EN CADENA: cada compuesto se
// vierte en el reactor -- que vacía el matraz -- y el siguiente arranca
// de las sobras del anterior. El orden lo elige quien juega, así que el
// estado lleva un mapa de bits con los objetivos ya vertidos.
//
// Verter NO es gratis: es una acción más, como llenar o trasvasar, y así
// lo cuenta también la plantilla. Y es opcional: un matraz que ya tiene
// el volumen exacto puede reservarse para más tarde, porque ese reactivo
// quizá haga falta para construir otro objetivo antes de gastarlo.
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

// BFS desde initialLevels hasta tener TODOS los objetivos vertidos.
// Devuelve el nº mínimo de movimientos, o null si no es alcanzable -- el
// espacio de estados es finito (cada nivel está acotado por su capacidad,
// y los objetivos vertidos son un subconjunto), así que siempre termina.
//
// Los tres ejes del tipo son el dosificador (`grifo`), el nº de matraces
// (la longitud de `capacities`) y el nº de objetivos (`targets`).
export function solveMezcla(cfg) {
  const { capacities, initialLevels } = cfg;
  const grifo = cfg.grifo === true;
  const objetivos = objetivosMezcla(cfg);
  if (objetivos.length === 0) return null;

  // Un objetivo que no cabe en ningún matraz no se alcanza nunca; sin este
  // corte el BFS recorrería el espacio entero para decir que no.
  const capMax = Math.max(...capacities);
  if (objetivos.some((t) => t > capMax)) return null;

  const completo = (1 << objetivos.length) - 1;
  const clave = (levels, mask) => stateKey(levels) + '#' + mask;

  const visited = new Set([clave(initialLevels, 0)]);
  let frontier = [[initialLevels, 0]];
  let moves = 0;

  while (frontier.length > 0) {
    moves++;
    const nextFrontier = [];
    for (const [levels, mask] of frontier) {
      // Verter: cualquier matraz cuyo nivel case con un objetivo pendiente.
      for (let i = 0; i < levels.length; i++) {
        for (let t = 0; t < objetivos.length; t++) {
          if (mask & (1 << t)) continue;
          if (levels[i] !== objetivos[t]) continue;
          const next = levels.slice();
          next[i] = 0;
          const nextMask = mask | (1 << t);
          if (nextMask === completo) return moves;
          const k = clave(next, nextMask);
          if (visited.has(k)) continue;
          visited.add(k);
          nextFrontier.push([next, nextMask]);
        }
      }
      // Llenar, vaciar y trasvasar: no tocan los objetivos ya vertidos.
      for (const next of nextStates(levels, capacities, grifo)) {
        const k = clave(next, mask);
        if (visited.has(k)) continue;
        visited.add(k);
        nextFrontier.push([next, mask]);
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

// Con varios objetivos el listón sube en proporción: si dos compuestos se
// sacan con el trabajo de uno, el segundo no está aportando nada y el
// reto solo es más largo de teclear.
export function minimoExigidoMezcla(nObjetivos) {
  return MIN_MOVIMIENTOS_MEZCLA * Math.max(1, nObjetivos);
}

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
