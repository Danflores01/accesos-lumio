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

---

## Parte 2. Técnica

Código: `funciones/sparked/whatsapp.ts` (módulo aparte; `index.ts` lo llama). Pruebas sin llaves: script de Node 24 que importa el módulo con un `Deno` falso y simula `fetch` y Supabase.

### Secretos

- `GREEN_API_ID_INSTANCE`, `GREEN_API_TOKEN_INSTANCE`: obligatorios. Con los dos, `motorWhatsApp()` es `true` (y `/admin/ping` muestra `motores.whatsapp: true`).
- `GREEN_API_URL`: opcional; la «apiUrl» de la instancia. Por defecto `https://api.green-api.com`.
- Token del webhook: no es un secreto aparte. Es `sha256(GREEN_API_TOKEN_INSTANCE + ":sparked-whatsapp-webhook-v1")`. `configurar` lo pone en `webhookUrlToken`; Green API lo manda como `Authorization: Bearer <token>`.

### Métodos de Green API usados

`sendMessage` (`chatId`, `message`, `linkPreview` → `idMessage`), `checkWhatsapp` (`chatId` → `existsWhatsapp`), `getStateInstance` (→ `stateInstance`), `getSettings` (`wid`, `webhookUrl`, `webhookUrlToken`, `incomingWebhook`) y `setSettings` (→ `saveSettings`). Formato: `{apiUrl}/waInstance{idInstance}/{método}/{apiTokenInstance}`.

### Rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /publico` | pública | `{ whatsapp: boolean }` |
| `POST /whatsapp/webhook` | Green API | Siempre responde 200 al instante. Con token malo, o con el motor apagado, no hace nada. Procesa en segundo plano. |
| `GET /admin/whatsapp` | admin | `{ motor, estado_instancia, numero, enviados_7d, fallidos_7d, compartir_7d, ultimo_error, webhook_configurado }` |
| `POST /admin/whatsapp/configurar` | admin | `setSettings`: `webhookUrl` = `…/functions/v1/sparked/whatsapp/webhook`, `webhookUrlToken`, `incomingWebhook` y `stateWebhook` en `yes`; avisos de salida, llamadas, encuestas, ediciones, borrados y acuses en `no`; `markIncomingMessagesReaded` `no`; `linkPreview` `yes`; `delaySendMessagesMilliseconds` 15000. Green API reinicia la instancia y aplica en unos 5 minutos. |
| `POST /admin/whatsapp/prueba { telefono }` | admin | Manda un mensaje de prueba. |
| `POST /admin/whatsapp/reenviar { compra_id }` | admin | Reenvía la entrega de una compra pagada con guía completa (`guias.reporte.etapa = 'completa'`); link = `<sitio>guia.html#<accesos.token>`. |

### Entrega: `avisarPorWhatsApp(c, compra, { titulo, link, expira_en }, { forzar? })`

- Nunca lanza errores; devuelve `{ ok, estado }` y actualiza `compras.wa_estado`, `wa_enviado_en`, `wa_detalle`.
- Estados: `enviado` · `en_cola` (instancia sin sesión: Green API guarda la cola 24 horas) · `sin_whatsapp` · `sin_telefono` · `sin_motor` · `fallido` · `ya_enviado` (no se mandó por ser repetida).
- Idempotente: reclama la compra con `update … where wa_estado is null`; solo una ejecución gana. `forzar: true` (reenvío del panel) manda otra vez.
- Si la instancia está `blocked` o `suspended`, no manda. Si el envío falla, aviso a Daniel (máximo uno por hora). Desconexión: aviso máximo uno al día.

### Números de México

Las compras guardan `+52` + 10 dígitos (las viejas, 10 dígitos sin lada: también son de México). En WhatsApp muchos celulares mexicanos existen como `521` + 10 dígitos. Antes de mandar se consulta `checkWhatsapp` con `52…` y, si no existe, con `521…`, y se usa la forma que exista (`…@c.us`). Si `checkWhatsapp` falla (red o límite del plan), se usa `52…@c.us`: según la FAQ de Green API, WhatsApp redirige al chat correcto con o sin el «1». Al recibir mensajes se comparan los últimos 10 dígitos.

### Idioma por lada

- Español: +52 México y países de habla hispana: 34, 51, 53, 54, 56, 57, 58, 240, 502–507, 591, 593, 595, 598; y en +1, Puerto Rico (787, 939) y República Dominicana (809, 829, 849).
- Inglés: el resto de +1 y cualquier otra lada (por ejemplo +55 Brasil, +44 Reino Unido).

### Comando «compartir»

- Se normaliza el texto: minúsculas, sin acentos, sin signos, comillas ni emojis.
- Es comando solo si quedan 1 o 2 palabras y una está a distancia de edición ≤ 2 de «compartir» (palabras de 6 letras o más) o ≤ 1 de «share» (4 letras o más). En inglés y en español se aceptan las dos palabras.
- Sí: `compartir`, `COMPARTIR!!`, `"compartir"`, `conpartir`, `compartr`, `compatir`, `share`, `shar`. No: `hola`, `gracias`, `comprar`, `ok`, `¿puedo compartir la guía con mi primo?`.
- Solo se responde a chats individuales (`@c.us` o `@lid`) cuyo número coincide con una compra pagada, máximo 2 respuestas por chat cada 24 horas. Tipos de mensaje leídos: `textMessage` (`textMessageData.textMessage`), `extendedTextMessage` y `quotedMessage` (`extendedTextMessageData.text`). Grupos (`@g.us`), estados, audios, imágenes y lo demás se ignoran.
- Avisos repetidos (mismo `idMessage`) se descartan con un índice único.

### Otros avisos del webhook

- `stateInstanceChanged`: `notAuthorized`, `blocked`, `suspended`, `yellowCard` o `sleepMode` → correo a Daniel (uno al día por estado).
- `quotaExceeded` (límite del plan Developer) → correo a Daniel (uno al día).
- `outgoingMessageStatus` con `failed` o `noAccount` (Green API los manda siempre) → la entrega pasa a `fallido` o `sin_whatsapp`.

### Tablas (migración `sql/migraciones/20261109_sparked_whatsapp.sql`)

- `compras`: `wa_estado`, `wa_enviado_en`, `wa_detalle`.
- `wa_mensajes`: `creado_en`, `direccion` (`entrada`/`salida`/`interno`), `tipo` (`entrega`, `compartir`, `prueba`, `ignorado`; internos: `aviso`, `estado`, `limite`), `chat`, `compra_id`, `estado`, `id_mensaje`, `detalle` corto. No guarda el texto de ningún mensaje. RLS activado sin políticas: solo entra la llave de servicio.
