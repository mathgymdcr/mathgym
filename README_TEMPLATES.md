
# Plantillas de retos — MathGym

## Esquema de reto (JSON)
```json
{
  "fecha": "YYYY-MM-DD",
  "titulo": "string",
  "tipo": "relojes-arena | mezcla-quimica | ...",
  "dificultad": "entero 1-5, opcional",
  "categorias": ["array de strings, opcional"],
  "data": { /* payload específico por plantilla */ }
}
```

`titulo` no se escribe a mano: es el `nombre` que el tipo tiene en
`catalogo-tipos.js`, y ahí lo pone `generarReto()`. El validador rechaza el
reto cuyo titulo no coincida con el catálogo, porque de ahí venía que un mismo
tipo se llamara de una forma en el tablero y de otra en el archivo.

Los campos `objetivo` e `icono_url` **ya no existen**: no los leía nadie. El
objetivo lo cuentan las instrucciones de cada plantilla, y el icono sale del
catálogo. El validador también los rechaza si reaparecen.

`dificultad` y `categorias` son opcionales: los retos antiguos no los tienen y siguen siendo válidos. Cuando están presentes, `archivo.js` los usa para mostrar la dificultad y para los filtros por categoría del archivo.

## Añadir una plantilla nueva
1. Crea un archivo en `plantillas/mi_plantilla.js` que exporte `render(root, data, hooks)`.
   Para la cabecera, llama a `buildStandardShell({ tipo, gameClass, instructionsHTML })`
   de `plantillas/shell.js`: el nombre y el icono los saca del catálogo, no se
   pasan a mano.
2. Añade la ficha del tipo (`tipo`, `nombre`, `icono`, `resumen`) a `catalogo-tipos.js`.
3. Regístrala en `plantillas/base.js` añadiendo un loader:
```js
const loaders = {
  // ...
  'mi-plantilla': () => import('./mi_plantilla.js')
};
```
4. En tu reto JSON usa `"tipo": "mi-plantilla"` y define `data`.

## Hooks disponibles
- `onSuccess()` → marca visual de éxito + animación ligera.
- `onHint(msg)` → muestra una pista a través de Deceerre.

## Plantillas incluidas (ejemplos)
- `multiple` → elección múltiple con `opciones[]` y `correcta`.
- `relojes-arena` → describe plan para medir tiempo con relojes.
- `nonograma` → pinta el dibujo oculto a partir de las pistas; con `paleta` en el payload va en color, y ahí dos bloques de colores distintos pueden ir pegados.
- `mezcla-quimica` → sintetizar los volúmenes exactos de `targets` trasvasando entre matraces sin graduar, uno o dos y en el orden que quiera quien juega.
- `poligono-geometrico` → dibujar figuras sobre la retícula encadenando nodos vecinos, y **pulsando un segmento ya trazado para borrarlo** (así se hacen salientes y entrantes). El payload es `{ gridSize, n_figuras, area, perimeter, formas }`: con `n_figuras: 2` los números son los **totales** y hay que deducir cómo se reparten, porque solo hay un reparto válido. `formas` toma `convexa` | `concava` | `libre` con una figura y `ambas-convexas` | `una-de-cada` | `ambas-concavas` con dos — y como aquí solo se dan pasos ortogonales, **convexo significa rectángulo**. Los payloads sin `n_figuras` ni `formas` se leen como una figura sin restricción, igual que antes.
- `fabrica-de-bloques` → KenKen/Calcudoku: rellenar una rejilla NxN sin repetir dígito en fila ni columna, cerrando la operación (`suma` | `resta` | `multiplicacion` | `division` | `null` para una región de una celda, ya dada) de cada región. El payload es `{ tablero: {ancho, alto}, regiones: [{id, celdas, operacion, objetivo}], solucion }`. `resta` y `division` solo existen para regiones de 2 celdas.
- `planos-del-invernadero` → Shikaku: dividir una rejilla NxN en módulos rectangulares, uno por pista, cuya área coincida exactamente con el número de la pista. El payload es `{ tablero: {ancho, alto}, pistas: [{f, c, valor}], solucion }`. Se traza tocando dos esquinas opuestas del módulo (la misma celda dos veces para un módulo de 1 celda); tocar una celda de un módulo ya trazado lo deshace. La plantilla comprueba la regla directamente (cobertura completa + una pista por módulo con área exacta), no compara contra `solucion` celda a celda -- acepta cualquier reparto válido, no solo el publicado.
- `radar-asteroides` → Buscaminas por pistas: marcar las celdas con asteroide de una rejilla NxN a partir de cuántos hay entre las hasta 8 vecinas de cada celda escaneada (una pista en `0` es justo la "celda escaneada y vacía" del informe original, sin campo aparte). El payload es `{ tablero: {ancho, alto}, pistas: [{f, c, valor}], asteroides_totales, solucion }`. `solucion` es una rejilla de booleanos (`true` = hay asteroide); las celdas de `pistas` nunca lo tienen.
- `ruta-del-dron` → cadena de instrucciones: cada baldosa (salvo la meta) apunta con una flecha+distancia a la siguiente. El payload es `{ tablero: {ancho, alto}, meta: {f, c}, instrucciones: [[{direccion, distancia} | null, ...], ...], solucion: {f, c} }`. La condición de victoria NO es "llegar a la meta" (muchas baldosas lo hacen, con cadenas más cortas): es encontrar la baldosa cuya cadena hasta la meta es la MÁS LARGA, y el generador exige que esa baldosa sea única (sin empates) para que el reto tenga solución.
