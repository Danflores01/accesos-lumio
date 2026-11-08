# Juego "Duelo" (7 nov 2026)

Pelea por rounds al estilo de los juegos de lucha: Sparky con casco y espada (izquierda) contra un dragón (derecha), cada
uno con su barra de vida. La pregunta y sus opciones van a la derecha de la arena.

- **Acierto:** Sparky ataca con la espada y el dragón pierde vida.
- **Error o tiempo agotado (20 s por pregunta):** el dragón echa fuego y Sparky pierde vida.
- **Vidas:** el dragón cae con el 60 % de aciertos (5 preguntas → 3 golpes); Sparky aguanta el resto + 1 (5 preguntas → 3 fallos).
- **Fin del round:** K.O. de alguno, o se acaban las preguntas (gana quien conserve más vida).
- **Victoria:** "¡Venciste al dragón!". **Derrota:** "¡Revancha!", un mensaje para repasar y el botón "Repasar la pista"
  (lleva a la pista de la primera pregunta fallada). "Jugar de nuevo" abre el round siguiente con las preguntas revueltas.
- **Calificación:** cada pregunta se registra en `ctx.resultados` con su `id`, igual que en opción múltiple (solo cuenta
  el primer intento). Con un K.O. temprano, las preguntas que no salieron quedan sin contestar, igual que en el castillo.

## Formato del contenido (sin cambios de esquema)

Las preguntas son **actividades `opcion_multiple` normales** (también sirve `completar`), con los mismos campos de siempre:

```json
{ "id": "b6om1", "tipo": "opcion_multiple", "pregunta": "¿En qué año llegó Cristóbal Colón a América?",
  "opciones": ["1453", "1492", "1519", "1521"], "correcta": 1, "pista": "b6p1", "dificultad": "facil", "emoji": "⛵",
  "retro_correcta": "¡Sí! …", "retro_incorrecta": "No exactamente: la respuesta es «1492». …" }
```

Lo único nuevo es **un campo opcional en el bloque**: `"juego": "duelo"`. Si el bloque lo trae, sus preguntas de
opción múltiple (y completar) se juegan como duelo en lugar de la carrera, las puertas, la montaña o el castillo que le
tocaba por rotación. El calentamiento nunca se vuelve duelo.

```json
{ "id": "b6", "titulo": "El encuentro de dos mundos", "juego": "duelo", "pistas": [ … ], "actividades": [ …opcion_multiple… ], "mini_examen": [] }
```

## Cuándo conviene usarlo

- Bloques de **repaso o cierre**, o temas con **personajes, batallas o conflictos** (conquistas, guerras, revoluciones).
- Entre **4 y 8 preguntas** (lo ideal son 5): con menos el round dura muy poco; con más se alarga.
- Preguntas **claras con una sola respuesta correcta**; las fáciles y medias funcionan mejor que las retadoras.
- Una vez por guía, como mucho dos, para no repetir.

## Dónde está

- Lógica y textos (es, en, fr): `sparked/js/juegos.js`, función `duelo` y `TEXTOS_DUELO`.
- Arte: `sparked/js/arte.js` (`escenaDuelo`, `capaDragonDuelo`, `dragonDuelo`, Sparky con `"+yelmo+espada"` y pose `decidido`).
- Estilos y animaciones: `sparked/css/duelo.css` (enlazada en `sparked/guia.html`).
- Ejemplo: bloque 6 de `sparked/ejemplos/historia1.json` (`guia.html?demo=historia1`, slide 40).

## Pendiente para integrarlo de forma nativa

Hoy el duelo entra porque `carrera`, `puertas`, `montana` y `castillo` lo detectan (`esDuelo`) y le pasan la slide.
Para que sea un juego más del estante: en `cartucho.js` (armarSlides) emitir `k: "duelo"` cuando `b.juego === "duelo"`
(con título `⚔️ …`) y, si se quiere, sumarlo a la rotación `quizJuegos`; en `reproductor.js` añadir `duelo: J.duelo` al
mapa `R`. Los textos pueden pasar a `TEXTOS` del cartucho (`instr_duelo`).
