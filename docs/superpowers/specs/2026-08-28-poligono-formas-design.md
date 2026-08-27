# Polígono: eje de forma y modo de dos figuras

Fecha: 2026-08-28 · Tipo: `poligono-geometrico`

## El problema

`poligono-geometrico` es el tipo más pobre del catálogo, y no por diseño sino por
descuido acumulado:

- **Publica un único reto, siempre el mismo.** El generador tiene seis configuraciones y
  elige con `configs[seed % 6]`. Como `selectTemplate` es `templates[seed % 12]`, el tipo
  solo recibe seeds de una clase módulo 12; al dividir 6 a 12, el índice queda constante.
  Medido sobre 4 años de fechas reales: **127 retos, todos A=12 P=14**.
- **Y ese reto es «dibuja un rectángulo de 3×4».** Las seis configuraciones son
  rectángulos exactos (3×3, 2×3, 3×4, 2×4, 3×5, 2×5), así que ninguna obliga a pensar en
  la forma.
- No tiene `variant`, no tiene `hints`, su `dificultad` es `2` fijo, y es el único tipo
  **sin módulo de lógica compartido**: el validador solo comprueba una desigualdad
  necesaria (`P ≥ 2⌈2√A⌉`) y nunca construye una figura, así que no puede saber si lo
  que pide es alcanzable.
- La plantilla permite dibujar caminos que se cruzan (`onNodeClick` no comprueba que el
  nodo no esté ya usado), y entonces el área por shoelace da un número sin significado.

## Lo que se construye

Dos ejes nuevos sobre el tipo, más la fontanería que le falta.

### Eje de forma

En una retícula donde solo se dan pasos ortogonales, **un polígono rectilíneo convexo es
necesariamente un rectángulo**: sin ángulos de 270° no hay otra cosa. Eso convierte
«cóncavo/convexo» en un eje con contenido:

- `convexa` — el par (A,P) lo alcanza un rectángulo.
- `concava` — hay que meter al menos un ángulo de 270°.

### Modo de dos figuras

Se pide **un único par (área total, perímetro total)** más una restricción de forma, y
hay que deducir **cómo se reparte** entre las dos figuras.

El reparto no viaja en el payload: es la respuesta. Mismo criterio que láser, donde la
solución tampoco va en los datos, y que las pistas del nonograma, que nunca nombran la
figura.

La restricción de forma es lo que hace deducible el reparto. Medido sobre la enumeración
completa:

| restricción | pares (Atot,Ptot) con reparto único |
|---|---|
| sin restricción | 8 |
| `ambas-convexas` | 42 |
| `una-de-cada` | 13 |
| `ambas-concavas` | 17 |

**72 instancias frente a 8.** Los dos ejes no van pegados: el de forma es lo que hace
viable el de reparto. Sin él el catálogo es demasiado pequeño (el tipo sale ~32 veces al
año) y tres de sus ocho casos son serpentinas de perímetro 50, de dibujar penoso.

Ejemplo canónico, `una-de-cada` con (24, 30): el único reparto es (12,14) + (12,16) — un
3×4 convexo y una figura de área 12 con perímetro 16, que ningún rectángulo de área 12
alcanza salvo el 2×6, así que la restricción de forma decide cuál es cuál.

## Modelo de interacción

El gesto pedido — **pulsar un segmento dibujado para borrarlo**, y así poder añadir
salientes y entrantes — no cabe en el modelo actual. Hoy `state.path` es una secuencia
ordenada de nodos con un `closed`; borrar un segmento de en medio la parte en dos, y una
secuencia no sabe representar eso.

Se pasa a un **conjunto de aristas**. Las reglas se enuncian sobre grados:

- Pulsar un nodo adyacente a un extremo **añade** esa arista (el gesto actual, intacto).
- Pulsar un segmento dibujado lo **quita**.
- Una figura está cerrada cuando todos sus nodos tienen grado 2 y forman un ciclo.
- Ningún nodo puede pasar de grado 2.
- Quitar una arista de un ciclo lo convierte en cadena abierta con dos extremos, y desde
  cualquiera de los dos se sigue dibujando. Ese es exactamente el gesto de «hacer un
  saliente».

Lo que gana además del gesto:

- **Las dos figuras salen solas.** Un conjunto de aristas describe igual de bien un lazo,
  dos lazos y algo a medio construir; son componentes conexas. Con la secuencia habría
  que meter un segundo `path` y decidir a cuál se refiere cada clic.
- **Arregla los cruces.** El tope de grado 2 impide el ocho que hoy se puede dibujar.

**Los segmentos serán elementos DOM**, no hit-testing sobre el canvas. Los nodos ya lo
son (`.polygon-node` sobre una capa `div`), las líneas hoy se pintan en un `<canvas>`, y
happy-dom no implementa canvas: con hit-testing la interacción no sería testeable.

## Esquema del payload

```json
{ "gridSize": 8, "n_figuras": 2, "area": 24, "perimeter": 30, "formas": "una-de-cada" }
```

- Con una figura, `area` y `perimeter` son los de la figura; con dos, los **totales**.
- `formas`: `convexa` | `concava` | `libre` con una figura; `ambas-convexas` |
  `una-de-cada` | `ambas-concavas` con dos. El generador **nunca escribe `libre`**: es solo
  el valor que toman los payloads publicados, que no traen el campo.
- **Compatibilidad**: los retos publicados traen `{area, perimeter, gridSize}` sin
  `n_figuras` ni `formas`. Ausentes se leen como `n_figuras: 1` y `formas: 'libre'`, que
  es exactamente el juego de hoy — el mismo trato que riego da a sus payloads sin
  ventanas.

`formas` es una restricción real, no una etiqueta: con (12,14) es redundante (solo lo da
el 3×4), pero con (12,16) valen el rectángulo 2×6 **y** una L, y ahí es lo único que fija
la respuesta. Por eso la comprueba la plantilla sobre lo dibujado.

## `scripts/poligono-logic.js`

| función | cómo | por qué |
|---|---|---|
| `alcanzable(A,P)` | aritmética: par, `2⌈2√A⌉ ≤ P ≤ 2A+2` | exacta y sin tope de área, así valen los payloads publicados (uno tiene A=15) |
| `clasifica(A,P)` → `{convexa, concava}` | enumeración memoizada de poliominós simplemente conexos hasta A≤12 en 7×7 | la aritmética **no** sirve, ver abajo |
| `repartos(Atot,Ptot,formas)` | combina las dos | lista de repartos válidos; el reto exige longitud 1 |
| `buildPoligonoPuzzle(seed)` | sorteo con mulberry32 y máscara propia | variante, dificultad, config y solución |
| `buildPoligonoHints(puzzle)` | — | el tipo hoy no tiene pistas |
| `figurasDeAristas(aristas)` | recorre componentes | `{ciclos, abiertas, invalido}` -- una cadena abierta es un estado normal a medio dibujar, no un error; `invalido` solo si algun nodo pasa de grado 2 |
| `medidasDeFigura(ciclo)` | shoelace + recuento | `{area, perimetro, convexa}` |

Las dos últimas **las importa también la plantilla**. Igual que en láser, donde el juego,
el generador y el validador comparten el mismo trazador: si la plantilla decide por su
cuenta qué es convexo y el generador lo decide por otra vía, se publican retos cuya
restricción no se puede cumplir.

### Por qué `clasifica` enumera

Se probó una regla aritmética — «si el perímetro es el mínimo para esa área y hay
rectángulo, entonces solo cabe el rectángulo» — y **es falsa**. Contrastada contra la
enumeración en todo el rango A≤12 da tres fallos: **A=3 P=8, A=8 P=12, A=10 P=14**. El
más claro es el primero: con 3 celdas y perímetro 8 valen tanto el 1×3 como el tromino en
L. Con esa regla el generador habría publicado retos cuya restricción de forma es una
mentira.

Las otras dos reglas sí son exactas (0 discrepancias en el mismo rango): `alcanzable` y
la aritmética de rectángulos.

El tope A≤12 por figura es lo que mantiene la enumeración exhaustiva y barata (el barrido
tarda menos de un segundo); de ahí sale el catálogo de 72 instancias.

## Generador

| campo | hoy | pasa a ser |
|---|---|---|
| `variant` | no existe | `una-convexa`, `una-concava`, `dos-convexas`, `dos-una-de-cada`, `dos-concavas` |
| `dificultad` | `2` fijo | 2 / 3 / 3 / 4 / 4 según variante |
| `hints` | no existe | `buildPoligonoHints(puzzle)` |
| elección | `configs[seed % 6]` → 1 instancia en 4 años | sorteo con mulberry32 y máscara propia |
| `objectives` | `matching_figure` + maxErrors | igual |

`objectives` no gana `parMoves`: `minimoDe` en `home.js` solo entiende `numPistas`,
`maxWeighingsFor3Stars` y `parMoves`, así que la sala no enseña mínimo para polígono. Es
correcto —dibujar una figura no tiene par— y no se le inventa uno.

Las pistas no pueden decir el reparto. Dirán lo que ayuda sin resolver: que el perímetro
en retícula siempre es par, cuál es el mínimo para esa área, y que en esta retícula
«convexo» significa rectángulo — que es la llave del modo `una-de-cada` y no es evidente.

## Validador

`validatePoligonoData` pasa de una condición necesaria a la comprobación real:

- una figura: `alcanzable(A,P)`, y que `formas` sea satisfacible según `clasifica`;
- dos figuras: `repartos(A,P,formas).length === 1` — rechaza el imposible (0) y el
  ambiguo (>1), que es lo que hace riego contando calendarios;
- la desigualdad actual queda subsumida en `alcanzable`, que además comprueba paridad y
  cota superior.

## Plantilla

`plantillas/poligono_geometrico.js` se reescribe por dentro (~200 de sus 433 líneas):

- `state.path` + `state.closed` → `state.aristas` (conjunto).
- Capa DOM de segmentos entre nodos vecinos, con área de pulsación generosa.
- Área, perímetro y convexidad se piden a `poligono-logic.js`, no se calculan aquí.
- Undo/redo guarda instantáneas del conjunto de aristas.
- El texto de objetivo enuncia la restricción de forma y, en dos figuras, deja claro que
  los números son totales.

## Tests (`tests/poligono/`, nuevo)

El tipo no tiene ninguno hoy.

- **Oráculo de enumeración**: contrasta `alcanzable` y `clasifica` contra la enumeración
  exhaustiva en todo A≤12, exigiendo 0 discrepancias. Es el test que ya cazó la regla
  falsa, y evita que alguien «simplifique» la clasificación a aritmética más adelante.
  Mismo papel que `espejosMinimosExhaustivo` en láser.
- **Generador**: determinismo; las cinco variantes aparecen; `repartos` de lo generado
  tiene longitud 1; y el reparto se comprueba **sobre las fechas que de verdad tocan
  polígono**, no sobre seeds sintéticos — que es lo que ocultaba el eje muerto.
- **Validador**: acepta lo que escribe el generador en las cinco variantes; rechaza el
  reparto ambiguo; rechaza el par imposible; y sigue aceptando los payloads publicados
  sin `n_figuras`.
- **Plantilla** (happy-dom): dibujar la solución gana en cada variante; pulsar un segmento
  lo borra; un ciclo al que se le quita una arista queda como cadena abierta y se puede
  seguir; no se puede llevar un nodo a grado 3.

## Fuera de alcance

- **Los otros seis tipos con el eje muerto** (`anillas-encadenadas`, `cajas-apiladas`,
  `laser-triangular`, `nonograma`, `puentes-hashi`, `riego-plantas`). Misma causa
  —`VARIANTES[seed % n]` con `n` divisor de 12— y merece su propio PR. Aquí solo se
  arregla polígono, porque sin eso las variantes nuevas tampoco saldrían.
- Figuras de área > 12, que dejarían de estar cubiertas por la enumeración.
- Más de dos figuras.

## Riesgos

- **La reescritura de la plantilla es la parte cara** y no tiene red hoy: el tipo no tiene
  tests. Los tests de plantilla se escriben antes que la reescritura.
- El catálogo de 72 instancias depende del tope A≤12 y del tablero 7×7. Si se cambia
  `gridSize`, hay que recalcularlo — por eso se deriva y no se escribe a mano.
- `una-de-cada` con 13 instancias es la variante más escasa; si al repartir dificultades
  sale poco, se compensa con las otras dos en vez de bajar la exigencia de unicidad.
