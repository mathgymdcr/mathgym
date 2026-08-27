// ===== catalogo-tipos.js =====
// Catálogo de los tipos de reto: lo consumen home.js (para pintar la sala de
// entrenamiento), scripts/generate-muestrario.js (para escribir los JSON de
// ejemplo que sirve la portada) y tests/plantillas (para comprobar que no se
// desfase respecto al mapa `loaders` de plantillas/base.js).
//
// `nombre` es EL nombre del tipo, el único: lo pintan la cabecera del juego
// (vía `tipoInfo` en plantillas/shell.js), la ficha de la portada y el
// `titulo` que el generador escribe en cada reto. Antes vivía por triplicado
// y los tres valores se habían desfasado entre sí.
//
// `grupo` es la familia de la home ("grupos musculares"): agrupa los tipos por
// el tipo de razonamiento que piden, no por su mecánica. El orden de las
// familias lo fija `GRUPOS`.
//
// `icono` es la ruta del icono del tipo: SVG plano en assets/icono-*.svg para
// todos menos el enigma, que conserva su caricatura en PNG por ser un retrato.
//
// `generado: true` significa que hay un generador diario en
// scripts/generate-daily-reto.js; `false` es una plantilla que existe pero
// cuyo contenido todavía se escribe a mano.

export const TIPOS = [
  {
    tipo: 'enigma-einstein',
    nombre: 'Resuelve el enigma',
    grupo: 'Deducción',
    icono: 'assets/einstein-caricature.png',
    resumen: 'Cruza pistas sobre quién vive dónde, con qué mascota y bebiendo qué, hasta que solo quede una combinación posible.',
    generado: true
  },
  {
    tipo: 'balanza-logica',
    nombre: 'Descubre el impostor',
    grupo: 'Deducción',
    icono: 'assets/icono-balanza-logica.svg',
    resumen: 'Encuentra la moneda falsa con el menor número de pesadas: cada una divide el problema si eliges bien los grupos.',
    generado: true
  },
  {
    tipo: 'poligono-geometrico',
    nombre: 'Construye el polígono',
    grupo: 'Visión espacial',
    icono: 'assets/icono-poligono-geometrico.svg',
    resumen: 'Dibuja sobre la retícula una figura que tenga a la vez el área y el perímetro que se piden.',
    generado: true
  },
  {
    tipo: 'mezcla-quimica',
    nombre: 'Mezcla Exacta',
    grupo: 'Medida y cálculo',
    icono: 'assets/icono-mezcla-quimica.svg',
    resumen: 'Con matraces sin graduar, sintetiza un volumen exacto de reactivo llenando, vaciando y trasvasando de uno a otro.',
    generado: true
  },
  {
    tipo: 'luces-fuera',
    nombre: 'Los Cuadrados Luminosos',
    grupo: 'Secuencias y estados',
    icono: 'assets/icono-luces-fuera.svg',
    resumen: 'Cada pulsación cambia una casilla y sus vecinas: apaga el tablero entero encadenando el efecto.',
    generado: true
  },
  {
    tipo: 'relojes-arena',
    nombre: 'Relojes de Arena',
    grupo: 'Medida y cálculo',
    icono: 'assets/icono-relojes-arena.svg',
    resumen: 'Con relojes de arena que no se pueden parar a media caída, mide un tiempo que ninguno marca por sí solo.',
    generado: true
  },
  {
    tipo: 'puentes-hashi',
    nombre: 'Conecta los Chips',
    grupo: 'Visión espacial',
    icono: 'assets/icono-puentes-hashi.svg',
    resumen: 'Une los chips con puentes sin que ninguno se cruce, dando a cada uno exactamente los puentes que pide su número.',
    generado: true
  },
  {
    tipo: 'nonograma',
    nombre: 'Objeto Oculto',
    grupo: 'Deducción',
    icono: 'assets/icono-nonograma.svg',
    resumen: 'Las cifras de cada fila y columna dicen cuántas casillas seguidas pintar: al cuadrar todas aparece un dibujo.',
    generado: true
  },
  {
    tipo: 'cajas-apiladas',
    nombre: 'Cajas Apiladas',
    grupo: 'Secuencias y estados',
    icono: 'assets/icono-cajas-apiladas.svg',
    resumen: 'Reúne las cajas en una zona sin apilar una pesada sobre una ligera, y aprovecha los kilos de la carretilla para llevarte varias de un viaje.',
    generado: true
  },
  {
    tipo: 'riego-plantas',
    nombre: 'El Riego',
    grupo: 'Medida y cálculo',
    icono: 'assets/icono-riego-plantas.svg',
    resumen: 'Cada planta solo bebe ciertos días y nunca dos seguidos: encaja el calendario para que todas reciban sus riegos sin agotar la regadera.',
    generado: true
  },
  {
    tipo: 'anillas-encadenadas',
    nombre: 'Anillas Encadenadas',
    grupo: 'Secuencias y estados',
    icono: 'assets/icono-anillas-encadenadas.svg',
    resumen: 'Solo se puede tocar una anilla concreta en cada momento: la posición de partida cambia cada día, así que el número de pasos no se aprende de memoria.',
    generado: true
  },
  {
    tipo: 'laser-triangular',
    nombre: 'Laberinto Láser',
    grupo: 'Visión espacial',
    icono: 'assets/icono-laser-triangular.svg',
    resumen: 'Coloca espejos para llevar cada rayo hasta su diana sin que los trayectos se crucen: las diagonales giran el haz y los espejos planos lo devuelven.',
    generado: true
  }
];

// Ficha de un tipo por su id. Falla en vez de devolver undefined: un tipo mal
// escrito debe romper en el momento, no pintar una cabecera sin título.
export function tipoInfo(tipo) {
  const ficha = TIPOS.find((t) => t.tipo === tipo);
  if (!ficha) throw new Error(`Tipo desconocido en el catálogo: ${tipo}`);
  return ficha;
}

// Las familias, en el orden en que se pintan. Van de la deducción pura a lo
// más numérico, que es el orden en que crecen en dificultad de entrada.
export const GRUPOS = ['Deducción', 'Visión espacial', 'Secuencias y estados', 'Medida y cálculo'];
