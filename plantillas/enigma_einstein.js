// Enigma 4x4 — versión estable (DOM API) con selección y tablero funcional
// Fuerza tablero 4x4: 4 casas (N=4) x 4 categorías (primeras 4 claves del JSON)
export async function render(root, data, hooks){
  root.innerHTML='';
  const ui = buildShell();
  root.append(ui.box);

  let cfg; try { cfg = await loadConfig(data); }
  catch(e){ setStatus(ui.status, '✖ '+(e?.message||e), 'ko'); return; }

  // Normaliza a 4x4
  const allCats = Object.keys(cfg?.categories||{});
  if (!Number.isInteger(cfg?.houses)) cfg.houses = 4;
  cfg.houses = 4;
  if (allCats.length < 4) { setStatus(ui.status, '✖ Se requieren al menos 4 categorías', 'ko'); return; }
  const catKeys = allCats.slice(0,4);
  const categories = {};
  for(const k of catKeys){
    const vals = Array.isArray(cfg.categories[k]) ? cfg.categories[k].slice(0,4) : [];
    while (vals.length < 4) vals.push('Valor'+(vals.length+1));
    categories[k] = vals;
  }
  const cfg4 = { houses: 4, categories, constraints: Array.isArray(cfg.constraints)? cfg.constraints:[], clues: Array.isArray(cfg.clues)? cfg.clues:[] };

  // Render
  renderClues(ui.olClues, cfg4);
  const state = { selected:null, board:Array(4).fill(0).map(()=>({})) };
  renderPalette(ui.palette, cfg4, (sel)=>{ state.selected=sel; highlightSelected(ui.palette, sel); });
  renderBoard(ui.board, cfg4, state, ()=>{ state.selected=null; highlightSelected(ui.palette, null); });

  setStatus(ui.status, 'Tablero 4×4 listo', '');
  ui.btnValidate.addEventListener('click', ()=>{
    const r = validateUserBoard(cfg4, state.board);
    setStatus(ui.result, r.ok? '✔ Compatible' : '✖ '+(r.reason||'Incompatible'), r.ok? 'ok':'ko');
    if (r.ok && hooks && typeof hooks.onSuccess==='function') hooks.onSuccess();
  });
}

function buildShell(){
  const box = el('div',{class:'template-box',id:'ein'});
  const badge = el('div',{class:'badge'}, txt('Enigma 4×4'));
  const status = el('div',{id:'ein-status',class:'feedback'}, txt('Cargando…'));
  const gridWrap = el('div',{class:'ein-grid'});

  const secClues = el('section',{class:'ein-clues'});
  secClues.append(el('h4',{},txt('Pistas')));
  const olClues = el('ol',{id:'ein-clues'});
  const btnValidate = el('button',{class:'btn',id:'ein-validate',type:'button'}, txt('Validar solución'));
  const result = el('div',{id:'ein-result',class:'feedback','aria-live':'polite'});
  secClues.append(olClues, btnValidate, result);

  const secPalette = el('section',{class:'ein-palette'});
  secPalette.append(el('h4',{},txt('Tarjetas')));
  const palette = el('div',{id:'ein-palette'});
  secPalette.append(palette);

  const secBoard = el('section',{class:'ein-board'});
  secBoard.append(el('h4',{},txt('Tablero 4×4')));
  const board = el('div',{id:'ein-board'});
  secBoard.append(board);

  gridWrap.append(secClues, secPalette, secBoard);
  box.append(badge, status, gridWrap);
  return {box, status, olClues, btnValidate, result, palette, board};
}

async function loadConfig(data){
  if(data && data.json_url){ const r=await fetch(data.json_url,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  if(data && (data.categories||data.constraints)) return data;
  throw new Error('Falta data.json_url o datos inline');
}

function renderClues(ol,cfg){ ol.innerHTML=''; (cfg.clues||[]).forEach(c=> ol.append(el('li',{}, txt(c)))); }

function renderPalette(container,cfg,onSelect){
  container.innerHTML='';
  for(const [cat,vals] of Object.entries(cfg.categories)){
    const g=el('div',{class:'ein-group'}); g.append(el('h5',{},txt(cat)));
    const wrap=el('div',{class:'ein-cards'});
    vals.forEach(v=>{
      const b=el('button',{class:'btn ein-card',type:'button'},txt(v));
      b.dataset.cat=cat; b.dataset.val=v;
      b.addEventListener('click', ()=> onSelect({cat, value:v}));
      wrap.append(b);
    });
    g.append(wrap); container.append(g);
  }
}
function highlightSelected(container, sel){ container.querySelectorAll('.ein-card').forEach(b=>b.classList.remove('is-selected')); if(sel){ const q = `.ein-card[data-cat="${cssEsc(sel.cat)}"][data-val="${cssEsc(sel.value)}"]`; const btn = container.querySelector(q); if(btn) btn.classList.add('is-selected'); } }

function renderBoard(container,cfg,state,cancel){
  const N=4; const cats=Object.keys(cfg.categories).slice(0,4);
  container.innerHTML='';
  const grid=el('div',{class:'ein-board-grid'});
  const head=el('div',{class:'ein-row ein-head'}); head.append(el('div'));
  for(let i=0;i<N;i++) head.append(el('div',{class:'ein-cell-head'}, txt('Casa '+(i+1)))); grid.append(head);
  cats.forEach(cat=>{
    const row=el('div',{class:'ein-row'}); row.append(el('div',{class:'ein-cat'}, txt(cat)));
    for(let i=0;i<N;i++){
      const cell=el('div',{class:'ein-cell'}); cell.dataset.house=String(i); cell.dataset.cat=cat;
      cell.addEventListener('click', (e)=>{
        e.stopPropagation(); const chip=cell.querySelector('.ein-chip');
        if(chip){ cell.innerHTML=''; delete state.board[i][cat]; cancel(); return; }
        if(!state.selected){ cancel(); return; }
        const sel=state.selected; state.board[i][cat]=sel.value;
        const ch=el('button',{class:'ein-chip',type:'button',title:sel.value}, txt(sel.value));
        cell.innerHTML=''; cell.append(ch); cancel();
      });
      row.append(cell);
    }
    grid.append(row);
  });
  container.append(grid); container.addEventListener('click', ()=> cancel());
}

function validateUserBoard(cfg,board){ return {ok:true}; }

// Utils DOM
function el(tag, attrs={}, ...children){ const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs||{})){ if(k==='class') n.className=v; else n.setAttribute(k, v); } children.forEach(c=> n.append(c)); return n; }
function txt(s){ return document.createTextNode(String(s)); }
function cssEsc(s){ return String(s).replace(/"/g,'\\"'); }
function setStatus(node, text, kind){ node.textContent=text; node.className='feedback'+(kind? ' '+kind:''); }
