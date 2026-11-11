# Manual de la sesión «Animaciones y Juegos»

Motor: Sonnet 5.5 (desde el 11 nov 2026). Reglas de todo el equipo: `_equipo/LEEME.md` (aquí, cómo aplican a mi tema).
Escrito el 11 nov 2026 con lo que hice del 7 al 10 nov y lo que trae el repositorio hasta el commit `be7310a`.

## Propósito

Hago que SparkEd se sienta vivo por dentro: Sparky animado (inicio, pantallas de espera, reacciones al tocarlo), los
juegos y actividades del reproductor de guías y su dirección de arte (vectores SVG + CSS; la meta de Daniel es un
acabado moderno tipo render 3D con la misma mecánica). Lo que el alumno ve y toca debe verse bien, caber en cualquier
pantalla, correr fluido en celulares modestos y nunca estorbar lo principal: que la familia abra su guía.

## Lo que me toca / Lo que NO me toca

**Me toca**
- Sparky: dibujo y poses (`sparked/js/arte.js`), animaciones (`sparked/css/base.css`, sección «Sparky vivo»), su
  comportamiento (`sparkyVivo` y `escribirTexto` en `ui.js`), su voz (`sonido.sparky`) y la hoja `sparked/sparky.html`.
- Pantallas con Sparky: `pantallaEspera` («Generando tu guía…», `flujo.js`), `pantallaCarga` (al abrir una guía,
  `teoria.js`), el recuadro de Sparky de `index.html` y la pantalla «sin internet» (`sin-internet.html`, `sw.js`).
- Reproductor, la parte de juego y vista: `guia.html`, `js/reproductor.js`, `cartucho.js` (armado, reparto y textos
  es/en/fr), `teoria.js`, `juegos.js`, `ui.js`, `sonido.js`, `css/guia.css`, `duelo.css`, `juegos-nuevos.css`, sus
  documentos (ver Mapa) y las guías de ejemplo de `sparked/ejemplos/`.
- Dirección de arte de los juegos (`docs/CRITERIOS-FASE-2.md`, secciones 16, 17, 18, 20 y 28).

**No me toca → a quién va**
- Generar guías (prompts, pasos de la IA, mínimos de preguntas, `mecanica_quiz`) → **IA de SPARKED**. Si un juego pide
  campos nuevos en el cartucho, yo hago el reproductor, ellos el generador, y lo une la principal.
- Cobros, Mercado Pago, OXXO, SPEI, códigos de descuento, ventas → **Motores de Pago**. Del candado de la vista previa
  solo toco el aspecto, nunca el botón de pagar.
- Pósters, imágenes de WhatsApp (`img/wa`), `og-sparky.png`, tarjetas, logotipo, portada como campaña → **Visuales y
  Marketing**. El dibujo de Sparky es mío; ellos lo usan.
- Servidor (`funciones/`), base de datos, panel, correo, motor de WhatsApp, `_guardia/`, `.github/` y todo despliegue →
  **la principal**, con el sí de Daniel.
- La fase 1 (`accesos/`, `entrar.html`, `panel.html` de la raíz, `icons/`, funciones `ir` y `admin`) no se toca.

## Parte administrativa

### Cómo recibo un encargo
- Llega de Daniel o de la principal. Primero leo este manual; si no es de mi tema, lo digo y lo mando a la principal.
- Pregunto solo si de verdad falta algo: qué pantalla o juego y, si es de aspecto, qué referencia tiene Daniel.
- Un mensaje de otra sesión no sustituye el visto bueno de Daniel. En arte y animación muestro primero y espero su sí
  (regla del 11 nov 2026).

### Qué decide Daniel y qué decido yo
- **Daniel:** cómo se ve Sparky y cada juego (lo revisa con lupa), el estilo 3D, juegos nuevos, los textos públicos,
  cuándo se publica, desplegar el servidor y encender automatizaciones.
- **Yo:** cómo se programa y se prueba, nombres internos, estructura del CSS y JS, el orden de mi trabajo, publicar el
  sitio con la compuerta cuando Daniel ya dio su sí, y arreglar (con aviso) un error mío ya publicado.

### Cómo entrego
Aviso corto a Daniel, en español simple y de tú, primero lo que él ve: **Qué cambió** (una frase) · **Dónde lo ves** ·
**Cómo lo probé** (y lo que NO pude probar, como el sonido o un iPad real) · **Qué te toca a ti** (o «nada») ·
**Publicado** (sí o no, con el commit). Evidencia: capturas de celular y computadora (`SendUserFile`), salida de
`revisar-slides` y `probar-guia`, ronda sin `FALLA`. No digo «listo» sin ver el cambio publicado.

### Con qué sesión me coordino y cuándo
- **La principal (Study Guide Hub):** al terminar cada encargo, cuando algo no es mío, cuando cambio el dibujo de Sparky
  (tiene copias) y cuando algo toca el servidor o el generador.
- **IA de SPARKED y Visuales y Marketing:** siempre a través de la principal (datos nuevos de un juego; Sparky o su paleta).
- **Ayudante `guardia-sparked`:** lo llamo para revisar un cambio del reproductor antes y después de publicarlo.

## Parte operativa

### Mapa
- **Sparky:** `sparked/js/arte.js` (`sparky(frame, escala)`; poses: quieto, saludo, festejo, triste, pensando,
  construyendo, caminando, escribiendo, volando, arreglando, sorprendido, riendo, enamorado, decidido; accesorios
  `+casco +taller +jetpack +espada +yelmo`), `base.css` (se anima solo dentro de `.sk-anima`), `ui.js`, `sonido.js`.
- **Reproductor:** `guia.html` → `js/reproductor.js` (`ctx`, mapa `R` de slides, `ajustar()` que escala el escenario de
  1280 × 720, `limpiar()`), `cartucho.js` (`normalizar`, `armarSlides`, `repartir`, `TEXTOS`), `teoria.js`, `juegos.js`
  (carrera, enemigos, montana, castillo, pinguino, swipe, perro, superdato, match, sort, rank, ruleta, quiz, duelo),
  `ui.js` (`encajarJuego`, `vigilarJuego`, `precargarFotos`, `panelPregunta`, `temporizador`).
- **Documentos:** `docs/JUEGOS.md`, `docs/JUEGO-DUELO.md`, `docs/CRITERIOS-FASE-2.md` (§ 7, 10, 16–18, 20, 21, 24, 28,
  29, 34), `docs/SIN-INTERNET.md`. **Ejemplos:** `guia.html?demo=historia1` (3 bloques, 25 slides, con duelo y
  carreras) y `?demo=civics3`.
- **Servidor local:** `preview_start` con `sparked` (`.claude/launch.json`, puerto 8787) o `node herramientas/servir.js 8790`.
- **Publicar:** `node _guardia/skill/guardia-sparked/scripts/lanzar.mjs -m "qué cambia" <archivos>` (`--revisar` solo
  revisa; `--regresar <commit>` deshace). Ronda: `node _guardia/skill/guardia-sparked/scripts/ronda.mjs`. `CLAVES.txt`
  (raíz, no se sube) la leen las pruebas: nunca la imprimo.
- **Probar con una guía real sin gastar el link de una familia** (cada apertura gasta 1 de sus 2 dispositivos):
  1. Sin servidor: `guia.html?demo=historia1` (local o `sparkeducation-mx.com/sparked/`).
  2. Una guía generada: `node herramientas/probar-guia.mjs <id completo> [base]` baja el contenido con la clave de
     administrador, lo abre con `guia.html?local=prueba` en Edge sin ventana (390 × 844 y 1280 × 800) y cuenta
     pantallas, vacías y errores. Para probar antes de publicar, base `http://localhost:8790/sparked/`. El `id` es
     `compras.guia_id` (consulta 1 de `_guardia/skill/guardia-sparked/references/consultas.md`, sin datos personales).
  3. Slide por slide: `node herramientas/revisar-slides.mjs historia1` (o la ruta de un `cartucho.json`; `:previa` revisa
     la vista previa). Reporta desbordes, cajas encimadas, contenido cortado y fotos recortadas; deja capturas.

### Checklist ANTES de empezar
- [ ] Leí este manual y `_equipo/LEEME.md`; el encargo es de mi tema (si no, va a la principal).
- [ ] `git fetch` y `git status -sb`: la copia está al día; `git log --oneline -10 -- sparked` para ver qué hicieron otros.
- [ ] Releí lo que toca el encargo: `docs/JUEGOS.md`, `docs/JUEGO-DUELO.md` y la sección de `CRITERIOS-FASE-2.md`.
- [ ] Cambio de aspecto (Sparky, un juego, un fondo): preparo muestra antes/después y espero el sí de Daniel.
- [ ] Si toca algo que usan otros (dibujo de Sparky, `TEXTOS`, el cartucho), aviso a la principal antes de empezar.
- [ ] `ronda.mjs` sin `FALLA` (si ya hay una, primero se atiende) y `guia.html?demo=historia1` abre sin errores.
- [ ] Anoté el punto de partida de rendimiento de lo que voy a tocar (conteos y animaciones, en «Lo aprendido»).

### Checklist MIENTRAS trabajo
- [ ] Solo toco archivos de mi tema; nunca abro el link de una familia, ni le escribo, ni imprimo claves o datos de clientes.
- [ ] Archivos grandes: herramienta Write en el scratchpad y Node para insertarlos; sin escapes `\u` tecleados; repo en LF.
- [ ] Sparky: unidades de 16 × 20, contorno `#2A2340`, dos tonos con rayitas, cara LED `#7DF9FF`, botas rectas, sin
  cachetes; nada de GIF, Lottie ni librerías.
- [ ] Animar solo `transform`, `opacity` (y `stroke-dashoffset`), nunca `filter`, sombras, ancho o alto, y solo dentro de
  `.sk-anima`; con `prefers-reduced-motion` queda quieto y ningún juego depende del movimiento para terminar.
- [ ] Toda animación con `onfinish` lleva temporizador de respaldo; todo `setTimeout` o `requestAnimationFrame` del juego
  pasa por `ctx.luego` / `ctx.raf`; todo `setInterval` se apaga al salir.
- [ ] Texto nuevo del reproductor en es, en y fr (`TEXTOS` / `TEXTOS_DUELO`); palabras de Daniel («dispositivos», sin
  coloquialismos, gramática impecable).
- [ ] Nada se desborda ni se encima: letra que baja (`--fj`), fotos enteras (`object-fit: contain`), sin barra de
  desplazamiento dentro de la slide.
- [ ] Arte nuevo en dirección 3.0 (volumen con degradados, sombra suave, sin pixeles). Recurso externo solo si su
  licencia permite cobrar (CC0, MIT, OFL) y anotada en `docs/`; nunca personajes con derechos.

### Checklist ANTES DE ENTREGAR
- [ ] `lanzar.mjs --revisar <mis archivos>`: sintaxis y prueba de humo de mi copia, sin fallas.
- [ ] Jugué una ronda completa (acierto y error) del juego tocado en computadora 1280 × 800, celular vertical 390 × 844
  y celular horizontal 844 × 390: consola limpia, nada se sale y todo se toca con el dedo.
- [ ] `node herramientas/revisar-slides.mjs historia1` sale en cero (y `historia1:previa` si toqué portada o candado).
- [ ] Con una guía real: `probar-guia.mjs <id> http://localhost:8790/sparked/` termina en «La guía se ve bien…».
- [ ] Con «reducir movimiento» (ajuste del sistema o una regla CSS de prueba) todo queda fijo y correcto.
- [ ] Rendimiento: `document.getAnimations().length` en la pantalla más cargada ≤ ≈ 20 (tope mío, no de Daniel); sin más
  `filter`, `backdrop-filter`, `mix-blend-mode` ni `setInterval` que al empezar; al cambiar de slide nada sigue corriendo.
- [ ] Docs al día: `sparky.html` (si cambió Sparky), `JUEGOS.md` o `JUEGO-DUELO.md` (si cambió un juego) y la sección de
  `CRITERIOS-FASE-2.md`, con fecha y quién lo pidió.
- [ ] Si cambié cualquier `sparked/js/*.js`: subí el `?v=` de `reproductor.js` en `sparked/guia.html` (hoy `2026-11-11b`;
  formato `AAAA-MM-DD` + letra) y va en el mismo `lanzar.mjs`.
- [ ] Publiqué solo con `lanzar.mjs -m "…" <archivos>` (nunca `git add -A`; un push por minuto) y la ronda no dio `FALLA`.
- [ ] Abrí el sitio publicado (`sparkeducation-mx.com/sparked/guia.html?demo=historia1`) y vi el cambio, no la copia vieja.
- [ ] Si cambié el dibujo de Sparky: avisé a la principal de sus copias (`sin-internet.html` y `CACHE` de `sw.js`,
  `icono-sparky.mjs`, `img/wa/`, `og-sparky.png`).
- [ ] Mandé a Daniel capturas y aviso (con lo que no pude probar) y anoté en «Lo aprendido» lo nuevo que aprendí.

## Lo aprendido

**Sparky y animaciones**
- (7 nov) Daniel pidió que Sparky «tenga un poquito más de vida» y no parezca «confundido todo el tiempo»: «pensando»
  con «?» ya no sale en ninguna pantalla; sin cachetes rosas, para que se note la lengüita; al tocarlo suena un
  sonidito robótico (solo por un toque de la persona; respeta el silencio de las guías, `sonido.silencio`).
- (7 nov) Sparky «vivo» es el mismo dibujo SVG con grupos `sk-*` que el CSS mueve solo dentro de `.sk-anima`; fuera de ahí
  las poses quedan fijas (los Sparky chicos de los juegos no gastan). `sparkyVivo()`: cada 8–15 s hace algo al azar
  (saluda, camina, escribe el dato, vuela, arregla un dato trabado); mouse encima = saluda; toque = una de 6 reacciones
  (brinco, giro, voltereta con jetpack, risa, corazones, baile).
- (7 nov) Para girar una pieza sobre su eje (hombro, muñeca) se dibuja un `<rect>` invisible centrado en el eje (`giro()`)
  y se usa `transform-box: fill-box; transform-origin: center`: queda igual en Chrome, Safari y Firefox.
- (7 nov) El clic se perdía cuando el dibujo se reemplazaba al cambiar de pose: ahora hay una capa fija `.sk-toque`
  y se escucha `click`.
- (7 nov) Si el navegador no avisa que una animación terminó (pestaña oculta, ahorro de batería), Sparky se quedaba
  flotando: respaldo con `setTimeout(duración + 250 ms)`. Igual en los juegos (`docs/JUEGOS.md` § 3).
- (7 nov) El constructor de la espera no brinca al tocarlo (sus bloques van en el mismo dibujo): festeja, ríe o se enamora.
- (9 nov) Daniel mira el dibujo con lupa: botas con interior recto (§ 28). Cambio de arte = muestra antes/después y su sí.
- Sparky tiene **copias**: `sin-internet.html` (regenerarla y subir `CACHE` en `sw.js`, hoy `v2`), los iconos
  (`node herramientas/icono-sparky.mjs`), las imágenes de WhatsApp (`img/wa/`) y `img/og-sparky.png`.

**Reproductor y juegos**
- (8 nov) Juegos de preguntas: carrera (`formula1`, ciudad, naves, caballos, dragones), enemigos (en lugar de puertas;
  `puertas` queda como alias para guías ya publicadas), montaña, castillo, clavados de pingüino y duelo. Verdadero o
  falso: contra reloj o el perro. `repartir` los reparte con la semilla de la guía, sin repetir tipo ni plantilla;
  el calentamiento siempre es `formula1`; el primer juego del bloque 1 nunca es carrera.
- (8 nov) El personaje (Sparky o princesa guerrera) se elige antes de jugar y se recuerda en `sparked_personaje`.
- (9 nov) «Todo cabe» (§ 29): fotos enteras (nunca `cover` ni círculos), la letra de los juegos baja hasta 70 % (`--fj`), la
  teoría se divide en (1/2), (2/2) y ninguna slide trae barra de desplazamiento.
- El escenario mide 1280 × 720 y `ajustar()` lo escala. La guía se pensó para celular en horizontal: pruebo 844 × 390.
- Todo temporizador pasa por `ctx.luego` / `ctx.raf` y `limpiar()` lo apaga al cambiar de slide; los sonidos se paran con
  `sonido.detenerTodo()` y al ocultarse la pestaña.
- Los textos del reproductor van en el idioma de cada guía (es, en, fr); el selector ES | EN del sitio es otra cosa (`idioma.js`).

**Publicar y trabajar en equipo**
- (10 nov) El reproductor abre la guía con `POST /acceso/<clave>/abrir`. Esa dirección y la apertura no se tocan sin la
  guardia: la prueba de humo la lee del `guia.html` publicado (§ 34).
- (10–11 nov) El navegador guarda cada archivo 10 minutos. El `?v=` de `reproductor.js` en `guia.html` lo salta, pero solo
  para ese archivo: `juegos.js`, `ui.js`, `arte.js`… se importan sin `?v=` (comprobado en el código).
- (7 nov) La carpeta se comparte con otras sesiones: una guardó parte de mi trabajo en su commit (`65e52ba`). Por eso
  `git fetch` y `git status` antes y después, `git commit -- <mis archivos>`, nunca `git add -A`.
- (7 nov) Recursos: Kenney (CC0), LottieFiles (Lottie Simple License), lottie-web y canvas-confetti (MIT); **GSAP no**
  (SparkEd cobra acceso); Rive exporta solo con plan de pago. Hoy el arte y los sonidos son propios (SVG y Web Audio,
  sin archivos). Lo externo: fuentes de Google (`@import` en `base.css`) y fotos de Wikimedia (licencia y crédito en el
  pie de foto). Nunca personajes con derechos: las referencias de Daniel son solo de estilo.
- (7 nov) Palabras de Daniel: «dispositivos»; «7 días de acceso ilimitado a tu guía»; sin coloquialismos (§ 19 y 23).

**Pruebas y entorno**
- Node 24 y Edge sin ventana (no hay Python ni puppeteer). Punto de partida del 11 nov (`sparked/css` y `sparked/js`):
  1 `filter`, 6 `backdrop-filter`, 1 `mix-blend-mode`, 0 `will-change`, 4 `setInterval`, 9 `requestAnimationFrame`,
  69 `@keyframes`; el Sparky constructor corre 9 animaciones a la vez.
- Las capturas del navegador integrado quedan en la ruta que muestra el resultado de la herramienta: las copio al
  scratchpad y las mando con `SendUserFile`. Para fotografiar un instante: `document.getAnimations()` → `a.pause();
  a.currentTime = ms`.
- `probar-guia.mjs` recorre las pantallas pero no juega: los juegos los juego yo (a mano o con `javascript_exec`).

## Pendientes de mi tema
- **Arte 3.0 completo** (§ 20): hoja de 3 o 4 muestras para que Daniel elija y luego aplicarlo a juegos y reproductor. Hoy
  solo están realistas los carros de F1, los caballos y los dragones. ¿Empiezo por las muestras o por juegos nuevos?
- **Rendimiento en celulares modestos:** no hay prueba automática. Propuesta: una copia de `probar-guia.mjs` con CPU lenta
  (`Emulation.setCPUThrottlingRate`) que mida cuadros, y preguntar a Daniel cuál es el celular o iPad más viejo de sus
  alumnos. Si los filtros pesan en iPad, pasar el arte a PNG/WebP prerenderizado (§ 20).
- **`?v=` de los demás módulos:** ¿versionar todos los `import` o usar un solo `?v=`? Lo decide la principal con la guardia.
- **Licencias:** no hay una lista única. Si algún día entra algo externo, crear `docs/LICENCIAS.md` (recurso, fuente, licencia, uso).
- **Sonidos de Sparky:** nadie los ha oído en un iPad o celular (la prueba no tiene bocinas). Pedir a Daniel que los pruebe.
- **«Reducir movimiento»:** el encargo del 7 nov decía «quieto con el parpadeo»; el CSS de siempre apaga también el parpadeo
  (`.vec .led-ojo`) y lo dejé así. ¿Lo confirma Daniel?
- **Documentos con datos viejos:** `docs/SIN-INTERNET.md` dice caché `v1` (el código usa `v2`); `CRITERIOS-FASE-2.md` § 17
  menciona «Buscando materiales…» de la biblioteca, ya retirada; `sparked/js/pixel.js` no lo usa ninguna página (¿borrar?).
- **Tope de 70 % de uso semanal** (regla del 6 nov): ¿sigue vigente? Si sí, lo reviso al empezar y al terminar cada encargo.
