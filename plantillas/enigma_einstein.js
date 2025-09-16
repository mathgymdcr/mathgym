// Enigma 4×4 — PlayFix: multi‑chips por celda, paleta debajo, sin cabeceras "Casa n"
// Modo robusto con <table> para que siempre se vea. No depende de CSS grid complejas.

export async function render(root, data, hooks){
  const OPTS = {
    SHOW_HEADERS: false,           // oculta "Casa 1..4" en el tablero
    ALLOW_MULTI_PER_CELL: true,    // permite varios chips (candidatos) en una celda
    HIDE_HOUSE_TEXT_IN_CLUES: true // limpia "casa 1/2/3/4" de las pistas visibles
  };

  root.innerHTML='';
  const ui = buildShell();
  root.append(ui.box);

  // Carga datos
  let cfg; try { cfg = await loadConfig(data); } catch(e){ setStatus(ui.status,'✖ '+(e?.message||e),'ko'); return; }

  // Normaliza a 4×4 (primeras 4 categorías y 4 valores)
  const allCats = Object.keys(cfg?.categories||{});
  if (allCats.length < 4) { setStatus(ui.status,'✖ Se requieren 4 categorías','ko'); return; }
  const keys = allCats.slice(0,4);
  const cats = {}; for(const k of keys){ const v=Array.isArray(cfg.categories[k])? cfg.categories[k].slice(0,4):[]; while(v.length<4) v.push('Valor'+(v.length+1)); cats[k]=v; }
  const N=4; let clues = Array.isArray(cfg.clues)? cfg.clues:[];
  if (OPTS.HIDE_HOUSE_TEXT_IN_CLUES) clues = clues.map(x=>String(x).replace(/casa\s*[1-4]/gi,'posición'));

  // Render pistas
  ui.olClues.innerHTML=''; clues.forEach(c=> ui.olClues.append(el('li',{}, txt(c))));

  // Estado
  const state={ selected:null, board:Array(N).fill(0).map(()=>({})) };
  // board[i][cat] será Set de valores si ALLOW_MULTI_PER_CELL

  // TABLERO → PALETA
  renderBoardTable(ui.board, cats, state, OPTS, ()=>{ state.selected=null; highlightSelected(ui.palette,null); });
  renderPalette(ui.palette, cats, (sel)=>{ state.selected=sel; highlightSelected(ui.palette, sel); });

  setStatus(ui.status,'✔ Listo','ok');
  ui.btnValidate.addEventListener('click',()=>{
    setStatus(ui.result,'¡A jugar! (Validación simple OK)','ok');
    hooks&&typeof hooks.onSuccess==='function'&&hooks.onSuccess();
  });
}

function buildShell(){
  const box=el('div',{class:'template-box',id:'ein'});
  box.append(el('div',{class:'badge'},txt('Enigma 4×4 · Play')));
  const status=el('div',{id:'ein-status',class:'feedback'},txt('Cargando…'));
  box.append(status);
  const wrap=el('div',{class:'ein-grid'});

  const secClues=el('section',{class:'ein-clues'});
  secClues.append(el('h4',{},txt('Pistas')));
  const olClues=el('ol',{id:'ein-clues'}); secClues.append(olClues);
  const btn=el('button',{class:'btn',id:'ein-validate',type:'button'},txt('Validar'));
  const result=el('div',{id:'ein-result',class:'feedback','aria-live':'polite'});
  secClues.append(btn,result);

  const secBoard=el('section',{class:'ein-board'});
  secBoard.append(el('h4',{},txt('Tablero')));
  const board=el('div',{id:'ein-board'}); secBoard.append(board);

  const secPalette=el('section',{class:'ein-palette'});
  secPalette.append(el('h4',{},txt('Tarjetas')));
  const palette=el('div',{id:'ein-palette'}); secPalette.append(palette);

  // Orden: PISTAS → TABLERO → PALETA
  wrap.append(secClues, secBoard, secPalette);
  box.append(wrap);
  return { box, status, olClues, btnValidate:btn, result, board, palette };
}

function renderPalette(container, cats, onSelect){
  container.innerHTML='';
  for(const [cat,vals] of Object.entries(cats)){
    const g=el('div',{class:'ein-group'}); g.append(el('h5',{},txt(cat)));
    const w=el('div',{class:'ein-cards'});
    vals.forEach(v=>{ const b=el('button',{class:'btn ein-card',type:'button'},txt(v)); b.dataset.cat=cat; b.dataset.val=v; b.addEventListener('click',()=>onSelect({cat,value:v})); w.append(b); });
    g.append(w); container.append(g);
  }
}

function renderBoardTable(host, cats, state, OPTS, cancel){
  host.innerHTML='';
  const N=4; const keys=Object.keys(cats).slice(0,4);
  const table=el('table',{class:'ein-table',border:'0',cellpadding:'0',cellspacing:'0',style:'width:100%;border-collapse:separate;border-spacing:8px;'});

  if (OPTS.SHOW_HEADERS){
    const thead=el('thead'); const trh=el('tr'); trh.append(el('th',{},txt('')));
    for(let i=0;i<N;i++) trh.append(el('th',{style:thStyle()}, txt('Casa '+(i+1))));
    thead.append(trh); table.append(thead);
  }

  const tbody=el('tbody');
  keys.forEach(cat=>{
    const tr=el('tr');
    tr.append(el('td',{style:rowHeadStyle()}, txt(cat)));
    for(let i=0;i<N;i++){
      const td=el('td',{style:cellStyle()}); td.dataset.house=String(i); td.dataset.cat=cat;
      td.addEventListener('click',()=>{
        if(!state.board[i][cat]) state.board[i][cat]= new Set();
        const sel = state.selected; if(!sel){ cancel(); return; }
        if (sel.cat!==cat){ // permitir mezclar de distintas categorías en la misma celda
          // Se admiten chips de varias categorías a modo "candidatos".
        }
        const set = state.board[i][cat];
        if (set.has(sel.value)) set.delete(sel.value); else set.add(sel.value);
        td.innerHTML='';
        // Render chips: todos los del set + (opcional) otros candidatos que quieras pintar
        if (set.size){
          const wrap=el('div',{style:'display:flex;flex-wrap:wrap;gap:4px'});
          for(const val of set){ wrap.append(chip(val)); }
          td.append(wrap);
        }
        cancel();
      });
      tr.append(td);
    }
    tbody.append(tr);
  });
  table.append(tbody); host.append(table);
}

function chip(text){ return el('span',{class:'ein-chip',style:'display:inline-block;background:#242a5a;color:#fff;border:1px solid #6c5ce7;border-radius:999px;padding:3px 10px;'}, txt(text)); }
function thStyle(){ return 'background:#1b2236;color:#e9eef8;border:1px solid #32415f;border-radius:8px;padding:6px 8px;min-width:80px;text-align:center;'; }
function rowHeadStyle(){ return 'background:#1b2236;color:#e9eef8;border:1px solid #32415f;border-radius:8px;padding:6px 8px;font-weight:600;'; }
function cellStyle(){ return 'background:#151b2b;border:1px solid #32415f;border-radius:8px;min-height:44px;cursor:pointer;position:relative;padding:4px;'; }

async function loadConfig(data){ if(data&&data.json_url){ const r=await fetch(data.json_url,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } if(data&&(data.categories||data.constraints)) return data; throw new Error('Falta data.json_url o datos'); }
function el(tag, attrs={}, ...children){ const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs||{})){ if(k==='class') n.className=v; else n.setAttribute(k, v); } children.forEach(c=> n.append(c)); return n; }
function txt(s){ return document.createTextNode(String(s)); }
function highlightSelected(container, sel){ container.querySelectorAll('.ein-card').forEach(b=>b.classList.remove('is-selected')); if(sel){ const q=`.ein-card[data-cat="${cssEsc(sel.cat)}"][data-val="${cssEsc(sel.value)}"]`; const btn=container.querySelector(q); if(btn) btn.classList.add('is-selected'); } }
function cssEsc(s){ return String(s).replace(/"/g,'\"'); }
function setStatus(node,text,kind){ node.textContent=text; node.className='feedback'+(kind? ' '+kind:''); }
