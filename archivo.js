(function(){
  document.querySelectorAll('#year').forEach(e=>e.textContent=new Date().getFullYear());
  const cont=document.getElementById('lista-retos');
  const chipsCont=document.getElementById('filtro-categorias');
  const contador=document.getElementById('archive-count');

  // Mismo componente que la ficha de tipo en la sala (home.js): un grupo de
  // puntos, el "on" en dorado para lo cubierto.
  function difficultyDots(dificultad){
    if(!dificultad) return null;
    const dots=document.createElement('span');
    dots.className='difficulty-dots';
    dots.title=`Dificultad ${dificultad}/5`;
    for(let i=1;i<=5;i++){
      const punto=document.createElement('span');
      if(i<=dificultad) punto.className='on';
      dots.appendChild(punto);
    }
    return dots;
  }

  function renderGrid(lista, categoriaActiva){
    cont.innerHTML='';
    const filtrada = categoriaActiva
      ? lista.filter(it => Array.isArray(it.categorias) && it.categorias.includes(categoriaActiva))
      : lista;

    if(!filtrada.length){
      cont.innerHTML='<p class="archive-empty">No hay retos en esta categoría todavía.</p>';
      return;
    }

    for(const it of filtrada){
      const a=document.createElement('a');
      a.className='exercise';
      a.href=`index.html?fecha=${encodeURIComponent(it.fecha)}`;
      const nombre=document.createElement('div');
      nombre.className='exercise-name';
      nombre.textContent=it.titulo;
      a.appendChild(nombre);
      const pista=document.createElement('div');
      pista.className='exercise-hint';
      pista.textContent=it.fecha;
      a.appendChild(pista);
      const dots=difficultyDots(it.dificultad);
      if(dots) a.appendChild(dots);
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
        btn.className='archive-chip' + (chip.id===activa ? ' is-active' : '');
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
    if(!Array.isArray(lista)||!lista.length){
      cont.innerHTML='<p class="archive-empty">Aún no hay retos publicados.</p>';
      return;
    }
    // Del más reciente al más antiguo.
    lista.sort((a,b)=>b.fecha.localeCompare(a.fecha));
    contador.textContent = `${lista.length} reto${lista.length===1?'':'s'} publicado${lista.length===1?'':'s'}, del más reciente al más antiguo`;
    renderChips(lista);
    renderGrid(lista, null);
  }).catch(()=>{ cont.innerHTML='<p class="archive-empty">Error al cargar el archivo de retos.</p>'; });
})();
