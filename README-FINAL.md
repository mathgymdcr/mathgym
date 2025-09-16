# MathGym — Entrega FINAL (4×4 interactivo)

**Incluye:**
- `plantillas/enigma_einstein.js` → 4×4 forzado, DOM API, selección de tarjetas, tablero funcional.
- `data/enigma_2025-09-15.json` → 4 categorías × 4 valores + 10 pistas.
- `assets/logo-placeholder.svg` (opcional; sólo si tu index.html lo referencia y te daba 404).

## Cómo aplicar
1. Sustituye estos archivos en tu repo (misma ruta):
   - `plantillas/enigma_einstein.js`
   - `data/enigma_2025-09-15.json`
   - (opcional) `assets/logo-placeholder.svg`
2. Commit & push a `main`.
3. Cuando Pages termine, recarga forzada (Ctrl+F5 / Cmd+Shift+R).
4. Si el navegador tuviera un Service Worker antiguo:
```js
navigator.serviceWorker.getRegistrations().then(r=>r.forEach(reg=>reg.unregister()));
caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))));
```
