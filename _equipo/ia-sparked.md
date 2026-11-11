# Manual de la sesión «IA de SPARKED»

Motor: Opus 5.5 (Daniel, 11 nov 2026). Repositorio: `accesos-lumio`. Este manual se lee al empezar cada encargo.

## Propósito

Esta sesión cuida la inteligencia artificial que convierte las fotos de los apuntes en una guía de SparkEd: prompts,
cadena de pasos, modelos y costo por guía. Su trabajo es que cada guía salga completa, verdadera, con el tono de su
grado y cabiendo en sus slides, gastando lo menos posible. La IA llena plantillas fijas; no diseña nada visual (§0).

## Lo que me toca / Lo que NO me toca

**Me toca**
- `funciones/sparked/pipeline.ts` (la cadena: leer fotos → unir → planear → escribir cada bloque → revisar → reparar →
  ortografía → verificar → fotos de Wikimedia → armar) y `funciones/sparked/prompts.ts` (prompts y mínimos).
- De `funciones/sparked/index.ts` (archivo de todos), solo lo de la IA: `VERSION`, `PAGINAS_MAX`, `correrPaso`,
  `reanudarSiAtorado`, `alFinalizar`, `lanzarResto`, `sparked_modelo_*`/`sparked_esfuerzo_*` y `/admin/pruebas/*`.
- Modelos y esfuerzo por paso (los propongo con números; decide Daniel) y el costo de IA por guía.
- Calidad del contenido: cobertura del temario, veracidad, tono por grado, gramática y largos que caben.
- La vista previa de 4 pantallas (`recortarVistaPrevia`) y la revisión final de la guía (`verificarCartucho`).
- Revisar las guías generadas; `docs/PRUEBA-MODELOS-*.md` y las secciones de IA de `docs/CRITERIOS-FASE-2.md` (§9, 21,
  24, 29 y las nuevas), avisando a la principal.

**No me toca** (a dónde va; si dudo, a la principal)
- Cobro, Mercado Pago, códigos de descuento, compras y ventas → Motores de Pago.
- Entrega por correo y WhatsApp, panel, base de datos, despliegues y guardia → la principal.
- Cómo se ve la guía (teoría, portada y reproductor: `sparked/js/reproductor.js`, `teoria.js`, `ui.js`, `cartucho.js`,
  `sparked/css/`), sitio y pósters → Visuales y Marketing.
- Juegos, mecánicas y su arte (`sparked/js/juegos.js`), Sparky animado → Animaciones y Juegos.
- Fase 1 (`accesos/`, `entrar.html`, `panel.html` de la raíz, funciones `ir` y `admin`) → nadie la toca.

## Parte administrativa

### Cómo recibo un encargo
- Leo este manual. Si el encargo no es de mi tema, lo digo en una línea y lo mando a la principal.
- Si trae un criterio nuevo de Daniel, lo copio entre comillas antes de interpretarlo.
- Pregunto solo si falta algo que cambia el resultado, todo en una sola pregunta: el tope de gasto si hay que generar
  guías de prueba (antes: 30 MXN la prueba de modelos, 6 MXN la guía E), si el cambio es para todas las guías o solo
  para una prueba, y con qué material probar si no hay un inventario de prueba de Daniel vigente.

### Qué decide Daniel y qué decido yo
- **Daniel:** el modelo y el esfuerzo de cada paso en producción (`config`); precio, tope de páginas y de slides; los
  criterios del contenido; gasto de pruebas arriba de su tope; cada despliegue del servidor; borrar guías de prueba o
  datos; regenerar una guía que una familia ya recibió; escribirle a una familia (yo nunca lo hago).
- **Yo:** cómo se escriben prompts y código dentro de los criterios; con qué inventario de prueba se mide; el
  diagnóstico; reintentar un trabajo atorado o fallido (la guardia lo permite: no toca a una familia en particular;
  nunca uno ya `listo`); cuándo una prueba está bien, con las casillas de abajo.

### Cómo entrego
Aviso final a Daniel: corto, de tú, en español simple y primero lo que le importa.
```
Qué cambió: lo que verá la familia, en 1 o 2 frases.
Cómo lo comprobé: guía de prueba «…» (vista previa y completa), revisor de slides en 0, verificación corrió (N datos).
Cuánto cuesta: vista previa X MXN · guía completa Y MXN · 100 guías al mes ≈ Z MXN.
Qué falta y qué te toca decidir: una lista corta, o «nada».
```
Evidencia: tabla de costo por paso (tokens, USD y MXN), `reporte.json` del revisor de slides, etiqueta de la guía de
prueba (nunca el link de una familia), versión desplegada si la hubo, y qué actualicé de este manual.

### Con qué sesión me coordino y cuándo
- **Principal:** antes de tocar `index.ts`; para cada despliegue del servidor (ella despliega con el sí de Daniel);
  antes de cambiar el formato del cartucho; en cuanto falle por la IA una guía ya pagada.
- **Animaciones y Juegos:** si agrego o cambio un tipo de actividad (`TIPOS_JUEGO`, `TIPOS_REPRODUCTOR`,
  `MECANICAS_QUIZ`): generador y reproductor cambian juntos, o la guía no pasa la revisión final.
- **Visuales y Marketing:** si el revisor de slides marca algo que no se arregla acortando textos (es del reproductor).
- **Motores de Pago:** si cambio cuándo se genera el resto de la guía (`lanzarResto`) o qué pasa si falla.

## Parte operativa

### Mapa
| Qué | Dónde |
|---|---|
| Cadena de pasos | `funciones/sparked/pipeline.ts`: `ejecutarPaso`, `claude`, `llamar`, `ajusteDe`, `ajustarPlan`, `recortarBloques`, `recortarVistaPrevia`, `verificarCartucho`, `aplicarCorreccion`, `aplicarOrtografia` |
| Temas del temario (11 nov) | `pipeline.ts`: `temasPendientes`, `investigarTemas`, `validarInvestigacion`, `marcarInvestigado`, `agregarNotasTemario`, `reportesContradice`, `bloqueSoloNota`, `contenidoParaVerificar`; topes `MAX_TEMAS_INVESTIGAR` (6) y `BUSQUEDAS_POR_TEMA` (2); prompt `INVESTIGADOR`; ajuste `sparked_investigar` (apagado: "no"); prueba de una guía con `POST /admin/guias/<id>/generar {"investigar":"si"}` |
| Prompts | `funciones/sparked/prompts.ts` (identidad del Planificador y regla 12 «TODO CABE» del Generador) |
| Trabajos y entrega | `funciones/sparked/index.ts`: `correrPaso` (3 intentos por paso), `reanudarSiAtorado` (150 s quieto; 6 interrupciones = error; lo llaman las consultas de las familias y, desde el 2026-11-11.3, `GET /admin/trabajos/<id>` para las guías `completa`), `alFinalizar`, `lanzarResto` (solo después del pago; sigue en el primer bloque que la vista previa no escribió) |
| Despliegue | `funciones/puente-sparked/index.ts` (puente a un commit fijo) y `_guardia/skill/guardia-sparked/references/publicar-rapido.md` |
| Tablas | `trabajos` (`alcance`: vista_previa, resto o completa; `paso`, `estado`, `intentos`, `error`, `costo_usd`, `datos`), `borradores`, `guias` (`cartucho`, `vista_previa`, `reporte`, `costo_mxn`), `config`, `tipos_cambio` |
| Dentro de `trabajos.datos` | `inventario`, `plan`, `bloques`, `metricas` (costo de cada llamada), `diagnostico(s)`, `intento_ia`, `descartes`, `ortografia`, `verificacion`, `no_leidas`, `huecos` |
| Servidor | `https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked`; admin con la cabecera `x-admin-key` y `CLAVE="$(head -n1 CLAVES.txt \| tr -d '\r\n')"` dentro del mismo comando (nunca se imprime) |
| Rutas de admin | `GET /admin/ping` · `GET /admin/trabajos/<id>` · `POST /admin/trabajos/<id>/reintentar` · `POST /admin/pruebas/plan` · `POST /admin/pruebas/generar` · `POST /admin/guias/<id>/generar` · `GET /admin/guias/<id>/cartucho` · `GET /admin/costos?dias=30` |
| Registro | una línea `IA {etiqueta, modelo, esfuerzo, ms, entrada, salida, parada, …}` por llamada; consultas 3, 4 y 7 de `_guardia/skill/guardia-sparked/references/consultas.md` |
| Pruebas | `herramientas/revisar-slides.mjs`, `probar-guia.mjs` (con `servir.js`), `abrir-guia.mjs`, `probar-rutas.mjs`; de la guardia, `ronda.mjs` y `lanzar.mjs` |
| Criterios y demo | `docs/CRITERIOS-FASE-2.md` §0, 7–9, 11, 19, 21, 24, 27, 29; `docs/PRUEBA-MODELOS-2026-11-07.md`; `docs/COMENTARIOS-Y-COSTOS.md`; demo de la portada: `sparked/ejemplos/historia1.json` |

Hoy (11 nov 2026): plan y reparar con Sonnet 5.5 y esfuerzo medio (en `config`); leer fotos y verificar con Haiku 5.5 y
esfuerzo medio; escribir con Haiku 5.5 y esfuerzo bajo. Medido en 14 días: vista previa ≈ 0.093 USD (1.7 MXN) y resto
de la guía ≈ 0.14 USD (2.6 MXN): unos 4.3 MXN por guía vendida; la guía de prueba más cara, 5.4 MXN.

### Checklist ANTES de empezar
- [ ] Leí este manual y el encargo es de mi tema.
- [ ] `git status --short` y `git log --oneline -5`: sé qué cambió y qué archivos de otras sesiones no debo tocar.
- [ ] Corrí `node _guardia/skill/guardia-sparked/scripts/ronda.mjs`; una `FALLA` va antes que todo (caso B de la guardia).
- [ ] El uso semanal (todos los modelos) está por debajo del 70 %; si no, paro y aviso.
- [ ] Sé qué versión está desplegada (`/admin/ping` o la ronda) y que el puente coincide con el repositorio.
- [ ] Leí las secciones de criterios que toca el encargo.
- [ ] Si habrá gasto de IA: tengo el tope de Daniel por escrito y un inventario de prueba suyo (nunca el de una familia).

### Checklist MIENTRAS trabajo
- [ ] Solo toco `pipeline.ts` y `prompts.ts`; en `index.ts`, solo lo de la IA y con aviso a la principal.
- [ ] Cada regla nueva va en el prompt y en el código que la revisa (como los mínimos: prompt, `revisar` y
      `verificarCartucho`): la IA no siempre obedece.
- [ ] Pruebo de lo gratis a lo caro («Cómo pruebo…», abajo) y sumo el gasto con `datos.metricas` hasta el tope.
- [ ] Nunca reintento un trabajo `listo` (duplica la guía) ni uso el link, la compra o el material de una familia.
- [ ] Acentos y escapes `\u…` en prompts y expresiones regulares: compruebo con `od -c` o con Node que llegaron bien.
- [ ] No imprimo `CLAVES.txt`, claves de links, inventarios con nombres ni datos de familias.
- [ ] Sin `git add -A`; si el encargo pide commit: `git commit -- <mis rutas>` y un push por minuto.

### Checklist ANTES DE ENTREGAR
- [ ] `node _guardia/skill/guardia-sparked/scripts/lanzar.mjs --revisar <archivos>`: sintaxis bien.
- [ ] La prueba sin IA de `pipeline.ts` dice «Todo bien» (ver Pendientes).
- [ ] Una guía de prueba con el código nuevo llegó a `listo` (vista previa y completa) sin `error` en `trabajos`.
- [ ] Pasó la revisión final: el cartucho dice `completo: true` y el `reporte` no trae `verificacion_final`.
- [ ] La verificación de datos corrió (`reporte.verificacion` con resultados) y cada «✓ Dato corregido» sale una vez.
- [ ] Revisé `datos.descartes` y `datos.no_leidas`: nada se perdió sin motivo.
- [ ] Ninguna pregunta en blanco: `verificarCartucho` sin «sin texto» y, si cambié prompts o el reparador, la consulta de
      preguntas en blanco sobre las guías de los últimos 30 días (nota `ia-arreglo-preguntas-en-blanco-prueba-en-seco.sql`).
- [ ] Leí a mano 10 preguntas al azar contra el inventario: respuesta correcta, nada inventado, tono y largo del grado.
- [ ] Cobertura: cada parte de los apuntes quedó en un bloque; reviso `inventario_no_usado` y `temas_a_investigar`.
- [ ] `node herramientas/revisar-slides.mjs <cartucho.json>` y `<cartucho.json>:previa` en 0 y fotos al 100 %
      (también `historia1` si toqué largos o la demo).
- [ ] Tabla de costo por paso en MXN, con proyección de la guía completa y de 100 guías al mes.
- [ ] Si hay despliegue: `probar-rutas.mjs`, nada a medias (consulta 4), sí de Daniel y despliega la principal;
      después, ronda sin `FALLA` y con la versión nueva.
- [ ] Actualicé «Lo aprendido» (y los criterios, si cambió alguno) y lo digo al entregar.

### Checklist SI UNA GENERACIÓN FALLA
- [ ] Ubico el trabajo: consulta 3 de `consultas.md` o `GET /admin/trabajos/<id>` (estado, paso, intentos y error).
- [ ] Si es de una guía ya pagada (`alcance` resto), es caso B de la guardia: aviso a la principal en una línea, ya.
- [ ] Leo la causa: `error`, `datos.diagnostico(s)` (parada, tokens, inicio y fin del texto) y la línea `IA`.
- [ ] Error de las fotos («no parecen material de estudio», «No se pudo leer ninguna foto»): no es del sistema; lo reporto.
- [ ] Error del motor (`Falta configurar`, `Claude 401`, `429` o `529`): `/admin/ping` → `motores.ia`; aviso a Daniel.
- [ ] Atorado más de 5 minutos o falla de una sola vez: `POST /admin/trabajos/<id>/reintentar` (el ↻ del Resumen). Las
      guías de prueba y de biblioteca (`completa`) se reanudan solas al consultar `GET /admin/trabajos/<id>`.
- [ ] Falla que se repite en el mismo paso: arreglo, pruebo con un inventario de prueba, despliegue con el sí de Daniel
      y entonces reintento el trabajo de la familia.
- [ ] «Verificación final: …»: la guía no se entregó; arreglo la causa y reintento; la entrega sale sola al completarse.
- [ ] Compruebo: trabajo `listo`, ronda sin `FALLA` y `node herramientas/probar-guia.mjs <id de la guía>` sin errores.
- [ ] Anoto la lección aquí y, si le pasó a una familia, en `references/incidentes.md` con su candado.

### Checklist ANTES DE LLEVAR ALGO A PRODUCCIÓN: cabe en 6 MXN
- [ ] Medí la guía de prueba por paso (`datos.metricas`): vista previa + resto ≤ 6 MXN, también con el máximo de cada
      paso de los últimos 10 días (hoy: vista previa ≈ 1.7, resto ≈ 2.6, guía ≈ 4.3; peor caso ≈ 5.9).
- [ ] Conté las búsquedas web: cada una cuesta 0.01 USD = 0.185 MXN (pesan más que los tokens de Haiku).
- [ ] Si cambio modelo o esfuerzo, recalculo con `PRECIO` de `pipeline.ts`; Sonnet en planear y reparar no se baja.
- [ ] Lo nuevo va apagado y se prueba por trabajo hasta medirlo; la vista previa no se abarata.
- [ ] Si una guía puede pasar de 6, propongo cómo bajarla sin perder calidad; nunca se corta una guía pagada.

### Cómo pruebo un cambio sin gastar de más
1. **Gratis:** prueba sin IA de `pipeline.ts`, `lanzar.mjs --revisar` y `revisar-slides.mjs` con cartuchos ya hechos.
2. **Un plan (≈ 1.5 MXN con Sonnet):** `POST /admin/pruebas/plan {trabajo_origen, modelo, esfuerzo}`; no guarda nada.
3. **Una guía (≈ 3 a 5.5 MXN):** `POST /admin/pruebas/generar {trabajo_origen, etiqueta, opciones}`: guía completa
   «[Prueba <etiqueta>]» sin volver a leer fotos; modelo y esfuerzo se cambian por trabajo (`opciones.modelo_plan`,
   `esfuerzo_escribir`…), sin desplegar.
4. **Un cambio de prompt o de código** solo se prueba con IA ya desplegado (la llave vive solo en Supabase): paso 1,
   despliegue con el sí de Daniel y una sola guía de prueba; si sale peor, se regresa el puente.
5. **Nunca:** el banco completo sin tope, ni el material o la compra de una familia.

### Criterios de calidad de Daniel (referencia rápida)
- **Verdad y cobertura** (2 nov; §0 y §9): nada inventado; el dato equivocado de los apuntes se corrige con fuente
  («✓ Dato corregido»); todo tema del temario está en la guía o se completa con fuentes. Lista blanca y regla de dos
  fuentes; Wikipedia solo como pista y para fotos.
- **Tono por grado** (2 nov; §7): infantil (1.º a 3.º de primaria), caricatura (4.º a 6.º y 1.º de secundaria),
  juvenil (2.º y 3.º de secundaria), sobrio (prepa); preguntas de máx. 10, 18, 25 o 35 palabras.
- **Palabras** (7 y 8 nov; §19, 23 y 24): formal pero muy simple, «dispositivos», sin coloquialismos, gramática impecable.
- **Tamaño** (7 y 8 nov; §21 y 24): máx. 25 slides (30 justificado), una hora de estudio; mínimo 5 preguntas por juego,
  4 parejas y 6 tarjetas; nunca dos juegos iguales seguidos.
- **Todo cabe** (7 y 9 nov; §21 y 29): pistas de 2 a 5 ideas de máx. 12 palabras; título de 7 palabras, objetivos de 14 y
  bloques de 6 como máximo; regla 12 del Generador; fotos reales de Wikimedia, enteras y nunca hechas con IA.
- **Entrega** (9 nov; §27): solo guías 100 % completas; vista previa de 4 pantallas (portada, una pista y dos juegos).

## Lo aprendido

- 2026-11-11 · Daniel: **tope de costo de IA por guía en producción: 6 MXN** (vista previa + resto, con investigación
  de temas incluida). Hoy el promedio es de 4 a 5 MXN. Las pruebas pueden gastar hasta 15 MXN cada una mientras se
  aprende; lo que se lleve a producción tiene que caber en 6. Nunca se corta una guía pagada a medias por costo: si una
  pasa de 6, se avisa y se ajusta el proceso.

- **11 nov · Temas del temario sin contenido (Daniel: «no podemos inventar temas, pero sí es necesario hacer las guías lo
  más completas posibles»).** Solo los temas escritos en las fotos; 1 fuente oficial o 2 sitios confiables; una fuente
  vale solo si su página salió en la búsqueda de esa misma llamada (así la IA no cita de memoria). Lo que no se confirma
  queda como nota «repásalo en tu libro»; la práctica del examen se ignora. Lo nuevo va apagado y se prueba por trabajo:
  probar con IA exige desplegar, porque la llave solo vive en Supabase.
- **11 nov · Prueba real de la investigación:** un proceso del servidor se apagó a media búsqueda sin dejar error y
  el trabajo quedó trabado 22 min: los de las familias se reanudan solos cuando su página pregunta, los del
  administrador no. Las búsquedas fallidas («entrada inválida», tope agotado) dejaron sin confirmar temas fáciles. El
  revisor de slides no ve preguntas vacías: revisar también el contenido.
- **11 nov · Preguntas en blanco en guías ya entregadas:** 22 preguntas de 8 guías (6 pagadas y entregadas, del 7 al
  10 nov) y 1 de una vista previa traían su texto en `texto`; el reproductor solo muestra `pregunta ?? afirmacion ??
  enunciado` (y el juego de deslizar, solo `afirmacion`). Causa: el prompt del reparador decía «el mismo formato del
  generador» sin mostrarlo y el código le pasaba las preguntas con la clave `texto`; la vista previa no pasa por
  revisar. Ningún revisor lo vio: el de slides no lee contenido y la revisión final no miraba el texto. Lección: cada
  prompt que pide JSON muestra el formato exacto; el código acomoda los nombres desde que se escribe; y una consulta
  a la base («¿cuántas preguntas en blanco hay?») vale más que revisar una guía a ojo.
- **11 nov · Arreglos antes de encender la investigación (código 2026-11-11.3):** un bloque sin nada confirmado y sin
  contenido propio no se escribe ni se repara (solo lleva su nota, que al armar pasa al bloque vecino; en la vista
  previa se escribe el bloque siguiente); si en toda la guía no hay nada confirmado ni contenido, la guía falla con
  error claro en vez de inventar. La revisión final rechaza preguntas sin texto (la guía de la prueba real no habría
  salido). Búsqueda sin ninguna página → un reintento con consultas más cortas. La verificación ya no repite lo que trae
  fuentes (0 búsquedas si todo es investigado; 4 si es más de la mitad). Lección: cada regla de «no inventar» necesita
  su candado en tres lugares: el escritor, el reparador y la revisión final.
- **11 nov · Banco de pruebas que no caduca:** una guía de biblioteca (`POST /admin/guias` + subir las páginas +
  `/generar`) no es de ninguna familia, no se publica y su material dura 365 días.
- 2026-11-11 · Daniel: **la vista previa NO se abarata.** «La calidad es primero y al cliente le tenemos que mostrar lo que
  está comprando»: misma calidad y modelos en la vista previa que en la guía pagada. No volver a proponerlo.
- **7 nov · El pensamiento de la IA cuenta dentro del tope de tokens.** Con esfuerzo medio, Haiku gastaba el tope y el
  plan o el bloque 1 salían sin JSON. Arreglo: esquema JSON en el plan, esfuerzo bajo y topes de 16 000 (plan y
  lectura) y 20 000 (cada bloque, ≈ 80 s). Si subo el esfuerzo, subo el tope.
- **7 nov · «Esto tiene que ser bulletproof, de a fuerzas te tiene que sacar algo» (Daniel).** 2 fotos por llamada; la
  foto ilegible va a `no_leidas` y la guía sigue; segunda oportunidad pidiendo solo JSON; plan por código tras 2
  intentos; bloque cortado → mitad de juegos. Cada llamada acaba antes de 125 s (la función se corta a los 150 s).
- **7 nov · La verificación de datos no corría y nadie lo notó:** el buscador rechazaba `bbc.co.uk` y `fundeu.es`
  (error 400) y la guía salía igual. «Sin error» no prueba nada: miro que `verificacion` traiga resultados.
- **7 nov · Prueba de modelos (una corrida):** Sonnet en plan y reparar, 23 de 30; Opus, 21; todo Haiku, 17. Los
  errores de respuesta salen de «escribir» (Haiku). Una corrida no basta para diferencias chicas.
- **7 y 9 nov · Costos:** Daniel pidió nunca generar la guía completa antes del pago y un análisis de costo por paso en
  cada prueba («tengo que empezar a checar costos»). El 80 % de la vista previa es el plan con Sonnet: recortar slides
  casi no ahorra.
- **7 nov · Reintentar un trabajo ya terminado duplica la guía.**
- **7 nov · Se perdían preguntas sin motivo:** la revisión ahora arregla formatos antes de descartar y anota cada
  descarte. Clasificar venía con 3 grupos y el reproductor muestra 2: lo que el reproductor no entiende se pierde.
- **7 y 8 nov · Correcciones:** una corrección sin actividad salía 3 veces; ahora, una. «no_confirmada» no quita nada;
  solo «corregida» con su dato correcto cambia la guía.
- **8 nov · Gramática:** el corrector solo acepta cambios de ortografía y en guías de lengua no toca opciones ni
  distractores (sus errores son a propósito). Por código: espacios antes de «.» y «,» y «exámen»; por prompt: la
  palabra base nunca es la respuesta («(NERVOUS) → nervous»).
- **8 nov · El servidor solo se despliega por el puente** (commit fijo): sus archivos ya no caben directo.
- **9 nov · Revisar con herramienta, no a ojo:** el revisor halló las 19 fotos de la demo recortadas sin que nadie lo
  notara. Los largos viven en los prompts: el reproductor parte lo que no cabe, pero se ve mejor lo que cabe solo.
- **9 nov · Revisión final sin IA** (`verificarCartucho`): si falla, la familia ve «Estamos revisando tu guía», Daniel
  recibe aviso y la entrega sale sola cuando la guía queda completa.
- **10 nov · Nueve horas sin abrir guías pagadas** por un cambio del servidor que parecía pequeño. Tocar `pipeline.ts`
  o `prompts.ts` es desplegar el servidor entero: guardia antes y después, nunca con generaciones en curso.
- **11 nov · Los borradores caducan** (los de prueba, a los 7 días) y con ellos los inventarios para probar sin leer
  fotos otra vez. Los recientes pueden ser de familias: para pruebas, solo los de Daniel.
- **Entorno:** sin Python ni Deno; Node 24 corre TypeScript directo; Edge sin ventana revisa slides. En Git Bash,
  `grep -c $'\r'` cuenta mal: los fines de línea se miran con Node u `od -c` (el repositorio usa LF).

## Pendientes de mi tema

- **Temas del temario con fuentes (v50, apagado).** Prueba real del 11 nov (temario de Español 1.º, guía
  `7e590167…`): 3 de 6 subtemas confirmados (SEP), 3 como nota, 5.87 MXN. Los 4 arreglos (preguntas vacías o
  inventadas, reintento de búsquedas, reanudar pruebas trabadas y costo) están en el código 2026-11-11.3, probados sin
  IA y SIN desplegar. Falta: despliegue (principal, con el sí de Daniel) y la misma prueba otra vez
  (`scratchpad/investigar/probar-temario.mjs`, máx. 15 MXN). Se enciende si confirma ≥ 5 de 6, sin preguntas
  inventadas ni vacías y en ≤ 6 MXN.
- **Arreglo de datos de las preguntas en blanco** (6 guías pagadas y entregadas, 8 compras): SQL con respaldo,
  arreglo y comprobación en la nota `ia-arreglo-preguntas-en-blanco.sql` de la carpeta de notas de la principal
  (prueba en seco: 22 → 0 y 1 → 0). Se corre solo con el sí de Daniel; si se avisa a las familias, lo decide él.
- **Guardar lo investigado para reutilizarlo** (materia + grado + tema, 30 días; tabla nueva): Daniel dijo «no
  todavía»; proponerlo aparte después de la prueba.
- Solo las preguntas muestran la fuente investigada; Mix & match, Super sort y los demás juegos no (Animaciones y Juegos,
  si Daniel lo quiere). La ayuda de Reportes en el panel solo habla de la banderita y la ronda cuenta estos reportes
  como «de familias» (principal).
- **Modelos:** confirmar con 2 o 3 corridas más y probar aparte «escribir» (con Sonnet, unos 10 pesos más por guía).
- **Banco de pruebas fijo** (§12c): Civics III, Química 3.º (6 errores conocidos) e Historia de México 2, con
  inventarios que no caduquen y 3 corridas por caso. No existe.
- ✔ (11 nov, sesión jefe) La prueba sin IA de `pipeline.ts` ya vive en el repositorio: `node herramientas/probar-pipeline.mts .` («Todo bien»). Lo de abajo era su ruta temporal:
  vive en una carpeta temporal de otra sesión; pasarla a `herramientas/` antes de que se borre:
  `C:\Users\Daniel\AppData\Local\Temp\claude\5a751cd807121552\442c0fae-1073-462a-85a6-df677ea6ecfa\scratchpad\probar-pipeline.mts`
- **Medición:** el código acepta `HELICONE_API_KEY`, pero ¿está puesta? promptfoo (§12c) nunca se instaló.
- **Preguntas a la principal:** ¿se ajustó el Verificador («demasiado estricto», §9)? ¿Existen la biblioteca de datos
  verificados (§9) y el caché de retratos (§8)? Borrar las guías «[Prueba …]» de la base lo decide Daniel.
