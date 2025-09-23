// ===== ARCHIVO COMPLETO: plantillas/balanza_logica.js =====
// Versión: centrado sin hueco, cuerdas/platos ajustados, monedas encima del plato,
// clic en moneda del plato => vuelve al pool, cabecera original (glassmorphism + barrido),
// y CELEBRACIÓN A PANTALLA COMPLETA (overlay) con Deceerre que se cierra sola.
// Sustituye TODO tu archivo por este.

// -----------------------------------------------------------
// RENDER PRINCIPAL
// -----------------------------------------------------------
export async function render(root, data, hooks) {
  // Limpiar contenedor y montar shell
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  // Cargar configuración
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error?.message || error), 'ko');
    return;
  }

  // Normalizaciones seguras
  if (['heaviest', 'lightest', 'oddUnknown'].includes(config.variant)) config.k = 1;
  if (!config.maxWeighings) config.maxWeighings = 4;
  if (!config.variant || !config.N) {
    setStatus(ui.status, 'Error: Falta configuración de la balanza', 'ko');
    return;
  }

  // Estado + UI
  const state = initializeGame(config);
  renderCoins(ui.coinsContainer, state);
  renderBalance(ui.balanceContainer, state);
  renderAnswerSelector(ui.answerContainer, state);
  setupEventListeners(ui, state, config);

  // Quitar “Cargando…/Listo”
  ui.status?.remove();
  updateInstructions(ui.instructions, config);

  // -----------------------------------------------------------
  // LÓGICA DEL JUEGO
  // -----------------------------------------------------------
  function initializeGame(cfg) {
    const s = {
      N: cfg.N,
      variant: cfg.variant,
      k: cfg.k || 1,
      maxWeighings: cfg.maxWeighings || 4,
      coins: [],
      anomalies: [],
      weighings: 0,
      selectedCoin: null,
      answer: { heavy: new Set(), light: new Set(), single: null, singleSign: 1 },
      gameWon: false
    };
    generateAnomalies(s, cfg);
    return s;
  }

  function generateAnomalies(state, cfg) {
    state.anomalies = [];
    const { variant, k, N } = cfg;
    const idxs = Array.from({ length: N }, (_, i) => i);

    const pickRandom = (count) => {
      const picked = [];
      const pool = idxs.slice();
      for (let i = 0; i < count; i++) {
        const pos = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(pos, 1)[0]);
      }
      return picked;
    };

    switch (variant) {
      case 'heaviest':
        state.anomalies.push({ i: pickRandom(1)[0], sign: 1 });
        break;
      case 'lightest':
        state.anomalies.push({ i: pickRandom(1)[0], sign: -1 });
        break;
      case 'oddUnknown': {
        const i = pickRandom(1)[0];
        const sign = Math.random() < 0.5 ? 1 : -1;
        state.anomalies.push({ i, sign });
        break;
      }
      case 'kHeaviest':
        pickRandom(k).forEach(i => state.anomalies.push({ i, sign: 1 }));
        break;
      case 'kLightest':
        pickRandom(k).forEach(i => state.anomalies.push({ i, sign: -1 }));
        break;
      case 'kOddUnknown':
        pickRandom(k).forEach(i => state.anomalies.push({ i, sign: Math.random() < 0.5 ? 1 : -1 }));
        break;
    }
  }

  function renderCoins(container, state) {
    container.innerHTML = '';
    state.coins = [];

    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'balance-coin', 'data-index': i });
      coin.textContent = i + 1;

      // Clic: si está en plato => vuelve al pool; si no => seleccionar
      coin.addEventListener('click', () => {
        const c = state.coins[i];
        if (!c) return;

        if (c.side !== null) {
          // Devolver al pool
          c.side = null;
          c.element.classList.remove('in-plate');
          clearInlinePos(c.element);
          ui.coinsContainer.appendChild(c.element);
          animateBalance(ui.balanceContainer, 'balanced');
          // Limpiar selección
          state.selectedCoin = null;
          state.coins.forEach(x => x.element.classList.remove('selected'));
        } else {
          selectCoin(i, state, ui);
        }
      });

      container.appendChild(coin);
      state.coins.push({ i, element: coin, side: null });
    }
  }

  function selectCoin(index, state) {
    if (state.gameWon) return;
    state.coins.forEach(c => c.element.classList.remove('selected'));
    if (state.selectedCoin === index) {
      state.selectedCoin = null;
    } else {
      state.selectedCoin = index;
      state.coins[index].element.classList.add('selected');
    }
  }

  function renderBalance(container /*, state */) {
    // Barra anclada por ARRIBA para quitar hueco superior.
    // Cuerdas largas + platos más bajos => más distancia barra↔plato.
    container.innerHTML = `
      <div class="balance-beam" id="balance-beam" style="
        position:absolute; top:12px; left:50%; transform:translateX(-50%);
        width:500px; height:12px; background:linear-gradient(180deg,#ccc,#999);
        border-radius:6px; transition:transform .6s ease; transform-origin:center; z-index:2;">
        
        <div class="balance-hook left" style="position:absolute; top:-5px; left:50px; width:4px; height:20px;">
          <div class="balance-rope" style="
            position:absolute; top:12px; left:1px; width:2px; height:110px;
            background:#888; transform-origin:top;"></div>
          <div class="balance-plate left" id="left-plate" data-side="left" style="
            position:absolute; top:140px;
            left:-100px; width:200px; height:20px; cursor:pointer;
            background:linear-gradient(180deg,#ddd,#aaa); border-radius:20px; border:2px solid rgba(0,0,0,.3);">
            <div class="plate-coins" style="
              position:relative; width:100%; height:20px; overflow:visible;">
            </div>
          </div>
        </div>

        <div class="balance-hook right" style="position:absolute; top:-5px; right:50px; width:4px; height:20px;">
          <div class="balance-rope" style="
            position:absolute; top:12px; left:1px; width:2px; height:110px;
            background:#888; transform-origin:top;"></div>
          <div class="balance-plate right" id="right-plate" data-side="right" style="
            position:absolute; top:140px;
            left:-100px; width:200px; height:20px; cursor:pointer;
            background:linear-gradient(180deg,#ddd,#aaa); border-radius:20px; border:2px solid rgba(0,0,0,.3);">
            <div class="plate-coins" style="
              position:relative; width:100%; height:20px; overflow:visible;">
            </div>
          </div>
        </div>
      </div>

      <div class="balance-pivot" style="
        position:absolute; top:98px; left:50%; transform:translateX(-50%);
        width:30px; height:30px; background:linear-gradient(145deg,#666,#333);
        border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,.5); z-index:3;"></div>
    `;

    // Contenedor compacto y centrado
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.maxWidth = '600px';
    container.style.height = '260px';
    container.style.margin = '8px auto';

    // Listeners de platos
    const leftPlate = container.querySelector('#left-plate');
    const rightPlate = container.querySelector('#right-plate');
    leftPlate.addEventListener('click', () => placeCoin('left', state, ui));
    rightPlate.addEventListener('click', () => placeCoin('right', state, ui));
  }

  function placeCoin(side, state, ui) {
    if (state.selectedCoin === null) {
      showMessage(ui.message, 'Selecciona primero una moneda', 'warning');
      return;
    }
    const coin = state.coins[state.selectedCoin];

    // Si ya estaba en un plato, primero devolverla (limpiar estilos)
    if (coin.side !== null) {
      coin.element.classList.remove('in-plate');
      clearInlinePos(coin.element);
      ui.coinsContainer.appendChild(coin.element);
    }

    // Colocar en el nuevo plato
    coin.side = side;
    const plate = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    plate.appendChild(coin.element);

    // Marca visual
    coin.element.classList.add('in-plate');

    // Layout en filas por ENCIMA del borde del plato (top NEGATIVO)
    layoutPlate(side, state, ui);

    // Limpiar selección
    state.selectedCoin = null;
    state.coins.forEach(c => c.element.classList.remove('selected'));
  }

  function layoutPlate(side, state, ui) {
    const area = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    const coins = state.coins.filter(c => c.side === side);
    if (!area) return;

    const width = area.clientWidth || 200; // ancho del plato
    const cols = 3;
    const rowGap = 46;        // separación entre filas
    const rise = 28;          // cuánto “sube” la primera fila sobre el borde

    coins.forEach((c, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      const coinW = c.element.offsetWidth || 48;
      const colCenter = width * ((1 + col * 2) / 6);  // 1/6, 3/6, 5/6
      const leftPx = Math.round(colCenter - coinW / 2);

      // Posición absoluta y por encima del plato (top negativo)
      const el = c.element;
      el.style.position = 'absolute';
      el.style.left = `${leftPx}px`;
      el.style.top = `${-(rise + row * rowGap)}px`;
      el.style.margin = '0';
      el.style.zIndex = String(10 + row);
      el.style.pointerEvents = 'auto'; // permite clic para devolver al pool
    });
  }

  function weighCoins(state, ui) {
    if (state.weighings >= state.maxWeighings) {
      showMessage(ui.message, 'Ya no puedes pesar más', 'error');
      return;
    }

    const leftCoins = state.coins.filter(c => c.side === 'left').map(c => c.i);
    const rightCoins = state.coins.filter(c => c.side === 'right').map(c => c.i);

    if (leftCoins.length === 0 && rightCoins.length === 0) {
      showMessage(ui.message, 'Coloca monedas antes de pesar', 'warning');
      return;
    }

    state.weighings++;
    ui.weighingsCount.textContent = state.weighings;

    const lw = calculateWeight(leftCoins, state);
    const rw = calculateWeight(rightCoins, state);

    let tilt = 'balanced', result = 'Equilibrio';
    if (lw > rw) { tilt = 'left';  result = 'Izquierda más pesada'; }
    else if (rw > lw) { tilt = 'right'; result = 'Derecha más pesada'; }

    animateBalance(ui.balanceContainer, tilt);
    showMessage(ui.result, result, tilt === 'balanced' ? 'ok' : 'info');

    if (state.weighings >= state.maxWeighings) ui.weighButton.disabled = true;

    hooks?.onWeigh?.({ left: leftCoins, right: rightCoins, result, weighingIndex: state.weighings });
  }

  function calculateWeight(indices, state) {
    let w = indices.length;
    state.anomalies.forEach(a => { if (indices.includes(a.i)) w += a.sign; });
    return w;
  }

  function animateBalance(container, tilt) {
    const beam = container.querySelector('#balance-beam');
    if (!beam) return;
    setTimeout(() => {
      if (tilt === 'left')  beam.style.transform = 'translateX(-50%) rotate(-6deg)';
      else if (tilt === 'right') beam.style.transform = 'translateX(-50%) rotate(6deg)';
      else beam.style.transform = 'translateX(-50%) rotate(0deg)';
    }, 40);
  }

  function clearPlates(state, ui) {
    state.coins.forEach(c => {
      if (c.side !== null) {
        c.side = null;
        c.element.classList.remove('in-plate');
        clearInlinePos(c.element);
        ui.coinsContainer.appendChild(c.element);
      }
    });
    animateBalance(ui.balanceContainer, 'balanced');
    showMessage(ui.result, '', '');
  }

  function renderAnswerSelector(container, state) {
    container.innerHTML = '';
    const { variant, k } = state;

    if (variant === 'heaviest' || variant === 'lightest') {
      renderSingleSelect(container, state, variant === 'heaviest' ? 'pesada' : 'ligera');
    } else if (variant === 'oddUnknown') {
      renderOddUnknownSelect(container, state);
    } else if (variant === 'kHeaviest' || variant === 'kLightest') {
      renderMultiSelect(container, state, k, variant === 'kHeaviest' ? 'pesadas' : 'ligeras');
    } else if (variant === 'kOddUnknown') {
      renderKOddSelect(container, state, k);
    }
  }

  function renderSingleSelect(container, state, type) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = `Selecciona la moneda ${type}:`;
    container.appendChild(title);

    const wrap = createElement('div', { class: 'answer-coins' });
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        state.answer.single = i;
        wrap.querySelectorAll('.answer-coin').forEach(x => x.classList.remove('selected'));
        coin.classList.add('selected');
      });
      wrap.appendChild(coin);
    }
    container.appendChild(wrap);
  }

  function renderOddUnknownSelect(container, state) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Selecciona la moneda anómala:';
    container.appendChild(title);

    const wrap = createElement('div', { class: 'answer-coins' });
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        state.answer.single = i;
        wrap.querySelectorAll('.answer-coin').forEach(x => x.classList.remove('selected'));
        coin.classList.add('selected');
      });
      wrap.appendChild(coin);
    }
    container.appendChild(wrap);

    const sign = createElement('div', { class: 'sign-selector' });
    sign.innerHTML = `
      <label><input type="radio" name="sign" value="1" checked> Más pesada</label>
      <label><input type="radio" name="sign" value="-1"> Más ligera</label>
    `;
    sign.addEventListener('change', (e) => { state.answer.singleSign = parseInt(e.target.value, 10); });
    container.appendChild(sign);
  }

  function renderMultiSelect(container, state, k, type) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = `Selecciona ${k} monedas ${type}:`;
    container.appendChild(title);

    const wrap = createElement('div', { class: 'answer-coins' });
    const set = type === 'pesadas' ? state.answer.heavy : state.answer.light;

    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        if (set.has(i)) { set.delete(i); coin.classList.remove('selected'); }
        else if (set.size < k) { set.add(i); coin.classList.add('selected'); }
      });
      wrap.appendChild(coin);
    }
    container.appendChild(wrap);
  }

  function renderKOddSelect(container, state, k) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = `Marca ${k} monedas anómalas:`;
    container.appendChild(title);

    const grid = createElement('div', { class: 'answer-grid' });

    const heavySec = createElement('div', { class: 'answer-section' });
    const heavyTitle = createElement('div', { class: 'section-title' });
    heavyTitle.textContent = 'Más pesadas:';
    heavySec.appendChild(heavyTitle);
    const heavyWrap = createElement('div', { class: 'answer-coins' });

    const lightSec = createElement('div', { class: 'answer-section' });
    const lightTitle = createElement('div', { class: 'section-title' });
    lightTitle.textContent = 'Más ligeras:';
    lightSec.appendChild(lightTitle);
    const lightWrap = createElement('div', { class: 'answer-coins' });

    for (let i = 0; i < state.N; i++) {
      const h = createElement('div', { class: 'answer-coin' });
      h.textContent = i + 1;
      h.addEventListener('click', () => toggleKOddAnswer(i, 'heavy', state, h, lightWrap));

      const l = createElement('div', { class: 'answer-coin' });
      l.textContent = i + 1;
      l.addEventListener('click', () => toggleKOddAnswer(i, 'light', state, l, heavyWrap));

      heavyWrap.appendChild(h);
      lightWrap.appendChild(l);
    }

    heavySec.appendChild(heavyWrap);
    lightSec.appendChild(lightWrap);
    grid.appendChild(heavySec);
    grid.appendChild(lightSec);
    container.appendChild(grid);
  }

  function toggleKOddAnswer(index, type, state, clickedCoin, otherContainer) {
    const { heavy, light } = state.answer;
    const target = type === 'heavy' ? heavy : light;
    const other = type === 'heavy' ? light : heavy;

    if (other.has(index)) {
      other.delete(index);
      const oc = otherContainer.children[index];
      if (oc) oc.classList.remove('selected');
    }

    if (target.has(index)) {
      target.delete(index);
      clickedCoin.classList.remove('selected');
    } else if (heavy.size + light.size < state.k) {
      target.add(index);
      clickedCoin.classList.add('selected');
    } else {
      showMessage(ui.message, `Solo puedes marcar ${state.k} monedas en total`, 'warning');
    }
  }

  function checkAnswer(state, ui, config) {
    if (state.weighings === 0) {
      showMessage(ui.message, 'Debes pesar al menos una vez antes de responder', 'warning');
      return;
    }

    const { variant } = state;
    let user = [];

    if (variant === 'heaviest' && state.answer.single !== null) {
      user = [{ i: state.answer.single, sign: 1 }];
    } else if (variant === 'lightest' && state.answer.single !== null) {
      user = [{ i: state.answer.single, sign: -1 }];
    } else if (variant === 'oddUnknown' && state.answer.single !== null) {
      user = [{ i: state.answer.single, sign: state.answer.singleSign }];
    } else if (variant === 'kHeaviest') {
      user = [...state.answer.heavy].map(i => ({ i, sign: 1 }));
    } else if (variant === 'kLightest') {
      user = [...state.answer.light].map(i => ({ i, sign: -1 }));
    } else if (variant === 'kOddUnknown') {
      user = [
        ...[...state.answer.heavy].map(i => ({ i, sign: 1 })),
        ...[...state.answer.light].map(i => ({ i, sign: -1 }))
      ];
    }

    if (user.length !== state.anomalies.length) {
      showMessage(ui.message, 'Respuesta incompleta', 'warning');
      return;
    }

    const ok = compareAnswers(user, state.anomalies);
    const optimal = calculateOptimalWeighings(config);

    if (ok) {
      state.gameWon = true;

      // *** CELEBRACIÓN A PANTALLA COMPLETA ***
      showFullscreenCelebration({ duration: 3600 });

      // Mensaje informativo secundario
      if (state.weighings <= optimal) {
        showMessage(ui.message, '¡Has alcanzado el óptimo teórico mínimo!', 'success');
      } else {
        showMessage(ui.message, 'Correcto, pero no óptimo', 'info');
      }

      // Mensaje breve en el bloque de resultado (opcional)
      showMessage(ui.result, '¡Victoria!', 'success');

      hooks?.onSuccess?.();
    } else {
      const solution = state.anomalies.map(a => `${a.i + 1}${a.sign > 0 ? '↑' : '↓'}`).join(', ');
      showMessage(ui.result, `Incorrecto. Solución: ${solution}`, 'error');
      hooks?.onFail?.({ solution: state.anomalies.slice() });
    }
  }

  function compareAnswers(userAnswer, correctAnswer) {
    if (userAnswer.length !== correctAnswer.length) return false;
    const u = new Set(userAnswer.map(a => `${a.i}:${a.sign}`));
    const c = new Set(correctAnswer.map(a => `${a.i}:${a.sign}`));
    return u.size === c.size && [...u].every(x => c.has(x));
  }

  function calculateOptimalWeighings(cfg) {
    const { variant, N, k } = cfg;
    let states = 0;
    switch (variant) {
      case 'heaviest':
      case 'lightest': states = N; break;
      case 'oddUnknown': states = 2 * N; break;
      case 'kHeaviest':
      case 'kLightest': states = combination(N, k); break;
      case 'kOddUnknown': states = combination(N, k) * Math.pow(2, k); break;
    }
    return Math.ceil(Math.log(states) / Math.log(3));
  }

  function combination(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    let res = 1;
    for (let i = 1; i <= r; i++) res = (res * (n - r + i)) / i;
    return Math.round(res);
  }

  function updateInstructions(el, cfg) {
    const { variant, N, k } = cfg;
    let t = '';
    switch (variant) {
      case 'heaviest':    t = `De estas ${N} monedas, una es más pesada que el resto.`; break;
      case 'lightest':    t = `De estas ${N} monedas, una es más ligera que el resto.`; break;
      case 'oddUnknown':  t = `De estas ${N} monedas, una tiene un peso distinto al resto.`; break;
      case 'kHeaviest':   t = `De estas ${N} monedas, hay ${k} más pesadas que el resto.`; break;
      case 'kLightest':   t = `De estas ${N} monedas, hay ${k} más ligeras que el resto.`; break;
      case 'kOddUnknown': t = `De estas ${N} monedas, hay ${k} con peso distinto (pueden ser más pesadas o más ligeras).`; break;
    }
    el.textContent = t;
  }

  function setupEventListeners(ui, state, cfg) {
    ui.weighButton.addEventListener('click', () => weighCoins(state, ui));
    ui.clearButton.addEventListener('click', () => clearPlates(state, ui));
    ui.resetButton.addEventListener('click', () => resetGame(state, ui, cfg));
    ui.checkButton.addEventListener('click', () => checkAnswer(state, ui, cfg));
  }

  function resetGame(state, ui, cfg) {
    const fresh = initializeGame(cfg);
    Object.assign(state, fresh);

    renderCoins(ui.coinsContainer, state);
    renderBalance(ui.balanceContainer, state);
    renderAnswerSelector(ui.answerContainer, state);

    ui.weighingsCount.textContent = '0';
    ui.weighButton.disabled = false;
    showMessage(ui.result, '', '');
    showMessage(ui.message, '', '');
    updateInstructions(ui.instructions, cfg);
  }

  function showMessage(el, text, type = '') {
    if (!el) return;
    if (typeof text === 'object' && text?.nodeType) {
      el.innerHTML = '';
      el.appendChild(text);
    } else {
      el.textContent = text;
    }
    el.className = 'balance-message';
    if (type) el.classList.add(type);
  }

  function clearInlinePos(el) {
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.bottom = '';
    el.style.margin = '';
    el.style.zIndex = '';
    el.style.pointerEvents = '';
  }

  // -----------------------------------------------------------
  // CELEBRACIÓN A PANTALLA COMPLETA (overlay) — sin depender del CSS externo
  // -----------------------------------------------------------
  function showFullscreenCelebration({ duration = 3600 } = {}) {
    // Inyectar estilos de la celebración (una sola vez)
    ensureCelebrationStyles();

    // Si ya hay overlay, eliminarlo primero
    const existing = document.getElementById('mg-balance-celebration');
    if (existing) existing.remove();

    // Congelar scroll del body durante la celebración
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'mg-balance-celebration';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: grid; place-items: center;
      background: radial-gradient(120% 120% at 50% 40%, rgba(12,18,32,0.94), rgba(12,18,32,0.85)) ,
                  linear-gradient(160deg, rgba(108,92,231,0.20), rgba(16,132,199,0.20));
      backdrop-filter: blur(4px);
      animation: mg-celebrate-fade-in 280ms ease-out forwards;
      cursor: pointer;
    `;

    // Tarjeta central
    const card = document.createElement('div');
    card.style.cssText = `
      width: min(680px, 92vw);
      padding: clamp(16px, 4vw, 28px);
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
      border: 1.5px solid rgba(255,255,255,0.12);
      box-shadow: 0 20px 50px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.05);
      text-align: center;
      color: var(--fg, #E9EEF8);
      transform: translateY(8px) scale(0.98);
      animation: mg-celebrate-pop 420ms cubic-bezier(.2, .9, .18, 1.1) forwards 120ms;
    `;

    // Deceerre
    const deco = document.createElement('img');
    deco.src = 'assets/deceerre-celebration.png';
    deco.alt = 'Deceerre celebrando';
    deco.style.cssText = `
      width: clamp(120px, 24vw, 180px);
      height: clamp(120px, 24vw, 180px);
      object-fit: contain;
      margin: 0 auto 8px auto;
      filter: drop-shadow(0 10px 24px rgba(16,185,129,0.45));
      animation: mg-bounce 1100ms ease-in-out infinite;
      display: block;
    `;
    deco.onerror = () => { deco.style.display = 'none'; };

    // Título
    const title = document.createElement('div');
    title.textContent = '¡Excelente deducción!';
    title.style.cssText = `
      font-weight: 800;
      font-size: clamp(22px, 4.2vw, 36px);
      letter-spacing: 0.3px;
      margin: 6px 0 2px 0;
      background: linear-gradient(45deg, var(--accent, #6C5CE7), var(--success, #10B981));
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    `;

    // Subtítulo
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Has descubierto al impostor como un verdadero detective';
    subtitle.style.cssText = `
      opacity: .9;
      font-size: clamp(14px, 2.4vw, 18px);
      margin-bottom: 12px;
    `;

    // Emoji animado
    const emoji = document.createElement('div');
    emoji.textContent = '🎉';
    emoji.style.cssText = `
      font-size: clamp(36px, 8vw, 64px);
      animation: mg-tilt 1800ms ease-in-out infinite;
      margin-bottom: 6px;
    `;

    // Pista de cierre
    const hint = document.createElement('div');
    hint.textContent = 'Toca para continuar';
    hint.style.cssText = `
      opacity: 0.75;
      font-size: 13px;
      margin-top: 6px;
    `;

    card.appendChild(deco);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(emoji);
    card.appendChild(hint);
    overlay.appendChild(card);

    // Cierre: click o timeout
    const close = () => {
      overlay.style.animation = 'mg-celebrate-fade-out 280ms ease-in forwards';
      // liberar scroll al terminar fade
      setTimeout(() => {
        document.body.style.overflow = prevOverflow || '';
        overlay.remove();
      }, 260);
    };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onEsc, { once: true });

    function onEsc(e) {
      if (e.key === 'Escape') close();
    }

    // Montar
    document.body.appendChild(overlay);

    // Autocierre
    const t = setTimeout(() => {
      clearTimeout(t);
      close();
    }, Math.max(1200, duration));
  }

  function ensureCelebrationStyles() {
    if (document.getElementById('mg-celebration-styles')) return;
    const style = document.createElement('style');
    style.id = 'mg-celebration-styles';
    style.textContent = `
      @keyframes mg-bounce {
        0%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }
      @keyframes mg-tilt {
        0%, 100% { transform: rotate(-3deg); }
        50% { transform: rotate(3deg); }
      }
      @keyframes mg-celebrate-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes mg-celebrate-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
      @keyframes mg-celebrate-pop {
        0%   { transform: translateY(12px) scale(0.95); opacity: 0; }
        100% { transform: translateY(0px)  scale(1.00); opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        #mg-balance-celebration { animation: none !important; }
        #mg-balance-celebration * { animation: none !important; transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

// -----------------------------------------------------------
// SHELL / UI
// -----------------------------------------------------------
function buildShell() {
  const box = createElement('div', { class: 'template-box balance-game' });

  // Cabecera con estética original (glassmorphism + barrido de luz)
  const header = createElement('div', {
    class: 'enigma-header',
    style: 'display:flex;align-items:center;gap:16px;margin-bottom:16px;position:relative;overflow:hidden;'
  });

  // Icono de la balanza (con fallback)
  const icon = createElement('img', {
    src: 'assets/icon-balanza.png',
    alt: 'Balanza',
    style: 'width:64px;height:64px;border-radius:12px;border:2px solid var(--accent);background:rgba(255,255,255,.06);padding:8px;box-sizing:border-box;z-index:2;position:relative;'
  });
  icon.onerror = () => {
    icon.src = 'assets/balance-icon.svg';
    icon.onerror = () => (icon.style.display = 'none');
  };

  const title = createElement('h2', {
    style: 'margin:0;color:var(--accent);font-size:1.5rem;z-index:2;position:relative;'
  });
  title.textContent = 'Descubre el impostor';

  const lightEffect = createElement('div', {
    style: `
      position:absolute; top:0; left:-100%; width:100%; height:100%;
      background: linear-gradient(90deg, transparent, rgba(108,92,231,0.3), transparent);
      animation: slideLight 3s infinite; z-index:1;
    `
  });

  header.appendChild(lightEffect);
  header.appendChild(icon);
  header.appendChild(title);
  box.appendChild(header);

  // Tarjeta de instrucciones con Deceerre
  const instructionsBox = createElement('div', {
    class: 'card deceerre-instructions',
    style: `
      display:flex; align-items:center; gap:20px; margin-bottom:16px;
      background: linear-gradient(135deg, rgba(108, 92, 231, 0.1), rgba(168, 85, 247, 0.1));
      border: 2px solid transparent; border-radius: 16px; position: relative;
      overflow: hidden; transition: all 0.3s ease; backdrop-filter: blur(10px);
    `
  });
  const deceerreImg = createElement('img', {
    src: 'assets/deceerre-instructions.png',
    alt: 'Deceerre',
    style: `
      width:90px; height:90px; flex-shrink:0;
      filter: drop-shadow(0 4px 12px rgba(108, 92, 231, 0.3));
      z-index:2; position:relative;
    `
  });
  deceerreImg.onerror = () => (deceerreImg.style.display = 'none');

  const instructionsContent = createElement('div', { style: 'flex:1; z-index:2; position:relative;' });
  const instructionsTitle = createElement('h3', {
    style: 'margin:0 0 8px 0; color: var(--accent); font-size: 1.1rem; font-weight: 700;'
  });
  instructionsTitle.textContent = 'Cómo jugar';
  const instructionsText = createElement('p', {
    style: 'margin:0; color: var(--fg); line-height: 1.5; font-size: 0.95rem;'
  });
  instructionsText.innerHTML = 'Selecciona monedas y colócalas en los <strong>platos</strong>. Pesa con lógica para descubrir el impostor.';
  const instructions = createElement('div', {
    class: 'balance-instructions',
    style: 'margin-top:8px; font-size:0.9rem; color: var(--muted);'
  });

  instructionsContent.appendChild(instructionsTitle);
  instructionsContent.appendChild(instructionsText);
  instructionsContent.appendChild(instructions);
  instructionsBox.appendChild(deceerreImg);
  instructionsBox.appendChild(instructionsContent);
  box.appendChild(instructionsBox);

  // Status (se elimina al cargar OK)
  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Contador de pesadas
  const weighingsInfo = createElement('div', {
    class: 'weighings-info',
    style: 'margin: 8px 0; text-align: center; font-size: 1rem;'
  });
  weighingsInfo.innerHTML = `<span>Pesadas: </span><strong><span class="weighings-count">0</span></strong>`;
  box.appendChild(weighingsInfo);

  // Balanza (contenedor)
  const balanceContainer = createElement('div', {
    class: 'balance-container',
    style: 'margin: 8px 0;'
  });
  box.appendChild(balanceContainer);

  // Pool de monedas
  const coinsContainer = createElement('div', {
    class: 'balance-coins',
    style: 'margin-top: 8px;'
  });
  box.appendChild(coinsContainer);

  // Resultado + controles
  const result = createElement('div', { class: 'balance-message' });
  box.appendChild(result);

  const balanceControls = createElement('div', { class: 'balance-controls' });
  const weighButton = createElement('button', { class: 'btn' }); weighButton.textContent = 'Pesar';
  const clearButton = createElement('button', { class: 'btn btn-secondary' }); clearButton.textContent = 'Vaciar';
  const resetButton = createElement('button', { class: 'btn btn-secondary' }); resetButton.textContent = 'Reiniciar';
  balanceControls.appendChild(weighButton);
  balanceControls.appendChild(clearButton);
  balanceControls.appendChild(resetButton);
  box.appendChild(balanceControls);

  // Sección de respuesta (botón centrado)
  const answerSection = createElement('div', { class: 'balance-answer-section' });
  const answerTitle = createElement('h3'); answerTitle.textContent = 'Tu respuesta:';
  const answerContainer = createElement('div', { class: 'balance-answer' });
  const checkButton = createElement('button', {
    class: 'btn btn-primary',
    style: 'display:block;margin:12px auto 0;'
  });
  checkButton.textContent = 'Comprobar respuesta';
  answerSection.appendChild(answerTitle);
  answerSection.appendChild(answerContainer);
  answerSection.appendChild(checkButton);
  box.appendChild(answerSection);

  // Mensaje general
  const message = createElement('div', { class: 'balance-message' });
  box.appendChild(message);

  return {
    box,
    status,
    instructions,
    weighingsCount: weighingsInfo.querySelector('.weighings-count'),
    coinsContainer,
    balanceContainer,
    weighButton,
    clearButton,
    resetButton,
    answerContainer,
    checkButton,
    result,
    message
  };
}

// -----------------------------------------------------------
// UTILIDADES BÁSICAS
// -----------------------------------------------------------
async function loadConfig(data) {
  if (data?.json_url) {
    const resp = await fetch(data.json_url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  }
  if (data?.variant && data?.N) return data;
  throw new Error('Faltan datos de configuracion de la balanza');
}

function createElement(tag, attributes = {}) {
  const el = document.createElement(tag);
  Object.entries(attributes).forEach(([key, val]) => {
    if (key === 'class') el.className = val;
    else if (key === 'style') el.style.cssText = val;
    else el.setAttribute(key, val);
  });
  return el;
}

function setStatus(element, text, type = '') {
  if (!element) return;
  element.textContent = text;
  element.className = 'feedback';
  if (type) element.classList.add(type);
}