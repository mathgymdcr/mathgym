// ===== scripts/balanza-logic.js =====
// Matemática pura del reto de balanza-lógica, compartida entre el
// generador y el validador para que la cota de solvencia no pueda
// divergir entre los dos (ver A.4 / sección 5 del informe de auditoría).

// Combinaciones de k elementos entre n, sin dependencias externas.
export function nCk(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

// Nº de escenarios posibles a distinguir (qué moneda(s) son anómalas y,
// si aplica, su signo) para un config de balanza. Es lo que la cota de
// teoría de la información (3^W >= escenarios) necesita como entrada;
// mantener en sync con generateBalanzaAnomalies de generate-daily-reto.js
// y plantillas/balanza_logica.js si cambian las variantes soportadas.
export function balanzaScenarios(cfg) {
  const N = cfg.N, k = cfg.k || 1;
  switch (cfg.variant) {
    case 'heaviest':
    case 'lightest':
      return N;
    case 'oddUnknown':
      return 2 * N;
    case 'kHeaviest':
    case 'kLightest':
      return nCk(N, k);
    case 'kOddUnknown':
      return nCk(N, k) * Math.pow(2, k);
    default:
      return null;
  }
}

// Mínimo de pesadas necesario: el menor W tal que 3^W >= escenarios
// (cada pesada tiene 3 resultados posibles: izq/der/equilibrio).
// Bucle entero en vez de log3 con floats para no arriesgar errores de
// redondeo justo en los casos límite (escenarios = potencia exacta de 3).
export function balanzaMinWeighings(cfg) {
  const scenarios = balanzaScenarios(cfg);
  if (scenarios == null) return null;
  let w = 0, cap = 1;
  while (cap < scenarios) { cap *= 3; w++; }
  return w;
}
