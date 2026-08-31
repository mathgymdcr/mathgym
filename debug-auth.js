// ===== debug-auth.js =====
// SHA-256 en hex vía SubtleCrypto. Esto NO es seguridad real -- es un sitio
// estático sin backend, así que el candado es disuasorio: frena una visita
// casual, no a quien mire el código fuente. El hash solo evita que la
// contraseña quede en texto plano a simple vista.

export async function hashPassword(texto) {
  const datos = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
