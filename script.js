import './plantillas/base.js';
import { initRouter } from './router.js';

const $ = id => document.getElementById(id);

async function loadReto(fecha) {
  const ruta = fecha ? `retos/${encodeURIComponent(fecha)}.json` : 'reto.json';
  const r = await fetch(ruta, { cache: 'default' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function mount(reto) {
  document.querySelectorAll('#year').forEach(e => e.textContent = new Date().getFullYear());
  
  // NO mostrar título ni objetivo - cada plantilla tendrá su header interno
  $('titulo-reto').textContent = '';
  $('objetivo-reto').textContent = '';
  
  const sec = $('reto-interactivo');
  const cont = $('contenedor-interactivo');
  sec.hidden = false;
  cont.innerHTML = '<div class="skeleton">Cargando…</div>';
  
  await window.Templates.render(reto.tipo, reto.data || {}, cont, { onSuccess() {} });
}

initRouter({ mount, loadReto }).renderCurrent();
