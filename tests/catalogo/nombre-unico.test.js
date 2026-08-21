import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { TIPOS } from '../../catalogo-tipos.js'
import { MathGymGenerator } from '../../scripts/generate-daily-reto.js'

// El nombre de cada tipo vivía en tres sitios a la vez -- el catálogo, el
// `titulo` del generador y un <h2> hardcodeado en cada plantilla -- y los tres
// se habían desfasado entre sí (el mismo tipo era "El Archipiélago" en el
// muestrario, "El Archipiélago Conectado" en el archivo y "Puentes de Hashi"
// en el tablero). Ahora manda catalogo-tipos.js, y estos tests son lo que
// impide que vuelvan a separarse en silencio.

const raiz = path.resolve(__dirname, '../..')
const SEED = 20260821
const FECHA = '2026-08-21'

describe('la cabecera de cada plantilla sale del catálogo', () => {
  let Templates

  beforeAll(async () => {
    // La celebración de la victoria pinta confeti en un <canvas>, que
    // happy-dom no implementa; montar la plantilla no debe morir por eso.
    window.HTMLCanvasElement.prototype.getContext = () => ({
      beginPath() {}, clearRect() {}, lineTo() {}, moveTo() {}, stroke() {}, fill() {},
      arc() {}, fillRect() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1
    })
    await import('../../plantillas/base.js')
    Templates = window.Templates
  })

  const montar = async (tipo) => {
    const data = JSON.parse(await fs.readFile(path.join(raiz, 'data/muestra', `${tipo}.json`), 'utf8'))
    const host = document.createElement('div')
    await Templates.render(tipo, data, host, {})
    return host
  }

  it('pinta como título el nombre del tipo, sin inventarse el suyo', async () => {
    for (const t of TIPOS) {
      const host = await montar(t.tipo)
      const h2 = host.querySelector('.enigma-header-dark h2')
      expect(h2, `${t.tipo}: sin cabecera`).not.toBeNull()
      expect(h2.textContent.trim(), t.tipo).toBe(t.nombre)
    }
  })

  it('pinta como icono el del tipo, sin repetir la ruta a mano', async () => {
    for (const t of TIPOS) {
      const host = await montar(t.tipo)
      const img = host.querySelector('.enigma-header-dark img')
      expect(img, `${t.tipo}: sin icono en la cabecera`).not.toBeNull()
      expect(img.getAttribute('src'), t.tipo).toBe(t.icono)
    }
  })
})

describe('el reto que escribe el generador', () => {
  let previo
  let tmp
  let retos

  beforeAll(async () => {
    // Los generadores escriben su payload en `data/` relativo al cwd: se les
    // da un directorio de usar y tirar para no ensuciar el repo.
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-nombres-'))
    previo = process.cwd()
    process.chdir(tmp)

    const gen = new MathGymGenerator()
    retos = []
    for (const t of TIPOS) {
      retos.push([t, await gen.generarReto(t.tipo, SEED, FECHA)])
    }
  })

  afterAll(async () => {
    process.chdir(previo)
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('titula cada reto con el nombre del catálogo', () => {
    for (const [t, reto] of retos) {
      expect(reto.titulo, t.tipo).toBe(t.nombre)
    }
  })

  it('ya no arrastra los campos muertos icono_url y objetivo', () => {
    for (const [t, reto] of retos) {
      expect(reto, `${t.tipo}: icono_url no lo lee nadie`).not.toHaveProperty('icono_url')
      expect(reto, `${t.tipo}: objetivo no lo lee nadie`).not.toHaveProperty('objetivo')
    }
  })
})

describe('el validador defiende el nombre único', () => {
  let RetoValidator
  let previo
  let tmp

  const RETO_BUENO = {
    id: '2026-08-21-anillas-encadenadas-001',
    fecha: FECHA,
    tipo: 'anillas-encadenadas',
    titulo: 'Anillas Encadenadas',
    dificultad: 3,
    categorias: ['logica'],
    data: {}
  }

  // Se valida solo la cabecera del reto: `validateRetoData` mira el payload de
  // cada tipo, que aquí no viene al caso.
  const validar = async (reto) => {
    const v = new RetoValidator()
    v.validateRetoData = async () => {}
    await fs.writeFile('reto.json', JSON.stringify(reto))
    return v.validateMainReto()
  }

  beforeAll(async () => {
    ;({ RetoValidator } = await import('../../scripts/validate-retos.js'))
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mathgym-validador-'))
    previo = process.cwd()
    process.chdir(tmp)
  })

  afterAll(async () => {
    process.chdir(previo)
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('acepta un reto titulado como manda el catálogo', async () => {
    await expect(validar(RETO_BUENO)).resolves.not.toThrow()
  })

  it('rechaza un título que no es el del catálogo', async () => {
    await expect(validar({ ...RETO_BUENO, titulo: 'Las Anillas de Toda la Vida' }))
      .rejects.toThrow(/titulo/i)
  })

  it('rechaza que vuelvan a colarse los campos muertos', async () => {
    await expect(validar({ ...RETO_BUENO, icono_url: 'assets/icono-generico.svg' }))
      .rejects.toThrow(/icono_url/)
    await expect(validar({ ...RETO_BUENO, objetivo: 'Suelta las anillas' }))
      .rejects.toThrow(/objetivo/)
  })
})
