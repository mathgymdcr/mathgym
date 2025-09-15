
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const nowY = new Date().getFullYear();
  document.querySelectorAll('#year').forEach(el => el.textContent = nowY);

  const frases = {
    feliz: ["¡A por todas!","Hoy te veo con energía.","Este reto es para ti.","¡Vamos con el de hoy!"],
    pensando: ["Piensa cada paso.","Busca el patrón.","No te precipites, analiza."],
    sorprendido: ["¡Qué crack!","¡Movimiento top!","¡Gracias por tu voto!"]
  };
  function speak(msg=null, estado='feliz'){
    const b = $('deceerre-bubble'); if(!b) return;
    const t = msg || frases[estado][Math.floor(Math.random()*frases[estado].length)];
    b.innerHTML = `<strong>¡Vamos!</strong><span>${t}</span>`;
  }

  function montarEstrellas(container){
    if(!container) return; container.innerHTML='';
    const max=5; for(let i=1;i<=max;i++){
      const b=document.createElement('button'); b.type='button';
      b.setAttribute('aria-label',`Valorar ${i} de ${max}`);
      b.setAttribute('aria-pressed','false'); b.textContent='★';
      b.addEventListener('click',()=>{
        [...container.children].forEach((x,idx)=>x.setAttribute('aria-pressed', idx < i ? 'true':'false'));
        localStorage.setItem('valoracion-hoy', String(i));
        speak('¡Gracias por tu voto!', 'sorprendido');
      });
      container.appendChild(b);
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    const params = new URLSearchParams(location.search);
    const fechaParam = params.get('fecha');
    const ruta = fechaParam ? `retos/${encodeURIComponent(fechaParam)}.json` : 'reto.json';
    montarEstrellas(document.getElementById('sistema-valoracion'));
    speak(null, fechaParam ? 'pensando' : 'feliz');

    try{
      const r = await fetch(ruta, { cache:'no-cache' }); if(!r.ok) throw new Error('HTTP '+r.status);
      const reto = await r.json();
      document.getElementById('titulo-reto').textContent = reto.titulo || 'Reto del día';
      document.getElementById('sub-reto').textContent = fechaParam ? 'Reto del archivo' : 'Entrena tu razonamiento hoy';
      const img = document.getElementById('imagen-reto');
      img.src = reto.icono_url || 'assets/icono-generico.svg';
      img.alt = `Icono del reto: ${reto.titulo || 'Reto del día'}`;
      document.getElementById('objetivo-reto').innerHTML = `<p>${reto.objetivo || ''}</p>`;

      // Interactivo por plantilla
      if(reto.tipo){
        const sec = document.getElementById('reto-interactivo');
        const cont = document.getElementById('contenedor-interactivo');
        sec.hidden = false; cont.innerHTML = '<div class="template-box"><span class="badge">Cargando plantilla…</span></div>';
        if(window.Templates && typeof window.Templates.render === 'function'){
          window.Templates.render(reto.tipo, reto.data || {}, cont, {
            onSuccess: ()=>{
              cont.classList.add('template-success');
              setTimeout(()=>cont.classList.remove('template-success'), 1200);
              speak('¡Objetivo conseguido!', 'sorprendido');
            },
            onHint: (msg)=> speak(msg || 'Pista activada', 'pensando')
          }).catch(err=>{
            console.error('Plantilla falló:', err); cont.innerHTML = '<p>No se pudo cargar la plantilla.</p>';
          });
        } else {
          cont.innerHTML = '<p>Plantillas no disponibles.</p>';
        }
      }

      // Compartir
      const actual = `${location.origin}${location.pathname}${location.search}`;
      const enc = encodeURIComponent;
      const text = enc(`🧠 Reto de MathGym: "${reto.titulo || ''}"`);
      const url = enc(actual);
      const tw = document.getElementById('share-twitter');
      const wa = document.getElementById('share-whatsapp');
      if(tw) tw.href = `https://x.com/intent/post?text=${text}&url=${url}`;
      if(wa) wa.href = `https://wa.me/?text=${text}%20${url}`;
    }catch(e){
      console.error(e);
      document.getElementById('titulo-reto').textContent = 'No se pudo cargar el reto';
      document.getElementById('objetivo-reto').innerHTML = '<p>Inténtalo más tarde.</p>';
    }
  });
})();
