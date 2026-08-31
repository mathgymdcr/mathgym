// ===== debug.js =====
// Lógica de debug.html: candado disuasorio (ver debug-auth.js -- esto NO es
// seguridad real, es un sitio estático sin backend) y, una vez dentro, un
// botón por cada variante de data/debug/matrix.json que monta la plantilla
// real con window.Templates.render, igual que el ejemplo de ?tipo= en
// script.js.
import './plantillas/base.js';
import { hashPassword } from './debug-auth.js';

// sha256("Bentrock"). Cambiar la contraseña es cambiar este hash --
// hashPassword('lo-que-sea') en la consola del navegador lo calcula.
const HASH_ESPERADO = '97549ef0060e3164d647af0bb7ec8bb57bfc0367e64807a1e5cfadd70f936b2f';
const SESSION_KEY = 'mathgym-debug-ok';

const gate = document.getElementById('debug-gate');
const passInput = document.getElementById('debug-pass');
const passError = document.getElementById('debug-pass-error');
const content = document.getElementById('debug-content');

async function intentarEntrar(valor) {
  const hash = await hashPassword(valor);
  if (hash !== HASH_ESPERADO) {
    passError.textContent = 'Contraseña incorrecta.';
    return;
  }
  sessionStorage.setItem(SESSION_KEY, '1');
  mostrarContenido();
}

passInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  passError.textContent = '';
  intentarEntrar(passInput.value);
});

function mostrarContenido() {
  gate.hidden = true;
  content.hidden = false;
  cargarMatriz();
}

if (sessionStorage.getItem(SESSION_KEY) === '1') {
  mostrarContenido();
} else {
  passInput.focus();
}

// --- Matriz de variantes ---

const subtitle = document.getElementById('debug-subtitle');
const tiposEl = document.getElementById('debug-tipos');
const panel = document.getElementById('debug-panel');

async function cargarMatriz() {
  let matrix;
  try {
    const res = await fetch('data/debug/matrix.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    matrix = await res.json();
  } catch (err) {
    subtitle.textContent = `No se pudo cargar data/debug/matrix.json: ${err.message}. ` +
      `¿Se ha corrido "node scripts/generate-debug-matrix.js"?`;
    return;
  }

  subtitle.textContent = `${matrix.length} variantes encontradas.`;

  const porTipo = new Map();
  for (const entrada of matrix) {
    if (!porTipo.has(entrada.tipo)) porTipo.set(entrada.tipo, []);
    porTipo.get(entrada.tipo).push(entrada);
  }

  tiposEl.innerHTML = '';
  for (const [tipo, entradas] of porTipo) {
    const bloque = document.createElement('div');
    bloque.className = 'debug-tipo';

    const titulo = document.createElement('h2');
    titulo.textContent = `${entradas[0].titulo} (${tipo}) — ${entradas.length}`;
    bloque.appendChild(titulo);

    const fila = document.createElement('div');
    fila.className = 'debug-variantes';
    for (const entrada of entradas) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${entrada.variant} · d${entrada.dificultad ?? '?'} · seed ${entrada.seed}`;
      btn.addEventListener('click', () => montar(entrada, btn));
      fila.appendChild(btn);
    }
    bloque.appendChild(fila);
    tiposEl.appendChild(bloque);
  }
}

async function montar(entrada, btn) {
  document.querySelectorAll('.debug-variantes button.is-active')
    .forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');

  panel.innerHTML = '<p class="debug-panel-empty">Cargando…</p>';
  try {
    const res = await fetch(entrada.json_url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const host = document.createElement('div');
    panel.innerHTML = '';
    panel.appendChild(host);
    await window.Templates.render(entrada.tipo, { ...data, dificultad: entrada.dificultad }, host, {});
  } catch (err) {
    panel.innerHTML = `<p class="debug-panel-empty">No se pudo montar: ${err.message}</p>`;
  }
}
