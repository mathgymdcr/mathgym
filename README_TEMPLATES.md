
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
