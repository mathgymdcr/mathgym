// ===== ARCHIVO FINAL: plantillas/lightsout.js =====
// Estilo "Resuelve el enigma" · Tablero ampliado · Control correcto del mínimo (acepta min_pulsaciones o min_movimientos)

import { celebrate } from './celebration.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  // --- Carga de configuración ---
  let config;
  try { config = await loadConfig(data); }
  catch { setStatus(ui.msg, 'Error al cargar datos', 'ko'); return; }
  config = (config && (config.data || config)) || {};
  if (!Array.isArray(config.modos)) {
    config.modos = [{
      id: 'encender_todo',
      tamano: [3,3],
      objetivo: 'all_on',
      patron_inicial: 'todo_apagado',
      min_pulsaciones: 5
    }];
  }

  const modo = config.modos.find(m => m?.id === (data?.modo || 'encender_todo')) || config.modos[0];
  const [rows, cols] = Array.isArray(modo.tamano) ? modo.tamano : [3,3];
  setInstructions(ui.instructionsText, modo);
  if (Array.isArray(modo.patron_objetivo)) renderPatternPreview(modo.patron_objetivo, ui.preview);

  let board=[], pulsaciones=0;

  // --- Inicialización ---
  function initBoard() {
    document.querySelectorAll('.celebration-overlay').forEach(o => o.remove());
    ui.msg.textContent = '';
    ui.msg.className = 'feedback';
    pulsaciones=0; ui.pulsacionesEl.textContent=pulsaciones;

    if (modo.patron_inicial==='todo_apagado') board=Array.from({length:rows},()=>Array(cols).fill(false));
    else if(Array.isArray(modo.patron_inicial)) board=modo.patron_inicial.map(r=>r.slice());
    else if (modo.patron_inicial==='aleatorio') board=Array.from({length:rows},()=>Array.from({length:cols},()=>Math.random()>0.5));
    else board=Array.from({length:rows},()=>Array(cols).fill(false));

    renderGrid();
  }

  // --- Lógica principal ---
  function press(r,c){toggle(r,c);toggle(r-1,c);toggle(r+1,c);toggle(r,c-1);toggle(r,c+1);}
  function toggle(r,c){if(r<0||r>=rows||c<0||c>=cols)return;board[r][c]=!board[r][c];}
  function isWin(){
    switch(modo.objetivo){
      case'all_on':return board.every(r=>r.every(v=>v));
      case'all_off':return board.every(r=>r.every(v=>!v));
      case'pattern_match':{
        const t=modo.patron_objetivo||modo.patron_inicial;
        return board.every((r,i)=>r.every((v,j)=>v===!!t[i][j]));
      }
      default:return false;
    }
  }

  function renderGrid(){
    const size=68, gap=10;
    ui.grid.style.gridTemplateColumns=`repeat(${cols},${size}px)`;
    ui.grid.style.gap=`${gap}px`;
    ui.grid.innerHTML='';
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const b=document.createElement('button');
      b.className='chip'; b.dataset.r=r; b.dataset.c=c;
      updateButton(b,board[r][c],size);
      b.onclick=()=>{
        press(r,c); pulsaciones++; ui.pulsacionesEl.textContent=pulsaciones;
        updateGrid(size);
        if(isWin()){
          // --- Aquí está el cambio crítico ---
          const min = modo.min_pulsaciones ?? modo.min_movimientos ?? null;
          const perfect = !min || pulsaciones <= min;
          const msg = perfect
            ? `🎉 ¡Completado en ${pulsaciones} pulsaciones!`
            : `💡 Lo lograste en ${pulsaciones}, pero puedes hacerlo en menos pulsaciones.`;
          setStatus(ui.msg, msg, perfect ? 'ok' : 'warning');
          celebrate({
            ok: perfect,
            title: perfect ? '¡Excelente trabajo!' : '¡Reto superado, pero puedes hacerlo en menos pulsaciones!'
          });
          if (hooks?.onWin) hooks.onWin({ pulsaciones, perfect, modo });
        }
      };
      ui.grid.append(b);
    }
  }

  function updateGrid(size){
    ui.grid.querySelectorAll('.chip').forEach(b=>{
      updateButton(b,board[+b.dataset.r][+b.dataset.c],size);
    });
  }
  function updateButton(b,on,size){
    b.textContent=on?'●':'○';
    b.style.background=on?'linear-gradient(135deg,var(--accent),#a855f7)':'rgba(255,255,255,.08)';
    b.style.color=on?'white':'var(--fg)';
    b.style.width=b.style.height=`${size}px`;
    b.style.borderRadius='12px';
    b.style.fontWeight='700';
    b.style.fontSize='1.4rem';
  }

  ui.btnNew.onclick = () => {
    document.querySelectorAll('.celebration-overlay').forEach(o => o.remove());
    ui.msg.textContent = '';
    ui.msg.className = 'feedback';
    initBoard();
  };

  initBoard();
}

// ---------- Interfaz ----------
function buildShell(){
  const box=document.createElement('div');
  box.className='template-box';
  box.innerHTML=`
  <!-- Cabecera estilo "Resuelve el enigma" -->
  <div class="enigma-header-dark">
    <img src="assets/icono-lightsout.png" alt="Icono Los Cuadrados Luminosos">
    <h2>Los Cuadrados Luminosos</h2>
  </div>

  <!-- Instrucciones -->
  <div class="card deceerre-instructions">
    <img src="assets/deceerre-instructions.png" alt="Deceerre">
    <div class="instructions-body">
      <h3>Cómo se juega</h3>
      <div id="lo-instructions"></div>
    </div>
  </div>

  <div class="pattern-preview" style="margin:4px 0 8px;"></div>
  <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
    <button class="btn" id="lo-new">Nuevo</button>
  </div>
  <div style="text-align:center;margin-bottom:8px;">Pulsaciones: <strong id="lo-pulsaciones">0</strong></div>
  <div id="lo-msg" class="feedback"></div>
  <div id="lo-grid" style="display:grid;justify-content:center;margin-top:8px;"></div>`;
  return {
    box,
    grid: box.querySelector('#lo-grid'),
    msg: box.querySelector('#lo-msg'),
    pulsacionesEl: box.querySelector('#lo-pulsaciones'),
    btnNew: box.querySelector('#lo-new'),
    instructionsText: box.querySelector('#lo-instructions'),
    preview: box.querySelector('.pattern-preview')
  };
}

// ---------- Utilidades ----------
async function loadConfig(d){
  if(d?.json_url){const r=await fetch(d.json_url);if(!r.ok)throw new Error();return r.json();}
  return d;
}
function setStatus(el,txt,t){el.textContent=txt;el.className='feedback'+(t?' '+t:'');}
function setInstructions(el,modo){
  const base=`<ul style="margin:.25rem 0 0 1rem;padding:0;">
    <li>Pulsa una casilla para cambiar su estado y el de sus vecinas (arriba, abajo, izquierda, derecha).</li>
    <li>Usa <strong>Nuevo</strong> para reiniciar el tablero.</li>
  </ul>`;
  if(modo.objetivo==='all_on')el.innerHTML=`<p>Objetivo: <strong>encender todas las luces</strong> del tablero.</p>${base}`;
  else if(modo.objetivo==='all_off')el.innerHTML=`<p>Objetivo: <strong>apagar todas las luces</strong>.</p>${base}`;
  else if(modo.objetivo==='pattern_match')el.innerHTML=`<p>Objetivo: <strong>reproducir exactamente el patrón</strong> mostrado arriba.</p>${base}`;
  else el.innerHTML=base;
}
function renderPatternPreview(pattern,container){
  const rows=pattern.length,cols=pattern[0].length;
  const caption=document.createElement('p');
  caption.style='text-align:left;color:var(--fg);opacity:.9;margin:4px auto;max-width:580px;';
  caption.textContent='Patrón objetivo:';
  const grid=document.createElement('div');
  grid.style=`display:grid;grid-template-columns:repeat(${cols},28px);gap:5px;justify-content:center;margin:0 auto 6px;`;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const d=document.createElement('div');
    d.style=`width:28px;height:28px;border-radius:6px;
      background:${pattern[r][c]?'linear-gradient(135deg,var(--accent),#a855f7)':'rgba(255,255,255,0.12)'}`;
    grid.append(d);
  }
  container.innerHTML='';container.append(caption,grid);
}
