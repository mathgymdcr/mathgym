// ===== router.js =====
// Decide qué se ve según la URL, y es el único sitio donde se decide:
//
//   ?fecha=YYYY-MM-DD  un reto del archivo
//   ?tipo=nonograma    el ejemplo de prueba de ese tipo
//   (sin nada)         la sala de entrenamiento
//
// Antes esta lectura estaba repartida entre el router y el arranque de
// script.js, y había que acordarse de tocar los dos.
export function initRouter({ mostrarSala, mostrarReto, mostrarEjemplo }) {
  async function render({ fecha, tipo }) {
    try {
      if (tipo) {
        await mostrarEjemplo(tipo);
      } else if (fecha) {
        await mostrarReto(fecha);
      } else {
        await mostrarSala();
      }
    } catch (err) {
      const cont = document.getElementById('contenedor-interactivo');
      if (cont) {
        cont.innerHTML = `<div class="error">⚠️ No se pudo cargar<br>${err.message}</div>`;
      }
      console.error('Router error:', err);
    }
  }

  function leerURL() {
    const params = new URLSearchParams(window.location.search);
    return { fecha: params.get('fecha'), tipo: params.get('tipo') };
  }

  function renderCurrent() {
    return render(leerURL());
  }

  // Navega sin recargar. `params` vacío vuelve a la sala. Pinta con lo que se
  // le pasa en vez de releer la URL que acaba de escribir: releerla obligaría
  // a confiar en que el entorno ya la ha actualizado.
  function navigateTo(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString();
    history.pushState({}, '', query ? `?${query}` : './');
    return render(params);
  }

  window.addEventListener('popstate', renderCurrent);

  return { renderCurrent, navigateTo };
}
