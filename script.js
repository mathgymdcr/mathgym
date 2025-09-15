import './plantillas/base.js';
import { initRouter } from './router.js';
const $=id=>document.getElementById(id);
async function loadReto(fecha){ const ruta=fecha?`retos/${encodeURIComponent(fecha)}.json`:'reto.json'; const r=await fetch(ruta,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
async function mount(reto){ document.querySelectorAll('#year').forEach(e=>e.textContent=new Date().getFullYear()); $('titulo-reto').textContent=reto.titulo||'Reto del día'; $('objetivo-reto').textContent=reto.objetivo||''; const sec=$('reto-interactivo'); const cont=$('contenedor-interactivo'); sec.hidden=false; cont.innerHTML='<div class="skeleton">Cargando...</div>'; if(window.Templates&&typeof window.Templates.render==='function'){ await window.Templates.render(reto.tipo, reto.data||{}, cont, { onSuccess(){ cont.classList.add('template-success'); setTimeout(()=>cont.classList.remove('template-success'),800); } }); } else { const estado=document.getElementById('estado-carga'); if(estado) estado.innerHTML='<p class="feedback ko">Loader de plantillas no disponible.</p>'; } }
initRouter({ mount, loadReto }).renderCurrent();
