import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { balanzaMinWeighings } from './balanza-logic.js';
import {
  solveMezcla,
  initialLevelsMezcla,
  CONFIGS_MEZCLA,
  minimoExigidoMezcla,
  objetivosMezcla
} from './mezcla-logic.js';
import { buildLucesPuzzle, buildLucesHints } from './lightsout-logic.js';
import { buildPoligonoPuzzle, buildPoligonoHints } from './poligono-logic.js';
import { generarEnigma, dificultadDe } from './einstein-logic.js';
import { buildRelojesPuzzle, buildRelojesHints } from './relojes-logic.js';
import { buildHashiPuzzle, buildHashiHints } from './hashi-logic.js';
import { buildNonogramaPuzzle, buildNonogramaHints } from './nonograma-logic.js';
import { buildCajasPuzzle, buildCajasHints } from './cajas-logic.js';
import { buildAnillasPuzzle, buildAnillasHints } from './anillas-logic.js';
import { buildLaserPuzzle, buildLaserHints } from './laser-triangular-logic.js';
import { buildRiegoPuzzle, buildRiegoHints } from './riego-logic.js';
import { tipoInfo } from '../catalogo-tipos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// "Hoy" en Europe/Madrid, no en UTC del runner -- si no, el cron a las
// 00:00 UTC puede caer antes o después de la medianoche real de Madrid
// según la época del año (CET/CEST), y el reto se etiqueta con la fecha
// equivocada justo en el borde del día.
function todayMadrid() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

class MathGymGenerator {
  constructor() {
    this.templates = {
      'enigma-einstein': this.generateEinstein.bind(this),
      'balanza-logica': this.generateBalanza.bind(this),
      'poligono-geometrico': this.generatePoligono.bind(this),
      'mezcla-quimica': this.generateMezcla.bind(this),
      'luces-fuera': this.generateLuces.bind(this),
      'relojes-arena': this.generateRelojes.bind(this),
      'puentes-hashi': this.generateHashi.bind(this),
      'nonograma': this.generateNonograma.bind(this),
      'cajas-apiladas': this.generateCajas.bind(this),
      'anillas-encadenadas': this.generateAnillas.bind(this),
      'laser-triangular': this.generateLaser.bind(this),
      'riego-plantas': this.generateRiego.bind(this)
    };
  }

  async generateDailyReto(fecha, force = false) {
    if (!fecha) {
      fecha = todayMadrid();
    }

    console.log(`🎯 Generating reto for ${fecha}`);

    // Check if already exists
    if (!force) {
      try {
        const existing = await fs.readFile('reto.json', 'utf8');
        const existingReto = JSON.parse(existing);
        if (existingReto.fecha === fecha) {
          console.log(`📅 Reto for ${fecha} already exists`);
          return existingReto;
        }
      } catch (e) {
        // File doesn't exist, continue
      }
    }

    const seed = this.dateToSeed(fecha);
    const template = this.selectTemplate(seed);
    
    console.log(`🎲 Using template: ${template}`);
    
    const reto = await this.generarReto(template, seed, fecha);
    reto.fecha = fecha;
    
    // Save main reto.json
    await fs.writeFile('reto.json', JSON.stringify(reto, null, 2));
    
    // Save individual reto file
    await fs.mkdir('retos', { recursive: true });
    await fs.writeFile(
      path.join('retos', `${fecha}.json`),
      JSON.stringify(reto, null, 2)
    );
    
    // Update lista_retos.json
    await this.updateRetosList(fecha, reto.titulo, reto.dificultad, reto.categorias);
    
    console.log(`✅ Generated: ${reto.titulo}`);
    return reto;
  }

  // Único sitio donde un reto recibe su título, y sale del catálogo: así un
  // generador nuevo no puede inventarse un nombre propio ni olvidarse de
  // ponerlo, que es como el mismo tipo acabó llamándose de tres formas.
  async generarReto(tipo, seed, fecha) {
    const reto = await this.templates[tipo](seed, fecha);
    reto.titulo = tipoInfo(tipo).nombre;
    return reto;
  }

  dateToSeed(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return (year * 10000) + (month * 100) + day;
  }

  selectTemplate(seed) {
    const templates = Object.keys(this.templates);
    return templates[seed % templates.length];
  }

  async updateRetosList(fecha, titulo, dificultad, categorias) {
    let lista = [];
    try {
      const content = await fs.readFile('lista_retos.json', 'utf8');
      lista = JSON.parse(content);
    } catch (e) {
      console.log('📝 Creating new lista_retos.json');
    }

    // Remove existing entry for this date
    lista = lista.filter(r => r.fecha !== fecha);

    // Add new entry
    const entry = { fecha, titulo };
    if (dificultad != null) entry.dificultad = dificultad;
    if (categorias != null) entry.categorias = categorias;
    lista.push(entry);

    // Sort by date
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha));

    await fs.writeFile('lista_retos.json', JSON.stringify(lista, null, 2));
  }

  // GENERATORS
  async generateEinstein(seed, fecha) {
    // Toda la lógica (banco temático, sorteo de solución, poda de pistas
    // con unicidad verificada) vive en scripts/einstein-logic.js. El
    // generador anterior producía puzzles con 3-4 soluciones válidas y
    // solo 3 puzzles distintos en total; ver el módulo para el detalle.
    const enigma = generarEnigma(seed);

    // Comprobación real, no asumida: si la poda dejara un puzzle
    // ambiguo es mejor reventar aquí que publicar un enigma que
    // rechace deducciones correctas del jugador.
    if (enigma.meta.numSoluciones !== 1) {
      throw new Error(
        `generateEinstein: el puzzle generado tiene ${enigma.meta.numSoluciones} ` +
        `soluciones en vez de 1 (seed=${seed}, categorías=${enigma.meta.categoriasElegidas.join('/')})`
      );
    }

    const enigmaData = {
      categories: enigma.categories,
      clues: enigma.clues,
      solution: enigma.solution,
      // Clave que la plantilla ignora (solo lee categories/clues/solution).
      // La necesita validate-retos.js para re-verificar la unicidad sobre
      // el archivo realmente publicado, en vez de fiarse del generador.
      meta: {
        tamano: enigma.meta.tamano,
        forma: enigma.meta.forma,
        categoriasElegidas: enigma.meta.categoriasElegidas,
        pistasEstructuradas: enigma.meta.pistasEstructuradas
      }
    };

    // Save data file
    const dataFileName = `enigma_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(enigmaData, null, 2)
    );

    const numPistas = enigma.meta.numPistas;

    return {
      id: `${fecha}-enigma-einstein-001`,
      tipo: 'enigma-einstein',
      // De un día a otro varían el tamaño del tablero (4x4 / 5x4 / 4x5 /
      // 5x5, sorteado con sesgo al 4x4) y la combinación de categorías
      // temáticas que lo llenan.
      variant: [enigma.meta.tamano, ...enigma.meta.categoriasElegidas.map((c) => this.slug(c))].join('-'),
      // La dificultad ya no sale de una tabla única: cada tamaño tiene la
      // suya, porque un 5x5 con 15 pistas no es más fácil que un 4x4 con
      // 12 por traer más pistas. Ver `dificultadDe` en einstein-logic.js.
      dificultad: dificultadDe(enigma.meta.tamano, numPistas),
      categorias: ['deduccion', 'logica'],
      hints: this.generateEinsteinHints(enigma),
      objectives: {
        winCondition: 'unique_solution',
        numPistas,
        // Aquí no hay movimientos que optimizar: la marca es acertar a la
        // primera. Dos comprobaciones fallidas todavía dan dos estrellas.
        maxErrorsFor3Stars: 0,
        maxErrorsFor2Stars: 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  // Pistas de ayuda (meta), distintas de las `clues` del propio enigma.
  generateEinsteinHints(enigma) {
    const cats = enigma.meta.categoriasElegidas;
    return [
      `Empieza por las pistas que asignan directamente un valor a una persona: siempre hay al menos una, y es el punto de entrada más rápido.`,
      `Las pistas en negativo ("no bebe café") sirven para descartar, no para colocar: úsalas para ir tachando combinaciones imposibles.`,
      `Este enigma es de ${enigma.meta.tamano}: ${enigma.meta.forma.casas} casas y ${cats.length} categorías (${cats.join(', ')}), con solución única a partir de las ${enigma.meta.numPistas} pistas dadas.`
    ];
  }

  // "Profesión" -> "profesion" (para componer el campo variant).
  slug(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  async generateBalanza(seed, fecha) {
    // El payload va entero en español, como el resto del proyecto. Los
    // retos publicados antes traen `oddUnknown` / `N` / `k` /
    // `maxWeighings`; quien los traduce al abrirlos es
    // `leerConfigBalanza`, en balanza-logic.js.
    const configs = [
      { variant: 'desconocida', n_monedas: 5, max_pesadas: 3 },
      { variant: 'pesada', n_monedas: 6, k_impostoras: 1, max_pesadas: 3 },
      { variant: 'ligera', n_monedas: 7, k_impostoras: 1, max_pesadas: 3 },
      { variant: 'desconocida', n_monedas: 7, max_pesadas: 3 },
      { variant: 'pesadas-multiples', n_monedas: 8, k_impostoras: 2, max_pesadas: 4 }
    ];

    const config = configs[seed % configs.length];

    // La instancia concreta (qué moneda(s) son anómalas y su signo) se fija
    // aquí con un PRNG seedeado por fecha, no en el navegador con
    // Math.random() -- si no, dos personas cargando "el reto de hoy" verían
    // monedas anómalas distintas. La lógica de abajo replica a propósito
    // generateAnomalies() de plantillas/balanza_logica.js.
    // Seed derivado (no el `seed` crudo, que ya decide `config` arriba) para
    // que este PRNG no quede correlacionado con la elección de config ni con
    // cualquier otro uso futuro de `seed` en este generador.
    const anomalySeed = (seed * 2654435761) >>> 0;
    const rand = this.mulberry32(anomalySeed);
    const anomalies = this.generateBalanzaAnomalies(config, rand);
    const dataOut = { ...config, anomalies };

    // Save data file for balanza
    const dataFileName = `balanza_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(dataOut, null, 2)
    );

    // Mínimo de pesadas real según la cota de teoría de la información
    // (3^W resultados distinguibles en W pesadas de 3 salidas cada una),
    // no un número fijo -- así hints y objectives son específicos de
    // cada variant/N/k, y el validador puede reusar la misma cota.
    const minW = balanzaMinWeighings(config);

    return {
      id: `${fecha}-balanza-logica-001`,
      tipo: 'balanza-logica',
      variant: config.variant,
      dificultad: 3,
      categorias: ['logica', 'optimizacion'],
      hints: this.generateBalanzaHints(config, minW),
      objectives: {
        winCondition: 'identify_anomalies',
        maxWeighingsFor3Stars: minW,
        maxWeighingsFor2Stars: Math.min(config.max_pesadas, minW + 1)
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generatePoligono(seed, fecha) {
    // Los dos ejes (nº de figuras y forma), el catálogo de instancias y la
    // comprobación de que el reparto es único viven en poligono-logic.js,
    // que el validador reusa para re-comprobar el reto ya escrito.
    const puzzle = buildPoligonoPuzzle(seed);
    const { variant, dificultad, config } = puzzle;

    const dataFileName = `poligono_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-poligono-geometrico-001`,
      tipo: 'poligono-geometrico',
      variant,
      dificultad,
      categorias: ['geometria'],
      hints: buildPoligonoHints(puzzle),
      // Dibujar la figura pedida no tiene par de movimientos: se mide igual
      // que el enigma, por comprobaciones fallidas.
      objectives: {
        winCondition: 'matching_figure',
        maxErrorsFor3Stars: 0,
        maxErrorsFor2Stars: 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateMezcla(seed, fecha) {
    // Los dos ejes del tipo se sortean por separado, cada uno con su
    // derivación de seed (y distintas de las que usan los demás
    // generadores), para que no queden correlacionados entre sí ni con la
    // elección de capacidades. Como en el resto, se pasan por mulberry32
    // en vez de mirar la paridad cruda del seed derivado.
    const grifo = this.mulberry32((seed * 40503 + 12345) >>> 0)() < 0.5;
    const nMatraces = this.mulberry32((seed * 27077 + 54321) >>> 0)() < 0.5 ? 3 : 4;
    const nObjetivos = this.mulberry32((seed * 31627 + 11119) >>> 0)() < 0.5 ? 1 : 2;

    // Solo se sortea entre las configuraciones que con ESTE eje de dosificador
    // tienen solución y además no son triviales: sin grifo todo el reactivo es
    // el del primer matraz, y hay pares (capacidades, objetivo) que dejan de
    // ser alcanzables o que se resuelven de un volcado. Filtrar aquí es
    // determinista y evita publicar un reto que solo cazaría el validador.
    const exigido = minimoExigidoMezcla(nObjetivos);
    const arranque = (capacities) => initialLevelsMezcla(capacities, grifo);
    const minimoDe = (capacities, targets) => solveMezcla({
      grifo, capacities, targets, initialLevels: arranque(capacities)
    });

    // El segundo compuesto no está en la tabla: se busca aquí entre los
    // volúmenes que caben en algún matraz. Encadenar es lo que hace
    // interesante al eje -- el segundo objetivo arranca de las sobras del
    // primero --, y el orden de prueba se sortea con el seed en vez de ir
    // de 1 en adelante: probando en orden saldría casi siempre el mismo
    // volumen pequeño y el eje perdería la variedad que justifica tenerlo.
    const randExtra = this.mulberry32((seed * 19937 + 7717) >>> 0);
    const objetivosDe = (c) => {
      if (nObjetivos === 1) {
        const min = minimoDe(c.capacities, [c.target]);
        return min !== null && min >= exigido ? [c.target] : null;
      }
      // Un volumen que es la capacidad de un matraz sale de llenarlo y
      // verterlo: dos movimientos y ninguna deducción. La tabla ya evita
      // eso en el primer objetivo; el segundo tiene que cumplirlo igual, o
      // el reto de dos compuestos sería el de uno con propina.
      const capMax = Math.max(...c.capacities);
      const extras = [];
      for (let v = 1; v <= capMax; v++) {
        if (v !== c.target && !c.capacities.includes(v)) extras.push(v);
      }
      for (let i = extras.length - 1; i > 0; i--) {
        const j = Math.floor(randExtra() * (i + 1));
        [extras[i], extras[j]] = [extras[j], extras[i]];
      }
      for (const extra of extras) {
        const targets = [c.target, extra];
        const min = minimoDe(c.capacities, targets);
        if (min !== null && min >= exigido) return targets;
      }
      return null;
    };

    // Las configuraciones se recorren rotadas por el seed y se para en la
    // primera que sirve, en vez de evaluarlas todas: cada intento cuesta
    // un BFS y el reparto sigue siendo determinista.
    const pool = CONFIGS_MEZCLA.filter((c) => c.capacities.length === nMatraces);
    let base = null;
    for (let i = 0; i < pool.length && !base; i++) {
      const c = pool[(seed + i) % pool.length];
      const targets = objetivosDe(c);
      if (targets) base = { capacities: c.capacities, targets };
    }

    if (!base) {
      throw new Error(
        `generateMezcla: ninguna configuración de ${nMatraces} matraces sirve ` +
        `con grifo=${grifo} y ${nObjetivos} objetivo(s) (seed=${seed}) -- o no tienen ` +
        `solución o se resuelven en menos de ${exigido} movimientos; revisar la tabla de configs`
      );
    }

    const config = {
      grifo,
      capacities: base.capacities,
      targets: base.targets,
      initialLevels: arranque(base.capacities)
    };

    const dataFileName = `mezcla_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    // Mínimo de movimientos real vía BFS sobre el espacio de estados, no
    // un número fijo a mano -- así hints y objectives son específicos de
    // cada capacities/target, y el validador reusa la misma función para
    // comprobar que el reto tiene solución.
    const minMoves = solveMezcla(config);

    return {
      id: `${fecha}-mezcla-quimica-001`,
      tipo: 'mezcla-quimica',
      // La variante es la etiqueta compuesta de los ejes, al estilo de
      // enigma-einstein: los ejes de verdad son campos del payload.
      variant: `${grifo ? 'con-grifo' : 'sin-grifo'}-${nMatraces}-${nObjetivos}objetivos`,
      // Un compuesto más es una vuelta más de deducción, no solo más
      // teclas: sube un punto sobre lo que ya marca el nº de matraces.
      dificultad: (nMatraces === 4 ? 3 : 2) + (nObjetivos - 1),
      categorias: ['volumen', 'movimiento'],
      hints: this.generateMezclaHints(config, minMoves),
      objectives: {
        winCondition: 'reach_target_amount',
        parMoves: minMoves,
        maxMovesFor3Stars: minMoves,
        maxMovesFor2Stars: minMoves + 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  // Pistas específicas de capacities/target/grifo -- no un texto genérico.
  generateMezclaHints(cfg, minMoves) {
    const capsTxt = cfg.capacities.map((c) => `${c} mL`).join(', ');
    const objetivos = objetivosMezcla(cfg);
    const objTxt = objetivos.map((t) => `${t} mL`).join(' y ');
    const estrategia = cfg.grifo
      ? `Llena y vacía los matraces de ${capsTxt} en el dosificador, y trasvasa entre ellos para ir acotando el volumen hasta los ${objTxt} exactos.`
      : `Solo tienes ${cfg.initialLevels.reduce((a, b) => a + b, 0)} mL de reactivo, todo en el primer matraz -- repártelo entre los matraces de ${capsTxt} sin desperdiciarlo para llegar a ${objTxt}.`;
    const cadena = objetivos.length > 1
      ? [`Los ${objetivos.length} compuestos se sintetizan en cadena y en el orden que quieras: el reactor vacía el matraz que le viertes, así que el segundo arranca de lo que hayas dejado en los demás. Piensa cuál conviene verter primero.`]
      : [];
    return [
      estrategia,
      ...cadena,
      `El mínimo real para este reto es ${minMoves} movimiento${minMoves === 1 ? '' : 's'}.`
    ];
  }

  async generateLuces(seed, fecha) {
    // Dos ejes (tamaño y objetivo), la construcción del tablero y el
    // mínimo real viven en lightsout-logic.js, que el validador reusa
    // para re-comprobar el reto ya escrito.
    const puzzle = buildLucesPuzzle(seed);
    const { variant, dificultad, modo, minPulsaciones } = puzzle;

    const dataFileName = `luces_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify({ modos: [modo] }, null, 2)
    );

    return {
      id: `${fecha}-luces-fuera-001`,
      tipo: 'luces-fuera',
      variant,
      dificultad,
      categorias: ['logica', 'tablero'],
      hints: buildLucesHints(puzzle),
      objectives: {
        winCondition: modo.objetivo,
        parMoves: minPulsaciones,
        maxMovesFor3Stars: minPulsaciones,
        maxMovesFor2Stars: minPulsaciones + Math.ceil(minPulsaciones * 0.3)
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateRelojes(seed, fecha) {
    // Toda la elección (config, variante, duraciones, objetivo) y la
    // verificación de solvencia viven en relojes-logic.js, que el validador
    // reusa para re-comprobar el reto ya escrito.
    const puzzle = buildRelojesPuzzle(seed);
    const { glasses, target, variant, dificultad, solucion } = puzzle;

    // tolerance: la plantilla compara el cronómetro con el objetivo con este
    // margen en minutos. Los tramos son enteros de minutos por construcción,
    // así que 0.25 solo absorbe el redondeo de la simulación, no un error del
    // jugador.
    const config = { variant, glasses, target, tolerance: 0.25, min_rondas: solucion.rondasTotales };

    const dataFileName = `relojes_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-relojes-arena-001`,
      tipo: 'relojes-arena',
      variant,
      dificultad,
      categorias: ['logica', 'tiempo'],
      hints: buildRelojesHints(config, solucion),
      objectives: {
        winCondition: 'measure_target_time',
        parMoves: solucion.rondasTotales,
        maxMovesFor3Stars: solucion.rondasTotales,
        maxMovesFor2Stars: solucion.rondasTotales + 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateHashi(seed, fecha) {
    // Igual que en relojes: la construcción del archipiélago y la garantía
    // de solución ÚNICA viven en hashi-logic.js, que el validador reusa para
    // volver a contar soluciones sobre el JSON ya escrito.
    const puzzle = buildHashiPuzzle(seed);
    const { variant, rows, cols, islands, dificultad, solucion } = puzzle;

    const config = {
      variant,
      rows,
      cols,
      islands,
      min_puentes: solucion.total
    };

    const dataFileName = `hashi_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-puentes-hashi-001`,
      tipo: 'puentes-hashi',
      variant,
      dificultad,
      categorias: ['logica', 'grafos'],
      hints: buildHashiHints(config, solucion),
      objectives: {
        winCondition: 'all_islands_connected',
        // Cada toque añade un puente simple, así que un puente doble cuesta
        // dos toques: el par es la suma de puentes de la solución.
        parMoves: solucion.total,
        maxMovesFor3Stars: solucion.total,
        maxMovesFor2Stars: solucion.total + Math.ceil(solucion.total * 0.3)
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateNonograma(seed, fecha) {
    // La figura, el espejado y la comprobación de unicidad viven en
    // nonograma-logic.js; el validador reusa el mismo solver para volver a
    // contar soluciones sobre el JSON ya escrito.
    const puzzle = buildNonogramaPuzzle(seed);
    const { variant, rows, cols, grid, paleta, figura, dificultad, soloLogica } = puzzle;

    // La plantilla deriva las pistas del propio grid, así que no se duplican
    // aquí: una sola fuente de verdad para los números que ve el jugador. La
    // paleta solo va en los retos en color: sin ella, el grid es de 0 y 1 y
    // el reto se juega en monocromo, como todo lo publicado hasta hoy.
    const config = { variant, rows, cols, grid, ...(paleta ? { paleta } : {}), figura };

    const dataFileName = `nonograma_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    const pintadas = grid.flat().filter((v) => v > 0).length;
    return {
      id: `${fecha}-nonograma-001`,
      tipo: 'nonograma',
      variant,
      dificultad,
      categorias: ['logica', 'deduccion'],
      hints: buildNonogramaHints(puzzle),
      objectives: {
        winCondition: 'grid_matches_solution',
        // Cada celda pintada es un toque; las marcas con x son opcionales.
        parMoves: pintadas,
        maxMovesFor3Stars: pintadas,
        maxMovesFor2Stars: pintadas + Math.ceil(pintadas * 0.3)
      },
      data: { json_url: `data/${dataFileName}` },
      // Informativo para el validador y el histórico: si el reto exigía
      // suponer o salía solo con lógica de líneas.
      solo_logica: soloLogica
    };
  }

  async generateCajas(seed, fecha) {
    // Variante de Hanói con carga por kilos: la construcción, el reparto
    // inicial y el mínimo real (BFS) viven en cajas-logic.js, que el
    // validador reusa para recalcular el mínimo sobre el JSON ya escrito.
    const puzzle = buildCajasPuzzle(seed);
    const { variant, zonas, capacidad, destino, nombresZonas, dificultad, solucion } = puzzle;

    const config = {
      variant,
      zonas,
      nombresZonas,
      destino,
      capacidad,
      min_movimientos: solucion.movimientos
    };

    const dataFileName = `cajas_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    const total = zonas.flat().length;
    return {
      id: `${fecha}-cajas-apiladas-001`,
      tipo: 'cajas-apiladas',
      variant,
      dificultad,
      categorias: ['logica', 'movimiento', 'optimizacion'],
      hints: buildCajasHints(puzzle),
      objectives: {
        winCondition: 'all_boxes_at_destination',
        parMoves: solucion.movimientos,
        maxMovesFor3Stars: solucion.movimientos,
        maxMovesFor2Stars: solucion.movimientos + Math.ceil(solucion.movimientos * 0.3)
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateAnillas(seed, fecha) {
    // Anillos chinos con arranque arbitrario: como los 2^n estados forman un
    // solo camino, cada configuración de partida está a una distancia
    // distinta y el mínimo deja de ser la fórmula de siempre.
    const puzzle = buildAnillasPuzzle(seed);
    const { variant, rings, regla, inicial, objetivo, min_movimientos, mostrarPistas, dificultad } = puzzle;

    const config = { variant, rings, regla, inicial, objetivo, min_movimientos, mostrarPistas };

    const dataFileName = `anillas_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-anillas-encadenadas-001`,
      tipo: 'anillas-encadenadas',
      variant,
      dificultad,
      categorias: ['logica', 'movimiento', 'optimizacion'],
      hints: buildAnillasHints(puzzle),
      objectives: {
        winCondition: 'rings_match_target',
        parMoves: min_movimientos,
        maxMovesFor3Stars: min_movimientos,
        maxMovesFor2Stars: min_movimientos + Math.ceil(min_movimientos * 0.3)
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateLaser(seed, fecha) {
    // Construcción inversa: se colocan piezas, se traza el rayo con el mismo
    // trazador que usa la plantilla y la diana se planta donde acaba. El par
    // (min_piezas) se comprueba buscando soluciones más cortas.
    const puzzle = buildLaserPuzzle(seed);
    const { variant, modo, size, lasers, targets, blocks, min_piezas, dificultad } = puzzle;

    const config = { variant, modo, size, lasers, targets, blocks, min_piezas };

    const dataFileName = `laser_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      id: `${fecha}-laser-triangular-001`,
      tipo: 'laser-triangular',
      variant,
      dificultad,
      categorias: ['logica', 'geometria'],
      hints: buildLaserHints(puzzle),
      objectives: {
        winCondition: 'all_lasers_on_target',
        // Cada pieza cuesta al menos un toque.
        parMoves: min_piezas,
        maxMovesFor3Stars: min_piezas,
        maxMovesFor2Stars: min_piezas + 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateRiego(seed, fecha) {
    // Las ventanas salen de un calendario válido sorteado antes, y luego se
    // recortan hasta que ese calendario es el ÚNICO posible.
    const puzzle = buildRiegoPuzzle(seed);
    const { variant, cycles, capacity, plants, incompatibles, dificultad } = puzzle;

    const config = { variant, cycles, capacity, descanso: true, plants, ...(incompatibles ? { incompatibles } : {}) };

    const dataFileName = `riego_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    const totalRiegos = plants.reduce((acc, p) => acc + p.doses, 0);
    return {
      id: `${fecha}-riego-plantas-001`,
      tipo: 'riego-plantas',
      variant,
      dificultad,
      categorias: ['logica', 'planificacion'],
      hints: buildRiegoHints(puzzle),
      objectives: {
        winCondition: 'watering_schedule_valid',
        parMoves: totalRiegos,
        maxMovesFor3Stars: totalRiegos,
        maxMovesFor2Stars: totalRiegos + 2
      },
      data: { json_url: `data/${dataFileName}` }
    };
  }

  // PRNG determinista (mulberry32), sin dependencias externas. Misma
  // semilla -> misma secuencia de [0,1) siempre.
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Replica generateAnomalies() de plantillas/balanza_logica.js, pero
  // usando el PRNG seedeado `rand` en vez de Math.random(). Mantener
  // ambas en sync si cambia la lógica de una de ellas.
  generateBalanzaAnomalies(cfg, rand) {
    const idxs = Array.from({ length: cfg.n_monedas }, (_, i) => i);
    const pick = (n) => {
      const pool = idxs.slice();
      const out = [];
      for (let j = 0; j < n; j++) {
        const p = Math.floor(rand() * pool.length);
        out.push(pool.splice(p, 1)[0]);
      }
      return out;
    };

    const anomalies = [];
    switch (cfg.variant) {
      case 'pesada':
        anomalies.push({ i: pick(1)[0], sign: 1 });
        break;
      case 'ligera':
        anomalies.push({ i: pick(1)[0], sign: -1 });
        break;
      case 'desconocida': {
        const ii = pick(1)[0];
        const sg = rand() < 0.5 ? 1 : -1;
        anomalies.push({ i: ii, sign: sg });
        break;
      }
      case 'pesadas-multiples':
        pick(cfg.k_impostoras).forEach((i) => anomalies.push({ i, sign: 1 }));
        break;
      case 'ligeras-multiples':
        pick(cfg.k_impostoras).forEach((i) => anomalies.push({ i, sign: -1 }));
        break;
      case 'desconocidas-multiples':
        pick(cfg.k_impostoras).forEach((i) => anomalies.push({ i, sign: rand() < 0.5 ? 1 : -1 }));
        break;
    }
    return anomalies;
  }

  // Pistas específicas de la variante y de N/k -- no un texto genérico.
  generateBalanzaHints(cfg, minW) {
    const N = cfg.n_monedas, k = cfg.k_impostoras || 1;
    const plural = (n, s) => (n === 1 ? s : s + 's');
    const estrategia = {
      'pesada': `Divide las ${N} monedas en tres grupos lo más iguales posible y compara dos en la balanza: el lado que baja contiene la moneda pesada, o si equilibran, está en el grupo que dejaste fuera.`,
      'ligera': `Divide las ${N} monedas en tres grupos lo más iguales posible y compara dos en la balanza: el lado que sube contiene la moneda ligera, o si equilibran, está en el grupo que dejaste fuera.`,
      'desconocida': `Como no sabes si la moneda distinta pesa más o menos, deja siempre algunas monedas fuera de la primera pesada -- necesitas poder comparar su comportamiento en pesadas distintas para deducir el signo.`,
      'pesadas-multiples': `Hay ${k} ${plural(k, 'moneda')} más ${plural(k, 'pesada')} entre las ${N} -- reparte muchas monedas en cada plato para que el resultado te diga de un vistazo cuántas de las pesadas cayeron en cada lado.`,
      'ligeras-multiples': `Hay ${k} ${plural(k, 'moneda')} más ${plural(k, 'ligera')} entre las ${N} -- reparte muchas monedas en cada plato para que el resultado te diga de un vistazo cuántas de las ligeras cayeron en cada lado.`,
      'desconocidas-multiples': `Hay ${k} monedas distintas entre las ${N}, y cada una puede pesar más o menos por separado -- es la variante más exigente, aprovecha cada pesada para acotar a la vez cuántas sospechosas quedan y su signo.`
    };
    return [
      estrategia[cfg.variant] || 'Compara grupos de monedas para descartar sospechosas en cada pesada.',
      `El mínimo teórico para este reto es ${minW} ${plural(minW, 'pesada')} (tienes ${cfg.max_pesadas}, con ${cfg.max_pesadas - minW} de margen).`
    ];
  }
}

// Se exporta para que scripts/generate-muestrario.js pueda reusar los
// mismos generadores y los ejemplos del muestrario no se desvíen nunca del
// esquema real de cada tipo.
export { MathGymGenerator };

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const fecha = args[0] || todayMadrid();
  const force = args[1] === 'true' || args[1] === '--force';

  const generator = new MathGymGenerator();
  
  try {
    await generator.generateDailyReto(fecha, force);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
