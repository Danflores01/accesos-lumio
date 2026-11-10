# WhatsApp de SparkEd (Green API)

Cuando una guía pagada queda 100 % lista, SparkEd la manda sola por WhatsApp, además del correo.
Es un sistema de **entrega**, no un chatbot: el número de SparkEd no contesta preguntas ni saludos.
La única excepción es la palabra «compartir»: quien la escribe recibe un mensaje con el link de la portada para reenviarlo.

---

## Parte 1. Para Daniel: cómo encenderlo

### Qué es Green API

Green API (green-api.com) es un servicio que conecta un WhatsApp normal con el servidor de SparkEd.
**Green API no da un número.** Se usa un WhatsApp que ya existe: se enlaza escaneando un código QR desde el teléfono que tiene ese número, igual que cuando abres WhatsApp Web.

Conviene un **número dedicado a SparkEd** (un chip aparte en un teléfono que se quede en casa, con cargador e internet), no tu número personal: si WhatsApp llegara a bloquear el número, no pierdes tu WhatsApp de siempre.

### Pasos

1. **Prepara el número.** Pon el chip de SparkEd en un teléfono, instala WhatsApp (o WhatsApp Business) y regístralo. Espera por lo menos un día antes del paso 4 (ver «Riesgo de bloqueo»).
2. **Crea la cuenta.** Entra a https://console.green-api.com y regístrate con tu correo.
3. **Crea la instancia.** En la consola, pulsa «Create an instance». Elige el plan (ver «Qué plan necesitas»).
4. **Enlaza el teléfono.** Abre la instancia y aparece un código QR. En el teléfono de SparkEd: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo → escanea el código. La instancia debe quedar en «authorized».
5. **Copia tres datos** de la página de la instancia:
   - **apiUrl** (por ejemplo `https://7103.api.greenapi.com`)
   - **idInstance** (un número, por ejemplo `7103123456`)
   - **apiTokenInstance** (una clave larga de letras y números)
6. **Pégalos en Supabase.** Entra a https://supabase.com/dashboard/project/wfqfqfsbkqbaejnkhidz/functions/secrets y agrega tres secretos con estos nombres exactos:

   | Nombre del secreto | Qué pegar |
   |---|---|
   | `GREEN_API_URL` | el apiUrl |
   | `GREEN_API_ID_INSTANCE` | el idInstance |
   | `GREEN_API_TOKEN_INSTANCE` | el apiTokenInstance |

7. **Pulsa «Conectar»** en el panel de SparkEd (sección WhatsApp). Esto deja la instancia lista: le dice a Green API a dónde mandar los mensajes que llegan y con qué contraseña. Green API tarda unos 5 minutos en aplicar el cambio.
8. **Pulsa «Enviar prueba»** con tu número personal. Debe llegarte «Mensaje de prueba de SparkEd: el WhatsApp de entregas está conectado.»
9. Listo. Desde ahora cada guía pagada y lista sale sola por WhatsApp. En el panel ves cuántas se mandaron en los últimos 7 días y el último error.

### Qué plan necesitas y cuánto cuesta

Según la página oficial de precios (https://green-api.com/en, sección de precios) y la de límites (https://green-api.com/en/docs/about-tariffs/), consultadas el 9 de noviembre de 2026:

| Plan | Precio | Para qué sirve |
|---|---|---|
| **Developer** | 0 dólares al mes | Solo para probar: permite hablar con **3 chats al mes** y 100 comprobaciones de número al mes. Solo se puede tener una instancia gratis. |
| **Business** | **12 dólares al mes** por instancia (alrededor de 220 pesos, según el tipo de cambio) | El que necesita SparkEd: chats ilimitados y 30 000 comprobaciones de número al mes. |

Puedes empezar con **Developer** para hacer la prueba con tu propio número, pero en cuanto haya ventas reales necesitas **Business**: con Developer, a partir de la cuarta familia del mes los mensajes ya no salen (las guías sí siguen llegando por correo y a ti te llega un aviso). El pago es por instancia; la consola muestra el precio vigente al pagar.

### Qué pasa si el teléfono se desconecta

- Si el teléfono se apaga o pierde internet un rato, Green API guarda los mensajes en una cola **24 horas** y los manda al volver.
- Si WhatsApp cierra la sesión (por ejemplo, si borras el dispositivo vinculado), hay que volver a escanear el código QR (paso 4).
- En cualquiera de los dos casos **te llega un correo de aviso** (como mucho uno al día) y las familias siguen recibiendo su guía por correo.
- Para mandar otra vez una guía que no salió, abre la compra en el panel y usa el botón para reenviarla por WhatsApp.

### Riesgo de bloqueo (y cómo reducirlo)

WhatsApp puede bloquear números que mandan mensajes automáticos, sobre todo si son nuevos, si mandan muchos mensajes iguales o si la gente no contesta. Es un riesgo real: Green API no lo puede evitar del todo. Lo que ya hace SparkEd para bajarlo:

- Solo escribe a familias que **compraron** y dejaron su número; nunca manda publicidad.
- Cada mensaje lleva el **nombre** de la persona y el **título** de su guía (no son mensajes idénticos).
- Deja **15 segundos** entre un mensaje y otro.
- No contesta conversaciones; solo el comando «compartir», máximo 2 veces al día por chat.

Lo que te toca a ti (recomendaciones de Green API, https://green-api.com/en/docs/faq/how-to-protect-number-from-ban/):

- Usa un **número dedicado** y, si es nuevo, **«caliéntalo» unos 10 días** antes de conectarlo: que reciba y conteste algunos mensajes normales cada día, aumentando poco a poco.
- Deja pasar **24 horas** entre registrar WhatsApp en el teléfono y escanear el código QR.
- Pon foto y nombre de perfil («SparkEd») en ese WhatsApp.
- Pide a las familias que **guarden el número** de SparkEd (por ejemplo, en la página de pago o en el correo).
- No uses ese número para mandar mensajes masivos a mano.

### Cómo cambiar los mensajes

1. En el panel, entra a **Ajustes** y baja a la tarjeta **WhatsApp (Green API)** → «Mensajes que se mandan solos».
2. Hay cuatro mensajes: la entrega de la guía (español e inglés) y la respuesta a «compartir» (español e inglés). El idioma se elige solo por la lada del teléfono.
3. Escribe tu texto en la caja. Con los botones metes los datos que cambian en cada familia:
   - `{nombre}`: el primer nombre de quien compró.
   - `{titulo}`: el título de la guía.
   - `{link}`: el link de la guía.
   - `{portada}`: sparkeducation-mx.com (en el mensaje de «compartir»).
4. Para negritas escribe `*así*`; para cursivas, `_así_`. A la derecha (o abajo, en el celular) ves la **vista previa** con datos de ejemplo.
5. Pulsa **Guardar mensajes**. Se usan desde el siguiente mensaje que salga.
6. Para deshacer, pulsa **Volver al texto original** y luego **Guardar mensajes**. Si dejas una caja vacía, también se usa el original.
7. Para ver cómo llega de verdad, elige el mensaje en el selector junto a «Enviar mensaje de prueba» y mándalo a tu número (sale con datos de ejemplo). Recuerda que el plan gratis solo permite 3 chats al mes.

Reglas que el sistema cumple aunque se te olvide algo: la entrega **siempre** lleva el link de la guía (si quitas `{link}`, se añade al final); el mensaje de «compartir» siempre lleva el link de la portada; si la familia no dejó nombre, el saludo queda «Hola:»; cada mensaje tiene un máximo de 1 500 caracteres.

### Chats con tus clientes, dentro del panel

Desde el 10 de noviembre de 2026, en el **Resumen** del panel hay un cuadro **Chats de WhatsApp**:

1. A la izquierda está la lista de chats de los últimos 7 días, del más reciente al más viejo. El número amarillo dice cuántos mensajes de esa persona siguen sin contestar.
2. Toca un chat para leer la conversación. Si el número coincide con una compra, arriba ves el nombre del cliente y su guía.
3. Escribe abajo y pulsa **Enviar** (en computadora, también con la tecla Enter). El mensaje sale desde el WhatsApp de SparkEd.
4. Las fotos, audios y documentos que te manden se abren en otra pestaña. Desde el panel solo se mandan mensajes de texto.
5. La lista se actualiza sola cada medio minuto mientras tienes el Resumen abierto. Un mensaje puede tardar hasta 2 minutos en aparecer.

Para que también aparezca lo que contestas **desde tu teléfono**, pulsa una vez **Activar** en el aviso amarillo del cuadro (o **Conectar** en Ajustes → WhatsApp). Green API aplica el cambio en unos 5 minutos.

Leer un chat en el panel no lo marca como leído en WhatsApp. Las conversaciones no se guardan en SparkEd: se leen de Green API cada vez.

---

## Parte 2. Técnica

Código: `funciones/sparked/whatsapp.ts` (módulo aparte; `index.ts` lo llama). Pruebas sin llaves: script de Node 24 que importa el módulo con un `Deno` falso y simula `fetch` y Supabase.

### Secretos

- `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN_INSTANCE`: obligatorios. Con los dos, `motorWhatsApp()` es `true` (y `/admin/ping` muestra `motores.whatsapp: true`).
- `GREEN_API_URL`: opcional; la «apiUrl» de la instancia. Por defecto `https://api.green-api.com`.
- Token del webhook: no es un secreto aparte. Es `sha256(GREEN_API_TOKEN_INSTANCE + ":sparked-whatsapp-webhook-v1")`. `configurar` lo pone en `webhookUrlToken`; Green API lo manda como `Authorization: Bearer <token>`.

### Métodos de Green API usados

`sendMessage` (`chatId`, `message`, `linkPreview` → `idMessage`), `checkWhatsapp` (`chatId` con `@c.us` → `existsWhatsapp`, `chatId` = lid, `phoneNumber`), `getStateInstance` (→ `stateInstance`), `getSettings` (`wid`, `webhookUrl`, `webhookUrlToken`, `incomingWebhook`, `outgoingMessageWebhook`) y `setSettings` (→ `saveSettings`). Para los chats del panel: `lastIncomingMessages` y `lastOutgoingMessages` (GET con `?minutes=`) y `getChatHistory` (`chatId`, `count`). Formato: `{apiUrl}/waInstance{idInstance}/{método}/{apiTokenInstance}`.

### Rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /publico` | pública | `{ whatsapp: boolean }` |
| `POST /whatsapp/webhook` | Green API | Siempre responde 200 al instante. Con token malo, o con el motor apagado, no hace nada. Procesa en segundo plano. |
| `GET /admin/whatsapp` | admin | `{ motor, estado_instancia, numero, enviados_7d, fallidos_7d, compartir_7d, ultimo_error, webhook_configurado, historial_del_telefono }` (`historial_del_telefono`: `false` si falta el ajuste para que el historial traiga lo escrito en el teléfono; `null` si no se pudo preguntar) |
| `POST /admin/whatsapp/configurar` | admin | `setSettings`: `webhookUrl` = `…/functions/v1/sparked/whatsapp/webhook`, `webhookUrlToken`, `incomingWebhook` y `stateWebhook` en `yes`; desde el 10 nov 2026 también `outgoingMessageWebhook` (lo escrito en el teléfono) y `outgoingWebhook` (enviado, entregado, leído) en `yes`, para los chats del panel; `outgoingAPIMessageWebhook`, llamadas, encuestas, ediciones, borrados y acuses en `no`; `markIncomingMessagesReaded` `no`; `linkPreview` `yes`; `delaySendMessagesMilliseconds` 15000. Green API reinicia la instancia y aplica en unos 5 minutos. |
| `GET /admin/whatsapp/chats` | admin | Lista de chats individuales con mensajes en los últimos 7 días: `{ chats: [{ chat, nombre, telefono, cliente, ultimo, sin_responder }], dias }`. |
| `GET /admin/whatsapp/chats/mensajes?chat=&cuantos=` | admin | Mensajes de un chat, del más viejo al más nuevo (60 por defecto, máximo 200). |
| `POST /admin/whatsapp/chats/enviar { chat, texto }` | admin | Manda un texto (máximo 4 000 caracteres) a un chat individual. Con el teléfono desconectado responde 409 y no manda. |
| `POST /admin/whatsapp/prueba { telefono }` | admin | Manda un mensaje de prueba. |
| `POST /admin/whatsapp/verificar { telefono }` | admin | No manda nada: muestra la respuesta de `checkWhatsapp` para cada forma del número y el chat que se usaría. |
| `GET /admin/whatsapp/imagen?tipo=&idioma=` | admin | No manda nada: devuelve el PNG que acompañaría al mensaje (`tipo` = `entrega` o `compartir`; `idioma` = `es` o `en`). |
| `POST /admin/whatsapp/reenviar { compra_id }` | admin | Reenvía la entrega de una compra pagada con guía completa (`guias.reporte.etapa = 'completa'`); link = `<sitio>guia.html#<accesos.token>`. |

### Entrega: `avisarPorWhatsApp(c, compra, { titulo, link, expira_en }, { forzar? })`

- Nunca lanza errores; devuelve `{ ok, estado }` y actualiza `compras.wa_estado`, `wa_enviado_en`, `wa_detalle`.
- Estados: `enviado` · `en_cola` (instancia sin sesión: Green API guarda la cola 24 horas) · `sin_whatsapp` · `sin_telefono` · `sin_motor` · `fallido` · `ya_enviado` (no se mandó por ser repetida).
- Idempotente: reclama la compra con `update … where wa_estado is null`; solo una ejecución gana. `forzar: true` (reenvío del panel) manda otra vez.
- Si la instancia está `blocked` o `suspended`, no manda. Si el envío falla, aviso a Daniel (máximo uno por hora). Desconexión: aviso máximo uno al día.

### Plantillas de los mensajes

- Claves en la tabla `config` (y en `CONFIG_DEF` de `index.ts`): `sparked_wa_entrega_es`, `sparked_wa_entrega_en`, `sparked_wa_compartir_es`, `sparked_wa_compartir_en`. Vacío = texto original (`PLANTILLAS_ORIGINALES` en `whatsapp.ts`). El panel guarda con `POST /admin/config`; si el texto es igual al original, guarda vacío.
- `armarMensaje()` en el servidor: limpia saltos de línea y caracteres de control, corta a 1 500 caracteres; entrega: `{nombre}`, `{titulo}`, `{link}`, `{portada}`; si falta el link, lo añade al final en su propio renglón; sin nombre quita `, {nombre}` («Hola, :» → «Hola:»). «Compartir»: solo `{portada}`; si no aparece `sparkeducation-mx.com`, la añade al final. Comodines desconocidos se quedan tal cual.
- `GET /admin/whatsapp` devuelve además `mensajes` (por plantilla: `texto`, `original`, `personalizado`, `clave`) y `ejemplo` (`nombre`, `titulo`, `link`, `portada`, `maximo`).
- `POST /admin/whatsapp/prueba { telefono, mensaje? }`: con `mensaje` = `entrega_es` · `entrega_en` · `compartir_es` · `compartir_en`, manda esa plantilla con los datos de ejemplo (María, «Fracciones y decimales al ataque», `<sitio>guia.html#ejemplo`).

### Imágenes de los mensajes (Sparky)

Pedido de Daniel (9 nov 2026): que la gente conozca a Sparky. Cada mensaje sale como **una imagen con el texto de pie de foto**:

| Mensaje | Imagen | Archivo en el sitio |
|---|---|---|
| Entrega de la guía | Sparky sujetando una tarjeta con el **código QR de esa guía** (el mismo link del texto, para abrirla desde otro dispositivo) | `sparked/img/wa/entrega-es.png` y `entrega-en.png` (plantillas con la tarjeta vacía) |
| Respuesta a «compartir» | Sparky saludando: «Convierte tu temario en una guía de estudio interactiva» | `sparked/img/wa/compartir-es.png` y `compartir-en.png` |

- **Cómo se arma la entrega** (`funciones/sparked/imagen-wa.ts`): baja la plantilla del sitio, dibuja el QR del link en la zona blanca de la tarjeta y vuelve a escribir el PNG. La zona está en `sparked/img/wa/manifiesto.json` (`{ "entrega-es": { "zona": { "x", "y", "lado" } }, … }`, en píxeles). El QR se calcula en `qr.ts` con `qrcode-generator` 1.4.4, nivel M, igual que el de `listo.html`; se dibuja con módulos de píxeles enteros y 2 módulos de margen. No se usa ninguna biblioteca de imagen: el PNG se lee y se escribe con la compresión nativa (`DecompressionStream`, `CompressionStream`). Plantillas admitidas: PNG de 8 bits, RGB o RGBA, sin entrelazado, hasta 4 millones de píxeles.
- **Cómo se manda** (`enviarMensaje()` en `whatsapp.ts`): `sendFileByUpload` de Green API (formulario con `chatId`, `caption`, `fileName`, `file`) en su servidor de medios (la `mediaUrl` que muestra la consola). `urlsMedios()` prueba en orden las direcciones posibles: en las instancias con número de grupo (`https://7107.api.greenapi.com`) es **la misma `apiUrl`** y, de respaldo, la variante `media`; en la dirección general, primero `https://media.green-api.com`. Solo pasa a la siguiente si la anterior no existe o no atiende esa ruta (error de conexión, 404 o 405). El secreto opcional `GREEN_API_MEDIA_URL` fija una sola dirección a mano. (La primera prueba real, el 10 nov 2026, salió sin imagen porque se buscaba `7107.media.greenapi.com`, que no existe; el texto sí llegó.)
- **Nunca se queda nadie sin mensaje por la imagen.** Sale el texto de siempre si: no hay arte publicado, el ajuste `sparked_wa_imagenes` está en `no`, el texto pasa de 1 024 caracteres (lo más que admite un pie de foto) o falla armar o subir la imagen. En `wa_mensajes.detalle` queda «con imagen» o «sin imagen: motivo».
- **Cambiar el arte no requiere desplegar la función:** basta publicar los archivos nuevos en `sparked/img/wa/` (la función los recuerda 10 minutos). Si cambia el lugar de la tarjeta, se actualiza el manifiesto. La zona del QR debe ser un cuadrado de blanco puro, sin nada encima y con al menos 40 px de blanco alrededor.
- **Ver sin mandar:** `GET /admin/whatsapp/imagen?tipo=entrega|compartir&idioma=es|en` devuelve el PNG (la entrega, con un QR de ejemplo) y la cabecera `x-tiempo-ms`. `POST /admin/whatsapp/prueba { telefono, mensaje }` manda la plantilla elegida con su imagen.
- **Vista previa del link:** aparte de WhatsApp, las páginas llevan `og:image` = `sparked/img/og-sparky.png` (1200 × 630) para que al pegar un link del sitio se vea a Sparky y no el ícono del rayo.
- Pruebas: `prueba-imagen.mjs` (lectura y escritura de PNG con los cinco filtros, y el QR leído con jsQR a 1080 y a 540 px) y `prueba-whatsapp.mjs`.

### Números de México

Las compras guardan `+52` + 10 dígitos (las viejas, 10 dígitos sin lada: también son de México). En WhatsApp casi todos los celulares mexicanos existen como `521` + 10 dígitos (así aparece también el número de SparkEd) y unos pocos como `52` + 10 dígitos.

Antes de mandar, `resolverChat()` consulta `checkWhatsapp` con `521…@c.us` y, si no existe, con `52…@c.us`. El `chatId` de la consulta debe llevar el `@c.us`: con solo dígitos Green API responde HTTP 400 («'chatId' must be one of the next formats: 'phone_number@c.us' or 'chat_id@lid'»); si una instancia con la versión anterior rechaza `chatId`, `consultarNumero()` reintenta con `{ phoneNumber }` (entero). La respuesta trae `existsWhatsapp`, el identificador de la cuenta (`chatId`, un `…@lid`) y su número real (`phoneNumber`, `521…@c.us`). Orden para decidir a qué chat se manda:

1. El identificador que devuelve Green API (primero el `lid`, luego el número real), como recomienda su FAQ «lid important differences».
2. Si no viene identificador y solo una forma existe, esa forma.
3. Si las dos «existen» (la FAQ avisa de ese falso positivo) o la consulta falla (red, límite del plan), `521…@c.us`, con la nota «sin comprobar» cuando no se pudo consultar.

Mandar a la forma equivocada no sirve: Green API acepta el mensaje y después avisa `noAccount`. Así falló la primera entrega real (9 nov 2026): la consulta salía con solo dígitos, respondía 400 y el mensaje se fue a `52…@c.us`. Con el arreglo (código 2026-11-09.4 y .5) la entrega llegó al `lid`, la familia respondió «compartir» desde `521…@c.us` y recibió la respuesta.

Redes de seguridad para que no vuelva a pasar con ningún cliente:

- **En el formulario** (`numeroSinLada()` en `sparked/js/flujo.js`): con la lada +52 siempre se guardan los 10 dígitos, aunque la familia escriba el número con `52`, `521`, el `1` que muestra WhatsApp, o los prefijos viejos `044`, `045` y `01`. Pruebas: `prueba-formulario.mjs`.
- **Consulta que falla por algo pasajero** (red, tiempo agotado, error de su servidor): `consultarNumero()` la repite una vez. Un 4xx (llave mala, límite del plan 466) no se repite.
- **`noAccount` después de enviar**: si la entrega salió a `<número>@c.us` y el teléfono de la compra tiene otra forma sin probar, `reintentarOtraForma()` manda la misma entrega a esa otra forma, una sola vez (cada intento queda en `wa_mensajes`, así que no hay ciclos). Una entrega mandada a un `lid` no se reintenta.
- **Argentina** (la otra lada del formulario con este problema): se prueba `549…` y luego `54…`.

Al recibir mensajes se comparan los últimos 10 dígitos (chats `@c.us`) o se busca una entrega anterior al mismo chat (chats `@lid`).

`POST /admin/whatsapp/verificar { telefono, forzar?, vieja? }` muestra qué responde Green API para cada forma del número y a qué chat se mandaría, **sin mandar nada** (útil para entender un `noAccount`; cada consulta gasta una de las comprobaciones del plan).

### Errores sin la llave

Green API lleva la llave de la instancia en la dirección de cada llamada y la repite en el campo `path` de sus errores; los errores de red de Deno también traen la dirección completa. `api()` nunca deja pasar esos textos: `motivoDeError()` se queda solo con el motivo (`message`) y `sinLlave()` borra la llave y cualquier dirección. Importa porque esos textos se guardan en `wa_mensajes.detalle` y `compras.wa_detalle`, se ven en el panel y viajan en los correos de aviso.

### Idioma por lada

- Español: +52 México y países de habla hispana: 34, 51, 53, 54, 56, 57, 58, 240, 502–507, 591, 593, 595, 598; y en +1, Puerto Rico (787, 939) y República Dominicana (809, 829, 849).
- Inglés: el resto de +1 y cualquier otra lada (por ejemplo +55 Brasil, +44 Reino Unido).

### Comando «compartir»

- Se normaliza el texto: minúsculas, sin acentos, sin signos, comillas ni emojis.
- Es comando solo si quedan 1 o 2 palabras y una está a distancia de edición ≤ 2 de «compartir» (palabras de 6 letras o más) o ≤ 1 de «share» (4 letras o más). En inglés y en español se aceptan las dos palabras.
- Sí: `compartir`, `COMPARTIR!!`, `"compartir"`, `conpartir`, `compartr`, `compatir`, `share`, `shar`. No: `hola`, `gracias`, `comprar`, `ok`, `¿puedo compartir la guía con mi primo?`.
- Solo se responde a chats individuales (`@c.us` o `@lid`) cuyo número coincide con una compra pagada, máximo 2 respuestas por chat cada 24 horas. Tipos de mensaje leídos: `textMessage` (`textMessageData.textMessage`), `extendedTextMessage` y `quotedMessage` (`extendedTextMessageData.text`). Grupos (`@g.us`), estados, audios, imágenes y lo demás se ignoran.
- Avisos repetidos (mismo `idMessage`) se descartan con un índice único.

### Chats en el panel

Pedido de Daniel (10 nov 2026): tener dentro de su panel los chats que ve en Green API, para conversar con sus clientes. Vive en el Resumen de `sparked/panel.html` (cuadro «Chats de WhatsApp») y en `rutasChats()` de `whatsapp.ts`.

- **Por qué no se incrusta la pantalla de Green API.** Green API ofrece su pantalla de chats por link (`https://chats.green-api.com/?idInstance=…&apiTokenInstance=…`), pero exige poner la llave de la instancia en la dirección de la página. Aquí la llave nunca sale del servidor: el panel pide los chats a la función, y la función le pregunta a Green API.
- **De dónde salen los datos.** Del historial de Green API: `lastIncomingMessages` y `lastOutgoingMessages` con `minutes=10080` (7 días) para la lista, y `getChatHistory` para un chat. SparkEd no guarda el texto de ningún mensaje; `wa_mensajes` solo anota que salió un mensaje de tipo `chat`.
- **Lista** (`armarChats()`): solo chats individuales (`@c.us` y `@lid`; sin grupos, estados ni canales), del más reciente al más viejo, máximo 80. `sin_responder` = mensajes recibidos después de la última respuesta. Reacciones y votos de encuestas no cuentan ni se muestran.
- **Con quién habla** (`clientesDeChats()`): la compra se busca por los últimos 10 dígitos del teléfono o, si el chat es un `@lid`, por una entrega anterior a ese chat. De varias compras del mismo teléfono gana la más nueva, y una pagada le gana a una pendiente. El nombre que se muestra es, en orden: el de la agenda del teléfono, el de la compra, el del perfil de WhatsApp o el teléfono.
- **Mensajes** (`resumirMensaje()`): texto, foto, video, audio, documento, sticker, ubicación, contacto, encuesta, eliminado u «otro». Los archivos se abren con el `downloadUrl` de Green API (solo direcciones `https`); la vista previa de una foto solo pasa si es base64 limpio y de tamaño razonable.
- **Enviar**: solo texto y solo a chats individuales. Antes de mandar se pregunta el estado de la instancia: con el teléfono desconectado, bloqueado o arrancando no se manda (Green API lo guardaría y lo mandaría horas después). Los envíos respetan la pausa de 15 segundos entre mensajes de la instancia.
- **Lo escrito en el teléfono**: para que el historial lo traiga hace falta `outgoingMessageWebhook: yes`. `GET /admin/whatsapp` dice si falta (`historial_del_telefono: false`) y el panel muestra un aviso con el botón «Activar», que llama a `configurar`.
- **En el panel**: la lista se pide cada 30 segundos y el chat abierto cada 12, solo con el Resumen a la vista (Green API admite una llamada por segundo a cada método). Un mensaje recién enviado se muestra de inmediato y se retira de «propios» cuando el historial ya lo trae (puede tardar hasta 2 minutos). Todo texto se escapa antes de mostrarse; solo los links `http(s)` se pueden abrir. Al cerrar sesión se borran de la pantalla.
- **Límites conocidos**: leer un chat en el panel no lo marca como leído en WhatsApp; no se mandan fotos ni archivos; la lista solo ve 7 días.
- Pruebas: `prueba-chats.mjs` (servidor) y `capturas-chats.mjs` (panel a 13 anchos, con datos inventados).

### Otros avisos del webhook

- `stateInstanceChanged`: `notAuthorized`, `blocked`, `suspended`, `yellowCard` o `sleepMode` → correo a Daniel (uno al día por estado).
- `quotaExceeded` (límite del plan Developer) → correo a Daniel (uno al día).
- `outgoingMessageStatus` con `failed` o `noAccount` (Green API los manda siempre) → la entrega pasa a `fallido` o `sin_whatsapp`. Los demás estados (`sent`, `delivered`, `read`) llegan desde que `outgoingWebhook` está en `yes` y no hacen nada.
- `outgoingMessageReceived` (lo que Daniel escribe en su teléfono; llega desde que `outgoingMessageWebhook` está en `yes`) → se ignora; solo sirve para que Green API lo guarde en su historial.

### Tablas (migración `sql/migraciones/20261109_sparked_whatsapp.sql`)

- `compras`: `wa_estado`, `wa_enviado_en`, `wa_detalle`.
- `wa_mensajes`: `creado_en`, `direccion` (`entrada`/`salida`/`interno`), `tipo` (`entrega`, `compartir`, `prueba`, `chat` = mensaje escrito por Daniel en el panel, `ignorado`; internos: `aviso`, `estado`, `limite`), `chat`, `compra_id`, `estado`, `id_mensaje`, `detalle` corto. No guarda el texto de ningún mensaje. RLS activado sin políticas: solo entra la llave de servicio.
