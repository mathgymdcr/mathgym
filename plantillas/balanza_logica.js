// ===== ARCHIVO COMPLETO: plantillas/balanza_logica.js (Versión LITE) =====

export async function render(root, data, hooks) {
  // 1) Shell mínimo
  root.innerHTML = '';
  const ui = buildShell();
  root.append(ui.box);

  // 2) Cargar config
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  // Normalizar: variantes de 1 anómala → k=1; tope pesadas por defecto
  if (['heaviest', 'lightest', 'oddUnknown'].includes(config.variant)) config.k = 1;
  if (!config.maxWeighings) config.maxWeighings = 4;

  if (!config.variant || !config.N) {
    setStatus(ui.status, 'Error: Falta configuración de la balanza', 'ko');
    return;
  }

  // 3) Estado
  const state = initializeGame(config);

  // 4) Render UI
  renderCoins(ui.coinsContainer, state);
  renderBalance(ui.balanceContainer, state);
  renderAnswerSelector(ui.answerContainer, state);
  setupEventListeners(ui, state, config);

  // Quitar “Cargando…/Listo para pesar”
  ui.status?.remove();

  updateInstructions(ui.instructions, config);

  // ============ LÓGICA DEL JUEGO ============

  function initializeGame(config) {
    const s = {
      N: config.N,
      variant: config.variant,
      k: config.k || 1,
      maxWeighings: config.maxWeighings || 4,
      coins: [],
      anomalies: [],
      weighings: 0,
      selectedCoin: null,
      answer: { heavy: new Set(), light: new Set(), single: null, singleSign: 1 },
      gameWon: false
    };
    generateAnomalies(s, config);
    return s;
  }

  function generateAnomalies(state, config) {
    state.anomalies = [];
    const { variant, k, N } = config;
    const idxs = Array.from({ length: N }, (_, i) => i);

    function pickRandom(count) {
      const picked = [];
      const pool = idxs.slice();
      for (let i = 0; i < count; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      return picked;
    }

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

      // Clic: si está en plato → vuelve al pool; si no → selecciona
      coin.addEventListener('click', () => {
        const c = state.coins[i];
        if (!c) return;

        if (c.side !== null) {
          // devolver al pool
          c.side = null;
          c.element.classList.remove('in-plate');
          clearInlinePos(c.element);
          ui.coinsContainer.appendChild(c.element);
          animateBalance(ui.balanceContainer, 'balanced');
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

  function selectCoin(index, state, ui) {
    if (state.gameWon) return;
    state.coins.forEach(c => c.element.classList.remove('selected'));
    if (state.selectedCoin === index) {
      state.selectedCoin = null;
    } else {
      state.selectedCoin = index;
      state.coins[index].element.classList.add('selected');
    }
  }

  function renderBalance(container, state) {
    container.innerHTML = `
      <div class="balance-beam" id="balance-beam">
        <div class="balance-hook left">
          <div class="balance-rope"></div>
          <div class="balance-plate left" id="left-plate" data-side="left">
            <div class="plate-coins"></div>
          </div>
        </div>
        <div class="balance-hook right">
          <div class="balance-rope"></div>
          <div class="balance-plate right" id="right-plate" data-side="right">
            <div class="plate-coins"></div>
          </div>
        </div>
      </div>
      <div class="balance-pivot"></div>
    `;
    container.querySelector('#left-plate').addEventListener('click', () => placeCoin('left', state, ui));
    container.querySelector('#right-plate').addEventListener('click', () => placeCoin('right', state, ui));
  }

  function placeCoin(side, state, ui) {
    if (state.selectedCoin === null) {
      showMessage(ui.message, 'Selecciona primero una moneda', 'warning');
      return;
    }
    const coin = state.coins[state.selectedCoin];

    // Si ya estaba en plato, primero la devolvemos (para limpiar estilos)
    if (coin.side !== null) {
      coin.element.classList.remove('in-plate');
      clearInlinePos(coin.element);
      ui.coinsContainer.appendChild(coin.element);
    }

    // Colocar en plato
    coin.side = side;
    const plate = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    plate.appendChild(coin.element);
    coin.element.classList.add('in-plate');

    // Distribución visual (sin tocar tu CSS): absoluta, centrada arriba del plato
    layoutPlate(side, state, ui);

    // Limpiar selección
    state.selectedCoin = null;
    state.coins.forEach(c => c.element.classList.remove('selected'));
  }

  function layoutPlate(side, state, ui) {
    const plate = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    const coins = state.coins.filter(c => c.side === side);
    if (!plate) return;

    // Medidas dinámicas (responden a 200px / 150px en media queries)
    const plateWidth = plate.clientWidth || 200;
    const cols = 3;
    const gapY = 46;             // altura efectiva por fila
    const baseBottom = 18;       // a qué altura "asientan" sobre el plato

    coins.forEach((c, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      // Ancho real de la moneda ya en DOM (40–52 px según media query)
      const coinW = c.element.offsetWidth || 48;

      // Centros a 1/6, 3/6, 5/6 del ancho del área
      const colCenter = plateWidth * ((1 + col * 2) / 6);
      const leftPx = Math.round(colCenter - coinW / 2);

      const bottomPx = baseBottom + row * gapY;

      // Posicionamiento absoluto
      const el = c.element;
      el.style.position = 'absolute';
      el.style.left = `${leftPx}px`;
      el.style.bottom = `${bottomPx}px`;
      el.style.top = '';        // limpiar por si acaso
      el.style.margin = '0';
      el.style.zIndex = 10 + row; // filas posteriores por encima
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
    if (rw > lw) { tilt = 'right'; result = 'Derecha más pesada'; }

    animateBalance(ui.balanceContainer, tilt);
    showMessage(ui.result, result, tilt === 'balanced' ? 'ok' : 'info');

    if (state.weighings >= state.maxWeighings) ui.weighButton.disabled = true;

    hooks?.onWeigh?.({ left: leftCoins, right: rightCoins, result, weighingIndex: state.weighings });
  }

  function calculateWeight(coins, state) {
    let w = coins.length;
    state.anomalies.forEach(a => { if (coins.includes(a.i)) w += a.sign; });
    return w;
  }

  function animateBalance(container, tilt) {
    const beam = container.querySelector('.balance-beam');
    if (!beam) return;
    beam.classList.remove('tilt-left', 'tilt-right', 'balanced');
    setTimeout(() => {
      if (tilt === 'left') beam.classList.add('tilt-left');
      else if (tilt === 'right') beam.classList.add('tilt-right');
      else beam.classList.add('balanced');
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
    sign.addEventListener('change', (e) => { state.answer.singleSign = parseInt(e.target.value); });
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
    heavySec.appendChild(createElement('div', { class: 'section-title' })).textContent = 'Más pesadas:';
    const heavyWrap = createElement('div', { class: 'answer-coins' });

    const lightSec = createElement('div', { class: 'answer-section' });
    lightSec.appendChild(createElement('div', { class: 'section-title' })).textContent = 'Más ligeras:';
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
      oc && oc.classList.remove('selected');
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

    const { variant, k } = state;
    let user = [];

    if (variant === 'heaviest' && state.answer.single !== null) user = [{ i: state.answer.single, sign: 1 }];
    else if (variant === 'lightest' && state.answer.single !== null) user = [{ i: state.answer.single, sign: -1 }];
    else if (variant === 'oddUnknown' && state.answer.single !== null) user = [{ i: state.answer.single, sign: state.answer.singleSign }];
    else if (variant === 'kHeaviest') user = [...state.answer.heavy].map(i => ({ i, sign: 1 }));
    else if (variant === 'kLightest') user = [...state.answer.light].map(i => ({ i, sign: -1 }));
    else if (variant === 'kOddUnknown') user = [
      ...[...state.answer.heavy].map(i => ({ i, sign: 1 })),
      ...[...state.answer.light].map(i => ({ i, sign: -1 }))
    ];

    if (user.length !== state.anomalies.length) {
      showMessage(ui.message, 'Respuesta incompleta', 'warning');
      return;
    }

    const ok = compareAnswers(user, state.anomalies);
    const optimal = calculateOptimalWeighings(config);

    if (ok) {
      state.gameWon = true;
      if (state.weighings <= optimal) {
        showMessage(ui.result, '¡Has alcanzado el óptimo teórico mínimo!', 'success');
      } else {
        showMessage(ui.result, 'Correcto, pero no óptimo', 'info');
      }
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

  function calculateOptimalWeighings(config) {
    const { variant, N, k } = config;
    let states = 0;
    switch (variant) {
      case 'heaviest':
      case 'lightest':
        states = N; break;
      case 'oddUnknown':
        states = 2 * N; break;
      case 'kHeaviest':
      case 'kLightest':
        states = combination(N, k); break;
      case 'kOddUnknown':
        states = combination(N, k) * Math.pow(2, k); break;
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

  function updateInstructions(el, config) {
    const { variant, N, k } = config;
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

  function setupEventListeners(ui, state, config) {
    ui.weighButton.addEventListener('click', () => weighCoins(state, ui));
    ui.clearButton.addEventListener('click', () => clearPlates(state, ui));
    ui.resetButton.addEventListener('click', () => resetGame(state, ui, config));
    ui.checkButton.addEventListener('click', () => checkAnswer(state, ui, config));
  }

  function resetGame(state, ui, config) {
    const fresh = initializeGame(config);
    Object.assign(state, fresh);

    renderCoins(ui.coinsContainer, state);
    renderBalance(ui.balanceContainer, state);
    renderAnswerSelector(ui.answerContainer, state);

    ui.weighingsCount.textContent = '0';
    ui.weighButton.disabled = false;
    showMessage(ui.result, '', '');
    showMessage(ui.message, '', '');
    updateInstructions(ui.instructions, config);
  }

  function showMessage(el, text, type = '') {
    if (!el) return;
    if (typeof text === 'object' && text?.nodeType) { el.innerHTML = ''; el.appendChild(text); }
    else { el.textContent = text; }
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
  }
}

// ============ UTILIDADES UI ============

function buildShell() {
  const box = createElement('div', { class: 'template-box balance-game' });

  // Header simple (sin inyectar CSS)
  const header = createElement('div', {
    class: 'enigma-header',
    style: 'display:flex;align-items:center;gap:16px;margin-bottom:16px;position:relative;overflow:hidden;'
  });
  const einsteinImg = createElement('img', {
    src: 'assets/einstein-caricature.png',
    alt: 'Einstein',
    style: 'width:64px;height:64px;border-radius:50%;border:2px solid var(--accent);z-index:2;position:relative;'
  });
  einsteinImg.onerror = () => (einsteinImg.style.display = 'none');
  const title = createElement('h2', {
    style: 'margin:0;color:var(--accent);font-size:1.5rem;z-index:2;position:relative;'
  });
  title.textContent = 'Resuelve el enigma';
  header.appendChild(einsteinImg);
  header.appendChild(title);
  box.appendChild(header);

  // Tarjeta instrucciones + área texto dinámico
  const instructionsBox = createElement('div', {
    class: 'card deceerre-instructions',
    style: 'display:flex;align-items:center;gap:20px;margin-bottom:16px;background:linear-gradient(135deg, rgba(108,92,231,.1), rgba(168,85,247,.1));border:2px solid transparent;border-radius:16px;position:relative;overflow:hidden;transition:all .3s ease;backdrop-filter:blur(10px);'
  });
  const deceerreImg = createElement('img', {
    src: 'assets/deceerre-instructions.png',
    alt: 'Deceerre',
    style: 'width:90px;height:90px;flex-shrink:0;filter:drop-shadow(0 4px 12px rgba(108,92,231,.3));z-index:2;position:relative;'
  });
  deceerreImg.onerror = () => (deceerreImg.style.display = 'none');
  const instructionsContent = createElement('div', { style: 'flex:1;z-index:2;position:relative;' });
  const instructionsTitle = createElement('h3', {
    style: 'margin:0 0 8px 0;color:var(--accent);font-size:1.1rem;font-weight:700;'
  });
  instructionsTitle.textContent = 'Detective, a por la balanza!';
  const instructionsText = createElement('p', {
    style: 'margin:0;color:var(--fg);line-height:1.5;font-size:.95rem;'
  });
  instructionsText.innerHTML = 'Selecciona monedas y colócalas en los <strong>PLATOS</strong> de la balanza. Pesa estratégicamente para descubrir cuáles son diferentes.';
  const instructions = createElement('div', { class: 'balance-instructions', style: 'margin-top:8px;font-size:.9rem;color:var(--muted);' });

  instructionsContent.appendChild(instructionsTitle);
  instructionsContent.appendChild(instructionsText);
  instructionsContent.appendChild(instructions);
  instructionsBox.appendChild(deceerreImg);
  instructionsBox.appendChild(instructionsContent);
  box.appendChild(instructionsBox);

  // Status (se elimina tras render OK)
  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Contador de pesadas
  const weighingsInfo = createElement('div', { class: 'weighings-info', style: 'margin:12px 0;text-align:center;font-size:1rem;' });
  weighingsInfo.innerHTML = `<span>Pesadas: </span><strong><span class="weighings-count">0</span></strong>`;
  box.appendChild(weighingsInfo);

  // Balanza centrada
  const balanceContainer = createElement('div', { class: 'balance-container', style: 'margin:16px 0;' });
  box.appendChild(balanceContainer);

  // Pool de monedas
  const coinsContainer = createElement('div', { class: 'balance-coins', style: 'margin-top:10px;' });
  box.appendChild(coinsContainer);

  // Resultado y controles
  const result = createElement('div', { class: 'balance-message' });
  box.appendChild(result);

  const controls = createElement('div', { class: 'balance-controls' });
  const weighButton = createElement('button', { class: 'btn' }); weighButton.textContent = 'Pesar';
  const clearButton = createElement('button', { class: 'btn btn-secondary' }); clearButton.textContent = 'Vaciar';
  const resetButton = createElement('button', { class: 'btn btn-secondary' }); resetButton.textContent = 'Reiniciar';
  controls.appendChild(weighButton); controls.appendChild(clearButton); controls.appendChild(resetButton);
  box.appendChild(controls);

  // Respuesta + botón centrado (inline style)
  const answerSection = createElement('div', { class: 'balance-answer-section' });
  const answerTitle = createElement('h3'); answerTitle.textContent = 'Tu respuesta:';
  const answerContainer = createElement('div', { class: 'balance-answer' });
  const checkButton = createElement('button', { class: 'btn btn-primary', style: 'display:block;margin:12px auto 0;' });
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

async function loadConfig(data) {
  if (data?.json_url) {
    const resp = await fetch(data.json_url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  }
  if (data?.variant && data?.N) return data;
  throw new Error('Faltan datos de configuracion de la balanza');
}

function createElement(tag, attrs = {}) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  });
  return el;
}

function setStatus(el, text, type = '') {
  if (!el) return;
  el.textContent = text;
  el.className = 'feedback';
  if (type) el.classList.add(type);
}