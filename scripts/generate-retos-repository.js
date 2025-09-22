import { promises as fs } from 'fs';
import path from 'path';

class MathGymAIGenerator {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.model = 'deepseek/deepseek-chat';
    
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    // Distribución de retos
    this.retoTypes = [
      { type: 'enigma-einstein', count: 8 },
      { type: 'balanza-logica', count: 8 },
      { type: 'poligono-geometrico', count: 7 },
      { type: 'trasvase-ecologico', count: 7 }
    ];
  }

  async generateRepository() {
    console.log('🤖 Generando repositorio de 30 retos con IA...');
    
    await fs.mkdir('retos', { recursive: true });
    await fs.mkdir('data', { recursive: true });

    let retoNumber = 1;
    const lista = [];

    for (const { type, count } of this.retoTypes) {
      console.log(`\n📚 Generando ${count} retos de tipo: ${type}`);
      
      for (let i = 0; i < count; i++) {
        const reto = await this.generateReto(type, retoNumber);
        
        // Guardar archivo del reto
        const retoFileName = `${String(retoNumber).padStart(3, '0')}.json`;
        await fs.writeFile(
          path.join('retos', retoFileName),
          JSON.stringify(reto, null, 2)
        );

        // Añadir a la lista
        lista.push({
          numero: retoNumber,
          tipo: type,
          titulo: reto.titulo,
          archivo: `retos/${retoFileName}`
        });

        console.log(`✅ Reto ${retoNumber}: ${reto.titulo}`);
        retoNumber++;

        // Pequeña pausa para no saturar la API
        await this.sleep(1000);
      }
    }

    // Guardar lista maestra
    await fs.writeFile('retos-repository.json', JSON.stringify(lista, null, 2));
    console.log('\n🎉 Repositorio generado completamente!');
    return lista;
  }

  async generateReto(type, numero) {
    const prompt = this.getPrompt(type);
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Eres un experto en crear retos matemáticos y de lógica para adolescentes. Responde SOLO con JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parsear y procesar el JSON generado
      const generatedData = JSON.parse(content);
      return await this.processGeneratedReto(generatedData, type, numero);

    } catch (error) {
      console.error(`❌ Error generando reto ${numero}:`, error.message);
      // Fallback a reto básico
      return this.createFallbackReto(type, numero);
    }
  }

  getPrompt(type) {
    const prompts = {
      'enigma-einstein': `
Crea un enigma de Einstein único con estas características:
- 4 categorías originales y creativas (no usar las típicas)
- 4 valores por categoría
- Entre 8-12 pistas lógicas que permitan resolver el enigma
- Una solución única
- Tema apropiado para adolescentes (videojuegos, deportes, música, etc.)

Responde con JSON:
{
  "categories": {
    "Categoria1": ["valor1", "valor2", "valor3", "valor4"],
    "Categoria2": ["valor1", "valor2", "valor3", "valor4"],
    "Categoria3": ["valor1", "valor2", "valor3", "valor4"],
    "Categoria4": ["valor1", "valor2", "valor3", "valor4"]
  },
  "clues": ["pista1", "pista2", ...],
  "solution": {
    "Persona1": {"Categoria2": "valor", "Categoria3": "valor", "Categoria4": "valor"},
    "Persona2": {...}
  },
  "titulo": "Título atractivo",
  "tema": "Descripción del tema"
}`,

      'balanza-logica': `
Crea un problema de balanza único:
- Entre 5-12 monedas
- 1-3 monedas anómalas (más pesadas o ligeras)
- Contexto creativo (monedas de videojuego, fichas de colores, etc.)
- Máximo 3-4 pesadas para resolver

Responde con JSON:
{
  "variant": "oddUnknown|heaviest|lightest|kHeaviest|kLightest",
  "N": número_monedas,
  "k": número_anómalas,
  "maxWeighings": máximo_pesadas,
  "titulo": "Título atractivo",
  "contexto": "Historia/contexto del problema",
  "objetivo": "Descripción del objetivo"
}`,

      'poligono-geometrico': `
Crea un reto de construcción de polígonos:
- Área objetivo entre 6-20
- Perímetro objetivo entre 10-25
- Contexto creativo (construir una base, diseñar un jardín, etc.)
- Valores que hagan el reto interesante pero solucionable

Responde con JSON:
{
  "area": número,
  "perimeter": número,
  "gridSize": 8,
  "titulo": "Título atractivo",
  "contexto": "Historia del reto",
  "pista": "Sugerencia útil"
}`,

      'trasvase-ecologico': `
Crea un problema de trasvase de líquidos:
- 2-4 recipientes con capacidades diferentes
- Objetivo realista y alcanzable
- Contexto ecológico/científico atractivo
- Máximo 8-10 movimientos para resolver

Responde con JSON:
{
  "capacities": [capacidad1, capacidad2, capacidad3],
  "target": objetivo_litros,
  "initialLevels": [nivel1, nivel2, nivel3],
  "titulo": "Título atractivo",
  "contexto": "Historia/experimento científico",
  "sustancia": "Agua|Solución|Químico seguro"
}`
    };

    return prompts[type];
  }

  async processGeneratedReto(generatedData, type, numero) {
    const dataFileName = `${type.replace('-', '_')}_${String(numero).padStart(3, '0')}.json`;
    
    // Guardar datos específicos
    await fs.writeFile(
      path.join('data', dataFileName),
      JSON.stringify(generatedData, null, 2)
    );

    // Crear estructura del reto
    return {
      tipo: type,
      titulo: generatedData.titulo || `Reto ${numero}`,
      objetivo: generatedData.objetivo || this.getDefaultObjective(type),
      icono_url: 'assets/icono-generico.svg',
      data: { json_url: `data/${dataFileName}` }
    };
  }

  createFallbackReto(type, numero) {
    // Reto básico en caso de error con la IA
    const fallbacks = {
      'enigma-einstein': {
        titulo: `Enigma Lógico ${numero}`,
        objetivo: 'Resuelve el enigma usando las pistas'
      },
      'balanza-logica': {
        titulo: `Balanza Misteriosa ${numero}`,
        objetivo: 'Encuentra las monedas diferentes'
      },
      'poligono-geometrico': {
        titulo: `Construcción Geométrica ${numero}`,
        objetivo: 'Construye el polígono solicitado'
      },
      'trasvase-ecologico': {
        titulo: `Experimento de Laboratorio ${numero}`,
        objetivo: 'Consigue la cantidad exacta'
      }
    };

    return {
      tipo: type,
      titulo: fallbacks[type].titulo,
      objetivo: fallbacks[type].objetivo,
      icono_url: 'assets/icono-generico.svg',
      data: { error: 'Fallback reto - IA no disponible' }
    };
  }

  getDefaultObjective(type) {
    const objectives = {
      'enigma-einstein': 'Resuelve el enigma usando las pistas',
      'balanza-logica': 'Encuentra las monedas anómalas',
      'poligono-geometrico': 'Construye el polígono solicitado',
      'trasvase-ecologico': 'Obtén la cantidad exacta'
    };
    return objectives[type];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Script de selección diaria
export class DailyRetoSelector {
  static async selectDailyReto(fecha) {
    if (!fecha) {
      fecha = new Date().toISOString().split('T')[0];
    }

    try {
      // Cargar repositorio
      const repositoryData = await fs.readFile('retos-repository.json', 'utf8');
      const repository = JSON.parse(repositoryData);

      // Seleccionar reto basado en fecha
      const dayIndex = this.dateToIndex(fecha, repository.length);
      const selectedReto = repository[dayIndex];

      // Cargar el reto completo
      const retoData = await fs.readFile(selectedReto.archivo, 'utf8');
      const reto = JSON.parse(retoData);
      reto.fecha = fecha;

      // Guardar como reto del día
      await fs.writeFile('reto.json', JSON.stringify(reto, null, 2));

      // Actualizar lista de retos
      await this.updateDailyList(fecha, reto.titulo);

      console.log(`📅 Reto del día ${fecha}: ${reto.titulo}`);
      return reto;

    } catch (error) {
      console.error('❌ Error seleccionando reto diario:', error.message);
      throw error;
    }
  }

  static dateToIndex(dateString, totalRetos) {
    const [year, month, day] = dateString.split('-').map(Number);
    const seed = (year * 10000) + (month * 100) + day;
    return seed % totalRetos;
  }

  static async updateDailyList(fecha, titulo) {
    let lista = [];
    try {
      const content = await fs.readFile('lista_retos.json', 'utf8');
      lista = JSON.parse(content);
    } catch (e) {
      // Archivo no existe, crear nuevo
    }

    // Actualizar o añadir entrada
    lista = lista.filter(r => r.fecha !== fecha);
    lista.push({ fecha, titulo });
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha));

    await fs.writeFile('lista_retos.json', JSON.stringify(lista, null, 2));
  }
}

// Ejecución principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'daily';

  try {
    if (command === 'generate') {
      const generator = new MathGymAIGenerator();
      await generator.generateRepository();
    } else if (command === 'daily') {
      const fecha = args[1];
      await DailyRetoSelector.selectDailyReto(fecha);
    } else {
      console.log('Comandos disponibles:');
      console.log('  generate - Generar repositorio de 30 retos');
      console.log('  daily [fecha] - Seleccionar reto diario');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
