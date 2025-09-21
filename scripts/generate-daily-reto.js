const fs = require('fs').promises;
const path = require('path');

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
    
    // Update lista_retos.json
    await this.updateRetosList(fecha, reto.titulo);
    
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

  async updateRetosList(fecha, titulo) {
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
    lista.push({ fecha, titulo });
    
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
        'Color': variant.colores[i],
        'Bebida': variant.bebidas[i],
        'Mascota': variant.mascotas[i]
      };
    });

    const clues = this.generateEinsteinClues(variant, solution, seed);

    const enigmaData = {
      categories: {
        'Persona': variant.personas,
        'Color': variant.colores,
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
      data: { json_url: `data/${dataFileName}` }
    };
  }

  generateEinsteinClues(variant, solution, seed) {
    const { personas, colores, bebidas, mascotas } = variant;
    
    // Basic clues (always include some direct assignments)
    const clues = [
      `${personas[0]} vive en la casa ${colores[0].toLowerCase()}.`,
      `${personas[1]} bebe ${bebidas[1].toLowerCase()}.`,
      `${personas[2]} tiene un ${mascotas[2].toLowerCase()}.`
    ];

    // Add relational clues based on seed
    const relations = [
      `Quien tiene la casa ${colores[3].toLowerCase()} no bebe ${bebidas[0].toLowerCase()}.`,
      `El ${mascotas[1].toLowerCase()} pertenece a quien bebe ${bebidas[1].toLowerCase()}.`,
      `${personas[3]} no tiene ${mascotas[0].toLowerCase()}.`,
      `Quien bebe ${bebidas[2].toLowerCase()} vive en la casa ${colores[2].toLowerCase()}.`,
      `La casa ${colores[1].toLowerCase()} está junto a una casa con ${mascotas[3].toLowerCase()}.`,
      `${personas[seed % personas.length]} no vive en la casa ${colores[(seed + 1) % colores.length].toLowerCase()}.`
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

    return {
      tipo: 'balanza-logica',
      titulo: 'Reto de la Balanza',
      objetivo: 'Encuentra las monedas anómalas con el menor número de pesadas',
      data: configs[seed % configs.length]
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

    return {
      tipo: 'poligono-geometrico',
      titulo: 'Polígono Geométrico',
      objetivo: `Construye un polígono con área ${config.area} y perímetro ${config.perimeter}`,
      data: config
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

    return {
      tipo: 'trasvase-ecologico',
      titulo: 'Trasvase Ecológico',
      objetivo: `Obtén exactamente ${configs[seed % configs.length].target}L`,
      data: configs[seed % configs.length]
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

if (require.main === module) {
  main();
}