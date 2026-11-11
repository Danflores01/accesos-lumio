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

## Las partes del servidor y su orden

`funciones/sparked/index.ts` recibe todo. Antes de sus propias rutas llama a los módulos aparte, en este orden:
`acceso.ts` (entrada del panel), `extras.ts` (comentarios, costos, borrar códigos), `whatsapp.ts` (entregas, chats). Un
módulo que conteste en una dirección que no es suya **tapa** la ruta verdadera. `herramientas/probar-rutas.mjs` lo
revisa; si agregas una ruta a `index.ts`, agrégala a su lista.

La generación vive en `pipeline.ts` y `prompts.ts`. El despliegue es por puente
(`funciones/puente-sparked/index.ts`): ver `publicar-rapido.md`.

## Lo que no se toca

La fase 1 (`accesos/`, `entrar.html`, el `panel.html` de la raíz, las funciones `ir` y `admin`, la carpeta `icons/`)
es otro producto que sigue vivo. Un arreglo de SparkEd nunca la modifica.
