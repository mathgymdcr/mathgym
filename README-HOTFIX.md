# MathGym — HOTFIX (logo + Enigma seguro + desactivar Service Worker)

## Qué incluye este ZIP
- `assets/logo-placeholder.svg` → corrige el 404 del logo en `index.html`.
- `plantillas/enigma_einstein.js` → versión segura (sin backticks conflictivos).

## Qué debes hacer
1) **Copia estos archivos** dentro de tu repo, respetando las rutas:
   - `assets/logo-placeholder.svg`
   - `plantillas/enigma_einstein.js`

2) **Elimina el Service Worker** del repo si existe:
   - Borra `sw.js` (o cualquier archivo de SW) y cualquier línea de registro
     como `navigator.serviceWorker.register('/sw.js')` en tu código.

3) **Limpia SW y cachés en tu navegador** (una vez desplegado):
   - Abre la consola (F12 → Console) y ejecuta:
```
navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
```
   - Recarga forzada: `Ctrl+F5` (o `Cmd+Shift+R`).

4) **Sube a `main`** y revisa **Actions** (Test + Deploy Pages).

Con esto, deberían desaparecer los errores:
- 404 del logo
- `sw.js` (Cache addAll) fallando
- `SyntaxError: Unexpected string (enigma_einstein.js)`
