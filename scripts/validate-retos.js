import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { balanzaScenarios, leerConfigBalanza } from './balanza-logic.js';
import { solveMezcla, initialLevelsMezcla, minimoExigidoMezcla, objetivosMezcla } from './mezcla-logic.js';
import { solveLightsOutFor } from './lightsout-logic.js';
import { solveRelojes } from './relojes-logic.js';
import { solveHashi, construirPares } from './hashi-logic.js';
import { pistasDe, pistasColorDe, resolverNonograma } from './nonograma-logic.js';
import { solveCajas } from './cajas-logic.js';
import { resolverAnillas } from './anillas-logic.js';
import { resuelto as laserResuelto, espejosMinimos, crearEspejos, DIR_VECTOR } from './laser-triangular-logic.js';
import { contarSoluciones as contarRiegos, combinacionesPlanta } from './riego-logic.js';
import { contarSolucionesDesdePistas } from './einstein-logic.js';
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

    // Igual que en balanza/mezcla: reto.data solo trae { json_url }, los
    // parámetros reales viven en el archivo referenciado. Leerlos de
    // reto.data hacía que este validador fallara siempre para polígono.
    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (data.area == null || data.perimeter == null) {
      throw new Error('Poligono reto missing area or perimeter in data file');
    }

    if (!(data.area > 0) || !(data.perimeter > 0)) {
      throw new Error('Area and perimeter must be positive');
    }

    // Un polígono de área A en la retícula necesita al menos el perímetro del
    // rectángulo más compacto que la contenga, y el perímetro de una figura
    // sobre retícula es siempre par.
    if (data.perimeter % 2 !== 0) {
      throw new Error(`Poligono perimeter=${data.perimeter} debe ser par en una retícula`);
    }
    const minPerimetro = 2 * Math.ceil(2 * Math.sqrt(data.area));
    if (data.perimeter < minPerimetro) {
      throw new Error(
        `Poligono imposible: area=${data.area} necesita perímetro >= ${minPerimetro}, ` +
        `pero pide ${data.perimeter}`
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

    if (!Number.isInteger(data.size) || data.size < 4 || data.size > 9) {
      throw new Error(`Laser-triangular size fuera de rango 4..9: ${data.size}`);
    }
    if (!Array.isArray(data.lasers) || data.lasers.length < 2) {
      throw new Error('Laser-triangular necesita al menos 2 láseres');
    }

    const dentro = (p) => p && Number.isInteger(p.row) && Number.isInteger(p.col) &&
      p.row >= 0 && p.row < data.size && p.col >= 0 && p.col < data.size;
    const ocupadas = new Set();
    for (const l of data.lasers) {
      if (!dentro(l.emitter) || !dentro(l.target)) {
        throw new Error(`Laser-triangular con emisor o diana fuera del tablero: ${JSON.stringify(l)}`);
      }
      if (!DIR_VECTOR[l.emitter.dir]) {
        throw new Error(`Laser-triangular dirección desconocida: "${l.emitter.dir}"`);
      }
      for (const punto of [l.emitter, l.target]) {
        const clave = `${punto.row},${punto.col}`;
        if (ocupadas.has(clave)) {
          throw new Error(`Laser-triangular con dos objetos en la misma celda: ${clave}`);
        }
        ocupadas.add(clave);
      }
    }
    for (const b of data.blocks || []) {
      if (!dentro(b)) throw new Error(`Laser-triangular bloque fuera del tablero: ${JSON.stringify(b)}`);
      if (ocupadas.has(`${b.row},${b.col}`)) {
        throw new Error(`Laser-triangular con un bloque encima de un emisor o diana: ${b.row},${b.col}`);
      }
    }

    const config = { size: data.size, lasers: data.lasers, blocks: data.blocks || [] };

    // Un reto que ya está resuelto sin tocar nada no es un reto.
    if (laserResuelto(config, crearEspejos(data.size))) {
      throw new Error('Laser-triangular ya viene resuelto sin colocar ningún espejo');
    }

    // Se busca de verdad una solución, con el mismo trazador que usa la
    // plantilla: si no aparece con min_espejos, el reto es imposible.
    const declarados = Number.isInteger(data.min_espejos) ? data.min_espejos : 4;
    const minimo = espejosMinimos(config, declarados);
    if (minimo === null) {
      throw new Error(
        `Laser-triangular not solvable: no hay solución con ${declarados} espejos o menos`
      );
    }
    if (minimo !== declarados) {
      throw new Error(
        `Laser-triangular min_espejos=${declarados} pero se resuelve con ${minimo}: el par anunciado no es el real`
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
    const res = contarRiegos({ cycles: data.cycles, capacity: data.capacity, plants: data.plants }, { tope: 2 });
    if (res.soluciones === 0) {
      throw new Error('Riego-plantas not solvable: no hay ningún calendario que cumpla las reglas');
    }
    if (res.soluciones > 1) {
      throw new Error('Riego-plantas ambiguo: hay al menos 2 calendarios válidos distintos');
    }

    // Con las ventanas clavadas a la solución no hay nada que decidir.
    const holgura = data.plants.reduce((acc, p) => acc + (p.ventana.length - p.doses), 0);
    if (holgura < data.plants.length) {
      throw new Error(`Riego-plantas sin margen de decisión: holgura total ${holgura} para ${data.plants.length} plantas`);
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
