// ===== scripts/senal-logic.js =====
// Señal Perdida. Cada letra del alfabeto usado en un mensaje está anclada a
// una coordenada (x,y) de una rejilla; el jugador solo tiene pistas
// parciales sobre esas coordenadas (paridad, primo, cuadrado perfecto,
// suma, orden, mismo eje, consecutivos) y debe deducir dónde va cada letra.
// Al completar la rejilla, leer las coordenadas del mensaje cifrado en
// orden revela la palabra.
//
// LA CLAVE de diseño (probada antes con un prototipo desechable, ver
// memoria): con una rejilla del tamaño mínimo que cabe justo el alfabeto,
// la combinación de solo 3 propiedades de una letra (paridad+primo+cuadrado
// de una coordenada) YA determina esa coordenada de forma única y aislada
// -- el solver de poda entonces prefiere quedarse solo con pistas "por
// letra" y el puzzle se resuelve letra a letra, sin ninguna deducción
// cruzada real, muy lejos de la premisa. La rejilla tiene que ser more
// GRANDE que el alfabeto (mínimo 6 de lado) para que esas firmas choquen
// entre sí (en 0..5, el 0 y el 4 comparten paridad+primo+cuadrado, igual
// que el 3 y el 5) y el solver se vea obligado a tirar de pistas
// RELACIONALES (suma, orden, mismo, consecutivos) para desempatar.
//
// La poda va HACIA ATRÁS, no hacia delante (mismo patrón que
// riego-plantas/radar-asteroides/planos-del-invernadero): empezar con
// TODAS las pistas candidatas (unicidad gratis, es la solución real) y
// quitar probando primero las más "fuertes" (posición absoluta, luego
// suma/producto, luego relaciones binarias, dejando paridad/primo/cuadrado
// para el final) -- un greedy hacia DELANTE (ir añadiendo la que más
// reduce en cada paso) siempre elige posición absoluta primero por ser la
// más informativa, y el puzzle sale con casi todas las letras ancladas de
// fábrica.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eligeEje(opciones, seed, mascara) {
  return opciones[Math.floor(mulberry32((seed ^ mascara) >>> 0)() * opciones.length)];
}

// Banco de palabras: sin tildes ni Ñ (coordenadas ASCII simples), tope de 8
// letras DISTINTAS (no de longitud total) -- por encima de eso la rejilla
// (tamanoRejilla) crece lo bastante para que el solver tarde segundos en
// el peor caso; MURCIELAGO (10 distintas) y LABERINTO (9) se descartaron
// por esto tras medirlo con un barrido de 300 seeds.
export const BANCO_PALABRAS = [
  'ENIGMA', 'CIRCUITO', 'ESTRELLA', 'PUENTE', 'CIFRADO', 'BALANZA',
  'LINTERNA', 'CARTOGRAFO', 'TELESCOPIO', 'BRUJULA', 'ASTEROIDE',
  'PENDULO', 'MECANISMO', 'SATELITE'
];

export function ejesDeSeed(seed) {
  return { palabra: eligeEje(BANCO_PALABRAS, seed, 0x2f6b91d3) };
}

export function varianteDeSeed(seed) {
  const { palabra } = ejesDeSeed(seed);
  return palabra.toLowerCase();
}

function esPrimo(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
function esCuadrado(n) {
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

// N tiene que ser > 5 para que ninguna coordenada quede identificada de
// forma unica solo por paridad+primo+cuadrado (ver nota de cabecera).
export function tamanoRejilla(k) {
  return Math.max(6, k);
}

function generaPosiciones(letras, n, rng) {
  const celdas = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) celdas.push([x, y]);
  for (let i = celdas.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [celdas[i], celdas[j]] = [celdas[j], celdas[i]];
  }
  const pos = {};
  letras.forEach((l, i) => { pos[l] = celdas[i]; });
  return pos;
}

export function generaPistasCandidatas(letras, pos) {
  const cand = [];
  for (const a of letras) {
    const [xa, ya] = pos[a];
    cand.push({ tipo: 'paridad_x', a, valor: xa % 2 === 0 ? 'par' : 'impar' });
    cand.push({ tipo: 'paridad_y', a, valor: ya % 2 === 0 ? 'par' : 'impar' });
    if (esPrimo(xa)) cand.push({ tipo: 'primo_x', a, valor: true });
    if (esPrimo(ya)) cand.push({ tipo: 'primo_y', a, valor: true });
    if (esCuadrado(xa)) cand.push({ tipo: 'cuadrado_x', a, valor: true });
    if (esCuadrado(ya)) cand.push({ tipo: 'cuadrado_y', a, valor: true });
    cand.push({ tipo: 'posicion_absoluta', a, valor: [xa, ya] });
  }
  for (const a of letras) {
    for (const b of letras) {
      if (a >= b) continue;
      const [xa, ya] = pos[a];
      const [xb, yb] = pos[b];
      cand.push({ tipo: 'suma_x', a, b, valor: xa + xb });
      cand.push({ tipo: 'suma_y', a, b, valor: ya + yb });
      cand.push({ tipo: 'mismo_x', a, b, valor: xa === xb });
      cand.push({ tipo: 'mismo_y', a, b, valor: ya === yb });
      cand.push({ tipo: 'orden_x', a, b, valor: xa < xb });
      cand.push({ tipo: 'orden_y', a, b, valor: ya < yb });
      cand.push({ tipo: 'consecutivos_x', a, b, valor: Math.abs(xa - xb) === 1 });
      cand.push({ tipo: 'producto_x', a, b, valor: xa * xb });
    }
  }
  return cand;
}

export function cumplePista(pista, asign) {
  const { tipo } = pista;
  if (tipo === 'posicion_absoluta') {
    const [x, y] = asign[pista.a];
    return x === pista.valor[0] && y === pista.valor[1];
  }
  if (tipo === 'paridad_x') return (asign[pista.a][0] % 2 === 0 ? 'par' : 'impar') === pista.valor;
  if (tipo === 'paridad_y') return (asign[pista.a][1] % 2 === 0 ? 'par' : 'impar') === pista.valor;
  if (tipo === 'primo_x') return esPrimo(asign[pista.a][0]) === pista.valor;
  if (tipo === 'primo_y') return esPrimo(asign[pista.a][1]) === pista.valor;
  if (tipo === 'cuadrado_x') return esCuadrado(asign[pista.a][0]) === pista.valor;
  if (tipo === 'cuadrado_y') return esCuadrado(asign[pista.a][1]) === pista.valor;
  const [xa, ya] = asign[pista.a];
  const [xb, yb] = asign[pista.b];
  if (tipo === 'suma_x') return xa + xb === pista.valor;
  if (tipo === 'suma_y') return ya + yb === pista.valor;
  if (tipo === 'mismo_x') return (xa === xb) === pista.valor;
  if (tipo === 'mismo_y') return (ya === yb) === pista.valor;
  if (tipo === 'orden_x') return (xa < xb) === pista.valor;
  if (tipo === 'orden_y') return (ya < yb) === pista.valor;
  if (tipo === 'consecutivos_x') return (Math.abs(xa - xb) === 1) === pista.valor;
  if (tipo === 'producto_x') return xa * xb === pista.valor;
  throw new Error(`tipo de pista desconocido: ${tipo}`);
}

// Cuenta asignaciones letra->celda (biyeccion) que cumplen TODAS las
// pistas, con early-exit en `tope` -- mismo patron que el resto del
// catalogo (fabrica-de-bloques, planos-del-invernadero, radar-asteroides).
export function contarSoluciones(letras, n, pistas, { tope = 2 } = {}) {
  const todasLasCeldas = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) todasLasCeldas.push([x, y]);

  // Poda de dominio (arc-consistency de grado 1): las pistas UNARIAS (sobre
  // una sola letra) se aplican una vez, antes del backtracking, en vez de
  // re-evaluarse celda a celda en cada rama -- sin esto, palabras largas
  // con muchas pistas unarias tardaban hasta 28s en el peor caso.
  const unarias = pistas.filter((p) => !p.b);
  const binarias = pistas.filter((p) => p.b);
  const dominio = {};
  for (const l of letras) {
    const propias = unarias.filter((p) => p.a === l);
    dominio[l] = todasLasCeldas.filter((celda) => {
      const asignParcial = { [l]: celda };
      return propias.every((p) => cumplePista(p, asignParcial));
    });
  }

  // MRV (minimum remaining values): la letra con el dominio mas pequeño va
  // primero, para fallar lo antes posible -- mucho mas efectivo aqui que
  // ordenar por numero de pistas.
  const ordenLetras = [...letras].sort((a, b) => dominio[a].length - dominio[b].length);

  const binariasPorNivel = ordenLetras.map((_, i) => {
    const asignadasHasta = new Set(ordenLetras.slice(0, i + 1));
    return binarias.filter((p) => [p.a, p.b].every((l) => asignadasHasta.has(l)));
  });

  const usada = new Set();
  const asign = {};
  let count = 0;
  let primera = null;

  function backtrack(i) {
    if (count >= tope) return;
    if (i === ordenLetras.length) {
      count++;
      if (!primera) primera = { ...asign };
      return;
    }
    const letra = ordenLetras[i];
    for (const celda of dominio[letra]) {
      const clave = celda[0] * n + celda[1];
      if (usada.has(clave)) continue;
      asign[letra] = celda;
      usada.add(clave);
      let ok = true;
      for (const p of binariasPorNivel[i]) {
        if (!cumplePista(p, asign)) { ok = false; break; }
      }
      if (ok) backtrack(i + 1);
      usada.delete(clave);
      if (count >= tope) { delete asign[letra]; return; }
    }
    delete asign[letra];
  }
  backtrack(0);
  return { soluciones: count, primera };
}

// orden de intento de retirada durante la poda: las mas "fuertes" primero
// (mas facil que sobren), las mas "debiles" al final (mas facil que se
// queden, porque son las que de verdad hacen falta deducir).
const FUERZA_RETIRADA = {
  posicion_absoluta: 0,
  suma_x: 1, suma_y: 1, producto_x: 1,
  mismo_x: 2, mismo_y: 2, orden_x: 2, orden_y: 2, consecutivos_x: 2,
  paridad_x: 3, paridad_y: 3, primo_x: 3, primo_y: 3, cuadrado_x: 3, cuadrado_y: 3
};

export function construyeRetoUnico(letras, n, candidatas, tope = 2) {
  let reveladas = [...candidatas].sort((a, b) => FUERZA_RETIRADA[a.tipo] - FUERZA_RETIRADA[b.tipo]);
  const { soluciones: inicial } = contarSoluciones(letras, n, reveladas, { tope });
  if (inicial !== 1) return { pistas: reveladas, soluciones: inicial };

  for (let i = 0; i < reveladas.length; ) {
    const sinEsta = reveladas.filter((_, j) => j !== i);
    const { soluciones } = contarSoluciones(letras, n, sinEsta, { tope });
    if (soluciones === 1) {
      reveladas = sinEsta;
    } else {
      i++;
    }
  }
  return { pistas: reveladas, soluciones: 1 };
}

// ---------- Construcción del reto completo ----------

export function buildSenalPuzzle(seed) {
  const rng = mulberry32(seed);
  const { palabra } = ejesDeSeed(seed);
  const letras = [...new Set(palabra.split(''))];
  const n = tamanoRejilla(letras.length);
  const pos = generaPosiciones(letras, n, rng);
  const candidatas = generaPistasCandidatas(letras, pos);
  const { pistas, soluciones } = construyeRetoUnico(letras, n, candidatas, 2);
  if (soluciones !== 1) {
    throw new Error(`señal-perdida: no se alcanzó solución única para "${palabra}" (seed ${seed})`);
  }

  const mensajeCifrado = palabra.split('').map((l) => pos[l]);
  const dificultad = letras.length <= 6 ? 3 : letras.length <= 8 ? 4 : 5;

  return {
    palabra,
    alfabeto: letras,
    tablero: { ancho: n, alto: n },
    solucion: pos,
    mensajeCifrado,
    pistas,
    dificultad
  };
}

// ---------- Texto de pistas en español, para la plantilla y el validador ----------

export function pistaTexto(pista) {
  const { tipo, a, b, valor } = pista;
  if (tipo === 'posicion_absoluta') return `La letra ${a} está en la columna ${valor[0]}, fila ${valor[1]}.`;
  if (tipo === 'paridad_x') return `La columna de la letra ${a} es ${valor}.`;
  if (tipo === 'paridad_y') return `La fila de la letra ${a} es ${valor}.`;
  if (tipo === 'primo_x') return `La columna de la letra ${a} es un número primo.`;
  if (tipo === 'primo_y') return `La fila de la letra ${a} es un número primo.`;
  if (tipo === 'cuadrado_x') return `La columna de la letra ${a} es un cuadrado perfecto.`;
  if (tipo === 'cuadrado_y') return `La fila de la letra ${a} es un cuadrado perfecto.`;
  if (tipo === 'suma_x') return `Las columnas de ${a} y ${b} suman ${valor}.`;
  if (tipo === 'suma_y') return `Las filas de ${a} y ${b} suman ${valor}.`;
  if (tipo === 'producto_x') return `Las columnas de ${a} y ${b} multiplicadas dan ${valor}.`;
  if (tipo === 'mismo_x') return valor
    ? `${a} y ${b} están en la misma columna.`
    : `${a} y ${b} NO están en la misma columna.`;
  if (tipo === 'mismo_y') return valor
    ? `${a} y ${b} están en la misma fila.`
    : `${a} y ${b} NO están en la misma fila.`;
  if (tipo === 'orden_x') return valor
    ? `${a} está en una columna anterior a ${b}.`
    : `${a} está en una columna posterior a ${b}.`;
  if (tipo === 'orden_y') return valor
    ? `${a} está en una fila anterior a ${b}.`
    : `${a} está en una fila posterior a ${b}.`;
  if (tipo === 'consecutivos_x') return valor
    ? `${a} y ${b} están en columnas consecutivas.`
    : `${a} y ${b} NO están en columnas consecutivas.`;
  throw new Error(`tipo de pista desconocido: ${tipo}`);
}
