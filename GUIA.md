# Accesos Lumio: tu app para repartir accesos por WhatsApp

Pegas el link de Lumio de la clase de hoy, pulsas **Compartir por WhatsApp**, eliges el chat de la
persona y listo: esa persona recibe **su propio link**, con su propia vigencia. En cuanto lo
compartes, la app ya tiene otro link preparado para la siguiente persona. Si alguien reenvía su
link, el otro lo encuentra cerrado.

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
3. **Cuando alguien te contacta:** pulsa **Compartir por WhatsApp**.
   - En el celular se abre la hoja de compartir: eliges WhatsApp y el chat. El link se activa solo
     si de verdad compartiste (si cancelas, no se gasta).
   - En la computadora se abre WhatsApp Web o Escritorio con el mensaje listo; eliges el chat.
   - También puedes "Copiar mensaje" o "Copiar solo el link" y pegarlo donde quieras (eso también
     activa el link).
4. **Durante el día:** en "Enviados en esta clase" ves cada link con su estado: *Sin abrir*,
   *Entró* (con la hora), *Cerrado*, *Vencido*, *Agotado* o *Revocado*. **Revocar** cancela uno al
   instante (por ejemplo, si alguien no pagó).
5. **Al día siguiente:** pega el link nuevo de Lumio. Los links viejos vencen solos.

## Ajustes (se guardan en el servidor, valen igual en celular y computadora)

- **Horas que vive el link desde que lo compartes** (8 por defecto). Si no entran en ese
  tiempo, el link vence: "ya es problema del cliente".
- **Minutos que sigue vivo después de abrirlo** (10 por defecto): para que puedan recargar o
  reconectarse, pero no para que lo compartan después.
- **Clics máximos** (3 por defecto).
- **Mensaje de WhatsApp**: el texto que se envía; `{link}` y `{hasta}` se rellenan solos.

## Qué pasa del lado del alumno

Abre el link, ve una página amarilla "Tu acceso está listo" con el botón **Entrar a la clase**, lo
pulsa y cae directo en Lumio. Si el link ya se usó, venció o fue revocado, ve un mensaje claro
("Este enlace ya fue abierto y su tiempo de uso terminó. Pídele al profesor un enlace nuevo").

En Lumio, el alumno entra como invitado o con su cuenta: eso lo decides tú en Lumio. Una vez
dentro, ve el link real de Lumio; esa segunda puerta la protege Lumio (reinicia el Class ID cuando
termine la cohorte para que ese link también cambie).

## Cómo se protege el link

- Código de 14 caracteres aleatorios (imposible de adivinar).
- Nace como **borrador**: no sirve hasta que lo compartes. Al compartir arranca su vigencia.
- Las **vistas previas de WhatsApp** nunca lo consumen: el código va después de `#` en la URL y los
  robots no lo ven; además el servidor ignora a los robots.
- Al pulsar "Entrar", el servidor consume el acceso de forma atómica y registra desde qué
  dispositivo entró (bitácora `eventos`).
- La base de datos no es legible con la clave pública de Supabase (RLS sin políticas). Solo las
  funciones del servidor la tocan, y el panel exige tu clave (guardada solo como hash).

## Si algo falla

- **"Clave de administrador incorrecta"**: revisa `CLAVES.txt`; sin espacios al inicio o al final.
- **El link se compartió pero "no se pudo activar"**: la app muestra un botón "Reintentar". Si
  sigue fallando, revisa tu conexión; el link no sirve hasta activarse.
- **Cambiar la contraseña**: en la app, tarjeta "Contraseña de acceso" > Guardar contraseña. Si la olvidas, entra con la clave de `CLAVES.txt` (respaldo permanente) y pon otra. Si pierdes las dos, genera una nueva y su SHA-256, y en Supabase > SQL Editor ejecuta
  `update public.config set valor = '<hash>' where clave = 'admin_key_sha256';`.
  En PowerShell:
  ```powershell
  $k = -join ((1..32) | % { 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Get-Random -Max 55)] }); $k
  ($([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($k))) | % { $_.ToString('x2') }) -join ''
  ```
- **Volver a publicar la app** (si cambias algo en `index.html` o `entrar.html`): sube los cambios
  al repositorio de GitHub; Pages se actualiza solo en uno o dos minutos.

## Para quien le dé mantenimiento (técnico)

- `index.html`: la app. `entrar.html`: página del alumno. `panel.html`: panel avanzado con nombres.
- `funciones/ir/index.ts`: función pública del link (`GET ?json=1` consulta, `POST ?json=1` consume).
- `funciones/admin/index.ts`: API del panel (cabecera `x-admin-key`): `clases`, `siguiente`,
  `accesos/:id/enviar|revocar|reactivar`, `eventos`, `config` (`base_links`, `url_error`,
  `vigencia_horas`, `minutos_tras_apertura`, `max_usos`, `plantilla`).
- `sql/esquema.sql`: tablas `clases`, `accesos`, `eventos`, `config`; funciones `consumir_acceso`,
  `consultar_acceso`, `enviar_acceso`; vista `accesos_vista` con el `estado` calculado.
- Supabase no sirve HTML desde su dominio gratuito (lo convierte a texto plano), por eso las páginas
  viven en GitHub Pages y el servidor solo responde JSON o redirecciones.
- Paleta tomada del sitio de Lumio: amarillo `#FECC4F`, crema `#F9F5EA`, morado `#6A448E`, texto `#2A2A2A`.

## Código QR (opcional)

El QR es **el mismo link personal dibujado como imagen**, no un código distinto, así que al
escanearlo aplican las mismas reglas: abre la página amarilla, el acceso se gasta solo al pulsar
"Entrar a la clase", y valen la misma vigencia, el mismo límite de clics y la revocación.

Sirve para el caso típico: el link llega al teléfono de la mamá y el hijo entrará desde su iPad o
tablet. La mamá le muestra la imagen y el hijo la escanea con la cámara.

- **Para un link ya enviado:** en la lista "Enviados en esta clase", botón **QR** > Compartir (en el
  celular), Copiar imagen (para pegarla con Ctrl+V en WhatsApp Web) o Descargar.
- **Para el siguiente link, sin mandar mensaje:** botón **Mostrar QR** en "Siguiente persona". Lo
  activa (cuenta como enviado) y lo muestra en grande, listo para que lo escaneen o para mandarlo.
- El QR solo se genera para links activos: no hay forma de mostrar un QR que "todavía no sirva".

## Varias clases activas, cada una con sus ajustes

Puedes tener activas varias clases al mismo tiempo. En "Clases activas" eliges con cuál trabajas;
abajo aparecen su "Siguiente persona" y sus links activos. Cada clase tiene sus propios ajustes:

- **Acceso libre**: sin límite de tiempo ni de clics (ideal para una guía de estudio abierta).
- **Limitada**: horas que vive el link desde que lo compartes, minutos que sigue vivo después de
  que entran, y clics máximos.

Los ajustes aplican a los links nuevos de esa clase. "Cerrar clase" apaga al instante todos sus links.

## Imagen única con la guía de estudio y el QR (marca SparkEd)

"Compartir por WhatsApp" manda **un solo mensaje**: una imagen con tu guía de estudio (logo SparkEd,
instrucciones) arriba y el código QR abajo, y el link del alumno como pie de foto.

- El texto de la guía se edita en Ajustes generales (separa párrafos con una línea `---`; `{clics}`
  y `{horas}` se rellenan con los ajustes de la clase).
- Si prefieres tu propia imagen de guía, súbela ahí mismo (PNG o JPG, menos de 4 MB) y se usará en
  lugar del texto. "Usar el texto en vez de la imagen" la quita.
- En la computadora: la imagen queda copiada al pulsar Compartir; en el chat de WhatsApp Web pegas con
  Ctrl+V (el link ya está escrito y queda como pie de foto) y Enter.
