// plantillas/base.js — Loader
window.Templates=(function(){
  const loaders={
    'enigma-einstein':()=>import('./enigma_einstein.js'),
    'relojes-arena':()=>import('./relojes_arena.js'),
    'jarras-exactas':()=>import('./jarras_exactas.js'),
    'plantas':()=>import('./plantas.js')
  };
  async function render(tipo,data,container,hooks){
    if(!loaders[tipo]){container.innerHTML=`<p>Plantilla no encontrada: <code>${tipo}</code></p>`;return;}
    const mod=await loaders[tipo]();
    if(typeof mod.render!=='function'){container.innerHTML=`<p>La plantilla <code>${tipo}</code> no expone render()</p>`;return;}
    await mod.render(container,data,hooks||{});
  }
  return { render };
})();
