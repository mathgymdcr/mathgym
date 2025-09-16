(function(){
  const log = (msg, ok) => {
    const li = document.createElement('li');
    li.textContent = (ok? '✅ ':'❌ ') + msg;
    li.className = ok? 'ok':'ko';
    document.getElementById('checks').appendChild(li);
  };
  const $ = (id)=>document.getElementById(id);

  async function head(url){
    try{
      const r = await fetch(url, { method:'GET', cache:'no-cache' });
      return r.ok;
    }catch(_){ return false; }
  }

  async function run(){
    $('baseurl').textContent = location.href.replace(/#.*/,'');

    const list = [
      'script.js',
      'router.js',
      'plantillas/base.js',
      'plantillas/enigma_einstein.js',
      'data/enigma_2025-09-15.json',
      'reto.json',
      'assets/logo-placeholder.svg'
    ];

    for(const p of list){
      const ok = await head(p);
      log(p + ' → ' + (ok? '200':'404'), ok);
    }

    // Try dynamic import of base.js
    let baseOk=false;
    try{ await import('./plantillas/base.js'); baseOk=true; log('import(plantillas/base.js)', true);}catch(e){ log('import(plantillas/base.js) '+e, false); }

    // Try rendering Enigma directly
    if(baseOk){
      try{
        const host = $('demo');
        host.innerHTML = '<div class="box">Cargando demo enigma…</div>';
        await window.Templates.render('enigma-einstein', { json_url: 'data/enigma_2025-09-15.json' }, host, {});
        log('Templates.render(enigma-einstein) ejecutado', true);
      }catch(e){ log('Templates.render(enigma-einstein) '+e, false); }
    }
  }

  run();
})();
