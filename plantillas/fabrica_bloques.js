// ===== plantillas/fabrica_bloques.js =====
// Expediente 6x6 · KenKen/Calcudoku vestido de escena del crimen: la rejilla
// es el plano de la escena, la fila es la franja horaria, la columna es la
// zona, y cada región coloreada es un grupo de indicios que el forense ya
// agrupó bajo un informe pericial (+, −, × o ÷). La generación (cuadrado
// latino + regiones + comprobación de solución única) vive en
// scripts/fabrica-logic.js, compartida con el generador y el validador -- la
// plantilla solo pinta y compara contra `solucion`, nunca re-decide si el
// reto es solvente. El texto de los casos (CASOS) es cosa de esta plantilla,
// no de la lógica: fabrica-logic.js solo conoce los ids (CASO_IDS), igual que
// el `modo` del láser -- lo que sí comparten es esa lista, y un test cruza
// que las claves de CASOS y CASO_IDS no se desincronicen.

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
// caso, la resolución se reserva para la celebración de cierre. Sin magia ni
// nada sobrenatural: robos, fraudes, sabotajes y manipulaciones de datos, en
// tono seco con humor ácido puntual.
// Exportado a propósito para que un test cruce sus claves contra CASO_IDS de
// scripts/fabrica-logic.js -- mismo patrón que colocacionesDeLinea en
// nonograma.js: la comprobación importa más que la encapsulación aquí.
export const CASOS = {
  'joyeria-del-mar': {
    titular: 'Robo en la Joyería Del Mar: el vigilante jura que no vio nada.',
    brief: 'Faltan tres relojes de la vitrina central y la alarma nunca sonó. El vigilante dice que estuvo despierto toda la noche. Los indicios dicen otra cosa.',
    resolucion: 'El peso de las pisadas no engaña. El vigilante estaba en la trastienda justo cuando la alarma se desconectó.'
  },
  'cargamento-fantasma': {
    titular: 'Desaparece un cargamento entero sin abrir ninguna puerta.',
    brief: 'El almacén estaba cerrado y las cámaras no grabaron nada raro. Pero alguien movió cajas que pesaban más de lo que decía el registro.',
    resolucion: 'Los números del inventario estaban maquillados desde el turno de tarde. El responsable de logística llevaba semanas robando por partes.'
  },
  'correo-interceptado': {
    titular: 'Una empresa pierde un contrato millonario tras filtrarse su oferta.',
    brief: 'Alguien del equipo filtró la propuesta a la competencia horas antes de la reunión. Los horarios de acceso al servidor son la única pista.',
    resolucion: 'El acceso de madrugada no encaja con ningún turno oficial. La becaria de prácticas tenía acceso... y motivos.'
  },
  'examen-filtrado': {
    titular: 'El examen de acceso se filtra tres horas antes de empezar.',
    brief: 'Todo el mundo jura que no ha sido él. Pero alguien entró en el servidor de exámenes con una cuenta que llevaba meses sin usarse.',
    resolucion: 'La cuenta "inactiva" llevaba dos semanas conectándose de madrugada. El bedel tenía un sobrino en la lista de aprobados.'
  },
  'amano-deportivo': {
    titular: 'Un partido decisivo termina con un resultado que nadie esperaba.',
    brief: 'Las casas de apuestas detectan movimientos raros de dinero minutos antes del pitido inicial. El árbitro dice que fue una tarde normal.',
    resolucion: 'Las cantidades apostadas cuadran con las de un solo grupo, repartidas para no llamar la atención. El árbitro se cambió de coche la semana siguiente.'
  },
  'etiquetado-fraudulento': {
    titular: 'Un restaurante con estrella sirve pescado que no es el de la carta.',
    brief: 'Un cliente se queja de una intoxicación y el análisis de laboratorio no coincide con la etiqueta. El proveedor lo niega todo.',
    resolucion: 'Los lotes de la nevera no cuadran con las facturas del proveedor oficial. El chef llevaba meses comprando por otro lado para ahorrar.'
  },
  'obra-con-material-sustituido': {
    titular: 'Se raja una viga en una obra recién terminada.',
    brief: 'El informe de materiales dice una cosa, y el análisis de la viga dice otra muy distinta. Alguien recortó calidad para ganar margen.',
    resolucion: 'Las cantidades de cemento no encajan con ningún lote autorizado. El jefe de obra firmó los albaranes sin comprobar nada.'
  },
  'taller-de-piezas-falsificadas': {
    titular: 'Un taller mecánico vende piezas de recambio que no son originales.',
    brief: 'Un cliente descubre que su pieza "nueva" llevaba meses de desgaste. Las facturas están en regla, pero los números no cierran.',
    resolucion: 'El número de serie de las piezas se repetía con demasiada frecuencia para ser casualidad. El taller reciclaba piezas de coches siniestrados.'
  },
  'laboratorio-manipulado': {
    titular: 'Un laboratorio certifica resultados que otro laboratorio no puede reproducir.',
    brief: 'Las muestras y los informes no coinciden entre sí. Alguien ha estado maquillando cifras para acelerar certificaciones.',
    resolucion: 'Las mediciones aparecían siempre justo por debajo del límite legal, demasiadas veces para ser azar. El técnico cobraba un plus por certificación rápida.'
  },
  'festival-de-entradas-falsas': {
    titular: 'Un festival vende el doble de entradas de las que caben en el recinto.',
    brief: 'La organización dice que fue un fallo informático. Los números de taquilla dicen que alguien hizo el doble de caja a propósito.',
    resolucion: 'Los lotes de entradas "duplicadas por error" salieron todos de la misma terminal, fuera de horario. El jefe de taquilla se compró un coche nuevo esa semana.'
  },
  'distribuidora-farmaceutica': {
    titular: 'Faltan cajas de medicamentos entre el almacén y la farmacia.',
    brief: 'El papeleo dice que todo llegó completo. El recuento físico dice lo contrario, y las cantidades que faltan no son aleatorias.',
    resolucion: 'Las cantidades desviadas coincidían siempre con pedidos de una misma farmacia asociada. El transportista llevaba un año haciendo dos entregas por una.'
  },
  'museo-de-la-pieza-falsa': {
    titular: 'Una pieza del museo resulta ser una copia... desde hace años.',
    brief: 'El seguro exige tasar la colección de nuevo, y la balanza no cuadra con el certificado original. Alguien cambió la pieza sin que nadie lo notara a tiempo.',
    resolucion: 'El peso de la copia se acercaba mucho al original, pero no lo bastante. El restaurador que la "limpió" hace tres años no ha vuelto a coger vacaciones.'
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

  if (!n || !regiones || !solucion || !caso) {
    root.innerHTML = '<div class="feedback ko">Error: Reto de fábrica de bloques sin datos válidos</div>';
    return;
  }

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
        <li>No repitas indicio en la misma franja horaria.</li>
        <li>No repitas indicio en la misma zona.</li>
        <li>Cada color agrupa los indicios que el forense ya relacionó.</li>
        ${operacionesPresentes.map((op) => `<li>${FRASE_POR_OPERACION[op]}</li>`).join('')}
        <li>Un indicio sin informe pericial ya viene confirmado por el laboratorio.</li>
        <li>Toca un número del panel para seleccionarlo.</li>
        <li>Toca una celda para anotar ahí el indicio seleccionado.</li>
        <li>Toca la misma celda otra vez para borrar la anotación.</li>
        <li>Pulsa «Cerrar expediente» cuando la rejilla esté completa.</li>
      </ul>
    `
  });
  root.appendChild(ui.box);

  const infoLine = createElement('div', { class: 'fabrica-info' });
  infoLine.textContent = `Plano de la escena: ${n}x${n} · ${regiones.length} sector${regiones.length === 1 ? '' : 'es'} de indicios`;
  ui.box.appendChild(infoLine);

  const tablero = createElement('div', { class: 'fabrica-tablero' });
  tablero.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

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
  let ganado = false;

  const celdas = Array.from({ length: n }, () => new Array(n));

  for (let f = 0; f < n; f++) {
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

  btnReiniciar.addEventListener('click', () => {
    if (ganado) return;
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
    if (ganado) return;
    const vacias = valores.reduce((total, fila) => total + fila.filter((v) => v === 0).length, 0);
    if (vacias > 0) {
      setStatus(ui.result, `Quedan ${vacias} indicio${vacias === 1 ? '' : 's'} sin catalogar.`, '');
    } else {
      setStatus(ui.result, 'Escena catalogada. Pulsa «Cerrar expediente».', '');
    }
  }

  btnComprobar.addEventListener('click', () => {
    if (ganado) return;
    const vacio = valores.some((fila) => fila.some((v) => v === 0));
    if (vacio) {
      setStatus(ui.result, 'Cataloga todos los indicios antes de cerrar el expediente.', 'ko');
      return;
    }

    const correcto = valores.every((fila, f) => fila.every((v, c) => v === solucion[f][c]));

    if (correcto) {
      ganado = true;
      setStatus(ui.result, `Caso cerrado en ${fallos} revisión${fallos === 1 ? '' : 'es'}.`, 'ok');
      celebrate({ ok: true, message: caso.resolucion });
      if (hooks && hooks.onSuccess) hooks.onSuccess({ fallos });
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) celdas[f][c].celda.disabled = true;
      }
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
  throw new Error('Faltan datos de configuración de la fábrica de bloques');
}
