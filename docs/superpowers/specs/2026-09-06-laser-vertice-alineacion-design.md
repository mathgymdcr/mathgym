# Láser triangular: espejo-vértice y llegada obligatoria al centro

Fecha: 2026-09-06

## El problema

Resolviendo el reto del día (`condensador`, seed del 2026-09-06) se detectó un defecto visual en `simularHaz`: cuando un rayo entra en una celda con prisma, condensador o diana, el renderer fuerza el último punto del trazo al centro exacto de esa celda (`{x: c+0.5, y: r+0.5}`), sin importar por dónde entró realmente. Si el rayo entra ya alineado con el centro (el caso típico, con espejos de celda normales) esto es invisible. Pero si entra en diagonal por un punto que no es el centro — como le pasa a los dos hijos de un prisma cuando el condensador no cae justo en su prolongación recta —, el trazo pega un salto que no corresponde a ningún espejo real: parece un rebote sin causa.

Verificado con el trazador real sobre el reto del día: el hijo azul entra al condensador por su esquina superior-izquierda (≈ vértice fila 3/columna 6 en la numeración del tablero) y el hijo rojo por su esquina inferior-derecha; los dos se fuerzan al centro y los dos saltan.

## Lo que se construye

Dos cambios, uno mecánico y uno de contenido, atados entre sí:

1. **Llegada obligatoria al centro.** Diana, prisma y condensador solo activan su efecto si el rayo, dentro de esa celda, pasa por su centro exacto antes de tocar cualquier borde. Si no, la pieza no hace nada — el rayo sigue de largo, como si la celda estuviera vacía. Ya no hace falta forzar ningún punto: lo que se dibuja es lo que de verdad pasa por el centro.
2. **Espejo-vértice.** Los espejos `|` y `—` de la bandeja ganan un segundo punto de anclaje: además de en el centro de una celda (como hoy), se pueden colocar en un vértice de la rejilla, pinchando ahí en vez de en el centro. Reflejan igual (invierten `dy` el horizontal, `dx` el vertical) pero desde una posición distinta, la que hace falta para realinear un rayo antes de que entre en la pieza siguiente.

El emisor no cambia: sigue absorbiendo cualquier rayo que le llegue, alineado o no — esa regla ya no depende de geometría fina.

## 1. Geometría del espejo-vértice

Un vértice es un punto de la rejilla `(R, C)`, con `R, C` enteros en `[0, size]` (hay `(size+1)²` vértices para un tablero `size × size`). Un espejo-vértice **horizontal** en `(R, C)` es el segmento `y = R`, `x ∈ [C-0.5, C+0.5]`: mitad de ancho hacia cada lado del vértice, pegado a la arista horizontal que separa dos filas. Uno **vertical** en `(R, C)` es el segmento `x = C`, `y ∈ [R-0.5, R+0.5]`, pegado a la arista vertical entre dos columnas.

Este segmento nunca queda dentro de una sola celda (vive exactamente en su borde), así que no se puede probar como las líneas internas de hoy (`bs`/`fs`/`hc`/`vc`, que sí caen dentro de una celda). Se prueba en el momento en que el trazador cruza ese borde:

- **Horizontal**, en un cruce `top` (saliendo hacia arriba, borde `y = r`) o `bottom` (saliendo hacia abajo, `y = r+1`): `R` es ese entero (`r` o `r+1`); `C` es `c` si el cruce cae en la mitad izquierda de la celda (`hit.x ≤ 0.5`) o `c+1` si cae en la mitad derecha.
- **Vertical**, en un cruce `left` (`x = c`) o `right` (`x = c+1`): `C` es ese entero; `R` es `r` o `r+1` según `hit.y` sea `≤ 0.5` o no.

Si `piezasVertice[R][C]` tiene el tipo que corresponde (`HORIZ` para top/bottom, `VERT` para left/right), el rayo **no cambia de celda**: se refleja ahí mismo (`dy = -dy` o `dx = -dx`) y sigue marchando dentro de la celda de origen, exactamente como una pieza interna de hoy. Si no hay pieza ahí, el cruce sigue su camino normal (transición a la celda vecina, como ahora).

Esto reutiliza sin tocarlo el `siguienteCruce` de hoy (sigue siendo puramente geométrico, no sabe de piezas); el chequeo de vértice se añade en `simularHaz`, justo antes de decidir la transición de celda para un cruce `top`/`bottom`/`left`/`right`.

## 2. Llegada al centro

Se añade un quinto candidato a `siguienteCruce`: el punto exacto `(0.5, 0.5)`, solo alcanzable si la dirección actual pasa por ahí antes que por cualquier borde (con cardinal, exige que la otra coordenada ya sea `0.5`; con diagonal, exige entrar por la esquina correcta). Es geometría, igual que las demás líneas — no necesita saber qué pieza hay en la celda.

`simularHaz` solo actúa sobre ese candidato si la celda actual es diana, prisma o condensador:

- Si el rayo llega al centro: se dispara el efecto de la pieza (igual que hoy: diana comprueba color, prisma reparte azul/rojo, condensador anota o mezcla), con el punto real, sin forzar nada.
- Si el rayo sale de la celda por un borde **sin haber pasado por el centro**: no pasa nada — se trata como celda vacía y sigue su marcha (transición normal, sujeta a las reglas de siempre: fuera de tablero, bloqueo, emisor).

Una celda con diana/prisma/condensador nunca lleva además una pieza de `piezas[r][c]` (ocupación exclusiva, como hoy), así que el candidato "centro" y los candidatos de espejo de celda nunca compiten en la misma celda. Si esa celda tiene un espejo-vértice en una de sus propias esquinas, se prueba igual que en cualquier otra celda.

## 3. Modelo de datos

`piezas` no vive en el payload — es el tablero mutable que arranca vacío (`crearPiezas(size)`) y que la plantilla, el jugador y el buscador de soluciones van rellenando. `piezasVertice` sigue exactamente el mismo patrón, como una segunda rejilla paralela: `crearPiezasVertice(size)` devuelve una matriz `(size+1) × (size+1)` de ceros, con los mismos códigos que `PIEZA` (`3` = `VERT`, `4` = `HORIZ`). Todas las funciones que hoy reciben `piezas` (`simularHaz`, `simularTodos`, `resuelto`, `resolverPiezas`, `piezasMinimas`) pasan a recibir también `piezasVertice`; el payload público (`lasers`/`targets`/`blocks`/`size`/`modo`/`min_piezas`) no cambia de esquema. Lo único que crece es la `solucion` que el generador calcula para validación interna, que pasa a llevar `{ piezas, piezasVertice }`.

Un vértice solo admite un tipo a la vez (no se apilan horizontal y vertical en el mismo punto): simplifica el modelo y no hay ningún caso en el reto de hoy, ni en el resto del catálogo previsto, que necesite las dos cosas a la vez en el mismo sitio.

## 4. Interfaz (`plantillas/laser_triangular.js`)

Mismos botones de bandeja para `|` y `—`; el gesto de colocación gana un segundo blanco. El tablero ya distingue el centro de una celda (colocación de hoy) de sus cuatro esquinas: el radio de acierto de un vértice es más pequeño que el de una celda completa (la mitad de la distancia entre ambos, para que no compitan). Un vértice ocupado se dibuja como una barra corta centrada en el punto, la mitad de larga que el espejo de celda — se lee como "medio espejo" a simple vista, que es justo lo que es.

Tocar un vértice ya ocupado lo retira, igual que hoy con una celda. Arrastrar desde la bandeja también reconoce el vértice más cercano si cae dentro de su radio.

Con la llegada obligatoria al centro, el renderer deja de forzar el último punto de cada tramo que acaba en diana/prisma/condensador: ahora ese punto siempre es el centro real, porque si no lo fuera el tramo no habría terminado en esa pieza.

## 5. Generador (`buildLaserPuzzle`, `construirPrisma`, `construirCondensador`, `construirClasico`)

La construcción sigue siendo hacia atrás (colocar piezas, trazar con el trazador real, plantar la diana donde acaba el rayo), pero ahora con un paso más: tras fijar dónde termina cada tramo (diana de `clasico`, cada hijo de `prisma`, el hijo `magenta` de `condensador`), se comprueba si esa llegada ya pasa por el centro. Si no:

1. Se recorre el último tramo del rayo hacia atrás hasta el cruce de borde inmediatamente anterior a la celda final.
2. Se deriva el vértice y la orientación que lo realinean: son los que aparecen en la sección 1, aplicados a ese cruce concreto y a la dirección de llegada.
3. Se coloca ese espejo-vértice, se vuelve a trazar y se comprueba que ahora sí entra por el centro.

Si el vértice ya está ocupado, o el nuevo trazado cruza con otro rayo, o sigue sin entrar alineado (no debería pasar, pero se comprueba), el intento se descarta — igual que hoy se descartan intentos sin solución, contando contra `MAX_INTENTOS`.

`resolverPiezas`/`piezasMinimas` amplían su espacio de búsqueda: además de las celdas de `squaresPath`, prueban los vértices que tocan esas celdas, con los dos tipos (`VERT`/`HORIZ`) en vez de los seis de hoy — un espejo-vértice nunca es prisma, condensador, ni diagonal. El coste se mide con el mismo test de tiempo que ya vigila `piezasMinimas`.

## 6. Validador (`validateLaserData`)

- El esquema del payload no cambia (`piezasVertice` no viaja ahí, ver sección 3): nada nuevo que validar en el JSON publicado.
- Sustituye la comprobación de victoria por la nueva `resuelto` (llegada al centro obligatoria).
- `piezasMinimas` (ya extendido) sigue confirmando que `min_piezas` es el mínimo real, ahora contando también los espejos-vértice de la solución guardada (`solucion.piezasVertice`).

## 7. Compatibilidad con el archivo publicado

**Se re-valida todo el archivo con la regla nueva; lo que ya no cumpla se marca, no se regenera.** El archivo histórico no es reproducible — regenerar un reto pasado da otro puzzle — así que no hay forma de "arreglar" un reto viejo sin cambiarlo de raíz.

`scripts/validate-retos.js` gana un modo de barrido (`--reporte-alineacion` o similar) que recorre `retos/` + `data/` de `laser-triangular` en modo `prisma`/`condensador` (y `clasico` con diana desviada) y, para cada uno, comprueba si la solución grabada (`solucion.piezas` cuando existe, o la que encuentre `resolverPiezas`) sigue llegando al centro en todas sus piezas. El resultado se escribe a un fichero de reporte (no se toca `retos/` ni `data/`); decidir qué hacer con los que salgan marcados — dejarlos jugables con la regla vieja vía un campo de versión, ocultarlos del archivo, o algo distinto — queda para cuando se vea el tamaño real del problema.

Este barrido es el primer paso de la implementación: antes de tocar el trazador de producción hace falta saber cuántos retos publicados dependen del salto visual para "resolverse".

## 8. Pruebas

- `tests/laser/vertice.test.js` (nuevo): geometría del espejo-vértice en los cuatro cruces (top/bottom/left/right), con `hit.x`/`hit.y` a cada lado del punto medio; reflexión correcta; un vértice sin pieza no afecta nada.
- `tests/laser/centro.test.js` (nuevo): entrada alineada activa la pieza con el punto real (sin forzar nada); entrada desalineada no activa nada y el rayo sigue; casos cardinal y diagonal.
- `tests/laser/trazador.test.js`: se actualizan los casos de prisma/condensador que hoy asumen llegada inmediata, para pasar por el espejo-vértice donde haga falta.
- `tests/laser/generador.test.js`: los tres modos siguen generando con la regla nueva; la solución guardada entra alineada; `resolverPiezas` encuentra el mínimo contando vértices.
- `tests/laser/compatibilidad.test.js`: se amplía para correr el barrido de la sección 7 sobre los ficheros reales y guardar su resultado (no falla el test si algo sale marcado — es informativo, no una regresión).

## 9. Fuera de alcance

- Espejo-vértice para `/` y `\`: los diagonales se quedan solo en celda.
- Dos piezas de vértice en el mismo punto (horizontal y vertical a la vez).
- Alinear al centro para el emisor: sigue absorbiendo cualquier rayo, alineado o no.
- Decidir el destino final de los retos marcados en el barrido de compatibilidad (sección 7): ese barrido produce el diagnóstico, no la corrección.
