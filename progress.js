// ===== progress.js =====
// Progreso local (rachas) usando localStorage. Sin backend ni cuentas.

const STORAGE_KEY = 'mathgym_progress_v1';

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: {}, currentStreak: 0, bestStreak: 0, lastCompletedFecha: null };
    const parsed = JSON.parse(raw);
    return {
      completed: parsed.completed || {},
      currentStreak: parsed.currentStreak || 0,
      bestStreak: parsed.bestStreak || 0,
      lastCompletedFecha: parsed.lastCompletedFecha || null
    };
  } catch {
    return { completed: {}, currentStreak: 0, bestStreak: 0, lastCompletedFecha: null };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage no disponible (modo privado, cuota llena...); el progreso simplemente no persiste.
  }
}

// Día siguiente a una fecha "YYYY-MM-DD", calculado en UTC para no depender de la zona horaria del navegador.
function nextDay(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Solo se debe llamar con el reto DEL DÍA (nunca uno cargado vía ?fecha= del archivo),
// para que la racha refleje visitas diarias reales y no rejugar el histórico.
export function recordCompletion(reto) {
  if (!reto || !reto.fecha) return readState();

  const state = readState();
  if (state.completed[reto.fecha]) return state; // ya contabilizado hoy

  state.completed[reto.fecha] = { tipo: reto.tipo, titulo: reto.titulo };

  if (state.lastCompletedFecha && nextDay(state.lastCompletedFecha) === reto.fecha) {
    state.currentStreak += 1;
  } else {
    state.currentStreak = 1;
  }
  state.lastCompletedFecha = reto.fecha;
  state.bestStreak = Math.max(state.bestStreak, state.currentStreak);

  writeState(state);
  return state;
}

export function getProgress() {
  return readState();
}
