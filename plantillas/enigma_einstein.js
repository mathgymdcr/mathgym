// ===== ARCHIVO FINAL: plantillas/enigma_einstein.js =====
// Estilo estándar MathGym v1.5 · "Resuelve el enigma" · Enigma lógico de Einstein

import { celebrate } from './celebration.js';
import { tipoInfo } from '../catalogo-tipos.js';

export async function render(root, data, hooks) {
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  // --- Carga de configuración ---
  let config;
  try {
    config = await loadConfig(data);
  } catch {
    setStatus(ui.result, 'Error: No se pudo cargar el enigma', 'ko');
    return;
  }

  const allCategories = Object.keys(config.categories || {});
  // Hoy el puzzle es siempre Persona + 3 categorías temáticas. Si algún
  // día se generan 5 (variante "5x4"), esto avisa en vez de descartar la
  // categoría sobrante en silencio: con slice(0,4) el tablero pintaría 4
  // filas mientras `solution` traería 5 valores por grupo, y
  // validateSolution nunca cuadraría -> "Hay un error" permanente y sin
  // pista de por qué.
  if (allCategories.length !== 4) {
    setStatus(
      ui.result,
      `Error: este reto trae ${allCategories.length} categorías y la plantilla solo soporta 4 (Persona + 3)`,
      'ko'
    );
    return;
  }

  const categoryKeys = allCategories;
  const categories = {};
  for (const k of categoryKeys) {
    categories[k] = Array.isArray(config.categories[k]) ? config.categories[k].slice(0, 4) : [];
  }

  const BOARD_SIZE = 4;
  setCategoriesLine(ui.categoriesLine, categoryKeys);
  renderClues(ui.cluesContainer, config.clues || []);
  const gameState = { selected: null, board: Array(BOARD_SIZE).fill(0).map(() => ({})) };

  renderBoard(ui.board, categories, gameState);
  renderPalette(ui.palette, categories, (sel) => {
    gameState.selected = sel;
    highlightSelected(ui.palette, sel);
  });
  setupEventListeners(ui, gameState, categories, BOARD_SIZE, config);

  // ---------- Subfunciones ----------
  function renderClues(container, clues) {
    container.innerHTML = '';
    if (!clues.length) {
      container.innerHTML = '<li>No hay pistas disponibles</li>';
      return;
    }
    clues.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c;
      container.appendChild(li);
    });
  }

  function renderBoard(container, categories, state) {
    container.innerHTML = '';
    const table = createElement('table', { class: 'ein-table' });
    const thead = createElement('thead');
    const headRow = createElement('tr');
    for (let col = 0; col < BOARD_SIZE; col++) {
      const th = createElement('th', { class: 'house-header', draggable: true, 'data-house': col });
      th.textContent = `Casa ${col + 1}`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = createElement('tbody');
    Object.keys(categories).forEach(category => {
      const row = createElement('tr');
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = createElement('td', { class: 'cell', 'data-house': col, 'data-category': category });

        cell.addEventListener('click', () => {
          const sel = state.selected;
          if (!sel) return;
          if (!state.board[col][category]) state.board[col][category] = new Set();
          const set = state.board[col][category];
          if (set.has(sel.value)) set.delete(sel.value);
          else set.add(sel.value);
          updateCell(cell, set);
        });

        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('cell-drop-hover'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('cell-drop-hover'));
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('cell-drop-hover');
          const raw = e.dataTransfer.getData('text/plain');
          if (!raw) return;
          const [origin, dragCat, dragValue, originHouse] = raw.split('::');
          const targetCat = cell.dataset.category;
          const targetHouse = parseInt(cell.dataset.house, 10);
          if (!state.board[targetHouse][targetCat]) state.board[targetHouse][targetCat] = new Set();
          state.board[targetHouse][targetCat].add(dragValue);
          updateCell(cell, state.board[targetHouse][targetCat]);
          if (origin === 'board') {
            const oh = parseInt(originHouse, 10);
            if (state.board[oh] && state.board[oh][dragCat]) {
              state.board[oh][dragCat].delete(dragValue);
              const old = container.querySelector(`td[data-house="${oh}"][data-category="${dragCat}"]`);
              if (old) updateCell(old, state.board[oh][dragCat]);
            }
          }
        });

        updateCell(cell, state.board[col][category] || new Set());
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    enableColumnDragAndDrop(table, state);
  }

  function updateCell(cell, set) {
    cell.innerHTML = '';
    if (!set || set.size === 0) return;
    const chips = createElement('div', { class: 'chips' });
    for (const value of set) {
      const chip = createElement('button', { class: 'chip', draggable: true });
      chip.textContent = value;
      chip.addEventListener('click', (e) => { e.stopPropagation(); set.delete(value); updateCell(cell, set); });
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', `board::${cell.dataset.category}::${value}::${cell.dataset.house}`);
      });
      chips.appendChild(chip);
    }
    cell.appendChild(chips);
  }

  function renderPalette(container, categories, onSelect) {
    container.innerHTML = '';
    Object.entries(categories).forEach(([cat, vals]) => {
      const g = createElement('div', { class: 'ein-group' });
      const h3 = createElement('h3'); h3.textContent = cat;
      const cards = createElement('div', { class: 'ein-cards' });
      vals.forEach(v => {
        const c = createElement('button', { class: 'card', 'data-category': cat, 'data-value': v, draggable: true });
        c.textContent = v;
        c.addEventListener('click', () => onSelect({ category: cat, value: v }));
        c.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `palette::${cat}::${v}`));
        cards.appendChild(c);
      });
      g.append(h3, cards);
      container.appendChild(g);
    });
  }

  function highlightSelected(container, selection) {
    container.querySelectorAll('.card').forEach(c => c.classList.remove('is-selected'));
    if (!selection) return;
    const s = container.querySelector(`[data-category="${selection.category}"][data-value="${selection.value}"]`);
    if (s) s.classList.add('is-selected');
  }

  function setupEventListeners(ui, state, cats, n, cfg) {
    ui.btnValidate.addEventListener('click', () => {
      const r = validateSolution(state, cats, cfg.solution);
      setStatus(ui.result, r.msg, r.ok ? 'ok' : 'ko');
      if (r.ok) {
        celebrate({ ok: true });
        if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos: state.fallos || 0 });
      } else {
        state.fallos = (state.fallos || 0) + 1;
      }
    });
    ui.btnClear.addEventListener('click', () => {
      for (let i = 0; i < n; i++) state.board[i] = {};
      ui.board.querySelectorAll('.cell').forEach(c => (c.innerHTML = ''));
    });
  }

  function enableColumnDragAndDrop(table, state) {
    let from = null;
    const heads = table.querySelectorAll('th.house-header');
    heads.forEach(th => {
      th.addEventListener('dragstart', () => from = +th.dataset.house);
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = +th.dataset.house;
        if (from == null || from === to) return;
        const rowHeads = [...table.querySelector('thead tr').children];
        const moved = rowHeads.splice(from, 1)[0];
        rowHeads.splice(to, 0, moved);
        const tr = table.querySelector('thead tr');
        tr.innerHTML = '';
        rowHeads.forEach((h, i) => {
          h.dataset.house = i;
          h.textContent = `Casa ${i + 1}`;
          tr.appendChild(h);
        });
        [...table.querySelector('tbody').rows].forEach(r => {
          const cells = [...r.cells];
          const mv = cells.splice(from, 1)[0];
          cells.splice(to, 0, mv);
          r.innerHTML = '';
          cells.forEach((c, i) => { c.dataset.house = i; r.appendChild(c); });
        });
        const st = state.board.splice(from, 1)[0];
        state.board.splice(to, 0, st);
      });
    });
  }
}

// ---------- Interfaz ----------
function buildShell() {
  const { nombre, icono } = tipoInfo('enigma-einstein');
  const box = document.createElement('div');
  box.className = 'template-box';
  box.innerHTML = `
  <div class="enigma-header-dark">
    <img src="${icono}" alt="Icono del reto Einstein">
    <h2>${nombre}</h2>
  </div>

  <div class="card deceerre-instructions">
    <img src="assets/deceerre-instructions.png" alt="Deceerre">
    <div class="instructions-body">
      <h3>Cómo se juega</h3>
      <p>Coloca las tarjetas en el tablero para que cada <strong>columna</strong> contenga exactamente una tarjeta de cada categoría: <em class="ein-categorias"></em>.</p>
      <p>Usa las pistas para deducir la posición correcta de cada elemento. Puedes arrastrar las tarjetas o hacer clic para moverlas.</p>
      <p><span style="color:var(--accent);font-weight:600;">¡Resuelve el enigma como un verdadero detective!</span></p>
    </div>
  </div>

  <div class="ein-grid" style="display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:12px;align-items:start;">
    <section class="ein-clues"><h2>Pistas</h2><ol></ol>
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn">Comprobar</button>
        <button class="btn btn-secondary">Borrar todo</button>
      </div>
      <div class="feedback" style="margin-top:8px;"></div>
    </section>
    <section class="ein-board"><h2>Tablero</h2><div></div></section>
    <section class="ein-palette"><h2>Tarjetas</h2><div></div></section>
  </div>`;

  const refs = {
    box,
    cluesContainer: box.querySelector('ol'),
    btnValidate: box.querySelectorAll('.btn')[0],
    btnClear: box.querySelectorAll('.btn')[1],
    result: box.querySelector('.feedback'),
    board: box.querySelector('.ein-board div'),
    palette: box.querySelector('.ein-palette div'),
    categoriesLine: box.querySelector('.ein-categorias')
  };

  // Responsivo
  function applyLayout() {
    const grid = box.querySelector('.ein-grid');
    const w = window.innerWidth || document.documentElement.clientWidth;
    grid.style.gridTemplateColumns = (w > 980) ? '1fr 1.2fr 1fr' : '1fr';
  }
  applyLayout();
  window.addEventListener('resize', applyLayout);

  return refs;
}

// ---------- Utilidades ----------
async function loadConfig(d) {
  if (d?.json_url) {
    const r = await fetch(d.json_url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return d;
}

function createElement(t, a = {}, txt) {
  const e = document.createElement(t);
  Object.entries(a).forEach(([k, v]) => (k === 'class' ? e.className = v : e.setAttribute(k, v)));
  if (txt) e.textContent = txt;
  return e;
}

function setStatus(el, txt, t) {
  el.textContent = txt;
  el.className = 'feedback' + (t ? ' ' + t : '');
}

// Enumera las categorías REALES del reto del día ("persona, profesión,
// país y deporte"), en vez de la lista fija que había hardcodeada.
function setCategoriesLine(el, categoryKeys) {
  if (!el) return;
  const nombres = categoryKeys.map(k => k.toLowerCase());
  el.textContent = nombres.length > 1
    ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
    : (nombres[0] || '');
}

function validateSolution(state, cats, sol) {
  const S = 4, u = [], solC = [];
  for (let i = 0; i < S; i++) {
    const vals = [];
    for (const [cat] of Object.entries(cats)) {
      const s = state.board[i]?.[cat];
      if (!s || s.size === 0) return { ok: false, msg: 'Faltan datos en columna ' + (i + 1) };
      vals.push([...s][0]);
    }
    vals.sort(); u.push(vals);
  }
  for (const [k, v] of Object.entries(sol))
    solC.push([k, ...Object.values(v)].sort());
  let m = 0; const used = new Set();
  for (const a of u) {
    for (let i = 0; i < solC.length; i++) {
      if (used.has(i)) continue;
      const b = solC[i];
      if (a.length === b.length && a.every((v, j) => v === b[j])) {
        used.add(i); m++; break;
      }
    }
  }
  return m === S ? { ok: true, msg: '🎉 ¡Enigma resuelto!' } : { ok: false, msg: 'Hay un error. Revisa las pistas.' };
}
