# El equipo de SparkEd

Cada sesión de Claude tiene un tema fijo, un motor fijo y un manual propio en esta carpeta. El manual dice qué le
toca, qué no, cómo recibe y entrega trabajo y qué revisa antes, durante y después. Así nadie improvisa ni adivina.
GitHub no publica esta carpeta (empieza con guion bajo).

| Sesión | Motor | Manual |
|---|---|---|
| Principal («Study Guide Hub») | Fable 5.2 | Coordina, decide entre sesiones, despliega con el sí de Daniel |
| IA de SPARKED | Opus 5.5 | `ia-sparked.md` |
| Motores de Pago para Sparked | Opus 5.5 | `pagos.md` |
| Visuales y Marketing SparkEd | Sonnet 5.5 | `visuales-marketing.md` |
| Animaciones y Juegos | Sonnet 5.5 | `animaciones-juegos.md` |
| Jefe de Seguridad | Opus 5.5 | `seguridad.md` |

La sesión jefe mantiene estos manuales al día con la skill `jefe-de-equipo` (fuente en `_equipo/skill/`, instalada en
la carpeta de usuario de Claude) y anota cada cambio avisado en `CAMBIOS.md`.

## Reglas para todos

1. Al empezar un encargo, lee tu manual. Si el encargo no es de tu tema, dilo y mándalo a la sesión principal.
2. Todo lo que llegue al sitio o al servidor pasa por la guardia (`_guardia/`): `ronda.mjs` antes y después, publicar
   con `lanzar.mjs`. Desplegar el servidor y encender automatizaciones necesita el sí de Daniel, cada vez.
3. Nunca abras el link de una familia, nunca imprimas claves ni datos de clientes, nunca toques la fase 1, nunca le
   escribas a una familia sin el sí de Daniel.
4. A Daniel: español simple, de tú, sin tecnicismos. Primero lo que le importa; después el detalle.
5. El contexto se compacta solo al llegar a ~75 % (ajuste `autoCompactWindow` de Claude Code, 11 nov 2026). Antes de un
   encargo largo, deja anotado en tu manual lo que no debe perderse.
6. Si aprendes algo que cambia cómo trabajas, actualiza tu manual (sección «Lo aprendido») y avísalo al entregar.
