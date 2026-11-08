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
