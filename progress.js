// ===== progress.js =====
// Progreso local (rachas y estrellas) usando localStorage. Sin backend ni
// cuentas.

import { MAX_ESTRELLAS } from './estrellas.js';

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
// `estrellas` es la marca de ESTA partida (1-3). Rejugar el reto del día
// vuelve a pasar por aquí: la marca puede subir, nunca bajar, y la racha no se
// toca dos veces por el mismo día.
export function recordCompletion(reto, estrellas = MAX_ESTRELLAS) {
  if (!reto || !reto.fecha) return readState();

  const state = readState();
  const yaHecho = state.completed[reto.fecha];
  const previas = yaHecho && Number.isFinite(yaHecho.estrellas) ? yaHecho.estrellas : 0;

  state.completed[reto.fecha] = {
    tipo: reto.tipo,
    titulo: reto.titulo,
    estrellas: Math.max(previas, estrellas)
  };

  // La racha cuenta días, no partidas: solo avanza la primera vez que se
  // completa una fecha.
  if (!yaHecho) {
    if (state.lastCompletedFecha && nextDay(state.lastCompletedFecha) === reto.fecha) {
      state.currentStreak += 1;
    } else {
      state.currentStreak = 1;
    }
    state.lastCompletedFecha = reto.fecha;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
  }

  writeState(state);
  return state;
}

export function getProgress() {
  const state = readState();
  // Derivado, no guardado: así no hay dos fuentes de verdad que puedan
  // desincronizarse si alguien edita el localStorage a mano.
  state.totalEstrellas = Object.values(state.completed)
    .reduce((suma, dia) => suma + (Number.isFinite(dia.estrellas) ? dia.estrellas : 0), 0);
  return state;
}
