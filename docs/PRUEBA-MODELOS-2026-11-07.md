# Prueba de modelos de IA para las guías SparkEd (7 de noviembre de 2026)

## Para qué sirve esta prueba

Hoy todos los pasos que arman una guía usan el modelo de IA más económico (Haiku). Esta prueba compara qué pasa si
se usa un modelo más potente (Sonnet u Opus) en dos pasos clave:

- **El plan**: decide los bloques de la guía, sus temas y cuántos juegos lleva cada uno.
- **La reparación**: completa las actividades que faltan cuando la revisión automática encuentra huecos.

Se midió cuánto cuesta cada guía, cuánto tarda y si hubo fallas. La calidad se juzgará después, con una evaluación a
ciegas.

## Cómo se hizo

- **Mismo material para las tres guías.** Se usó el inventario (todo lo que la IA ya había leído de las fotos) del
  trabajo `a7bb68a7-71ad-44c5-9963-e3953510aaee`: Inglés, 3° de Secundaria, 6 fotos (hojas de trabajo y páginas de
  libro). Las fotos no se volvieron a leer, así que las tres guías parten exactamente del mismo inventario y la lectura
  no se pagó otra vez.
- **Nota:** el plan original indicaba el trabajo `eed397ce-b23c-42be-a450-69b7709b5ff2`, pero ese número no existe en
  la base de datos. Solo había dos trabajos con inventario; se usó el de Inglés de 3° de Secundaria (el otro era una
  sola foto de Francés de 1°).
- Cada guía se generó **completa** (todos sus bloques), una después de la otra.
- Qué modelo hizo cada paso ("esfuerzo" es cuánto piensa la IA antes de responder: bajo o medio):

| Paso | A (como hoy) | B | C |
|---|---|---|---|
| Leer las fotos | No se repitió (inventario ya leído) | No se repitió | No se repitió |
| Plan | Haiku · bajo | **Sonnet · medio** | **Opus · medio** |
| Escribir los bloques | Haiku · bajo | Haiku · bajo | Haiku · bajo |
| Reparar | Haiku · bajo | **Sonnet · medio** | **Opus · medio** |
| Verificar datos | Haiku · medio | Haiku · medio | Haiku · medio |

- La verificación de datos se dejó con Haiku (esfuerzo medio) en las tres. No se usaron respaldos automáticos de otro
  modelo.
- Regla de seguridad: si Sonnet u Opus tardaban más de 125 segundos, o rechazaban el paso dos veces, ese paso seguía
  con Haiku. **No hizo falta en ninguna variante.**
- Función usada: `sparked` versión 12 (desplegada el 7 de noviembre de 2026; los tres archivos publicados son idénticos
  a los del repositorio).

Un "token" es un pedacito de texto (más o menos tres cuartos de una palabra) que la IA lee o escribe; es la unidad con
la que se cobra. Los pesos se calculan a 18.5 pesos por dólar.

## Medición de velocidad del plan

Antes de las variantes se pidió un solo plan con cada modelo, con el mismo inventario:

| Modelo · esfuerzo | Segundos | Tokens leídos | Tokens escritos | USD | MXN | ¿Plan válido? |
|---|---|---|---|---|---|---|
| Sonnet · medio | 27.4 | 17,657 | 4,111 | 0.0785 | 1.45 | Sí, 3 bloques |
| Opus · medio | 33.2 | 17,657 | 4,005 | 0.1549 | 2.87 | Sí, 5 bloques (el 5.º vino vacío, con título "_") |

Los dos cupieron de sobra en el límite de 125 segundos, así que B y C usaron esfuerzo medio (no hizo falta probar el
esfuerzo bajo). En la guía C real, el plan de Opus salió con 4 bloques y sin el bloque vacío.

## Resultados por variante

| | A · todo Haiku (como hoy) | B · Sonnet en plan y reparación | C · Opus en plan y reparación |
|---|---|---|---|
| Costo de la guía | 0.0385 USD = **0.71 MXN** | 0.1591 USD = **2.94 MXN** | 0.2863 USD = **5.30 MXN** |
| Tokens (leídos + escritos) | 120,432 (52,559 + 67,873) | 112,243 (56,768 + 55,475) | 148,364 (62,459 + 85,905) |
| Tiempo total | 4.6 min | 4.0 min | 6.1 min |
| Segundos del plan | 24.0 | 28.4 | 31.0 |
| Bloques | 3 | 3 | 4 |
| Actividades (juegos + mini-examen) | 51 | 36 | 53 |
| Respuestas cortadas por largo | 1 | 0 | 1 |
| Rechazos de la IA | 0 | 0 | 0 |
| Pasos que cayeron a Haiku | Ninguno | Ninguno | Ninguno |
| Huecos encontrados antes de reparar | 4 | 5 | 2 |
| Páginas no leídas | Ninguna | Ninguna | Ninguna |

El costo no incluye la lectura de las fotos, que se reutilizó. Como referencia, el precio de venta de una guía es de
100 pesos.

### Por paso

| Variante | Paso | Modelo · esfuerzo | Llamadas | Tokens leídos | Tokens escritos | Segundos | USD | MXN |
|---|---|---|---|---|---|---|---|---|
| A | Plan | Haiku · bajo | 1 | 17,657 | 5,590 | 24.0 | 0.0047 | 0.09 |
| A | Escribir bloques | Haiku · bajo | 4 | 20,563 | 59,417 | 232.5 | 0.0310 | 0.57 |
| A | Reparar | Haiku · bajo | 1 | 14,339 | 2,866 | 13.8 | 0.0029 | 0.05 |
| B | Plan | Sonnet · medio | 1 | 17,657 | 4,428 | 28.4 | 0.0817 | 1.51 |
| B | Escribir bloques | Haiku · bajo | 3 | 24,798 | 48,763 | 191.2 | 0.0260 | 0.48 |
| B | Reparar | Sonnet · medio | 1 | 14,313 | 2,284 | 16.5 | 0.0515 | 0.95 |
| C | Plan | Opus · medio | 1 | 17,657 | 3,818 | 31.0 | 0.1511 | 2.80 |
| C | Escribir bloques | Haiku · bajo | 5 | 30,498 | 80,279 | 310.5 | 0.0417 | 0.77 |
| C | Reparar | Opus · medio | 1 | 14,304 | 1,808 | 17.8 | 0.0934 | 1.73 |

La verificación no aparece porque falló antes de empezar en las tres (ver abajo); ese intento no tiene costo.

### Actividades por bloque (juegos + preguntas del mini-examen)

- **A:** "Word formation" 9 + 4 (reducido) · "Habits and change" 14 + 6 · "Reply to an email" 12 + 6.
- **B:** "Word Power and Gapped Text" 8 + 4 · "Habits, Change and Colour Idioms" 9 + 1 · "Listening and Email Writing" 9 + 5.
- **C:** "Word Formation: Build New Words" 7 + 4 (reducido) · "Then and Now: used to / would / be & get used to" 8 + 0
  · "Colour Idioms & Fixed Expressions" 17 + 6 · "Linking Words & Your Informal Email" 6 + 5.

"Reducido" quiere decir que la primera respuesta de ese bloque se cortó por largo y el bloque se pidió otra vez con la
mitad de los juegos.

## Cortes y rechazos

- **Cortes por largo:** A y C tuvieron uno cada una, en el bloque 1. Ese bloque lo escribe Haiku en las tres
  variantes: la respuesta llegó al tope de 20,000 tokens (a los 80 segundos aproximadamente), el sistema la pidió otra
  vez con la mitad de los juegos y salió bien. Depende de cuántos juegos pidió el plan para ese bloque.
- **Rechazos:** ninguno. Ningún paso pasó de 125 segundos y ninguno cayó a Haiku.

## Hallazgo: la verificación de datos falló en las tres guías

El paso que revisa los datos en internet (Haiku) no corrió en ninguna variante. La IA respondió con el error 400
*"The following domains are not accessible to our user agent: ['bbc.co.uk', 'fundeu.es']"*: dos sitios de la lista de
fuentes confiables (`DOMINIOS_CONFIABLES` en `funciones/sparked/prompts.ts`) no los puede consultar la IA, y por eso
rechaza toda la búsqueda. Las guías salen de todos modos, pero sin verificación (su reporte dice "error").

No se corrigió durante la prueba, para que las tres variantes fueran comparables. Este problema ya existía y afecta a
toda guía completa. Arreglo sugerido: quitar `bbc.co.uk` y `fundeu.es` de esa lista.

## Links de las guías

- **A** (todo Haiku): https://sparkeducation-mx.com/sparked/crear.html?clave=cBcFHNfLqpYm3pdRmExxdMfm
  · guía `3be0b51a-4025-433b-9cf3-e4e13f8bc894` · trabajo `03a3e6aa-84f9-476f-a222-f79c7e67d80a`
- **B** (Sonnet): https://sparkeducation-mx.com/sparked/crear.html?clave=ayaxLVbwmPfw7ScuFUCYf73f
  · guía `dfcb7452-bbc1-4e75-a65b-b7f72f0df18d` · trabajo `e5facd93-2a84-4936-99ac-4093acca4fb5`
- **C** (Opus): https://sparkeducation-mx.com/sparked/crear.html?clave=BH4jWuCeaueGEPqydQvcPqzF
  · guía `72d84e41-880a-46b3-a6a0-dc0d473b05a4` · trabajo `148355a9-9aec-4eb7-88fe-93424d73c8b1`

Estos links muestran la **vista previa** (portada, primeras pistas y algunos juegos del bloque 1), como la ve una
familia antes de pagar.

**Para ver la guía completa:** abre el panel de SparkEd (https://sparkeducation-mx.com/sparked/panel.html) → pestaña
«Biblioteca» → en el filtro elige «Personalizadas (Servicio 2)» → busca las guías cuyo título empieza con
«[Prueba A]», «[Prueba B]» y «[Prueba C]» → botón **«👁 Ver como profesor»**.

Las tres quedaron como guías personalizadas publicadas: no aparecen en la búsqueda pública de la biblioteca. El
repositorio es público, así que estos links los puede ver quien abra el repositorio; son guías de prueba, sin datos de
ninguna familia. Cuando termine la evaluación se pueden borrar desde el panel.

## Calidad

**Pendiente: evaluación a ciegas.** Las tres guías se exportaron con letras al azar (X, Y y Z), sin decir qué modelo
hizo cada una; la correspondencia quedó guardada aparte.

**Advertencia:** es una sola corrida por variante. La IA no responde igual dos veces, así que las diferencias pequeñas
(por ejemplo, 36 contra 51 actividades, o 4 contra 6 minutos) pueden deberse al azar y no al modelo.

## Gasto de la prueba

| Concepto | USD | MXN |
|---|---|---|
| Medición del plan con Sonnet | 0.0785 | 1.45 |
| Medición del plan con Opus | 0.1549 | 2.87 |
| Guía A | 0.0385 | 0.71 |
| Guía B | 0.1591 | 2.94 |
| Guía C | 0.2863 | 5.30 |
| **Total** | **0.7173** | **13.27** |

Tope autorizado: 30 MXN (1.62 USD). Se usó el 44 %.

## Archivos de la prueba

En la computadora de Daniel, carpeta temporal
`C:\Users\Daniel\AppData\Local\Temp\claude\5a751cd807121552\6065fdad-5017-4f78-9973-7bab005c17d8\scratchpad\prueba-modelos\`:

- `metricas.json`: todas las mediciones, por variante y por llamada a la IA.
- `guia-X.json`, `guia-Y.json`, `guia-Z.json`: las tres guías para la evaluación a ciegas.
- `mapa.json`: qué letra es cada variante (no abrir antes de evaluar).
- `inventario.json`: el inventario común de las tres guías.

## Qué cambió en el código

- `funciones/sparked/pipeline.ts`: modelo y esfuerzo por paso (por defecto, lo de hoy), precios de Opus, registro de
  costo y tiempo de cada llamada a la IA, la regla de seguridad de Sonnet y Opus, y la medición del plan.
- `funciones/sparked/index.ts`: 10 ajustes nuevos (`sparked_modelo_*` y `sparked_esfuerzo_*`, por defecto Haiku como
  hoy), las rutas de administrador `POST /admin/pruebas/plan` y `POST /admin/pruebas/generar`, el título
  «[Prueba X]» y las métricas en el reporte de cada guía.
- Para las familias no cambia nada: mientras no se cambien esos ajustes, todo sigue con Haiku como antes.
