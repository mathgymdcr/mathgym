// ===== scripts/invernadero-logic.js =====
// Planos del Invernadero · Shikaku. Rejilla NxN dividida en módulos
// rectangulares: cada uno lleva exactamente una pista, cuyo número es el
// área (en celdas) de su módulo. Compartido entre el generador y el
// validador -- mismo patrón mulberry32 + eligeEje (máscara propia por eje)
// que usa el resto del catálogo.

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

const TAMANO_OPCIONES = [6, 8, 10];

export function ejesDeSeed(seed) {
  return {
    tamano: eligeEje(TAMANO_OPCIONES, seed, 0x8f3a1d76)
  };
}

export function varianteDeSeed(seed) {
  const { tamano } = ejesDeSeed(seed);
  return `${tamano}`;
}

// Reparte el tablero en rectangulos por cortes de guillotina recursivos:
// mientras el area supere `areaMax` (o a veces incluso sin superarla, para
// variar el tamano de los modulos), corta el rectangulo en dos por una
// linea recta -- eso basta para que cada pieza siga siendo un rectangulo,
// sin enumerar formas como hace poligono-logic.js (ahi hacen falta piezas
// no rectangulares).
export function generaParticion(n, rng, areaMax = 9) {
  const rects = [];

  function corta(f, c, alto, ancho) {
    const area = alto * ancho;
    const puedeCortarVertical = ancho >= 2;
    const puedeCortarHorizontal = alto >= 2;
    const debeCortar = area > areaMax && (puedeCortarVertical || puedeCortarHorizontal);
    // Aunque quepa entera, a veces se corta igual (30%) para variar el
    // tamano de los modulos en vez de maximizar siempre cada pieza.
    const quiereCortar = (puedeCortarVertical || puedeCortarHorizontal) && rng() < 0.3;

    if (!debeCortar && !quiereCortar) {
      rects.push({ f, c, ancho, alto });
      return;
    }

    // Si solo cabe un sentido de corte, se usa ese; si caben los dos, se
    // sortea -- salvo que el area obligue a preferir el sentido que más
    // reduce (partir por el lado largo).
    let vertical;
    if (puedeCortarVertical && puedeCortarHorizontal) {
      vertical = ancho >= alto ? rng() < 0.65 : rng() < 0.35;
    } else {
      vertical = puedeCortarVertical;
    }

    if (vertical) {
      const corte = 1 + Math.floor(rng() * (ancho - 1));
      corta(f, c, alto, corte);
      corta(f, c + corte, alto, ancho - corte);
    } else {
      const corte = 1 + Math.floor(rng() * (alto - 1));
      corta(f, c, corte, ancho);
      corta(f + corte, c, alto - corte, ancho);
    }
  }

  corta(0, 0, n, n);
  return rects;
}

// Todos los pares (alto, ancho) con alto*ancho === area.
function factorPares(area) {
  const pares = [];
  for (let alto = 1; alto <= area; alto++) {
    if (area % alto !== 0) continue;
    pares.push([alto, area / alto]);
  }
  return pares;
}

// Candidatos de una pista: todo rectangulo de su area que la contenga, quepa
// en el tablero y no contenga NINGUNA otra pista -- una solucion valida da
// exactamente una pista por rectangulo, asi que un candidato que arrastre
// una segunda pista nunca puede ser el bueno, se decida lo que se decida
// para el resto del tablero.
function candidatosDe(n, clue, otrasPistas) {
  const candidatos = [];
  for (const [alto, ancho] of factorPares(clue.valor)) {
    if (alto > n || ancho > n) continue;
    const fMin = Math.max(0, clue.f - alto + 1);
    const fMax = Math.min(clue.f, n - alto);
    const cMin = Math.max(0, clue.c - ancho + 1);
    const cMax = Math.min(clue.c, n - ancho);
    for (let f = fMin; f <= fMax; f++) {
      for (let c = cMin; c <= cMax; c++) {
        const otraDentro = otrasPistas.some(
          (p) => p.f >= f && p.f < f + alto && p.c >= c && p.c < c + ancho
        );
        if (!otraDentro) candidatos.push({ f, c, ancho, alto });
      }
    }
  }
  return candidatos;
}

// Cuenta reparticiones validas (backtracking con MRV: la pista con menos
// candidatos va primero, para fallar rapido) hasta `tope`. No hace falta
// comprobar cobertura completa al final: como cada candidato tiene
// exactamente el area de su pista y la suma de todas las pistas es el area
// del tablero (por construccion, ver buildInvernaderoPuzzle), un conjunto
// de rectangulos SIN SOLAPES cuya area total llena el tablero lo cubre
// entero -- no puede quedar hueco.
export function contarSoluciones(n, clues, opts = {}) {
  const tope = opts.tope != null ? opts.tope : 10;

  const listas = clues.map((clue, idx) => ({
    clue,
    idx,
    candidatos: candidatosDe(n, clue, clues.filter((p) => p !== clue))
  }));
  listas.sort((a, b) => a.candidatos.length - b.candidatos.length);

  if (listas.some((l) => l.candidatos.length === 0)) {
    return { soluciones: 0, primera: null };
  }

  const ocupado = Array.from({ length: n }, () => Array(n).fill(false));
  const elegidos = new Array(listas.length);
  let soluciones = 0;
  let primera = null;

  function cabe(rect) {
    for (let f = rect.f; f < rect.f + rect.alto; f++) {
      for (let c = rect.c; c < rect.c + rect.ancho; c++) {
        if (ocupado[f][c]) return false;
      }
    }
    return true;
  }

  function marca(rect, valor) {
    for (let f = rect.f; f < rect.f + rect.alto; f++) {
      for (let c = rect.c; c < rect.c + rect.ancho; c++) ocupado[f][c] = valor;
    }
  }

  // true si hay que parar (se alcanzo el tope).
  function rec(i) {
    if (i === listas.length) {
      soluciones++;
      if (!primera) {
        // `elegidos` esta en el orden MRV (menos candidatos primero), no en
        // el orden original de `clues` -- se reordena aqui para que quien
        // llama pueda emparejar primera[k] con clues[k] sin sorpresas.
        const enOrden = new Array(clues.length);
        listas.forEach((l, pos) => { enOrden[l.idx] = elegidos[pos]; });
        primera = enOrden.map((r) => ({ ...r }));
      }
      return soluciones >= tope;
    }

    for (const rect of listas[i].candidatos) {
      if (!cabe(rect)) continue;
      marca(rect, true);
      elegidos[i] = rect;
      const parar = rec(i + 1);
      marca(rect, false);
      if (parar) return true;
    }
    return false;
  }

  rec(0);
  return { soluciones, primera };
}

function dificultadDe(tamano) {
  return Math.min(5, { 6: 2, 8: 3, 10: 4 }[tamano]);
}

// Una pista por rectangulo, en una celda al azar dentro de el -- el valor
// es su area, asi que la solvencia sale gratis por construccion (misma
// tecnica que cinta-transportadora y fabrica-de-bloques). Lo que SI hay que
// comprobar aparte es la UNICIDAD: dos particiones distintas pueden admitir
// pistas compatibles con mas de un reparto (ver el caso de dos pistas de
// area 8 en un 4x4), asi que se reintenta con una particion nueva hasta que
// contarSoluciones confirma que no hay otra.
export function buildInvernaderoPuzzle(seed) {
  const { tamano } = ejesDeSeed(seed);
  const rng = mulberry32(seed);
  const areaMax = Math.max(4, Math.floor((tamano * tamano) / 6));

  const MAX_INTENTOS = 300;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const rects = generaParticion(tamano, rng, areaMax);
    const pistas = rects.map((r) => {
      const f = r.f + Math.floor(rng() * r.alto);
      const c = r.c + Math.floor(rng() * r.ancho);
      return { f, c, valor: r.ancho * r.alto };
    });

    const { soluciones } = contarSoluciones(tamano, pistas, { tope: 2 });
    if (soluciones === 1) {
      return {
        variant: varianteDeSeed(seed),
        dificultad: dificultadDe(tamano),
        payload: {
          tablero: { ancho: tamano, alto: tamano },
          pistas,
          solucion: rects
        }
      };
    }
  }

  throw new Error(
    `buildInvernaderoPuzzle: no se encontro una particion con solucion unica ` +
    `tras ${MAX_INTENTOS} intentos (seed=${seed}, tamano=${tamano})`
  );
}
