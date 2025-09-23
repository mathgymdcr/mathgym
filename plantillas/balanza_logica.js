// ===== ARCHIVO COMPLETO: plantillas/balanza_logica.js =====
export async function render(root, data, hooks) {
  // Limpiar contenedor
  root.innerHTML = '';
  
  const ui = buildShell();
  root.append(ui.box);

  // Cargar configuración
  let config;
  try {
    config = await loadConfig(data);
  } catch (error) {
    setStatus(ui.status, 'Error: ' + (error.message || error), 'ko');
    return;
  }

  // Validar configuración
  if (!config.variant || !config.N) {
    setStatus(ui.status, 'Error: Falta configuración de la balanza', 'ko');
    return;
  }

  // Inicializar el juego
  const gameState = initializeGame(config);
  
  // Renderizar componentes
  renderCoins(ui.coinsContainer, gameState);
  renderBalance(ui.balanceContainer, gameState);
  renderAnswerSelector(ui.answerContainer, gameState);
  setupEventListeners(ui, gameState, config);

  setStatus(ui.status, 'Listo para pesar', 'ok');
  updateInstructions(ui.instructions, config);

  // FUNCIONES DEL JUEGO
  function initializeGame(config) {
    const state = {
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
    
    generateAnomalies(state, config);
    return state;
  }

  function generateAnomalies(state, config) {
    state.anomalies = [];
    const { variant, k, N } = config;
    const indices = Array.from({length: N}, (_, i) => i);
    
    function pickRandom(count) {
      const picked = [];
      const pool = indices.slice();
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }
      return picked;
    }

    switch (variant) {
      case 'heaviest':
        pickRandom(k).forEach(i => state.anomalies.push({i, sign: 1}));
        break;
      case 'lightest':
        pickRandom(k).forEach(i => state.anomalies.push({i, sign: -1}));
        break;
      case 'oddUnknown':
        const oddCoin = pickRandom(1)[0];
        const sign = Math.random() < 0.5 ? 1 : -1;
        state.anomalies.push({i: oddCoin, sign});
        break;
      case 'kHeaviest':
        pickRandom(k).forEach(i => state.anomalies.push({i, sign: 1}));
        break;
      case 'kLightest':
        pickRandom(k).forEach(i => state.anomalies.push({i, sign: -1}));
        break;
      case 'kOddUnknown':
        pickRandom(k).forEach(i => {
          const sign = Math.random() < 0.5 ? 1 : -1;
          state.anomalies.push({i, sign});
        });
        break;
    }
  }

  function renderCoins(container, state) {
    container.innerHTML = '';
    state.coins = [];
    
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { 
        class: 'balance-coin',
        'data-index': i
      });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => selectCoin(i, state, ui));
      
      container.appendChild(coin);
      state.coins.push({ i, element: coin, side: null });
    }
  }

  function selectCoin(index, state, ui) {
    if (state.gameWon) return;
    
    // Deseleccionar anterior
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

    // Event listeners para los platos
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
    
    // Si ya está en un plato, quitarla
    if (coin.side !== null) {
      coin.element.style.position = '';
      coin.element.style.left = '';
      coin.element.style.top = '';
      ui.coinsContainer.appendChild(coin.element);
    }

    // Colocar en el nuevo plato
    coin.side = side;
    const plate = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    plate.appendChild(coin.element);
    
    layoutPlate(side, state, ui);
    
    state.selectedCoin = null;
    state.coins.forEach(c => c.element.classList.remove('selected'));
  }

  function layoutPlate(side, state, ui) {
    const coinsOnSide = state.coins.filter(c => c.side === side);
    const plate = ui.balanceContainer.querySelector(`[data-side="${side}"] .plate-coins`);
    
    coinsOnSide.forEach((coin, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      coin.element.style.position = 'relative';
      coin.element.style.left = (col * 35) + 'px';
      coin.element.style.top = (row * 45) + 'px'; // Más espacio vertical
      coin.element.style.margin = '2px';
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

    const leftWeight = calculateWeight(leftCoins, state);
    const rightWeight = calculateWeight(rightCoins, state);

    let result, tilt;
    if (leftWeight > rightWeight) {
      result = 'Izquierda más pesada';
      tilt = 'left';
    } else if (rightWeight > leftWeight) {
      result = 'Derecha más pesada';
      tilt = 'right';
    } else {
      result = 'Equilibrio';
      tilt = 'balanced';
    }

    animateBalance(ui.balanceContainer, tilt);
    showMessage(ui.result, result, tilt === 'balanced' ? 'ok' : 'info');

    if (state.weighings >= state.maxWeighings) {
      ui.weighButton.disabled = true;
    }
  }

  function calculateWeight(coins, state) {
    let weight = coins.length; // Peso base
    state.anomalies.forEach(anomaly => {
      if (coins.includes(anomaly.i)) {
        weight += anomaly.sign;
      }
    });
    return weight;
  }

  function animateBalance(container, tilt) {
    const beam = container.querySelector('.balance-beam');
    beam.classList.remove('tilt-left', 'tilt-right', 'balanced');
    
    setTimeout(() => {
      if (tilt === 'left') {
        beam.classList.add('tilt-left');
      } else if (tilt === 'right') {
        beam.classList.add('tilt-right');
      } else {
        beam.classList.add('balanced');
      }
    }, 100);
  }

  function clearPlates(state, ui) {
    state.coins.forEach(coin => {
      if (coin.side !== null) {
        coin.side = null;
        coin.element.style.position = '';
        coin.element.style.left = '';
        coin.element.style.top = '';
        coin.element.style.margin = '';
        ui.coinsContainer.appendChild(coin.element);
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

    const coinsContainer = createElement('div', { class: 'answer-coins' });
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        state.answer.single = i;
        coinsContainer.querySelectorAll('.answer-coin').forEach(c => 
          c.classList.remove('selected'));
        coin.classList.add('selected');
      });
      coinsContainer.appendChild(coin);
    }
    container.appendChild(coinsContainer);
  }

  function renderOddUnknownSelect(container, state) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Selecciona la moneda anómala:';
    container.appendChild(title);

    const coinsContainer = createElement('div', { class: 'answer-coins' });
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        state.answer.single = i;
        coinsContainer.querySelectorAll('.answer-coin').forEach(c => 
          c.classList.remove('selected'));
        coin.classList.add('selected');
      });
      coinsContainer.appendChild(coin);
    }
    container.appendChild(coinsContainer);

    const signContainer = createElement('div', { class: 'sign-selector' });
    signContainer.innerHTML = `
      <label><input type="radio" name="sign" value="1" checked> Más pesada</label>
      <label><input type="radio" name="sign" value="-1"> Más ligera</label>
    `;
    signContainer.addEventListener('change', (e) => {
      state.answer.singleSign = parseInt(e.target.value);
    });
    container.appendChild(signContainer);
  }

  function renderMultiSelect(container, state, k, type) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = `Selecciona ${k} monedas ${type}:`;
    container.appendChild(title);

    const coinsContainer = createElement('div', { class: 'answer-coins' });
    const targetSet = type === 'pesadas' ? state.answer.heavy : state.answer.light;
    
    for (let i = 0; i < state.N; i++) {
      const coin = createElement('div', { class: 'answer-coin' });
      coin.textContent = i + 1;
      coin.addEventListener('click', () => {
        if (targetSet.has(i)) {
          targetSet.delete(i);
          coin.classList.remove('selected');
        } else if (targetSet.size < k) {
          targetSet.add(i);
          coin.classList.add('selected');
        }
      });
      coinsContainer.appendChild(coin);
    }
    container.appendChild(coinsContainer);
  }

  function renderKOddSelect(container, state, k) {
    const title = createElement('div', { class: 'answer-title' });
    title.textContent = `Marca ${k} monedas anómalas:`;
    container.appendChild(title);

    const grid = createElement('div', { class: 'answer-grid' });
    
    const heavySection = createElement('div', { class: 'answer-section' });
    const heavyTitle = createElement('div', { class: 'section-title' });
    heavyTitle.textContent = 'Más pesadas:';
    heavySection.appendChild(heavyTitle);
    
    const heavyCoins = createElement('div', { class: 'answer-coins' });
    const lightSection = createElement('div', { class: 'answer-section' });
    const lightTitle = createElement('div', { class: 'section-title' });
    lightTitle.textContent = 'Más ligeras:';
    lightSection.appendChild(lightTitle);
    
    const lightCoins = createElement('div', { class: 'answer-coins' });

    for (let i = 0; i < state.N; i++) {
      const heavyCoin = createElement('div', { class: 'answer-coin' });
      heavyCoin.textContent = i + 1;
      heavyCoin.addEventListener('click', () => toggleKOddAnswer(i, 'heavy', state, heavyCoin, lightCoins));
      
      const lightCoin = createElement('div', { class: 'answer-coin' });
      lightCoin.textContent = i + 1;
      lightCoin.addEventListener('click', () => toggleKOddAnswer(i, 'light', state, lightCoin, heavyCoins));
      
      heavyCoins.appendChild(heavyCoin);
      lightCoins.appendChild(lightCoin);
    }

    heavySection.appendChild(heavyCoins);
    lightSection.appendChild(lightCoins);
    grid.appendChild(heavySection);
    grid.appendChild(lightSection);
    container.appendChild(grid);
  }

  function toggleKOddAnswer(index, type, state, clickedCoin, otherContainer) {
    const { heavy, light } = state.answer;
    const targetSet = type === 'heavy' ? heavy : light;
    const otherSet = type === 'heavy' ? light : heavy;

    // Si ya está en el otro conjunto, quitarlo
    if (otherSet.has(index)) {
      otherSet.delete(index);
      const otherCoin = otherContainer.children[index];
      otherCoin.classList.remove('selected');
    }

    // Toggle en el conjunto actual
    if (targetSet.has(index)) {
      targetSet.delete(index);
      clickedCoin.classList.remove('selected');
    } else if (heavy.size + light.size < state.k) {
      targetSet.add(index);
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
    let userAnswer = [];

    // Construir respuesta del usuario
    if (variant === 'heaviest' && state.answer.single !== null) {
      userAnswer = [{i: state.answer.single, sign: 1}];
    } else if (variant === 'lightest' && state.answer.single !== null) {
      userAnswer = [{i: state.answer.single, sign: -1}];
    } else if (variant === 'oddUnknown' && state.answer.single !== null) {
      userAnswer = [{i: state.answer.single, sign: state.answer.singleSign}];
    } else if (variant === 'kHeaviest') {
      userAnswer = [...state.answer.heavy].map(i => ({i, sign: 1}));
    } else if (variant === 'kLightest') {
      userAnswer = [...state.answer.light].map(i => ({i, sign: -1}));
    } else if (variant === 'kOddUnknown') {
      userAnswer = [
        ...[...state.answer.heavy].map(i => ({i, sign: 1})),
        ...[...state.answer.light].map(i => ({i, sign: -1}))
      ];
    }

    // Validar respuesta completa
    if (userAnswer.length !== state.anomalies.length) {
      showMessage(ui.message, 'Respuesta incompleta', 'warning');
      return;
    }

    // Comparar con la solución
    const isCorrect = compareAnswers(userAnswer, state.anomalies);
    const optimal = calculateOptimalWeighings(config);

    if (isCorrect) {
      state.gameWon = true;
      if (state.weighings <= optimal) {
        showMessage(ui.result, createCelebrationMessage(), 'success');
      } else {
        showMessage(ui.result, 'Correcto, pero no óptimo', 'info');
      }
      
      if (hooks && typeof hooks.onSuccess === 'function') {
        hooks.onSuccess();
      }
    } else {
      const solution = state.anomalies.map(a => `${a.i+1}${a.sign > 0 ? '↑' : '↓'}`).join(', ');
      showMessage(ui.result, `Incorrecto. Solución: ${solution}`, 'error');
    }
  }

  function compareAnswers(userAnswer, correctAnswer) {
    if (userAnswer.length !== correctAnswer.length) return false;
    
    const userSet = new Set(userAnswer.map(a => `${a.i}:${a.sign}`));
    const correctSet = new Set(correctAnswer.map(a => `${a.i}:${a.sign}`));
    
    return userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x));
  }

  function calculateOptimalWeighings(config) {
    const { variant, N, k } = config;
    let states = 0;

    switch (variant) {
      case 'heaviest':
      case 'lightest':
        states = k === 1 ? N : combination(N, k);
        break;
      case 'oddUnknown':
        states = 2 * N;
        break;
      case 'kHeaviest':
      case 'kLightest':
        states = combination(N, k);
        break;
      case 'kOddUnknown':
        states = combination(N, k) * Math.pow(2, k);
        break;
    }

    return Math.ceil(Math.log(states) / Math.log(3));
  }

  function combination(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    
    let result = 1;
    for (let i = 1; i <= r; i++) {
      result = result * (n - r + i) / i;
    }
    return Math.round(result);
  }

  function updateInstructions(element, config) {
    const { variant, N, k } = config;
    let text = '';

    switch (variant) {
      case 'heaviest':
        text = `De estas ${N} monedas, ${k === 1 ? 'una es más pesada' : `${k} son más pesadas`} que el resto.`;
        break;
      case 'lightest':
        text = `De estas ${N} monedas, ${k === 1 ? 'una es más ligera' : `${k} son más ligeras`} que el resto.`;
        break;
      case 'oddUnknown':
        text = `De estas ${N} monedas, una tiene un peso distinto al resto.`;
        break;
      case 'kHeaviest':
        text = `De estas ${N} monedas, hay ${k} más pesadas que el resto.`;
        break;
      case 'kLightest':
        text = `De estas ${N} monedas, hay ${k} más ligeras que el resto.`;
        break;
      case 'kOddUnknown':
        text = `De estas ${N} monedas, hay ${k} con peso distinto (pueden ser más pesadas o más ligeras).`;
        break;
    }

    element.textContent = text;
  }

  function setupEventListeners(ui, state, config) {
    ui.weighButton.addEventListener('click', () => weighCoins(state, ui));
    ui.clearButton.addEventListener('click', () => clearPlates(state, ui));
    ui.resetButton.addEventListener('click', () => resetGame(state, ui, config));
    ui.checkButton.addEventListener('click', () => checkAnswer(state, ui, config));
  }

  function resetGame(state, ui, config) {
    // Reinicializar estado con nuevas monedas anómalas
    Object.assign(state, initializeGame(config));
    
    // Re-renderizar componentes
    renderCoins(ui.coinsContainer, state);
    renderBalance(ui.balanceContainer, state);
    renderAnswerSelector(ui.answerContainer, state);
    
    // Resetear UI
    ui.weighingsCount.textContent = '0';
    ui.weighButton.disabled = false;
    showMessage(ui.result, '', '');
    showMessage(ui.message, '', '');
    updateInstructions(ui.instructions, config);
  }

  function showMessage(element, text, type = '') {
    if (!element) return;
    
    if (typeof text === 'object' && text.nodeType) {
      // Es un elemento DOM
      element.innerHTML = '';
      element.appendChild(text);
    } else {
      element.textContent = text;
    }
    
    element.className = 'balance-message';
    if (type) {
      element.classList.add(type);
    }
  }
}

// FUNCIONES DE UTILIDAD
function buildShell() {
  const box = createElement('div', { class: 'template-box balance-game' });
  
  // Header con Einstein y efecto luminoso
  const header = createElement('div', { 
    class: 'enigma-header', 
    style: 'display: flex; align-items: center; gap: 16px; margin-bottom: 16px; position: relative; overflow: hidden;' 
  });
  
  const einsteinImg = createElement('img', {
    src: 'assets/einstein-caricature.png',
    alt: 'Einstein',
    style: 'width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--accent); z-index: 2; position: relative;'
  });
  einsteinImg.onerror = () => einsteinImg.style.display = 'none';
  
  const title = createElement('h2', { 
    style: 'margin: 0; color: var(--accent); font-size: 1.5rem; z-index: 2; position: relative;' 
  });
  title.textContent = 'Resuelve el enigma';
  
  // Efecto luminoso animado
  const lightEffect = createElement('div', {
    style: `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(108, 92, 231, 0.3), transparent);
      animation: slideLight 3s infinite;
      z-index: 1;
    `
  });
  
  header.appendChild(lightEffect);
  header.appendChild(einsteinImg);
  header.appendChild(title);
  box.appendChild(header);

  // Recuadro de instrucciones con Deceerre
  const instructionsBox = createElement('div', { 
    class: 'card deceerre-instructions',
    style: `
      display: flex; 
      align-items: center; 
      gap: 20px; 
      margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(108, 92, 231, 0.1), rgba(168, 85, 247, 0.1));
      border: 2px solid transparent;
      border-radius: 16px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    `
  });
  
  const deceerreImg = createElement('img', {
    src: 'assets/deceerre-instructions.png',
    alt: 'Deceerre',
    style: `
      width: 90px; 
      height: 90px; 
      flex-shrink: 0;
      filter: drop-shadow(0 4px 12px rgba(108, 92, 231, 0.3));
      z-index: 2;
      position: relative;
    `
  });
  deceerreImg.onerror = () => deceerreImg.style.display = 'none';
  
  const instructionsContent = createElement('div', {
    style: 'flex: 1; z-index: 2; position: relative;'
  });
  
  const instructionsTitle = createElement('h3', {
    style: `
      margin: 0 0 8px 0;
      color: var(--accent);
      font-size: 1.1rem;
      font-weight: 700;
    `
  });
  instructionsTitle.textContent = 'Detective, a por la balanza!';
  
  const instructionsText = createElement('p', {
    style: `
      margin: 0;
      color: var(--fg);
      line-height: 1.5;
      font-size: 0.95rem;
    `
  });
  instructionsText.innerHTML = 'Selecciona monedas y colócalas en los <strong>PLATOS</strong> de la balanza. Pesa estratégicamente para descubrir cuáles son diferentes. <span style="color: var(--accent); font-weight: 600;">¡Usa tu lógica!</span>';
  
  const instructions = createElement('div', { 
    class: 'balance-instructions',
    style: 'margin-top: 8px; font-size: 0.9rem; color: var(--muted);'
  });
  
  instructionsContent.appendChild(instructionsTitle);
  instructionsContent.appendChild(instructionsText);
  instructionsContent.appendChild(instructions);
  
  instructionsBox.appendChild(deceerreImg);
  instructionsBox.appendChild(instructionsContent);
  box.appendChild(instructionsBox);

  // Status
  const status = createElement('div', { class: 'feedback' });
  status.textContent = 'Cargando...';
  box.appendChild(status);

  // Contador de pesadas
  const weighingsInfo = createElement('div', { 
    class: 'weighings-info',
    style: 'margin: 12px 0; text-align: center; font-size: 1rem;'
  });
  weighingsInfo.innerHTML = `
    <span>Pesadas: </span>
    <strong><span class="weighings-count">0</span></strong>
  `;
  box.appendChild(weighingsInfo);

  // Balanza (primero para que las monedas estén cerca)
  const balanceContainer = createElement('div', { 
    class: 'balance-container',
    style: 'margin: 20px 0;'
  });
  box.appendChild(balanceContainer);

  // Contenedor de monedas (justo debajo de la balanza)
  const coinsContainer = createElement('div', { 
    class: 'balance-coins',
    style: 'margin-top: 10px;'
  });
  box.appendChild(coinsContainer);

  // Resultado de pesada
  const result = createElement('div', { class: 'balance-message' });
  box.appendChild(result);

  // Controles de la balanza
  const balanceControls = createElement('div', { class: 'balance-controls' });
  const weighButton = createElement('button', { class: 'btn' });
  weighButton.textContent = 'Pesar';
  const clearButton = createElement('button', { class: 'btn btn-secondary' });
  clearButton.textContent = 'Vaciar';
  const resetButton = createElement('button', { class: 'btn btn-secondary' });
  resetButton.textContent = 'Reiniciar';
  
  balanceControls.appendChild(weighButton);
  balanceControls.appendChild(clearButton);
  balanceControls.appendChild(resetButton);
  box.appendChild(balanceControls);

  // Selector de respuesta
  const answerSection = createElement('div', { class: 'balance-answer-section' });
  const answerTitle = createElement('h3');
  answerTitle.textContent = 'Tu respuesta:';
  answerSection.appendChild(answerTitle);
  
  const answerContainer = createElement('div', { class: 'balance-answer' });
  answerSection.appendChild(answerContainer);
  
  const checkButton = createElement('button', { class: 'btn btn-primary' });
  checkButton.textContent = 'Comprobar respuesta';
  answerSection.appendChild(checkButton);
  
  box.appendChild(answerSection);

  // Mensaje general
  const message = createElement('div', { class: 'balance-message' });
  box.appendChild(message);

  // Añadir estilos CSS para las animaciones
  if (!document.getElementById('balance-animations')) {
    const style = createElement('style', { id: 'balance-animations' });
    style.textContent = `
      @keyframes slideLight {
        0% { left: -100%; }
        50% { left: 100%; }
        100% { left: 100%; }
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }
      
      @keyframes sparkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }
      
      .balance-rope {
        height: 60px; /* Hilos más largos */
      }
      
      .balance-coins {
        margin-top: 10px; /* Monedas más cerca de los platos */
      }
    `;
    document.head.appendChild(style);
  }

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

function createCelebrationMessage() {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex; 
    align-items: center; 
    gap: 16px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1));
    padding: 16px;
    border-radius: 12px;
    border: 2px solid rgba(16, 185, 129, 0.3);
    position: relative;
    overflow: hidden;
  `;
  
  const deceerreImg = document.createElement('img');
  deceerreImg.src = 'assets/deceerre-celebration.png';
  deceerreImg.alt = 'Deceerre celebrando';
  deceerreImg.style.cssText = `
    width: 70px; 
    height: 70px; 
    flex-shrink: 0;
    filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.4));
    animation: bounce 1s infinite;
    z-index: 2;
    position: relative;
  `;
  deceerreImg.onerror = () => deceerreImg.style.display = 'none';
  
  const textContainer = document.createElement('div');
  textContainer.style.cssText = 'flex: 1; z-index: 2; position: relative;';
  
  const title = document.createElement('div');
  title.style.cssText = `
    color: var(--success);
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 4px;
  `;
  title.textContent = 'Excelente deducción!';
  
  const message = document.createElement('div');
  message.style.cssText = 'color: var(--fg); line-height: 1.4;';
  message.innerHTML = 'Has resuelto la balanza como un <strong>verdadero detective!</strong>';
  
  textContainer.appendChild(title);
  textContainer.appendChild(message);
  
  container.appendChild(deceerreImg);
  container.appendChild(textContainer);
  
  return container;
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const response = await fetch(data.json_url);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.json();
  }

  if (data && (data.variant || data.N)) {
    return data;
  }

  throw new Error('Faltan datos de configuracion de la balanza');
}

function createElement(tag, attributes = {}) {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'style') {
      element.style.cssText = value;
    } else {
      element.setAttribute(key, value);
    }
  });

  return element;
}

function setStatus(element, text, type = '') {
  if (!element) return;
  
  element.textContent = text;
  element.className = 'feedback';
  if (type) {
    element.classList.add(type);
  }
}