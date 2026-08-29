# Siembra de lanzamiento — textos listos para pegar

Un post por sitio, bien hecho, **una sola vez**. Esto no es un goteo: el goteo pide atención diaria y el proyecto está pensado para no pedirla. Marca la casilla cuando esté hecho y no vuelvas.

**No publiques nada de esto hasta que el botón de "Copiar resultado" esté desplegado** — el pico de tráfico de un lanzamiento es de un solo uso, y sin compartir no se multiplica.

Enlace, siempre el mismo: `https://mathgymdcr.github.io/mathgym/`

---

## Reddit

Norma común: cero lenguaje de anuncio, contar qué es y qué tiene de particular. Si preguntan, responde; si no, no insistas.

- [ ] **r/SideProject** — título: `MathGym: un reto de lógica distinto cada día, 12 tipos de puzzle, sin cuentas ni anuncios`
- [ ] **r/InternetIsBeautiful** — título: `A daily logic puzzle that rotates between 12 different puzzle types (Spanish)`
- [ ] **r/webdev** (hilo "Show and tell" semanal) — el ángulo técnico: sitio estático sin bundler, generador determinista por fecha, validador que comprueba que cada reto tiene solución única antes de publicarlo.
- [ ] **r/puzzles** — título: `Daily puzzle site that cycles 12 puzzle types (nonograms, Hashi, lights out, Einstein riddles...)`
- [ ] **r/es** y **r/matematicas** — en español, tono de vecino: `He montado un gimnasio mental: un reto de lógica al día, gratis`

Cuerpo base (adáptalo a cada sub):

> MathGym publica un reto de lógica nuevo cada día. Rota entre 12 tipos —nonogramas, puentes de Hashi, apagar luces, el enigma de Einstein, láseres y espejos, mezclas químicas…— y cada reto lo genera un script que además comprueba que tiene solución **y que es única** antes de publicarlo, así que no hay retos imposibles ni ambiguos.
>
> No hay cuentas, ni anuncios, ni backend: el progreso y la racha viven en tu navegador. Está en español.
>
> https://mathgymdcr.github.io/mathgym/

## Hacker News

- [ ] **Show HN** — entre semana, mañana hora de EE. UU. (≈13:00-16:00 UTC).

Título: `Show HN: MathGym – A daily logic puzzle that rotates 12 puzzle types`

Primer comentario (el que de verdad se lee):

> Autor aquí. MathGym es un sitio estático sin build: módulos ES cargados directamente por el navegador, sin bundler. Lo que me parece lo más interesante de contar es el pipeline: un GitHub Action diario deriva de forma determinista un tipo de puzzle y una variante a partir de la fecha, genera el reto, y un validador independiente vuelve a resolverlo —con una implementación distinta de la del generador en varios tipos— para comprobar solvencia y, donde importa, unicidad. Si no pasa, el workflow revienta y no se publica nada.
>
> El fallo más divertido que encontré: durante mucho tiempo ocho tipos publicaron **una sola variante** aunque tenían varias escritas. La selección de tipo era `templates[seed % 12]`, así que cada tipo recibía solo una clase de residuos módulo 12; cualquier eje elegido con más aritmética sobre ese mismo seed quedaba constante para siempre. Ahora cada eje se sortea con un PRNG y una máscara propia, y hay un test que barre las fechas reales para que no vuelva a pasar.

## Indie Hackers

- [ ] Post en **Products** / *Show IH*, mismo cuerpo que Reddit + una línea sobre el coste: se sostiene con GitHub Pages y GitHub Actions, cero euros al mes.

## Product Hunt

- [ ] Listar el producto. Uno de los mayores picos puntuales posibles para un proyecto personal.
  - **Tagline:** `A new logic puzzle every day, free and account-free`
  - **Descripción:** 12 tipos de puzzle rotando cada día, con solución garantizada y única, racha local y cero registro.
  - **Galería:** `assets/og-mathgym.jpg` como imagen principal, más capturas de tres tipos distintos (nonograma, láser, hashi).
  - Programa el lanzamiento para las 00:01 PT de un martes o miércoles.

## itch.io

- [ ] Alta en la sección de puzzle / web games. Público que busca activamente juegos gratis. Tipo de proyecto: **HTML** con enlace externo.

## Comunidades de profesorado

- [ ] Grupos de profesores de matemáticas en español (Facebook, Telegram). El ángulo aquí no es "juego", es **recurso de aula**: un reto proyectable de cinco minutos para empezar la clase, con Deceerre de guía y la dificultad a la vista.

---

# SEO de cola larga (📌 una vez, rinde con los meses)

- [ ] **Topics del repositorio.** Se ponen en un comando:
  ```bash
  gh repo edit mathgymdcr/mathgym --add-topic puzzle --add-topic daily-challenge \
    --add-topic wordle-like --add-topic logic-game --add-topic matematicas \
    --add-topic javascript --add-topic game --add-topic educational
  ```
- [ ] **Descripción y web del repositorio**, que es lo que sale en las búsquedas de GitHub:
  ```bash
  gh repo edit mathgymdcr/mathgym \
    --description "Un reto de lógica nuevo cada día: 12 tipos de puzzle, generados y validados automáticamente." \
    --homepage "https://mathgymdcr.github.io/mathgym/"
  ```
- [ ] **AlternativeTo.net** — dar de alta MathGym como alternativa a *Wordle* y a *NYT Games*. Gratis, lo indexa Google, tráfico pasivo constante.
- [ ] **Listados de "juegos como Wordle"** — hay decenas de recopilatorios (blogs, hilos fijados de subreddits, gists de GitHub). Proponer MathGym en los que acepten sugerencias: PR al gist o comentario en el hilo, sin insistir.
