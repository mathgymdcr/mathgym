// ===== scripts/trasvase-logic.js =====
// BFS puro sobre el espacio de estados de trasvase-ecologico, compartido
// entre generador y validador para que la solvencia (y el mínimo de
// movimientos que aparece en objectives) no puedan divergir entre los dos.

function stateKey(levels) {
  return levels.join(',');
}

// Estados alcanzables desde `levels` con un solo movimiento:
// - vaciar cualquier recipiente con agua (acción siempre disponible, la
//   use la variante que la use -- ver btnEmpty en trasvase_ecologico.js)
// - trasvasar entre cualquier par (origen, destino)
// - si hasTap (variant === 'clasico'): llenar cualquier recipiente no
//   lleno desde el grifo
function nextStates(levels, capacities, hasTap) {
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

  if (hasTap) {
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

// BFS desde initialLevels hasta el primer estado con algún recipiente en
// `target`. Devuelve el nº mínimo de movimientos, o null si no es
// alcanzable -- el espacio de estados es finito (cada nivel está acotado
// por su capacidad), así que el BFS siempre termina.
export function solveTrasvase(cfg) {
  const { capacities, target, initialLevels } = cfg;
  const hasTap = cfg.variant === 'clasico';

  if (initialLevels.includes(target)) return 0;

  const visited = new Set([stateKey(initialLevels)]);
  let frontier = [initialLevels];
  let moves = 0;

  while (frontier.length > 0) {
    moves++;
    const nextFrontier = [];
    for (const levels of frontier) {
      for (const next of nextStates(levels, capacities, hasTap)) {
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

export function isTrasvaseSolvable(cfg) {
  return solveTrasvase(cfg) !== null;
}
