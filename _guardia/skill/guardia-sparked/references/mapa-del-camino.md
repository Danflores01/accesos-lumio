# El camino del cliente, paso por paso

Todo lo que una familia hace desde que llega hasta que estudia. Para cada paso: qué ve, qué archivo y qué dirección
del servidor lo atienden, dónde queda registrado y cómo se comprueba. Si un paso se rompe, los de adelante no existen
para esa familia: por eso la guardia los revisa todos, no solo el que se acaba de tocar.

Servidor: `https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked` (en el sitio, `CONFIG.api` de
`sparked/js/config.js`). Sitio: `https://sparkeducation-mx.com/sparked/`.

| # | Paso | Lo que ve la familia | Sitio | Servidor | Queda en |
|---|---|---|---|---|---|
| 1 | Llegar | Portada, guía de ejemplo | `index.html`, `guia.html?demo=historia1` | `GET /publico`, `GET /datos-curiosos` | — |
| 2 | Subir fotos y ver la muestra | Formulario, barra de avance, vista previa de 4 pantallas | `crear.html`, `js/flujo.js` | `POST /borrador`, `POST /borrador/<clave>/generar`, `GET /borrador/<clave>` (cada 3 s), `GET /vista-previa/<folio>` | `borradores`, `trabajos` (tipo `generar`), `guias` (etapa `vista_previa`) |
| 3 | Pagar | Botón de pago o código; Mercado Pago | `crear.html`, `listo.html` | `POST /pago/crear`; Mercado Pago avisa a `POST /pago/mercadopago` | `compras` (`pendiente` → `pagada`), `codigos` |
| 4 | Esperar su guía | «Estamos armando tu guía», avance | `listo.html` | `GET /pago/estado/<folio>` (cada 8 s; también repara entregas interrumpidas) | `trabajos`, `compras.entregada_en` |
| 5 | Generar la guía completa | (nada: pasa en el servidor, ≈ 3 min) | — | `POST /trabajo/<id>/paso` (interno, encadenado); IA de Anthropic | `trabajos` (`listo` / `error`), `guias.cartucho.completo` |
| 6 | Recibir el link | Correo y WhatsApp con imagen y código QR | — | `entregarGuiaLista()` → Resend y Green API | `compras.correo_lista_en`, `compras.wa_estado`, `wa_mensajes`, `accesos` |
| 7 | **Abrir la guía** | La guía en pantalla | `guia.html#<clave>`, `js/reproductor.js` | `POST /acceso/<clave>/abrir` → `consumir_acceso` (7 días, 2 dispositivos) | `accesos.usos`, `primer_uso_en`, `acceso_dispositivos` |
| 8 | Estudiar | Teoría, juegos, resultados | `js/teoria.js`, `js/juegos.js`, `js/cartucho.js` | `POST /progreso/<clave>`, `POST /reporte` (bandera 🚩) | `progreso`, `reportes` |

## Qué puede romper cada paso y cómo se comprueba

**1. Llegar.** El sitio no publicó (construcción de GitHub Pages con error) o un archivo de `sparked/` quedó con un
error de sintaxis. → Prueba de humo (abre cada página); `gh api repos/Danflores01/accesos-lumio/pages/builds`.

**2. Fotos y muestra.** La IA no responde (sin saldo, llave mala, modelo saturado), las fotos no se leen, el trabajo se
atora. → `trabajos` recientes (consulta 3); `/admin/ping` → `motores.ia`; Resumen → «gasto de IA».

**3. Pagar.** Mercado Pago apagado o en modo de prueba, su aviso no llega (compra `pendiente` aunque ya pagaron), el
código no se acepta. → `/admin/ping` → `mercadopago`, `mercadopago_webhook`, `mercadopago_prueba` (debe ser `false`);
compras `pendiente` con `mp_estado = approved`; `POST /admin/compras/<id>/revisar` le pregunta a Mercado Pago.

**4 y 5. Esperar y generar.** El trabajo falla o se queda a medias: la familia ve «Estamos revisando tu guía». →
`/admin/resumen` → `entregas_con_error`; consulta 3; `POST /admin/trabajos/<id>/reintentar`.

**6. Recibir.** Correo que no sale (Resend), WhatsApp desconectado o número sin WhatsApp, teléfono mal escrito. →
`compras.correo_lista_en`, `wa_estado`, `wa_detalle`; `/admin/whatsapp` → `estado_instancia` debe ser `authorized`.
El link también aparece en `listo.html`, así que quien esperó en la página lo tiene aunque el mensaje falle.

**7. Abrir.** El paso más delicado: ya pagaron y ya tienen el link. Se rompe si el servidor no atiende la dirección que
pide el reproductor (10 nov 2026), si `consumir_acceso` falla, si el contenido llega dañado o si el reproductor truena
al armar una pantalla. → Prueba de humo («ABRIR UNA GUÍA»); avisos automáticos en Reportes; registro del servidor
(consulta 7); `node herramientas/probar-guia.mjs <id de la guía>`.

**8. Estudiar.** Un juego que no carga o una pantalla que se desborda. → `probar-guia.mjs` recorre todas las pantallas;
`herramientas/revisar-slides.mjs` revisa que todo quepa.

## El camino del paquete de 3 guías (24 nov 2026)

Otra puerta de entrada, con cuenta. Solo existe para las familias si el ajuste `sparked_paquete3` está en `si`
(panel → Paquetes); apagado, los botones no se ven y comprar responde «no disponible». Servidor: `cuenta.ts`.

| # | Paso | Lo que ve la familia | Sitio | Servidor | Queda en |
|---|---|---|---|---|---|
| P1 | Ver las opciones | Tres tarjetas: una guía, paquete de 3, suscripción «Próximamente» | `index.html` (botón «Paquetes y suscripción»), `paquetes.html`, `js/cuenta.js` | `GET /paquete/info` | — |
| P2 | Entrar | Su WhatsApp y un código de 6 dígitos | `cuenta.html` | `POST /cuenta/codigo` (WhatsApp; respaldo por correo), `POST /cuenta/entrar` | `cuenta_codigos`, `cuentas`, `cuenta_sesiones` (máx. 2 abiertas) |
| P3 | Pagar el paquete | Mercado Pago (tarjeta, OXXO o SPEI) y de regreso «Ya tienes 3 guías» | `cuenta.html?compra=<folio>` | `POST /paquete/comprar`; Mercado Pago avisa a `POST /pago/mercadopago`; `GET /paquete/estado/<folio>` | `compras` (`producto = paquete3`), `cuenta_saldo_movimientos` (+3, una sola vez) |
| P4 | Mi cuenta | Saldo, vencimiento, guías hechas, paquetes | `cuenta.html` | `GET /cuenta` (también devuelve al saldo una guía que se quedó a medias) | `cuenta_saldo_movimientos` |
| P5 | Crear una guía con saldo | «Se usará 1 de tus 3 guías», avance y su link | `crear.html?saldo=1`, `cuenta.html?guia=<folio>` | `POST /borrador`, `POST /cuenta/guia` (descuenta 1 y lanza la guía completa), `GET /cuenta/guia/<folio>` | `compras` (`metodo_pago = saldo`, monto 0), `trabajos` (`alcance = completa`), `cuenta_saldo_movimientos` (−1; +1 si falla) |
| P6 | Recibir y abrir | Igual que una guía suelta (pasos 6 a 8); el mensaje dice cuántas guías le quedan | `guia.html#<clave>` | `entregarGuiaLista()`; `POST /acceso/<clave>/abrir` | `compras.entregada_en`, `accesos` |

**Qué puede romperlo y cómo se comprueba**

- **No llega el código.** WhatsApp desconectado o número sin WhatsApp: el código va al correo de respaldo; sin correo, no
  llega. → `cuenta_codigos.envio` de ese número (`enviado`, `sin_whatsapp > correo`, `sin_correo`); `/admin/whatsapp`.
- **Pagó y no tiene sus guías.** El aviso de Mercado Pago no llegó, o se interrumpió el abono. → Ronda, parte 4b
  («pagado y sus guías no están en su cuenta»); panel → Paquetes → «Revisar en Mercado Pago» o «Abonar ahora».
- **Su guía no se creó.** Se devuelve sola al saldo y la compra queda «fallida»; la familia recibe el aviso. → Panel →
  Paquetes → movimientos de la cuenta («Guía devuelta», con el motivo); `trabajos.error`.
- **«Tu cuenta ya está abierta en 2 dispositivos».** Es el límite, no un fallo: al aceptar se cierra la sesión más antigua.
- **Las cuentas no cuadran.** → `node herramientas/probar-saldo.ts` (sin internet) y
  `node <carpeta de la skill>/scripts/probar-paquete.mjs` (en vivo, con una cuenta de prueba).
- **Remedio rápido si algo del paquete falla:** apagar la venta en el panel (Paquetes → «Venta del paquete» → Apagada).
  No hace falta desplegar nada y la venta de guías sueltas no se toca.

## El camino de la suscripción mensual «Guías ilimitadas» (25 nov 2026)

349 pesos al mes, solo con tarjeta, 7 días gratis (una vez por WhatsApp y por tarjeta), sin tope de guías. Cuelga de la
misma cuenta del paquete. **Nace apagada:** el ajuste `sparked_suscripcion` (panel → Suscripciones → «Quién puede
suscribirse») vale `no` (nadie), `probadores` (solo los WhatsApp de la lista `sparked_suscripcion_probadores`) o `si`
(pública; ese paso necesita el sí de Daniel). La portada dice «Próximamente» en cualquier modo. Servidor:
`suscripcion.ts` (la lógica y `/admin/suscripciones…`) y `cuenta.ts` (recibe `/suscripcion/*` porque conoce la sesión).

| # | Paso | Lo que ve la familia | Sitio | Servidor | Queda en |
|---|---|---|---|---|---|
| S1 | Suscribirse | En «Mi cuenta»: la casilla del cobro automático y «Suscribirme»; pone su tarjeta en Mercado Pago | `cuenta.html` (caja «Suscripción mensual»), regreso `cuenta.html?suscripcion=<id>` | `POST /suscripcion/crear` (crea la suscripción en Mercado Pago: `POST /preapproval`), `GET /suscripcion/estado` | `suscripciones` (`pendiente` → `en_prueba` o `activa`), `pruebas_usadas` |
| S2 | Crear guías | «Guías ilimitadas» y el mismo formulario; la guía sale completa | `crear.html?saldo=1`, `cuenta.html?guia=<folio>` | `POST /cuenta/guia` (usa la suscripción y no toca el saldo) | `compras` (`metodo_pago = suscripcion`, monto 0, `suscripcion_id`) |
| S3 | Cobro de cada mes | Aviso 6 días antes y «Cobramos $349» | — | Mercado Pago avisa a `POST /pago/mercadopago` (temas `subscription_preapproval`, `subscription_authorized_payment` y `payment`); `sparked_registrar_cobro` alarga el periodo una sola vez | `suscripcion_cobros` (el id del pago es único), `suscripciones.periodo_fin` |
| S4 | Cobro rechazado | «No pudimos cobrar»: abre sus guías, no crea nuevas; a los 10 días, vencida | `cuenta.html` | el mismo aviso; `POST /admin/suscripciones/diario` | `suscripciones` (`en_gracia` → `vencida`) |
| S5 | Cancelar | «Cancelar suscripción» → una confirmación con la fecha → el mensaje de Daniel | `cuenta.html` y `cuenta.html?cancelar=1` (link del aviso) | `POST /suscripcion/cancelar` (cancela en Mercado Pago: `PUT /preapproval/<id>`) | `suscripciones` (`cancelada`; conserva lo pagado hasta `periodo_fin`) |

**Qué puede romperlo y cómo se comprueba**

- **«Puse mi tarjeta y no se activa».** Con prueba gratis se activa al autorizar; sin prueba, cuando Mercado Pago aprueba
  el primer cobro (minutos, a veces una hora). → Panel → Suscripciones → «Revisar en Mercado Pago» (pregunta por la
  suscripción y por sus cobros). Si el tema «Planes y suscripciones» no está activado en los Webhooks de Mercado Pago,
  igual se activa cuando la familia regresa a «Mi cuenta» o al revisar.
- **Canceló y Mercado Pago no respondió.** Aquí queda cancelada de inmediato y la familia recibe su comprobante; la
  ronda marca FALLA «sigue sin cancelarse en Mercado Pago» hasta que se confirme (se reintenta en la revisión diaria).
- **La revisión diaria no corre sola todavía.** `POST /admin/suscripciones/diario` (panel → Suscripciones → «Correr la
  revisión diaria ahora») manda el aviso de renovación, pasa a gracia y vence. Sin ella no sale el aviso que pide la ley
  (5 días antes): la ronda lo marca FALLA. Programarla necesita el sí de Daniel.
- **«Me cobraron y había cancelado».** El cobro queda anotado, la suscripción sigue cancelada y Daniel recibe el aviso
  para reembolsar en Mercado Pago. → Panel → Suscripciones → bandera «revisar».
- **Las cuentas no cuadran.** Un cobro es venta solo si Mercado Pago lo aprobó; las guías de suscripción no son ventas.
  → `node herramientas/probar-suscripciones.ts` (sin internet) y `scripts/probar-suscripcion.mjs` (en vivo).
- **Remedio rápido:** poner el modo en «Apagada» (panel → Suscripciones). Nadie nuevo puede suscribirse; quien ya está
  suscrito sigue igual y puede cancelar. No hace falta desplegar nada.

## Las partes del servidor y su orden

`funciones/sparked/index.ts` recibe todo. Antes de sus propias rutas llama a los módulos aparte, en este orden:
`acceso.ts` (entrada del panel), `extras.ts` (comentarios, costos, borrar códigos), `whatsapp.ts` (entregas, chats),
`cuenta.ts` (cuentas, saldo y paquete de guías: `/cuenta/*`, `/paquete/*`, `/admin/paquetes`, `/admin/cuentas/*`; y las
rutas de la familia de la suscripción, `/suscripcion/*`) y `suscripcion.ts` (solo `/admin/suscripciones…`). Un
módulo que conteste en una dirección que no es suya **tapa** la ruta verdadera. `herramientas/probar-rutas.mjs` lo
revisa; si agregas una ruta a `index.ts`, agrégala a su lista.

La generación vive en `pipeline.ts` y `prompts.ts`. El despliegue es por puente
(`funciones/puente-sparked/index.ts`): ver `publicar-rapido.md`.

## Lo que no se toca

La fase 1 (`accesos/`, `entrar.html`, el `panel.html` de la raíz, las funciones `ir` y `admin`, la carpeta `icons/`)
es otro producto que sigue vivo. Un arreglo de SparkEd nunca la modifica.
