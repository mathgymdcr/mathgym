import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { balanzaScenarios } from './balanza-logic.js';
import { isTrasvaseSolvable } from './trasvase-logic.js';
import { solveLightsOutFor } from './lightsout-logic.js';
import { solveRelojes } from './relojes-logic.js';
import { solveHashi, construirPares } from './hashi-logic.js';
import { contarSolucionesDesdePistas } from './einstein-logic.js';

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
    
    // Valid tipo
    const validTipos = ['enigma-einstein', 'balanza-logica', 'poligono-geometrico', 'trasvase-ecologico', 'luces-fuera', 'relojes-arena', 'puentes-hashi'];
    if (!validTipos.includes(reto.tipo)) {
      throw new Error(`Invalid tipo: ${reto.tipo}`);
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
      case 'trasvase-ecologico':
        await this.validateTrasvasData(reto);
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
    
    // Validate 4x4 structure
    const categories = Object.keys(data.categories);
    if (categories.length !== 4) {
      throw new Error('Einstein puzzle must have exactly 4 categories');
    }
    
    for (const cat of categories) {
      if (!Array.isArray(data.categories[cat]) || data.categories[cat].length !== 4) {
        throw new Error(`Category ${cat} must have exactly 4 items`);
      }
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

    const numSoluciones = contarSolucionesDesdePistas(pistas);
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

    if (!data.variant || !data.N || !data.maxWeighings) {
      throw new Error('Balanza reto missing required fields (variant/N/maxWeighings) in data file');
    }

    if (data.N < 3 || data.N > 10) {
      throw new Error('Balanza N must be between 3 and 10');
    }

    if (!Array.isArray(data.anomalies) || data.anomalies.length === 0) {
      throw new Error('Balanza reto missing anomalies (instancia sin fijar -- ver fix de A.4)');
    }

    // Solvencia: cota de teoría de la información. Con maxWeighings
    // pesadas de 3 resultados cada una (izq/der/equilibrio) se pueden
    // distinguir como mucho 3^maxWeighings escenarios; si hay más
    // escenarios posibles que eso, el reto NO tiene solución garantizada
    // dentro del número de pesadas que anuncia.
    const scenarios = balanzaScenarios(data);
    if (scenarios == null) {
      throw new Error(`Balanza reto has unknown variant: ${data.variant}`);
    }
    const maxDistinguishable = Math.pow(3, data.maxWeighings);
    if (scenarios > maxDistinguishable) {
      throw new Error(
        `Balanza reto not solvable within maxWeighings: ${scenarios} escenarios posibles ` +
        `(variant=${data.variant}, N=${data.N}, k=${data.k || 1}) requieren más de ` +
        `${data.maxWeighings} pesadas (3^${data.maxWeighings}=${maxDistinguishable} < ${scenarios})`
      );
    }
  }

  async validatePoligonoData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Poligono reto missing json_url');
    }

    // Igual que en balanza/trasvase: reto.data solo trae { json_url }, los
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

  async validateTrasvasData(reto) {
    if (!reto.data.json_url) {
      throw new Error('Trasvase reto missing json_url');
    }

    // Igual que en balanza (ver A.4/A.5 del informe): reto.data solo trae
    // { json_url }, los parámetros reales viven en el archivo referenciado.
    const dataContent = await fs.readFile(reto.data.json_url, 'utf8');
    const data = JSON.parse(dataContent);

    if (!data.capacities || !data.target || !data.initialLevels) {
      throw new Error('Trasvase reto missing required fields in data file');
    }

    if (!Array.isArray(data.capacities) || data.capacities.length < 2) {
      throw new Error('Trasvase must have at least 2 containers');
    }

    if (!Array.isArray(data.initialLevels) || data.initialLevels.length !== data.capacities.length) {
      throw new Error('Trasvase initialLevels must match capacities length');
    }

    // Solvencia: BFS sobre el espacio de estados real (mismo módulo que
    // usa el generador para calcular objectives.parMoves).
    if (!isTrasvaseSolvable(data)) {
      throw new Error(
        `Trasvase reto not solvable: no hay ninguna secuencia de trasvases que alcance ` +
        `target=${data.target} desde capacities=[${data.capacities}] con initialLevels=[${data.initialLevels}]`
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

      // Solvencia real vía GF(2) (mismo módulo que usa el generador para
      // calcular objectives.parMoves) -- no se asume que, por venir del
      // generador, ya es correcto.
      const minMoves = solveLightsOutFor(modo);
      if (minMoves == null) {
        throw new Error(`Luces-fuera modo "${modo.id}" not solvable: patron_inicial no tiene solución para objetivo="${modo.objetivo}"`);
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
