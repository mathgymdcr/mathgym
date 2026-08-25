// ===== scripts/balanza-logic.js =====
// Matemática pura del reto de balanza-lógica y lectura de su payload,
// compartidas entre el generador, el validador y la plantilla para que
// ni la cota de solvencia ni los nombres de las variantes puedan
// divergir entre ellos (ver A.4 / sección 5 del informe de auditoría).

// ---------------------------------------------------------------------
// EL PAYLOAD, EN ESPAÑOL
// ---------------------------------------------------------------------
// El reto se describe en el mismo idioma que el resto del proyecto: la
// variante en kebab y los parámetros como `n_monedas` / `k_impostoras`
// / `max_pesadas`. Los retos publicados antes traen `oddUnknown`, `N`,
// `k` y `maxWeighings`, así que `leerConfigBalanza` traduce al entrar y
// es el ÚNICO sitio donde conviven los dos idiomas: generador,
// validador y plantilla trabajan ya solo con el nuevo.
const VARIANTES_VIEJAS = {
  oddUnknown: 'desconocida',
  heaviest: 'pesada',
  lightest: 'ligera',
  kHeaviest: 'pesadas-multiples',
  kLightest: 'ligeras-multiples',
  kOddUnknown: 'desconocidas-multiples'
};

export const VARIANTES_BALANZA = Object.values(VARIANTES_VIEJAS);

export function leerConfigBalanza(raw) {
  if (!raw) return raw;
  const { variant, N, k, maxWeighings, ...resto } = raw;
  const cfg = { ...resto };
  // Una variante desconocida se deja pasar sin tocar: quien valida es el
  // validador, y un nombre inventado tiene que llegarle tal cual para
  // que lo cace en vez de convertirse aquí en un `undefined` mudo.
  if (variant != null) cfg.variant = VARIANTES_VIEJAS[variant] || variant;
  if (raw.n_monedas != null || N != null) cfg.n_monedas = raw.n_monedas != null ? raw.n_monedas : N;
  if (raw.k_impostoras != null || k != null) cfg.k_impostoras = raw.k_impostoras != null ? raw.k_impostoras : k;
  if (raw.max_pesadas != null || maxWeighings != null) {
    cfg.max_pesadas = raw.max_pesadas != null ? raw.max_pesadas : maxWeighings;
  }
  return cfg;
}

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
// si aplica, su signo) para un config de balanza YA LEÍDO con
// `leerConfigBalanza`. Es lo que la cota de teoría de la información
// (3^W >= escenarios) necesita como entrada; mantener en sync con
// generateBalanzaAnomalies de generate-daily-reto.js si cambian las
// variantes soportadas (la plantilla ya no tiene copia propia).
export function balanzaScenarios(cfg) {
  const n = cfg.n_monedas, k = cfg.k_impostoras || 1;
  switch (cfg.variant) {
    case 'pesada':
    case 'ligera':
      return n;
    case 'desconocida':
      return 2 * n;
    case 'pesadas-multiples':
    case 'ligeras-multiples':
      return nCk(n, k);
    case 'desconocidas-multiples':
      return nCk(n, k) * Math.pow(2, k);
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
