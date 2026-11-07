# SparkEd · Criterios de construcción de la fase 2
Versión 5 nov 2026. Este es el brief que Claude Code va a seguir para construir la fase 2. Complementa al **Documento 1** (cómo razona Haiku, prompts v8) y al **Documento 2** (formato del videojuego). Donde este documento diga algo distinto, manda este, porque recoge lo que Daniel decidió después.

Material de referencia en `fase2/referencias/`: los dos documentos, el prototipo `sparked_player_prototipo.html`, la lección `Historia de Mexico 2 - El encuentro de dos mundos - 2o Secundaria Regina.pdf` y la carpeta `pinterest/` con cinco referencias de arte.

## 0. Reparto del trabajo: plantillas fijas, contenido verificado
- **Las plantillas son fijas** y las diseña el equipo: plantillas de página de teoría, portada, tutorial, juegos y pantallas de resultado. La inteligencia artificial **no diseña visuales**.
- **La inteligencia artificial llena las plantillas** con lo que extrajo de las fotos, verificó y escribió: pistas, ejemplos, correcciones, preguntas, retroalimentación. Y **acomoda**: decide qué formato de página usa cada pista, qué juego recibe cada tipo de contenido, qué preguntas van a cada juego, en qué orden y con qué dificultad, cuidando que cada punto difícil aparezca varias veces.
- **El motor solo arma y presenta.** Si un campo falta, la actividad no se muestra y el error se registra (Documento 2, sección 2).
- **Nada inventado.** Cada dato lleva su cita y el código revisa que exista (Documento 1, regla 1). Los errores de los apuntes se corrigen y se señalan; los temas del temario que faltan en los apuntes se completan con fuentes (sección 9).

## 1. Dónde vive
- Mismo repositorio `accesos-lumio` en GitHub Pages y mismo proyecto de Supabase. No se abre otro repositorio ni otro proyecto.
- Carpeta nueva en Pages para la landing, el formulario y generador, el reproductor de guías y la pestaña de guías del panel. El botón "Visitar sitio" del panel lleva al generador.
- Funciones nuevas en Supabase: generación por pasos, pago (webhook del proveedor), entrega de cartuchos al reproductor. La llave de Claude vive como secreto del servidor y nunca toca el navegador.
- Tablas nuevas: borradores temporales, guías (el cartucho), progreso por acceso y dispositivo, fichas. Se reutilizan accesos, acceso_dispositivos, eventos y colegios (fase 1).
- Cada ejecución de una función hace **un solo paso** de la cadena y deja el siguiente listo, con una tabla de trabajos; las funciones tienen límites cortos de tiempo y procesador. La reducción de fotos y la extracción de texto de PDF, Word, Excel y PowerPoint se hacen **en el navegador** antes de subir.

## 2. Ciclo del cliente
La landing "Bienvenido a SparkEd" ofrece **dos caminos** (libreta de Daniel, 6 nov 2026), nombrados **Servicio 1** y **Servicio 2**: **Servicio 1, "Accede a nuestra biblioteca de guías de colegios participantes"** (sección 2d, para mamás que no quieren subir nada) y **Servicio 2, "Personaliza tu propia guía interactiva"** (el ciclo de abajo, para alumnos que suben sus propios apuntes). Los dos caminos usan el mismo motor, el mismo reproductor, el mismo pago y la misma entrega.

**La landing explica cada servicio de forma muy visual, con dibujos, no con párrafos** (Daniel, 6 nov 2026): cada servicio es una tarjeta grande con una ilustración propia de tres pasos, en el mismo estilo de Sparky y de la guía. Servicio 1: una mamá llena un formulario corto → aparece la guía de su colegio → la compra y le llega por WhatsApp y correo. Servicio 2: un alumno toma fotos de sus apuntes → Sparky las convierte en una guía → la juega. Debajo de cada tarjeta, una frase de una línea de para quién es ("Si no quieres subir nada" / "Si tienes tus propios apuntes") y el botón. Más abajo, una vista previa animada de una guía real. Cero texto largo: si algo necesita más de dos líneas, se vuelve dibujo.

1. **Landing:** "Convierte tu temario en una guía de estudio interactiva". Botón "Accede a la herramienta".
2. **Formulario:** nombre, grado, materia, colegio (lista de la fase 1), teléfono, correo. Materia y grado fijan la paleta, el idioma y el perfil de edad.
3. **Carga:** "Arrastra tu contenido para hacer tu guía". Fotos, PDF, Word, Excel, PowerPoint. Tope: 15 páginas por guía (decidido el 5 nov 2026).
4. **"Generando tu guía":** pantalla de carga con avance real por pasos ("Leyendo tus apuntes 2 de 4", "Planeando la guía", "Escribiendo el bloque 1"). Dura entre dos y cuatro minutos.
5. **Vista previa de 3 slides:** portada real, índice real con los bloques y un juego real del bloque 1.
6. **"Desbloquea tu guía entera":** pago en línea. Precio: 100 MXN con IVA incluido (decidido el 7 nov 2026; del 5 al 7 de nov fue 85).
7. **Link único:** se crea solo al confirmarse el pago, con el nombre del formulario, 7 días de vigencia y 2 dispositivos.
8. **Guía jugable** en el reproductor. Última slide con "Crea otra guía".

## 2b. Pantalla de carga: datos curiosos y trivia (sin inteligencia artificial)
- Mientras se genera la guía (de uno a cinco minutos), la pantalla entretiene e informa: **datos curiosos de cultura general que aparecen uno por uno**, y un **quiz de trivia de 5 preguntas** de cultura general con retroalimentación al instante, usando el mismo componente de quiz del reproductor y el mismo estilo visual.
- **Banco propio, sin inteligencia artificial en tiempo real.** Los datos y las preguntas se escriben una sola vez a partir de fuentes confiables (enciclopedias, museos, UNESCO, NASA, institutos oficiales), cada uno con su fuente guardada, redactados con palabras propias y revisados por Daniel. Viven como un archivo en el repositorio, en caché del navegador, y se eligen **al azar** sin repetir dentro de la misma sesión. Costo cero por carga.
- **Etiquetas** por materia y por perfil de edad: si la guía es de historia, salen más datos de historia; nada que no sea apto para primaria. Se arranca con unos 200 datos y 100 preguntas y el banco crece con el tiempo.
- **El avance real siempre a la vista:** arriba, la barra con los pasos verdaderos ("Leyendo tus apuntes 2 de 4", "Planeando la guía", "Escribiendo el bloque 1"); abajo, el dato curioso o la trivia. Sparky anima la espera. La trivia no cuenta para los resultados de la guía.
- **Si cierra la página,** la generación sigue en el servidor. Al volver con el mismo dispositivo, dentro de las 24 horas, retoma la vista previa donde iba (la clave del borrador se guarda en su navegador).
- **Alineado con la sección "Pantallas de carga: ¿Sabías que…?" del prompt maestro v35:** cada dato lleva texto corto (25 palabras para peques y primaria, 40 para grandes), nivel, categoría, emoji y fuente; sin miedo, violencia, política ni religión; estado borrador → aprobado por Daniel en el panel → publicado; 1 de cada 4 pantallas es un tip de estudio o de la app; el dato rota cada 8 a 10 segundos; nunca más de 3 segundos de espera extra; botón "¡Otro dato!"; Sparky en la esquina con mini actividades y frases ("Afilando lápices…") y, en los pasos reales, "Leyendo tus fotos 📖", "Buscando pistas escondidas 🔍", "Revisando que todo esté perfecto ✅", "Arreglando detallitos 🔧", "¡Tu cartucho está listo! 🎉". Meta a largo plazo: 400 datos; para la fase 2 se arranca con 200.

## 2d. Camino de la biblioteca: guías precargadas por colegio, grado y materia (Daniel, 6 nov 2026)
Para la mamá que no quiere ni sabe subir materiales: llena un formulario y compra una guía que ya existe.
1. **Formulario:** colegio (lista de colegios participantes, con "Otro"), grado, materia, nombre, teléfono de WhatsApp y correo.
2. **"Buscando materiales":** el sistema busca en la biblioteca la guía publicada para ese colegio, grado y materia. No usa inteligencia artificial en ese momento: solo consulta la base. Si hay varias (distintos exámenes o periodos), muestra la lista con el nombre del examen y su fecha.
3. **Vista previa de 3 slides** de la guía encontrada, en el mismo reproductor y con el mismo cartucho recortado.
4. **Pago con Mercado Pago** (tarjeta, OXXO y SPEI; sección 3b), mismo precio y mismo flujo que la guía personalizada.
5. **Entrega:** al confirmarse el pago se crea un acceso propio para esa familia (7 días, 2 dispositivos) y se manda el link por correo y por WhatsApp, con QR e instrucciones. Cada compra tiene su propio link y su propio progreso aunque la guía sea la misma.
6. **Si no hay guía disponible:** aviso "Por el momento no tenemos la guía de [materia] de [grado] del [colegio]", **explicado con un dibujo, no con texto**: Sparky busca en la estantería vacía y señala el camino al Servicio 2, con una mini ilustración de los tres pasos (fotos de tus apuntes → Sparky las convierte → tu guía lista). Dos botones: **"Crea tu guía personalizada con el Servicio 2"** (lleva al otro camino con el formulario ya lleno) y **"Avísame cuando esté lista"**. Esa solicitud se guarda con colegio, grado, materia y contacto: es la lista de demanda que le dice a Daniel qué guía producir y a quién avisar cuando la publique.

**Backstage en el panel: pestaña "Biblioteca".**
- Daniel sube los materiales que le comparten las escuelas o las familias (fotos, PDF, temario), indica colegio, grado, materia, nombre del examen y fecha, y oprime "Generar para la biblioteca". Corre la misma cadena de la fase 2 (Documento 1 más C, D, E y G, con verificación completa).
- La guía nace como **borrador**: Daniel la revisa con "Ver como profesor", corrige lo que haga falta (regenerar un bloque, quitar una actividad) y la **publica**. Estados: borrador → publicada → archivada. Versiones: si corrige una guía publicada, los accesos ya vendidos conservan su versión o reciben la nueva, a elección de Daniel.
- Una guía publicada se vende muchas veces: el costo de inteligencia artificial se paga una sola vez al generarla y la vista previa no cuesta nada por visitante. Es el camino con mejor margen y el más fácil de construir, porque no hay carga de archivos del cliente ni generación en el momento.
- El panel muestra por guía: ventas, accesos activos, progreso promedio de los alumnos, errores reportados; y la lista de **solicitudes sin guía** agrupada por colegio, grado y materia, para decidir qué producir en cada temporada de exámenes y avisar a quienes dejaron su contacto.
- Clasificación por colegio y grado (fase 1) es la columna vertebral de la biblioteca: los colegios participantes del formulario salen de esa misma tabla.
- Materiales: solo los que te compartan escuelas o familias con permiso; las guías transforman y resumen el contenido con sus citas, no reproducen páginas enteras de libros de editoriales. Las fotos originales se borran a los 30 días; el cartucho publicado se conserva mientras esté en la biblioteca.

**Qué cambia en el orden de construcción:** el camino de la biblioteca puede ser la primera rebanada que cobre, porque reutiliza el motor y el reproductor sin la carga de archivos ni la generación en vivo. Orden propuesto: motor y reproductor → biblioteca (panel + formulario + vista previa + pago + entrega) → guía personalizada (carga de archivos y generación en vivo) → juegos en pixel art.

## 3. Dinero y datos
- **Vista previa barata.** Antes del pago solo corren el Extractor, el Planificador y el Generador del bloque 1. Después del pago corren los demás bloques, la revisión, la reparación y el Verificador. La vista previa cuesta cerca de la mitad de una guía (0.30 a 0.50 MXN con Haiku para 10 fotos).
- **Nada con nombre entra a la base hasta que oprimen Pagar.** Lo subido para la vista previa va a un cajón temporal con clave al azar y se borra solo a las 24 horas. Los datos del formulario viajan en el navegador. Una vista previa abandonada no consume nada ni deja rastro.
- **El pago confirmado es el conector.** Estados: borrador (sin pago, se borra a las 24 h) → pagada (arrancan los 7 días) → vencida (al día 7 se borran cartucho, fotos y progreso; queda una ficha con nombre, colegio, grado, materia, monto y fecha para cuentas y estadísticas). Renovar después del día 7 significa volver a generar.
- **Topes contra el abuso:** tres vistas previas al día por teléfono, por correo y por dispositivo; tope de gasto diario dentro de la función ("vuelve mañana"); límite de gasto mensual en la consola de Anthropic; filtro gratuito contra robots en el formulario.
- **Fotos subidas:** se borran a los 30 días como máximo, y con la guía al día 7.
- **Precio decidido: 100 MXN por guía, IVA incluido** (7 nov 2026; antes 85). Se cobra con Mercado Pago (tarjeta, OXXO y SPEI); Stripe queda dormido. Economía por guía vendida, con las comisiones del análisis de costos del 4 nov (confirmar con el contador):

| Concepto | MXN |
|---|---|
| Precio con IVA | 100.00 |
| IVA (16 %) que se entera al SAT | 13.79 |
| Base sin IVA | 86.21 |
| Comisión Stripe (3.6 % + $3 + IVA) | 7.66 |
| Comisión Mercado Pago (3.49 % + IVA) | 4.05 |
| Comisión OpenPay (2.9 % + $2.50 + IVA) | 6.26 |
| Comisión PayPal (3.95 % + $4 + IVA) | 9.22 |
| IA por guía vendida (guía completa, verificación de apuntes y unas 4 vistas previas abandonadas) | 3 a 5 |
| **Queda por guía con Stripe** | **≈ 74** |
| **Queda por guía con Mercado Pago** | **≈ 78** |

  Antes de ISR, contador, publicidad y tiempo propio. La IA pesa menos del 6 % del precio: se puede subir a Sonnet en consolidación o verificación si la calidad lo pide; lo que no conviene es regalar vistas previas con Sonnet. En un ticket de 85 pesos la cuota fija de Stripe pesa el doble que Mercado Pago. Costos fijos de la fase 2 en planes gratis ≈ 0 más dominio (~30 al mes); Supabase Pro (~460 a 650 al mes) se paga con 8 a 10 guías al mes.

| Guías al mes | Ingreso con IVA | Queda con Stripe | Queda con Mercado Pago |
|---|---|---|---|
| 20 | 2,000 | ~1,480 | ~1,560 |
| 100 | 10,000 | ~7,400 | ~7,800 |
| 500 | 50,000 | ~37,000 | ~39,000 |
| 1,000 | 100,000 | ~74,000 | ~78,000 |

## 3b. Cobro con Mercado Pago (construido el 7 nov 2026)
- **Proveedor:** Mercado Pago, Checkout Pro de México. Formas de pago: **tarjeta** (crédito y débito, en una sola
  exhibición), **OXXO** y **SPEI**. Fuera: pago en cajero, PayCash y crédito de Mercado Pago (el saldo de una cuenta de
  Mercado Pago no se puede quitar). Aparece en el estado de cuenta como **SPARKED**. Stripe queda dormido: solo se usaría
  si no estuviera Mercado Pago.
- **Se enciende solo** con dos secretos de Supabase: `MP_ACCESS_TOKEN` (cobra) y `MP_WEBHOOK_SECRET` (valida los avisos
  de pago). Sin ellos, el pago sigue siendo manual desde el panel, como antes.
- **Cómo funciona:** "Pagar" crea la compra (pendiente) y un link de pago de Mercado Pago con el precio de Ajustes
  (`sparked_precio`, 100 MXN). La familia paga en Mercado Pago y regresa a "¡Tu guía está lista!". Mercado Pago avisa al
  servidor; el servidor revisa la firma del aviso, pregunta el estado real del pago a Mercado Pago con su propia llave
  y, si está aprobado, crea el acceso de 7 días y 2 dispositivos y manda el correo. Lo hace **una sola vez** aunque el
  aviso llegue repetido.
- **OXXO y SPEI:** la ficha vale **3 días**. Mientras la familia paga, la compra sigue pendiente con su método anotado y
  la página dice, en lenguaje simple, qué sigue ("Tu pago en OXXO puede tardar hasta 1 hora en reflejarse. En cuanto se
  confirme, tu guía se activa sola y te llega al correo…"), con un botón para volver a ver la ficha. La vista previa de
  una guía personalizada se guarda esos días para que haya guía que entregar.
- **Pago rechazado:** "El pago no se completó. No se realizó ningún cargo." y el botón "Intentar de nuevo".
- **Respaldo:** si el aviso tarda, la página de la familia y el botón "🔄 Revisar en Mercado Pago" del panel le preguntan
  directo a Mercado Pago. Si Mercado Pago no responde al crear el pago, la compra queda apartada en modo manual.
- **Pasos para Daniel** (detalle y prueba sin cobrar en `GUIA.md`, sección "Cobro con Mercado Pago"):
  1. Mercado Pago Developers → Tus integraciones → **Crear aplicación** → Pagos en línea → **Checkout Pro**.
  2. Credenciales de producción → copiar el **Access Token** (`APP_USR-…`).
  3. Webhooks → Configurar notificaciones → Modo productivo → URL
     `https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked/pago/mercadopago`, evento **Pagos** → Guardar.
  4. Copiar la **clave secreta** del webhook.
  5. Supabase → Edge Functions → Secrets: `MP_ACCESS_TOKEN` = Access Token y `MP_WEBHOOK_SECRET` = clave secreta.
  6. Panel de guías → Motores en verde; Ajustes → precio 100.
  7. Para probar sin cobrar: cuenta de prueba comprador, Access Token de prueba (`TEST-…`) en `MP_ACCESS_TOKEN`, tarjeta
     de prueba con titular APRO; al terminar, regresar el Access Token de producción.

## 3c. Códigos de descuento (construido el 7 nov 2026)
- Daniel los crea en el panel (pestaña Códigos): código, "guía gratis" o "descuento en %", límite de usos (vacío = sin
  límite), caducidad opcional (fin de ese día, hora del centro de México) y nota. Se pueden apagar y volver a encender.
- La familia lo escribe en el campo opcional "¿Tienes un código? Escríbelo aquí" del pago. Se compara sin distinguir
  mayúsculas y sin espacios. Si no sirve, el mensaje es neutro: "Ese código no es válido".
- Gratis (total 0): la compra queda pagada al momento (monto 0, `metodo_pago = "codigo"`, el código y el descuento) y se
  entrega igual que una compra pagada (acceso de 7 días, link y correo). El uso se gasta con un paso atómico en SQL
  (`sparked_usar_codigo`), así que nunca se pasa del límite aunque dos familias lo usen al mismo tiempo.
- Porcentaje: Mercado Pago cobra el precio ya descontado (también Stripe o el modo manual). El uso se cuenta una sola vez
  cuando la compra queda pagada.
- Las compras con código gratis no cuentan como venta ni como ingreso en el Resumen ni en la Biblioteca del panel;
  el aviso a Daniel dice "Guía con código" en vez de "Venta".
- Protección: cada intento queda en `codigo_intentos`; con 5 intentos fallidos en una hora (mismo teléfono, correo o IP)
  los siguientes se rechazan con el mismo mensaje neutro.

## 4. Accesos
- **Ilimitados hasta que venza la guía.** Sin tope de clics ni cierre a los minutos. Solo dos controles: vigencia de 7 días desde el pago y 2 dispositivos por familia. Las clases de Lumio de la fase 1 conservan sus límites, porque ahí no se controla el destino.
- Al tercer dispositivo le aparece **"Acceso en uso en otros dispositivos"** (Daniel, 7 nov 2026: en todo el sitio y en las guías se dice "dispositivos"). El intento queda registrado y se cuenta en el panel.
- **La guía nunca viaja suelta.** El reproductor pide el cartucho al servidor con la clave del link y la marca del dispositivo. La vista previa recibe un cartucho recortado; el completo solo se entrega con clave pagada y dispositivo permitido. Compartir la dirección no sirve.
- **Progreso en el servidor** por clave y dispositivo: resultado al primer intento de cada actividad, intentos, calificación de cada mini-examen, puntaje del reto final, tiempo y última slide. Se reanuda donde se quedó (Documento 2, sección 7).
- **Liberar dispositivos:** desde el correo de compra, una sola vez por guía, sin depender de Daniel. Renovar desde el panel sigue existiendo.
- El contador de aperturas se conserva como dato de uso, no como límite.

## 5. Entrega
- **Primero por correo.** Contenido: título y portada de la guía, código QR grande, el link, fecha y hora de vencimiento, qué contiene por bloques, reglas en lenguaje llano (2 dispositivos por familia, qué significa "Acceso en uso en otros dispositivos", cómo liberar dispositivos), contacto de ayuda y botón "Crea otra guía".
- El QR se genera en el servidor sin costo y también aparece en la pantalla "¡Listo!" después del pago, para que el niño lo escanee del celular del papá.
- Botón "Mandar por WhatsApp" con el mensaje listo, para que el papá lo reenvíe al hijo. WhatsApp automático desde el servidor queda para después (cuesta por mensaje).
- Para que el correo llegue se necesita un dominio propio y un servicio de envío con plan gratuito suficiente.

## 5b. Entrega en dos tiempos (construido el 7 nov 2026)
- La guía completa se genera solo después del pago (no se gasta antes) y tarda entre 3 y 6 minutos. Los avisos son
  honestos: listo.html dice "Tu pago se confirmó. Tu guía completa se está terminando: tarda unos 4 minutos. Te avisamos
  por correo en cuanto esté lista." con barra de avance y tiempo estimado (avance del trabajo "resto"), y cambia a
  "¡Tu guía está lista!" solo cuando la guía está completa.
- Primer correo con el mismo mensaje honesto y el link; segundo correo, una sola vez, "¡Tu guía completa está lista!",
  cuando termina el trabajo "resto" (`compras.correo_lista_en`). Si la guía ya estaba completa al pagar, solo sale uno.
- Si el trabajo "resto" falla tras sus reintentos: el link deja de decir "generando" y dice "Estamos revisando tu guía;
  te avisamos por correo en cuanto esté lista"; Daniel recibe un correo (si llenó el correo de aviso en Ajustes) y el
  Resumen del panel muestra la guía en rojo. Al reintentar y terminar, la familia recibe el segundo correo.
- Ajuste `sparked_jugar_durante_generacion` (defecto "no"): con "si", el reproductor deja jugar los bloques de la vista
  previa mientras se termina el resto, con el letrero "Estamos terminando los demás bloques".

## 6. Panel del profesor
- Pestaña **Guías** junto a las clases: contadores de hoy, semana y mes (generadas, vistas previas, pagadas, ingresos, costo de Claude, porcentaje de vistas previas que terminaron en pago); lista con filtros por colegio, grado, materia, estado y fecha, y buscador por nombre o teléfono.
- **Detalle de cada guía:** "Ver como profesor" (guía completa sin registrar dispositivo ni vencer), reporte de verificación (citas encontradas, datos corregidos con fuente, temas completados), fotos originales mientras existan, estado del link, dispositivos, avance del alumno, reenviar correo, liberar dispositivos, renovar.
- **Cola "Revisar":** guías marcadas por las revisiones automáticas (citas sin encontrar, dudas del Verificador, reparaciones repetidas) más una de cada veinte al azar.
- **Avisos:** al instante solo pagos y fallas; todo lo demás en un resumen diario por la noche.
- **"Reportar un error"** en cada slide del reproductor: manda la slide y el comentario a la cola.
- Las guías se clasifican por colegio y grado, igual que las clases (fase 1).

## 7. Teoría: formato visual obligatorio
Referencia: la lección **Historia de México 2 · El encuentro de dos mundos** (PDF en `fase2/referencias/`). Toda página de teoría generada debe verse así. Lo que es blanco y negro o "dibujitos hechos por HTML" no sirve.

- **Página:** fondo blanco hueso, línea fina del color del bloque en el borde superior, píldora en mayúsculas "PISTA N · BLOQUE N · TEMA" en el color del bloque, título grande en sans pesada. Texto del cuerpo legible sin zoom en iPad (18 px mínimo en el diseño de 1280).
- **Tarjetas:** blancas, redondeadas, con sombra suave y **borde superior grueso de color que cambia de tarjeta en tarjeta**; título de tarjeta con emoji en ese mismo color; cuerpo con negritas abundantes en fechas, nombres y términos. (El prototipo usa encabezados sólidos; se cambia a esto.)
- **Cajas dentro de las tarjetas:** "Ej.:" amarillo pálido con borde naranja; "✓ Dato corregido: …" verde pálido con borde verde; "🔑 Diferencia / En orden / Clave" amarillo pálido como síntesis; banda azul marino con texto blanco y palabras clave en amarillo para la conclusión de la página. Casi toda pista lleva una síntesis, no solo la última del bloque.
- **Imágenes reales:** retratos circulares con borde del color del bloque y nombre en negritas; pinturas, grabados y fotos en tarjetas redondeadas con pie de foto gris; mapas con título. Ver sección 8.
- **Mini-tarjeta de dato rápido** ("4 viajes · 1492 · 1493 · 1498 · 1502").
- **Formatos de página** (la inteligencia artificial elige uno por pista según el contenido y no repite el mismo dos veces seguidas): (a) dos tarjetas más columna de categorías en cuadrícula; (b) tarjetas más línea de tiempo de cajas con flechas; (c) tres tarjetas con su imagen debajo; (d) retratos a la izquierda, tarjetas al centro, mapa o pintura a la derecha; (e) tres definiciones con emoji grande y caja clave; (f) dos columnas "+ positivos / − negativos" con banda de conclusión; (g) tarjeta más lista de filas con ícono en cuadrito y banda. Los esquemas del Documento 2 (comparación, línea de tiempo, ciclo, causa y efecto, mapa, partes) se dibujan dentro de estos formatos.
- **Portada:** píldora "MATERIA · GRADO · PERIODO", título enorme con las últimas palabras en el color de la materia, subtítulo, **cuatro retratos reales con nombre** (emojis solo si el tema no tiene personajes), "¿QUÉ VAS A APRENDER HOY?" con tres tarjetas numeradas, barra con los bloques en sus colores.
- **Tutorial "Cómo usar esta lección":** tres tarjetas numeradas (avanza y regresa, usa la barrita, juega) y barra inferior "Importante: termina cada juego antes de pasar a la siguiente slide".
- **Al pie de cada pista:** botón negro azulado "🎮 ¡A jugar! <nombre del juego>" con "¡A jugar!" en amarillo. Cada juego tiene nombre propio ("¿Hecho o proceso?", "Completa la ruta"), nunca "Actividad 1".
- **Colores de identidad por materia** (cada paleta trae primario, cuatro colores de bloque, fondo y acentos; verde para "corregido", amarillo para resaltes, marino para bandas):

| Materia | Color |
|---|---|
| Historia | azul fuerte (bloques: azul, naranja terracota, teal, rojo vino) |
| Francés | azul clarito |
| Español | rojo |
| Matemáticas | naranja |
| Ciencias | verde |
| Inglés | mostaza (Documento 2; Daniel pidió "otra tonalidad") |
| Cívica | morado (Documento 2) |
| Geografía | turquesa (Documento 2) |

- El perfil de edad (Documento 2, sección 6b) cambia el tono, el largo y los personajes de los juegos; la estructura visual de la teoría es la misma en todos los grados.
- **Observado en las guías Lumio ya hechas** (Español 1, Cívica I y III, Francés 1, Geografía 1, Inglés 3, en `Materiales escolares Green Oaks`): hay dos estilos de portada, una oscura azul marino con acento turquesa y otra clara con el color de la materia; la fase 2 debe elegir uno o permitir ambos por paleta. Las paletas reales todavía no siguen la tabla de arriba (Español salió azul marino y turquesa); la tabla manda. Las guías de Cívica en inglés abren con una pista "Exam skills" de técnica para preguntas abiertas: en la fase 2 eso choca con la regla "solo contenido" del Documento 1, y queda pendiente decidir si se conserva como pista de solo teoría. En inglés las tarjetas de vocabulario llevan definición en inglés y traducción en cursiva, como pide el apoyo "línea corta" del Documento 1.

## 8. Imágenes reales de personajes, lugares y obras
- En historia y en cualquier tema con personajes, lugares, obras o científicos, la guía muestra **la fotografía o el retrato real** del personaje y de la línea de tiempo, para que el alumno reconozca quién es quién.
- **Fuente:** Wikipedia y Wikimedia Commons (servicio gratuito, sin llave). Se guarda miniatura, licencia y crédito; el pie de foto los muestra.
- **Pasos:** el Extractor anota los personajes y lugares con su época; el Planificador marca qué pistas, qué puntos de línea de tiempo y qué mosaicos de portada llevan imagen; un paso de código busca la imagen del artículo exacto; Haiku solo confirma que el artículo corresponde al personaje de los apuntes.
- **Caché compartido** por personaje entre todas las guías: el retrato de Hidalgo se busca una vez.
- **Reglas duras:** nunca una cara inventada con inteligencia artificial; si no hay imagen libre, se usa un ícono; en la línea de tiempo van retratos circulares con nombre.

## 9. Verificación, correcciones y temas faltantes
- Criterio permanente de Daniel: antes de construir, comprobar que los apuntes **cubren todos los temas del temario** del maestro y que **cada dato es verdadero**, comparando con fuentes en la web.
- **Dato equivocado en los apuntes:** el Verificador (Prompt G) lo corrige, guarda la fuente y la pista lo muestra en la caja verde "✓ Dato corregido". Las actividades usan el dato correcto.
- **Tema del temario que no está en los apuntes:** va por el camino de investigación (Prompts D y E) y entra a la guía marcado como "Completado con fuentes", con sus referencias en el reporte de verificación.
- El reporte de verificación completo queda en el detalle de la guía en el panel.
- **Estados del Verificador G** (prompts-ia-sparked.md, copia en `fase2/referencias/`): verificada, corregida, no_confirmada y contradice_libro. Corregida → caja verde "✓ Dato corregido" con el `mensaje_para_alumno` ("🔎 En tus apuntes dice… Según… Estudia esta versión…"); no_confirmada → la actividad se elimina; contradice_libro → no se cambia nada y va a la cola "Revisar" del panel. Las matemáticas no las verifica la IA: el código recalcula. Las convenciones o enfoques del libro no son errores. Pendiente conocido: G es demasiado estricto; antes de usarlo se le aplican los ajustes.
- **Lista blanca de fuentes** (prompt maestro v35): SEP y Libros de Texto Gratuitos, gob.mx, INEGI, UNAM, IPN, Banxico, RAE y Fundéu, Britannica, National Geographic, NASA, Smithsonian, museos y universidades reconocidas, UNESCO, OMS, Khan Academy, Cambridge para inglés. No aceptados: Wikipedia (solo como pista y para fotografías), blogs, foros, sitios de tareas, redes sociales, videos, sitios hechos con IA. Regla de dos fuentes: 1 oficial o 2 confiables que coincidan; sin confirmación el dato no se enseña.
- **"Exam skills":** excepción ya probada con Civics III: si el temario describe el examen se descarta la descripción, pero si pide una habilidad (evaluar argumentos, estructurar una respuesta) esa habilidad SÍ se enseña como pista de teoría. Va escrito en el Planificador.
- **Biblioteca de datos verificados:** cada dato verificado se guarda por tema, grado y materia con sus fuentes y se reutiliza sin volver a buscar; Daniel aprueba, corrige o bloquea desde el panel.

## 10. Juegos: mecánicas y dirección de arte
- **Estilo:** pixel art retro de 16 bits, noches neón, pantalla CRT, HUD tipo "LEVEL 01 · HIGH SCORE · PRESS START". Referencias en `fase2/referencias/pinterest/`. Personajes propios siempre (Sparky, el astronauta, es la mascota); Mario, Nintendo y Pac-Man aparecen en las referencias solo por el feeling y no se usan.
- **Misma mecánica, varias plantillas** (Documento 2, sección 3): cada juego tendrá al menos tres plantillas, elegidas al azar sin repetir dentro de una guía. Primero se construye cada mecánica con una plantilla neutra y se valida; las plantillas y los personajes van después.
- **Reglas que no cambian** (Documento 2, sección 5.3): toda respuesta se califica al instante, la incorrecta muestra la respuesta correcta, lo arrastrado regresa con sacudida, se guarda el acierto al primer intento, todo funciona con el dedo en iPad.
- **Carrera:** el coche arranca en la línea de salida con los rivales. Aparece una pregunta de la teoría con unos 10 segundos. Bien: acelera y rebasa a un coche. Mal o tiempo agotado: lo rebasan. Gana si cruza primero la meta; podio al final. **Antes de empezar, el alumno elige entre 5 coches** para sentir que tiene su personaje (la elección se recuerda en su dispositivo). Plantillas: Fórmula 1, carreras callejeras, ciudad neón de noche.
- **Castillo:** un arquero en lo alto de una torre; los soldados se acercan uno por pregunta. Bien: elimina al soldado. Mal: lo atacan y pierde un corazón. **Tres vidas;** al perder las tres la actividad se reinicia con las preguntas revueltas. Puntaje: soldados eliminados.
- **Montaña:** subir contestando preguntas tipo quiz (la Torre del Documento 2 con plantilla de montaña y feeling de consola retro).
- **Mix and match:** plantilla de astronauta en un planeta, feeling de videojuego retro.
- **Súper dato:** la fórmula del Documento 2 con arte pixel retro.
- **Pantalla de fin:** estilo "GAME OVER · Better luck next time · Press start" para intentar de nuevo, y celebración grande cuando gana.
- **Juegos que dependen de imágenes, tomados de las guías de Lumio:** "¿Quién es quién?" (retrato ↔ nombre o hecho), "Une cada imagen con lo que pasó", "Completa la ruta" sobre un mapa. "Pasapalabra" también queda anotado.
- **Técnica:** sprites chicos y paleta limitada; `image-rendering: pixelated`; hojas de sprites con CSS `steps()`; parallax; carretera pseudo-3D en Canvas 2D; fuente pixel solo en HUD y títulos, las preguntas en fuente legible; bancos CC0 (Kenney) y fondos generados con Gamma cuando hagan falta. Detalle en la memoria de recursos.

## 11. Campos nuevos del cartucho (cambios al Documento 1)
- **Por pista:** `formato` (a–g de la sección 7), `ejemplo`, `clave` (síntesis de una línea), `correcciones[]` (dato de los apuntes, dato correcto, fuente), `imagenes[]` (entidad, tipo, uso: retrato, pintura, mapa), `dato_rapido`.
- **Por plan:** `identidad.retratos_portada[]`, paleta con sus cuatro colores de bloque, `imagenes_requeridas`.
- **Por bloque:** `temas_completados[]` con fuentes cuando el temario pedía algo que los apuntes no traían.
- **Actividades nuevas:** `quien_es_quien` (retrato ↔ nombre o hecho), `imagen_evento` (imagen ↔ lo que pasó). Los parámetros de juego (vidas, segundos por pregunta, número de rivales) viven en el motor, no en el cartucho.
- **Planificador:** reparte los formatos de página sin repetir dos seguidos y marca qué pistas llevan imagen.
- **Verificador:** entrega `correcciones` y `temas_completados` con fuente.

## 12. Orden de construcción propuesto
1. Colegio y grado en el panel (fase 1, tarjeta ya propuesta).
2. Landing, formulario, carga de archivos y vista previa, con generación revisada a mano al principio.
3. Cadena automática por pasos y reproductor con plantilla neutra; prueba con la guía de Civics III (22 a 25 slides).
4. Teoría con el formato visual completo e imágenes reales.
5. Pago, entrega por correo y pestaña Guías del panel.
6. Juegos en pixel art con selección de personaje y plantillas.
7. Retirar las pantallas viejas.

## 12b. Fase 2 ahora, fase 3 después (decidido por Daniel el 5 nov 2026)
- **La fase 2 es lo que se construye ahora:** este documento, dentro de accesos-lumio, con pago por guía. Su objetivo es ver cómo reacciona la gente a este modelo de negocio y pulir la inteligencia artificial que convierte apuntes en guías.
- **La fase 3 es el videojuego educativo por suscripción** del prompt maestro v35 del proyecto "Maestro particular" (planes Individual, Dúo y Familiar, bolsa de 400 páginas, perfiles, app instalable tipo consola, Sparky, personajes 3D, modos arcade y fiesta, organización propia en GitHub, Vercel y Supabase, Stripe). Llega cuando ya se domine la creación de guías interactivas, Haiku vaya aprendiendo por sí solo, se conozcan los costos y haga falta un concepto que mueva más a los niños. Resumen en `fase2/referencias/proyecto-maestro-particular-resumen.md`.
- **El prompt maestro v35 está desactualizado en los prompts y criterios de la IA:** los vigentes son los del Documento 1 (prompts v8: Extractor, Compactador, Planificador, Generador) más C, D, E y G de `prompts-ia-sparked.md`. Del v35 vale el concepto, no sus prompts.
- **Continuidad:** todo lo que se construya en la fase 2 debe poder migrar a la fase 3 sin rehacerse: mismo cartucho, mismo motor de IA, mismo reproductor y misma regla de verificación. La dinámica de SparkEd seguirá evolucionando; la IA se pule en la fase 2 y se actualiza en la fase 3.

- **Proveedor de pago decidido: Stripe** (5 nov 2026), porque Daniel quizá venda también en Estados Unidos y porque la fase 3 necesita sus suscripciones. En la fase 2: Stripe Checkout o Payment Element con tarjeta, Apple Pay y Google Pay, y OXXO como pago en efectivo; el webhook de pago confirmado crea el acceso. Nunca guardar tarjetas en nuestra base. Cobro en MXN; en dólares para clientes de Estados Unidos cuando se habilite. Confirmar comisiones vigentes y SPEI directamente con Stripe antes de conectar. Un solo proveedor en la fase 2; Mercado Pago, si acaso, en la fase 3. **Cambió el 7 nov 2026:** la fase 2 cobra con Mercado Pago (tarjeta, OXXO y SPEI; sección 3b) y Stripe queda dormido.

## 12c. Tope de páginas y medición real (decidido el 5 nov 2026)
- **Tope: 15 páginas por guía**, "lo natural" para un examen. Las guías de examen largas quedan para después, con precio propio.
- **Precios y costos se recalculan con pruebas reales del API, no con suposiciones.** Desde el primer día se miden las llamadas de verdad con dos herramientas: **promptfoo** (prueba cada prompt contra casos reales, califica y compara versiones y modelos; corre en la computadora, sin cuenta) y **Helicone o Langfuse** (registra cada llamada real al API: costo, tiempo, tokens y errores; Helicone es un proxy que solo cambia la dirección del API y agrega una cabecera, lo más simple para funciones de Supabase; Langfuse requiere instrumentar el código pero trae conjuntos de datos y evaluaciones). Más PostHog para medir conversión y uso en la app. Todas con plan gratuito; confirmar límites vigentes.
- **Primer banco de pruebas:** Civics III (12 páginas), los apuntes de Química 3° (13 fotos con 6 errores conocidos), Historia de México 2 y los demás juegos de fotos de `Materiales escolares Green Oaks`. Con Haiku real, 3 corridas por caso, midiendo citas encontradas, preguntas prohibidas, retroalimentación completa, correcciones detectadas, costo y tiempo. La tabla de la sección 13 se sustituye por los números medidos.

## 12d. Pendientes nuevos del camino de la biblioteca
- **WhatsApp automático desde el servidor** para la entrega: requiere la API oficial de WhatsApp de Meta (cuenta de empresa, aprobación y costo por mensaje). Alternativa sin costo para arrancar: correo automático, link y QR en pantalla y botón "Mandar por WhatsApp" con el mensaje listo.
- **Precio de la guía de biblioteca:** el mismo de 100 pesos o uno distinto. Por simplicidad, el mismo al inicio.
- **Mismo colegio, varios grupos:** si una maestra pone exámenes distintos por grupo, la guía se identifica también por grupo o por nombre del examen.

## 13. Referencia: estimación previa de costo por tamaño de guía
- Estimación hecha antes de las pruebas reales, con los supuestos de los documentos (0.25 MXN por página en el peor caso con verificación completa, 0.08 típico; búsqueda web ≈ 0.18 MXN cada una; Sonnet 20 veces más caro que Haiku):

| Por guía vendida | Hasta 20 páginas | Hasta 80 páginas |
|---|---|---|
| Caso típico (libro impreso, pocas búsquedas) | 2 a 3 | 6 a 9 |
| Peor caso (apuntes a mano, verificación completa, reparación y un respaldo con Sonnet) | 5 a 10 | 20 a 30 |
| Vistas previas abandonadas, 4 por venta | ≈ 3 | ≈ 10 |
| Peor caso total | ≈ 12 | ≈ 40 |
| Queda de 85 con Stripe en el peor caso | ≈ 54 | ≈ 26 |
| Tiempo de generación | 1 a 3 min | 4 a 8 min |

  Daniel decidió 15 páginas (sección 12c); esta tabla se reemplaza con los números medidos en las pruebas reales.
- Dominio propio para el correo.
- Color definitivo de inglés.

## 14. Material que falta recibir
- `prompts-ia-sparked.md` con los prompts C (reparación), D y E (investigación) y G (verificador).
- Los seis juegos de fotos de prueba: Historia 3°, English 3° v2, Español 2° Regina, Ética I Cumbres, Francés 1° y Civics III.
- El prompt final de Daniel con sus criterios de razonamiento.
- Referencias de Pinterest adicionales conforme las vaya mandando.

## 15. Estado de construcción (6 de noviembre de 2026)

Con la autorización de Daniel ("ya tienes autorización de empezar a mover las cosas… no rompas nada… enfócate en el
arte… haz todo ya de una vez") la fase 2 quedó construida y publicada en el mismo repositorio y el mismo Supabase:

- **Sitio** `sparked/` (GitHub Pages): landing con dibujos de Sparky y los dos servicios; `biblioteca.html`
  (Servicio 1), `crear.html` (Servicio 2, hasta 15 páginas, fotos y PDF convertidos en el navegador), `listo.html`
  (QR, link, reglas del acceso), `guia.html` (reproductor con los juegos en pixel art y la vista previa con candado)
  y `panel.html` (panel de guías con la misma contraseña del panel de accesos).
- **Servidor**: función `sparked` (público, interno y admin) con la cadena de IA por pasos del Documento 1
  (Extractor → Unir → Planificador → Generador por bloque → Revisión por código → Reparador → Verificador con
  búsqueda en dominios confiables → fotografías de Wikipedia/Wikimedia → Armar). Cada paso corre en una ejecución
  y la función se llama a sí misma para el siguiente; un vigilante reanuda lo que se atore.
- **Accesos**: cada guía publicada tiene una clase de tipo `guia` y cada compra crea un acceso normal (7 días, 2
  dispositivos, "Acceso en uso en otros dispositivos"), reutilizando `consumir_acceso` sin tocar los links de Lumio.
- **Dinero**: vista previa barata antes de pagar; nada con nombre se guarda hasta "Pagar"; borradores sin pagar se
  borran a las 24 h; guías personalizadas viven 7 días después del pago y luego queda solo la ficha en Compras;
  topes de 80 compras al día y 6 por familia (ajustables en el panel).
- **Motores en blanco**: la IA, Stripe y el correo se encienden al poner `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET` y `RESEND_API_KEY` en Supabase. Regla de Daniel: "Stripe todavía no tengo la cuenta,
  déjalo como motor en blanco": mientras tanto el pago es manual (folio + "Marcar pagada" en el panel).
- **Probado**: publicar guía → buscar → vista previa → pago manual → link → 2 dispositivos entran, el tercero no →
  progreso guardado → reporte → topes. **Pendiente de probar con llaves reales**: la cadena de IA completa, Stripe,
  correos; después, calibrar prompts y costos con promptfoo y Helicone.

## 16. Pantallas y dirección de arte "retro gaming moderno" (6 de noviembre de 2026, tarde)

**Todas las pantallas (decidido por Daniel).** El sitio y las guías deben verse bien en teléfonos y tablets, Android y Apple,
en vertical y en horizontal, y en laptops. Reglas aplicadas:
- Sitio: en teléfonos (hasta 559 px) la cabecera se compacta, los tres pasos de cada servicio se apilan en lista con
  flecha hacia abajo y los botones van a lo ancho. La guía de ejemplo y la vista previa se abren en pantalla completa en
  pantallas angostas (dentro de un marco quedarían diminutas); en pantallas anchas siguen en marco con un enlace
  "Ver en pantalla completa".
- Reproductor: en horizontal la barra queda a la derecha (respetando el notch); en vertical la barra pasa abajo en fila y
  el escenario usa todo el ancho. En teléfonos en vertical aparece el aviso "Gira tu teléfono" con botón "Seguir en
  vertical" (se recuerda durante la sesión). Si en la misma pestaña se abre otro link, la guía se recarga sola.

**Dirección de arte (en exploración).** Daniel quiere conservar el concepto de gaming retro pero más moderno: el 8 bits se
queda por ahora en personajes, íconos y juegos; la interfaz (botones, tarjetas, tipografía, fondos) pasa a un lenguaje
actual. Tablero en Claude Design "SparkEd · Landing retro gaming moderna":
https://claude.ai/artifact/AY7kqMeNHL77sGRQb1aEXW con la landing de hoy y tres direcciones:
- **A · Arcade Neón:** fondo noche, cristal con borde fino, brillo violeta y cian, titulares en Sora.
- **B · Arcade Pop:** fondo claro, contornos gruesos y sombras duras tipo sticker, conserva Bricolage Grotesque; la más
  cercana al SparkEd de hoy y la más amable para mamás.
- **C · Synthwave Suave:** atardecer violeta a coral con horizonte en rejilla, tarjetas blancas flotando, titulares en Outfit.
Más tres tableros de piezas: Sparky en tres acabados (pixel actual, pixel con acabado moderno solo con CSS, vector
redondo con reflejo en el visor), el juego de carrera con HUD modernizado y el sistema visual (paletas, tipografías, HUD,
reglas). Pendiente: que Daniel elija dirección (o una mezcla) para aplicarla al sitio y al reproductor. Canva existe como
conector en el catálogo (sin autorizar todavía); Claude Design fue el que se usó.

**Acceso directo.** En el escritorio de Daniel quedó "SparkEd Guías" (abre el sitio de la fase 2 como ventana de
Chrome con el logotipo de SparkEd), junto a "SparkEd Accesos" (fase 1).

## 17. Dirección final de arte: sitio Synthwave Suave, juegos "retro 2.5D" (6 de noviembre de 2026, noche)

**Decidido por Daniel.** Para el sitio, la dirección C "Synthwave Suave" del tablero de Claude Design (aplicada y publicada).
Para los juegos y para Sparky mandó dos referencias nuevas: ilustración moderna entre 2D y 3D con temática retro
(consolas, cartuchos, controles, coches de juguete), con contornos gruesos, volúmenes con dos tonos y sombra en el piso.
Aclaración importante: "8 bits" fue su manera de pedir "moderno con temática retro". **Nada de pixeles en ningún lado:**
ni en los juegos ni en las ilustraciones de la landing (las ve una señora, deben ser muy simples; los chavos quieren lo
moderno).

**Reglas de arte (aplicadas en `sparked/js/arte.js`).**
- Todo es vector: Sparky (8 poses), coches de perfil con techo en sombra y cara superior clara, soldado, arquero,
  escalador (Sparky compacto), 15 íconos y las cuatro escenas (ciudad synthwave, montaña con plataformas, castillo,
  planeta). Contorno #2A2340, dos tonos por volumen, brillo pequeño, sombra elíptica en el piso.
- Las escenas se dibujan con degradados y capas con id (edificios lejanos, cercanos y rayas) para moverse en bucle.
- Sparky 2.1 (referencia de Daniel, 6 de noviembre en la noche: un astronauta chaparrito "detallado, con sus
  rayitas retro, pero sin pixeles, y con identidad robótica"): casco grande con visera y audífonos laterales, visor
  oscuro con **la cara hecha de luces LED** (ojos y boca que se encienden distinto en cada expresión: quieto, saludo
  ^ ^, festejo con ojos de estrella, triste en azul tenue con cejas caídas y lágrima, pensando con un ojo entrecerrado,
  la mano en el visor y «?»; los ojos parpadean; desde el 7 de noviembre ya no lleva cachetes rosas, para que se note
  la lengüita). Traje crema con todos los
  detalles del traje de la foto, en vector: hombreras, panel de pecho amarillo con botones y pantallita, cinturón
  naranja con hebilla, costuras, bolsillo, articulaciones grises con rayitas, reloj en la muñeca, guantes naranja,
  botas con suela y hebilla, mochila gris con luz roja y tanques, anillo del cuello y chispa amarilla en la antena.
  Las sombras (gris lavanda) llevan rayitas finas como impresión retro y el visor, líneas de pantalla tenues.
  Colores: crema #FBF7EE, sombra #DAD8E8, visor #1A1733, LED #7DF9FF, lengua #FF7FA8, naranja #FF7A3D, amarillo
  #FFC247, gris #9CA2B8 / #636A86, luz roja #FF4D5E, contorno #2A2340. El escalador de montaña y puertas es el mismo
  Sparky en chico. Hoja de personaje para revisarlo: `sparked/sparky.html`.
- Sparky vivo (Daniel, 7 de noviembre de 2026: "que tenga un poquito más de vida y no parezca que está confundido todo
  el tiempo"). Tres poses nuevas que se mueven solo con CSS sobre el mismo dibujo (sin GIF, Lottie ni librerías):
  **construyendo** (casco amarillo de obra sobre el casco, con la antena saliendo por arriba; martillo que sube y baja
  sobre bloques de letras A, B y C, chispitas en cada golpe; bucle de 2.4 s), **caminando** (piernas y brazos por
  turnos, se bambolea, mira hacia donde va y voltea al cambiar de dirección) y **escribiendo** (tabla con hoja en una
  mano y lápiz en la otra; los renglones aparecen mientras escribe y saca la lengüita). En reposo flota, parpadea y mira
  a los lados; el saludo mueve la mano y el festejo agita los brazos. Dónde se usa: la pantalla de espera mientras se
  genera la guía (constructor; también en "Buscando materiales…" de la biblioteca), el paso "Sparky las convierte" del
  inicio y de la biblioteca (constructor chico), la pantalla de carga al abrir una guía (constructor), "Preparando tu
  pago…" y "Esperando la confirmación del pago…" (escribiendo), los resultados de la guía con menos de 70 % (escribiendo:
  a repasar) y el recuadro del inicio, donde cada 8 a 15 segundos hace algo al azar: saluda, camina de un lado a otro,
  escribe un dato curioso nuevo letra por letra en la burbuja, vuela con su jetpack o arregla un dato que se trabó.
  Reacciona a la gente sin estorbar: mouse encima = saluda; toque o clic = una reacción del repertorio. La pose
  «pensando» con «?» ya no se usa en ninguna pantalla (queda solo en la hoja de personaje). Con "reducir movimiento" se
  queda quieto (sin caminar, volar, brincar ni escribir letra por letra). Código: poses y accesorios ("+casco",
  "+taller", "+jetpack") en `arte.js`, `sparkyVivo()` y `escribirTexto()` en `ui.js`, animaciones en `base.css`
  (sección "Sparky vivo"; solo corren dentro de `.sk-anima`) y su voz en `sonido.js` (`sonido.sparky`).
- Sparky con jetpack y travesuras (Daniel, 7 de noviembre de 2026: "cada vez me gusta más Sparky"). Sin cachetes rosas,
  para que la lengüita de concentración se lea como lengua. **Jetpack:** dos propulsores grises con franja naranja a los
  lados de la mochila que echan llamas titilantes; en el aire flota más rápido, los brazos se mecen como alas, las
  piernas patalean y su sombra se queda en el piso y se achica. Poses nuevas: **volando**, **arreglando** (llave de
  tuercas arriba, chispitas y lengüita), **sorprendido** (ojos muy abiertos y boca en «o»), **riendo** (> < y carcajada) y
  **enamorado** (ojos de corazón y corazoncitos). En el inicio, a veces el dato curioso **se traba** mientras Sparky
  camina (la burbuja tiembla y salen símbolos raros): se sorprende, saca el jetpack y la llave, sube a la burbuja, la
  aprieta hasta que se compone, da una voltereta de gusto, aterriza y el dato termina de escribirse bien. Otras veces
  vuela por travesura (voltereta o paseo por el aire). **Al tocarlo** hace una de seis reacciones al azar, sin repetir la
  anterior: brinco, giro, voltereta con jetpack, risa, corazones o baile, cada una con su **sonidito robótico de
  alegría** (bips sintetizados, nunca suena solo y respeta el silencio de las guías). En la pantalla de espera reacciona
  sin moverse de su lugar (festejo, risa o corazones) porque los bloques van en el mismo dibujo.

**Mecánicas "videojuego actual" (en `sparked/js/juegos.js`).**
- Carrera: los coches corren todo el tiempo (rayas y edificios en parallax), acierto = acelerón y rebase suave,
  error = frenada y te rebasan; motor sintetizado que acelera y frena; meta a cuadros.
- Montaña: plataformas; cada acierto es un salto en parábola con estrella (+10), cada error un resbalón.
- Castillo: una escuadra de tres soldados marcha hacia la torre; acierto = flecha en arco y el líder cae, los otros
  huyen; error = llegan a la torre, sacudida y se pierde un corazón; tres vidas y GAME OVER.
- Mix and match, súper dato, super sort y rank order: se juegan tocando (tarjeta → destino, con destinos latiendo) o
  arrastrando; acierto = la tarjeta se junta con un "pop"; error = sacudida roja y la pareja correcta en el aviso.
- Sonidos (`sparked/js/sonido.js`): tonos suaves con envolvente, ráfagas de ruido filtrado (silbido de la flecha,
  golpe, tic), motor continuo; nada de beeps cuadrados.
- Legibilidad y acabado (`guia.css`, bloque "retro 2.5D"): preguntas 23 px, opciones 19 px, tarjetas 19 px, contornos
  y sombras sólidas suaves en paneles, botones START, fin de juego y GAME OVER.

**Pendiente.** Afinar lo que Daniel pida al ver los juegos; swipe, ruleta y mini-examen solo recibieron el acabado visual.

**Pantalla de instrucciones (Daniel, 6 nov 2026, noche).** Como en Lumio, antes de cada actividad aparece una película
transparente sobre el juego con una tarjeta: Sparky, "¿Cómo se juega?", la instrucción propia de ese juego (por ejemplo
"Lee la tarjeta y clasifícala con tu dedo: deslízala a la derecha si es verdadera…" o "Elige tu coche y a correr…") y el
botón **Iniciar**. Aplica a los diez juegos y existe en español, inglés y francés (`TEXTOS.instr_*` en `cartucho.js`).

## 18. Juego de puertas, verdadero o falso express y plantillas por actividad (Daniel, 6 de noviembre de 2026, noche)

**Juego de puertas (nuevo, tipo Donkey Kong).** Una torre en zigzag de 2 a 4 pisos con escaleras. El personaje se mueve con las
flechas del teclado (o WASD) o con flechas digitales en pantalla (teléfono y tablet): ◀ ▶ camina, ▲ ▼ sube y baja escaleras.
Cada puerta se abre contestando una pregunta del temario: la respuesta correcta es la llave; si falla, se muestra la llave
correcta, se abre de todos modos y se pierde una vida. Guardias patrullan cada piso (más rápidos arriba); si lo atrapan,
pierde una vida y vuelve al inicio del piso. Tres vidas, GAME OVER y reinicio con las preguntas revueltas. Gana al llegar a
la SALIDA del piso de arriba con todas las puertas abiertas. Plantillas: torre, mansión, bodega. Entra en la rotación de
juegos de preguntas: carrera → puertas → montaña → castillo.

**Verdadero o falso express.** El swipe ahora es contra reloj: 7 segundos por tarjeta, sumados para todas (10 tarjetas =
70 s), con reloj grande que se pone rojo en los últimos 10 s y tic en los últimos 5. Lo que no se contesta a tiempo cuenta
como error. Objetivo: leer rápido y decidir con lo que se sabe.

**Plantillas distintas por actividad (regla).** Cada actividad tiene varias plantillas con el mismo formato y mecánica pero
distinto personaje o escenario, para que el tema sea unisex y nunca se repita dentro de una guía: la carrera corre con
coches (ciudad de neón), naves (espacio), caballos (hipódromo) o dragones (cielo), con su propio sonido (motor, galope,
viento). El estante elige sin repetir plantilla dentro de la misma guía; la IA que genera las guías debe respetar esa
biblioteca y alternar: por ejemplo carrera con coches → puertas → teoría → mix and match → carrera con caballos.

## 19. Tono y palabras (Daniel, 7 de noviembre de 2026)

**Regla de redacción.** Todos los textos del sitio, de las guías, de los correos y de los mensajes de WhatsApp van en
lenguaje formal, pero muy simple y específico. Se vale repetir un poco para que nadie se confunda.
- **"Dispositivos"**, siempre (en singular y en plural): "2 dispositivos por familia", "vale 7 días y hasta en 2
  dispositivos", "El tercer dispositivo ve el aviso «Acceso en uso en otros dispositivos»". No se usan sinónimos
  coloquiales.
- **El acceso siempre es "a tu guía":** "7 días de acceso ilimitado a tu guía". Nunca debe entenderse como acceso a toda
  la plataforma.
- **Precio:** "Una guía: $100 MXN, IVA incluido".
- **Entrega:** "te la mandamos por correo y por WhatsApp".
- **Sin coloquialismos:** por ejemplo, "Juegas y estudias", no "la juegas".
- **Pasos como lista corta y numerada** (1, 2, 3), no como frase corrida: "1. Tomas fotos de tus apuntes", "2. Sparky
  las convierte en una guía", "3. Juegas y estudias".

## 20. Dirección de arte 3.0: moderna, tipo render 3D (pedida el 7 nov 2026, pendiente de hacer)
- **Misma mecánica de los juegos por ahora; cambia el arte.** Daniel quiere que el juego "se vea muy moderno y no se sienta retro": figuras con volumen tipo render 3D (luces suaves, brillos, sombras y texturas), como los juegos actuales de plataformas en 3D. La referencia que mandó es una escena 3D de un juego de plataformas clásico; sirve solo para el acabado (texturas, iluminación, profundidad), no para copiar personajes ni elementos.
- **Vehículos y animales realistas:** los carros deben parecer **Fórmula 1 de verdad** (no taxis), los caballos deben verse como caballos con **colores reales** (gris, negro, café, blanco; nunca morado, rojo o azul) y los dragones con colores creíbles, no de neón.
- **Qué cambia en el dibujo:** sin contorno oscuro grueso; volumen con degradados y brillos; sombra suave en el piso; una sola dirección de luz; fondos con profundidad (capas lejanas más suaves); paleta saturada pero natural. Sparky conserva su identidad 2.1 (casco, cara LED, colores) con este mismo acabado.
- **Cómo:** primero una hoja de muestras (3 o 4 estilos) para que Daniel elija; luego aplicar a todos los juegos y al reproductor. Vectores SVG con degradados y filtros ligeros, o sprites PNG/WebP prerenderizados si los filtros pesan en iPad. Nada retro, nada pixelado.
- Imagen de referencia guardada fuera del repositorio: C:\Users\Daniel\Downloads\Claude outputs\SparkEd_referencia_arte_3D_moderno.jpg
