// ===== catalogo-tipos.js =====
// Catálogo de los tipos de reto: lo consumen muestrario.js (para pintar las
// fichas), scripts/generate-muestrario.js (para escribir los JSON de
// ejemplo) y tests/muestrario (para comprobar que no se desfase respecto al
// mapa `loaders` de plantillas/base.js).
//
// `generado: true` significa que hay un generador diario en
// scripts/generate-daily-reto.js; `false` es una plantilla que existe pero
// cuyo contenido todavía se escribe a mano.

export const TIPOS = [
  {
    tipo: 'enigma-einstein',
    nombre: 'El Enigma',
    emoji: '🕵️',
    resumen: 'Cruza pistas sobre quién vive dónde, con qué mascota y bebiendo qué, hasta que solo quede una combinación posible.',
    generado: true
  },
  {
    tipo: 'balanza-logica',
    nombre: 'La Balanza',
    emoji: '⚖️',
    resumen: 'Encuentra la moneda falsa con el menor número de pesadas: cada una divide el problema si eliges bien los grupos.',
    generado: true
  },
  {
    tipo: 'poligono-geometrico',
    nombre: 'El Polígono',
    emoji: '📐',
    resumen: 'Dibuja sobre la retícula una figura que tenga a la vez el área y el perímetro que se piden.',
    generado: true
  },
  {
    tipo: 'trasvase-ecologico',
    nombre: 'El Trasvase',
    emoji: '💧',
    resumen: 'Con dos recipientes sin marcas, consigue medir una cantidad exacta llenando, vaciando y volcando uno en otro.',
    generado: true
  },
  {
    tipo: 'luces-fuera',
    nombre: 'Luces Fuera',
    emoji: '💡',
    resumen: 'Cada pulsación cambia una casilla y sus vecinas: apaga el tablero entero encadenando el efecto.',
    generado: true
  },
  {
    tipo: 'relojes-arena',
    nombre: 'La Arena Exacta',
    emoji: '⏳',
    resumen: 'Con relojes de arena que no se pueden parar a media caída, mide un tiempo que ninguno marca por sí solo.',
    generado: true
  },
  {
    tipo: 'puentes-hashi',
    nombre: 'El Archipiélago',
    emoji: '🌉',
    resumen: 'Une las islas con puentes sin que ninguno se cruce, dando a cada una exactamente los puentes que pide su número.',
    generado: true
  },
  {
    tipo: 'nonograma',
    nombre: 'El Dibujo Oculto',
    emoji: '🧩',
    resumen: 'Las cifras de cada fila y columna dicen cuántas casillas seguidas pintar: al cuadrar todas aparece un dibujo.',
    generado: true
  },
  {
    tipo: 'cajas-apiladas',
    nombre: 'El Almacén',
    emoji: '📦',
    resumen: 'Reúne las cajas en una zona sin apilar una pesada sobre una ligera, y aprovecha los kilos de la carretilla para llevarte varias de un viaje.',
    generado: true
  },
  {
    tipo: 'riego-plantas',
    nombre: 'El Riego',
    emoji: '🌱',
    resumen: 'Cada planta solo bebe ciertos días y nunca dos seguidos: encaja el calendario para que todas reciban sus riegos sin agotar la regadera.',
    generado: true
  },
  {
    tipo: 'anillas-encadenadas',
    nombre: 'Las Anillas',
    emoji: '⛓️',
    resumen: 'Solo se puede tocar una anilla concreta en cada momento: la posición de partida cambia cada día, así que el número de pasos no se aprende de memoria.',
    generado: true
  },
  {
    tipo: 'laser-triangular',
    nombre: 'El Láser Triangular',
    emoji: '🔺',
    resumen: 'Coloca espejos para llevar cada rayo hasta su diana sin que los trayectos se crucen: las diagonales giran el haz y los espejos planos lo devuelven.',
    generado: true
  }
];
