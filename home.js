// ===== home.js =====
// La sala de entrenamiento: lo que se ve en index.html antes de empezar el
// reto. Las derivaciones de datos viven separadas del pintado para poder
// comprobarlas sin montar la página.

import { TIPOS, GRUPOS, tipoInfo } from './catalogo-tipos.js';

export { GRUPOS };

const INICIALES_DIA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// El "mínimo" que enseña la ficha del día. Casi todos los tipos guardan el par
// en `objectives.parMoves`, pero en el enigma lo que mide el reto son las
// pistas y en la balanza las pesadas: enseñar "movimientos" ahí sería mentir.
function minimoDe(objectives) {
  if (!objectives) return null;
  if (Number.isFinite(objectives.numPistas)) {
    return { valor: objectives.numPistas, unidad: 'pistas' };
  }
  if (Number.isFinite(objectives.maxWeighingsFor3Stars)) {
    return { valor: objectives.maxWeighingsFor3Stars, unidad: 'pesadas' };
  }
  if (Number.isFinite(objectives.parMoves)) {
    return { valor: objectives.parMoves, unidad: 'movimientos' };
  }
  return null;
}

export function metaDeReto(reto) {
  return {
    dificultad: reto.dificultad || 0,
    minimo: minimoDe(reto.objectives),
    categorias: reto.categorias || []
  };
}

// Los siete últimos días terminando en `fechaHoy`, que es la fecha DEL RETO y
// no la del reloj del navegador: si no, el carné se desfasa con el reto cada
// vez que el día cambia en Madrid pero no en UTC.
export function diasDelCarne(fechaHoy, completadas = {}) {
  const [y, m, d] = fechaHoy.split('-').map(Number);
  const dias = [];
  for (let atras = 6; atras >= 0; atras--) {
    const fecha = new Date(Date.UTC(y, m - 1, d - atras));
    const iso = fecha.toISOString().slice(0, 10);
    const dia = completadas[iso];
    dias.push({
      fecha: iso,
      inicial: INICIALES_DIA[fecha.getUTCDay()],
      diaDelMes: fecha.getUTCDate(),
      esHoy: atras === 0,
      hecho: Boolean(dia),
      // Los días guardados antes de que existieran las estrellas no tienen
      // marca: se enseñan como completados y sin estrellas, sin inventarlas.
      estrellas: dia && Number.isFinite(dia.estrellas) ? dia.estrellas : 0
    });
  }
  return dias;
}

export function tiposPorGrupo() {
  return GRUPOS.map((grupo) => ({
    grupo,
    tipos: TIPOS.filter((t) => t.grupo === grupo)
  }));
}

export { tipoInfo };

function el(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto != null) nodo.textContent = texto;
  return nodo;
}

function pintarFicha(reto) {
  const card = el('div', 'workout-card');
  card.appendChild(el('div', 'eyebrow', 'Hoy toca'));

  if (!reto) {
    card.appendChild(el('h1', 'workout-name', 'El reto de hoy no se pudo cargar'));
    card.appendChild(el('p', 'workout-desc',
      'Vuelve a intentarlo en un momento. Mientras, puedes entrenar con cualquier ejercicio de abajo.'));
    return card;
  }

  const ficha = tipoInfo(reto.tipo);
  card.appendChild(el('h1', 'workout-name', reto.titulo));
  card.appendChild(el('p', 'workout-desc', ficha.resumen));

  const meta = metaDeReto(reto);
  const fila = el('div', 'meta-row');

  const dificultad = el('div', 'meta-item', 'Dificultad');
  dificultad.setAttribute('data-meta', 'dificultad');
  const puntos = el('b', null);
  const dots = el('span', 'difficulty-dots');
  dots.setAttribute('title', `Dificultad ${meta.dificultad}/5`);
  for (let i = 1; i <= 5; i++) dots.appendChild(el('span', i <= meta.dificultad ? 'on' : null));
  puntos.appendChild(dots);
  dificultad.appendChild(puntos);
  fila.appendChild(dificultad);

  // Sin par que enseñar, la columna no se pinta: mejor un hueco menos que un
  // dato inventado.
  if (meta.minimo) {
    const minimo = el('div', 'meta-item', 'Mínimo');
    minimo.setAttribute('data-meta', 'minimo');
    minimo.appendChild(el('b', 'mono', `${meta.minimo.valor} ${meta.minimo.unidad}`));
    fila.appendChild(minimo);
  }

  if (meta.categorias.length) {
    const cats = el('div', 'meta-item', 'Categorías');
    cats.setAttribute('data-meta', 'categorias');
    cats.appendChild(el('b', null, meta.categorias.join(' · ')));
    fila.appendChild(cats);
  }

  card.appendChild(fila);

  const cta = el('button', 'cta', '🏋️ Empezar serie');
  cta.setAttribute('type', 'button');
  cta.setAttribute('data-action', 'entrenar');
  card.appendChild(cta);
  return card;
}

function pintarCoach() {
  const coach = el('div', 'coach');
  const figura = el('div', 'coach-figure');
  const img = el('img');
  img.src = 'assets/deceerre.png';
  img.alt = 'Deceerre, tu entrenador';
  figura.appendChild(img);
  coach.appendChild(figura);

  const bocadillo = el('div', 'coach-bubble');
  bocadillo.appendChild(el('b', null, 'Deceerre:'));
  // Las pistas del reto NO se asoman aquí: son media solución y esto es la
  // portada. Dentro del juego están, a un clic, cuando hagan falta.
  bocadillo.appendChild(document.createTextNode(
    ' un reto nuevo cada día. Lo que entrena no es acertar, es volver mañana.'));
  coach.appendChild(bocadillo);
  return coach;
}

function pintarCarne(reto, progreso) {
  const seccion = el('section', 'streak');

  const cabeza = el('div', 'streak-head');
  cabeza.appendChild(el('h2', null, 'Carné de asistencia'));
  const cuentas = el('div', 'streak-counts');
  const cuentasVisibles = [
    ['Racha actual', progreso.currentStreak],
    ['Mejor racha', progreso.bestStreak],
    ['Estrellas', progreso.totalEstrellas]
  ];
  for (const [etiqueta, valor] of cuentasVisibles) {
    const dato = el('span', null, etiqueta + ' ');
    dato.appendChild(el('b', null, String(valor || 0)));
    cuentas.appendChild(dato);
  }
  cabeza.appendChild(cuentas);
  seccion.appendChild(cabeza);

  const carne = el('div', 'punchcard');
  const hoy = (reto && reto.fecha) || new Date().toISOString().slice(0, 10);
  for (const dia of diasDelCarne(hoy, progreso.completed)) {
    const punch = el('div', 'punch' + (dia.esHoy ? ' today' : '') + (dia.hecho ? ' done' : ''));
    punch.appendChild(el('span', 'dow', dia.inicial));
    punch.appendChild(el('span', 'dom', String(dia.diaDelMes)));
    if (dia.estrellas > 0) {
      punch.appendChild(el('span', 'punch-estrellas', '★'.repeat(dia.estrellas)));
    }
    punch.setAttribute('aria-label',
      dia.fecha + (dia.esHoy ? ' (hoy)' : '')
      + (dia.hecho ? ` — completado${dia.estrellas ? `, ${dia.estrellas} estrellas` : ''}` : ' — sin completar'));
    carne.appendChild(punch);
  }
  seccion.appendChild(carne);
  return seccion;
}

function pintarGrupos() {
  const seccion = el('section', 'groups');

  const cabeza = el('div', 'groups-head');
  cabeza.appendChild(el('h2', 'display', 'Grupos musculares'));
  cabeza.appendChild(el('p', null,
    `${TIPOS.length} ejercicios, agrupados por el tipo de músculo mental que trabajan`));
  seccion.appendChild(cabeza);

  for (const { grupo, tipos } of tiposPorGrupo()) {
    const bloque = el('div', 'group');
    bloque.appendChild(el('div', 'group-label', grupo));
    const fila = el('div', 'exercise-row');
    for (const t of tipos) {
      const ficha = el('a', 'exercise');
      ficha.href = `?tipo=${t.tipo}`;
      ficha.dataset.tipo = t.tipo;   // por él lo pilla el router, sin parsear la URL
      ficha.appendChild(el('div', 'exercise-name', t.nombre));
      ficha.appendChild(el('div', 'exercise-hint', t.resumen));
      fila.appendChild(ficha);
    }
    bloque.appendChild(fila);
    seccion.appendChild(bloque);
  }
  return seccion;
}

// Monta la sala entera dentro de `root`. El reto puede venir a null (falló la
// carga): la ficha del día lo dice y el resto de la sala sigue en pie.
export function pintarSala(root, { reto, progreso = {} }) {
  root.textContent = '';
  const hero = el('section', 'hero');
  hero.appendChild(pintarFicha(reto));
  hero.appendChild(pintarCoach());
  root.appendChild(hero);
  root.appendChild(pintarCarne(reto, progreso));
  root.appendChild(pintarGrupos());
  return root;
}
