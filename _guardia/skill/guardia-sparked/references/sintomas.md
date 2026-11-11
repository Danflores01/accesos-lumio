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

## Quién decide

- **La guardia arregla sin preguntar:** lo que restablece el servicio sin tocar a una familia en particular. Publicar
  una corrección del sitio, reintentar un trabajo atorado, relanzar una construcción, pedirle a Mercado Pago el estado
  de un pago.
- **Daniel decide** (se le propone en una línea y se espera su sí): mandar o reenviar un mensaje a una familia,
  confirmar un pago a mano, extender o liberar un acceso, reembolsar, borrar datos, cambiar llaves o ajustes de sus
  cuentas, desplegar el servidor si el permiso fue rechazado.
- **Nunca:** abrir el link de una familia para «probar» (gasta uno de sus 2 dispositivos), imprimir claves, teléfonos,
  correos o nombres, tocar la fase 1.
