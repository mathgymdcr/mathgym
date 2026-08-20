import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { balanzaScenarios } from './balanza-logic.js';
import { isTrasvaseSolvable } from './trasvase-logic.js';
import { solveLightsOutFor } from './lightsout-logic.js';
import { solveRelojes } from './relojes-logic.js';
import { solveHashi, construirPares } from './hashi-logic.js';
import { pistasDe, resolverNonograma } from './nonograma-logic.js';
import { solveCajas } from './cajas-logic.js';
import { resolverAnillas } from './anillas-logic.js';
import { resuelto as laserResuelto, espejosMinimos, crearEspejos, DIR_VECTOR } from './laser-triangular-logic.js';
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
    const validTipos = ['enigma-einstein', 'balanza-logica', 'poligono-geometrico', 'trasvase-ecologico', 'luces-fuera', 'relojes-arena', 'puentes-hashi', 'nonograma', 'cajas-apiladas', 'anillas-encadenadas', 'laser-triangular'];
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
    for (const fila of data.grid) {
      if (!Array.isArray(fila) || fila.length !== columnas) {
        throw new Error(`Nonograma cuadrícula no rectangular: se esperaban ${columnas} celdas por fila`);
      }
      if (fila.some((v) => v !== 0 && v !== 1)) {
        throw new Error(`Nonograma cuadrícula con valores que no son 0 ni 1: [${fila}]`);
      }
    }
    if (data.rows != null && data.rows !== filas) {
      throw new Error(`Nonograma rows=${data.rows} no coincide con las ${filas} filas de la cuadrícula`);
    }
    if (data.cols != null && data.cols !== columnas) {
      throw new Error(`Nonograma cols=${data.cols} no coincide con las ${columnas} columnas de la cuadrícula`);
    }
    if (!data.grid.flat().some((v) => v === 1)) {
      throw new Error('Nonograma completamente vacío: no hay nada que dibujar');
    }

    // Aquí está lo importante: plantillas/nonograma.js da la victoria
    // comparando celda a celda contra esta cuadrícula, así que unas pistas
    // con dos soluciones dejarían al jugador sin poder ganar aunque su
    // dibujo cumpliera todos los números. Se vuelve a resolver desde las
    // pistas para comprobar que la solución es única y que es exactamente
    // esta.
    const { filas: pistasFilas, columnas: pistasColumnas } = pistasDe(data.grid);
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
