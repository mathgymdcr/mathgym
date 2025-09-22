**Planificando respuesta a solicitud**Voy a preparar el código solicitado, arreglado para solucionar el error 403. El código se entregará como archivo o en texto plano, no en bloques de código.
```js
import { promises as fs } from 'fs';
import path from 'path';

class MathGymAIGenerator {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.model = process.env.MATHGYM_MODEL || 'deepseek/deepseek-r1-distill-qwen-1.5b';

    // 👉 Recomendado por OpenRouter para evitar 403 (origen/referer)
    this.referer = process.env.APP_REFERER || 'https://mathgym.es';
    this.title = process.env.APP_TITLE || 'MathGym';

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

    // Pequeño helper de reintentos frente a 429/5xx
    const postWithRetries = async (body, retries = 3) => {
      let attempt = 0;
      while (true) {
        attempt++;
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            // 🔑 Cabeceras recomendadas por OpenRouter para evitar 403
            'HTTP-Referer': this.referer,
            'X-Title': this.title
          },
          body: JSON.stringify(body)
        });

        if (response.ok) return response;

        // Mensaje claro para 403
        if (response.status === 403) {
          const errText = await safeReadText(response);
          throw new Error(
            `API Error 403 (Forbidden). Revisa que tu clave tenga acceso al modelo "${this.model}" ` +
            `y que estés enviando las cabeceras HTTP-Referer y X-Title. ` +
            `Referer usado: ${this.referer} | Title: ${this.title}. ` +
            `Detalle: ${errText?.slice(0, 200) || 'sin detalle'}`
          );
        }

        // Reintentos para 429 y 5xx
        if ((response.status === 429 || (response.status >= 500 && response.status < 600)) && attempt < retries) {
          const backoff = Math.min(2000 * Math.pow(1.6, attempt - 1), 8000);
          await this.sleep(backoff);
          continue;
        }

        const errText = await safeReadText(response);
        throw new Error(`API Error ${response.status}: ${errText?.slice(0, 200) || 'sin detalle'}`);
      }
    };

    // Intento principal: forzar JSON si está soportado
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto en crear retos matemáticos y de lógica para adolescentes. ' +
            'Responde SOLO con JSON válido (sin explicaciones ni markdown).'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 2000,
      // Forzar JSON (si el modelo lo soporta)
      response_format: { type: 'json_object' }
    };

    try {
      // Primer intento con response_format
      let response;
      try {
        response = await postWithRetries(requestBody);
      } catch (e) {
        // Si el proveedor no soporta response_format, reintenta sin él
        if (String(e.message || e).includes('400') || String(e.message || e).includes('unsupported') || String(e.message || e).includes('response_format')) {
          delete requestBody.response_format;
          response = await postWithRetries(requestBody);
        } else {
          throw e;
        }
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de la API');

      // Parseo robusto de JSON (por si el modelo envía texto alrededor)
      const generatedData = safeParseJson(content);
      if (!generatedData) throw new Error('No se pudo parsear el JSON devuelto por la IA');

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
  "clues": ["pista1", "pista2", "..."],
  "solution": {
    "Persona1": {"Categoria2": "valor", "Categoria3": "valor", "Categoria4": "valor"},
    "Persona2": {}
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
  "N": numero_monedas,
  "k": numero_anomalas,
  "maxWeighings": max_pesadas,
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
  "area": numero,
  "perimeter": numero,
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

// Helper: lectura segura de texto en errores HTTP
async function safeReadText(response) {
  try { return await response.text(); } catch { return ''; }
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
```
