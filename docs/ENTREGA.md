# Entrega de guías de SparkEd (fase 2) — detalle técnico

Versión del servidor: `2026-11-09.1` (función `sparked`). Resumen para Daniel en `GUIA.md`, sección «Entrega de la guía».

## 1. Privacidad de los accesos

Cada compra pagada de la fase 2 tiene **su propio acceso** (fila en `accesos`, token propio de 14 caracteres) dentro de
una clase de tipo `guia` (una clase por guía: `guias.clase_id`). `compras.acceso_id` apunta a ese acceso.

- El límite de 2 dispositivos es **por acceso**, no por clase: `consumir_acceso(p_token, …, p_dispositivo)` cuenta las
  filas de `acceso_dispositivos` con `acceso_id` = ese acceso y compara con `clases.max_dispositivos` (2). La llave
  primaria de `acceso_dispositivos` es `(acceso_id, dispositivo_sha256)`. Si otra familia compra la misma guía de
  biblioteca, recibe otro acceso con su propio contador.
- Comprobado con SQL el 9 nov 2026: 4 compras pagadas → 4 accesos distintos → 4 tokens distintos; dispositivos
  registrados 2, 1, 2 y 1 (ninguno pasa de 2).
- La app de la fase 1 (`funciones/admin`, panel de clases de Lumio) **ya no muestra** nada de la fase 2:
  - `GET /admin/api/clases` excluye `tipo = 'guia'` (antes aparecían las guías vendidas como «clases activas» y
    cancelarlas le quitaba el acceso a un cliente).
  - `GET /admin/api/accesos` sin `clase_id` excluye los accesos de clases `guia`.
  - `GET /admin/api/eventos` sin `clase_id` excluye los intentos de links de guías.
  - Las rutas por id (`PATCH/DELETE /clases/:id`, `/accesos/:id/...`) no cambiaron: la app de la fase 1 ya no conoce
    esos ids.
- El acceso de una guía solo lo administra el panel de SparkEd (`sparked/panel.html` → `/sparked/admin/...`).

## 2. Estados de una compra

| Momento | `compras` | Lo que ve la familia (`listo.html`, `/pago/estado`) |
| --- | --- | --- |
| Pendiente (OXXO, SPEI, tarjeta en revisión) | `estado = pendiente` | Instrucciones del pago (igual que antes) |
| Pago confirmado, guía sin terminar | `estado = pagada`, `acceso_id` puesto, `entregada_en = null` | Espera: barra de avance, `guia_lista: false`, `progreso`, `estimado_seg`; **sin `link` ni `token`** |
| Generación fallida o revisión final no pasada | igual, `aviso_revision_en` puesto | «Estamos revisando tu guía» (`revision: true`) |
| Entregada | `entregada_en` puesto | «¡Tu guía está lista!» con `link`, `token`, `expira_en` |

Columnas nuevas (migración `sparked_entrega_guia_completa`, solo añade): `compras.entregada_en` y
`compras.aviso_revision_en`. Las 4 compras pagadas anteriores se marcaron entregadas con `coalesce(correo_lista_en,
pagada_en)`. `correo_lista_en` se sigue llenando (igual que `entregada_en`) por compatibilidad.

## 3. Flujo en el servidor (`funciones/sparked/index.ts`)

1. **Pago confirmado** (`confirmarPago` desde Mercado Pago, Stripe, código gratis o «Confirmar pago» del panel) →
   `entregar(compra)`: crea una sola vez la clase y el acceso (7 días, 2 dispositivos), avisa a Daniel de la venta
   (`avisarVenta`) y, si la guía no está completa, lanza el trabajo `resto` (`lanzarResto`). No manda nada a la familia.
2. **Guía completa** → `entregarGuiaLista(compraId)`, que se llama:
   - en `entregar()` si la guía ya estaba completa (biblioteca);
   - en `alFinalizar()` al terminar la generación (`entregarPendientes(guiaId)`: todas las compras que esperan);
   - en `GET /pago/estado` como red de seguridad (si la entrega se interrumpió);
   - al subir un cartucho a mano en el panel (`POST /admin/guias/:id/cartucho`).
3. `entregarGuiaLista` revisa `verificarCartucho()`; si pasa, marca `entregada_en` con un `update … where entregada_en
   is null` (paso atómico: un solo correo aunque lleguen varias llamadas juntas), pone `accesos.expira_en` = ahora + 7
   días si el link no se ha abierto (`primer_uso_en is null`), alarga `guias.borrar_en` y `borradores.expira_en`, y manda
   en paralelo (`Promise.allSettled`) el correo de entrega (`enviarCorreo`) y `avisarPorWhatsApp(ctxBase(), compra,
   { titulo, link, expira_en })`. Que falle uno no impide el otro. El log dice `Guía entregada <compra> correo: … whatsapp: …`.
4. **Correos a la familia** en el caso normal: UNO, el de entrega (asunto «{Nombre}, tu guía de SparkEd ya está lista:
   {título}»). Se eliminó el correo «se está terminando» y el segundo correo «tu guía completa está lista».
5. `POST /admin/compras/:id/reenviar` solo reenvía si la compra ya fue entregada (si la guía está completa y verificada
   pero no se había entregado, la entrega normal sale en ese momento). Si no, responde 409.
6. `POST /acceso/:token` con la guía sin terminar responde `generando` (202) o `revisando`: red de seguridad para un
   link abierto antes de tiempo. El ajuste `sparked_jugar_durante_generacion` ya no se usa.
7. `GET /admin/compras` añade `guia_lista` (la guía está completa), `entregada_en` y, en `acceso`, `dispositivos`,
   `max_dispositivos`, `primer_uso_en` y `ultimo_uso_en`. Sigue devolviendo `link` (es para Daniel; el panel decide si
   lo muestra antes de `entregada_en`).

## 4. Verificación final (`verificarCartucho` en `funciones/sparked/pipeline.ts`)

Función pura, sin IA. Devuelve la lista de problemas (vacía = pasa):
- `completo === true` y que no sea una vista previa;
- al menos un bloque; cada bloque con al menos una pista con contenido y al menos un juego;
- solo tipos que el reproductor conoce (`opcion_multiple`, `completar`, `verdadero_falso`, `super_dato`, `conceptos`,
  `quien_es_quien`, `ordenar`, `clasificar`, `duelo`; en mini-examen y duelo, preguntas de opción múltiple, completar o
  verdadero o falso);
- los mínimos del generador (`faltasDeBloque`, contando el duelo): preguntas ≥ 5, conceptos ≥ 4 parejas, quién es quién
  ≥ 3, clasificar ≥ 6 tarjetas en 2 grupos;
- slides estimadas ≤ máx(32, presupuesto del plan + 2).

Se aplica en `alFinalizar()` (si no pasa, la guía se guarda con `completo = false`, `reporte.verificacion_final` lleva
los problemas y el trabajo queda en `error`) y otra vez en `entregarGuiaLista()`. Pruebas en la prueba local
`probar-pipeline.mts` (casos «verificación: …»). Con los datos del 9 nov 2026, las guías generadas con el código actual
pasan; las de pruebas viejas (antes de las reglas de mínimos) no pasarían, pero ya estaban entregadas o no tienen compras.

## 5. Qué pasa si falla

- **La generación falla de forma definitiva** (3 intentos de un paso, o 6 interrupciones): `avisarRestoFallido` →
  correo a Daniel (una vez por trabajo) y `avisarRevision(compra)` a cada familia que espera: correo «Recibimos tu pago
  (folio …). Estamos revisando tu guía … No necesitas hacer nada más» (una vez por compra, `aviso_revision_en`).
- **No se pudo lanzar el resto** al pagar: aviso a Daniel y el mismo correo de revisión a la familia.
- **La verificación final no pasa**: igual que una falla (trabajo `resto` → `avisarRestoFallido`; otros casos →
  `avisarRevisionDeGuia`).
- **Arreglo**: panel → la guía → ↻ Reintentar (el trabajo vuelve a correr) o subir el cartucho corregido. En cuanto la
  guía queda completa y pasa la verificación, sale la entrega normal (correo + WhatsApp). Si el problema es de la
  verificación (no de la IA), Reintentar repite el mismo resultado: hay que regenerar o subir el cartucho corregido.

## 6. Vista previa de 4 slides

`recortarVistaPrevia` (servidor, `pipeline.ts`) manda solo lo que se muestra: el bloque 1 con UNA pista (la primera que
cabe en una página), el primer juego de preguntas (hasta 6) y otro formato (conceptos, clasificar, verdadero o falso u
ordenar; sin juego de preguntas, dos formatos distintos); sin calentamiento. `GET /borrador/:clave` y
`GET /vista-previa/:id` recortan siempre del cartucho guardado (las vistas previas viejas guardadas en
`guias.vista_previa` ya no se usan si hay cartucho). El reproductor (`prepararVistaPrevia` y `slidesVistaPrevia` en
`cartucho.js`, `montar` en `reproductor.js`) deja exactamente portada, una página de teoría y dos juegos de formato
distinto, más el candado (que sigue diciendo cuántos bloques y actividades trae la guía completa). La generación no
cambió: el bloque 1 se sigue generando completo porque se reutiliza al pagar.
