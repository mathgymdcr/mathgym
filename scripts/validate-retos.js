import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { balanzaScenarios, leerConfigBalanza } from './balanza-logic.js';
import { solveMezcla, initialLevelsMezcla, minimoExigidoMezcla, objetivosMezcla } from './mezcla-logic.js';
import { solveLightsOutFor } from './lightsout-logic.js';
import { alcanzable, clasifica, repartos } from './poligono-logic.js';
import { solveRelojes } from './relojes-logic.js';
import { solveHashi, construirPares, FORMA_FIJA } from './hashi-logic.js';
import { pistasDe, pistasColorDe, resolverNonograma } from './nonograma-logic.js';
import { solveCajas } from './cajas-logic.js';
import { resolverAnillas } from './anillas-logic.js';
import { resuelto as laserResuelto, piezasMinimas, crearPiezas, normalizaConfig, MODOS, COLORES, DIR_VECTOR } from './laser-triangular-logic.js';
import { contarSoluciones as contarRiegos, combinacionesPlanta, MARGEN_MINIMO } from './riego-logic.js';
import { contarSolucionesDesdePistas } from './einstein-logic.js';
import { simulaSalida } from './cinta-transportadora-logic.js';
import { contarSoluciones as contarFabrica } from './fabrica-logic.js';
import { contarSoluciones as contarInvernadero } from './invernadero-logic.js';
import { contarSoluciones as contarRadar, cuentaVecinos } from './radar-logic.js';
import { evaluaTablero } from './dron-logic.js';
import { bfsDesde as bfsCubo } from './cubo-logic.js';
import { cuentaCruces } from './red-logic.js';
import { contarSolucionesModelo as contarAndroidesModelo, contarSolucionesClase as contarAndroidesClase } from './androides-logic.js';
import { contarSoluciones as contarSenal, cumplePista as cumplePistaSenal } from './senal-logic.js';
import { contarSoluciones as contarTrazo, pistaDeCelda as pistaDeCeldaTrazo } from './trazo-logic.js';
import { TIPOS, tipoInfo } from '../catalogo-tipos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


class RetoValidator {
  async validateAll() {
    console.log('🔍 Validating all retos...');
    
    try {
      // Validate main reto.json
      await this.validateMainReto();
      
      // Validate lista_retos.json
      await this.validateRetosList();
      
      // Validate data files
      await this.validateDataFiles();
      
      console.log('✅ All validations passed');
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateLatest() {
    console.log('🔍 Validating latest reto...');
    await this.validateMainReto();
    console.log('✅ Latest reto validation passed');
  }

  async validateMainReto() {
    const content = await fs.readFile('reto.json', 'utf8');
    const reto = JSON.parse(content);
    
    // Required fields
    if (!reto.fecha || !reto.titulo || !reto.tipo) {
      throw new Error('Missing required fields in reto.json');
    }
    
    // Valid date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reto.fecha)) {
      throw new Error('Invalid date format in reto.json');
    }
    
    // Valid tipo -- la lista sale del catálogo, que es quien conoce los tipos.
    const validTipos = TIPOS.map((t) => t.tipo);
    if (!validTipos.includes(reto.tipo)) {
      throw new Error(`Invalid tipo: ${reto.tipo}`);
    }

    // El titulo es el nombre del tipo, no uno propio: si se separan, el mismo
    // reto se llama de una forma en el tablero y de otra en el archivo.
    const nombre = tipoInfo(reto.tipo).nombre;
    if (reto.titulo !== nombre) {
      throw new Error(`El titulo "${reto.titulo}" no es el nombre del tipo ${reto.tipo} en el catálogo ("${nombre}")`);
    }

    // Campos muertos: no los lee nadie desde que el icono lo pone la plantilla
    // y el objetivo vive en las instrucciones de cada juego.
    for (const muerto of ['icono_url', 'objetivo']) {
      if (muerto in reto) {
        throw new Error(`El campo ${muerto} ya no se usa: quitarlo de reto.json`);
      }
    }

    // dificultad y categorias son opcionales, pero si están presentes deben tener el tipo correcto
    if (reto.dificultad != null) {
      if (!Number.isInteger(reto.dificultad) || reto.dificultad < 1 || reto.dificultad > 5) {
        throw new Error('dificultad must be an integer between 1 and 5');
      }
    }
    if (reto.categorias != null) {
      if (!Array.isArray(reto.categorias) || !reto.categorias.every(c => typeof c === 'string')) {
        throw new Error('categorias must be an array of strings');
      }
    }

    // Validate data structure based on type
    await this.validateRetoData(reto);
    
    console.log(`📅 Reto ${reto.fecha}: ${reto.titulo} ✓`);
  }

  async validateRetoData(reto) {
    switch (reto.tipo) {
      case 'enigma-einstein':
        await this.validateEinsteinData(reto);
        break;
      case 'balanza-logica':
        await this.validateBalanzaData(reto);
        break;
      case 'poligono-geometrico':
        await this.validatePoligonoData(reto);
        break;
      case 'mezcla-quimica':
        await this.validateMezclaData(reto);
        break;
      case 'luces-fuera':
        await this.validateLucesData(reto);
        break;

      case 'relojes-arena':
        await this.validateRelojesData(reto);
        break;

      case 'puentes-hashi':
        await this.validateHashiData(reto);
        break;

      case 'nonograma':
        await this.validateNonogramaData(reto);
        break;

      case 'cajas-apiladas':
        await this.validateCajasData(reto);
        break;

      case 'anillas-encadenadas':
        await this.validateAnillasData(reto);
        break;

      case 'laser-triangular':
        await this.validateLaserData(reto);
        break;

      case 'riego-plantas':
        await this.validateRiegoData(reto);
        break;

      case 'cinta-transportadora':
        await this.validateCintaData(reto);
        break;

      case 'fabrica-de-bloques':
        await this.validateFabricaData(reto);
        break;

      case 'planos-del-invernadero':
        await this.validateInvernaderoData(reto);
        break;

      case 'radar-asteroides':
        await this.validateRadarData(reto);
        break;

      case 'ruta-del-dron':
        await this.validateDronData(reto);
        break;

      case 'cubo-transportista':
        await this.validateCuboData(reto);
        break;

      case 'desenreda-la-red':
        await this.validateRedData(reto);
        break;

      case 'androides-en-la-fabrica':
        await this.validateAndroidesData(reto);
        break;

      case 'senal-perdida':
        await this.validateSenalData(reto);
        break;

      case 'trazo-perimetral':
        await this.validateTrazoData(reto);
        break;
    }
  }

  async validateEinsteinData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Einstein reto missing json_url');
    }
    
    // Try to load and validate the data file
    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);
    
    if (!data.categories || !data.clues || !data.solution) {
      throw new Error('Invalid Einstein data structure');
    }
    
    // Forma del tablero: `filas x casas`, contando a Persona como fila.
    // Se DERIVA del payload y luego se contrasta con la que el generador
    // declaró, en vez de creerse ninguna de las dos por su cuenta.
    const categories = Object.keys(data.categories);
    const filas = categories.length;
    const casas = Array.isArray(data.categories[categories[0]])
      ? data.categories[categories[0]].length
      : 0;
    if (filas < 4 || filas > 5 || casas < 4 || casas > 5) {
      throw new Error(
        `Einstein puzzle con forma fuera de catálogo: ${filas}x${casas} ` +
        `(se admiten 4x4, 5x4, 4x5 y 5x5)`
      );
    }

    for (const cat of categories) {
      if (!Array.isArray(data.categories[cat]) || data.categories[cat].length !== casas) {
        throw new Error(`Category ${cat} must have exactly ${casas} items`);
      }
    }

    const declarada = (data.meta && data.meta.forma) || null;
    if (declarada && (declarada.filas !== filas || declarada.casas !== casas)) {
      throw new Error(
        `Einstein reto con forma declarada ${declarada.filas}x${declarada.casas} ` +
        `pero tablero de ${filas}x${casas}`
      );
    }

    if (!Array.isArray(data.clues) || data.clues.length === 0) {
      throw new Error('Einstein reto missing clues');
    }

    // Unicidad: se RECALCULA sobre las pistas del archivo publicado, no
    // se confía en que el generador lo hiciera bien. El generador
    // anterior producía sistemáticamente puzzles con 3-4 soluciones
    // válidas, y la plantilla rechaza cualquiera que no sea la
    // almacenada -- es decir, castigaba deducciones correctas.
    const pistas = data.meta && data.meta.pistasEstructuradas;
    if (!Array.isArray(pistas) || pistas.length === 0) {
      throw new Error(
        'Einstein reto missing meta.pistasEstructuradas -- sin ellas no se puede ' +
        'verificar la unicidad de la solución (regenerar con el generador actual)'
      );
    }
    if (pistas.length !== data.clues.length) {
      throw new Error(
        `Einstein reto inconsistente: ${data.clues.length} pistas de texto pero ` +
        `${pistas.length} estructuradas`
      );
    }

    const numSoluciones = contarSolucionesDesdePistas(pistas, { filas, casas });
    if (numSoluciones !== 1) {
      throw new Error(
        `Einstein reto sin solución única: las pistas admiten ${numSoluciones} ` +
        `soluciones distintas (debe ser exactamente 1)`
      );
    }
  }

  async validateBalanzaData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Balanza reto missing json_url');
    }

    // Los parámetros reales (variant/N/k/maxWeighings/anomalies) viven en
    // el archivo referenciado por json_url, no en reto.data directamente
    // -- reto.data solo trae { json_url }. Antes esta función comprobaba
    // reto.data.variant/N/maxWeighings, que nunca existen ahí, así que
    // fallaba siempre para cualquier reto de balanza real.
    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    // El payload va en español (`variant` en kebab, `n_monedas`,
    // `k_impostoras`, `max_pesadas`); los publicados antes traen las
    // claves viejas y `leerConfigBalanza` las traduce, así que a partir
    // de aquí solo existe un idioma.
    const cfg = leerConfigBalanza(data);

    if (!cfg.variant || !cfg.n_monedas || !cfg.max_pesadas) {
      throw new Error(
        'Balanza reto missing required fields (variant/n_monedas/max_pesadas) in data file'
      );
    }

    if (cfg.n_monedas < 3 || cfg.n_monedas > 10) {
      throw new Error('Balanza n_monedas must be between 3 and 10');
    }

    if (!Array.isArray(cfg.anomalies) || cfg.anomalies.length === 0) {
      throw new Error('Balanza reto missing anomalies (instancia sin fijar -- ver fix de A.4)');
    }

    // Solvencia: cota de teoría de la información. Con max_pesadas
    // pesadas de 3 resultados cada una (izq/der/equilibrio) se pueden
    // distinguir como mucho 3^max_pesadas escenarios; si hay más
    // escenarios posibles que eso, el reto NO tiene solución garantizada
    // dentro del número de pesadas que anuncia.
    const scenarios = balanzaScenarios(cfg);
    if (scenarios == null) {
      throw new Error(`Balanza reto has unknown variant: ${cfg.variant}`);
    }
    const maxDistinguishable = Math.pow(3, cfg.max_pesadas);
    if (scenarios > maxDistinguishable) {
      throw new Error(
        `Balanza reto not solvable within max_pesadas: ${scenarios} escenarios posibles ` +
        `(variant=${cfg.variant}, n_monedas=${cfg.n_monedas}, k_impostoras=${cfg.k_impostoras || 1}) ` +
        `requieren más de ${cfg.max_pesadas} pesadas ` +
        `(3^${cfg.max_pesadas}=${maxDistinguishable} < ${scenarios})`
      );
    }
  }

  async validatePoligonoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Poligono reto missing json_url');
    }

    // reto.data solo trae { json_url }: los parámetros reales viven en el
    // archivo referenciado.
    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (data.area == null || data.perimeter == null) {
      throw new Error('Poligono reto missing area or perimeter in data file');
    }

    // Los retos publicados no traen estos campos: se leen como una figura
    // sin restricción de forma, que es exactamente el juego de antes.
    const nFiguras = data.n_figuras ?? 1;
    const formas = data.formas ?? 'libre';

    // Sin esto, un n_figuras de 3 caeria en la rama de dos y se validaria
    // como si fueran dos, que es peor que fallar.
    if (nFiguras !== 1 && nFiguras !== 2) {
      throw new Error(`Poligono n_figuras=${nFiguras} no soportado: solo 1 o 2`);
    }

    if (nFiguras === 1) {
      // Realizabilidad de verdad, no una condición necesaria: comprueba
      // paridad, cota inferior y cota superior de una vez.
      if (!alcanzable(data.area, data.perimeter)) {
        throw new Error(
          `Poligono imposible: no hay figura alcanzable con area=${data.area} y perimetro=${data.perimeter}`
        );
      }
      if (formas === 'libre') return;
      if (!clasifica(data.area, data.perimeter)[formas]) {
        throw new Error(
          `Poligono formas="${formas}" insatisfacible para area=${data.area} perimetro=${data.perimeter}`
        );
      }
      return;
    }

    // Con dos figuras los números son totales, así que no describen una
    // sola figura y `alcanzable` no aplica. Lo que se deduce es el reparto,
    // y por eso tiene que haber exactamente uno: ni cero (imposible) ni
    // varios (ambiguo). Es lo mismo que hace riego contando calendarios.
    const posibles = repartos(data.area, data.perimeter, formas);
    if (posibles.length !== 1) {
      throw new Error(
        `Poligono reparto no unico: area=${data.area} perimetro=${data.perimeter} ` +
        `formas="${formas}" admite ${posibles.length} repartos`
      );
    }
  }

  async validateMezclaData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Mezcla reto missing json_url');
    }

    // Igual que en balanza (ver A.4/A.5 del informe): reto.data solo trae
    // { json_url }, los parámetros reales viven en el archivo referenciado.
    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    // Los objetivos van como lista (`targets`); los retos de un solo
    // compuesto se escribieron con `target` a secas y siguen valiendo.
    const objetivos = objetivosMezcla(data);
    if (!data.capacities || objetivos.length === 0 || !data.initialLevels) {
      throw new Error('Mezcla reto missing required fields in data file');
    }

    // El eje del dosificador es un booleano explícito: si falta, el solver lo
    // leería como "sin grifo" en silencio y el reto podría ser imposible.
    if (typeof data.grifo !== 'boolean') {
      throw new Error('Mezcla reto missing boolean field `grifo` in data file');
    }

    if (!Array.isArray(data.capacities) || data.capacities.length < 2) {
      throw new Error('Mezcla must have at least 2 matraces');
    }

    if (!Array.isArray(data.initialLevels) || data.initialLevels.length !== data.capacities.length) {
      throw new Error('Mezcla initialLevels must match capacities length');
    }

    // El arranque tiene que ser el que dicta la regla del tipo: con grifo,
    // matraces en seco; sin él, todo el reactivo en el primero. Un arranque
    // a mano distinto cambiaría el mínimo publicado sin que nadie se entere.
    const esperado = initialLevelsMezcla(data.capacities, data.grifo);
    if (data.initialLevels.join(',') !== esperado.join(',')) {
      throw new Error(
        `Mezcla initialLevels [${data.initialLevels}] no coincide con el arranque ` +
        `del tipo para grifo=${data.grifo}: [${esperado}]`
      );
    }

    // Solvencia: BFS sobre el espacio de estados real (mismo módulo que
    // usa el generador para calcular objectives.parMoves).
    const min = solveMezcla(data);
    if (min === null) {
      throw new Error(
        `Mezcla reto not solvable: no hay ninguna secuencia de trasvases que sintetice ` +
        `targets=[${objetivos}] desde capacities=[${data.capacities}] con initialLevels=[${data.initialLevels}]`
      );
    }

    // Y que no sea trivial: un objetivo que sale de llenar un matraz y
    // volcarlo no es un reto, aunque el BFS lo dé por resuelto. Con varios
    // compuestos el listón sube en proporción, o el segundo solo alargaría
    // el reto sin aportar deducción.
    const exigido = minimoExigidoMezcla(objetivos.length);
    if (min < exigido) {
      throw new Error(
        `Mezcla reto trivial: sus ${objetivos.length} objetivo(s) se sintetizan en ` +
        `${min} movimiento(s), por debajo del mínimo de ${exigido} ` +
        `(capacities=[${data.capacities}], targets=[${objetivos}])`
      );
    }

    // El mínimo publicado tiene que ser el real: es lo que la portada enseña
    // como par del reto y lo que decide las estrellas.
    if (reto.objectives && reto.objectives.parMoves !== min) {
      throw new Error(
        `Mezcla parMoves=${reto.objectives.parMoves} no coincide con el mínimo real del BFS (${min})`
      );
    }
  }

  async validateLucesData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Luces-fuera reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Array.isArray(data.modos) || data.modos.length === 0) {
      throw new Error('Luces-fuera reto missing modos');
    }

    for (const modo of data.modos) {
      if (!Array.isArray(modo.tamano) || modo.tamano.length !== 2) {
        throw new Error(`Luces-fuera modo "${modo.id}" missing valid tamano`);
      }
      const [rows, cols] = modo.tamano;

      if (!Array.isArray(modo.patron_inicial)) {
        // 'todo_apagado' / 'aleatorio' (bug de A.4, fuera de alcance
        // aquí) / ausente: no hay una instancia concreta que comprobar.
        continue;
      }

      if (modo.patron_inicial.length !== rows || modo.patron_inicial.some((row) => row.length !== cols)) {
        throw new Error(`Luces-fuera modo "${modo.id}" patron_inicial no coincide con tamano`);
      }

      // El objetivo `pattern_match` dibuja su diana en el tablero, así que
      // tiene que tener la forma del tablero: sin esto, una diana mal
      // dimensionada revienta más abajo con un TypeError ilegible.
      if (modo.objetivo === 'pattern_match') {
        const diana = modo.patron_objetivo;
        if (!Array.isArray(diana) || diana.length !== rows || diana.some((row) => !Array.isArray(row) || row.length !== cols)) {
          throw new Error(`Luces-fuera modo "${modo.id}" patron_objetivo no coincide con tamano`);
        }
      }

      // Solvencia real vía GF(2) (mismo módulo que usa el generador para
      // calcular objectives.parMoves) -- no se asume que, por venir del
      // generador, ya es correcto.
      const minMoves = solveLightsOutFor(modo);
      if (minMoves == null) {
        throw new Error(`Luces-fuera modo "${modo.id}" not solvable: patron_inicial no tiene solución para objetivo="${modo.objetivo}"`);
      }

      // Y el mínimo declarado tiene que ser el real, como ya se cruza en
      // mezcla: de él salen los umbrales de estrellas, así que un parMoves
      // equivocado se publica como un reto que nadie puede bordar (o que
      // se borda sin esforzarse) sin que falle nada visible.
      if (reto.objectives && reto.objectives.parMoves !== minMoves) {
        throw new Error(
          `Luces-fuera modo "${modo.id}" parMoves=${reto.objectives.parMoves} no coincide con el mínimo real (${minMoves})`
        );
      }
    }
  }

  async validateRelojesData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Relojes-arena reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Array.isArray(data.glasses) || data.glasses.length < 2) {
      throw new Error('Relojes-arena reto necesita al menos 2 relojes en glasses');
    }
    if (data.glasses.some((g) => !Number.isInteger(g) || g <= 0)) {
      throw new Error(`Relojes-arena glasses debe ser enteros de minutos > 0: [${data.glasses}]`);
    }
    if (!Number.isInteger(data.target) || data.target <= 0) {
      throw new Error(`Relojes-arena target inválido: ${data.target}`);
    }
    if (data.tolerance != null && (typeof data.tolerance !== 'number' || data.tolerance <= 0)) {
      throw new Error(`Relojes-arena tolerance inválido: ${data.tolerance}`);
    }

    const variant = data.variant || 'clasico';
    if (variant !== 'clasico' && variant !== 'diferido') {
      throw new Error(`Relojes-arena variant desconocida: "${variant}"`);
    }

    // Solvencia real vía BFS sobre el espacio de estados (mismo módulo que
    // usa el generador) -- no se asume que, por venir del generador, ya es
    // correcto.
    const sol = solveRelojes(data.glasses, data.target, variant);
    if (!sol) {
      throw new Error(
        `Relojes-arena not solvable: no se puede medir target=${data.target} min ` +
        `con relojes=[${data.glasses}] en variante "${variant}"`
      );
    }

    // La variante 'diferido' promete que el objetivo NO sale con el
    // cronómetro corriendo desde el principio; si sale, el reto está mal
    // etiquetado y sus pistas mienten.
    if (variant === 'diferido' && solveRelojes(data.glasses, data.target, 'clasico', { maxRondas: 20 })) {
      throw new Error(
        `Relojes-arena variante "diferido" pero target=${data.target} sí es medible desde t=0 ` +
        `con relojes=[${data.glasses}]`
      );
    }

    if (data.min_rondas != null && data.min_rondas !== sol.rondasTotales) {
      throw new Error(
        `Relojes-arena min_rondas=${data.min_rondas} no coincide con el mínimo real ${sol.rondasTotales} ` +
        `(relojes=[${data.glasses}], target=${data.target}, variante "${variant}")`
      );
    }
  }

  async validateHashiData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Puentes-hashi reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Number.isInteger(data.rows) || !Number.isInteger(data.cols) || data.rows < 2 || data.cols < 2) {
      throw new Error(`Puentes-hashi tablero inválido: rows=${data.rows}, cols=${data.cols}`);
    }
    if (!Array.isArray(data.islands) || data.islands.length < 2) {
      throw new Error('Puentes-hashi reto necesita al menos 2 islas');
    }

    const celdas = new Set();
    for (const isla of data.islands) {
      if (!Number.isInteger(isla.row) || !Number.isInteger(isla.col) || !Number.isInteger(isla.grado)) {
        throw new Error(`Puentes-hashi isla mal formada: ${JSON.stringify(isla)}`);
      }
      if (isla.row < 0 || isla.row >= data.rows || isla.col < 0 || isla.col >= data.cols) {
        throw new Error(`Puentes-hashi isla fuera del tablero: ${JSON.stringify(isla)}`);
      }
      // 8 es el máximo físico: 4 direcciones x 2 puentes.
      if (isla.grado < 1 || isla.grado > 8) {
        throw new Error(`Puentes-hashi grado fuera de rango 1..8: ${JSON.stringify(isla)}`);
      }
      // La forma no es decoración: cuadrado/triángulo/rectángulo dicen el
      // grado sin número visible, así que si no coincide el reto miente.
      if (isla.forma != null) {
        if (!(isla.forma in FORMA_FIJA)) {
          throw new Error(`Puentes-hashi forma desconocida: ${JSON.stringify(isla)}`);
        }
        if (isla.grado !== FORMA_FIJA[isla.forma]) {
          throw new Error(
            `Puentes-hashi forma "${isla.forma}" exige grado ${FORMA_FIJA[isla.forma]}, ` +
            `pero la isla tiene grado ${isla.grado}: ${JSON.stringify(isla)}`
          );
        }
      }
      const clave = `${isla.row},${isla.col}`;
      if (celdas.has(clave)) {
        throw new Error(`Puentes-hashi dos islas en la misma celda: ${clave}`);
      }
      celdas.add(clave);
    }

    // Una isla sin ninguna vecina alineada no podría recibir puentes nunca.
    const { pares } = construirPares({ rows: data.rows, cols: data.cols, islands: data.islands });
    const vecinos = data.islands.map(() => 0);
    pares.forEach((par) => { vecinos[par.a]++; vecinos[par.b]++; });
    const aislada = vecinos.findIndex((v) => v === 0);
    if (aislada !== -1) {
      throw new Error(`Puentes-hashi isla sin vecinas alineadas: ${JSON.stringify(data.islands[aislada])}`);
    }

    // Se cuentan las soluciones de verdad con el mismo solver que usa el
    // generador -- no se da por bueno que venga de él. Cero soluciones es un
    // reto imposible; dos o más es un reto ambiguo, que en hashi se considera
    // igual de roto porque deja de poder razonarse.
    const res = solveHashi({ rows: data.rows, cols: data.cols, islands: data.islands }, { tope: 2 });
    if (res.soluciones === 0) {
      throw new Error(
        `Puentes-hashi not solvable: no hay forma de cumplir todos los grados ` +
        `sin cruces y con todo conectado (${data.islands.length} islas, ${data.rows}x${data.cols})`
      );
    }
    if (res.soluciones > 1) {
      throw new Error(
        `Puentes-hashi ambiguo: hay al menos 2 soluciones distintas válidas ` +
        `(${data.islands.length} islas, ${data.rows}x${data.cols})`
      );
    }

    const total = res.primera.reduce((acc, p) => acc + p.count, 0);
    if (data.min_puentes != null && data.min_puentes !== total) {
      throw new Error(
        `Puentes-hashi min_puentes=${data.min_puentes} no coincide con los ${total} puentes ` +
        `de la única solución real`
      );
    }
  }

  async validateNonogramaData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Nonograma reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Array.isArray(data.grid) || !data.grid.length || !Array.isArray(data.grid[0])) {
      throw new Error('Nonograma reto sin cuadrícula válida');
    }
    const filas = data.grid.length;
    const columnas = data.grid[0].length;
    // Sin paleta el reto es monocromo y el grid solo admite 0 y 1; con ella,
    // cada celda es 0 (vacía) o el índice 1..n de un color de la paleta.
    const color = Array.isArray(data.paleta);
    const maxColor = color ? data.paleta.length : 1;
    if (color && data.paleta.length < 2) {
      throw new Error(
        `Nonograma en color con una paleta de ${data.paleta.length}: con un solo color es un monocromo teñido`
      );
    }
    for (const fila of data.grid) {
      if (!Array.isArray(fila) || fila.length !== columnas) {
        throw new Error(`Nonograma cuadrícula no rectangular: se esperaban ${columnas} celdas por fila`);
      }
      if (fila.some((v) => !Number.isInteger(v) || v < 0 || v > maxColor)) {
        throw new Error(
          color
            ? `Nonograma con un color fuera de la paleta de ${maxColor}: [${fila}]`
            : `Nonograma cuadrícula con valores que no son 0 ni 1: [${fila}]`
        );
      }
    }
    if (data.rows != null && data.rows !== filas) {
      throw new Error(`Nonograma rows=${data.rows} no coincide con las ${filas} filas de la cuadrícula`);
    }
    if (data.cols != null && data.cols !== columnas) {
      throw new Error(`Nonograma cols=${data.cols} no coincide con las ${columnas} columnas de la cuadrícula`);
    }
    if (!data.grid.flat().some((v) => v > 0)) {
      throw new Error('Nonograma completamente vacío: no hay nada que dibujar');
    }

    // Aquí está lo importante: plantillas/nonograma.js da la victoria
    // comparando celda a celda contra esta cuadrícula, así que unas pistas
    // con dos soluciones dejarían al jugador sin poder ganar aunque su
    // dibujo cumpliera todos los números. Se vuelve a resolver desde las
    // pistas para comprobar que la solución es única y que es exactamente
    // esta.
    const { filas: pistasFilas, columnas: pistasColumnas } = color
      ? pistasColorDe(data.grid)
      : pistasDe(data.grid);
    const res = resolverNonograma(pistasFilas, pistasColumnas, { tope: 2 });
    if (res.soluciones === 0) {
      throw new Error(`Nonograma not solvable: las pistas de ${filas}x${columnas} no admiten ninguna solución`);
    }
    if (res.soluciones > 1) {
      throw new Error(
        `Nonograma ambiguo: las pistas de ${filas}x${columnas} admiten al menos 2 dibujos distintos, ` +
        `y la plantilla solo da por buena la cuadrícula guardada`
      );
    }
    const iguales = res.primera.every((fila, r) => fila.every((v, c) => v === data.grid[r][c]));
    if (!iguales) {
      throw new Error('Nonograma: la única solución de las pistas no es la cuadrícula guardada');
    }
  }

  async validateCajasData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Cajas-apiladas reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Array.isArray(data.zonas) || data.zonas.length !== 3 || data.zonas.some((z) => !Array.isArray(z))) {
      throw new Error('Cajas-apiladas necesita exactamente 3 zonas con sus pilas');
    }
    const todas = data.zonas.flat();
    if (todas.length < 3) {
      throw new Error(`Cajas-apiladas con muy pocas cajas: ${todas.length}`);
    }
    if (todas.some((p) => !Number.isInteger(p) || p <= 0)) {
      throw new Error(`Cajas-apiladas con pesos que no son enteros positivos: [${todas}]`);
    }
    if (new Set(todas).size !== todas.length) {
      throw new Error(`Cajas-apiladas con pesos repetidos: [${todas}] -- el orden de apilado dejaría de estar definido`);
    }
    for (const zona of data.zonas) {
      for (let i = 1; i < zona.length; i++) {
        if (zona[i] >= zona[i - 1]) {
          throw new Error(`Cajas-apiladas arranca con una caja de ${zona[i]} kg sobre otra de ${zona[i - 1]} kg: la propia regla del juego lo prohíbe`);
        }
      }
    }

    const destino = Number.isInteger(data.destino) ? data.destino : 2;
    if (destino < 0 || destino > 2) {
      throw new Error(`Cajas-apiladas destino fuera de rango: ${data.destino}`);
    }
    if (data.zonas[destino].length === todas.length) {
      throw new Error('Cajas-apiladas ya viene resuelto');
    }

    const masPesada = Math.max(...todas);
    if (!Number.isInteger(data.capacidad) || data.capacidad < masPesada) {
      throw new Error(
        `Cajas-apiladas capacidad=${data.capacidad} no llega para la caja de ${masPesada} kg, ` +
        `que entonces no se podría mover nunca`
      );
    }

    // Mínimo real por BFS, con el mismo módulo que usó el generador.
    const res = solveCajas({ zonas: data.zonas.map((z) => [...z]), capacidad: data.capacidad, destino });
    if (!res) {
      throw new Error(`Cajas-apiladas not solvable: no hay forma de reunir las ${todas.length} cajas en la zona destino`);
    }
    if (data.min_movimientos != null && data.min_movimientos !== res.movimientos) {
      throw new Error(
        `Cajas-apiladas min_movimientos=${data.min_movimientos} no coincide con el mínimo real ${res.movimientos}`
      );
    }

    // Si el mínimo llega al 2^n - 1 de Hanói, la carga por kilos no está
    // aportando nada y el reto ha vuelto a ser el de siempre.
    const hanoi = Math.pow(2, todas.length) - 1;
    if (res.movimientos >= hanoi) {
      throw new Error(
        `Cajas-apiladas sin gracia: el mínimo (${res.movimientos}) iguala o supera el ${hanoi} de Hanói, ` +
        `así que la capacidad de carga no cambia nada`
      );
    }
  }

  async validateAnillasData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Anillas-encadenadas reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    const esEstado = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'boolean');
    if (!Number.isInteger(data.rings) || data.rings < 3 || data.rings > 8) {
      throw new Error(`Anillas-encadenadas rings fuera de rango 3..8: ${data.rings}`);
    }
    if (!esEstado(data.inicial, data.rings)) {
      throw new Error(`Anillas-encadenadas inicial mal formado para ${data.rings} anillas`);
    }
    if (!esEstado(data.objetivo, data.rings)) {
      throw new Error(`Anillas-encadenadas objetivo mal formado para ${data.rings} anillas`);
    }
    if (data.inicial.every((v, i) => v === data.objetivo[i])) {
      throw new Error('Anillas-encadenadas ya viene resuelto: inicial y objetivo son iguales');
    }

    const regla = data.regla || 'clasico';
    if (regla !== 'clasico' && regla !== 'dos-de-golpe') {
      throw new Error(`Anillas-encadenadas regla desconocida: "${regla}"`);
    }

    // Mínimo real por BFS. El generador lo calcula con la fórmula del código
    // de Gray, así que aquí se comprueba por un camino distinto: si la
    // fórmula fallara, este validador no la acompañaría en el error.
    const sol = resolverAnillas(data.inicial, data.objetivo, regla);
    if (!sol) {
      throw new Error(
        `Anillas-encadenadas not solvable: no se llega de ${data.inicial.map(Number).join('')} ` +
        `a ${data.objetivo.map(Number).join('')} con la regla "${regla}"`
      );
    }
    if (data.min_movimientos != null && data.min_movimientos !== sol.movimientos) {
      throw new Error(
        `Anillas-encadenadas min_movimientos=${data.min_movimientos} no coincide con el mínimo real ${sol.movimientos}`
      );
    }
    if (sol.movimientos < data.rings) {
      throw new Error(`Anillas-encadenadas demasiado fácil: se resuelve en ${sol.movimientos} movimientos`);
    }
  }

  async validateLaserData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Laser-triangular reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);
    // normalizaConfig entiende tanto el esquema viejo (lasers[].target, sin
    // modo ni colores) como el nuevo (modo + targets separados): así los
    // payloads ya publicados en data/ siguen validando sin tocarlos.
    const c = normalizaConfig(data);

    if (!Number.isInteger(c.size) || c.size < 4 || c.size > 9) {
      throw new Error(`Laser-triangular size fuera de rango 4..9: ${c.size}`);
    }
    if (!MODOS.includes(c.modo)) {
      throw new Error(`Laser-triangular modo desconocido: "${c.modo}"`);
    }
    if (!c.lasers.length || !c.targets.length) {
      throw new Error('Laser-triangular necesita al menos un emisor y una diana');
    }
    if (c.modo === 'prisma') {
      if (c.lasers.length !== 1 || c.targets.length !== 2) {
        throw new Error('Laser-triangular modo prisma: hace falta un emisor y dos dianas');
      }
      if (c.targets[0].color === c.targets[1].color) {
        throw new Error('Laser-triangular modo prisma: las dos dianas tienen el mismo color');
      }
    }
    if (c.modo === 'condensador') {
      if (c.lasers.length !== 1 || c.targets.length !== 1 || c.targets[0].color !== 'magenta') {
        throw new Error('Laser-triangular modo condensador: hace falta un emisor y una unica diana magenta');
      }
    }
    for (const t of c.targets) {
      const conocido = COLORES.includes(t.color) || /^neutro-\d+$/.test(t.color);
      if (!conocido) throw new Error(`Laser-triangular color de diana desconocido: "${t.color}"`);
    }

    // Se conservan tal cual las comprobaciones de siempre: emisores y dianas
    // dentro del tablero, sin dos objetos en la misma celda, bloques fuera
    // de esas celdas, direcciones conocidas.
    const dentro = (p) => p && Number.isInteger(p.row) && Number.isInteger(p.col) &&
      p.row >= 0 && p.row < c.size && p.col >= 0 && p.col < c.size;
    const ocupadas = new Set();
    for (const l of c.lasers) {
      if (!dentro(l.emitter)) {
        throw new Error(`Laser-triangular con emisor fuera del tablero: ${JSON.stringify(l)}`);
      }
      if (!DIR_VECTOR[l.emitter.dir]) {
        throw new Error(`Laser-triangular dirección desconocida: "${l.emitter.dir}"`);
      }
      const clave = `${l.emitter.row},${l.emitter.col}`;
      if (ocupadas.has(clave)) {
        throw new Error(`Laser-triangular con dos objetos en la misma celda: ${clave}`);
      }
      ocupadas.add(clave);
    }
    for (const t of c.targets) {
      if (!dentro(t)) {
        throw new Error(`Laser-triangular con diana fuera del tablero: ${JSON.stringify(t)}`);
      }
      const clave = `${t.row},${t.col}`;
      if (ocupadas.has(clave)) {
        throw new Error(`Laser-triangular con dos objetos en la misma celda: ${clave}`);
      }
      ocupadas.add(clave);
    }
    for (const b of c.blocks || []) {
      if (!dentro(b)) throw new Error(`Laser-triangular bloque fuera del tablero: ${JSON.stringify(b)}`);
      if (ocupadas.has(`${b.row},${b.col}`)) {
        throw new Error(`Laser-triangular con un bloque encima de un emisor o diana: ${b.row},${b.col}`);
      }
    }

    // Un reto que ya está resuelto sin tocar nada no es un reto.
    if (laserResuelto(c, crearPiezas(c.size))) {
      throw new Error('Laser-triangular ya viene resuelto sin colocar ninguna pieza');
    }

    // Se busca de verdad una solución, con el mismo trazador que usa la
    // plantilla: si no aparece con min_piezas, el reto es imposible. Los
    // payloads viejos solo llevan min_espejos.
    const declarados = Number.isInteger(data.min_piezas) ? data.min_piezas
      : (Number.isInteger(data.min_espejos) ? data.min_espejos : 4);
    const minimo = piezasMinimas(c, declarados);
    if (minimo === null) {
      throw new Error(
        `Laser-triangular not solvable: no hay solución con ${declarados} piezas o menos`
      );
    }
    if (minimo !== declarados) {
      throw new Error(
        `Laser-triangular min_piezas=${declarados} pero se resuelve con ${minimo}: el par anunciado no es el real`
      );
    }
  }

  async validateRiegoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Riego-plantas reto missing json_url');
    }

    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Number.isInteger(data.cycles) || data.cycles < 3 || data.cycles > 12) {
      throw new Error(`Riego-plantas cycles fuera de rango 3..12: ${data.cycles}`);
    }
    if (!Number.isInteger(data.capacity) || data.capacity < 1) {
      throw new Error(`Riego-plantas capacity inválida: ${data.capacity}`);
    }
    if (!Array.isArray(data.plants) || data.plants.length < 2) {
      throw new Error('Riego-plantas necesita al menos 2 plantas');
    }
    if (data.incompatibles !== undefined) {
      if (!Array.isArray(data.incompatibles) || data.incompatibles.length !== 2) {
        throw new Error(`Riego-plantas incompatibles debe ser un par de ids: ${JSON.stringify(data.incompatibles)}`);
      }
      for (const id of data.incompatibles) {
        if (!data.plants.some((p) => p.id === id)) {
          throw new Error(`Riego-plantas incompatibles referencia una planta inexistente: ${id}`);
        }
      }
    }

    const nombres = new Set();
    for (const p of data.plants) {
      if (!p.id || nombres.has(p.id)) {
        throw new Error(`Riego-plantas con planta sin nombre o repetida: ${JSON.stringify(p)}`);
      }
      nombres.add(p.id);
      if (!Number.isInteger(p.doses) || p.doses < 1) {
        throw new Error(`Riego-plantas dosis inválidas en ${p.id}: ${p.doses}`);
      }
      if (!Array.isArray(p.ventana) || !p.ventana.length) {
        throw new Error(`Riego-plantas ${p.id} sin ventana de riego`);
      }
      if (new Set(p.ventana).size !== p.ventana.length) {
        throw new Error(`Riego-plantas ${p.id} con ciclos repetidos en su ventana`);
      }
      for (const c of p.ventana) {
        if (!Number.isInteger(c) || c < 0 || c >= data.cycles) {
          throw new Error(`Riego-plantas ${p.id} con un ciclo fuera de rango: ${c}`);
        }
      }
      if (!combinacionesPlanta(p).length) {
        throw new Error(
          `Riego-plantas ${p.id} no puede colocar sus ${p.doses} riegos en los ciclos [${p.ventana.map((c) => c + 1)}] ` +
          `respetando el descanso`
        );
      }
    }

    // Solución única: la plantilla da por bueno cualquier calendario que
    // cumpla las reglas, así que con varias soluciones el jugador acierta por
    // casualidad y el reto deja de tener deducción.
    const res = contarRiegos({
      cycles: data.cycles,
      capacity: data.capacity,
      plants: data.plants,
      ...(data.incompatibles ? { incompatibles: data.incompatibles } : {})
    }, { tope: 2 });
    if (res.soluciones === 0) {
      throw new Error('Riego-plantas not solvable: no hay ningún calendario que cumpla las reglas');
    }
    if (res.soluciones > 1) {
      throw new Error('Riego-plantas ambiguo: hay al menos 2 calendarios válidos distintos');
    }

    // Con las ventanas clavadas a la solución no hay nada que decidir --
    // por planta, no por suma total (una planta de holgura 5 no puede
    // compensar a otra de holgura 0: ver MARGEN_MINIMO en riego-logic.js).
    const variant = MARGEN_MINIMO[data.variant] !== undefined ? data.variant : 'huerto';
    const falta = data.plants.find((p) => (p.ventana.length - p.doses) < MARGEN_MINIMO[variant]);
    if (falta) {
      throw new Error(
        `Riego-plantas sin margen de decisión: ${falta.id} solo tiene holgura ` +
        `${falta.ventana.length - falta.doses} (mínimo ${MARGEN_MINIMO[variant]} para ${variant})`
      );
    }
  }

  async validateCintaData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Cinta-transportadora reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    if (!Number.isInteger(data.n_cajas) || data.n_cajas < 3 || data.n_cajas > 20) {
      throw new Error(`Cinta-transportadora n_cajas inválido: ${data.n_cajas}`);
    }
    if (!Number.isInteger(data.patron_salto) || data.patron_salto < 0) {
      throw new Error(`Cinta-transportadora patron_salto inválido: ${data.patron_salto}`);
    }

    const esPermutacion = (arr) => Array.isArray(arr) && arr.length === data.n_cajas &&
      new Set(arr).size === data.n_cajas &&
      arr.every((v) => Number.isInteger(v) && v >= 1 && v <= data.n_cajas);

    if (!esPermutacion(data.orden_objetivo)) {
      throw new Error('Cinta-transportadora orden_objetivo debe ser una permutación de 1..n_cajas');
    }
    if (!esPermutacion(data.solucion_colocacion)) {
      throw new Error('Cinta-transportadora solucion_colocacion debe ser una permutación de 1..n_cajas');
    }

    // Solvencia: la colocación que escribió el generador tiene que sacar
    // de verdad las cajas en el orden pedido -- misma simulación que usa
    // la plantilla, no una copia que pueda desincronizarse.
    const salida = simulaSalida(data.solucion_colocacion, data.patron_salto + 1);
    if (JSON.stringify(salida) !== JSON.stringify(data.orden_objetivo)) {
      throw new Error(
        `Cinta-transportadora solucion_colocacion no produce orden_objetivo: sale ${salida.join(',')}`
      );
    }
  }

  async validateFabricaData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Fabrica-de-bloques reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![4, 5, 6].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Fabrica-de-bloques tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    if (!Array.isArray(data.solucion) || data.solucion.length !== n) {
      throw new Error('Fabrica-de-bloques solucion inválida');
    }
    for (const fila of data.solucion) {
      if (!Array.isArray(fila) || fila.length !== n || new Set(fila).size !== n) {
        throw new Error('Fabrica-de-bloques solucion no es un cuadrado latino válido (fila repetida)');
      }
      for (const v of fila) {
        if (!Number.isInteger(v) || v < 1 || v > n) {
          throw new Error(`Fabrica-de-bloques valor fuera de rango en la solución: ${v}`);
        }
      }
    }
    for (let c = 0; c < n; c++) {
      const columna = data.solucion.map((fila) => fila[c]);
      if (new Set(columna).size !== n) {
        throw new Error(`Fabrica-de-bloques solucion no es un cuadrado latino válido (columna ${c} repetida)`);
      }
    }

    if (!Array.isArray(data.regiones) || data.regiones.length === 0) {
      throw new Error('Fabrica-de-bloques reto sin regiones');
    }
    const vistas = new Set();
    for (const region of data.regiones) {
      if (!Array.isArray(region.celdas) || region.celdas.length === 0) {
        throw new Error(`Fabrica-de-bloques región ${region.id} sin celdas`);
      }
      for (const [f, c] of region.celdas) {
        if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || f >= n || c < 0 || c >= n) {
          throw new Error(`Fabrica-de-bloques región ${region.id} con celda fuera de tablero: [${f},${c}]`);
        }
        const clave = `${f},${c}`;
        if (vistas.has(clave)) {
          throw new Error(`Fabrica-de-bloques celda [${f},${c}] pertenece a más de una región`);
        }
        vistas.add(clave);
      }
    }
    if (vistas.size !== n * n) {
      throw new Error(`Fabrica-de-bloques regiones no cubren todo el tablero (${vistas.size}/${n * n} celdas)`);
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado con el
    // mismo solver que usa el generador -- no se confía en que el reparto
    // de regiones ya escrito siga siendo único (mismo patrón que
    // hashi/nonograma/riego: recontar, no releer un flag de "ya validado").
    const { soluciones, primera } = contarFabrica(n, data.regiones, { tope: 2 });
    if (soluciones !== 1) {
      throw new Error(
        `Fabrica-de-bloques reto sin solución única: el solver encuentra ${soluciones} ` +
        `solucion(es) (debe ser exactamente 1)`
      );
    }
    if (JSON.stringify(primera) !== JSON.stringify(data.solucion)) {
      throw new Error('Fabrica-de-bloques la solución publicada no coincide con la que el solver encuentra');
    }
  }

  async validateInvernaderoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Planos-del-invernadero reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![6, 8, 10].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Planos-del-invernadero tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    if (!Array.isArray(data.solucion) || data.solucion.length === 0) {
      throw new Error('Planos-del-invernadero reto sin solucion');
    }
    const cubierta = Array.from({ length: n }, () => Array(n).fill(false));
    for (const r of data.solucion) {
      if (
        !Number.isInteger(r.f) || !Number.isInteger(r.c) ||
        !Number.isInteger(r.ancho) || !Number.isInteger(r.alto) ||
        r.f < 0 || r.c < 0 || r.f + r.alto > n || r.c + r.ancho > n
      ) {
        throw new Error(`Planos-del-invernadero rectángulo fuera de tablero: ${JSON.stringify(r)}`);
      }
      for (let f = r.f; f < r.f + r.alto; f++) {
        for (let c = r.c; c < r.c + r.ancho; c++) {
          if (cubierta[f][c]) {
            throw new Error(`Planos-del-invernadero celda [${f},${c}] cubierta por más de un rectángulo`);
          }
          cubierta[f][c] = true;
        }
      }
    }
    for (const fila of cubierta) {
      if (fila.some((v) => !v)) {
        throw new Error('Planos-del-invernadero la solución no cubre todo el tablero');
      }
    }

    if (!Array.isArray(data.pistas) || data.pistas.length !== data.solucion.length) {
      throw new Error('Planos-del-invernadero número de pistas distinto del número de rectángulos');
    }
    for (const pista of data.pistas) {
      if (!Number.isInteger(pista.f) || !Number.isInteger(pista.c) || !Number.isInteger(pista.valor)) {
        throw new Error(`Planos-del-invernadero pista inválida: ${JSON.stringify(pista)}`);
      }
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado, mismo
    // patrón que fabrica-de-bloques/hashi/nonograma -- no se confía en que
    // el generador ya lo comprobara.
    const { soluciones, primera } = contarInvernadero(n, data.pistas, { tope: 2 });
    if (soluciones !== 1) {
      throw new Error(
        `Planos-del-invernadero reto sin solución única: el solver encuentra ${soluciones} ` +
        `solucion(es) (debe ser exactamente 1)`
      );
    }
    const normaliza = (rects) => rects.map((r) => `${r.f},${r.c},${r.ancho},${r.alto}`).sort();
    if (JSON.stringify(normaliza(primera)) !== JSON.stringify(normaliza(data.solucion))) {
      throw new Error('Planos-del-invernadero la solución publicada no coincide con la que el solver encuentra');
    }
  }

  async validateRadarData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Radar-asteroides reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![5, 6, 7].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Radar-asteroides tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    if (!Array.isArray(data.solucion) || data.solucion.length !== n) {
      throw new Error('Radar-asteroides solucion inválida');
    }
    let totalReal = 0;
    for (const fila of data.solucion) {
      if (!Array.isArray(fila) || fila.length !== n) {
        throw new Error('Radar-asteroides solucion con forma inválida');
      }
      for (const v of fila) {
        if (typeof v !== 'boolean') throw new Error('Radar-asteroides solucion debe ser booleanos');
        if (v) totalReal++;
      }
    }
    if (totalReal !== data.asteroides_totales) {
      throw new Error(
        `Radar-asteroides asteroides_totales (${data.asteroides_totales}) no coincide con ` +
        `los que hay de verdad en la solución (${totalReal})`
      );
    }

    if (!Array.isArray(data.pistas) || data.pistas.length === 0) {
      throw new Error('Radar-asteroides reto sin pistas');
    }
    for (const p of data.pistas) {
      if (!Number.isInteger(p.f) || !Number.isInteger(p.c) || p.f < 0 || p.f >= n || p.c < 0 || p.c >= n) {
        throw new Error(`Radar-asteroides pista fuera de tablero: ${JSON.stringify(p)}`);
      }
      if (data.solucion[p.f][p.c]) {
        throw new Error(`Radar-asteroides pista en [${p.f},${p.c}] cae sobre un asteroide de verdad`);
      }
      const real = cuentaVecinos(data.solucion, p.f, p.c);
      if (p.valor !== real) {
        throw new Error(
          `Radar-asteroides pista en [${p.f},${p.c}] dice ${p.valor} pero la solución tiene ${real} vecinos con asteroide`
        );
      }
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado, mismo
    // patrón que fabrica-de-bloques/planos-del-invernadero -- no se confía
    // en que el recorte de pistas del generador siga siendo único.
    const { soluciones, primera } = contarRadar(n, data.pistas, data.asteroides_totales, { tope: 2 });
    if (soluciones !== 1) {
      throw new Error(
        `Radar-asteroides reto sin solución única: el solver encuentra ${soluciones} ` +
        `solucion(es) (debe ser exactamente 1)`
      );
    }
    if (JSON.stringify(primera) !== JSON.stringify(data.solucion)) {
      throw new Error('Radar-asteroides la solución publicada no coincide con la que el solver encuentra');
    }
  }

  async validateDronData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Ruta-del-dron reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![5, 6].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Ruta-del-dron tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    const { meta } = data;
    if (!meta || !Number.isInteger(meta.f) || !Number.isInteger(meta.c) || meta.f < 0 || meta.f >= n || meta.c < 0 || meta.c >= n) {
      throw new Error(`Ruta-del-dron meta inválida: ${JSON.stringify(meta)}`);
    }

    if (!Array.isArray(data.instrucciones) || data.instrucciones.length !== n) {
      throw new Error('Ruta-del-dron instrucciones inválidas');
    }
    const DIRECCIONES_VALIDAS = new Set(['N', 'S', 'E', 'O']);
    for (let f = 0; f < n; f++) {
      const fila = data.instrucciones[f];
      if (!Array.isArray(fila) || fila.length !== n) {
        throw new Error(`Ruta-del-dron instrucciones con forma inválida en la fila ${f}`);
      }
      for (let c = 0; c < n; c++) {
        const instr = fila[c];
        if (f === meta.f && c === meta.c) {
          if (instr !== null) throw new Error('Ruta-del-dron la meta no debe llevar instrucción');
          continue;
        }
        if (!instr || !DIRECCIONES_VALIDAS.has(instr.direccion) || !Number.isInteger(instr.distancia) || instr.distancia < 1) {
          throw new Error(`Ruta-del-dron instrucción inválida en [${f},${c}]: ${JSON.stringify(instr)}`);
        }
      }
    }

    if (!data.solucion || !Number.isInteger(data.solucion.f) || !Number.isInteger(data.solucion.c)) {
      throw new Error('Ruta-del-dron solucion inválida');
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado --
    // mismo patrón que el resto del catálogo, no se confía en que el
    // generador lo dejara bien.
    const { ganadores, mejorLongitud } = evaluaTablero(n, data.instrucciones, meta);
    if (ganadores.length !== 1) {
      throw new Error(
        `Ruta-del-dron reto ambiguo: ${ganadores.length} inicios empatan en la cadena más larga (${mejorLongitud} saltos)`
      );
    }
    if (mejorLongitud < 2) {
      throw new Error('Ruta-del-dron reto trivial: la cadena más larga tiene menos de 2 saltos');
    }
    if (ganadores[0].f !== data.solucion.f || ganadores[0].c !== data.solucion.c) {
      throw new Error('Ruta-del-dron la solución publicada no coincide con el inicio que encuentra el solver');
    }
  }

  async validateCuboData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Cubo-transportista reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![5, 6].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Cubo-transportista tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    const CARAS = new Set([1, 2, 3, 4, 5, 6]);
    const { inicio, meta } = data;
    if (
      !inicio || !inicio.orientacion || !CARAS.has(inicio.orientacion.U) ||
      inicio.f < 0 || inicio.f >= n || inicio.c < 0 || inicio.c >= n
    ) {
      throw new Error(`Cubo-transportista inicio inválido: ${JSON.stringify(inicio)}`);
    }
    if (!meta || !CARAS.has(meta.cara) || meta.f < 0 || meta.f >= n || meta.c < 0 || meta.c >= n) {
      throw new Error(`Cubo-transportista meta inválida: ${JSON.stringify(meta)}`);
    }
    if (meta.f === inicio.f && meta.c === inicio.c) {
      throw new Error('Cubo-transportista la meta coincide con el inicio');
    }
    if (!Number.isInteger(data.minimo) || data.minimo < 2) {
      throw new Error(`Cubo-transportista minimo inválido: ${data.minimo}`);
    }

    // Solvencia: se RECALCULA con el mismo BFS que la plantilla y el
    // generador -- no se confía en el minimo ya escrito.
    const estados = bfsCubo(n, inicio);
    const enMeta = estados.filter((e) => e.f === meta.f && e.c === meta.c && e.orientacion.U === meta.cara);
    if (enMeta.length === 0) {
      throw new Error('Cubo-transportista la meta no es alcanzable desde el inicio');
    }
    const mejor = Math.min(...enMeta.map((e) => e.distancia));
    if (mejor !== data.minimo) {
      throw new Error(
        `Cubo-transportista minimo publicado (${data.minimo}) no coincide con el que encuentra el BFS (${mejor})`
      );
    }
  }

  async validateRedData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Desenreda-la-red reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.nodos;
    if (![8, 10].includes(n)) {
      throw new Error(`Desenreda-la-red nodos inválido: ${n}`);
    }
    if (!Array.isArray(data.aristas) || data.aristas.length !== n - 1) {
      throw new Error(`Desenreda-la-red debe tener exactamente ${n - 1} aristas (árbol)`);
    }
    const vistos = new Set();
    for (const [a, b] of data.aristas) {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a < 0 || a >= n || b < 0 || b >= n) {
        throw new Error(`Desenreda-la-red arista inválida: [${a},${b}]`);
      }
      const clave = [a, b].sort().join('-');
      if (vistos.has(clave)) throw new Error(`Desenreda-la-red arista repetida: [${a},${b}]`);
      vistos.add(clave);
    }
    // Conexo: BFS desde el nodo 0 debe alcanzar los n nodos -- con
    // exactamente n-1 aristas, conexo implica árbol (sin ciclos).
    const vecinos = Array.from({ length: n }, () => []);
    for (const [a, b] of data.aristas) { vecinos[a].push(b); vecinos[b].push(a); }
    const alcanzados = new Set([0]);
    const cola = [0];
    while (cola.length) {
      const actual = cola.pop();
      for (const v of vecinos[actual]) {
        if (!alcanzados.has(v)) { alcanzados.add(v); cola.push(v); }
      }
    }
    if (alcanzados.size !== n) {
      throw new Error('Desenreda-la-red las aristas no forman un árbol conexo');
    }

    if (!Array.isArray(data.posiciones_iniciales) || data.posiciones_iniciales.length !== n) {
      throw new Error('Desenreda-la-red posiciones_iniciales inválidas');
    }

    // Solvencia: al menos un cruce real en las posiciones publicadas --
    // si no, no hay nada que desenredar.
    const cruces = cuentaCruces(data.posiciones_iniciales, data.aristas);
    if (cruces < 1) {
      throw new Error('Desenreda-la-red reto trivial: las posiciones iniciales no tienen ningún cruce');
    }
  }

  async validateAndroidesData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Androides-en-la-fabrica reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![3, 4].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Androides-en-la-fabrica tablero inválido: ${JSON.stringify(data.tablero)}`);
    }
    if (data.numClases !== n) {
      throw new Error(`Androides-en-la-fabrica numClases inválido: ${data.numClases} (se esperaba ${n})`);
    }

    // Capa modelo: cuadrado latino.
    if (!Array.isArray(data.solucionModelo) || data.solucionModelo.length !== n) {
      throw new Error('Androides-en-la-fabrica solucionModelo inválida');
    }
    for (const fila of data.solucionModelo) {
      if (!Array.isArray(fila) || fila.length !== n || new Set(fila).size !== n) {
        throw new Error('Androides-en-la-fabrica solucionModelo no es un cuadrado latino válido (fila repetida)');
      }
      for (const v of fila) {
        if (!Number.isInteger(v) || v < 1 || v > n) {
          throw new Error(`Androides-en-la-fabrica valor de modelo fuera de rango: ${v}`);
        }
      }
    }
    for (let c = 0; c < n; c++) {
      const columna = data.solucionModelo.map((fila) => fila[c]);
      if (new Set(columna).size !== n) {
        throw new Error(`Androides-en-la-fabrica solucionModelo no es un cuadrado latino válido (columna ${c} repetida)`);
      }
    }

    // Capa clase: rejilla libre de 0..numClases-1.
    if (!Array.isArray(data.solucionClase) || data.solucionClase.length !== n) {
      throw new Error('Androides-en-la-fabrica solucionClase inválida');
    }
    for (const fila of data.solucionClase) {
      if (!Array.isArray(fila) || fila.length !== n) {
        throw new Error('Androides-en-la-fabrica solucionClase con fila inválida');
      }
      for (const v of fila) {
        if (!Number.isInteger(v) || v < 0 || v >= n) {
          throw new Error(`Androides-en-la-fabrica valor de clase fuera de rango: ${v}`);
        }
      }
    }

    if (!Array.isArray(data.dadosModelo) || !Array.isArray(data.dadosClase) || !Array.isArray(data.pistasPares)) {
      throw new Error('Androides-en-la-fabrica reto sin dados/pistas');
    }

    const dadosModeloMap = new Map();
    for (const { f, c, valor } of data.dadosModelo) {
      if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || f >= n || c < 0 || c >= n) {
        throw new Error(`Androides-en-la-fabrica dado de modelo fuera de tablero: [${f},${c}]`);
      }
      if (data.solucionModelo[f][c] !== valor) {
        throw new Error(`Androides-en-la-fabrica dado de modelo [${f},${c}]=${valor} no coincide con la solución`);
      }
      dadosModeloMap.set(`${f},${c}`, valor);
    }

    const dadosClaseMap = new Map();
    for (const { f, c, valor } of data.dadosClase) {
      if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || f >= n || c < 0 || c >= n) {
        throw new Error(`Androides-en-la-fabrica dado de clase fuera de tablero: [${f},${c}]`);
      }
      if (data.solucionClase[f][c] !== valor) {
        throw new Error(`Androides-en-la-fabrica dado de clase [${f},${c}]=${valor} no coincide con la solución`);
      }
      dadosClaseMap.set(`${f},${c}`, valor);
    }

    for (const p of data.pistasPares) {
      const [fa, ca] = p.a;
      const [fb, cb] = p.b;
      const adyacentes = (fa === fb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(fa - fb) === 1);
      if (!adyacentes) {
        throw new Error(`Androides-en-la-fabrica pista de par no adyacente: ${JSON.stringify(p)}`);
      }
      const iguales = data.solucionClase[fa][ca] === data.solucionClase[fb][cb];
      if (iguales !== p.misma) {
        throw new Error(`Androides-en-la-fabrica pista de par [${JSON.stringify(p)}] no coincide con la solución`);
      }
    }

    // Solvencia y unicidad de las DOS capas, recalculadas sobre el
    // payload publicado -- no se confía en que la generación siga siendo
    // única (mismo patrón que fabrica-de-bloques/hashi/nonograma/riego).
    const { soluciones: solsModelo, primera: primModelo } = contarAndroidesModelo(n, dadosModeloMap, { tope: 2 });
    if (solsModelo !== 1) {
      throw new Error(`Androides-en-la-fabrica capa modelo sin solución única: ${solsModelo} solucion(es)`);
    }
    if (JSON.stringify(primModelo) !== JSON.stringify(data.solucionModelo)) {
      throw new Error('Androides-en-la-fabrica la solucionModelo publicada no coincide con la que el solver encuentra');
    }

    const { soluciones: solsClase, primera: primClase } = contarAndroidesClase(n, n, dadosClaseMap, data.pistasPares, { tope: 2 });
    if (solsClase !== 1) {
      throw new Error(`Androides-en-la-fabrica capa clase sin solución única: ${solsClase} solucion(es)`);
    }
    if (JSON.stringify(primClase) !== JSON.stringify(data.solucionClase)) {
      throw new Error('Androides-en-la-fabrica la solucionClase publicada no coincide con la que el solver encuentra');
    }
  }

  async validateSenalData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Señal-perdida reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (!Number.isInteger(n) || n < 6 || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Señal-perdida tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    if (!Array.isArray(data.alfabeto) || data.alfabeto.length === 0) {
      throw new Error('Señal-perdida reto sin alfabeto');
    }
    if (!data.solucion || typeof data.solucion !== 'object') {
      throw new Error('Señal-perdida reto sin solucion');
    }
    const celdasUsadas = new Set();
    for (const letra of data.alfabeto) {
      const pos = data.solucion[letra];
      if (
        !Array.isArray(pos) || pos.length !== 2 ||
        !Number.isInteger(pos[0]) || !Number.isInteger(pos[1]) ||
        pos[0] < 0 || pos[0] >= n || pos[1] < 0 || pos[1] >= n
      ) {
        throw new Error(`Señal-perdida posición inválida para "${letra}": ${JSON.stringify(pos)}`);
      }
      const clave = `${pos[0]},${pos[1]}`;
      if (celdasUsadas.has(clave)) {
        throw new Error(`Señal-perdida dos letras comparten celda: ${clave}`);
      }
      celdasUsadas.add(clave);
    }

    if (!Array.isArray(data.mensaje_cifrado) || data.mensaje_cifrado.length === 0) {
      throw new Error('Señal-perdida reto sin mensaje_cifrado');
    }
    const posInversa = new Map();
    for (const letra of data.alfabeto) {
      const [x, y] = data.solucion[letra];
      posInversa.set(`${x},${y}`, letra);
    }
    const descifrado = data.mensaje_cifrado.map(([x, y]) => {
      const letra = posInversa.get(`${x},${y}`);
      if (!letra) throw new Error(`Señal-perdida mensaje_cifrado apunta a una celda sin letra: [${x},${y}]`);
      return letra;
    }).join('');
    if (!descifrado) {
      throw new Error('Señal-perdida el mensaje cifrado no descifra ninguna palabra');
    }

    if (!Array.isArray(data.pistas) || data.pistas.length === 0) {
      throw new Error('Señal-perdida reto sin pistas');
    }
    for (const p of data.pistas) {
      if (!cumplePistaSenal(p, data.solucion)) {
        throw new Error(`Señal-perdida pista falsa sobre la solución publicada: ${JSON.stringify(p)}`);
      }
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado, mismo
    // patrón que el resto del catálogo -- no se confía en que el recorte
    // de pistas del generador siga siendo único.
    const { soluciones, primera } = contarSenal(data.alfabeto, n, data.pistas, { tope: 2 });
    if (soluciones !== 1) {
      throw new Error(
        `Señal-perdida reto sin solución única: el solver encuentra ${soluciones} ` +
        `solucion(es) (debe ser exactamente 1)`
      );
    }
    // JSON.stringify de un objeto es sensible al orden de sus claves, y
    // `primera` las inserta en orden MRV (no en el orden de `alfabeto') --
    // comparar letra a letra evita un falso "no coincide" por puro orden.
    const coincide = data.alfabeto.every((letra) => (
      primera[letra] && primera[letra][0] === data.solucion[letra][0] && primera[letra][1] === data.solucion[letra][1]
    ));
    if (!coincide) {
      throw new Error('Señal-perdida la solución publicada no coincide con la que el solver encuentra');
    }
  }

  async validateTrazoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Trazo-perimetral reto missing json_url');
    }

    const dataPath = reto.data.json_url;
    const dataContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(dataContent);

    const n = data.tablero && data.tablero.ancho;
    if (![5, 6, 7].includes(n) || (data.tablero && data.tablero.alto) !== n) {
      throw new Error(`Trazo-perimetral tablero inválido: ${JSON.stringify(data.tablero)}`);
    }

    if (!Array.isArray(data.solucion) || data.solucion.length !== n) {
      throw new Error('Trazo-perimetral solucion inválida');
    }
    for (const fila of data.solucion) {
      if (!Array.isArray(fila) || fila.length !== n || fila.some((v) => typeof v !== 'boolean')) {
        throw new Error('Trazo-perimetral solucion debe ser una rejilla de booleanos');
      }
    }

    if (!Array.isArray(data.pistas) || data.pistas.length === 0) {
      throw new Error('Trazo-perimetral reto sin pistas');
    }
    for (const p of data.pistas) {
      if (!Number.isInteger(p.f) || !Number.isInteger(p.c) || p.f < 0 || p.f >= n || p.c < 0 || p.c >= n) {
        throw new Error(`Trazo-perimetral pista fuera de tablero: ${JSON.stringify(p)}`);
      }
      const real = pistaDeCeldaTrazo(n, data.solucion, p.f, p.c);
      if (p.valor !== real) {
        throw new Error(
          `Trazo-perimetral pista en [${p.f},${p.c}] dice ${p.valor} pero la solución tiene ${real}`
        );
      }
    }

    // Solvencia y unicidad: se RECALCULA sobre el payload publicado, con
    // un tope de nodos generoso -- no se confía en que el recorte del
    // generador siga siendo único, pero tampoco se deja el validador sin
    // límite (un reto corrupto con muy pocas pistas podría colgar el cron).
    const entradas = data.pistas.map((p) => [`${p.f},${p.c}`, p.valor]);
    const { soluciones, primera, agotado } = contarTrazo(n, entradas, { tope: 2, maxNodos: 5000000 });
    if (agotado) {
      throw new Error('Trazo-perimetral: no se pudo confirmar la unicidad dentro del presupuesto de nodos del validador');
    }
    if (soluciones !== 1) {
      throw new Error(
        `Trazo-perimetral reto sin solución única: el solver encuentra ${soluciones} ` +
        `solucion(es) (debe ser exactamente 1)`
      );
    }
    if (JSON.stringify(primera) !== JSON.stringify(data.solucion)) {
      throw new Error('Trazo-perimetral la solución publicada no coincide con la que el solver encuentra');
    }
  }

  async validateRetosList() {
    try {
      const content = await fs.readFile('lista_retos.json', 'utf8');
      const lista = JSON.parse(content);
      
      if (!Array.isArray(lista)) {
        throw new Error('lista_retos.json must be an array');
      }
      
      // Check all entries have required fields
      for (const reto of lista) {
        if (!reto.fecha || !reto.titulo) {
          throw new Error('Invalid entry in lista_retos.json');
        }
      }
      
      console.log(`📋 Lista contains ${lista.length} retos ✓`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📋 lista_retos.json not found, will be created');
      } else {
        throw error;
      }
    }
  }

  async validateDataFiles() {
    try {
      const dataFiles = await fs.readdir('data');
      console.log(`📁 Found ${dataFiles.length} data files ✓`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 Data directory not found, will be created');
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  const validator = new RetoValidator();
  
  if (process.argv.includes('--latest')) {
    await validator.validateLatest();
  } else {
    await validator.validateAll();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { RetoValidator };
