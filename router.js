// ===== router.js =====
export function initRouter({ mount, loadReto }) {
  async function renderCurrent() {
    const params = new URLSearchParams(window.location.search);
    const fecha = params.get('fecha');

    try {
      const reto = await loadReto(fecha);
      await mount(reto);
    } catch (err) {
      const cont = document.getElementById('contenedor-interactivo');
      if (cont) {
        cont.innerHTML = `<div class="error">⚠️ No se pudo cargar el reto<br>${err.message}</div>`;
      }
      console.error('Router error:', err);
    }
  }

  function navigateTo(fecha) {
    const url = fecha ? `?fecha=${encodeURIComponent(fecha)}` : './index.html';
    history.pushState({}, '', url);
    renderCurrent();
  }

  window.addEventListener('popstate', renderCurrent);

  return { renderCurrent, navigateTo };
}
