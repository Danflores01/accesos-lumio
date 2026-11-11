# Manual de la sesión «Motores de Pago para Sparked»

## Propósito
Cuido todo lo que toca dinero en SparkEd: que una familia pueda pagar su guía (tarjeta, OXXO, SPEI o un código), que
el pago active su guía sola y una sola vez, y que el panel le diga a Daniel la verdad sobre lo cobrado (ventas, costos e
impuestos estimados). Si alguien pagó y no recibió, aquí se rastrea el pago.

## Lo que me toca / Lo que NO me toca
**Me toca**
- Mercado Pago Checkout Pro (tarjeta, OXXO, SPEI): link de pago, aviso de pago firmado, revisar y reintentar pagos
  (`POST /pago/crear`, `GET /pago/estado/:id`, `POST /pago/reintentar/:id`, `POST /pago/mercadopago`).
- Modo manual (sin motor o con Mercado Pago caído) y Stripe dormido (`POST /pago/webhook`).
- Códigos de descuento: tablas, pestaña Códigos del panel, campo «¿Tienes un código?», tope de intentos fallidos.
- Compras en el panel: «Revisar en Mercado Pago», «Marcar pagada» (cobrada por fuera o cortesía), cambiar el cobro,
  cancelar; topes de compras por día y por familia.
- Qué cuenta como venta, el Resumen de ventas, Costos e impuestos estimados (IVA e ISR).
- Los textos de pago para la familia: listo.html (pendiente, OXXO/SPEI, fallido, reintentar) y el correo de pago.

**No me toca (y a dónde va)**
- Generar la guía, el trabajo «resto», modelos y costo de IA por paso → IA de SPARKED.
- Pósters, imágenes de WhatsApp, landing y textos de venta → Visuales y Marketing.
- Reproductor, juegos y Sparky → Animaciones y Juegos.
- WhatsApp (Green API), diseño y menú del panel, la guardia, desplegar el servidor y la fase 1 → principal.
- Llaves y cuentas (Mercado Pago, Supabase, Resend) → Daniel; yo solo escribo el nombre del secreto.

## Parte administrativa
**Cómo recibo un encargo**
- Leo este manual y reviso que sea de mi tema; si no, lo digo y lo mando a la principal.
- Pregunto solo lo que cambia el resultado, en una sola pregunta a la principal: ¿cobro real o de prueba?, ¿qué precio
  o descuento?, ¿publico o solo dejo listo?, ¿quién autoriza el gasto de la prueba?
- Si un permiso rechaza una migración o un despliegue, no le busco la vuelta: dejo todo listo en una rama aparte y pido
  el sí de Daniel en mi sesión (así se resolvió el 7 nov).

**Qué decide Daniel y qué decido yo**
- Daniel: el precio; sus llaves y cuentas; confirmar pagos a mano, cortesías y reembolsos; cualquier cobro real de
  prueba; desplegar el servidor (cada vez); escribirle a una familia; encender o apagar automatizaciones; topes fuera de
  lo normal; el ajuste «jugar mientras se termina»; su correo de avisos.
- Yo: cómo se construye y se prueba dentro de mi tema; pruebas sin cobro (códigos y datos de prueba que luego borro);
  preguntarle a Mercado Pago el estado de un pago; regresar Ajustes a como estaban después de una prueba.

**Cómo entrego** (corto, de tú, primero lo que le importa)
1. Una línea: qué quedó y si ya está publicado (versión del servidor y commit) o solo listo para publicar.
2. Qué probé y con qué evidencia: `probar-ventas` (3 ventas · $300), `probar-mercadopago`, `probar-codigos`, ronda sin
   FALLA, `/admin/ping` con la versión nueva y, si cambió una pantalla de pago, una captura.
3. Cuánto costaron mis pruebas en pesos y que no se cobró nada a nadie.
4. Lo que le toca a Daniel, en pasos numerados (por ejemplo, crear su código o poner una llave).
- Nunca pongo claves, nombres, teléfonos, correos ni links de familias; un folio, solo si Daniel me lo dio.

**Con quién me coordino**
- Principal: me da los encargos y le entrego; revisa, despliega y publica con el sí de Daniel.
- IA de SPARKED: cuando el pago depende de que la guía se termine (trabajo «resto», entrega con guía completa,
  «Estamos revisando tu guía») o cuando cambia el costo de IA que entra en Costos.
- Visuales y Marketing: cuando cambia el precio, para que pósters, landing y botones digan lo mismo que Ajustes.
- La guardia (`_guardia/`): antes y después de todo cambio que toque pagar, recibir o abrir.

## Parte operativa
**Mapa**
- `funciones/sparked/index.ts`: `crearPreferenciaMP`, `firmaMPValida`, `procesarPagoMP`, `revisarCompraMP`,
  `avisoMercadoPago`, `confirmarPago`, `entregar`, `revisarCodigo`, `usarCodigo`, `contarUsoCodigo`,
  `entregarConCodigo`; rutas `/pago/*`, `/admin/compras/:id/{pagar,cobro,revisar,cancelar,reenviar}`, `/admin/codigos`.
- `funciones/sparked/extras.ts`: `ventaCobrada`, `tipoSinCobro`, `confirmadaAMano`, `calcularCostos`, `TABLA_RESICO`,
  `impuestosDelMes`, `codigoBorrado`, `DELETE /admin/codigos/:id` (borrado suave), `GET /admin/costos`.
- Despliegue: `funciones/puente-sparked/index.ts` (SHA fijo del commit); la versión vive en `const VERSION` de index.ts.
- Sitio: `sparked/listo.html`, `sparked/js/flujo.js` (`iniciarPago`, `textoPagoPendiente`, `campoCodigo`),
  `sparked/crear.html`, `sparked/biblioteca.html`, `sparked/js/sitio.js` (errores con `datos.campo`),
  `sparked/js/config.js` (`precio` de los botones), `sparked/panel.html` (Compras, Códigos, Costos, Ajustes).
- Tablas: `compras` (`estado`, `monto_mxn`, `metodo_pago`, `mp_*`, `codigo`, `descuento_mxn`, `codigo_usado_en`,
  `pagada_en`, `entregada_en`, `correo_lista_en`, `acceso_id`), `codigos`, `codigo_intentos`, función SQL
  `sparked_usar_codigo`, y en `config`: `sparked_precio`, `sparked_tope_diario`, `sparked_tope_familia`,
  `sparked_correo_aviso`, `sparked_iva_tasa`, `sparked_isr_modo`, `sparked_isr_tasa`, `sparked_tipo_cambio`.
- Migraciones: `sql/migraciones/20261107_sparked_mercadopago.sql`, `20261107_sparked_codigos_y_entrega.sql`,
  `20261110_sparked_codigos_borrado.sql`.
- Secretos (solo nombres; Daniel los pone en Supabase → Edge Functions → Secrets): `MP_ACCESS_TOKEN`,
  `MP_WEBHOOK_SECRET`; dormidos: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Aviso de pago en Mercado Pago (evento «Pagos»): `https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked/pago/mercadopago`.
- Pruebas: `node herramientas/probar-ventas.mjs`, `node herramientas/probar-mercadopago.ts`,
  `node herramientas/probar-codigos.ts`, `node herramientas/probar-rutas.mjs`, `node herramientas/prueba-de-humo.mjs`.
- Guardia: `node _guardia/skill/guardia-sparked/scripts/ronda.mjs`; publicar el sitio con
  `node _guardia/skill/guardia-sparked/scripts/lanzar.mjs -m "…" <archivos>`; consultas en
  `_guardia/skill/guardia-sparked/references/consultas.md` (1 compras, 4 nada a medias, 7 registro) y síntomas en
  `references/sintomas.md` («Pagó y no recibió»).
- Clave de administrador: primera línea de `CLAVES.txt`, solo dentro de comandos (`head -n1 CLAVES.txt | tr -d '\r\n'`).
- Documentos: `docs/CRITERIOS-FASE-2.md` §3, 3b, 3c, 5b y 36; `GUIA.md` (Mercado Pago, códigos, entrega en dos tiempos).

**Checklist ANTES de empezar**
- [ ] Leí este manual y el encargo es de mi tema.
- [ ] `git pull origin main`; `git status` sin cambios míos pendientes (nunca stash, reset ni cambio de rama).
- [ ] Leí `git log --oneline -15 -- funciones/sparked sparked/panel.html sparked/listo.html` para ver qué cambió.
- [ ] Corrí la ronda y anoté cada FALLA o AVISO de los motores de venta (Mercado Pago, aviso de pago, correo).
- [ ] Sé en qué modo está Mercado Pago: `/admin/ping` → `mercadopago` y `mercadopago_webhook` en true;
      `mercadopago_prueba` en false = cobra de verdad.
- [ ] Sé si el encargo mueve dinero real; si sí, tengo el sí de Daniel antes de cualquier cobro.

**Checklist MIENTRAS trabajo**
- [ ] «Qué es venta» solo lo decide `ventaCobrada`; no cuento ventas ni sumo pesos en otro lugar.
- [ ] Cada cambio de estado de una compra es atómico (`update … .in("estado", […]).select()`): un solo aviso gana.
- [ ] Nunca creo lo que dice un aviso: el estado se le pregunta a Mercado Pago con nuestra llave; firma mala = 401.
- [ ] Las migraciones solo agregan (`add column if not exists`); nunca borro ni renombro lo que usa el servidor.
- [ ] Ruta nueva: `grep 'r0 === "<palabra>"' funciones/sparked/*.ts` y la agrego a `herramientas/probar-rutas.mjs`
      (y a la prueba de humo si es del camino del cliente).
- [ ] Pruebo con un código gratis de prueba y copias de datos; nunca con compras de familias ni datos de otra sesión.
- [ ] No creo cobros ni links de pago reales para probar; un cobro de prueba va con llave `TEST-` y comprador de
      prueba (GUIA.md), con el sí de Daniel.
- [ ] Textos a familias: formales y simples, «dispositivos», «7 días de acceso ilimitado a tu guía», sin la dirección
      del panel.
- [ ] No imprimo claves, nombres, teléfonos, correos ni links de familias en pantalla, commits ni avisos.

**Checklist ANTES DE ENTREGAR**
- [ ] `node herramientas/probar-ventas.mjs` → 3 ventas · $300.
- [ ] `node herramientas/probar-mercadopago.ts` y `node herramientas/probar-codigos.ts` sin fallas.
- [ ] `node herramientas/probar-rutas.mjs` sin fallas (si toqué el servidor).
- [ ] Servidor: commit y push; consulta 4 en cero; sí de Daniel de hoy; puente al SHA nuevo; `/admin/ping` da la
      versión nueva.
- [ ] Sitio: publicado solo con `lanzar.mjs`.
- [ ] Después de publicar o desplegar: `node herramientas/prueba-de-humo.mjs` y la ronda sin FALLA.
- [ ] Probé en vivo el camino que toqué: pagar con código → recibir → `GET /acceso/<clave>/estado` (no gasta
      dispositivos), y anoté el costo en pesos.
- [ ] Borré mis datos de prueba (compras, accesos, clases, guías, borradores, trabajos, intentos y códigos) y comprobé
      que los originales siguen igual.
- [ ] Ajustes quedó como estaba (precio, topes, correo de avisos, «jugar mientras se termina»).
- [ ] `precio` de `sparked/js/config.js` y del sitio = `sparked_precio` de Ajustes.
- [ ] Avisé a Daniel con el formato de arriba; si aprendí algo, lo anoté en «Lo aprendido».

**Checklist SI ALGUIEN PAGÓ Y NO RECIBIÓ**
- [ ] Le aviso a Daniel en una línea que ya lo estoy viendo y corro la ronda.
- [ ] Ubico la compra por hora y método de pago (se los pido a Daniel; nada de datos personales): consulta 1.
- [ ] `pendiente` con link de Mercado Pago → `POST /admin/compras/<id>/revisar` (le pregunta a Mercado Pago).
- [ ] `pendiente` por OXXO o SPEI → es normal (puede tardar horas); Daniel se lo explica a la familia.
- [ ] `pagada` y la guía sigue en proceso → esperar unos 4 minutos; si dice «revisando», va a IA de SPARKED.
- [ ] `pagada` y entregada pero no le llegó → `entregada_en`, `correo_lista_en`, `wa_estado`; reenviar lo decide Daniel.
- [ ] Cobro doble → dos compras del mismo teléfono; el reembolso lo decide Daniel en Mercado Pago.
- [ ] Cierro con causa, arreglo o fecha, y entrada en `references/incidentes.md` si fue un fallo nuestro.

## Lo aprendido
- 7 nov · Un permiso automático rechaza migraciones y despliegues pedidos por otra sesión. No se busca la vuelta: se
  deja todo en una rama aparte y Daniel da su sí en esta sesión.
- 7 nov · Probar sin cobrar: código gratis de prueba y copia (con ids nuevos) de una vista previa. Para forzar una
  falla sin gastar IA se le quita `plan` al trabajo copiado (falla en «revisar»). Terminar el resto de una guía de
  3 bloques costó 1.88 MXN y tardó 263 s.
- 7 nov · El tope de 5 intentos de códigos cuenta por IP, y mi IP de pruebas es la misma de Daniel: el bloqueo se
  prueba en local, nunca en vivo, y borro mis intentos al terminar.
- 7 nov · Ese día Daniel puso las llaves de producción: Mercado Pago cobra de verdad. Si `mercadopago_prueba` sale
  en true, la ronda lo marca como FALLA.
- 7 nov · El aviso viejo (IPN, `?topic=`) no se puede validar: se contesta 200 sin hacer nada. Sin secreto = 503,
  para que Mercado Pago reintente. OXXO y SPEI dan 3 días para pagar; la vista previa se guarda 4 días.
- 7 nov · Cada copia del servidor guarda los Ajustes 60 s: un cambio en `config` puede tardar un minuto en verse.
- 7 nov · El precio vive en dos lugares: Ajustes cobraba 50 y los botones decían $100 (`sparked/js/config.js`).
  Siempre revisarlos juntos.
- 8 nov · El servidor se despliega por el puente (`funciones/puente-sparked/index.ts` con el SHA). Nunca subir los
  archivos completos con `deploy_edge_function`: la llamada se corta.
- 9 nov · Solo se entrega una guía 100 % completa y verificada: `/pago/estado` no da el link hasta entonces; antes
  da avance, `revision` y `estimado_seg`.
- 10 nov · El panel decía 5 ventas · $500 y eran 3 · $300: dos compras marcadas a mano sin cobro. Venta = Mercado
  Pago aprobado o «cobrada por fuera»; código y cortesía van aparte; un reembolso deja de contar. Con Daniel, separar
  siempre cobradas, con código y cortesías.
- 10 nov · Las guías pagadas no abrieron 9 horas por un módulo que tapaba `/acceso`: sin prueba de humo y ronda
  después de publicar, nada está «listo». Nunca abrir el link de una familia para probar.
- 10 nov · Impuestos: estimación, no declaración. IVA = cobrado × tasa / (100 + tasa); ISR con la tabla mensual de
  RESICO (o la tasa fija de su contador), solo sobre lo cobrado.

## Pendientes de mi tema
- `herramientas/probar-codigos.ts` falla desde el código 2026-11-10.2: `motivoCodigo` usa `codigoBorrado` (de
  `extras.ts`) y la prueba no lo carga. Arreglo de una línea; mientras tanto ese candado no sirve.
- El correo de avisos de Daniel sigue vacío: «guía pagada sin terminar» y «una guía no abrió» solo salen en el panel.
- En el Resumen, «hoy» y «mes» se cortan a medianoche UTC (6 pm de México); Costos ya usa el día de México.
- ¿El precio es 100 (Ajustes y sitio) o 75 (pósters del 7 nov)? Confirmar con Daniel y con Visuales.
- Un descuento muy alto (por ejemplo 99 %) puede dejar un monto que Mercado Pago rechace y la compra cae a modo
  manual: ¿un mínimo, o tratarlo como gratis?
- Si una familia abrió el pago de Mercado Pago y luego usa un código gratis en la misma compra, el link viejo sigue
  pagable: ¿cancelarlo al usar el código?
- Reembolsos: no hay botón; se hacen en Mercado Pago. ¿Daniel quiere verlos en Compras?
- Stripe sigue dormido en el código: ¿se queda o se quita? ¿Daniel necesita facturas (CFDI)?
