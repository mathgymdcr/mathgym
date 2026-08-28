# Láser triangular: prisma, condensador y piezas arrastrables

Fecha: 2026-08-28

## El problema

El reto `laser-triangular` está publicado y es correcto, pero no es jugable:

- Los iconos son emoji (`➤` para el emisor, `🎯` para la diana) y desentonan con el resto de tableros, que dibujan sus formas.
- El trazador trata distinto al emisor propio y al ajeno: el rayo atraviesa el suyo como si no estuviera, y el ajeno lo corta sin que nada en la pantalla lo diga. Las dos cosas se leen como que el juego no responde.
- El rayo se redibuja en cada clic, así que no hay ningún momento de "a ver si sale": la victoria aparece sola mientras pruebas.
- Colocar espejos es un ciclo de cinco estados sobre la celda. Con seis tipos de pieza ese gesto ya no da de sí.
- Un solo eje de variante (el tamaño del tablero) y una sola mecánica.

## Lo que se construye

Un rediseño completo del tipo, con la mecánica nueva y la interfaz dentro del mismo ciclo. Dos piezas nuevas — **prisma** y **condensador** — y un eje de variante nuevo, **modo**.

### Reglas de las piezas nuevas

**Prisma.** Entra un rayo, salen dos: la dirección de entrada girada −45° con color `azul` y girada +45° con color `rojo`. La dirección de entrada **no** continúa recta. Un rayo que ya lleva color y entra en un prisma **se corta** (`prisma-saturado`): dividir dos veces multiplica los tramos sin añadir deducción, y sin esa regla el árbol de rayos crece de forma exponencial.

**Condensador.** Al entrar un rayo, se anota su color en la celda. Si en esa celda ya había anotado un color **distinto**, se emite un rayo `magenta` en la dirección del último que llegó. Si solo ha llegado uno, o los dos son del mismo color, el rayo sigue recto sin cambiar de color.

**Emisor.** Cualquier emisor, propio o ajeno, absorbe el rayo y lo apaga (`resultado: 'emisor'`). Una sola regla, sin casos especiales, y con aviso en pantalla.

## 1. Esquema del payload

```json
{
  "variant": "medio",
  "modo": "prisma",
  "size": 6,
  "lasers": [
    { "emitter": { "row": 0, "col": 2, "dir": "se" }, "color": "neutro" }
  ],
  "targets": [
    { "row": 0, "col": 5, "color": "azul" },
    { "row": 5, "col": 3, "color": "rojo" }
  ],
  "blocks": [{ "row": 1, "col": 1 }],
  "min_piezas": 3
}
```

- `modo`: `clasico` | `prisma` | `condensador`. Ausente ⇒ `clasico`.
- Las dianas salen de `lasers[].target` y suben a una lista `targets` propia con color: en modo prisma un emisor alimenta dos dianas y la relación deja de ser 1-a-1.
- Colores: `neutro`, `azul`, `rojo`, `magenta` (= azul + rojo). Cuatro constantes cerradas, no una paleta abierta — el condensador solo tiene una mezcla que producir.
- `min_espejos` pasa a llamarse `min_piezas`.

**Normalización.** `normalizaConfig(config)` es el único sitio que conoce el esquema viejo. Convierte `lasers[].target` en entradas de `targets`, asigna colores y rellena `modo`. En `clasico` cada láser recibe un color propio (`neutro-1`, `neutro-2`, …) para que la regla de cruce sea una sola en los tres modos. El trazador, el generador y el validador solo ven el esquema nuevo.

## 2. Trazador (`scripts/laser-triangular-logic.js`)

`simularLaser` se sustituye por `simularHaz(config, piezas, laser)`, que devuelve una lista de tramos en vez de un camino:

```js
{ tramos: [{ puntos, color, resultado, squaresPath }], dianasAlcanzadas: Set }
```

**Bucle.** Una lista de trabajo de segmentos `{ fila, col, lx, ly, dx, dy, color }`. Cada segmento se traza con el `siguienteCruce` actual: la geometría continua (coordenadas fraccionarias, diagonales y medianas) **no se toca**. Los finales nuevos son prisma, condensador y emisor, según las reglas de arriba.

Girar 45° sobre las 8 direcciones es un índice ±1 en el ciclo `right, se, down, sw, left, nw, up, ne`, así que sale de una tabla; no hay trigonometría.

**Punto fijo.** La lista se agota sola salvo con condensadores, que pueden re-emitir cuando les llega el segundo rayo. Se itera hasta que nadie encola nada, con dos topes: `maxSteps` por segmento (el de hoy) y un tope global de segmentos emitidos, `4 · n²`. Superado el tope, `resultado: 'bucle'` y el reto no se da por resuelto — el navegador nunca se cuelga.

**Regla de cruce.** Hoy es "dos rayos no comparten celda", lo que con prisma es imposible: los dos hijos nacen de la misma celda. Pasa a ser:

> Dos tramos de **color distinto** no pueden compartir celda, salvo la celda de un prisma o de un condensador, que son justamente donde los colores se encuentran a propósito. Dos tramos del mismo color tampoco pueden cruzarse.

En `clasico`, con los dos láseres coloreados `neutro-1` y `neutro-2`, esta regla es exactamente la de hoy.

**Victoria.** Toda diana alcanzada por un tramo de su color, ninguna diana sin alcanzar y cero cruces.

**Búsqueda.** `resolverEspejos` / `espejosMinimos` conservan su forma: siguen probando celdas de `squaresPath`, que ahora es la unión de los tramos. El bucle interior pasa de 4 tipos de pieza a 6, un 50 % más de ramas por celda; con topes de 3-4 piezas el coste sigue siendo asumible, y se mide con un test de tiempo antes de dar la poda por buena.

## 3. Interfaz (`plantillas/laser_triangular.js`, `style.css`)

**Sin emoji.** Todo pasa a formas dibujadas:

- **Emisor**: boquilla en CSS (`clip-path` triangular sobre un bloque rotado con `--laser-dir-rot`), del color que emite. Se reaprovecha `laserEmitterPulse`.
- **Diana**: se quedan los anillos `laserTargetPing`, y en el centro una forma maciza **según el color**: círculo `neutro`, triángulo `azul`, cuadrado `rojo`, rombo `magenta`. La forma, no solo el color, identifica la diana: el reto se puede jugar sin distinguir colores. La insignia numerada se queda solo en `clasico`, donde sí hay dos láseres que emparejar.
- **Piezas**: espejos como hoy (barra rotada); prisma, triángulo hueco con el borde en degradado azul→rojo; condensador, dos arcos que convergen en un punto.

**Bandeja abierta.** Una `.laser-tray` sobre el tablero con las seis piezas (`/`, `\`, `|`, `—`, prisma, condensador), cada una un `<button>` con su forma. Existencias infinitas, así que sin contadores. En `clasico` no se muestran prisma ni condensador.

Dos gestos, ambos con **Pointer Events** (un solo camino de código para ratón, dedo y lápiz):

- **Arrastrar** una pieza de la bandeja a una celda la coloca; arrastrar una ya colocada fuera del tablero la quita, y a otra celda la mueve.
- **Tocar** una pieza de la bandeja la deja *armada* (resaltada); el siguiente toque en una celda la coloca. Es el camino accesible y el que funciona en móvil, donde arrastrar sobre celdas de 30 px es incómodo.

Un toque sobre una pieza ya colocada la retira. Desaparece el ciclo de cinco estados por celda.

**Botón «Lanzar el rayo».** En `.laser-controls`, junto a Reiniciar. Colocar o quitar una pieza **apaga el trazo**: el SVG se vacía y el estado vuelve a «Coloca piezas y lanza el rayo». Al pulsar, se traza, se dibuja cada tramo con un `stroke-dasharray` animado (el rayo avanza, no aparece de golpe) y **solo entonces** se comprueba la victoria.

**Automático solo en el nivel más bajo.** `const autoTraza = config.variant === 'pequeno'`. En `pequeno` el rayo se redibuja en cada cambio y el botón no se muestra — el comportamiento de hoy. En `medio` y `grande` manda el botón. El resto del código no distingue.

**El choque se ve.** El tramo termina con una marca de impacto en el punto de choque, la celda del emisor parpadea en rojo y la barra de estado dice «El rayo choca con un emisor y se apaga». Mismo tratamiento para los bloques.

**Par.** `hooks.onSuccess({ movimientos })` sigue contando **piezas colocadas**, no disparos ni toques: probar una configuración es jugar.

Las instrucciones de `buildStandardShell` se reescriben: gestos nuevos, prisma, condensador y la regla de cruce por color.

## 4. Generador (`buildLaserPuzzle`)

**Dos ejes, cada uno con su máscara propia**, como exige el repo (nunca aritmética sobre el seed):

```js
export const MODOS = ['clasico', 'prisma', 'condensador'];
export function modoDeSeed(seed) { return eligeEje(MODOS, seed, 0x9e3779b1); }
export function varianteDeSeed(seed) { return `${tamanoDeSeed(seed)}-${modoDeSeed(seed)}`; }
```

El `varianteDeSeed` de hoy (que devuelve `pequeno` / `medio` / `grande`) se renombra a `tamanoDeSeed` conservando su máscara actual, para que las fechas ya publicadas sigan cayendo en el mismo tamaño. El nombre `varianteDeSeed` queda libre para la variante **combinada**, siguiendo la convención de nonograma, que es lo que `tests/ejes/reparto.test.js` mira. `VARIANTES` y `TAMANO` no cambian (5 / 6 / 7).

Ojo con los dos sentidos de la palabra: el campo `variant` del payload sigue siendo **solo el tamaño** — es lo que lee `config.variant === 'pequeno'` en la plantilla — y el modo viaja aparte en `modo`. La variante combinada existe únicamente en `varianteDeSeed`, para el test de reparto.

Construcción por modo, siempre hacia atrás (colocar piezas, trazar, plantar la diana donde acaba el rayo, de modo que la solución existe por construcción):

- **`clasico`**: el `buildLaserPuzzle` de hoy, sin cambios salvo la regla nueva del emisor. El generador ya re-comprueba `resuelto` al final, así que los intentos que la regla invalida se descartan solos.
- **`prisma`**: un emisor; un prisma en su trayecto; desde cada hijo, espejos sobre su propio trayecto; una diana al final de cada hijo, del color del hijo.
- **`condensador`**: como `prisma`, pero los dos hijos se dirigen a una celda común donde va el condensador; el rayo `magenta` resultante sigue y su final es la diana única, `magenta`. La celda del condensador se busca entre las que aparecen en los trayectos de ambos hijos, o alcanzables con un espejo cada uno; si no hay ninguna, se descarta el intento.

`MAX_INTENTOS` (600 hoy) se mide y se sube si la tasa de fallo de `condensador` lo pide; `scripts/test-generator.js` es la puerta.

**Dificultad**: la base por tamaño de hoy (2 / 3 / 4) más 1 si el modo no es `clasico`, con tope en 5 (el máximo que acepta el validador).

**Pistas** (`buildLaserHints`): en `prisma` y `condensador`, la segunda pista describe la pieza nueva en vez de repetir la de los espejos.

## 5. Validador (`validateLaserData`)

- `normalizaConfig` primero; el resto valida el esquema nuevo.
- `lasers.length >= 2` deja de valer: pasa a **`lasers.length >= 1` y `targets.length >= 1`**, y en `prisma` se exige exactamente un emisor y dos dianas de colores distintos; en `condensador`, un emisor y una diana `magenta`.
- Colores de diana dentro del conjunto cerrado.
- Se mantienen: dianas y emisores dentro del tablero, sin dos objetos en la misma celda, bloques fuera de esas celdas, el reto no viene resuelto de fábrica, y `espejosMinimos` confirma que `min_piezas` es el mínimo real y no solo lo que gastó el generador.
- `min_espejos` se sigue leyendo como `min_piezas` para los retos ya publicados.

## 6. Pruebas

- `tests/laser/trazador.test.js`: prisma (dos hijos a ±45°, colores correctos), prisma saturado, condensador (mezcla, paso recto con un solo rayo, dos condensadores encadenados), absorción por emisor propio y ajeno, tope global de segmentos, y la regla de cruce por color.
- `tests/laser/generador.test.js`: los tres modos generan; el payload cumple el esquema; `resuelto` con la solución guardada; `espejosMinimos` coincide con `min_piezas`; contraste `espejosMinimos` vs `espejosMinimosExhaustivo` en tableros pequeños; un test de tiempo que fija el techo de la búsqueda con 6 tipos de pieza.
- `tests/laser/compatibilidad.test.js` (nuevo): los payloads publicados en `data/` se cargan, normalizan y siguen siendo resolubles con el trazador nuevo.
- `tests/ejes/reparto.test.js`: `ESPERADAS['laser-triangular']` sube de 3 al número que dé el barrido real de fechas, con suelo de 6.
- `tests/plantillas/laser-muestra.test.js`: se amplía para montar la plantilla y resolver el ejemplo también en modo prisma.
- Se relanza `node scripts/generate-muestrario.js`. La semilla fija de láser (`20260114`) se cambia por una que caiga en modo `prisma`: el ejemplo de la sala debe enseñar la mecánica nueva.

## 7. Compatibilidad con lo publicado

El archivo histórico no es reproducible: regenerar un reto pasado da otro puzzle. Así que los payloads ya publicados **tienen que seguir abriendo tal cual**, y lo hacen por `normalizaConfig` + `min_espejos`. `tests/laser/compatibilidad.test.js` es la red que lo comprueba sobre los ficheros reales de `data/`, no sobre payloads inventados.

El único cambio de comportamiento sobre un reto viejo es la absorción por el emisor propio. Si algún payload publicado dependía de que el rayo atravesara su propio emisor, el test de compatibilidad lo destapa y ese fichero se corrige a mano en su sitio.

## 8. Fuera de alcance

- Rayos de más de dos colores y prismas en cascada.
- Piezas limitadas o bandeja con existencias contadas: la bandeja es abierta.
- Recuperar el tipo `laser-espejos` sobre retícula cuadrada, eliminado.
- Cambiar la métrica del par: se siguen contando piezas colocadas.
