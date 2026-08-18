(function(){
  document.querySelectorAll('#year').forEach(e=>e.textContent=new Date().getFullYear());
  const cont=document.getElementById('lista-retos');
  const chipsCont=document.getElementById('filtro-categorias');

  function difficultyDots(dificultad){
    if(!dificultad) return '';
    const total=5;
    let dots='';
    for(let i=1;i<=total;i++) dots += i<=dificultad ? '●' : '○';
    return `<span class="difficulty-dots" title="Dificultad ${dificultad}/5">${dots}</span>`;
  }

  function renderGrid(lista, categoriaActiva){
    cont.innerHTML='';
    const filtrada = categoriaActiva
      ? lista.filter(it => Array.isArray(it.categorias) && it.categorias.includes(categoriaActiva))
      : lista;

    if(!filtrada.length){ cont.innerHTML='<p>No hay retos en esta categoría todavía.</p>'; return; }

    for(const it of filtrada){
      const a=document.createElement('a');
      a.className = 'card reto-card';
      a.href=`index.html?fecha=${encodeURIComponent(it.fecha)}`; // progressive enhancement
      a.dataset.rutaFecha = it.fecha;                            // SPA router intercept
      const h3=document.createElement('h3'); h3.textContent=it.titulo;
      const small=document.createElement('small'); small.textContent=it.fecha;
      a.appendChild(h3);
      if(it.dificultad) a.insertAdjacentHTML('beforeend', difficultyDots(it.dificultad));
      a.appendChild(small);
      cont.appendChild(a);
    }
  }

  function renderChips(lista){
    const categorias = new Set();
    lista.forEach(it => { if(Array.isArray(it.categorias)) it.categorias.forEach(c => categorias.add(c)); });

    if(!categorias.size){ chipsCont.style.display='none'; return; }

    let activa = null;
    const chips = [{ id:null, label:'Todos' }, ...[...categorias].sort().map(c => ({ id:c, label:c }))];

    function paint(){
      chipsCont.innerHTML='';
      chips.forEach(chip => {
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='category-chip' + (chip.id===activa ? ' is-active' : '');
        btn.textContent=chip.label;
        btn.addEventListener('click', () => { activa = chip.id; paint(); renderGrid(lista, activa); });
        chipsCont.appendChild(btn);
      });
    }
    paint();
  }

  fetch('lista_retos.json',{cache:'no-cache'})
  .then(r=>r.ok?r.json():[])
  .then(lista=>{
    if(!Array.isArray(lista)||!lista.length){ cont.innerHTML='<p>Aún no hay retos publicados.</p>'; return; }
    lista.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    renderChips(lista);
    renderGrid(lista, null);
  }).catch(()=> cont.innerHTML='<p>Error al cargar el archivo de retos.</p>');
})();
