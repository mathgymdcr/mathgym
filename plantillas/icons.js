// ===== plantillas/icons.js =====
// Set único de iconos de línea para las cabeceras de reto (trazo en currentColor,
// pensados para el círculo de 46px de .enigma-header-icon). Deceerre conserva su
// propia ilustración cartoon y no pasa por aquí.

const svg = inner =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const RETO_ICONS = {
  'enigma-einstein': svg(
    '<circle cx="10" cy="10" r="6"/><line x1="14.5" y1="14.5" x2="20" y2="20"/>'
  ),
  'lightsout': svg(
    '<rect x="3" y="3" width="7" height="7" rx="1.2"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1.2"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1.2"/>' +
    '<rect x="14" y="14" width="7" height="7" rx="1.2" fill="currentColor"/>'
  ),
  'balanza-logica': svg(
    '<line x1="12" y1="3" x2="12" y2="19"/>' +
    '<line x1="5" y1="7" x2="19" y2="7"/>' +
    '<path d="M5 7 2.5 12.5A3 3 0 0 0 7.5 12.5Z"/>' +
    '<path d="M19 7 16.5 12.5A3 3 0 0 0 21.5 12.5Z"/>' +
    '<line x1="8" y1="21" x2="16" y2="21"/>'
  ),
  'poligono-geometrico': svg(
    '<path d="M12 3 21 9.5 17.8 20 6.2 20 3 9.5Z"/>' +
    '<circle cx="12" cy="3" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="21" cy="9.5" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="17.8" cy="20" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="6.2" cy="20" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="3" cy="9.5" r="1.3" fill="currentColor" stroke="none"/>'
  ),
  ecologico: svg(
    '<path d="M12 3C12 3 6 11.2 6 15.5A6 6 0 0 0 18 15.5C18 11.2 12 3 12 3Z"/>'
  ),
  clasico: svg(
    '<path d="M10 3H14"/>' +
    '<path d="M10 3V8L5.6 16.8A2 2 0 0 0 7.4 19.8H16.6A2 2 0 0 0 18.4 16.8L14 8V3"/>' +
    '<line x1="7" y1="14.5" x2="17" y2="14.5"/>'
  ),
  'relojes-arena': svg(
    '<path d="M6 3H18"/>' +
    '<path d="M6 21H18"/>' +
    '<path d="M6 3C6 8 12 10.5 12 10.5 12 10.5 18 8 18 3"/>' +
    '<path d="M6 21C6 16 12 13.5 12 13.5 12 13.5 18 16 18 21"/>'
  )
};
