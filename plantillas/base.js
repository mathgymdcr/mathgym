// ===== plantillas/base.js =====
// Sistema de registro y carga dinámica de plantillas para MathGym
// Actualizado con el nuevo reto "lightsout"

window.Templates = (function() {

  // --- Registro de todas las plantillas disponibles ---
  const loaders = {
    'enigma-einstein': () => import('./enigma_einstein.js'),
    'luces-fuera': () => import('./luces_fuera.js'),
    'lightsout': () => import('./luces_fuera.js'),   // alias legado
    'relojes-arena': () => import('./relojes_arena.js'),
    'riego-plantas': () => import('./riego_plantas.js'),
    'plantas': () => import('./riego_plantas.js'),   // alias legado
    'poligono-geometrico': () => import('./poligono_geometrico.js'),
    'trasvase-ecologico': () => import('./trasvase_ecologico.js'),
    'balanza-logica': () => import('./balanza_logica.js'),
    'anillas-encadenadas': () => import('./anillas.js'),    // ✅ NUEVA PLANTILLA
    'cajas-apiladas': () => import('./cajas.js'),            // ✅ NUEVA PLANTILLA
    'nonograma': () => import('./nonograma.js'),             // ✅ NUEVA PLANTILLA
    'laser-espejos': () => import('./laser.js'),               // ✅ NUEVA PLANTILLA
    'laser-triangular': () => import('./laser_triangular.js'), // ✅ NUEVA PLANTILLA
    'puentes-hashi': () => import('./hashi.js')                 // ✅ NUEVA PLANTILLA
  };

  // --- Función principal para renderizar plantillas ---
  async function render(tipo, data, container, hooks) {
    // Si no existe el tipo, mostrar mensaje de error en pantalla
    if (!loaders[tipo]) {
      container.innerHTML = `
        <div style="padding:1rem;color:#ff6b6b;">
          ⚠️ <strong>Plantilla no encontrada:</strong> <code>${tipo}</code>
        </div>`;
      return;
    }

    try {
      // Cargar módulo dinámicamente
      const mod = await loaders[tipo]();

      // Verificar que exporta una función render()
      if (typeof mod.render !== 'function') {
        container.innerHTML = `
          <div style="padding:1rem;color:#ffb347;">
            ⚠️ La plantilla <code>${tipo}</code> no exporta <code>render()</code>
          </div>`;
        return;
      }

      // Ejecutar render() de la plantilla
      await mod.render(container, data, hooks || {});

    } catch (error) {
      console.error('❌ Error cargando plantilla:', error);
      container.innerHTML = `
        <div style="padding:1rem;color:#ff6b6b;">
          ⚠️ Error al cargar la plantilla <code>${tipo}</code>: ${error.message}
        </div>`;
    }
  }

  // Devolver interfaz pública
  return { render };

})();
