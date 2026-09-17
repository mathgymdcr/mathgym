// ===== plantillas/fabrica_bloques.js =====
// Bajo Sospecha · KenKen/Calcudoku vestido de investigación policial: la
// rejilla es el plano de la escena, la fila es una localización y la
// columna un margen horario -- pero ninguna de las dos se rotula mientras
// se juega, solo al cerrar el expediente (ver más abajo). Cada región
// coloreada es un grupo de indicios que el forense ya agrupó bajo un
// informe pericial (+, −, × o ÷). La generación (cuadrado latino + regiones
// + comprobación de solución única) vive en scripts/fabrica-logic.js,
// compartida con el generador y el validador -- la plantilla solo pinta y
// compara contra `solucion`, nunca re-decide si el reto es solvente. El
// texto del caso (CASOS) es cosa de esta plantilla, no de la lógica:
// fabrica-logic.js solo conoce los ids (CASO_IDS), igual que el `modo` del
// láser -- lo que sí comparten es esa lista, y un test cruza que las claves
// de CASOS y CASO_IDS no se desincronicen.
//
// Completar la rejilla no cierra el caso: desbloquea 3 sospechosos cuya
// coartada afirma un indicio (un OBJETO del caso) en una localización y un
// margen horario concretos. Dos dicen la verdad (su afirmación coincide con
// `solucion`), uno miente -- ahí está el culpable. Esas celdas, quién
// miente y con qué valor falso los sortea `generaSospechosos` en
// fabrica-logic.js a partir del SEED, no del reto ya construido, así que la
// prueba sale gratis de una solución que ya es única.
//
// La capa narrativa nueva (objetos/horarios/localizaciones/retratos) vive
// entera aquí, en CASOS -- fabrica-logic.js sigue sin saber qué es un
// "reloj" o una "vitrina", solo ve números 1..n. Mientras se juega, la
// rejilla no lleva ninguna cabecera (ni número de indicio traducido): eso
// se revela solo al cerrar el expediente, para no regalar de más antes de
// tiempo. Cada sospechoso trae un `retrato` que es la ruta a un avatar SVG
// en assets/sospechosos/ -- generados una vez con la librería "personas" de
// DiceBear (dicebear.com, open source) a partir de una descripción por
// personaje (piel, pelo, atuendo, gafas, bigote...), no dibujados a mano:
// 36 retratos con calidad e higiene visual consistentes de verdad es un
// encargo de diseño, no algo que un trazador propio en SVG resuelva bien.

import { celebrate } from './celebration.js';
import { buildStandardShell, createElement, setStatus } from './shell.js';

const SIMBOLO_OP = { suma: '+', resta: '−', multiplicacion: '×', division: '÷' };
const PALETA_REGIONES = ['#3D8BE0', '#E85B4A', '#3DBE7A', '#F8C818', '#D163CC', '#4FB8C4', '#E0973D', '#8C7AE6', '#5C9DE8', '#C4526E'];

// Una frase forense por operación para las instrucciones: los símbolos
// matemáticos de la celda (+, −, ×, ÷) se quedan tal cual, son funcionales;
// esto solo reviste lo que significa "cerrar" un grupo de indicios.
const FRASE_POR_OPERACION = {
  suma: 'Un grupo de indicios que, sumados, dan la cifra exacta del informe (peso total, cantidad total...).',
  resta: 'Un par de indicios cuya diferencia exacta es la que marca el informe (una discrepancia entre dos medidas).',
  multiplicacion: 'Un grupo de indicios cuyo producto da la cifra del informe (por ejemplo, turnos por testigos).',
  division: 'Un par de indicios cuyo cociente exacto es el que marca el informe (un reparto exacto entre dos cantidades).'
};

// Un expediente por id de CASO_IDS -- titular y brief se enseñan al abrir el
// caso, la resolución se reserva para la celebración de cierre. `objetos`,
// `horarios` y `localizaciones` traen 6 entradas cada uno (se recortan a
// `n` según el tamaño del reto) y están atados al propio caso -- no son
// vocabulario genérico, son las localizaciones y objetos que tendría ESA
// escena. Cada sospechoso trae su `retrato`: la ruta a un SVG en
// assets/sospechosos/ (ver el comentario de cabecera del archivo).
export const CASOS = {
  'joyeria-del-mar': {
    titular: 'Robo en la Joyería Del Mar: el vigilante jura que no vio nada.',
    brief: 'Faltan tres relojes de la vitrina central y la alarma nunca sonó. El vigilante dice que estuvo despierto toda la noche. Los indicios dicen otra cosa.',
    resolucion: 'El peso de las pisadas no engaña. El vigilante estaba en la trastienda justo cuando la alarma se desconectó.',
    objetos: ['Reloj', 'Anillo', 'Collar', 'Pulsera', 'Broche', 'Zafiro'],
    horarios: ['Apertura', 'Mañana', 'Mediodía', 'Tarde', 'Cierre', 'Madrugada'],
    localizaciones: ['Vitrina', 'Trastienda', 'Entrada', 'Caja', 'Escaparate', 'Almacén'],
    sospechosos: [
      { nombre: 'El vigilante nocturno', retrato: 'assets/sospechosos/joyeria-vigilante.svg' },
      { nombre: 'La dependienta', retrato: 'assets/sospechosos/joyeria-dependienta.svg' },
      { nombre: 'El técnico', retrato: 'assets/sospechosos/joyeria-tecnico.svg' }
    ]
  },
  'cargamento-fantasma': {
    titular: 'Desaparece un cargamento entero sin abrir ninguna puerta.',
    brief: 'El almacén estaba cerrado y las cámaras no grabaron nada raro. Pero alguien movió cajas que pesaban más de lo que decía el registro.',
    resolucion: 'Los números del inventario estaban maquillados desde el turno de tarde. El responsable de logística llevaba semanas robando por partes.',
    objetos: ['Caja', 'Palé', 'Etiqueta', 'Precinto', 'Albarán', 'Bulto'],
    horarios: ['Mañana', 'Mediodía', 'Tarde', 'Relevo', 'Cierre', 'Madrugada'],
    localizaciones: ['Muelle', 'Nave', 'Oficina', 'Rampa', 'Pasillo', 'Patio'],
    sospechosos: [
      { nombre: 'El jefe de turno', retrato: 'assets/sospechosos/cargamento-jefeturno.svg' },
      { nombre: 'El conductor', retrato: 'assets/sospechosos/cargamento-conductor.svg' },
      { nombre: 'La encargada de inventario', retrato: 'assets/sospechosos/cargamento-encargada.svg' }
    ]
  },
  'correo-interceptado': {
    titular: 'Una empresa pierde un contrato millonario tras filtrarse su oferta.',
    brief: 'Alguien del equipo filtró la propuesta a la competencia horas antes de la reunión. Los horarios de acceso al servidor son la única pista.',
    resolucion: 'El acceso de madrugada no encaja con ningún turno oficial. La becaria tenía acceso... y motivos.',
    objetos: ['Correo', 'Informe', 'Portátil', 'Acceso', 'Clave', 'Papel'],
    horarios: ['Mañana', 'Mediodía', 'Tarde', 'Reunión', 'Cierre', 'Madrugada'],
    localizaciones: ['Despacho', 'Sala juntas', 'Recepción', 'Archivo', 'Pasillo', 'Sótano'],
    sospechosos: [
      { nombre: 'La becaria', retrato: 'assets/sospechosos/correo-becaria.svg' },
      { nombre: 'El jefe de ventas', retrato: 'assets/sospechosos/correo-jefeventas.svg' },
      { nombre: 'El consultor externo', retrato: 'assets/sospechosos/correo-consultor.svg' }
    ]
  },
  'examen-filtrado': {
    titular: 'El examen de acceso se filtra tres horas antes de empezar.',
    brief: 'Todo el mundo jura que no ha sido él. Pero alguien entró en el servidor de exámenes con una cuenta que llevaba meses sin usarse.',
    resolucion: 'La cuenta "inactiva" llevaba dos semanas conectándose de madrugada. El conserje tenía un sobrino en la lista de aprobados.',
    objetos: ['Examen', 'USB', 'Copia', 'Clave', 'Ordenador', 'Cuenta'],
    horarios: ['Mañana', 'Recreo', 'Mediodía', 'Tarde', 'Guardia', 'Madrugada'],
    localizaciones: ['Aula', 'Secretaría', 'Sala profesores', 'Pasillo', 'Servidor', 'Conserjería'],
    sospechosos: [
      { nombre: 'El conserje', retrato: 'assets/sospechosos/examen-conserje.svg' },
      { nombre: 'La profesora de guardia', retrato: 'assets/sospechosos/examen-profesora.svg' },
      { nombre: 'El informático', retrato: 'assets/sospechosos/examen-informatico.svg' }
    ]
  },
  'amano-deportivo': {
    titular: 'Un partido decisivo termina con un resultado que nadie esperaba.',
    brief: 'Las casas de apuestas detectan movimientos raros de dinero minutos antes del pitido inicial. El árbitro dice que fue una tarde normal.',
    resolucion: 'Las cantidades apostadas cuadran con las de un solo grupo, repartidas para no llamar la atención. El árbitro se cambió de coche la semana siguiente.',
    objetos: ['Balón', 'Silbato', 'Tarjeta', 'Apuesta', 'Camiseta', 'Crono'],
    horarios: ['Previa', 'Calentamiento', 'Descanso', 'Pitido', 'Prórroga', 'Post-partido'],
    localizaciones: ['Campo', 'Vestuarios', 'Banquillo', 'Grada', 'Túnel', 'Palco'],
    sospechosos: [
      { nombre: 'El árbitro', retrato: 'assets/sospechosos/amano-arbitro.svg' },
      { nombre: 'El capitán del equipo', retrato: 'assets/sospechosos/amano-capitan.svg' },
      { nombre: 'El delegado de campo', retrato: 'assets/sospechosos/amano-delegado.svg' }
    ]
  },
  'etiquetado-fraudulento': {
    titular: 'Un restaurante con estrella sirve pescado que no es el de la carta.',
    brief: 'Un cliente se queja de una intoxicación y el análisis de laboratorio no coincide con la etiqueta. El proveedor lo niega todo.',
    resolucion: 'Los lotes de la nevera no cuadran con las facturas del proveedor oficial. El chef llevaba meses comprando por otro lado para ahorrar.',
    objetos: ['Pescado', 'Factura', 'Etiqueta', 'Congelador', 'Menú', 'Lote'],
    horarios: ['Apertura', 'Comidas', 'Sobremesa', 'Cenas', 'Cierre', 'Madrugada'],
    localizaciones: ['Cocina', 'Nevera', 'Comedor', 'Barra', 'Almacén', 'Sala'],
    sospechosos: [
      { nombre: 'El chef', retrato: 'assets/sospechosos/etiquetado-chef.svg' },
      { nombre: 'El proveedor', retrato: 'assets/sospechosos/etiquetado-proveedor.svg' },
      { nombre: 'El jefe de sala', retrato: 'assets/sospechosos/etiquetado-jefesala.svg' }
    ]
  },
  'obra-con-material-sustituido': {
    titular: 'Se raja una viga en una obra recién terminada.',
    brief: 'El informe de materiales dice una cosa, y el análisis de la viga dice otra muy distinta. Alguien recortó calidad para ganar margen.',
    resolucion: 'Las cantidades de cemento no encajan con ningún lote autorizado. El jefe de obra firmó los albaranes sin comprobar nada.',
    objetos: ['Cemento', 'Viga', 'Albarán', 'Ladrillo', 'Hormigón', 'Factura'],
    horarios: ['Mañana', 'Mediodía', 'Tarde', 'Relevo', 'Cierre', 'Madrugada'],
    localizaciones: ['Obra', 'Almacén', 'Oficina', 'Andamio', 'Cimientos', 'Acceso'],
    sospechosos: [
      { nombre: 'El jefe de obra', retrato: 'assets/sospechosos/obra-jefeobra.svg' },
      { nombre: 'El proveedor', retrato: 'assets/sospechosos/obra-proveedor.svg' },
      { nombre: 'El aparejador', retrato: 'assets/sospechosos/obra-aparejador.svg' }
    ]
  },
  'taller-de-piezas-falsificadas': {
    titular: 'Un taller mecánico vende piezas de recambio que no son originales.',
    brief: 'Un cliente descubre que su pieza "nueva" llevaba meses de desgaste. Las facturas están en regla, pero los números no cierran.',
    resolucion: 'El número de serie de las piezas se repetía con demasiada frecuencia para ser casualidad. El taller reciclaba piezas de coches siniestrados.',
    objetos: ['Pieza', 'Factura', 'Motor', 'Serie', 'Recambio', 'Etiqueta'],
    horarios: ['Apertura', 'Mañana', 'Mediodía', 'Tarde', 'Cierre', 'Madrugada'],
    localizaciones: ['Taller', 'Recepción', 'Almacén', 'Elevador', 'Patio', 'Oficina'],
    sospechosos: [
      { nombre: 'El dueño del taller', retrato: 'assets/sospechosos/taller-dueno.svg' },
      { nombre: 'El mecánico de turno', retrato: 'assets/sospechosos/taller-mecanico.svg' },
      { nombre: 'El proveedor', retrato: 'assets/sospechosos/taller-proveedor.svg' }
    ]
  },
  'laboratorio-manipulado': {
    titular: 'Un laboratorio certifica resultados que otro laboratorio no puede reproducir.',
    brief: 'Las muestras y los informes no coinciden entre sí. Alguien ha estado maquillando cifras para acelerar certificaciones.',
    resolucion: 'Las mediciones aparecían siempre justo por debajo del límite legal, demasiadas veces para ser azar. El técnico cobraba un plus por certificación rápida.',
    objetos: ['Muestra', 'Informe', 'Probeta', 'Resultado', 'Etiqueta', 'Sello'],
    horarios: ['Mañana', 'Mediodía', 'Tarde', 'Turno noche', 'Cierre', 'Madrugada'],
    localizaciones: ['Laboratorio', 'Despacho', 'Archivo', 'Sala blanca', 'Recepción', 'Almacén'],
    sospechosos: [
      { nombre: 'El técnico de laboratorio', retrato: 'assets/sospechosos/laboratorio-tecnico.svg' },
      { nombre: 'La directora del laboratorio', retrato: 'assets/sospechosos/laboratorio-directora.svg' },
      { nombre: 'El comercial de certificaciones', retrato: 'assets/sospechosos/laboratorio-comercial.svg' }
    ]
  },
  'festival-de-entradas-falsas': {
    titular: 'Un festival vende el doble de entradas de las que caben en el recinto.',
    brief: 'La organización dice que fue un fallo informático. Los números de taquilla dicen que alguien hizo el doble de caja a propósito.',
    resolucion: 'Los lotes de entradas "duplicadas por error" salieron todos de la misma terminal, fuera de horario. El jefe de taquilla se compró un coche nuevo esa semana.',
    objetos: ['Entrada', 'Pulsera', 'Terminal', 'Recibo', 'Lote', 'Ticket'],
    horarios: ['Apertura', 'Tarde', 'Concierto', 'Cierre', 'Recuento', 'Madrugada'],
    localizaciones: ['Taquilla', 'Puerta', 'Escenario', 'Backstage', 'Oficina', 'Aparcamiento'],
    sospechosos: [
      { nombre: 'El jefe de taquilla', retrato: 'assets/sospechosos/festival-jefetaquilla.svg' },
      { nombre: 'La informática', retrato: 'assets/sospechosos/festival-informatica.svg' },
      { nombre: 'El encargado de puertas', retrato: 'assets/sospechosos/festival-puertas.svg' }
    ]
  },
  'distribuidora-farmaceutica': {
    titular: 'Faltan cajas de medicamentos entre el almacén y la farmacia.',
    brief: 'El papeleo dice que todo llegó completo. El recuento físico dice lo contrario, y las cantidades que faltan no son aleatorias.',
    resolucion: 'Las cantidades desviadas coincidían siempre con pedidos de una misma farmacia asociada. El transportista llevaba un año haciendo dos entregas por una.',
    objetos: ['Caja', 'Albarán', 'Lote', 'Receta', 'Etiqueta', 'Furgoneta'],
    horarios: ['Mañana', 'Mediodía', 'Tarde', 'Reparto', 'Cierre', 'Madrugada'],
    localizaciones: ['Almacén', 'Farmacia', 'Muelle', 'Ruta', 'Oficina', 'Recepción'],
    sospechosos: [
      { nombre: 'El transportista', retrato: 'assets/sospechosos/distribuidora-transportista.svg' },
      { nombre: 'El empleado de farmacia', retrato: 'assets/sospechosos/distribuidora-empleado.svg' },
      { nombre: 'El encargado de almacén', retrato: 'assets/sospechosos/distribuidora-encargado.svg' }
    ]
  },
  'museo-de-la-pieza-falsa': {
    titular: 'Una pieza del museo resulta ser una copia... desde hace años.',
    brief: 'El seguro exige tasar la colección de nuevo, y la balanza no cuadra con el certificado original. Alguien cambió la pieza sin que nadie lo notara a tiempo.',
    resolucion: 'El peso de la copia se acercaba mucho al original, pero no lo bastante. El restaurador que la "limpió" hace tres años no ha vuelto a coger vacaciones.',
    objetos: ['Etiqueta', 'Certificado', 'Informe', 'Balanza', 'Foto', 'Seguro'],
    horarios: ['Apertura', 'Mañana', 'Mediodía', 'Tarde', 'Cierre', 'Madrugada'],
    localizaciones: ['Sala', 'Vitrina', 'Restauro', 'Archivo', 'Recepción', 'Almacén'],
    sospechosos: [
      { nombre: 'El restaurador', retrato: 'assets/sospechosos/museo-restaurador.svg' },
      { nombre: 'El comisario de la exposición', retrato: 'assets/sospechosos/museo-comisario.svg' },
      { nombre: 'El tasador del seguro', retrato: 'assets/sospechosos/museo-tasador.svg' }
    ]
  }
};

export async function render(root, data, hooks) {
  root.innerHTML = '';

  let config;
  try {
    config = await loadConfig(data);
  } catch (err) {
    root.innerHTML = `<div class="feedback ko">Error al cargar datos: ${err && err.message ? err.message : err}</div>`;
    return;
  }

  const n = config.tablero && config.tablero.ancho;
  const regiones = Array.isArray(config.regiones) ? config.regiones : null;
  const solucion = Array.isArray(config.solucion) ? config.solucion : null;
  const caso = CASOS[config.caso];
  const sospechosos = Array.isArray(config.sospechosos) ? config.sospechosos : null;
  const culpable = Number.isInteger(config.culpable) ? config.culpable : null;

  if (!n || !regiones || !solucion || !caso || !sospechosos || culpable == null) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de Bajo Sospecha sin datos válidos</div>';
    return;
  }

  const objetos = caso.objetos.slice(0, n);
  const horarios = caso.horarios.slice(0, n);
  const localizaciones = caso.localizaciones.slice(0, n);

  // Region de cada celda (por referencia de objeto, para saber cuándo dos
  // celdas vecinas pertenecen a la misma región al pintar los bordes).
  const regionDeCelda = Array.from({ length: n }, () => Array(n).fill(null));
  regiones.forEach((region) => {
    region.celdas.forEach(([f, c]) => { regionDeCelda[f][c] = region; });
  });

  // La pista (operación+objetivo) se pinta solo en la celda de la región
  // que va primero en orden de lectura -- no hace falta repetirla en todas.
  const etiquetaDeCelda = new Map();
  for (const region of regiones) {
    if (region.operacion === null) continue; // las de una celda son "dadas", sin pista que pintar
    const [f, c] = [...region.celdas].sort((a, b) => (a[0] * n + a[1]) - (b[0] * n + b[1]))[0];
    etiquetaDeCelda.set(`${f},${c}`, `${region.objetivo}${SIMBOLO_OP[region.operacion]}`);
  }

  const colorDeRegion = new Map();
  regiones.forEach((region, i) => colorDeRegion.set(region, PALETA_REGIONES[i % PALETA_REGIONES.length]));

  // Solo se explica en las instrucciones la operación que de verdad aparece
  // en este reto: con operacionesCompletas=false nunca hay multiplicación ni
  // división, y listar esas frases sería instrucción sobre una regla que
  // hoy no está en juego.
  const ORDEN_OPERACIONES = ['suma', 'resta', 'multiplicacion', 'division'];
  const operacionesPresentes = ORDEN_OPERACIONES.filter((op) =>
    regiones.some((region) => region.operacion === op)
  );

  const ui = buildStandardShell({
    tipo: 'fabrica-de-bloques',
    gameClass: 'fabrica-game',
    instructionsHTML: `
      <h3>Informe del inspector</h3>
      <p><strong>${caso.titular}</strong></p>
      <p>${caso.brief}</p>
      <h3>Cómo se investiga</h3>
      <p><strong>Objetivo:</strong> cataloga cada indicio de la escena sin romper la cadena de custodia.</p>
      <ul>
        <li>No repitas indicio en la misma fila ni en la misma columna.</li>
        <li>Cada color agrupa los indicios que el forense ya relacionó.</li>
        ${operacionesPresentes.map((op) => `<li>${FRASE_POR_OPERACION[op]}</li>`).join('')}
        <li>Un indicio sin informe pericial ya viene confirmado por el laboratorio.</li>
        <li>Toca un número del panel para seleccionarlo.</li>
        <li>Toca una celda para anotar ahí el indicio seleccionado.</li>
        <li>Toca la misma celda otra vez para borrar la anotación.</li>
        <li>Pulsa «Cerrar expediente» cuando la rejilla esté completa.</li>
        <li>Al cerrar bien el expediente se revela dónde y cuándo pasó todo.</li>
        <li>Toca a un sospechoso para oír su coartada.</li>
        <li>Tócalo otra vez para acusarlo.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'fabrica-info' });
  infoLine.textContent = `Plano de la escena: ${n}x${n} · ${regiones.length} sector${regiones.length === 1 ? '' : 'es'} de indicios`;
  ui.box.appendChild(infoLine);

  // Cabeceras: vacías mientras se juega a propósito -- fila y columna no se
  // rotulan como localización/horario hasta cerrar el expediente, para no
  // regalar esa lectura antes de tiempo. La celda sigue ahí (columna/fila
  // "auto" del grid) pero con la clase `oculta`, que la colapsa a 0.
  const tablero = createElement('div', { class: 'fabrica-tablero' });
  // La columna de localización lleva ancho fijo (no "auto"): un nombre
  // largo ("Sala profesores") en "auto" empuja el resto de columnas fuera
  // del ancho máximo del tablero -- con un tope, el texto envuelve dentro
  // de su hueco en vez de desbordar la rejilla entera.
  tablero.style.gridTemplateColumns = `minmax(46px, 64px) repeat(${n}, 1fr)`;
  tablero.style.gridTemplateRows = `auto repeat(${n}, 1fr)`;

  tablero.appendChild(createElement('div', { class: 'fabrica-esquina' }));
  const cabsZona = [];
  for (let c = 0; c < n; c++) {
    const cabZona = createElement('div', { class: 'fabrica-cab oculta' });
    tablero.appendChild(cabZona);
    cabsZona.push(cabZona);
  }

  const valores = Array.from({ length: n }, () => Array(n).fill(0));
  const fijadas = Array.from({ length: n }, () => Array(n).fill(false));
  for (const region of regiones) {
    if (region.operacion === null) {
      const [f, c] = region.celdas[0];
      valores[f][c] = region.objetivo;
      fijadas[f][c] = true;
    }
  }

  let herramienta = null; // numero 1..n, 'borrar', o null (nada seleccionado)
  let fallos = 0;
  let fallosAcusacion = 0;
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));
  const cabsFranja = [];

  for (let f = 0; f < n; f++) {
    const cabFranja = createElement('div', { class: 'fabrica-cab oculta' });
    tablero.appendChild(cabFranja);
    cabsFranja.push(cabFranja);

    for (let c = 0; c < n; c++) {
      const celda = createElement('button', { class: 'fabrica-celda', type: 'button' });
      const region = regionDeCelda[f][c];
      celda.style.backgroundColor = colorDeRegion.get(region);
      if (c === 0 || regionDeCelda[f][c - 1] !== region) celda.classList.add('borde-izq');
      if (c === n - 1 || regionDeCelda[f][c + 1] !== region) celda.classList.add('borde-der');
      if (f === 0 || regionDeCelda[f - 1][c] !== region) celda.classList.add('borde-arriba');
      if (f === n - 1 || regionDeCelda[f + 1][c] !== region) celda.classList.add('borde-abajo');

      const etiqueta = etiquetaDeCelda.get(`${f},${c}`);
      if (etiqueta) {
        const pista = createElement('span', { class: 'fabrica-celda-pista' });
        pista.textContent = etiqueta;
        celda.appendChild(pista);
      }

      const valorSpan = createElement('span', { class: 'fabrica-celda-valor' });
      celda.appendChild(valorSpan);

      if (fijadas[f][c]) {
        celda.classList.add('fija');
        celda.disabled = true;
        valorSpan.textContent = valores[f][c];
      } else {
        celda.addEventListener('click', () => {
          if (ganado || herramienta == null) return;
          if (herramienta === 'borrar') {
            valores[f][c] = 0;
          } else {
            valores[f][c] = valores[f][c] === herramienta ? 0 : herramienta;
          }
          valorSpan.textContent = valores[f][c] || '';
          actualizarMensaje();
        });
      }

      tablero.appendChild(celda);
      celdas[f][c] = { celda, valorSpan };
    }
  }
  ui.box.appendChild(tablero);

  const numpad = createElement('div', { class: 'fabrica-numpad' });
  const botonesHerramienta = [];

  function seleccionaHerramienta(valor, boton) {
    if (ganado) return;
    herramienta = herramienta === valor ? null : valor;
    botonesHerramienta.forEach(({ boton: b, valor: v }) => {
      b.classList.toggle('seleccionado', herramienta === v);
    });
  }

  for (let v = 1; v <= n; v++) {
    const boton = createElement('button', { class: 'fabrica-num', type: 'button' });
    boton.textContent = v;
    boton.addEventListener('click', () => seleccionaHerramienta(v, boton));
    numpad.appendChild(boton);
    botonesHerramienta.push({ boton, valor: v });
  }
  const btnBorrar = createElement('button', { class: 'fabrica-num fabrica-num-borrar', type: 'button' });
  btnBorrar.textContent = 'Borrar';
  btnBorrar.addEventListener('click', () => seleccionaHerramienta('borrar', btnBorrar));
  numpad.appendChild(btnBorrar);
  botonesHerramienta.push({ boton: btnBorrar, valor: 'borrar' });
  ui.box.appendChild(numpad);

  const btnComprobar = createElement('button', { class: 'btn' });
  btnComprobar.textContent = 'Cerrar expediente';
  const btnReiniciar = createElement('button', { class: 'btn btn-secondary' });
  btnReiniciar.textContent = 'Reabrir investigación';
  const controles = createElement('div', { class: 'panel-controls' });
  controles.appendChild(btnComprobar);
  controles.appendChild(btnReiniciar);
  ui.box.appendChild(controles);

  let rejillaCerrada = false;

  btnReiniciar.addEventListener('click', () => {
    if (ganado || rejillaCerrada) return;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (fijadas[f][c]) continue;
        valores[f][c] = 0;
        celdas[f][c].valorSpan.textContent = '';
      }
    }
    herramienta = null;
    botonesHerramienta.forEach(({ boton }) => boton.classList.remove('seleccionado'));
    actualizarMensaje();
  });

  function actualizarMensaje() {
    if (ganado || rejillaCerrada) return;
    const vacias = valores.reduce((total, fila) => total + fila.filter((v) => v === 0).length, 0);
    if (vacias > 0) {
      setStatus(ui.result, `Quedan ${vacias} indicio${vacias === 1 ? '' : 's'} sin catalogar.`, '');
    } else {
      setStatus(ui.result, 'Escena catalogada. Pulsa «Cerrar expediente».', '');
    }
  }

  // Con la rejilla cerrada, el veredicto sobre quién miente sale de comparar
  // la coartada de cada sospechoso con lo que el propio jugador anotó en esa
  // localización/horario -- la prueba es el tablero ya resuelto, no un dato
  // aparte. Cada retrato necesita dos toques: el primero revela la
  // coartada (nadie se acusa a ciegas), el segundo acusa.
  const panelSospechosos = createElement('div', { class: 'fabrica-sospechosos' });
  const tituloSospechosos = createElement('p', { class: 'fabrica-sospechosos-titulo' });
  tituloSospechosos.textContent = '¿Quién mintió en su coartada?';
  panelSospechosos.appendChild(tituloSospechosos);
  panelSospechosos.hidden = true;

  const revelado = sospechosos.map(() => false);

  sospechosos.forEach((s, i) => {
    const perfil = caso.sospechosos[i];
    const tarjeta = createElement('button', { class: 'fabrica-sospechoso', type: 'button' });

    const retratoImg = createElement('img', { class: 'fabrica-sospechoso-retrato', alt: '' });
    retratoImg.src = perfil.retrato;
    tarjeta.appendChild(retratoImg);

    const nombreSpan = createElement('span', { class: 'fabrica-sospechoso-nombre' });
    nombreSpan.textContent = perfil.nombre;
    tarjeta.appendChild(nombreSpan);

    const coartadaSpan = createElement('span', { class: 'fabrica-sospechoso-coartada oculta' });
    coartadaSpan.textContent = `«Vi ${objetos[s.valorAfirmado - 1].toLowerCase()} en ${localizaciones[s.fila].toLowerCase()}, durante ${horarios[s.columna].toLowerCase()}.»`;
    tarjeta.appendChild(coartadaSpan);

    const pista = createElement('span', { class: 'fabrica-sospechoso-pista' });
    pista.textContent = 'Toca para oír su coartada';
    tarjeta.appendChild(pista);

    tarjeta.addEventListener('click', () => {
      if (ganado || tarjeta.disabled) return;

      if (!revelado[i]) {
        revelado[i] = true;
        coartadaSpan.classList.remove('oculta');
        pista.textContent = 'Toca de nuevo para acusar';
        return;
      }

      if (i === culpable) {
        ganado = true;
        setStatus(
          ui.result,
          `Caso cerrado en ${fallos} revisión${fallos === 1 ? '' : 'es'} y ${fallosAcusacion} coartada${fallosAcusacion === 1 ? '' : 's'} descartada${fallosAcusacion === 1 ? '' : 's'}.`,
          'ok'
        );
        celebrate({ ok: true, message: caso.resolucion });
        if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
        panelSospechosos.querySelectorAll('.fabrica-sospechoso').forEach((t) => { t.disabled = true; });
        tarjeta.classList.add('culpable');
      } else {
        fallosAcusacion++;
        tarjeta.disabled = true;
        tarjeta.classList.add('descartado');
        pista.textContent = 'Coartada confirmada. No es tu sospechoso.';
      }
    });

    panelSospechosos.appendChild(tarjeta);
  });
  ui.box.appendChild(panelSospechosos);

  btnComprobar.addEventListener('click', () => {
    if (rejillaCerrada) return;
    const vacio = valores.some((fila) => fila.some((v) => v === 0));
    if (vacio) {
      setStatus(ui.result, 'Cataloga todos los indicios antes de cerrar el expediente.', 'ko');
      return;
    }

    const correcto = valores.every((fila, f) => fila.every((v, c) => v === solucion[f][c]));

    if (correcto) {
      rejillaCerrada = true;
      setStatus(ui.result, 'Rejilla cerrada. Ahora, ¿quién miente?', 'ok');

      cabsZona.forEach((cab, c) => {
        cab.textContent = horarios[c];
        cab.classList.remove('oculta');
      });
      cabsFranja.forEach((cab, f) => {
        cab.textContent = localizaciones[f];
        cab.classList.remove('oculta');
      });
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) {
          const { celda, valorSpan } = celdas[f][c];
          celda.disabled = true;
          valorSpan.textContent = objetos[valores[f][c] - 1];
          valorSpan.classList.add('fabrica-celda-valor--texto');
        }
      }

      btnComprobar.disabled = true;
      btnReiniciar.disabled = true;
      panelSospechosos.hidden = false;
    } else {
      fallos++;
      setStatus(ui.result, 'Algo no cuadra en el informe. Revisa los indicios.', 'ko');
    }
  });

  setStatus(ui.status, 'Expediente abierto.', 'ok');
  actualizarMensaje();
}

async function loadConfig(data) {
  if (data && data.json_url) {
    const r = await fetch(data.json_url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  if (data && data.tablero) return data;
  throw new Error('Faltan datos de configuración de Bajo Sospecha');
}
