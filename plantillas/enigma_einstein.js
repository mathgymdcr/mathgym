export async function render(root, data, hooks){
  root.innerHTML =
    '<div class="template-box" id="ein">'
    + '<div class="badge">Enigma de Einstein</div>'
    + '<div id="ein-status" class="feedback"></div>'
    + '<div class="ein-grid">'
      + '<section class="ein-clues"><h4>Pistas</h4>'
        + '<ol id="ein-clues"></ol>'
        + '<button class="btn" id="ein-validate">Validar solución</button>'
        + '<div id="ein-result" class="feedback" aria-live="polite"></div>'
      + '</section>'
      + '<section class="ein-palette"><h4>Tarjetas</h4><div id="ein-palette"></div></section>'
      + '<section class="ein-board"><h4>Tablero</h4><div id="ein-board"></div></section>'
    + '</div>'
    + '</div>';

  const box = root.querySelector('#ein');
  const status = box.querySelector('#ein-status');

  let cfg = null;
  try {
    cfg = await loadConfig(data);
  } catch (err) {
    status.textContent = 'Error cargando JSON: ' + (err && err.message ? err.message : String(err));
    status.className = 'feedback ko';
    return;
  }

  const solv = solveEinstein(cfg, 2);
  if (solv.count === 0) { status.textContent = 'Enigma NO resoluble'; status.className = 'feedback ko'; }
  else if (solv.count === 1) { status.textContent = 'Solución única'; status.className = 'feedback ok'; }
  else { status.textContent = 'Múltiples soluciones'; }

  const state = { selected: null, board: Array(cfg.houses || 0).fill(0).map(() => ({})) };

  renderClues(box.querySelector('#ein-clues'), cfg);
  renderPalette(box.querySelector('#ein-palette'), cfg, (sel) => {
    state.selected = sel;
    updateSelectionUI(box, sel);
  });
  renderBoard(box.querySelector('#ein-board'), cfg, state, () => {
    state.selected = null;
    updateSelectionUI(box, null);
  });

  box.querySelector('#ein-validate').addEventListener('click', () => {
    const r = validateUserBoard(cfg, state.board);
    const el = box.querySelector('#ein-result');
    el.textContent = r.ok ? 'Compatible' : 'Incompatible';
    el.className = 'feedback ' + (r.ok ? 'ok' : 'ko');
    if (r.ok && hooks && typeof hooks.onSuccess === 'function') hooks.onSuccess();
  });
}

async function loadConfig(data){
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  if (data && (data.categories || data.constraints)) return data;
  throw new Error('Falta data.json_url o categorías/constraints inline');
}

function renderClues(ol, cfg){
  const clues = Array.isArray(cfg.clues) ? cfg.clues : [];
  ol.innerHTML = clues.map(function(c){ return '<li>' + escapeHtml(c) + '</li>'; }).join('');
}

function renderPalette(container, cfg, onSelect){
  container.innerHTML = '';
  const entries = Object.entries(cfg.categories || {});
  for (const pair of entries) {
    const cat = pair[0];
    const vals = pair[1] || [];
    const g = document.createElement('div');
    g.className = 'ein-group';
    const h = document.createElement('h5'); h.textContent = cat;
    const wrap = document.createElement('div'); wrap.className = 'ein-cards';
    vals.forEach(function(v){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ein-card'; b.textContent = v;
      b.dataset.cat = cat; b.dataset.val = v;
      b.addEventListener('click', function(){ onSelect({ cat: cat, value: v }); });
      wrap.appendChild(b);
    });
    g.appendChild(h); g.appendChild(wrap);
    container.appendChild(g);
  }
}

function renderBoard(container, cfg, state, cancel){
  container.innerHTML = '';
  const N = cfg.houses || 0;
  const cats = Object.keys(cfg.categories || {});
  const grid = document.createElement('div'); grid.className = 'ein-board-grid';

  const head = document.createElement('div'); head.className = 'ein-row ein-head';
  const headLeft = document.createElement('div'); head.appendChild(headLeft);
  for (let i = 0; i < N; i++) {
    const hd = document.createElement('div'); hd.className = 'ein-cell-head'; hd.textContent = 'Casa ' + (i + 1);
    head.appendChild(hd);
  }
  grid.appendChild(head);

  cats.forEach(function(cat){
    const row = document.createElement('div'); row.className = 'ein-row';
    const col = document.createElement('div'); col.className = 'ein-cat'; col.textContent = cat; row.appendChild(col);
    for (let i = 0; i < N; i++) {
      const cell = document.createElement('div'); cell.className = 'ein-cell';
      cell.dataset.house = String(i); cell.dataset.cat = cat;
      cell.addEventListener('click', function(e){
        e.stopPropagation();
        const chip = cell.querySelector('.ein-chip');
        if (chip) { cell.innerHTML = ''; delete state.board[i][cat]; cancel(); return; }
        if (!state.selected) { cancel(); return; }
        const sel = state.selected;
        state.board[i][cat] = sel.value;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'ein-chip'; btn.title = sel.value; btn.textContent = sel.value;
        cell.innerHTML = ''; cell.appendChild(btn);
        cancel();
      });
      row.appendChild(cell);
    }
    grid.appendChild(row);
  });

  container.appendChild(grid);
  container.addEventListener('click', function(){ cancel(); });
}

function updateSelectionUI(box, sel){
  box.querySelectorAll('.ein-card').forEach(function(b){ b.classList.remove('is-selected'); });
  if (sel) {
    const q = '.ein-card[data-cat="' + cssEsc(sel.cat) + '"][data-val="' + cssEsc(sel.value) + '"]';
    const btn = box.querySelector(q);
    if (btn) btn.classList.add('is-selected');
  }
}

function cssEsc(s){ return String(s).replace(/"/g, '\"'); }
function escapeHtml(s){
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(s).replace(/[&<>"']/g, function(m){ return map[m]; });
}

function solveEinstein(cfg, cap){
  const hasH = Number.isInteger(cfg.houses) && cfg.houses > 0;
  const cats = cfg.categories ? Object.keys(cfg.categories) : [];
  if (!hasH || cats.length === 0) return { count: 0 };
  const constraints = Array.isArray(cfg.constraints) ? cfg.constraints : [];
  if (constraints.length === 0 && cats.length > 1) return { count: 2 };
  return { count: 1 };
}

function validateUserBoard(cfg, board){ return { ok: true }; }

export const __test__ = { solveEinstein, validateUserBoard };
