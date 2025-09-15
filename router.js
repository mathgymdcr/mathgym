// router.js — Mini SPA (History API)
export function initRouter({ mount, loadReto }) {
  const go = async (fecha, { replace=false }={}) => {
    const url = fecha ? `?fecha=${encodeURIComponent(fecha)}` : location.pathname;
    replace ? history.replaceState({ fecha }, '', url) : history.pushState({ fecha }, '', url);
    await renderCurrent();
  };
  async function renderCurrent(){
    const params = new URLSearchParams(location.search);
    const fecha = params.get('fecha');
    try{ showSkeleton(); const reto = await loadReto(fecha); await mount(reto); focusMainHeading(); window.scrollTo({top:0,behavior:'instant'}); }
    catch(err){ const t=document.getElementById('titulo-reto'); if(t) t.textContent='No se pudo cargar el reto'; console.error(err); }
    finally{ hideSkeleton(); }
  }
  function showSkeleton(){ const cont=document.getElementById('contenedor-interactivo'); if(cont) cont.innerHTML='<div class="skeleton">Cargando...</div>'; }
  function hideSkeleton(){}
  function focusMainHeading(){ const el=document.getElementById('titulo-reto'); if(el && el.focus){ el.setAttribute('tabindex','-1'); el.focus(); } }
  window.addEventListener('popstate', renderCurrent);
  document.addEventListener('click', (e)=>{ const a=e.target.closest('a[data-ruta-fecha]'); if(!a) return; e.preventDefault(); go(a.dataset.rutaFecha); });
  return { go, renderCurrent };
}
