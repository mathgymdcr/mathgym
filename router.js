// router.js — Mini SPA (History API) - MEJORADO

export function initRouter({ mount, loadReto }) {
  const go = async (fecha, { replace = false } = {}) => {
    const url = fecha ? `?fecha=${encodeURIComponent(fecha)}` : location.pathname;
    replace ? history.replaceState({ fecha }, '', url) : history.pushState({ fecha }, '', url);
    await renderCurrent();
  };

  async function renderCurrent() {
    const params = new URLSearchParams(location.search);
    const fecha = params.get('fecha');
    
    // Mostrar estado de carga
    showLoadingState();
    
    try {
      const reto = await loadReto(fecha);
      await mount(reto);
      
      // Mejorar accesibilidad y foco
      const titleEl = document.getElementById('titulo-reto');
      if (titleEl) {
        titleEl.setAttribute('tabindex', '-1');
        titleEl.focus();
      }
      
      // Scroll suave al inicio
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Ocultar estado de error si existía
      hideErrorState();
      
    } catch (err) {
      console.error('Error al cargar reto:', err);
      showErrorState(err);
    }
  }

  function showLoadingState() {
    const container = document.getElementById('contenedor-interactivo');
    const estadoCard = document.getElementById('estado-card');
    
    if (container) {
      container.innerHTML = '<div class="skeleton">⏳ Cargando reto...</div>';
    }
    
    if (estadoCard) {
      estadoCard.hidden = false;
      estadoCard.innerHTML = `
        <div class="feedback">
          <span style="display: inline-block; animation: spin 1s linear infinite;">⚙️</span>
          Preparando el reto...
        </div>
      `;
    }
  }

  function showErrorState(error) {
    const estadoCard = document.getElementById('estado-card');
    const retoInteractivo = document.getElementById('reto-interactivo');
    
    if (estadoCard) {
      estadoCard.hidden = false;
      
      let errorMessage = '❌ No se pudo cargar el reto';
      if (error.message?.includes('404') || error.message?.includes('HTTP 404')) {
        errorMessage = '📅 Reto no encontrado - puede que aún no esté disponible';
      } else if (error.message?.includes('fetch')) {
        errorMessage = '🌐 Error de conexión - verifica tu internet';
      }
      
      estadoCard.innerHTML = `
        <div class="feedback ko">
          ${errorMessage}
        </div>
        <div style="margin-top: 12px;">
          <button class="btn" onclick="location.reload()" style="font-size: 0.9rem;">
            🔄 Intentar de nuevo
          </button>
          <a href="index.html" class="btn" style="font-size: 0.9rem; margin-left: 8px;">
            🏠 Reto del día
          </a>
        </div>
      `;
    }
    
    // Ocultar la sección interactiva si hay error
    if (retoInteractivo) {
      retoInteractivo.hidden = true;
    }
  }

  function hideErrorState() {
    const estadoCard = document.getElementById('estado-card');
    if (estadoCard) {
      estadoCard.hidden = true;
    }
  }

  // Event listeners
  window.addEventListener('popstate', renderCurrent);
  
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-ruta-fecha]');
    if (!link) return;
    
    e.preventDefault();
    go(link.dataset.rutaFecha);
  });

  // Agregar estilos para la animación de carga
  if (!document.getElementById('router-styles')) {
    const style = document.createElement('style');
    style.id = 'router-styles';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return { go, renderCurrent };
}
