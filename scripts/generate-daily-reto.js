import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MathGymGenerator {
  constructor() {
    this.templates = {
      'enigma-einstein': this.generateEinstein.bind(this),
      'balanza-logica': this.generateBalanza.bind(this),
      'poligono-geometrico': this.generatePoligono.bind(this),
      'trasvase-ecologico': this.generateTrasvase.bind(this)
    };
  }

  async generateDailyReto(fecha, force = false) {
    if (!fecha) {
      fecha = new Date().toISOString().split('T')[0];
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
    
    const reto = await this.templates[template](seed, fecha);
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
    const variations = [
      {
        personas: ['Ana', 'Carlos', 'Elena', 'David'],
        colores: ['Rojo', 'Azul', 'Verde', 'Amarillo'],
        bebidas: ['Café', 'Té', 'Agua', 'Zumo'],
        mascotas: ['Perro', 'Gato', 'Pez', 'Pájaro']
      },
      {
        personas: ['María', 'Pedro', 'Sofía', 'Miguel'],
        colores: ['Negro', 'Blanco', 'Gris', 'Marrón'],
        bebidas: ['Leche', 'Vino', 'Cerveza', 'Refresco'],
        mascotas: ['Hamster', 'Tortuga', 'Conejo', 'Serpiente']
      },
      {
        personas: ['Laura', 'Andrés', 'Carmen', 'Javier'],
        colores: ['Rosa', 'Violeta', 'Naranja', 'Turquesa'],
        bebidas: ['Batido', 'Soda', 'Kombucha', 'Smoothie'],
        mascotas: ['Iguana', 'Hurón', 'Chinchilla', 'Gecko']
      }
    ];

    const variant = variations[seed % variations.length];
    const shuffled = this.shuffleArrayWithSeed(
      Object.values(variant).map(arr => [...arr]), 
      seed
    );

    // Generate deterministic solution
    const solution = {};
    variant.personas.forEach((persona, i) => {
      solution[persona] = {
        'Camiseta': variant.colores[i],
        'Bebida': variant.bebidas[i],
        'Mascota': variant.mascotas[i]
      };
    });

    const clues = this.generateEinsteinClues(variant, solution, seed);

    const enigmaData = {
      categories: {
        'Persona': variant.personas,
        'Camiseta': variant.colores,
        'Bebida': variant.bebidas,
        'Mascota': variant.mascotas
      },
      clues: clues,
      solution: solution
    };

    // Save data file
    const dataFileName = `enigma_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(enigmaData, null, 2)
    );

    return {
      tipo: 'enigma-einstein',
      titulo: 'Enigma de Einstein',
      objetivo: 'Resuelve el enigma usando las pistas',
      icono_url: 'assets/icono-generico.svg',
      dificultad: 3,
      categorias: ['deduccion', 'logica'],
      data: { json_url: `data/${dataFileName}` }
    };
  }

  generateEinsteinClues(variant, solution, seed) {
    const { personas, colores, bebidas, mascotas } = variant;
    
    // Basic clues (always include some direct assignments)
    const clues = [
      `${personas[0]} viste camiseta ${colores[0].toLowerCase()}.`,
      `${personas[1]} bebe ${bebidas[1].toLowerCase()}.`,
      `${personas[2]} tiene un ${mascotas[2].toLowerCase()}.`
    ];

    // Add relational clues based on seed
    const relations = [
      `Quien viste camiseta ${colores[3].toLowerCase()} no bebe ${bebidas[0].toLowerCase()}.`,
      `El ${mascotas[1].toLowerCase()} pertenece a quien bebe ${bebidas[1].toLowerCase()}.`,
      `${personas[3]} no tiene ${mascotas[0].toLowerCase()}.`,
      `Quien bebe ${bebidas[2].toLowerCase()} viste camiseta ${colores[2].toLowerCase()}.`,
      `Quien viste ${colores[1].toLowerCase()} no bebe ${bebidas[3].toLowerCase()}.`,
      `${personas[seed % personas.length]} no viste camiseta ${colores[(seed + 1) % colores.length].toLowerCase()}.`
    ];

    // Add some relations based on seed
    const selectedRelations = relations.slice(0, 5 + (seed % 3));
    clues.push(...selectedRelations);

    return clues;
  }

  async generateBalanza(seed, fecha) {
    const configs = [
      { variant: 'oddUnknown', N: 5, maxWeighings: 3 },
      { variant: 'heaviest', N: 6, k: 1, maxWeighings: 3 },
      { variant: 'lightest', N: 7, k: 1, maxWeighings: 3 },
      { variant: 'oddUnknown', N: 7, maxWeighings: 3 },
      { variant: 'kHeaviest', N: 8, k: 2, maxWeighings: 4 }
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

    return {
      tipo: 'balanza-logica',
      titulo: 'Reto de la Balanza',
      objetivo: 'Encuentra las monedas anómalas con el menor número de pesadas',
      icono_url: 'assets/icono-generico.svg',
      dificultad: 3,
      categorias: ['logica', 'optimizacion'],
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generatePoligono(seed, fecha) {
    const configs = [
      { area: 9, perimeter: 12 },
      { area: 6, perimeter: 10 },
      { area: 12, perimeter: 14 },
      { area: 8, perimeter: 12 },
      { area: 15, perimeter: 16 },
      { area: 10, perimeter: 14 }
    ];

    const config = configs[seed % configs.length];
    config.gridSize = 8;

    // Save data file for poligono
    const dataFileName = `poligono_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      tipo: 'poligono-geometrico',
      titulo: 'Polígono Geométrico',
      objetivo: `Construye un polígono con área ${config.area} y perímetro ${config.perimeter}`,
      icono_url: 'assets/icono-generico.svg',
      dificultad: 2,
      categorias: ['geometria'],
      data: { json_url: `data/${dataFileName}` }
    };
  }

  async generateTrasvase(seed, fecha) {
    const configs = [
      { capacities: [7, 4, 3], target: 5, initialLevels: [7, 0, 0] },
      { capacities: [8, 5, 3], target: 4, initialLevels: [8, 0, 0] },
      { capacities: [9, 4, 2], target: 6, initialLevels: [9, 0, 0] },
      { capacities: [12, 7, 5], target: 9, initialLevels: [12, 0, 0] },
      { capacities: [10, 6, 4], target: 8, initialLevels: [10, 0, 0] }
    ];

    const config = configs[seed % configs.length];

    // Save data file for trasvase
    const dataFileName = `trasvase_${fecha}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(config, null, 2)
    );

    return {
      tipo: 'trasvase-ecologico',
      titulo: 'Trasvase Ecológico',
      objetivo: `Obtén exactamente ${config.target}L`,
      icono_url: 'assets/icono-generico.svg',
      dificultad: 2,
      categorias: ['volumen', 'movimiento'],
      data: { json_url: `data/${dataFileName}` }
    };
  }

  shuffleArrayWithSeed(arrays, seed) {
    // Simple deterministic shuffle
    return arrays.map(arr => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (seed + i) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
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
    const idxs = Array.from({ length: cfg.N }, (_, i) => i);
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
      case 'heaviest':
        anomalies.push({ i: pick(1)[0], sign: 1 });
        break;
      case 'lightest':
        anomalies.push({ i: pick(1)[0], sign: -1 });
        break;
      case 'oddUnknown': {
        const ii = pick(1)[0];
        const sg = rand() < 0.5 ? 1 : -1;
        anomalies.push({ i: ii, sign: sg });
        break;
      }
      case 'kHeaviest':
        pick(cfg.k).forEach((i) => anomalies.push({ i, sign: 1 }));
        break;
      case 'kLightest':
        pick(cfg.k).forEach((i) => anomalies.push({ i, sign: -1 }));
        break;
      case 'kOddUnknown':
        pick(cfg.k).forEach((i) => anomalies.push({ i, sign: rand() < 0.5 ? 1 : -1 }));
        break;
    }
    return anomalies;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const fecha = args[0] || new Date().toISOString().split('T')[0];
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
