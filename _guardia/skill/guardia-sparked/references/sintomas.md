# Del síntoma a la causa

Daniel y las familias describen el fallo con sus palabras, casi nunca con el texto exacto de la pantalla (el 10 nov
2026 dijeron «algo salió mal» y la pantalla decía «Algo falló»). Por eso **no busques la frase: ubica la etapa**. La
ronda (`scripts/ronda.mjs`) y un aviso automático en Reportes suelen decirla solos; esta tabla es para cuando no.

Las consultas numeradas están en `consultas.md`. Las acciones que mandan mensajes a una familia o cambian su acceso
necesitan el visto bueno de Daniel (ver «Quién decide»).

## Avisos que llegan solos

| Lo que llega | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| Correo o aviso de GitHub «🚨 SparkEd: falló el vigilante automático» | La prueba de humo falló dos veces seguidas en GitHub: el sitio o el servidor no responden como deben. **Trátalo como un fallo de todos los clientes** hasta demostrar lo contrario. | El aviso trae las líneas `FALLA`. Corre la ronda: ¿sigue fallando? | Según la línea: «ABRIR UNA GUÍA» o «compra» → `publicar-rapido.md`. Si la ronda ya pasa, fue pasajero (Supabase o GitHub caídos unos minutos): anótalo y el aviso se cierra solo. |
| Reporte que empieza con `AVISO AUTOMÁTICO` (panel → Reportes), o correo «una guía pagada no abrió» | El reproductor de una familia no pudo abrir su guía por un fallo nuestro. Trae el código HTTP y el motivo. | Ronda; consulta 5 (reportes) y consulta 7 (fallos agrupados). | Como «Algo falló», abajo. |
| La ronda dice «el vigilante automático está apagado» | GitHub lo apaga solo si el repositorio pasa 60 días sin cambios, o alguien lo apagó. | `gh workflow list -R Danflores01/accesos-lumio --all` | `gh workflow enable guardia.yml -R Danflores01/accesos-lumio` |

## Al abrir la guía (ya pagó y ya tiene su link)

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| «Algo falló. No se pudo abrir la guía» | El servidor contestó algo inesperado a `POST /acceso/<clave>/abrir`, o el reproductor tronó al armar la guía. **Si le pasa a una familia, puede estarle pasando a todas.** | Ronda (línea «ABRIR UNA GUÍA»). Reportes: `AVISO AUTOMÁTICO` trae el código HTTP y el motivo. Consulta 7 (fallos agrupados). | Servidor tapado o caído → `publicar-rapido.md`. Contenido dañado → `probar-guia.mjs <id>` dice en qué pantalla truena; se corrige el reproductor o se regenera la guía. |
| «Enlace no válido» | La clave no existe: link cortado al copiarlo, o un acceso borrado. | ¿El link que tiene termina igual que el de su compra? (`/admin/compras` lo trae; no lo imprimas). | Reenviar el link completo (Daniel). |
| «Tu acceso venció» | Pasaron sus 7 días. | Consulta 2: `expira_en`. | Decide Daniel si lo extiende. |
| «Acceso en uso en otros dispositivos» | Ya lo abrieron en 2 dispositivos, o usan navegación privada (cada ventana cuenta como otro). | Consulta 2: `dispositivos`. | Que abran en el mismo navegador de antes, sin navegación privada. Liberar un dispositivo lo decide Daniel. |
| «Tu guía se está terminando de armar» y no avanza | El link se abrió antes de tiempo o el trabajo está atorado. | Consulta 3. | Atorado más de 5 min → reintentar el trabajo. |
| «Estamos revisando tu guía» | La generación falló después del pago. El Resumen del panel lo muestra en rosa (y a Daniel le llega un correo si tiene puesto su «correo de avisos»). | `/admin/resumen` → `entregas_con_error`; consulta 3 → `error`. | `POST /admin/trabajos/<id>/reintentar`. Si vuelve a fallar, leer el error: IA sin saldo, fotos ilegibles, límite de tiempo. |
| «Guía no disponible» / «Acceso cancelado» | La guía se archivó o el acceso se revocó. | `guias.estado`, `accesos.revocado`. | Decide Daniel. |
| Abre, pero un juego no carga o una pantalla se ve rota | Fallo del reproductor con ese contenido. | `node herramientas/probar-guia.mjs <id>` (recorre todas las pantallas, celular y computadora). | Corregir `teoria.js` / `juegos.js` y publicar; comprobar otra vez con la misma guía. |
| Se queda en la pantalla de carga | Fotos que no bajan, o un error antes de pintar. | `node herramientas/abrir-guia.mjs "<dirección>"` con una clave inventada y con `?demo=historia1`. | Según lo que muestre. |

## Pagó y no recibió

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| «Pagué y no me llegó nada» | (a) La compra sigue `pendiente`: el aviso de Mercado Pago no llegó. (b) Está `pagada` y la guía aún se genera. (c) Se entregó y el mensaje no llegó. | Consulta 1: `estado`, `mp_estado`, `completa`, `entregada_en`, `correo_lista_en`, `wa_estado`. | (a) `POST /admin/compras/<id>/revisar` (le pregunta a Mercado Pago). (b) Esperar o reintentar el trabajo. (c) Reenviar: lo hace Daniel desde Compras, o con su sí. |
| Pagó en OXXO o por transferencia y «no pasa nada» | Normal: Mercado Pago confirma horas después. | `metodo_pago`, `mp_estado = pending`, `mp_vence_en`. | Nada; avisar a Daniel para que se lo explique. |
| Le llegó el correo pero no el WhatsApp | Número sin WhatsApp, mal escrito, o el teléfono de SparkEd desconectado. | `wa_estado` (`sin_whatsapp`, `fallido`, `en_cola`), `wa_detalle`; `/admin/whatsapp` → `estado_instancia`. | Desconectado → Daniel escanea el código QR en Green API. Número mal → reenviar con su sí. |
| Le llegó el WhatsApp pero no el correo | Resend falló o el correo está mal escrito (o cayó en spam). | `correo_lista_en`; `/admin/ping` → `motores.correo`. | El link del WhatsApp es el mismo. |
| «Me cobraron dos veces» | Dos compras del mismo teléfono. | Consulta 1 por hora. | Decide Daniel (reembolso en Mercado Pago). |

## Antes de pagar (está a punto de comprar)

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| «Algo salió mal. Intenta de nuevo en un momento» en el formulario o al pagar | El servidor respondió con error o sin mensaje. Es el aviso general de `crear.html` y `listo.html`. | Consulta 7 (fallos agrupados): qué dirección falla y con qué código. | Según la dirección: `/borrador` → IA o subida de fotos; `/pago/crear` → Mercado Pago o códigos. |
| La muestra no termina de generarse | Trabajo atorado o IA sin responder. | Consulta 3; `/admin/ping` → `motores.ia`. | Reintentar; si es la IA, revisar saldo y estado de Anthropic. Avisar a Daniel: sin IA no hay ventas. |
| «No pudimos terminar tu guía» o «Las fotos no parecen material de estudio» | Fotos borrosas o que no son apuntes; a veces, la IA falló. | Consulta 3 → `error` del trabajo. | Si el error habla de las fotos, no es fallo del sistema: pedir mejores fotos. Si habla de la IA o del tiempo, reintentar. |
| El botón de pago no abre Mercado Pago | `POST /pago/crear` falló o Mercado Pago está apagado. | `/admin/ping` → `mercadopago`; consulta 7. | Llave vencida o mal puesta → la pone Daniel en Supabase. |
| «Ese código no es válido» | Código apagado, agotado, vencido o mal escrito. | Panel → Códigos → «Últimos intentos». | Decide Daniel. |
| La página no carga o se ve sin diseño | El sitio no terminó de publicarse. | Prueba de humo; `gh api repos/Danflores01/accesos-lumio/pages/builds`. | Relanzar la construcción (`publicar-rapido.md`). |

## En el panel de Daniel

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| No puede entrar con correo y contraseña | Contraseña mal, cuenta sin crear o demasiados intentos (freno de 15 min). | `POST /acceso/entrar` responde 401 o 429. | Entrar con la clave de administrador (respaldo) y crear la contraseña en Ajustes. |
| «Los chats todavía no están disponibles» / no cargan | El servidor desplegado no trae esa ruta, o Green API no respondió. | `/admin/ping` → versión; `/admin/whatsapp`. | Desplegar la versión pendiente o esperar a Green API. |
| «El panel dice más ventas (o más pesos) de los que cobré» | Una compra solo es venta si de verdad se cobró: Mercado Pago aprobado, o confirmada a mano como «cobrada por fuera». Las de código y las cortesías (confirmadas a mano sin cobro) no cuentan. El 10 nov 2026 el panel decía 5 ventas y $500 porque sumaba 2 compras marcadas a mano que nadie pagó. | Compras pagadas con su método y estado de Mercado Pago (`metodo_pago`, `mp_estado`); `node herramientas/probar-ventas.mjs`. La versión desplegada debe ser 2026-11-10.8 o más nueva. | En Compras, cada confirmada a mano tiene un botón para decir si fue cortesía o cobrada por fuera: lo decide Daniel. |
| Un número del Resumen se ve raro | Datos, no un fallo de cliente. | `/admin/resumen`. | Fuera de la guardia, salvo que esconda compras sin entregar. |

## Con un paquete de guías (cuenta, saldo y «Mi cuenta»)

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| «No me llega el código» | WhatsApp desconectado, número sin WhatsApp o número mal escrito. El código va entonces al correo de respaldo de su cuenta. | `/admin/whatsapp` → `estado_instancia`; `cuenta_codigos.envio` de ese número (consulta por teléfono; no lo imprimas). | Que lo pida «por correo» en la misma pantalla, o que revise su número. Frenos: 3 códigos por hora por número. |
| «Pagué el paquete y no tengo mis guías» | El aviso de Mercado Pago no ha llegado (OXXO y SPEI tardan), o el abono se interrumpió. | Ronda, parte 4b; panel → Paquetes: ¿su paquete dice «Pagada» y «Sus guías ya están en su cuenta»? | «Revisar en Mercado Pago»; si ya está pagado y sin abonar, «Abonar ahora». Marcarlo pagado a mano lo decide Daniel. |
| «Mi guía no se pudo crear» | La generación falló o las fotos no eran material de estudio: la guía **regresó sola a su saldo**. | Panel → Paquetes → su cuenta: movimiento «Guía devuelta (no se pudo crear)» con el motivo. | Que la cree de nuevo con fotos claras. Si falla varias veces con buenas fotos, es del generador: consulta 3. |
| «Tu cuenta ya está abierta en 2 dispositivos» | Es el límite, no un fallo. | — | Aceptar cierra la sesión del dispositivo más antiguo. |
| «No tienes guías disponibles» y dice que sí pagó | Su saldo venció (90 días), ya las usó, o pagó con otro número. | Panel → Paquetes: busca por folio o por los últimos 4 dígitos. | Sumar una guía a mano («＋ Sumar una guía») lo decide Daniel. |
| «El pago no se completó» al regresar de Mercado Pago | Su pago fue rechazado, o regresó con «Volver a la tienda» sin pagar (Mercado Pago manda entonces a `cuenta.html?compra=…&pago=fallido`). No hubo cargo. | Panel → Paquetes: su paquete sigue «pendiente de pago». | Que oprima «Intentar de nuevo»: usa la misma compra, no la duplica. |
| Algo raro en todo el paquete | — | `node scripts/probar-paquete.mjs` (unas 40 comprobaciones en vivo, cerca de un minuto). | Si falla: apagar la venta del paquete en el panel (no necesita despliegue) y avisar a Daniel. |

## Con la suscripción mensual «Guías ilimitadas»

Nace apagada (25 nov 2026): solo la ven los WhatsApp de la lista de probadores (panel → Suscripciones). El cobro lo hace
Mercado Pago; aquí vive el estado. Un cobro es venta solo si Mercado Pago lo aprobó.

| Lo que ve o dice | Qué significa | Comprobar | Arreglar |
|---|---|---|---|
| «No veo dónde suscribirme» | La suscripción está apagada, o su WhatsApp no está en la lista de probadores (o no ha pasado el minuto que tarda el cambio). | Panel → Suscripciones → «Quién puede suscribirse». | Agregar su número a la lista lo decide Daniel. Abrirla al público también. |
| «Puse mi tarjeta y sigue diciendo que falta» | Con prueba gratis se activa en segundos; sin prueba, cuando Mercado Pago aprueba el primer cobro (hasta una hora). O su cuenta de Mercado Pago tiene otro correo que su cuenta de SparkEd y Mercado Pago rechazó el pago (el campo «Correo con el que pagas en Mercado Pago (si es otro)» va vacío: vacío = el correo de su cuenta de SparkEd). | Panel → Suscripciones → su renglón («Ver también las que no se contrataron»). | «Revisar en Mercado Pago». Si se rechazó: que oprima «Ya no quiero suscribirme» y se suscriba de nuevo escribiendo en ese campo el correo de su cuenta de Mercado Pago. |
| «No pudimos activar tu prueba gratis» | Esa tarjeta o esa cuenta de Mercado Pago ya había usado una prueba (una por WhatsApp y una por tarjeta). No se le cobró nada. | Su renglón: «No se contrató: … ya había usado su prueba gratis». | Puede suscribirse sin prueba. Regalar otra prueba lo decide Daniel. |
| «No puedo crear guías» y está suscrita | Su cobro no pasó: está «en gracia» (abre sus guías, no crea nuevas) y Mercado Pago lo reintenta 10 días. | Su renglón: «En gracia» y sus cobros («rechazado»). | Que cambie su método de pago: en «Mi cuenta» → «Cambiar método de pago» (o el link de su aviso). No hace falta cancelar; Mercado Pago cobra con la tarjeta nueva ese mismo día. |
| «Cambié mi tarjeta y sigue diciendo que no pudieron cobrar» | Mercado Pago tarda desde unos minutos hasta una hora en cobrar con el método nuevo («Mi cuenta» dice que está cobrando), o el método nuevo tampoco pasó (recibe otro aviso). | Su renglón: «Método de pago cambiado el…» y sus cobros. | «Revisar en Mercado Pago». Si el nuevo tampoco pasó, puede cambiarlo otra vez. |
| «Mercado Pago me dijo que se canceló mi suscripción» (y acaba de cambiar su tarjeta) | Es el cambio: Mercado Pago cancela el contrato de la tarjeta anterior y empieza el de la nueva. Su suscripción de SparkEd es la misma. | Su renglón sigue «Activa» (o «En prueba») y dice «Método de pago cambiado el…». | Nada. Si de verdad quedó cancelada, el renglón lo dice. |
| «Cambié mi tarjeta y me cobraron dos veces» | No debe pasar: el contrato anterior se cancela antes de usar el nuevo. Si pasara, queda la bandera «revisar» («posible cobro doble» o «cobro del contrato anterior»). | Su renglón: sus cobros y la bandera. | El reembolso lo hace Daniel en su cuenta de Mercado Pago. Avisarle. |
| «No me deja cambiar mi método de pago» | Mercado Pago está haciendo su cobro (menos de 3 horas para la fecha), acaba de cambiarlo y se espera el cobro, o ya lo intentó 6 veces hoy. | El mensaje que le salió lo dice. | Que lo intente en unas horas (o mañana). |
| «Cancelé y me cobraron» | Mercado Pago no confirmó la cancelación a tiempo. El cobro queda anotado y la suscripción sigue cancelada. | Su renglón: bandera «revisar» y «falta confirmar la cancelación en Mercado Pago». | «Revisar en Mercado Pago»; el reembolso lo hace Daniel en su cuenta de Mercado Pago. |
| «Me cobraron sin avisarme» | El aviso de renovación sale en la revisión diaria (6 días antes). Si nadie la corrió, no salió. | Ronda, parte 4c («no ha salido su aviso de renovación»). | Correr la revisión diaria (panel → Suscripciones) y avisar a Daniel: programarla necesita su sí. |
| «Mi guía no se pudo crear» (con suscripción) | La generación falló o las fotos no eran material de estudio. No hay saldo que devolver: la suscripción sigue igual. | Panel → Compras: «guía de suscripción», estado «fallida»; consulta 3. | Que la cree de nuevo con fotos claras (después de 3 fallas en un día se le pide una pausa). |
| Algo raro en toda la suscripción | — | `node herramientas/probar-suscripciones.ts` (sin internet) y `node scripts/probar-suscripcion.mjs` (en vivo, con una cuenta de prueba; no toca Mercado Pago). | Si falla: modo «Apagada» en el panel (no necesita despliegue) y avisar a Daniel. Quien ya está suscrito sigue igual. |

**Ojo al probar el cobro con un programa.** Mercado Pago no deja entrar a su página de pago a un navegador sin ventana
(Edge «headless») ni a un programa: responde 403 «Hubo un error accediendo a esta página», y responde lo mismo con un
link inventado. No es un fallo del paquete ni de la guía suelta. Lo que sí se puede comprobar con un programa es A DÓNDE
manda el sitio (`mercadopago.com.mx/checkout/v1/redirect?pref_id=…`); que ese link abre el cobro se comprueba en un
navegador de verdad, sin pagar: debe decir «SparkEd: paquete de 3 guías · $ 199» y ofrecer tarjeta, OXXO y SPEI.

## Quién decide

- **La guardia arregla sin preguntar:** lo que restablece el servicio sin tocar a una familia en particular. Publicar
  una corrección del sitio, reintentar un trabajo atorado, relanzar una construcción, pedirle a Mercado Pago el estado
  de un pago.
- **Daniel decide** (se le propone en una línea y se espera su sí): mandar o reenviar un mensaje a una familia,
  confirmar un pago a mano, extender o liberar un acceso, reembolsar, borrar datos, cambiar llaves o ajustes de sus
  cuentas, desplegar el servidor si el permiso fue rechazado.
- **Nunca:** abrir el link de una familia para «probar» (gasta uno de sus 2 dispositivos), imprimir claves, teléfonos,
  correos o nombres, tocar la fase 1.
