# SparkEd Accesos: tu app para repartir accesos por WhatsApp

Pegas el link de Lumio de la clase, pulsas **Compartir por WhatsApp**, eliges el chat de la familia y
listo: esa familia recibe **su propio link**, con su propia vigencia. En cuanto lo compartes, la app ya
tiene otro link preparado para la siguiente persona. Cada link es de **una sola familia**: entra el
alumno desde su aparato (y, si hace falta, también desde el del papá o la mamá), pero si el link llega a
otras personas ya no abre.

## Dónde está todo

| Pieza | Dónde |
|---|---|
| **La app** (celular y computadora) | https://sparkeducation-mx.com/accesos/ (la raíz del dominio abre la portada de SparkEd) |
| Clave de administrador | `CLAVES.txt` (archivo privado; nunca está en internet) |
| Lo que ve el alumno | `https://sparkeducation-mx.com/entrar.html#<código>` |
| Código fuente | https://github.com/Danflores01/accesos-lumio |
| Servidor (base de datos y funciones) | Supabase, proyecto `accesos-lumio`: https://supabase.com/dashboard/project/wfqfqfsbkqbaejnkhidz |
| Panel avanzado (con nombres y teléfonos) | https://sparkeducation-mx.com/panel.html |

Todo corre en planes gratuitos (GitHub Pages y Supabase Free).

Desde el 7 de noviembre de 2026 el sitio vive en el dominio propio `sparkeducation-mx.com` (DNS en GoDaddy, páginas en GitHub Pages con HTTPS obligatorio). Los links antiguos `danflores01.github.io/accesos-lumio/…` siguen abriendo porque GitHub los redirige al dominio nuevo; no hace falta reenviar nada.

La app de accesos quedó en `/accesos/` (https://sparkeducation-mx.com/accesos/); la raíz del dominio abre la portada pública de SparkEd. Si tenías la app instalada en el teléfono desde la dirección vieja, vuelve a instalarla desde la nueva dirección.

## Cómo se usa, paso a paso

1. **Primera vez:** abre la app y pega la primera línea de `CLAVES.txt` (solo la clave). Luego, en la tarjeta "Contraseña de acceso", guarda una contraseña fácil: con ella entras desde cualquier dispositivo. La clave del archivo sigue funcionando siempre como respaldo.
   Para el celular: abre la misma dirección en el navegador del teléfono y escribe tu contraseña
   con la cámara del teléfono. Luego agrégala a la pantalla de inicio (Compartir > "Agregar a
   inicio" en iPhone; menú > "Agregar a pantalla principal" en Android).
2. **Cada día de clase:** en Lumio copia el link de "Compartir" de la clase y pégalo en la app
   en "Clase de hoy" > Guardar.
3. **Cuando alguien te contacta:** si quieres, escribe quién pide el link en **¿Quién pide el link?**
   (mamá, papá o alumno; por ejemplo "Familia Pérez"; es opcional) y pulsa **Compartir por WhatsApp**.
   - En el celular se abre la hoja de compartir: eliges WhatsApp y el chat. El link se activa solo
     si de verdad compartiste (si cancelas, no se gasta).
   - En la computadora se abre WhatsApp Web o Escritorio con el mensaje listo; eliges el chat.
   - También puedes "Copiar mensaje" o "Copiar solo el link" y pegarlo donde quieras (eso también
     activa el link).
   El nombre aparece en la lista de links, en la imagen que se manda y al inicio del mensaje ("Hola
   Familia Pérez, tu acceso a…"; si tu texto usa `{nombre}`, va donde tú lo pongas); el alumno también lo ve
   en su página ("Acceso de: Familia Pérez"). Después de compartir, el campo queda vacío para el siguiente.
4. **Durante el día:** en "Links activos" ves cada link con su nombre (o su número), su estado y
   cuántos aparatos ya entraron con él:
   - **Enviado, sin abrir**: lo compartiste y nadie lo ha abierto.
   - **En clase**: ya entraron.
   - **Terminó su tiempo**: se cerró al pasar los minutos de "vivo después de entrar".
   - **Se acabaron sus entradas**: usaron todos los clics.
   - **Venció sin abrirse**: pasó la vigencia y nadie entró.
   - **Cancelado**: lo revocaste tú.
   - **Clase cerrada**: cerraste la clase.

   **Revocar** cancela un link al instante (por ejemplo, si alguien no pagó). **Renovar** (en los
   links que terminaron su tiempo, se agotaron o vencieron) vuelve a activar **el mismo link** desde
   ahora, con los ajustes actuales de la clase, con sus clics en cero y olvidando los aparatos que lo
   usaron: la familia entra con el link que ya tiene, sin que mandes otro.
   Si en un link ves **⚠️ 3 intentos desde otros aparatos**, alguien intentó entrar con él desde más
   aparatos de los permitidos: otra familia, o la misma desde un tercer aparato.
5. **Al día siguiente:** pega el link nuevo de Lumio. Los links viejos vencen solos. Si la clase tenía
   "Válido hasta", al llegar esa hora se cierra sola y pasa a "Clases anteriores".

## Ajustes de cada clase (se guardan en el servidor, valen igual en celular y computadora)

- **Acceso libre**: sin límite de tiempo, de clics ni de aparatos (ideal para una guía de estudio
  abierta).
- **Vigencia del link** (8 horas por defecto): horas que vive el link desde que lo compartes. Si no
  entran en ese tiempo, vence: "ya es problema del cliente".
- **Válido hasta** (opcional): una hora fija en la que termina la clase, por ejemplo las 19:00 del 21 de
  octubre. Con ella, cada link vale **hasta esa hora** (en vez de contar horas desde el envío), el mensaje
  y la imagen dicen "vence el 21 oct, 19:00", y al llegar la hora la clase se cierra sola: todos sus links
  quedan como "Clase cerrada" sin que hagas nada, y la app ya no deja preparar ni enviar más links de esa
  clase ("La clase ya terminó"). Déjalo vacío para que cada link cuente sus horas desde que lo compartes,
  como siempre. Las clases de acceso libre no lo usan.
- **Vivo después de entrar** (10 minutos por defecto): cuenta desde la primera entrada de la familia
  y sirve para que puedan recargar o reconectarse, pero no para que lo compartan después.
- **Clics máximos** (3 por defecto).
- **Aparatos por link** (2 por defecto): cuántos teléfonos, tablets o computadoras distintos pueden
  entrar con el mismo link. Dos alcanza para el caso típico: el papá recibe el link, lo abre o se lo
  reenvía al hijo, y el hijo entra desde su iPad. Un tercer aparato ya no entra.
- **Mensaje de WhatsApp** (en Ajustes generales): `{link}`, `{clase}`, `{hasta}`, `{horas}` y
  `{nombre}` (lo que escribiste en "¿Quién pide el link?") se rellenan solos. Si hay nombre y el texto no
  usa `{nombre}`, el mensaje empieza con "Hola (nombre),"; sin nombre, el mensaje sale como siempre.

Los ajustes aplican a los links nuevos de la clase y a los que renueves.

## Qué pasa del lado del alumno

Abre el link y ve la página SparkEd "Tu acceso está listo" con el nombre de la clase, "Acceso de:
Familia Pérez" si le pusiste nombre, y este aviso: *"Este acceso es para el alumno. Si eres mamá o
papá, reenvíaselo a tu hijo o deja que escanee el código; no hace falta que presiones Entrar."* Al
pulsar **Entrar a la clase** cae directo en Lumio.

La primera vez que un aparato entra, el servidor le asigna un secreto que la página guarda en ese
navegador; con él reconoce ese aparato en las entradas siguientes. Cuando ya entraron tantos aparatos
como permite la clase, cualquier otro ve: *"📵 Este acceso ya se usa en los aparatos permitidos. Si es
tu propio aparato, cierra la navegación privada y vuelve a abrir el link; si no, pídele al profesor un
link nuevo."* (La navegación privada no guarda el secreto, así que cada vez parece un aparato nuevo.)

Si el link ya terminó su tiempo, se agotó, venció o fue cancelado, ve un mensaje claro ("Este enlace
ya fue abierto y su tiempo de uso terminó. Pídele al profesor un enlace nuevo"); tú puedes renovarlo
desde la app sin mandarle otro.

En Lumio, el alumno entra como invitado o con su cuenta: eso lo decides tú en Lumio. Una vez
dentro, ve el link real de Lumio; esa segunda puerta la protege Lumio (reinicia el Class ID cuando
termine la cohorte para que ese link también cambie).

## Cómo se protege el link

- Código de 14 caracteres aleatorios (imposible de adivinar).
- Nace como **borrador**: no sirve hasta que lo compartes. Al compartir arranca su vigencia.
- Las **vistas previas de WhatsApp** nunca lo consumen: el código va después de `#` en la URL y los
  robots no lo ven; además el servidor ignora a los robots.
- Al pulsar "Entrar", el servidor consume el acceso de forma atómica, registra el aparato (solo el
  hash de su secreto) y anota el intento en la bitácora `eventos`; los intentos desde aparatos de más
  quedan anotados como `otro_dispositivo`.
- **Regla de familia**: cada link acepta hasta "Aparatos por link" aparatos distintos; las clases de
  acceso libre no la aplican.
- La base de datos no es legible con la clave pública de Supabase (RLS sin políticas). Solo las
  funciones del servidor la tocan, y el panel exige tu clave (guardada solo como hash).

## Si algo falla

- **"Clave de administrador incorrecta"**: revisa `CLAVES.txt`; sin espacios al inicio o al final.
- **El link se compartió pero "no se pudo activar"**: la app muestra un botón "Reintentar". Si
  sigue fallando, revisa tu conexión; el link no sirve hasta activarse.
- **Un alumno ve "ya se usa en los aparatos permitidos"** y sí es de esa familia: pulsa **Renovar**
  en su link (olvida los aparatos y reinicia el link) o sube "Aparatos por link" en la clase (aplica a
  links nuevos y renovados). Si no es de la familia, el link se filtró: revócalo y manda otro.
- **Cambiar la contraseña**: en la app, tarjeta "Contraseña de acceso" > Guardar contraseña. Si la olvidas, entra con la clave de `CLAVES.txt` (respaldo permanente) y pon otra. Si pierdes las dos, genera una nueva y su SHA-256, y en Supabase > SQL Editor ejecuta
  `update public.config set valor = '<hash>' where clave = 'admin_key_sha256';`.
  En PowerShell:
  ```powershell
  $k = -join ((1..32) | % { 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Get-Random -Max 55)] }); $k
  ($([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($k))) | % { $_.ToString('x2') }) -join ''
  ```
- **Volver a publicar la app** (si cambias algo en `index.html` o `entrar.html`): sube los cambios
  al repositorio de GitHub; Pages se actualiza solo en unos minutos (hasta diez). **En cada publicación
  sube la versión en los dos lugares a la vez**: la constante `VERSION` al inicio del script de
  `index.html` y el archivo `version.json` (formato `AAAA-MM-DD.n`, donde `n` cuenta las publicaciones de ese
  día). Si solo cambias uno, la app avisará de una versión nueva que nunca llega, o no avisará nunca.

## Para quien le dé mantenimiento (técnico)

- `index.html`: la app. `entrar.html`: página del alumno. `panel.html`: panel avanzado con nombres.
- `funciones/ir/index.ts`: función pública del link. `GET ?json=1` consulta sin consumir (`estado`,
  `alumno` solo si es un nombre real, `clase`). `POST ?json=1` consume; cuerpo opcional
  `{dispositivo}` con el secreto del aparato; responde `{estado, url, alumno, clase, dispositivo}`
  (`dispositivo` es el secreto que la página debe guardar en `localStorage` bajo `disp_<token>`).
  Estados: `ok`, `pendiente`, `abierto`, `borrador`, `expirado`, `cerrado`, `agotado`, `revocado`,
  `clase_inactiva`, `otro_dispositivo`, `inexistente`.
- `funciones/admin/index.ts`: API del panel (cabecera `x-admin-key`): `clases` (con
  `max_dispositivos` y `valido_hasta`; `GET /clases` devuelve todas, también las terminadas, cada una con
  `terminada: true|false`; una hora de "Válido hasta" en el pasado se rechaza con 400), `siguiente`, `accesos` (`PATCH accesos/:id {alumno}` para el nombre;
  `accesos/:id/enviar|revocar|reactivar`; `reactivar` = Renovar: vigencia y límites de la clase, usos
  en cero y borra los aparatos), `eventos`, `config` (`base_links`, `url_error`, `vigencia_horas`,
  `minutos_tras_apertura`, `max_usos`, `plantilla`, `guia_texto`, `url_reglas`). Con "Válido hasta" en una clase
  limitada, `siguiente`, `enviar` y `reactivar` fijan `expira_en = valido_hasta` y, si la hora ya pasó, responden
  400 "La clase ya terminó".
- SQL: tablas `clases`, `accesos`, `acceso_dispositivos` (aparatos por link, solo hashes),
  `eventos`, `config`; funciones `consumir_acceso(p_token, p_ip, p_ua, p_dispositivo)`,
  `consultar_acceso`, `enviar_acceso`, `estado_acceso`; vista `accesos_vista` con `estado`,
  `dispositivos` y `otros_dispositivos`. `clases.valido_hasta` (hora fija de fin, nula por defecto): `estado_acceso`
  devuelve `clase_inactiva` para toda clase limitada cuya hora ya pasó, así que sus links se apagan solos.
  `sql/esquema.sql` es el esquema inicial; las migraciones posteriores están aplicadas en Supabase y las de
  aparatos y de "Válido hasta" están guardadas en `sql/migraciones/`.
- Supabase no sirve HTML desde su dominio gratuito (lo convierte a texto plano), por eso las páginas
  viven en GitHub Pages y el servidor solo responde JSON o redirecciones.
- Paleta SparkEd: amarillo `#FFD400`, texto `#111111`, fondo blanco.
- Versión: constante `VERSION` en `index.html` y `version.json` con el mismo valor. La app baja
  `version.json` sin caché al abrirse; si difiere, muestra la banda "Hay una versión nueva" y el botón
  Actualizar recarga la página saltándose la caché.

## Código QR (opcional)

El QR es **el mismo link personal dibujado como imagen**, no un código distinto, así que al
escanearlo aplican las mismas reglas: abre la página amarilla, el acceso se gasta solo al pulsar
"Entrar a la clase", y valen la misma vigencia, el mismo límite de clics y de aparatos, y la
revocación.

Sirve para el caso típico: el link llega al teléfono de la mamá y el hijo entrará desde su iPad o
tablet. La mamá le muestra la imagen y el hijo la escanea con la cámara; el iPad cuenta como uno de
los aparatos del link.

- **Para un link ya enviado:** en la lista "Links activos", botón **Imagen** > Compartir (en el
  celular), Copiar imagen (para pegarla con Ctrl+V en WhatsApp Web) o Descargar.
- **Para el siguiente link, sin mandar mensaje:** botón **Ver imagen** en "Siguiente persona". Lo
  activa (cuenta como enviado) y lo muestra en grande, listo para que lo escaneen o para mandarlo.
- El QR solo se genera para links activos: no hay forma de mostrar un QR que "todavía no sirva".

## Varias clases activas, cada una con sus ajustes

Puedes tener activas varias clases al mismo tiempo. En "Clases activas" eliges con cuál trabajas;
abajo aparecen su "Siguiente persona" y sus links activos. Cada clase tiene sus propios ajustes:

- **Acceso libre**: sin límite de tiempo, de clics ni de aparatos (ideal para una guía de estudio abierta).
- **Limitada**: horas que vive el link desde que lo compartes, minutos que sigue vivo después de
  que entran, clics máximos y aparatos por link.

Los ajustes aplican a los links nuevos de esa clase y a los renovados. "Cerrar clase" apaga al
instante todos sus links.

## Clases anteriores

Las clases que ya terminaron (llegó su "Válido hasta") y las que cerraste tú desaparecen de "Clases
activas" y quedan en el desplegable **Clases anteriores**, con cuántos links se enviaron. Una clase
terminada se puede volver a abrir: tócala, pon una hora futura en "Válido hasta" y guarda; desde ese
momento los links nuevos valen hasta la nueva hora, y los que ya habían vencido se pueden **Renovar**.
Las clases cerradas con "Cerrar clase" solo se muestran.

## Versión de la app y botón Actualizar

Al final de "Ajustes generales" aparece la versión de la app que tienes abierta (por ejemplo
"Versión 2026-10-20.1"). Cuando se publica una versión nueva, la app lo detecta al abrirse (o al volver
a ella) y muestra una banda amarilla **"Hay una versión nueva"** con el botón **Actualizar**, que baja la
app nueva y la recarga. GitHub Pages tarda hasta 10 minutos en servir lo recién publicado: si al
actualizar la banda sigue ahí, espera un rato y vuelve a pulsar. Si no ves la banda, ya tienes la
última versión.

## Imagen única con la guía de estudio y el QR (marca SparkEd)

"Compartir por WhatsApp" manda **un solo mensaje**: una imagen con tu guía de estudio (logo SparkEd,
instrucciones) arriba y el código QR abajo, y el link del alumno como pie de foto. Si el link tiene
nombre, el pie de la imagen lo incluye ("Personal · Familia Pérez · vence el …").

- El texto de la guía se edita en Ajustes generales (separa párrafos con una línea `---`; `{clics}`
  y `{horas}` se rellenan con los ajustes de la clase).
- Si prefieres tu propia imagen de guía, súbela ahí mismo (PNG o JPG, menos de 4 MB) y se usará en
  lugar del texto. "Usar el texto en vez de la imagen" la quita.
- En la computadora: la imagen queda copiada al pulsar Compartir; en el chat de WhatsApp Web pegas con
  Ctrl+V (el link ya está escrito y queda como pie de foto) y Enter.

## SparkEd fase 2: guías interactivas (noviembre 2026)

Junto a la app de accesos vive ahora el sitio de guías interactivas, en la carpeta `sparked/`:

| Pieza | Dónde |
|---|---|
| Sitio para las familias (landing, biblioteca, crear guía) | https://sparkeducation-mx.com/sparked/ |
| Reproductor de guías (lo que abre el alumno) | `sparked/guia.html#<código>` |
| Panel de guías (biblioteca, compras, pedidos, reportes, ajustes) | `sparked/panel.html` (misma contraseña del panel de accesos; también desde la ✨ de la app de accesos) |
| Servidor | función `sparked` en Supabase (`funciones/sparked/`), tablas de la migración `sql/migraciones/20261106_sparked_fase2.sql` |
| Criterios de diseño (arte, juegos, pago, accesos) | `docs/CRITERIOS-FASE-2.md` |

**Cómo convive con los accesos de Lumio.** Nada de lo anterior cambió: `entrar.html`, la función `ir`, la función
`admin` y los links activos siguen igual. Cada guía publicada tiene una "clase" propia de tipo `guia`, y cada compra
crea un acceso normal dentro de esa clase: vale 7 días desde el pago y entra en 2 aparatos (al tercero le aparece
"Acceso en uso en otros aparatos"). Las clases de Lumio conservan sus propios límites.

**Los dos servicios.**
1. *Biblioteca de colegios.* La familia elige colegio, grado y materia; si hay guía publicada ve una vista previa
   gratis (portada, primera pista y un juego) y paga para desbloquearla. Si no hay, se le ofrece el Servicio 2 y
   puede dejar su pedido ("Avísame cuando esté lista"), que aparece en el panel en "Pedidos sin guía".
2. *Guía personalizada.* La familia sube fotos o PDF de sus apuntes (máximo 15 páginas); la IA arma primero una
   vista previa barata, se paga y entonces se termina la guía completa. Los borradores sin pagar se borran a las
   24 horas; las guías personalizadas viven 7 días después del pago y luego solo queda su ficha en "Compras".

**Motores (se encienden con secretos en Supabase → Edge Functions → Secrets; nunca en el código).**
- `ANTHROPIC_API_KEY`: la IA que lee las fotos y escribe las guías (ponle un límite de gasto en la consola de Anthropic).
- `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`: cobro en línea con Mercado Pago (tarjeta, OXXO y SPEI); la guía se activa
  sola en cuanto se confirma el pago. Cómo ponerlas: sección "Cobro con Mercado Pago" al final de esta guía. Mientras no
  existan, el pago es manual: la compra queda "pendiente" con un folio y tú la marcas pagada en el panel; en ese momento
  se crea el link y se manda el correo.
- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`: Stripe queda dormido; solo se usaría si no estuviera Mercado Pago.
- `RESEND_API_KEY`: correos con el link y las reglas del acceso (opcional `HELICONE_API_KEY` para medir costos).

**Publicar una guía de la biblioteca.** En el panel: ＋ Nueva guía → colegio, grado, materia, examen → sube las fotos
(o un cartucho `.json` ya hecho) → "Generar con IA" → cuando termine, "Ver como profesor" para revisarla → Publicar.
Al publicar, los pedidos sin guía que coincidan aparecen para avisarles por WhatsApp.

**Ajustes del sitio** (pestaña Ajustes del panel): precio (100 MXN, IVA incluido; es lo que cobra Mercado Pago), WhatsApp para confirmar pagos manuales,
topes de compras por día y por familia (80 y 6; para probar más, súbelos aquí y al terminar regrésalos), correo de aviso de ventas y
remitente, y qué ve el alumno mientras se termina una guía pagada. Los códigos de descuento están en la pestaña Códigos (ver abajo).

**Pruebas locales.** `node herramientas/servir.js 8787` sirve la carpeta en `http://localhost:8787/sparked/`
(`guia.html?demo=civics3` abre la guía de ejemplo sin servidor).

## Cobro con Mercado Pago (tarjeta, OXXO y SPEI)

Desde el 7 de noviembre de 2026 el sitio ya sabe cobrar con Mercado Pago (Checkout Pro). Se enciende solo cuando pones
dos llaves en Supabase. Mientras no estén, todo sigue en modo manual, como hoy. Las llaves **nunca** se mandan por
WhatsApp ni se pegan en el código: solo en Supabase.

**Encender Mercado Pago (una sola vez)**

1. Entra a https://www.mercadopago.com.mx/developers con la cuenta de Mercado Pago de SparkEd y abre **Tus integraciones**.
2. Oprime **Crear aplicación**. Ponle un nombre (por ejemplo "SparkEd guías"), elige **Pagos en línea** y después
   **Checkout Pro**. Si pregunta si usas una plataforma de comercio electrónico, contesta que no. Acepta y crea la aplicación.
3. Dentro de la aplicación, abre **Credenciales de producción** (si te lo pide, actívalas con los datos del negocio; el
   sitio web es `https://sparkeducation-mx.com`). Copia el **Access Token** (empieza con `APP_USR-`).
4. En la misma aplicación, abre **Webhooks → Configurar notificaciones**. En **Modo productivo** pega esta dirección:
   `https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked/pago/mercadopago`
   En eventos marca **Pagos** y oprime **Guardar**.
5. Al guardar aparece la **clave secreta** del webhook (hay un botón para mostrarla). Cópiala.
6. Entra a Supabase (https://supabase.com/dashboard/project/wfqfqfsbkqbaejnkhidz) → **Edge Functions** → **Secrets** y
   agrega dos secretos:
   - Nombre `MP_ACCESS_TOKEN`, valor: el Access Token del paso 3.
   - Nombre `MP_WEBHOOK_SECRET`, valor: la clave secreta del paso 5.
7. Abre el panel de guías (pestaña **Resumen**, sección Motores): "Cobro en línea (Mercado Pago)" y "Aviso de pago de
   Mercado Pago" deben verse en verde 🟢.
8. Revisa en **Ajustes** del panel que el precio diga **100**: es lo que Mercado Pago le cobra a la familia.

**Probar sin cobrar de verdad (recomendado antes de vender)**

1. En Tus integraciones → tu aplicación → **Cuentas de prueba**, crea una cuenta de prueba de tipo **comprador**, de
   México. Anota su usuario y su contraseña.
2. En la aplicación, copia el **Access Token de prueba** (está en Credenciales de prueba y empieza con `TEST-`) y ponlo
   en Supabase como `MP_ACCESS_TOKEN` en lugar del de producción. El panel muestra 🟡 "MODO DE PRUEBA". Mientras dure la
   prueba, nadie puede pagar de verdad: hazla en un momento sin ventas y no la dejes puesta.
3. En **Webhooks → Configurar notificaciones**, pestaña **Modo de pruebas**, pega la misma dirección del paso 4, marca
   **Pagos** y guarda. La clave secreta es la misma de la aplicación (si te muestra otra, usa esa en `MP_WEBHOOK_SECRET`
   mientras pruebas).
4. Abre una ventana de incógnito, entra a https://sparkeducation-mx.com/sparked/biblioteca.html, elige una guía y
   oprime pagar. En Mercado Pago entra con el comprador de prueba y paga con esta tarjeta de prueba: Mastercard
   `5474 9254 3267 0366`, vencimiento `11/30`, código `123` y, como nombre del titular, **APRO** (pago aprobado).
   Con **OTHE** el pago sale rechazado y con **CONT** queda pendiente.
5. Con APRO, Mercado Pago te regresa solo a "¡Tu guía está lista!" y la compra aparece como pagada en el panel.
6. Para ver OXXO, elige OXXO al pagar: en pruebas la ficha no se puede pagar, así que la prueba sale bien si la compra
   queda pendiente y la página dice "Tu pago en OXXO puede tardar hasta 1 hora en reflejarse…".
7. Al terminar, vuelve a poner en `MP_ACCESS_TOKEN` el **Access Token de producción** (`APP_USR-`). Las compras de
   prueba se quedan en el panel; puedes ignorarlas.
8. Si Mercado Pago dice que "una de las partes es de prueba", escribe en el formulario de SparkEd el correo del
   comprador de prueba.

**Qué pasa con cada forma de pago**

- **Tarjeta aprobada:** la guía se activa al momento; la familia ve su link y le llega el correo.
- **OXXO o SPEI:** la familia recibe su ficha y tiene **3 días** para pagar. Al pagar, Mercado Pago avisa (puede tardar
  hasta 1 hora) y la guía se activa sola y llega al correo. Mientras tanto, la página le explica qué sigue y le deja
  volver a ver su ficha. La vista previa de una guía personalizada se guarda esos días.
- **Pago rechazado:** la familia ve "El pago no se completó" y el botón "Intentar de nuevo".
- **Si una familia dice que ya pagó y no le llega:** panel → Compras → **🔄 Revisar en Mercado Pago**. Si el pago está
  aprobado, la guía se activa en ese momento.
- **Si Mercado Pago no responde:** la compra queda apartada en modo manual, como hoy, para no perder la venta.
- Mercado Pago aparece en el estado de cuenta de la tarjeta como **SPARKED**.

**Para quien le dé mantenimiento (técnico).** `POST /pago/crear` crea la preferencia de Checkout Pro
(`external_reference` = id de la compra, regreso a `listo.html?compra=<id>`, `&pago=pendiente` o `&pago=fallido`;
fichas con vencimiento de 3 días; sin cajero, PayCash ni crédito de Mercado Pago). `POST /pago/mercadopago` recibe los
avisos: valida `x-signature` (HMAC-SHA256 del manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con
`MP_WEBHOOK_SECRET`; firma mala = 401), consulta el pago en `GET /v1/payments/:id` y lo aplica una sola vez (cambio
atómico de `pendiente` a `pagada` y luego `confirmarPago`). `GET /pago/estado/:id` también pregunta a Mercado Pago si el
aviso no ha llegado (una vez cada 20 s por compra) y devuelve `metodo`, `pago_mp`, `ficha_url` y `vence_en`.
`POST /pago/reintentar/:id` hace un link de pago nuevo para una compra pendiente. Columnas nuevas en `compras`:
migración `sql/migraciones/20261107_sparked_mercadopago.sql`. Prueba sin llaves: `node herramientas/probar-mercadopago.ts`
(Node 23.6 o más nuevo).

## Códigos de descuento (guía gratis o con descuento)

Sirven para tus pruebas y para regalar accesos. La familia escribe el código en el campo **"¿Tienes un código? Escríbelo
aquí"** del pago (en "Crear mi guía" y en la biblioteca). Se aceptan con mayúsculas o minúsculas y con espacios de más.

**Cómo crear un código (panel → pestaña Códigos):**
1. Escribe el código (de 3 a 40 letras o números, puede llevar guion) o toca 🎲 para que el panel invente uno.
2. Elige qué hace: **Guía gratis** (no paga nada y la guía se entrega al momento) o **Descuento en %** (paga menos en
   Mercado Pago; por ejemplo 50 = mitad de precio).
3. Límite de usos: cuántas guías se pueden pedir con ese código (1 = un solo uso; vacío = sin límite).
4. Caduca el (opcional): el código deja de servir al terminar ese día.
5. Nota: para ti (por ejemplo "para mis pruebas" o "regalo para la familia López").
6. "Crear código". En la lista puedes copiarlo, **apagarlo** (deja de servir al momento) o volver a encenderlo.

**Qué pasa al usarlo:**
- Código gratis: la compra queda pagada con monto 0 y método "código"; se crean el acceso de 7 días y el link, y le
  llega el correo igual que a una compra pagada. Tú recibes el aviso "Guía con código" (no "Venta").
- Código de descuento: Mercado Pago cobra el precio ya descontado. El uso se cuenta cuando el pago se confirma.
- Las guías con código gratis **no cuentan como venta ni como ingreso** en el Resumen ni en la Biblioteca; se cuentan
  aparte ("guías con código gratis este mes").
- Si el código no sirve (no existe, está apagado, ya caducó o se acabaron sus usos), la familia solo ve "Ese código no
  es válido". Cada intento queda en "Últimos intentos" y, con 5 intentos fallidos en una hora desde el mismo teléfono,
  correo o conexión, los siguientes se rechazan solos (aunque el código sea bueno) hasta que pase la hora.

## Entrega en dos tiempos (la guía completa tarda unos 4 minutos)

La guía completa se genera **después** del pago (así no se gasta en guías que nadie paga) y tarda entre 3 y 6 minutos.
Por eso, al pagar:
1. La página dice "Tu pago se confirmó" (o "Tu código se aplicó") y "Tu guía completa se está terminando: tarda unos 4
   minutos. Te avisamos por correo en cuanto esté lista", con una barra de avance y el tiempo estimado. Ya muestra el
   link para copiarlo o mandarlo por WhatsApp. Cuando la guía queda completa, la misma página cambia a "¡Tu guía está
   lista!".
2. El primer correo dice lo mismo, con el link. Cuando la guía queda completa, llega un **segundo correo** (una sola
   vez): "¡Tu guía completa está lista!", con el mismo link. Si la guía ya estaba completa al pagar (biblioteca), solo
   sale un correo.
3. Si la IA no logra terminar la guía después de sus reintentos, el link y la página dicen "Estamos revisando tu guía;
   te avisamos por correo en cuanto esté lista" (ya no "generando" para siempre). Tú recibes un correo en la dirección
   de Ajustes → "Correo donde quieres recibir aviso de cada venta" (si la pusiste) y el Resumen del panel muestra el
   aviso en rojo con el botón "Abrir la guía". Ahí tocas **↻ Reintentar**; al terminar, a la familia le llega sola el
   correo de que su guía completa está lista.

**Ajuste "Mientras se termina una guía pagada"** (pestaña Ajustes): con "Mostrar el avance…" (lo de siempre) el link
enseña el avance hasta que la guía esté completa. Con "Dejar jugar los bloques de la vista previa…" el alumno ya puede
jugar los bloques que existen, con un letrero arriba de "Estamos terminando los demás bloques"; cuando la guía queda
completa, el letrero ofrece abrirla.

**Topes de compras.** Por seguridad hay un tope de 80 compras al día en todo el sitio y de 6 al día por familia
(mismo teléfono o correo). Si necesitas probar más, súbelos en Ajustes → "Tope de compras por día (todo el sitio)" y
"Tope de compras por día por familia", guarda, y al terminar regrésalos a 80 y 6.

### Para probar el cobro de Mercado Pago sin confundirte (8 nov 2026)

Mercado Pago no permite que una cuenta se pague a sí misma. Si en la compra de prueba pones el **mismo correo de la
cuenta de Mercado Pago de SparkEd**, el botón "Pagar" (OXXO) o "Continuar" (SPEI) sale en gris y no avanza; no es una
falla del sitio. Para probar como cliente usa **otro correo** (y, si quieres probar sin dinero, un código de descuento
gratuito creado en el panel). Verificado el 8 de noviembre de 2026: con otro correo, OXXO genera su ficha ("¡Listo! Solo
te falta pagar $100 en la tienda OXXO más cercana") y el sitio muestra "Tu pago en OXXO está en camino" con el botón
"Ver mi ficha de pago"; SPEI habilita "Continuar" y da las instrucciones de transferencia.
