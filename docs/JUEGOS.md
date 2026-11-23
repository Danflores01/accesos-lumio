# Juegos nuevos del reproductor (8 nov 2026)

Pedidos por Daniel el 8 de noviembre de 2026. Lógica en `sparked/js/juegos.js`, arte en `sparked/js/arte.js`,
estilos en `sparked/css/juegos-nuevos.css` (enlazada en `sparked/guia.html`) y textos (es, en, fr) en `TEXTOS` de
`sparked/js/cartucho.js`. Todos usan el contenido de siempre: no hay campos nuevos obligatorios en el cartucho.

## 1. Enemigos (sustituye al juego de puertas)

- **Mecánica:** un camino con un enemigo por pregunta (las preguntas de opción múltiple y completar del bloque; lo
  normal son 5 o 6). El personaje tiene 3 vidas y 20 segundos por pregunta.
  - **Acierto:** el personaje ataca, el enemigo cae y el camino avanza hasta el siguiente.
  - **Error o tiempo agotado:** el enemigo golpea, se pierde una vida y se muestra la retroalimentación de la pregunta.
    Ese enemigo se va al final de la fila y vuelve a salir más adelante (solo cuenta el primer intento).
  - **Sin vidas:** pantalla "¡Inténtalo de nuevo!" con un mensaje para repasar y el botón "Repasar la pista" (lleva a la
    pista de la primera pregunta fallada), igual que la revancha del duelo.
  - **Victoria:** "¡Venciste a todos los enemigos!" con los aciertos al primer intento.
- **Calificación:** cada pregunta se registra en `ctx.resultados` con su `id` (panelPregunta), igual que la carrera.
- **Enemigos (6 diseños, `ENEMIGOS` en arte.js):** baba, duende, murciélago, gólem de piedra, hongo y robot oxidado.
- **Escenarios (`PLANTILLAS.enemigos`):** bosque, cueva y desierto (`escenaEnemigos`), con capas que se desplazan.
- **Nombre interno:** las slides nuevas son `k: "enemigos"` (ícono 👾 en la rejilla). `k: "puertas"` se conserva como
  alias (en `reproductor.js` y `juegos.js`) para que las guías ya publicadas abran el juego de enemigos; las plantillas
  viejas (torre, mansión, bodega) se dibujan como bosque, cueva y desierto.

## 2. Elige tu personaje

- **Dónde:** duelo, enemigos, castillo (defensa de la torre) y montaña. Antes de empezar, la tarjeta "¿Cómo se juega?"
  pregunta "¿Quién quieres ser?": **Sparky** o la **princesa guerrera**. La escena de fondo cambia en cuanto se elige.
  **Excepto en las guías de universidad** (§ 6): ahí no se pregunta y el protagonista es siempre Sparky.
- **Memoria:** la elección se guarda en `localStorage` (`sparked_personaje`) y se usa en la siguiente partida; se puede
  cambiar cada vez. Las carreras siguen con su selector de coche, caballo o dragón (no tienen protagonista a pie).
- **Princesa guerrera (`cuerpoPrincesa` en arte.js):** misma escala y mismos puntos de apoyo que Sparky (16 × 20):
  diadema dorada con gema, trenza, capa, peto de plata, túnica turquesa, botas y la misma espada de Sparky (`+espada`).
  Poses: decidido, golpe, festejo, triste (caída) y quieto.
- **Funciones:** `heroe(quien, pose, escala)`, `capaHeroe`, `capaEscaladorDe` (montaña) y `capaArqueroDe` (torre, con
  arco) en arte.js; `personaje(ctx)`, `selectorPersonaje(ctx)` y `conectarSelector(tarjeta, alCambiar)` en ui.js.
  Las dos primeras reciben el contexto del reproductor para saber si la guía es de universidad: todo juego con
  protagonista debe llamarlas con `ctx` (sin él, `personaje()` lee `localStorage` como antes).
- **Duelo:** la barra de vida dice SPARKY o PRINCESA y la instrucción dice "tu personaje ataca con su espada".

## 3. Clavados de pingüino (opción múltiple y completar)

- **Mecánica:** la de la carrera: una pregunta por turno, 20 segundos cada una. Un pingüino rey (colores reales) espera
  en lo alto de un iceberg con resbaladilla; a la derecha, en un témpano, un jurado de tres pingüinos con disfraces
  discretos (sombrero de copa, moño y lentes) y tablillas de calificación.
  - **Acierto:** se desliza, hace un clavado y el jurado levanta 10. Cinco clavados al azar, sin repetir el mismo dos
    veces seguidas: triple mortal, tirabuzón, bala de cañón, clavado de cisne y doble mortal hacia atrás.
  - **Error o tiempo agotado:** el clavado sale mal y el jurado levanta notas de 1 a 4. Cinco fracasos al azar, sin
    repetir seguido: panzazo, resbalón, choque con el hielo, se quedó corto y de cabeza en la nieve.
  - Cada clavado muestra su nombre en un letrero y la retroalimentación de la pregunta.
- **Puntuación:** los puntos suman las tablillas de cada clavado; al final se muestra el promedio del jurado (0 a 10) con
  un mensaje (9 o más: "¡Clavados de campeonato!"; 7 o más: "¡Muy buenos clavados!"; 5 o más: "Buen intento"; menos:
  "Sigue practicando") y los aciertos.
- **Calificación:** cada pregunta se registra en `ctx.resultados` con su `id`, como en la carrera.
- **Escenarios (`PLANTILLAS.pinguino`):** polo (día), aurora (noche) y atardecer (`escenaPinguino`).
- **Slide:** `k: "pinguino"` (ícono 🐧). Sonidos nuevos en `sonido.js`: `chapuzon`, `plaf`.
- La animación termina también por temporizador: si el navegador frena los cuadros (pestaña oculta), el juego sigue.

## 4. El perro y su plato (verdadero o falso)

- **Mecánica:** un border collie (blanco y negro, collar rojo) sentado entre dos platos: "✓ Verdadero" a la izquierda y
  "✗ Falso" a la derecha. Arriba aparece la tarjeta de la afirmación. Se arrastra al plato con el dedo o el mouse, o se
  toca la tarjeta y luego el plato (también basta tocar el plato). Funciona con toque en iPad y teléfono.
  - **Correcto:** el perro va a su plato, se come la tarjeta, mueve la cola y salen corazones.
  - **Incorrecto:** el perro la huele, dice que no con la cabeza y la regresa con la nariz a su lugar, con la
    retroalimentación de la afirmación. La tarjeta se queda hasta que se lleve al plato correcto (así se aprende).
- **Calificación:** cada afirmación se registra en `ctx.resultados` con su `id`; solo cuenta el primer intento. Al final:
  "¡El perro quedó feliz!" con los aciertos al primer intento.
- **Contenido:** las afirmaciones `verdadero_falso` del bloque, todas en un solo juego. No se inventan afirmaciones: si
  el bloque trae menos de 5, se juegan las que haya (el generador ya pide mínimo 5).
- **Slide:** `k: "perro"` (ícono 🐶). Sonidos nuevos: `nam` y `ladrido`. Arte: `capaPerro`, `capaPlato`, `escenaPerro`.

## 5. Reparto de plantillas sin repeticiones seguidas (`repartir` en cartucho.js)

`armarSlides` arma las slides como siempre (respetando `b.orden` y `primera_actividad`) pero deja sin decidir el juego
de preguntas de cada bloque y el tipo de verdadero o falso; al final, `repartir()` los elige con estas reglas de Daniel:

1. **Aleatorio pero fijo por guía:** se usa `c.semilla`, así la misma guía sale igual en todos los dispositivos.
2. **Nunca dos actividades del mismo tipo seguidas**, aunque haya teoría en medio o se cruce de un bloque al siguiente
   (dos carreras, dos verdadero o falso del mismo tipo, dos Mix & match…). Si el plan pone juntas dos actividades fijas
   del mismo tipo, se intercambia la segunda con otra actividad posterior del mismo bloque. La regla es la misma con
   los títulos de universidad: «Relaciona» es Mix & match, «Ordena» es Rank order y «Clasifica» es Super sort (§ 6).
3. **Plantillas de juego de preguntas:** carrera de coches, de caballos, de dragones y de naves, enemigos, montaña,
   castillo, duelo y clavados de pingüino. Ninguna se repite en la guía si hay otras disponibles; si no queda remedio, va
   separada por al menos 15 slides. Sin otra preferencia, se prefiere una mecánica que todavía no haya salido. En las
   guías de universidad solo hay carrera, montaña y castillo (regla 7).
4. **El primer juego de preguntas del bloque 1 nunca es una carrera:** el calentamiento ya es una carrera y la vista
   previa debe mostrar dos formatos distintos.
5. **`bloques[i].mecanica_quiz`** ("carrera", "montana", "castillo", "enemigos", "duelo" o "pinguino") se respeta salvo
   que rompa las reglas anteriores. La lista `duelo` del generador y `"juego": "duelo"` cuentan como un pedido de duelo:
   el primero se juega como duelo; si la guía trae otro duelo cerca, ese bloque recibe otra plantilla con las mismas
   preguntas (siguen contando en la calificación).
6. **Verdadero o falso:** se reparte entre el contra reloj (swipe) y el perro, el que se haya usado menos, sin repetir
   seguido.
7. **Universidad (Daniel, 12 y 17 nov 2026: «que las actividades no sean tan infantiles»):** si el cartucho trae
   `plan.perfil_edad === "universitario"` (lo fija el servidor por el grado), los juegos de preguntas solo son carrera,
   montaña y castillo (`MECANICAS_UNIVERSIDAD`): nunca enemigos, duelo ni pingüino. Se reparten **parejo**: todas las
   carreras cuentan como UNA mecánica (antes cada piel de carrera contaba como un juego distinto y, con 4 bloques o más,
   salían carreras de más y una sola montaña o castillo) y en cada juego se elige la mecánica que menos veces va en la
   guía (el calentamiento cuenta como carrera), sin repetir la del juego de antes ni la del juego fijo de después. El
   primer juego del bloque 1 sigue sin ser carrera. Lo que pide `mecanica_quiz` se respeta si es una de las que menos
   van; si pide enemigos, duelo o pingüino, se cambia por otra. La lista `duelo` o `"juego": "duelo"` se juegan con una
   de las tres (`esDuelo`, en juegos.js, tampoco vuelve duelo esas preguntas). Las pieles salen de
   `PLANTILLAS_UNIVERSIDAD` (cartucho.js): la carrera es **solo de coches** (`ciudad_neon`, de noche, y `callejera`, al
   atardecer; nada de naves, caballos ni dragones) y el castillo solo `noche` o `amanecer` (sin `dragon`); la piel no se
   repite si hay otra libre. El verdadero o falso va siempre contra reloj (swipe), sin el perro. Con cualquier otro
   perfil el reparto es exactamente el de las reglas 1 a 6.

Las plantillas ya ocupadas por el calentamiento (o por otras slides fijas) cuentan desde el principio.
El calentamiento usa siempre la plantilla `formula1` (circuito de Fórmula 1 de día, colores reales): es el primer juego
que ve la familia y la carrera de F1 es la vitrina de SparkEd. Las otras carreras (ciudad de neón, naves, caballos y
dragones) quedan para los bloques, repartidas por las reglas de arriba. La instrucción de la carrera ya no dice "Elige tu
coche": el selector dice coche, nave, caballo o dragón según la plantilla.

## 6. Universidad: acabado más sobrio (Daniel, 12 y 17 nov 2026)

Daniel: «que las actividades no sean tan infantiles». Todo lo de esta sección pasa **solo** cuando el cartucho trae
`plan.perfil_edad === "universitario"` (lo fija el servidor por el grado); con cualquier otro perfil nada cambia. El
perfil se lee de `c.plan.perfil_edad` (`esUniversidad(c)` en cartucho.js y `esUniversidad(ctx)` en ui.js). Commit d16d12b.

- **Juegos de preguntas:** solo carrera, montaña y castillo, repartidos parejo y con pieles sobrias (§ 5, regla 7). Sin
  enemigos, duelo ni pingüino; el verdadero o falso es solo el contra reloj, sin el perro.
- **Sin selector de personaje:** no se pregunta «¿Quién quieres ser?» y el protagonista es siempre Sparky
  (`personaje(ctx)` y `selectorPersonaje(ctx)`, § 2); el juego empieza directo desde la tarjeta de instrucciones.
- **Títulos sencillos** (`TITULOS_UNIVERSIDAD`, cartucho.js; el icono no cambia): «🧩 Relaciona», «🔢 Ordena» y
  «🗂️ Clasifica» en lugar de Mix & match, Rank order y Super sort (en inglés Match, Put in order y Sort; en francés
  Associe, Ordonne y Classe). Los usa el título de la slide y la pantalla final de esos tres juegos (`tituloFinal`, en
  juegos.js). Los demás títulos no cambian.
- **Botón de la teoría:** «Comenzar» (en inglés «Start», en francés «Commencer») en lugar de «¡A jugar!»
  (`TEXTOS_UNIVERSIDAD` en cartucho.js; `t(idioma, clave, perfil)` y `ctx.t` reciben el perfil).
- **Final sin fiesta** (`fin`, en ui.js): la misma tarjeta con una palomita verde (✓), sin lluvia de confeti, sin trofeo
  y sin fanfarria (suena el tono de nivel, `sonido.nivel()`). El mensaje, los aciertos y los botones son los de siempre.
- **Castillo sin GAME OVER:** al perder las tres vidas sale la tarjeta «Inténtalo de nuevo · Se acabaron las vidas.» con
  las correctas y el botón «Reintentar» (`SOBRIO` en ui.js; en inglés «Try again» y «Retry», en francés «Essaie encore»
  y «Réessayer»), no la pantalla CRT con calaveras. `gameOver` solo lo llama hoy el castillo (juegos.js).
- **Al agregar un juego o una pantalla final nuevos:** que el final pase por `fin()` o `gameOver()` de ui.js (así hereda
  el acabado sobrio), que el protagonista salga de `personaje(ctx)` y que, si el juego tiene un título de aspecto
  infantil, lleve su versión sencilla en `TITULOS_UNIVERSIDAD`.
