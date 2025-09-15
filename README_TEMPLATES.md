
# Plantillas de retos — MathGym

## Esquema de reto (JSON)
```json
{
  "fecha": "YYYY-MM-DD",
  "titulo": "string",
  "objetivo": "string",
  "icono_url": "string",
  "tipo": "multiple | relojes-arena | trasvase-ecologico | ...",
  "data": { /* payload específico por plantilla */ }
}
```

## Añadir una plantilla nueva
1. Crea un archivo en `plantillas/mi_plantilla.js` que exporte `render(root, data, hooks)`.
2. Regístrala en `plantillas/base.js` añadiendo un loader:
```js
const loaders = {
  // ...
  'mi-plantilla': () => import('./mi_plantilla.js')
};
```
3. En tu reto JSON usa `"tipo": "mi-plantilla"` y define `data`.

## Hooks disponibles
- `onSuccess()` → marca visual de éxito + animación ligera.
- `onHint(msg)` → muestra una pista a través de Deceerre.

## Plantillas incluidas (ejemplos)
- `multiple` → elección múltiple con `opciones[]` y `correcta`.
- `relojes-arena` → describe plan para medir tiempo con relojes.
- `trasvase-ecologico` → plantea el clásico de jarras.
