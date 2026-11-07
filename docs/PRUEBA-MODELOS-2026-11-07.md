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

## Verificación de datos: falló en las tres guías; ya se arregló y se probó

**El problema.** El paso que revisa los datos en internet (Haiku) no corrió en ninguna variante. La IA respondió con el
error 400 *"The following domains are not accessible to our user agent: ['bbc.co.uk', 'fundeu.es']"*: dos sitios de la
lista de fuentes confiables no los puede consultar el buscador de la IA, y por eso rechazaba toda la búsqueda. Las
guías salían de todos modos, pero sin verificación. El problema ya existía antes de la prueba y afectaba a toda guía
completa; no se corrigió a mitad de la prueba para que las tres variantes fueran comparables.

**El arreglo.** Se quitaron `bbc.co.uk` y `fundeu.es` de `DOMINIOS_CONFIABLES` en `funciones/sparked/prompts.ts` (el
error solo mencionaba esos dos). La función en vivo quedó en la versión 15, idéntica byte a byte al repositorio.

**La prueba.** La guía A se volvió a generar desde el bloque 1 (escribir con Haiku, como hoy) con la versión 15. Esta
vez la verificación sí corrió, sin errores:

- Revisó **6 datos**: 4 verificados, 1 corregido y 1 que contradice el libro (ese se manda a revisión humana y no se
  cambia nada).
- Hizo **4 búsquedas** en internet. El número se calculó con su costo: cada búsqueda cuesta 1 centavo de dólar, y con
  los tokens que usó solo cuadran 4.
- Costo de la verificación: **0.0532 USD = 0.98 MXN** (de eso, 0.74 MXN son las búsquedas), en 54.6 segundos.
- El dato corregido: los apuntes decían que "Word formation" es la parte 1 del examen; según Cambridge es la parte 3.
  El que contradice el libro: la tarea del correo pide 100 a 120 palabras y la foto menciona 140 a 190.
- Detalle para revisar después (no se cambió): cuando una corrección no corresponde a ninguna actividad ni pista (aquí
  era un dato del inventario), el sistema la pega en la primera pista de cada bloque, así que el alumno la ve 3 veces.
  Además, esa corrección habla del formato del examen, que la guía no debería enseñar.
- Toda esta nueva corrida de la guía A (escribir 3 bloques, reparar y verificar) costó **0.0767 USD = 1.42 MXN** y
  tardó 3.7 minutos.

## Arreglo: juegos de clasificar con un grupo vacío

- **Lo encontró** la evaluación a ciegas en las tres guías: cada juego de clasificar tenía 3 grupos, pero uno salía
  sin tarjetas.
- **La causa** (confirmada con los datos de las tres guías): la IA armó 3 grupos numerados 0, 1 y 2 (por ejemplo,
  "sufijos de sustantivo", "sufijos de adjetivo" y "prefijos negativos"). El reproductor solo muestra 2 grupos, y la
  revisión automática solo dejaba las tarjetas de los grupos 0 y 1: borraba todas las del tercero, que quedaba vacío.
  No era que la IA numerara desde 1 ni que pusiera el nombre del grupo: todas las tarjetas que quedaban eran del grupo
  0 o del 1.
- **El arreglo**, en `funciones/sparked/pipeline.ts`: en cuanto se escribe cada bloque (también en la vista previa),
  cada juego de clasificar queda con 2 grupos. Si la IA hizo 3, se quedan los 2 con más tarjetas; también se aceptan
  grupos numerados desde 1 o escritos con su nombre. La revisión ya no deja pasar un juego con un grupo sin tarjetas. El
  reproductor no se tocó.
- **Resultado** en la guía A regenerada: su único juego de clasificar quedó con 2 grupos ("Noun suffix" y "Adjective
  suffix") y 3 tarjetas en cada uno.
- **Lo que se pierde:** si la IA arma un tercer grupo, sus tarjetas no se usan. Para conservarlas habría que enseñar al
  reproductor a mostrar 3 grupos (`sparked/js/juegos.js`, función `sort`, que hoy usa solo los 2 primeros grupos).

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

**Ojo con la guía A:** se volvió a generar después de la evaluación, para probar los dos arreglos; su link y el panel
muestran ya la versión nueva (52 actividades, con verificación). La versión que se calificó está guardada en
`guia-X.json`. En el panel su costo aparece sumado dos veces (0.1537 USD); el real es 0.1152 USD (0.0385 de la primera
corrida más 0.0767 de la segunda).

## Calidad (evaluación a ciegas)

Una revisión aparte calificó las tres guías sin saber qué modelo hizo cada una: las recibió con letras al azar (X, Y y
Z) y revisó, una por una, todas las actividades y preguntas contra el inventario. Aquí ya están traducidas a A, B y C.
Escala de 1 (muy mal) a 5 (muy bien); en "errores visibles", 5 quiere decir sin errores.

| Punto (de 1 a 5) | A · todo Haiku | B · Sonnet | C · Opus |
|---|:-:|:-:|:-:|
| Cobertura de los apuntes | 2 | 4 | 4 |
| Exactitud | 2 | 5 | 3 |
| Orden de los temas (el plan) | 4 | 3 | 5 |
| Variedad y pertinencia de los juegos | 3 | 4 | 3 |
| Claridad para 3° de secundaria | 3 | 4 | 4 |
| Errores visibles | 3 | 3 | 2 |
| **Total (de 30)** | **17** | **23** | **21** |

| Otros datos de la revisión | A | B | C |
|---|:-:|:-:|:-:|
| Partes de los apuntes que toca (de 6) | 3 | 6 | 4 |
| Preguntas que llegaron, contra las planeadas | 81 % | 63 % | 69 % |
| Errores graves de respuesta | 2 | 0 | 1 |
| Errores moderados | 3 | 0 | 3 |

- **B fue la mejor, pero por poco** (23 contra 21 de C): ninguna respuesta equivocada y toca las 6 partes de los
  apuntes. Su punto débil es que es la más corta (36 actividades) y su bloque 2 quedó con muy pocas preguntas.
- **C** es la más completa, la mejor ordenada y la más parecida al examen, pero tiene un error grave que el alumno vería
  tres veces, un bloque sin mini-examen y muchas preguntas repetidas sobre los mismos "idioms".
- **A queda claramente atrás**: dos errores graves, deja fuera una parte completa del examen y repite mucho.

### Los errores más serios

1. **A:** en "I'm ___ getting up early" marca como correcta "be used to" (quedaría "I'm be used to getting up early").
   Sale también en el calentamiento y en el reto final.
2. **A:** la respuesta modelo "Because I'm busy this week, so I can't come." está mal: no se usan "because" y "so"
   juntos.
3. **C:** en "Ben is very ___. He never tells lies. (HONEST)" marca "dishonest", lo contrario de lo que dice la
   oración, y "honest" ni siquiera está entre las opciones. Sale también en el calentamiento y en el reto final.
4. **A** deja fuera toda la parte de expresiones fijas e "idioms", aunque su propio plan la marcaba como punto difícil.
5. **C:** el bloque 2 salió sin mini-examen y sin preguntas de opción múltiple. **B:** el bloque 2 tiene un mini-examen
   de una sola pregunta.
6. **En las tres:** los juegos de clasificar tenían un grupo sin tarjetas, y la verificación de datos no corrió. Las
   dos cosas ya se arreglaron (ver abajo).

Las preguntas con errores las escribió Haiku en las tres variantes (el paso "escribir" no cambió); el modelo del plan
decide qué temas entran y cómo se ordenan, no cómo se redacta cada pregunta.

**Advertencia:** es una sola corrida por variante. La IA no responde igual dos veces, así que las diferencias pequeñas
(por ejemplo, 23 contra 21 puntos, o 4 contra 6 minutos) pueden deberse al azar. Entre B y C la diferencia no es
segura; entre ellas dos y A sí es clara, aunque también viene de una sola corrida.

## Recomendación por paso (la decide Daniel)

**Los valores por defecto en producción no cambiaron:** todo sigue con Haiku, como antes de la prueba. Lo que sigue es
solo una recomendación; la decisión es de Daniel. Como es una sola corrida por variante, conviene confirmarla con 2 o
3 corridas más antes de cambiar algo.

| Paso | Recomendación | Costo por guía | Razón |
|---|---|---|---|
| Leer las fotos | Haiku · medio (como hoy) | menos de 0.55 MXN | No se probó otro modelo y leyó las 6 fotos sin perder ninguna. |
| Plan | **Sonnet · medio** | 1.51 MXN | Cubrió todas las partes de los apuntes (con Haiku faltó una completa) y su guía fue la mejor calificada. Opus ordenó mejor los temas, pero cuesta casi el doble (2.80 MXN) y dos veces dejó un bloque vacío en su plan. |
| Escribir los bloques | Haiku · bajo (como hoy) | 0.5 a 0.8 MXN | Es el paso que más escribe: con Sonnet costaría unos 10 pesos más por guía y podría pasarse del tiempo límite. Los errores de respuesta salieron de este paso, así que conviene probarlo aparte más adelante. |
| Reparar | **Sonnet · medio** | 0.95 MXN | Se probó junto con el plan en la guía mejor calificada y cuesta menos de un peso. |
| Verificar | Haiku · medio (como hoy) | 0.98 MXN | Ya funciona: en la prueba revisó 6 datos con 4 búsquedas. Puede subir hasta unos 2 pesos si usa las 10 búsquedas permitidas. |
| **Total** | | **cerca de 4.5 MXN** | Con todo Haiku y la verificación funcionando serían cerca de 2.2 MXN. El precio de venta de una guía es de 100 pesos. |

## Gasto de la prueba

| Concepto | USD | MXN |
|---|---|---|
| Medición del plan con Sonnet | 0.0785 | 1.45 |
| Medición del plan con Opus | 0.1549 | 2.87 |
| Guía A | 0.0385 | 0.71 |
| Guía B | 0.1591 | 2.94 |
| Guía C | 0.2863 | 5.30 |
| Nueva corrida de la guía A (prueba de los arreglos) | 0.0767 | 1.42 |
| **Total** | **0.7940** | **14.69** |

Tope autorizado: 30 MXN (1.62 USD). Se usó el 49 %.

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
- `funciones/sparked/prompts.ts`: se quitaron `bbc.co.uk` y `fundeu.es` de la lista de fuentes confiables, para que la
  verificación de datos funcione.
- `funciones/sparked/pipeline.ts`: los juegos de clasificar quedan siempre con 2 grupos y tarjetas en los dos.
- Función en vivo: `sparked` versión 15, idéntica byte a byte al repositorio.
- Para las familias no cambia nada más: mientras no se cambien los ajustes de modelo, todo sigue con Haiku como antes.
