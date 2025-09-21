import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const validTipos = ['enigma-einstein', 'balanza-logica', 'poligono-geometrico', 'trasvase-ecologico'];
    if (!validTipos.includes(reto.tipo)) {
      throw new Error(`Invalid tipo: ${reto.tipo}`);
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
        this.validateBalanzaData(reto);
        break;
      case 'poligono-geometrico':
        this.validatePoligonoData(reto);
        break;
      case 'trasvase-ecologico':
        this.validateTrasvasData(reto);
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
  }

  validateBalanzaData(reto) {
    const data = reto.data;
    if (!data.variant || !data.N || !data.maxWeighings) {
      throw new Error('Balanza reto missing required fields');
    }
    
    if (data.N < 3 || data.N > 10) {
      throw new Error('Balanza N must be between 3 and 10');
    }
  }

  validatePoligonoData(reto) {
    const data = reto.data;
    if (!data.area || !data.perimeter) {
      throw new Error('Poligono reto missing area or perimeter');
    }
    
    if (data.area <= 0 || data.perimeter <= 0) {
      throw new Error('Area and perimeter must be positive');
    }
  }

  validateTrasvasData(reto) {
    const data = reto.data;
    if (!data.capacities || !data.target || !data.initialLevels) {
      throw new Error('Trasvase reto missing required fields');
    }
    
    if (!Array.isArray(data.capacities) || data.capacities.length < 2) {
      throw new Error('Trasvase must have at least 2 containers');
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
