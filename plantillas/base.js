
// plantillas/base.js (modular)
window.Templates = (function(){
  const loaders = {
    'multiple': () => import('./multiple.js'),
    'relojes-arena': () => import('./relojes_arena.js'),
    'trasvase-ecologico': () => import('./trasvase_ecologico.js'),
  };

  async function render(tipo, data, container, hooks){
    if(!loaders[tipo]){
      container.innerHTML = `<p>Plantilla no encontrada: <code>${tipo}</code></p>`;
      return;
    }
    const mod = await loaders[tipo]();
    if(typeof mod.render !== 'function'){
      container.innerHTML = `<p>La plantilla <code>${tipo}</code> no expone render()</p>`;
      return;
    }
    await mod.render(container, data, hooks || {});
  }

  return { render };
})();
