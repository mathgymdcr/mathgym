# Riego de plantas: reglas por ficha y deducción real por planta

Fecha: 2026-09-08

## El problema

Jugando el reto del día (`vivero`, dificultad 5, con pareja incompatible), dos quejas concretas:

1. **Tres de las cinco plantas eran triviales.** Helecho tenía ventana `[1, 5]` con `doses: 2` — la ventana entera EXACTAMENTE igual al número de riegos que necesita. No hay elección: se copian los dos ciclos de la ventana y ya está. Lavanda y Romero tenían el mismo problema (`ventana.length === doses`). De las cinco plantas, solo dos (Aloe, Menta) dejaban margen real para elegir.

   El generador ya comprueba una holgura mínima (`scripts/riego-logic.js`, función `buildRiegoPuzzle`): `holgura total >= plants.length`, donde `holgura = Σ(ventana.length - doses)`. Es una suma, no un mínimo por planta — una planta con holgura 5 puede compensar a otras cuatro con holgura 0 y el chequeo pasa igual. `validateRiegoData` en `scripts/validate-retos.js` repite exactamente el mismo cálculo (mismo punto ciego).

2. **Las reglas viven mezcladas en el texto de instrucciones**, no en el tablero: la ventana de cada planta sale como nota de texto bajo su nombre, y la pareja incompatible (si la hay) como una frase suelta en "Cómo se juega". Todo llega ya resuelto en el enunciado — no hay nada que recordar ni consultar, así que tampoco hay nada que se pueda "olvidar" y penalizar.

Encima, se detectó por separado (jugando el mismo reto) que la marca de estrellas puede rebajar la nota aunque el calendario final sea perfecto: `state.regados` cuenta cada vez que una celda pasa a `true`, acumulado durante toda la partida, no el resultado final — usar el propio ciclo vacía→regada→×→vacía que el juego ofrece para tantear (leyendo la ficha, probando, corrigiendo) puede sumar de más aunque el tablero que se entrega sea el óptimo. Esto no se toca aquí: es el mismo patrón, deliberado y documentado, que ya usa `nonograma.js` (`state.pintadas`) — cambiarlo es una decisión de diseño del catálogo entero, no de este reto. Lo que sí se añade aquí es un SEGUNDO contador (`consultas`, sección 4) con su propio umbral, para que mirar la ficha de una planta demasiadas veces también cueste nota.

## Lo que se construye

Tres cambios:

1. **Generador**: la poda de ventanas respeta un suelo de holgura POR PLANTA (no una suma total), con un tope objetivo que depende de la variante — tableros más grandes admiten más margen. Si no se puede llegar a solución única respetando el suelo en las cinco plantas, se descarta el intento (mismo patrón de reintento que ya existe).
2. **Interfaz**: la ventana de cada planta y su pareja incompatible (si la hay) dejan de imprimirse en el bloque de instrucciones. Cada planta lleva un icono; tocarlo abre una ficha con esa información que se autocierra a los 5 segundos. La primera consulta de cada planta es gratis; volver a abrir una que ya se vio suma al contador `consultas`.
3. **Estrellas**: `estrellas.js` deja de quedarse con la primera medida que el reto declare y pasa a calcular la nota de TODAS las medidas declaradas, devolviendo la peor. Esto permite que riego-plantas declare dos medidas (`movimientos` y `consultas`) sin ningún caso especial para el resto del catálogo.

## 1. Generador — holgura por planta (`scripts/riego-logic.js`)

Sustituye el chequeo de holgura total por un suelo mínimo por planta, aplicado DURANTE la poda (no solo al final):

```js
const MARGEN_MINIMO = { huerto: 1, invernadero: 1, vivero: 2 };
```

Razonado por tamaño de tablero: `huerto` (6 ciclos, 3 plantas) y `invernadero` (7 ciclos, 4 plantas) tienen menos ciclos de sobra para repartir margen; exigir 2 en esos tableros más pequeños arriesgaría agotar `MAX_INTENTOS` con demasiada frecuencia. `vivero` (8 ciclos, 5 plantas) tiene más aire. **Estos números son un punto de partida, no una medida** — la Tarea de implementación que toca la poda debe medir el coste real de intentos (mismo patrón que el comentario ya existente sobre `MAX_INTENTOS`, "medido sobre 1008 fechas...") antes de darlos por buenos, y subir `MAX_INTENTOS` solo si esa medición lo pide.

Cambio en el bucle de poda: la lista `candidatas` (ciclos de ruido que se pueden quitar de una ventana) ya no ofrece un ciclo si quitarlo dejaría `plants[i].ventana.length - 1 < plants[i].doses + MARGEN_MINIMO[cfg.nombre]`. Si en algún punto `candidatas` queda vacía sin haber llegado a solución única, la poda para igual que hoy (`if (!candidatas.length) break`) y el resultado se descarta más abajo (`if (res.soluciones !== 1) continue`) — mismo camino de fallo que ya existe, solo con un motivo distinto.

El chequeo final de holgura total se sustituye por uno por planta:

```js
if (plants.some((p) => p.ventana.length - p.doses < MARGEN_MINIMO[cfg.nombre])) continue;
```

(Debería ser redundante con el cambio de arriba — si la poda respeta el suelo en cada paso, el resultado final también lo respeta — pero se deja como comprobación de cierre igual que hoy, por si algún camino la esquiva.)

## 2. Validador — mismo suelo (`scripts/validate-retos.js`)

`validateRiegoData` tiene HOY el mismo cálculo de holgura total que el generador (sección 1) — mismo punto ciego. Se sustituye por el chequeo por planta, usando el mismo `MARGEN_MINIMO` (importado o duplicado desde `riego-logic.js`, a decidir en el plan según cómo esté estructurado el import ahí — el resto del validador ya importa funciones de los `*-logic.js` para revalidar, así que lo natural es importar la constante también). El mensaje de error identifica la planta concreta, no solo la suma:

```js
const falta = data.plants.find((p) => p.ventana.length - p.doses < MARGEN_MINIMO[data.variant]);
if (falta) throw new Error(`Riego-plantas sin margen de decisión: ${falta.id} solo tiene holgura ${falta.ventana.length - falta.doses}`);
```

Nota: `data.variant` tiene que viajar en el payload publicado para que el validador sepa qué tope aplicar — comprobar que ya viaja (el reto de hoy lo tiene: `"variant": "vivero"`) y that `combinacionesPlanta`/`contarSoluciones` no dependan de nada más para este cambio.

## 3. Iconos de planta (`assets/planta-*.svg`, nuevos)

Doce iconos nuevos, uno por nombre en `BANCO_PLANTAS` (`scripts/riego-logic.js`): Albahaca, Tomatera, Cactus, Orquídea, Helecho, Romero, Lavanda, Menta, Aloe, Petunia, Jazmín, Perejil.

Mismo lenguaje visual que el resto del catálogo (`assets/icono-riego-plantas.svg`, `icono-nonograma.svg`, etc.): `viewBox="0 0 200 200"`, trazo `#140A3C` grosor 7 con `stroke-linejoin/linecap="round"`, formas simples rellenas en la paleta ya establecida (`#F8C818` oro, `#1788C7` azul, `#8A2189`/`#5E1660` morado, `#10608E`/`#F0FCFC`/`#C4D6DC` cian). **Sin verde**: el catálogo entero lo evita — `--success` (`#10b981`) es verde y está reservado para estados de acierto en la interfaz (celdas `is-on`, victorias); meter verde en un icono decorativo competiría visualmente con esa señal.

Cada icono es una silueta simple y distinguible (maceta + forma de hoja/tallo característica de cada planta) construida con las mismas primitivas que ya usan los iconos de tipo (`path`, `rect`, `ellipse`) — no hace falta más de 4-6 formas por icono, a juzgar por la complejidad de los ejemplos existentes.

Un nuevo mapa en `plantillas/riego_plantas.js` (o en `scripts/riego-logic.js`, junto a `BANCO_PLANTAS`, si conviene más para compartirlo) asocia cada nombre con su ruta: `{ Albahaca: 'assets/planta-albahaca.svg', ... }`. Nombres de archivo en minúsculas y sin tilde (`jazmin`, `petunia`) para no depender de normalización de acentos en rutas.

## 4. Ficha de planta, no texto fijo (`plantillas/riego_plantas.js`)

**Se quita** del bloque de instrucciones ("Cómo se juega"):
- La nota de ventana por planta (`ventanaTexto`, hoy debajo de cada nombre).
- La frase de pareja incompatible (`${incompatibles[0]} y ${incompatibles[1]} no pueden regarse en el mismo ciclo`).

**Se mantiene** en las instrucciones (aplica a TODAS las plantas por igual, no es información específica de una — no tiene sentido esconderla detrás de un toque):
- La regla de descanso ("Ninguna planta se puede regar dos ciclos seguidos").
- El objetivo general y la capacidad de la regadera.

**Se añade**: cada nombre de planta se pinta junto a su icono (`pintarIcono`, ya existe en `shell.js`, reutilizar tal cual). Tocar el icono o el nombre abre una ficha (`.riego-ficha`, posicionada cerca de la fila, o un pequeño overlay) con:
- Su ventana, en el mismo formato de texto que hoy (`ventanaTexto` se reutiliza tal cual, solo cambia DÓNDE se pinta).
- Si esta planta tiene pareja incompatible, la frase correspondiente.

La ficha se autocierra a los 5 segundos (`setTimeout`) o al tocar cualquier otra planta (cierra la anterior, abre la nueva) o la misma ya abierta (la cierra sin esperar). Solo una ficha visible a la vez.

**Contador `consultas`**: `state.consultadas` es un `Set` de ids de planta ya vistas al menos una vez. Al tocar una planta:
- Si su id NO está en `state.consultadas`: se añade, se abre la ficha, no se toca ningún contador de coste.
- Si su id YA está en `state.consultadas`: se abre la ficha igual, pero `state.consultas += 1`.

`hooks.onSuccess` pasa a reportar `{ movimientos: state.regados, consultas: state.consultas }`.

## 5. Estrellas combinadas (`estrellas.js`)

Hoy, `medidaDe(objectives)` devuelve la PRIMERA medida de `MEDIDAS` cuyo `objectives` traiga umbral (`tres(o)` finito), y `estrellasDe` solo mira esa. Se generaliza a mirar TODAS las medidas con umbral declarado, y devolver la peor:

```js
export function estrellasDe(objectives, marca = {}) {
  const medidas = MEDIDAS.filter((m) => Number.isFinite(m.tres(objectives || {})));
  if (!medidas.length) return MAX_ESTRELLAS;

  let peor = MAX_ESTRELLAS;
  for (const medida of medidas) {
    const valor = marca ? marca[medida.marca] : undefined;
    if (!Number.isFinite(valor)) continue; // esta medida no se reporta, no penaliza
    let nota;
    if (valor <= medida.tres(objectives)) nota = 3;
    else {
      const dos = medida.dos(objectives);
      nota = (Number.isFinite(dos) && valor <= dos) ? 2 : 1;
    }
    peor = Math.min(peor, nota);
  }
  return peor;
}
```

Para los tipos existentes (una sola medida declarada) el resultado es idéntico a hoy — `medidas` tiene un solo elemento, `peor` termina siendo esa única nota. `parDe` no cambia: sigue mostrando solo la PRIMERA medida con `unidad` (que sigue siendo `movimientos` para riego-plantas — el contador de consultas no tiene meta que mostrar durante la partida, solo cuenta al final).

Nueva medida en `MEDIDAS`:

```js
{
  marca: 'consultas',
  unidad: null, // no se enseña como meta en pantalla, solo cuenta al ganar
  tres: (o) => primeroFinito(o.maxConsultasFor3Stars),
  dos: (o) => primeroFinito(o.maxConsultasFor2Stars, sumar(o.maxConsultasFor3Stars, 2))
}
```

`buildRiegoPuzzle` (o el punto donde se arma el reto final para `generate-daily-reto.js`) añade a `objectives`:

```js
maxConsultasFor3Stars: 0,
maxConsultasFor2Stars: 2
```

Fijos, no derivados de la semilla — es una medida de disciplina de memoria del jugador, no de la dificultad concreta del calendario.

## 6. Modelo de datos — sin cambios de esquema publicado

`incompatibles` ya viaja en el payload (sección existente); no cambia. Los dos campos nuevos (`maxConsultasFor3Stars`/`maxConsultasFor2Stars`) van en `objectives`, igual que `maxMovesForXStars` ya hace — incremento de esquema, no ruptura: un reto viejo sin esos campos sigue funcionando (la medida de consultas simplemente no se declara, `estrellasDe` la ignora).

## 7. Pruebas

- `tests/riego/generador.test.js`: nuevo caso — barrer semillas de cada variante y comprobar que NINGUNA planta del reto generado tiene `ventana.length - doses < MARGEN_MINIMO[variant]` (sustituye/complementa el chequeo de holgura total que hoy exista). Medir tasa de descarte de intentos con el suelo nuevo (documentar en un comentario, mismo estilo que el resto del archivo).
- `tests/riego/validacion.test.js`: caso que confirma que `validateRiegoData` rechaza un payload con una planta de holgura 0 aunque la suma total cumpla (el caso exacto que el chequeo viejo dejaba pasar).
- `tests/riego/plantilla.test.js`: la ventana y la pareja incompatible ya NO aparecen en el texto de instrucciones; tocar una planta abre su ficha con el contenido correcto; segunda consulta a la misma planta incrementa `consultas` en la marca reportada a `onSuccess`; consulta a una planta DISTINTA no lo hace; la ficha se cierra sola pasados 5s (usar fake timers de vitest).
- `tests/estrellas/estrellas.test.js`: nuevo caso con dos medidas declaradas a la vez (`maxMovesForXStars` + `maxConsultasForXStars`) y una marca que saca 3 en una y 1 en la otra — confirma que el resultado es 1 (la peor). Confirmar que los casos existentes (una sola medida) no cambian de resultado.
- Iconos nuevos: extender `tests/plantillas/muestra.test.js` (o el smoke test que ya recorre las 12 plantillas del catálogo) no hace falta tocarlo si los iconos son solo `assets/*.svg` sin JS — pero si `plantilla.test.js` monta con happy-dom, comprobar que `pintarIcono` no revienta si el archivo no se puede cargar (happy-dom no carga imágenes reales; ya es el comportamiento de `pintarIcono` con cualquier otro icono de tipo, así que no debería hacer falta nada nuevo).

## 8. Fuera de alcance

- Cambiar cómo cuentan `movimientos` en riego-plantas o en cualquier otro tipo (el patrón "corregir cuesta" de `nonograma`/`riego` se queda tal cual — ver "El problema" arriba).
- Rediseñar la generación de calendarios en sí (capacidad, descanso, pareja incompatible, paridad): esto solo toca CUÁNTO margen deja la ventana, no las reglas que la producen.
- Iconos de planta animados o con estado (p.ej. "regada" vs "seca"): son solo el disparador de la ficha, no cambian de aspecto según el estado del tablero.
- Tocar `estrellas.js` más allá de la generalización a "peor de varias medidas" — no se añade ninguna medida nueva para otros tipos del catálogo en este cambio.
