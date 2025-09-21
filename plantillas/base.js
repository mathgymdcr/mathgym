// plantillas/base.js - Actualizado con todas las plantillas
window.Templates = (function() {
  const loaders = {
    'enigma-einstein': () => import('./enigma_einstein.js'),
    'relojes-arena': () => import('./relojes_arena.js'),
    'jarras-exactas': () => import('./jarras_exactas.js'),
    'plantas': () => import('./plantas.js'),
    'poligono-geometrico': () => import('./poligono_geometrico.js'),
    'trasvase-ecologico': () => import('./trasvase_ecologico.js'),
    'balanza-logica': () => import('./balanza_logica.js')
  };

  async function render(tipo, data, container, hooks) {
    if (!loaders[tipo]) {
      container.innerHTML = `<p>Plantilla no encontrada: <code>${tipo}</code></p>`;
      return;
    }

    try {
      const mod = await loaders[tipo]();
      if (typeof mod.render !== 'function') {
        container.innerHTML = `<p>La plantilla <code>${tipo}</code> no expone render()</p>`;
        return;
      }
      await mod.render(container, data, hooks || {});
    } catch (error) {
      console.error('Error cargando plantilla:', error);
      container.innerHTML = `<p>Error al cargar la plantilla <code>${tipo}</code>: ${error.message}</p>`;
    }
  }

  return { render };
})();