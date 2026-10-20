# SparkEd Accesos: tu app para repartir accesos por WhatsApp

Pegas el link de Lumio de la clase, pulsas **Compartir por WhatsApp**, eliges el chat de la familia y
listo: esa familia recibe **su propio link**, con su propia vigencia. En cuanto lo compartes, la app ya
tiene otro link preparado para la siguiente persona. Cada link es de **una sola familia**: entra el
alumno desde su aparato (y, si hace falta, también desde el del papá o la mamá), pero si el link llega a
otras personas ya no abre.

## Dónde está todo

| Pieza | Dónde |
|---|---|
| **La app** (celular y computadora) | https://danflores01.github.io/accesos-lumio/ |
| Clave de administrador | `CLAVES.txt` (archivo privado; nunca está en internet) |
| Lo que ve el alumno | `https://danflores01.github.io/accesos-lumio/entrar.html#<código>` |
| Código fuente | https://github.com/Danflores01/accesos-lumio |
| Servidor (base de datos y funciones) | Supabase, proyecto `accesos-lumio`: https://supabase.com/dashboard/project/wfqfqfsbkqbaejnkhidz |
| Panel avanzado (con nombres y teléfonos) | https://danflores01.github.io/accesos-lumio/panel.html |

Todo corre en planes gratuitos (GitHub Pages y Supabase Free).

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
5. **Al día siguiente:** pega el link nuevo de Lumio. Los links viejos vencen solos.

## Ajustes de cada clase (se guardan en el servidor, valen igual en celular y computadora)

- **Acceso libre**: sin límite de tiempo, de clics ni de aparatos (ideal para una guía de estudio
  abierta).
- **Vigencia del link** (8 horas por defecto): horas que vive el link desde que lo compartes. Si no
  entran en ese tiempo, vence: "ya es problema del cliente".
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
  al repositorio de GitHub; Pages se actualiza solo en unos minutos (hasta diez).

## Para quien le dé mantenimiento (técnico)

- `index.html`: la app. `entrar.html`: página del alumno. `panel.html`: panel avanzado con nombres.
- `funciones/ir/index.ts`: función pública del link. `GET ?json=1` consulta sin consumir (`estado`,
  `alumno` solo si es un nombre real, `clase`). `POST ?json=1` consume; cuerpo opcional
  `{dispositivo}` con el secreto del aparato; responde `{estado, url, alumno, clase, dispositivo}`
  (`dispositivo` es el secreto que la página debe guardar en `localStorage` bajo `disp_<token>`).
  Estados: `ok`, `pendiente`, `abierto`, `borrador`, `expirado`, `cerrado`, `agotado`, `revocado`,
  `clase_inactiva`, `otro_dispositivo`, `inexistente`.
- `funciones/admin/index.ts`: API del panel (cabecera `x-admin-key`): `clases` (con
  `max_dispositivos`), `siguiente`, `accesos` (`PATCH accesos/:id {alumno}` para el nombre;
  `accesos/:id/enviar|revocar|reactivar`; `reactivar` = Renovar: vigencia y límites de la clase, usos
  en cero y borra los aparatos), `eventos`, `config` (`base_links`, `url_error`, `vigencia_horas`,
  `minutos_tras_apertura`, `max_usos`, `plantilla`, `guia_texto`, `url_reglas`).
- SQL: tablas `clases`, `accesos`, `acceso_dispositivos` (aparatos por link, solo hashes),
  `eventos`, `config`; funciones `consumir_acceso(p_token, p_ip, p_ua, p_dispositivo)`,
  `consultar_acceso`, `enviar_acceso`, `estado_acceso`; vista `accesos_vista` con `estado`,
  `dispositivos` y `otros_dispositivos`. `sql/esquema.sql` es el esquema inicial; las migraciones
  posteriores están aplicadas en Supabase y la de aparatos está guardada en `sql/migraciones/`.
- Supabase no sirve HTML desde su dominio gratuito (lo convierte a texto plano), por eso las páginas
  viven en GitHub Pages y el servidor solo responde JSON o redirecciones.
- Paleta SparkEd: amarillo `#FFD400`, texto `#111111`, fondo blanco.

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
