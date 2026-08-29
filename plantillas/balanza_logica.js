// ===== ARCHIVO COMPLETO: plantillas/balanza_logica.js =====
// Estética estándar MathGym (cabecera + tarjeta Deceerre) · Balanza lógica
// Compat: sin optional chaining ni nullish. No bloquea pesadas al superar el "mínimo teórico".
// Envío de respuestas: hooks.onSubmit(payload) si existe, tras pulsar "Comprobar".

import { celebrate } from './celebration.js';
import { tipoInfo } from '../catalogo-tipos.js';
// El vocabulario del reto (nombres de variante, n_monedas/k_impostoras/
// max_pesadas) y la cota de pesadas viven en un solo sitio, compartidos
// con el generador y el validador. Esta plantilla tenía copia propia de
// las dos cosas, y la del mínimo usaba Math.ceil(log/log 3), que se pasa
// por uno cuando los escenarios son potencia exacta de 3.
import { leerConfigBalanza, balanzaMinWeighings } from '../scripts/balanza-logic.js';

export async function render(root, data, hooks) {
  // ---------- Boot ----------
  root.innerHTML = '';
  const ui = buildShell();
  root.appendChild(ui.box);

  // ---------- Config ----------
  let config;
  try {
    config = leerConfigBalanza(await loadConfig(data));
  } catch (err) {
    setStatus(ui.status, 'Error al cargar datos: ' + (err && err.message ? err.message : err), 'ko');
    return;
  }
  if (!config || !config.variant || !config.n_monedas) {
    setStatus(ui.status, 'Error: Falta configuración (variant, n_monedas).', 'ko');
    return;
  }
  if (!config.max_pesadas) config.max_pesadas = 4;
  if (config.variant === 'pesada' || config.variant === 'ligera' || config.variant === 'desconocida') config.k_impostoras = 1;

  // ---------- Estado ----------
  const state = {
    n_monedas: config.n_monedas,
    variant: config.variant,
    k_impostoras: config.k_impostoras || 1,
    max_pesadas: config.max_pesadas,
    coins: [],                 // {i, element, side: 'left'|'right'|null}
    anomalies: [],             // [{i, sign: +1|-1}]
    weighings: 0,
    selectedCoin: null,
    log: [],                   // historial de pesadas: {left,right,result}
    answer: { heavy: new Set(), light: new Set(), single: null, singleSign: 1 },
    gameWon: false
  };
  generateAnomalies(state, config);

  // ---------- Pintado ----------
  renderCoins(ui.coinsContainer, state);
  renderBalance(ui.balanceContainer, state);
  renderAnswerSelector(ui.answerContainer, state);
  if (ui.status && ui.status.parentNode) ui.status.parentNode.removeChild(ui.status);
  updateInstructions(ui.instructions, config);

  // ---------- Eventos ----------
  ui.weighButton.addEventListener('click', function () { onWeigh(ui, state); });
  ui.clearButton.addEventListener('click', function () { clearPlates(ui, state); });
  ui.resetButton.addEventListener('click', function () { render(root, data, hooks); });
  ui.checkButton.addEventListener('click', function () { onCheck(ui, state, config, hooks); });

  // ========================= LÓGICA =========================
  function generateAnomalies(s, cfg) {
    // Si el generador ya fijó qué moneda(s) son anómalas (seedeado por
    // fecha), se usan tal cual -- así el reto de hoy es el mismo para
    // todo el mundo. Solo se cae a Math.random() si faltan (datos
    // antiguos o de prueba manual sin generador).
    if (Array.isArray(cfg.anomalies) && cfg.anomalies.length > 0) {
      s.anomalies = cfg.anomalies;
      return;
    }
    s.anomalies = [];
    var idxs = Array.from({ length: s.n_monedas }, function (_, i) { return i; });
    function pick(n) {
      var pool = idxs.slice(), out = [];
      for (var j = 0; j < n; j++) {
        var p = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(p, 1)[0]);
      }
      return out;
    }
    switch (cfg.variant) {
      case 'pesada':
        s.anomalies.push({ i: pick(1)[0], sign: 1 }); break;
      case 'ligera':
        s.anomalies.push({ i: pick(1)[0], sign: -1 }); break;
      case 'desconocida': {
        var ii = pick(1)[0];
        var sg = Math.random() < 0.5 ? 1 : -1;
        s.anomalies.push({ i: ii, sign: sg });
        break;
      }
      case 'pesadas-multiples':
        pick(s.k_impostoras).forEach(function (i) { s.anomalies.push({ i: i, sign: 1 }); }); break;
      case 'ligeras-multiples':
        pick(s.k_impostoras).forEach(function (i) { s.anomalies.push({ i: i, sign: -1 }); }); break;
      case 'desconocidas-multiples':
        pick(s.k_impostoras).forEach(function (i) { s.anomalies.push({ i: i, sign: Math.random() < 0.5 ? 1 : -1 }); }); break;
    }
  }

  function renderCoins(container, s) {
    container.innerHTML = '';
    s.coins = [];
    for (var i = 0; i < s.n_monedas; i++) {
      var coin = createElement('div', { class: 'balance-coin', 'data-index': i });
      coin.textContent = (i + 1).toString();
      (function (idx, el) {
        el.addEventListener('click', function () {
          var c = s.coins[idx];
          if (!c) return;
          if (c.side !== null) {
            // volver al pool
            c.side = null;
            el.classList.remove('in-plate', 'is-selected');
            clearInlinePos(el);
            ui.coinsContainer.appendChild(el);
            animateBalance(ui.balanceContainer, 'balanced');
          } else {
            // seleccionar para colocar
            s.coins.forEach(function (x) { x.element.classList.remove('is-selected'); });
            if (s.selectedCoin === idx) {
              s.selectedCoin = null;
              el.classList.remove('is-selected');
            } else {
              s.selectedCoin = idx;
              el.classList.add('is-selected');
            }
          }
        });
      })(i, coin);
      s.coins.push({ i: i, element: coin, side: null });
      container.appendChild(coin);
    }
  }

  function renderBalance(container, s) {
    // El extremo que sube gira alrededor del CENTRO de la barra, así que se
    // eleva por encima de donde empieza la barra (top:8px dejaba solo 8px de
    // margen y el giro sube más que eso). Bajar toda la barra dentro de su
    // propio contenedor le da margen de sobra sin tocar nada más.
    container.innerHTML =
      '<div class="balance-beam" id="balance-beam" style="position:absolute;top:28px;left:50%;transform:translateX(-50%);width:520px;height:12px;background:linear-gradient(180deg,#cfd4db,#9aa3ad);border-radius:8px;transition:transform .6s ease;transform-origin:center;z-index:2;">' +
      '  <div class="balance-hook left" style="position:absolute;top:-4px;left:62px;width:4px;height:20px;">' +
      '    <div class="balance-rope" style="position:absolute;top:12px;left:1px;width:2px;height:118px;background:#a6b0bb;"></div>' +
      '    <div class="balance-plate" id="left-plate" data-side="left" style="position:absolute;top:146px;left:-110px;width:220px;height:20px;background:linear-gradient(180deg,#e9edf3,#babfc7);border-radius:20px;border:2px solid rgba(0,0,0,.25);cursor:pointer;">' +
      '      <div class="plate-coins" style="position:relative;width:100%;height:20px;overflow:visible;"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="balance-hook right" style="position:absolute;top:-4px;right:62px;width:4px;height:20px;">' +
      '    <div class="balance-rope" style="position:absolute;top:12px;left:1px;width:2px;height:118px;background:#a6b0bb;"></div>' +
      '    <div class="balance-plate" id="right-plate" data-side="right" style="position:absolute;top:146px;left:-110px;width:220px;height:20px;background:linear-gradient(180deg,#e9edf3,#babfc7);border-radius:20px;border:2px solid rgba(0,0,0,.25);cursor:pointer;">' +
      '      <div class="plate-coins" style="position:relative;width:100%;height:20px;overflow:visible;"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="balance-pivot" style="position:absolute;top:120px;left:50%;transform:translateX(-50%);width:30px;height:30px;background:linear-gradient(145deg,#5f6772,#2f343b);border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,.5);z-index:3;"></div>';

    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.maxWidth = '680px';
    container.style.height = '280px';
    container.style.margin = '0 auto';

    container.querySelector('#left-plate').addEventListener('click', function () { placeCoin('left', s); });
    container.querySelector('#right-plate').addEventListener('click', function () { placeCoin('right', s); });
  }

  function placeCoin(side, s) {
    if (s.selectedCoin === null) {
      setStatus(ui.message, 'Selecciona primero una moneda', 'ko');
      return;
    }
    var coin = s.coins[s.selectedCoin];
    if (coin.side !== null) {
      coin.element.classList.remove('in-plate');
      clearInlinePos(coin.element);
      ui.coinsContainer.appendChild(coin.element);
    }
    coin.side = side;
    var plate = ui.balanceContainer.querySelector('[data-side="' + side + '"] .plate-coins');
    plate.appendChild(coin.element);
    coin.element.classList.add('in-plate');
    layoutPlate(side, s);
    s.selectedCoin = null;
    s.coins.forEach(function (c) { c.element.classList.remove('is-selected'); });
  }

  function layoutPlate(side, s) {
    var area = ui.balanceContainer.querySelector('[data-side="' + side + '"] .plate-coins');
    if (!area) return;
    var coins = s.coins.filter(function (c) { return c.side === side; });
    var width = area.clientWidth || 220;
    var cols = 3, rowGap = 44, rise = 26;
    coins.forEach(function (c, idx) {
      var row = Math.floor(idx / cols);
      var col = idx % cols;
      var coinW = c.element.offsetWidth || 48;
      var colCenter = width * ((1 + col * 2) / 6);
      var leftPx = Math.round(colCenter - coinW / 2);
      var el = c.element;
      el.style.position = 'absolute';
      el.style.left = leftPx + 'px';
      el.style.top = '-' + (rise + row * rowGap) + 'px'; // sobre el plato
      el.style.margin = '0';
      el.style.zIndex = String(10 + row);
      el.style.pointerEvents = 'auto';
    });
  }

  function onWeigh(ui, s) {
    var left = s.coins.filter(function (c) { return c.side === 'left'; }).map(function (c) { return c.i; });
    var right = s.coins.filter(function (c) { return c.side === 'right'; }).map(function (c) { return c.i; });
    if (left.length === 0 && right.length === 0) {
      setStatus(ui.message, 'Coloca monedas antes de pesar', 'ko');
      return;
    }

    s.weighings += 1;
    ui.weighingsCount.textContent = String(s.weighings);

    var lw = calcWeight(left, s);
    var rw = calcWeight(right, s);
    var tilt = 'balanced', result = 'Equilibrio';
    if (lw > rw) { tilt = 'left'; result = 'Izquierda más pesada'; }
    else if (rw > lw) { tilt = 'right'; result = 'Derecha más pesada'; }

    s.log.push({ left: left.slice(), right: right.slice(), result: result });
    animateBalance(ui.balanceContainer, tilt);
    setStatus(ui.result, result, tilt === 'balanced' ? 'ok' : 'info');

    // No bloqueamos nunca el botón de pesar: con platos desiguales se sigue
    // pesando (el lado con más monedas gana casi siempre, salvo el empate
    // que sale si la única moneda suelta resulta ser la impostora ligera),
    // pero avisamos de que esa comparación no dice nada -- una sola moneda
    // contra el plato vacío parece "no moverse" y no es que esté rota.
    if (left.length !== right.length) {
      setStatus(ui.message, 'Con platos desiguales el resultado no es fiable: pon el mismo número de monedas en los dos, o mueve alguna', 'info');
    }

    // Si supera el mínimo teórico, solo avisamos, sin impedir continuar.
    // (Pisa el aviso de arriba si aplican los dos a la vez: superar el
    // mínimo importa más que el aviso de platos desiguales.)
    var optimal = balanzaMinWeighings(config);
    if (s.weighings > optimal) {
      setStatus(ui.message, 'Puedes resolverlo en ' + optimal + ' pesadas o menos. ¡Intenta optimizar!', 'info');
    }
  }

  function calcWeight(indices, s) {
    var w = indices.length;
    s.anomalies.forEach(function (a) { if (indices.indexOf(a.i) !== -1) w += a.sign; });
    return w;
  }

  function clearPlates(ui, s) {
    s.coins.forEach(function (c) {
      if (c.side !== null) {
        c.side = null;
        c.element.classList.remove('in-plate');
        clearInlinePos(c.element);
        ui.coinsContainer.appendChild(c.element);
      }
    });
    animateBalance(ui.balanceContainer, 'balanced');
    setStatus(ui.result, '', '');
  }

  function renderAnswerSelector(container, s) {
    container.innerHTML = '';
    var v = s.variant;
    if (v === 'pesada' || v === 'ligera') {
      renderSingle(container, s, v === 'pesada' ? 'pesada' : 'ligera');
    } else if (v === 'desconocida') {
      renderOddUnknown(container, s);
    } else if (v === 'pesadas-multiples' || v === 'ligeras-multiples') {
      renderMulti(container, s, s.k_impostoras, v === 'pesadas-multiples' ? 'pesadas' : 'ligeras');
    } else if (v === 'desconocidas-multiples') {
      renderKOdd(container, s, s.k_impostoras);
    }
  }

  function renderSingle(container, s, label) {
    var title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Selecciona la moneda ' + label + ':';
    container.appendChild(title);

    var wrap = createElement('div', { class: 'answer-coins' });
    for (var i = 0; i < s.n_monedas; i++) {
      (function (idx) {
        var c = createElement('div', { class: 'answer-coin' });
        c.textContent = (idx + 1).toString();
        c.addEventListener('click', function () {
          s.answer.single = idx;
          var all = wrap.querySelectorAll('.answer-coin');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('selected');
          c.classList.add('selected');
        });
        wrap.appendChild(c);
      })(i);
    }
    container.appendChild(wrap);
  }

  function renderOddUnknown(container, s) {
    var title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Selecciona la moneda anómala:';
    container.appendChild(title);

    var wrap = createElement('div', { class: 'answer-coins' });
    for (var i = 0; i < s.n_monedas; i++) {
      (function (idx) {
        var c = createElement('div', { class: 'answer-coin' });
        c.textContent = (idx + 1).toString();
        c.addEventListener('click', function () {
          s.answer.single = idx;
          var all = wrap.querySelectorAll('.answer-coin');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('selected');
          c.classList.add('selected');
        });
        wrap.appendChild(c);
      })(i);
    }
    container.appendChild(wrap);

    var sign = createElement('div', { class: 'sign-selector' });
    sign.innerHTML =
      '<label><input type="radio" name="signSel" value="1" checked> Más pesada</label>' +
      '<label><input type="radio" name="signSel" value="-1"> Más ligera</label>';
    sign.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.name === 'signSel') s.answer.singleSign = parseInt(t.value, 10);
    });
    container.appendChild(sign);
  }

  function renderMulti(container, s, k, label) {
    var title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Selecciona ' + k + ' monedas ' + label + ':';
    container.appendChild(title);

    var wrap = createElement('div', { class: 'answer-coins' });
    var set = label === 'pesadas' ? s.answer.heavy : s.answer.light;

    for (var i = 0; i < s.n_monedas; i++) {
      (function (idx) {
        var c = createElement('div', { class: 'answer-coin' });
        c.textContent = (idx + 1).toString();
        c.addEventListener('click', function () {
          if (set.has(idx)) { set.delete(idx); c.classList.remove('selected'); }
          else if (set.size < k) { set.add(idx); c.classList.add('selected'); }
        });
        wrap.appendChild(c);
      })(i);
    }
    container.appendChild(wrap);
  }

  function renderKOdd(container, s, k) {
    var title = createElement('div', { class: 'answer-title' });
    title.textContent = 'Marca ' + k + ' monedas anómalas:';
    container.appendChild(title);

    var grid = createElement('div', { class: 'answer-grid' });
    var heavySec = createElement('div', { class: 'answer-section' });
    var lightSec = createElement('div', { class: 'answer-section' });

    var ht = createElement('div', { class: 'section-title' });
    ht.textContent = 'Más pesadas:'; heavySec.appendChild(ht);
    var lt = createElement('div', { class: 'section-title' });
    lt.textContent = 'Más ligeras:'; lightSec.appendChild(lt);

    var hw = createElement('div', { class: 'answer-coins' });
    var lw = createElement('div', { class: 'answer-coins' });

    for (var i = 0; i < s.n_monedas; i++) {
      (function (idx) {
        var h = createElement('div', { class: 'answer-coin' });
        h.textContent = (idx + 1).toString();
        h.addEventListener('click', function () { toggleKOdd(idx, 'heavy', s, h, lw); });
        hw.appendChild(h);

        var l = createElement('div', { class: 'answer-coin' });
        l.textContent = (idx + 1).toString();
        l.addEventListener('click', function () { toggleKOdd(idx, 'light', s, l, hw); });
        lw.appendChild(l);
      })(i);
    }

    heavySec.appendChild(hw);
    lightSec.appendChild(lw);
    grid.appendChild(heavySec);
    grid.appendChild(lightSec);
    container.appendChild(grid);
  }

  function toggleKOdd(index, type, s, clicked, otherWrap) {
    var heavy = s.answer.heavy, light = s.answer.light;
    var target = type === 'heavy' ? heavy : light;
    var other = type === 'heavy' ? light : heavy;

    if (other.has(index)) {
      other.delete(index);
      if (otherWrap && otherWrap.children && otherWrap.children[index]) {
        otherWrap.children[index].classList.remove('selected');
      }
    }
    var total = heavy.size + light.size;
    if (target.has(index)) {
      target.delete(index);
      clicked.classList.remove('selected');
    } else if (total < s.k_impostoras) {
      target.add(index);
      clicked.classList.add('selected');
    } else {
      setStatus(ui.message, 'Solo puedes marcar ' + s.k_impostoras + ' monedas en total', 'info');
    }
  }

  function onCheck(ui, s, cfg, hooks) {
    if (s.weighings === 0) {
      setStatus(ui.message, 'Debes realizar al menos una pesada', 'ko');
      return;
    }

    var user = buildUserAnswer(s);
    if (user.length !== s.anomalies.length) {
      setStatus(ui.message, 'Respuesta incompleta', 'info');
      return;
    }

    var ok = sameAnswer(user, s.anomalies);
    var optimal = balanzaMinWeighings(cfg);

    // Celebración o mensaje de mejora
    if (ok) {
      s.gameWon = true;
      celebrate({
        ok: true,
        title: '¡Excelente deducción!',
        message: 'Has descubierto al impostor como un verdadero detective'
      });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ pesadas: s.weighings });
      if (s.weighings <= optimal) {
        setStatus(ui.message, '¡Perfecto! Lo has logrado en el mínimo teórico (' + optimal + ') o menos.', 'ok');
      } else {
        setStatus(ui.message, 'Correcto, pero se puede en ' + optimal + ' pesadas. ¡Prueba a mejorar!', 'info');
      }
      setStatus(ui.result, '', '');
    } else {
      var sol = s.anomalies.map(function (a) { return (a.i + 1) + (a.sign > 0 ? '↑' : '↓'); }).join(', ');
      setStatus(ui.result, 'Incorrecto. Solución: ' + sol, 'ko');
    }

    // Enviar resultados (si hooks.onSubmit existe)
    var payload = {
      type: 'balance',
      variant: s.variant,
      n_monedas: s.n_monedas,
      k_impostoras: s.k_impostoras,
      max_pesadas: s.max_pesadas,
      weighings: s.weighings,
      optimal: optimal,
      userAnswer: user.slice(),
      success: ok === true,
      history: s.log.slice() // {left,right,result}
    };
    if (hooks && typeof hooks.onSubmit === 'function') {
      try { hooks.onSubmit(payload); } catch (e) { /* no-op */ }
    }
  }

  function buildUserAnswer(s) {
    var v = s.variant;
    var out = [];
    if (v === 'pesada' && s.answer.single !== null) {
      out = [{ i: s.answer.single, sign: 1 }];
    } else if (v === 'ligera' && s.answer.single !== null) {
      out = [{ i: s.answer.single, sign: -1 }];
    } else if (v === 'desconocida' && s.answer.single !== null) {
      out = [{ i: s.answer.single, sign: s.answer.singleSign }];
    } else if (v === 'pesadas-multiples') {
      out = Array.from(s.answer.heavy).map(function (i) { return { i: i, sign: 1 }; });
    } else if (v === 'ligeras-multiples') {
      out = Array.from(s.answer.light).map(function (i) { return { i: i, sign: -1 }; });
    } else if (v === 'desconocidas-multiples') {
      out = []
        .concat(Array.from(s.answer.heavy).map(function (i) { return { i: i, sign: 1 }; }))
        .concat(Array.from(s.answer.light).map(function (i) { return { i: i, sign: -1 }; }));
    }
    return out;
  }

  function sameAnswer(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var sa = a.map(function (x) { return x.i + ':' + x.sign; }).sort().join('|');
    var sb = b.map(function (x) { return x.i + ':' + x.sign; }).sort().join('|');
    return sa === sb;
  }

  // ========================= UI HELPERS =========================
  function buildShell() {
    const box = createElement('div', { class: 'template-box balance-game' });

    // Cabecera estándar (oscura) + barrido
    const { nombre, icono } = tipoInfo('balanza-logica');
    const header = createElement('div', { class: 'enigma-header-dark' });
    const hImg = createElement('img', { src: icono, alt: '' });
    hImg.onerror = function () { hImg.style.display = 'none'; };
    const h2 = document.createElement('h2'); h2.textContent = nombre;
    header.appendChild(hImg);
    header.appendChild(h2);
    box.appendChild(header);

    // Tarjeta Deceerre
    const card = createElement('div', { class: 'card deceerre-instructions' });
    const cImg = createElement('img', { src: 'assets/deceerre-instructions.png', alt: 'Deceerre' });
    cImg.onerror = function () { cImg.style.display = 'none'; };
    const cBody = createElement('div', { class: 'instructions-body' });
    const cH3 = document.createElement('h3'); cH3.textContent = 'Cómo se juega';
    const cP = document.createElement('p');
    cP.innerHTML = 'Selecciona monedas y colócalas en los <strong>platos</strong>. Pesa con lógica para descubrir el impostor.';
    const inst = createElement('div', { class: 'instructions-content balance-instructions' });
    cBody.appendChild(cH3); cBody.appendChild(cP); cBody.appendChild(inst);
    card.appendChild(cImg); card.appendChild(cBody);
    box.appendChild(card);

    // Clúster central
    const status = createElement('div', { class: 'feedback' }); status.textContent = 'Cargando...'; box.appendChild(status);

    const info = createElement('div', { class: 'weighings-info' });
    info.innerHTML = '<span>Pesadas: </span><strong><span class="weighings-count">0</span></strong>';
    box.appendChild(info);

    const board = createElement('section', { class: 'ein-board' });
    const boardTitle = document.createElement('h2'); boardTitle.textContent = 'Balanza';
    const boardDiv = document.createElement('div');
    board.appendChild(boardTitle); board.appendChild(boardDiv);
    box.appendChild(board);

    const coinsSec = createElement('section', { class: 'ein-palette' });
    const coinsTitle = document.createElement('h2'); coinsTitle.textContent = 'Monedas';
    const coinsDiv = createElement('div', { class: 'balance-coins' });
    coinsSec.appendChild(coinsTitle); coinsSec.appendChild(coinsDiv);
    box.appendChild(coinsSec);

    const result = createElement('div', { class: 'feedback' }); box.appendChild(result);

    const toolbar = createElement('div', { class: 'balance-controls' });
    const weighBtn = createElement('button', { class: 'btn' }); weighBtn.textContent = 'Pesar';
    const clearBtn = createElement('button', { class: 'btn btn-secondary' }); clearBtn.textContent = 'Vaciar';
    const resetBtn = createElement('button', { class: 'btn btn-secondary' }); resetBtn.textContent = 'Reiniciar';
    toolbar.appendChild(weighBtn); toolbar.appendChild(clearBtn); toolbar.appendChild(resetBtn);
    box.appendChild(toolbar);

    const answerSec = createElement('section', { class: 'ein-clues balance-answer-section' });
    const aH2 = document.createElement('h2'); aH2.textContent = 'Tu respuesta';
    const answerDiv = createElement('div', { class: 'balance-answer' });
    const checkBtn = createElement('button', { class: 'btn btn-primary' }); checkBtn.textContent = 'Comprobar';
    const message = createElement('div', { class: 'feedback' });
    answerSec.appendChild(aH2);
    answerSec.appendChild(answerDiv);
    answerSec.appendChild(checkBtn);
    answerSec.appendChild(message);
    box.appendChild(answerSec);

    return {
      box: box,
      status: status,
      instructions: inst,
      weighingsCount: info.querySelector('.weighings-count'),
      balanceContainer: boardDiv,
      coinsContainer: coinsDiv,
      weighButton: weighBtn,
      clearButton: clearBtn,
      resetButton: resetBtn,
      answerContainer: answerDiv,
      checkButton: checkBtn,
      result: result,
      message: message
    };
  }

  function updateInstructions(el, cfg) {
    var t = '';
    switch (cfg.variant) {
      case 'pesada': t = 'De estas ' + cfg.n_monedas + ' monedas, una es más pesada que el resto.'; break;
      case 'ligera': t = 'De estas ' + cfg.n_monedas + ' monedas, una es más ligera que el resto.'; break;
      case 'desconocida': t = 'De estas ' + cfg.n_monedas + ' monedas, una tiene un peso distinto al resto.'; break;
      case 'pesadas-multiples': t = 'De estas ' + cfg.n_monedas + ' monedas, hay ' + cfg.k_impostoras + ' más pesadas que el resto.'; break;
      case 'ligeras-multiples': t = 'De estas ' + cfg.n_monedas + ' monedas, hay ' + cfg.k_impostoras + ' más ligeras que el resto.'; break;
      case 'desconocidas-multiples': t = 'De estas ' + cfg.n_monedas + ' monedas, hay ' + cfg.k_impostoras + ' con peso distinto (más pesadas o más ligeras).'; break;
    }
    el.textContent = t;
  }

  // ========================= Utils base =========================
  async function loadConfig(d) {
    if (d && d.json_url) {
      const r = await fetch(d.json_url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    }
    return d;
  }

  function createElement(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else el.setAttribute(k, v);
      });
    }
    return el;
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'feedback';
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

  function animateBalance(container, tilt) {
    var beam = container.querySelector('#balance-beam');
    if (!beam) return;
    setTimeout(function () {
      if (tilt === 'left') beam.style.transform = 'translateX(-50%) rotate(-6deg)';
      else if (tilt === 'right') beam.style.transform = 'translateX(-50%) rotate(6deg)';
      else beam.style.transform = 'translateX(-50%) rotate(0deg)';
    }, 30);
  }

}
