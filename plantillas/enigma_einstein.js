export async function render(root, data, hooks){
  // Shell
  root.innerHTML='';
  const ui = buildShell();
  root.append(ui.box);

  // Datos
  let cfg; try{ cfg = await loadConfig(data); }catch(e){ setStatus(ui.status,'✖ '+(e?.message||e),'ko'); return; }

  // Normaliza 4×4
  const allCats = Object.keys(cfg?.categories||{});
  if(allCats.length<4){ setStatus(ui.status,'✖ Se requieren 4 categorías','ko'); return; }
  const keys = allCats.slice(0,4);
  const cats = {}; for(const k of keys){ const v=Array.isArray(cfg.categories[k])? cfg.categories[k].slice(0,4):[]; while(v.length<4) v.push('Valor'+(v.length+1)); cats[k]=v; }
  const N=4;

  // Pistas
  ui.olClues.innerHTML=''; (Array.isArray(cfg.clues)?cfg.clues:[]).forEach(c=> ui.olClues.append(li(txt(c))));

  // Estado
  const state = { selected:null, board:Array(N).fill(0).map(()=>({})) };

  // Tablero -> Paleta
  renderBoard(ui.board, cats, state);
  renderPalette(ui.palette, cats, sel=>{ state.selected=sel; highlightSelected(ui.palette, sel); });

  setStatus(ui.status,'✔ Listo para jugar','ok');
  ui.btnValidate.addEventListener('click',()=> setStatus(ui.result,'¡A jugar!','ok'));
  ui.btnClear.addEventListener('click',()=>{ clearBoard(ui.board,state,cats,N); setStatus(ui.result,'Tablero vaciado',''); });

  // --- funciones internas ---
  function renderBoard(host, cats, state){
    host.innerHTML='';
    const table = el('table',{class:'ein-table', role:'grid', 'aria-label':'Tablero 4 por 4'});
    const tbody = el('tbody');
    const keys = Object.keys(cats).slice(0,4);
    for(const cat of keys){
      const tr = el('tr',{'data-cat':cat});
      for(let col=0; col<N; col++){
        const td = el('td',{class:'cell','data-house':String(col),'data-cat':cat});
        td.addEventListener('click',()=>{
          const sel=state.selected; if(!sel) return;
          if(!state.board[col][cat]) state.board[col][cat]=new Set();
          const set=state.board[col][cat];
          if(set.has(sel.value)) set.delete(sel.value); else set.add(sel.value);
          paintCell(td,set);
        });
        paintCell(td, state.board[col][cat]||new Set());
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody); host.append(table);
  }
  function paintCell(td,set){
    td.innerHTML=''; if(!set||!set.size) return;
    const wrap=el('div',{class:'chips'});
    for(const val of set){ const s=el('span',{class:'chip','data-val':val,title:'Quitar "'+val+'"'},[txt(val)]); s.addEventListener('click',ev=>{ ev.stopPropagation(); const col=Number(td.dataset.house),cat=td.dataset.cat; const S=(state.board[col][cat] ||= new Set()); S.delete(val); paintCell(td,S); }); wrap.append(s); }
    td.append(wrap);
  }
  function renderPalette(container, cats, onSelect){ container.innerHTML=''; for(const [cat,vals] of Object.entries(cats)){ const g=div('ein-group'); g.append(h3(txt(cat))); const w=div('ein-cards'); vals.forEach(v=>{ const b=el('button',{class:'card',type:'button','data-cat':cat,'data-val':v},[txt(v)]); b.addEventListener('click',()=>onSelect({cat,value:v})); w.append(b); }); g.append(w); container.append(g); } }
  function highlightSelected(container, sel){ container.querySelectorAll('.card').forEach(b=>b.classList.remove('is-selected')); if(!sel) return; const q=`.card[data-cat="${cssEsc(sel.cat)}"][data-val="${cssEsc(sel.value)}"]`; const btn=container.querySelector(q); if(btn) btn.classList.add('is-selected'); }
  function clearBoard(host,state,cats,N){ for(let c=0;c<N;c++) state.board[c] = {}; host.querySelectorAll('.cell').forEach(td=> td.innerHTML=''); }
}

// --- Shell / helpers ---
function buildShell(){
  const box=div('template-box'); box.id='ein';
  box.append(div('badge',txt('Enigma 4×4 · Play')));
  const status=div('feedback',txt('Cargando…')); status.id='ein-status'; box.append(status);
  const grid=div('ein-grid');
  const secClues=section('ein-clues'); secClues.append(h2(txt('Pistas'))); const ol=ul(); ol.id='ein-clues'; secClues.append(ol); const tools=div('toolbar',btn('ein-validate','Validar'),btn('ein-clear','Vaciar tablero')); const result=div('feedback'); result.id='ein-result'; secClues.append(tools,result);
  const secBoard=section('ein-board'); secBoard.append(h2(txt('Tablero'))); const board=div(); board.id='ein-board'; secBoard.append(board);
  const secPalette=section('ein-palette'); secPalette.append(h2(txt('Tarjetas'))); const palette=div(); palette.id='ein-palette'; secPalette.append(palette);
  grid.append(secClues,secBoard,secPalette); box.append(grid);
  return { box, status, olClues:ol, btnValidate:byId('ein-validate'), btnClear:byId('ein-clear'), result, board, palette };
}
async function loadConfig(data){ if(data&&data.json_url){ const r=await fetch(data.json_url,{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } if(data&&(data.categories||data.constraints||data.clues)) return data; throw new Error('Falta data.json_url o datos'); }
const byId=id=>document.getElementById(id);
const el=(t,a={},c=[])=>{const n=document.createElement(t); for(const k in a){ if(k==='class') n.className=a[k]; else n.setAttribute(k,a[k]); } (Array.isArray(c)?c:[c]).forEach(x=> n.append(x)); return n; };
const txt=s=>document.createTextNode(String(s));
const div=(cls,...c)=> el('div',{class:cls},c);
const section=cls=> el('section',{class:cls});
const h2=c=> el('h2',{},c); const h3=c=> el('h3',{},c); const ul=()=>el('ul'); const li=c=> el('li',{},c);
const btn=(id,label)=>{ const b=el('button',{class:'btn',id,type:'button'},[txt(label)]); return b; };
const setStatus=(node,text,kind)=>{ node.textContent=text; node.className='feedback'+(kind?' '+kind:''); };
const cssEsc=s=> String(s).replace(/"/g,'\"');
