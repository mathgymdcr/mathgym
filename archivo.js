(function(){
  document.querySelectorAll('#year').forEach(e=>e.textContent=new Date().getFullYear());
  const cont=document.getElementById('lista-retos');
  fetch('lista_retos.json',{cache:'no-cache'})
  .then(r=>r.ok?r.json():[])
  .then(lista=>{
    if(!Array.isArray(lista)||!lista.length){ cont.innerHTML='<p>Aún no hay retos publicados.</p>'; return; }
    lista.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    cont.innerHTML='';
    for(const it of lista){
      const a=document.createElement('a');
      a.className = 'card reto-card';
      a.href=`index.html?fecha=${encodeURIComponent(it.fecha)}`; // progressive enhancement
      a.dataset.rutaFecha = it.fecha;                            // SPA router intercept
      const h3=document.createElement('h3'); h3.textContent=it.titulo;
      const small=document.createElement('small'); small.textContent=it.fecha;
      a.appendChild(h3); a.appendChild(small);
      cont.appendChild(a);
    }
  }).catch(()=> cont.innerHTML='<p>Error al cargar el archivo de retos.</p>');
})();
