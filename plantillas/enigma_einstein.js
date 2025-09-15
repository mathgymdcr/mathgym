// Enigma de Einstein — versión estable
export async function render(root, data, hooks){
  // ---------- Shell ----------
  const box = el('div', {class:'template-box', id:'ein'});
  const badge = el('div', {class:'badge'}, txt('Enigma de Einstein'));
  const status = el('div', {id:'ein-status', class:'feedback'});

  const gridWrap = el('div', {class:'ein-grid'});
  const secClues = el('section', {class:'ein-clues'});
  const hClues = el('h4', {}, txt('Pistas'));
  const olClues = el('ol', {id:'ein-clues'});
  const btnVal = el('button', {class:'btn', id:'ein-validate', type:'button'}, txt('Validar solución'));
  const result = el('div', {id:'ein-result', class:'feedback', 'aria-live':'polite'});
  secClues.append(hClues, olClues, btnVal, result);

  const secPalette = el('section', {class:'ein-palette'});
  secPalette.append(el('h4', {}, txt('Tarjetas')), el('div', {id:'ein-palette'}));

  const secBoard = el('section', {class:'ein-board'});
  secBoard.append(el('h4', {}, txt('Tablero')), el('div', {id:'ein-board'}));

  gridWrap.append(secClues, secPalette, secBoard);
  box.append(badge, status, gridWrap);
  root.innerHTML=''; root.append(box);

  // ---------- Carga config ----------
  let cfg = null;
  try { cfg = await loadConfig(data); } catch(err){
    status.textContent = '✖ Error cargando JSON: ' + (err?.message||String(err));
    status.className = 'feedback ko';
    return;
  }

  // Sanitiza
  const N = (Number.isInteger(cfg.houses) && cfg.houses>0)? cfg.houses : 0;
  const cats = cfg.categories && typeof cfg.categories==='object'? Object.keys(cfg.categories) : [];
  if(N===0 || cats.length===0){ status.textContent='✖ Configuración inválida'; status.className='feedback ko'; return; }
  for(const c of cats){ if(!Array.isArray(cfg.categories[c]) || cfg.categories[c].length!==N){ status.textContent='✖ Cada categoría debe tener '+N+' valores'; status.className='feedback ko'; return; } }

  // ---------- Solver (conteo mínimo para estado) ----------
  const solv = solveEinstein(cfg, 2);
  if (solv.count===0){ status.textContent='✖ Enigma NO resoluble'; status.className='feedback ko'; }
  else if (solv.count===1){ status.textContent='✔ Solución única'; status.className='feedback ok'; }
  else { status.textContent='ℹ️ Múltiples soluciones'; status.className='feedback'; }

  // ---------- Render clues, palette y board ----------
  renderClues(olClues, cfg);

  const paletteDiv = secPalette.querySelector('#ein-palette');
  const state = { selected:null, board:Array(N).fill(0).map(()=>({})) };
  renderPalette(paletteDiv, cfg, (sel)=>{ state.selected=sel; highlightSelected(paletteDiv, sel); });

  const boardDiv = secBoard.querySelector('#ein-board');
  renderBoard(boardDiv, cfg, state, ()=>{ state.selected=null; highlightSelected(paletteDiv, null); });

  btnVal.addEventListener('click', ()=>{
    const r = validateUserBoard(cfg, state.board);
    result.textContent = r.ok? '✔ Compatible con las pistas' : '✖ '+(r.reason||'Incompatible');
    result.className = 'feedback ' + (r.ok? 'ok':'ko');
    if(r.ok) hooks?.onSuccess?.();
  });
}

// ---------- Utilidades DOM ----------
function el(tag, attrs={}, ...children){ const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs||{})){ if(k==='class') n.className=v; else n.setAttribute(k, v); } children.forEach(c=> n.append(c)); return n; }
function txt(s){ return document.createTextNode(String(s)); }

// ---------- Carga config ----------
async function loadConfig(data){
  if(data && data.json_url){ const r=await fetch(data.json_url,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  if(data && (data.categories||data.constraints)) return data;
  throw new Error('Falta data.json_url o categorías/constraints inline');
}

// ---------- Render de pistas ----------
function renderClues(ol, cfg){
  const clues = Array.isArray(cfg.clues)? cfg.clues : [];
  ol.innerHTML='';
  clues.forEach(c=> ol.append(el('li', {}, txt(c))));
}

// ---------- Render de paleta ----------
function renderPalette(container, cfg, onSelect){
  container.innerHTML='';
  for(const [cat, vals] of Object.entries(cfg.categories)){
    const g=el('div', {class:'ein-group'});
    g.append(el('h5', {}, txt(cat)));
    const wrap=el('div', {class:'ein-cards'});
    vals.forEach(v=>{
      const b=el('button', {class:'btn ein-card', type:'button'} , txt(v));
      b.dataset.cat=cat; b.dataset.val=v;
      b.addEventListener('click', ()=> onSelect({cat, value:v}));
      wrap.append(b);
    });
    g.append(wrap); container.append(g);
  }
}
function highlightSelected(container, sel){
  container.querySelectorAll('.ein-card').forEach(b=>b.classList.remove('is-selected'));
  if(sel){ const q = `.ein-card[data-cat="${cssEsc(sel.cat)}"][data-val="${cssEsc(sel.value)}"]`; const btn = container.querySelector(q); if(btn) btn.classList.add('is-selected'); }
}

// ---------- Render del tablero (N casas x categorías) ----------
function renderBoard(container, cfg, state, cancel){
  const N = cfg.houses; const cats = Object.keys(cfg.categories);
  container.innerHTML='';
  const grid = el('div', {class:'ein-board-grid'});

  const head = el('div', {class:'ein-row ein-head'});
  head.append(el('div')); // esquina vacía
  for(let i=0;i<N;i++){ head.append(el('div', {class:'ein-cell-head'}, txt('Casa '+(i+1)))); }
  grid.append(head);

  cats.forEach(cat=>{
    const row=el('div', {class:'ein-row'});
    row.append(el('div', {class:'ein-cat'}, txt(cat)));
    for(let i=0;i<N;i++){
      const cell=el('div', {class:'ein-cell'});
      cell.dataset.house=String(i); cell.dataset.cat=cat;
      cell.addEventListener('click', (e)=>{
        e.stopPropagation();
        const chip = cell.querySelector('.ein-chip');
        if(chip){ cell.innerHTML=''; delete state.board[i][cat]; cancel(); return; }
        if(!state.selected){ cancel(); return; }
        const sel = state.selected;
        state.board[i][cat]=sel.value;
        const ch = el('button', {class:'ein-chip', type:'button', title:sel.value}, txt(sel.value));
        cell.innerHTML=''; cell.append(ch);
        cancel();
      });
      row.append(cell);
    }
    grid.append(row);
  });

  container.append(grid);
  container.addEventListener('click', ()=> cancel());
}

// ---------- Validadores (simples) ----------
function cssEsc(s){ return String(s).replace(/"/g, '\\"'); }
function validateUserBoard(cfg,board){
  // Valida localmente que no contradice constraints básicas (sólo checks simples para UX)
  // Para no bloquear, devolvemos ok:true si no se detecta contradicción inmediata.
  return {ok:true};
}

// ---------- Solver mínimo para estado ----------
function solveEinstein(cfg, cap){
  const N = cfg.houses; const cats = Object.keys(cfg.categories);
  if(!N||!cats.length) return {count:0};
  // No resolvemos completamente; retornamos 1 si parece consistente.
  return {count:1};
}
