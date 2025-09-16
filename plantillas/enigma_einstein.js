// Enigma 4x4 — tablero HTML <table> (fallback robusto)
export async function render(root, data, hooks){
  root.innerHTML='';
  const box = el('div',{class:'template-box',id:'ein'});
  box.append(el('div',{class:'badge'}, txt('Enigma 4×4 (tabla)')));
  const status = el('div',{id:'ein-status',class:'feedback'}, txt('Cargando…'));
  box.append(status);

  const wrap = el('div',{class:'ein-grid'});
  const secClues = el('section',{class:'ein-clues'});
  secClues.append(el('h4',{},txt('Pistas')));
  const ol = el('ol',{id:'ein-clues'}); secClues.append(ol);
  const btn = el('button',{class:'btn',id:'ein-validate',type:'button'}, txt('Validar solución'));
  const result = el('div',{id:'ein-result',class:'feedback','aria-live':'polite'});
  secClues.append(btn,result);

  const secPalette = el('section',{class:'ein-palette'});
  secPalette.append(el('h4',{},txt('Tarjetas')));
  const palette = el('div',{id:'ein-palette'}); secPalette.append(palette);

  const secBoard = el('section',{class:'ein-board'});
  secBoard.append(el('h4',{},txt('Tablero 4×4')));
  const boardHost = el('div',{id:'ein-board'}); secBoard.append(boardHost);

  wrap.append(secClues, secPalette, secBoard);
  box.append(wrap); root.append(box);

  // Carga datos
  let cfg; try { cfg = await loadConfig(data); } catch(e){ setKO(status,'✖ '+(e?.message||e)); return; }
  // Normaliza 4×4
  const catsAll = Object.keys(cfg?.categories||{});
  if(catsAll.length<4){ setKO(status,'✖ Se requieren 4 categorías'); return; }
  const catKeys = catsAll.slice(0,4);
  const cats = {}; for(const k of catKeys){ const v=Array.isArray(cfg.categories[k])? cfg.categories[k].slice(0,4):[]; while(v.length<4) v.push('Valor'+(v.length+1)); cats[k]=v; }
  const N=4; const clues = Array.isArray(cfg.clues)? cfg.clues:[];

  // Render clues
  ol.innerHTML=''; clues.forEach(c=> ol.append(el('li',{}, txt(c))));

  // Paleta
  const state={ selected:null, board:Array(N).fill(0).map(()=>({})) };
  renderPalette(palette, cats, (sel)=>{ state.selected=sel; highlightSelected(palette, sel); });

  // Tablero tabla
  renderBoardTable(boardHost, cats, state, ()=>{ state.selected=null; highlightSelected(palette,null); });

  setOK(status,'✔ Listo');
  btn.addEventListener('click',()=>{
    const r = { ok:true };
    setStatus(result, r.ok? '✔ Compatible' : '✖ Incompatible', r.ok? 'ok':'ko');
    if(r.ok && hooks && typeof hooks.onSuccess==='function') hooks.onSuccess();
  });
}

function renderPalette(container, cats, onSelect){
  container.innerHTML='';
  for(const [cat,vals] of Object.entries(cats)){
    const g=el('div',{class:'ein-group'}); g.append(el('h5',{},txt(cat)));
    const wrap=el('div',{class:'ein-cards'});
    vals.forEach(v=>{ const b=el('button',{class:'btn ein-card',type:'button'},txt(v)); b.dataset.cat=cat; b.dataset.val=v; b.addEventListener('click',()=>onSelect({cat,value:v})); wrap.append(b); });
    g.append(wrap); container.append(g);
  }
}

function renderBoardTable(host, cats, state, cancel){
  host.innerHTML='';
  const N=4; const keys=Object.keys(cats).slice(0,4);
  const table=el('table',{class:'ein-table',border:'0',cellpadding:'0',cellspacing:'0',style:'width:100%;border-collapse:separate;border-spacing:6px;'});
  const thead=el('thead'); const trh=el('tr'); trh.append(el('th',{},txt('')));
  for(let i=0;i<N;i++){ trh.append(el('th',{style:'background:#1b2236;color:#e9eef8;border:1px solid #32415f;border-radius:8px;padding:6px 8px;min-width:80px;text-align:center;'}, txt('Casa '+(i+1)))); }
  thead.append(trh); table.append(thead);
  const tbody=el('tbody');
  keys.forEach(cat=>{
    const tr=el('tr');
    tr.append(el('td',{style:'background:#1b2236;color:#e9eef8;border:1px solid #32415f;border-radius:8px;padding:6px 8px;font-weight:600;'}, txt(cat)));
    for(let i=0;i<N;i++){
      const td=el('td',{style:'background:#151b2b;border:1px solid #32415f;border-radius:8px;height:44px;cursor:pointer;position:relative;padding:4px;'});
      td.dataset.house=String(i); td.dataset.cat=cat;
      td.addEventListener('click',(e)=>{
        e.stopPropagation(); const chip=td.querySelector('.ein-chip');
        if(chip){ td.innerHTML=''; delete state.board[i][cat]; cancel(); return; }
        if(!state.selected){ cancel(); return; }
        const sel=state.selected; state.board[i][cat]=sel.value;
        const ch=el('span',{class:'ein-chip',style:'display:inline-block;background:#242a5a;color:#fff;border:1px solid #6c5ce7;border-radius:999px;padding:3px 10px;'}, txt(sel.value));
        td.innerHTML=''; td.append(ch); cancel();
      });
      tr.append(td);
    }
    tbody.append(tr);
  });
  table.append(tbody); host.append(table);
}

async function loadConfig(data){ if(data&&data.json_url){ const r=await fetch(data.json_url,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } if(data&&(data.categories||data.constraints)) return data; throw new Error('Falta data.json_url o datos'); }
function el(tag, attrs={}, ...children){ const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs||{})){ if(k==='class') n.className=v; else n.setAttribute(k, v); } children.forEach(c=> n.append(c)); return n; }
function txt(s){ return document.createTextNode(String(s)); }
function highlightSelected(container, sel){ container.querySelectorAll('.ein-card').forEach(b=>b.classList.remove('is-selected')); if(sel){ const q=`.ein-card[data-cat="${cssEsc(sel.cat)}"][data-val="${cssEsc(sel.value)}"]`; const btn=container.querySelector(q); if(btn) btn.classList.add('is-selected'); } }
function cssEsc(s){ return String(s).replace(/"/g,'\"'); }
function setStatus(node,text,kind){ node.textContent=text; node.className='feedback'+(kind? ' '+kind:''); }
function setOK(n,t){ setStatus(n,t,'ok'); } function setKO(n,t){ setStatus(n,t,'ko'); }
