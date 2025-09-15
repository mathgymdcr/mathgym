(function(){
  document.querySelectorAll('#year').forEach(e=>e.textContent=new Date().getFullYear());
  const cont=document.getElementById('lista-retos');
  fetch('lista_retos.json',{cache:'no-cache'})
  .then(r=>r.ok?r.json():[])
  .then(lista=>{
    if(!Array.isArray(lista)||!lista.length){ cont.innerHTML='<p>Aún no hay retos publicados.</p>'; return; }
    const ul=document.createElement('ul');
    lista.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    for(const it of lista){
      const li=document.createElement('li');
      const a=document.createElement('a');
      a.href=`index.html?fecha=${encodeURIComponent(it.fecha)}`; // progressive enhancement
      a.dataset.rutaFecha = it.fecha;                            // SPA router intercept
      a.textContent = it.fecha + ' — ' + it.titulo;
      li.appendChild(a); ul.appendChild(li);
    }
    cont.innerHTML=''; cont.appendChild(ul);
  }).catch(()=> cont.innerHTML='<p>Error al cargar el archivo de retos.</p>');
})();
