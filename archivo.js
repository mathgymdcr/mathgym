
document.addEventListener('DOMContentLoaded', ()=>{
  const yearEls = document.querySelectorAll('#year'); yearEls.forEach(e=>e.textContent=new Date().getFullYear());
  const cont = document.getElementById('lista-retos');
  fetch('lista_retos.json',{cache:'no-cache'}).then(r=>r.ok?r.json():[]).then(lista=>{
    if(!Array.isArray(lista) || lista.length===0){ cont.innerHTML='<p>Aún no hay retos publicados.</p>'; return; }
    const ul = document.createElement('ul');
    lista.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    for(const r of lista){
      const li=document.createElement('li'); const a=document.createElement('a');
      a.href = `index.html?fecha=${encodeURIComponent(r.fecha)}`; a.textContent = `📅 ${r.fecha} — ${r.titulo}`;
      li.appendChild(a); ul.appendChild(li);
    }
    cont.innerHTML=''; cont.appendChild(ul);
  }).catch(()=> cont.innerHTML='<p>Error al cargar el archivo de retos.</p>');
});
