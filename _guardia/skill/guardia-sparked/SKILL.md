---
name: guardia-sparked
description: >-
  Guardia de SparkEd (sparkeducation-mx.com, repositorio accesos-lumio): detecta y resuelve cualquier fallo en el
  camino de un cliente, desde que crea su guía hasta que paga, recibe el link y la abre. Úsala SIEMPRE, aunque nadie
  la pida por su nombre: (1) antes y después de publicar o desplegar cualquier cambio de SparkEd (sitio, reproductor,
  panel, función sparked, base de datos), también si lo hizo un ayudante; (2) cuando Daniel o una familia digan que
  algo falló («no abre», «algo salió mal», «algo falló», «no le llegó», «pagó y nada», un error en un link, un pago,
  una guía, el correo o el WhatsApp), cuando aparezca un «AVISO AUTOMÁTICO» en Reportes o llegue un correo o aviso de
  «falló el vigilante automático»; (3) al empezar a trabajar en SparkEd o cuando pidan «una ronda», «revisa que todo
  esté bien» o «¿todo funciona?»; (4) antes de decirle a Daniel que algo quedó «listo» o «publicado».
---

# Guardia de SparkEd

SparkEd vende guías de estudio interactivas: una familia sube fotos de sus apuntes, paga y recibe un link. El 10 de
noviembre de 2026 una familia pagó, recibió su link y la pantalla le dijo «Algo falló». Llevaba nueve horas roto para
todos y nadie lo sabía: un cambio del panel tapó la dirección con la que se abren las guías, y las comprobaciones de
entonces solo miraban que el servidor estuviera encendido. Daniel pidió una sola cosa: **que no le vuelva a pasar ni a
un cliente más**. Esta skill es esa promesa convertida en pasos.

La idea que lo sostiene todo: **nada se da por bueno hasta haber visto, en producción, que una familia puede crear,
pagar, recibir y abrir**. «Debería funcionar» no cuenta.

## Lo primero, siempre: la ronda

```bash
node "<carpeta de esta skill>/scripts/ronda.mjs"
```

En unos 15 segundos revisa en producción el camino completo y lo dice en líneas `ok`, `AVISO` y `FALLA`:

- el sitio publicado y el servidor, tal como los usa una familia (prueba de humo; incluye **abrir una guía** con la
  dirección exacta que pide el reproductor publicado);
- la versión desplegada, los cinco motores de la venta (IA, Mercado Pago, aviso de pago, correo, WhatsApp);
- las compras recientes: pagadas sin guía, guías sin entregar, entregas sin correo o sin WhatsApp, guías que nadie abre;
- **la llave de cada compra entregada**: que el servidor la reconozca y su guía esté completa (pregunta sin gastarla);
- guías pagadas que la IA no terminó, avisos automáticos de guías que no abrieron;
- la publicación del sitio y el vigilante automático.

`FALLA` = un cliente lo está sufriendo o lo va a sufrir: se atiende antes que cualquier otra cosa (caso B). `AVISO` =
mirar con calma y contárselo a Daniel si le toca hacer algo. Termina con código 1 si hubo alguna `FALLA`.

La ronda necesita la copia del repositorio `Danflores01/accesos-lumio`. La busca sola (`repo.txt` junto a esta skill,
la carpeta actual, `--repo <ruta>`). Si no existe en esta computadora: `gh auth status` (la cuenta activa debe ser
`Danflores01`) y `gh repo clone Danflores01/accesos-lumio`. La clave de administrador vive en `CLAVES.txt`, en la raíz
de la copia (primera línea; no se sube a GitHub). Los scripts la leen solos: **nunca la imprimas ni la escribas tú**.
Si falta, la ronda hace solo la parte pública; la base y el registro se consultan con las herramientas de Supabase
(`references/consultas.md`), y a Daniel se le pide que vuelva a poner él ese archivo.

Lo que la ronda **no** prueba: que una llave real abra hasta el final, porque abrir gasta uno de los 2 dispositivos de
la familia. La evidencia de eso son los datos reales (`primer_uso_en` y `ultimo_uso_en` en `accesos`). Si tocas esa
parte (`consumir_acceso`, las tablas `accesos` o `guias`), dilo y propón a Daniel una compra de prueba con un código.

## A. Vas a lanzar algo (compuerta de lanzamiento)

Todo cambio de SparkEd pasa por aquí, por pequeño que parezca. El del 10 de noviembre era «solo la entrada del panel».

**Antes**

1. **Ubica el cambio en el camino del cliente** (`references/mapa-del-camino.md`): ¿sitio, servidor o base de datos?
   ¿Qué pasos toca? Pagar, recibir y abrir (pasos 3, 6 y 7) no admiten error: ahí ya hay dinero de por medio.
2. **Si lo escribió un ayudante, léelo tú completo.** Compara cada dirección nueva del servidor con las que ya existen
   en `funciones/sparked/index.ts`: los módulos aparte se ejecutan antes y pueden tapar una ruta ajena. Una prueba
   que da por bueno «todo lo demás responde 404» es una alarma, no una garantía.
3. **Ruta nueva → a las listas.** Agrégala a `herramientas/probar-rutas.mjs` y, si es del camino del cliente, a
   `herramientas/prueba-de-humo.mjs`. Lo que no está en la prueba de humo, nadie lo vigila.
4. **Si toca el reproductor o el contenido de las guías**, recórrelo de verdad con una guía real y sin usar el link de
   nadie: `node herramientas/servir.js` y `node herramientas/probar-guia.mjs <id de la guía> http://localhost:8790/sparked/`.
   Si toca el aviso de fallos: `herramientas/probar-aviso-de-fallo.mjs`. Si toca el diseño: `herramientas/revisar-slides.mjs`.
5. **Que no haya nadie a media compra** antes de desplegar el servidor (consulta 4 de `references/consultas.md`).

**Lanzar**

- **Sitio** (todo lo de `sparked/`, herramientas, documentos): con la compuerta. Revisa sintaxis, que no vaya nada
  privado ni de la fase 1, prueba esta copia contra el servidor real, sube una sola vez, espera a GitHub Pages y corre
  la ronda. Un comando, de 1 a 2 minutos:

  ```bash
  node "<carpeta de esta skill>/scripts/lanzar.mjs" -m "Qué cambia, en una frase" <archivo> [<archivo> …]
  ```

- **Servidor** (`funciones/sparked/*.ts`): sube el código con la compuerta y luego despliega por el puente, paso por
  paso, con `references/publicar-rapido.md`. Al terminar, corre la ronda.
- **Base de datos:** solo cambios que agregan (tablas, columnas). Nunca borres ni renombres algo que el servidor
  desplegado usa.

**Después**

6. La ronda debe terminar sin `FALLA` y, si desplegaste, con la versión nueva. Si aparece una `FALLA` del camino del
   cliente que antes de tu lanzamiento no estaba, **regresa primero y entiende después**:
   `lanzar.mjs --regresar <commit>` para el sitio, o el puente al commit anterior para el servidor.
7. Solo entonces dile a Daniel que quedó publicado, y dile **qué comprobaste**.

## B. Algo le falló a un cliente (o la ronda dio FALLA)

Aquí el reloj corre: cada minuto puede haber otra familia que pagó y no puede entrar.

0. **Avisa a Daniel en una línea** que ya lo estás viendo, por ejemplo: «Ya lo estoy revisando; en unos minutos te
   digo qué pasó y cómo queda». No esperes a tener la causa. (Si trabajas como ayudante de otro Claude, tu canal es
   tu informe: el aviso lo da quien te llamó.)
1. **Corre la ronda.** Casi siempre dice sola en qué etapa está el problema.
2. **Ubica la etapa, no la frase.** Daniel y las familias casi nunca citan el texto exacto de la pantalla. Mira, en
   este orden: Reportes (un `AVISO AUTOMÁTICO` trae el código y el motivo), las compras de esa hora (consulta 1) y el
   registro del servidor (consulta 7: fallos agrupados e intentos de abrir uno por uno). Para ubicar la compra sin
   datos personales, pregúntale a Daniel la hora aproximada del pago y el método. `references/sintomas.md` traduce lo
   que dice la familia a lo que hay que comprobar. `references/incidentes.md` cuenta los fallos anteriores: lo más
   probable es que se parezca.
3. **¿Una familia o todas?** Si es del sistema (una ruta, el sitio, un motor), hay que restablecer ya. Si es de una
   sola compra (pago sin confirmar, trabajo atorado, número sin WhatsApp), se arregla esa compra.
4. **Restablece antes de entender.** `references/publicar-rapido.md`: primero el sitio (un minuto y sin permisos);
   si el fallo empezó con una publicación, regresarla es lo más rápido. El 10 de noviembre el servidor no se pudo
   desplegar y la salida fue cambiar la dirección que pedía el reproductor.
5. **Comprueba con evidencia real:** la ronda sin `FALLA`; `primer_uso_en` de la compra afectada cuando la familia
   entra (consulta 2); `node herramientas/probar-guia.mjs <id de la guía>` para ver que su contenido se arma bien.
6. **Mide el daño:** desde cuándo y a quién más le pasó (consulta 7, «intentos de abrir»). Cuenta compras, no
   equipos: una familia usa varios dispositivos y redes, y una segunda compra de la misma guía pagada con código en
   plena falla suele ser la misma familia reintentando o una prueba de Daniel. Si no estás seguro, di «N compras» y
   pregúntale. Y avisa de lo que siga expuesto: quien dejó la página abierta desde antes del arreglo tiene que
   recargarla.
7. **Informa a Daniel** con el formato de abajo, incluido lo que le toca a él (por ejemplo, decirle a la familia que
   recargue la página). Tú no le escribes a la familia.
8. **Cierra el incidente:** causa de fondo arreglada o con fecha, un candado nuevo (una prueba que falle con el código
   viejo) y su entrada en `references/incidentes.md` con la plantilla. Sin candado y sin bitácora no está cerrado.

## C. Ronda de vigilancia

Al empezar una sesión de SparkEd, o cuando Daniel pregunte si todo está bien: corre la ronda y cuéntale el resultado
en claro. Cada `AVISO`, en una línea, con lo que significa y si a él le toca hacer algo. Una `FALLA` te lleva al caso B.

**Quién vigila cuando no hay nadie.** Estas piezas trabajan solas; la ronda revisa que sigan vivas:

- El **vigilante automático** (`.github/workflows/guardia.yml`): cada 15 minutos y después de cada publicación corre
  la prueba de humo en GitHub. Si falla dos veces seguidas abre el aviso «🚨 SparkEd: falló el vigilante automático»
  en la pestaña Issues del repositorio y GitHub le manda un correo a Daniel. Ese aviso es una `FALLA`: caso B.
  Trabaja solo en la cuenta de GitHub de Daniel, así que **encenderlo o cambiarlo necesita su sí expreso**. Si la
  ronda dice que todavía no está encendido, recuérdaselo: el archivo espera en `_guardia/vigilante/` y los pasos
  están en `_guardia/LEEME.md`.
- El **aviso automático del reproductor**: si una guía pagada no abre por un fallo nuestro, queda un reporte que
  empieza con `AVISO AUTOMÁTICO` (panel → Reportes) y, con el «correo de avisos» puesto en Ajustes, un correo a Daniel.
- La página de espera (`listo.html`) repara sola las entregas interrumpidas, y el Resumen del panel muestra en rosa
  las guías pagadas que no se terminaron.

## Reglas que no se rompen

- **Nunca abras el link de una familia** ni llames a `POST /acceso/<su clave>/abrir`: cada apertura gasta uno de sus
  2 dispositivos y puede dejarla fuera. Para ver su guía, `probar-guia.mjs` (usa la clave de administrador). Para
  saber si su llave vive, la ronda.
- **Nunca imprimas ni guardes** claves de links, la clave de administrador, nombres, teléfonos ni correos de clientes.
  Para diagnosticar bastan folios, horas y estados; las consultas de esta skill ya vienen sin datos personales.
- **A una familia solo le escribe Daniel.** Reenviar una entrega, confirmar un pago a mano, extender o liberar un
  acceso, reembolsar o borrar datos lo decide él, cada vez (`references/sintomas.md`, «Quién decide»).
- **La fase 1 no se toca:** `accesos/`, `entrar.html`, el `panel.html` de la raíz, `icons/`, las funciones `ir` y
  `admin`. Es otro producto y sigue vivo. La compuerta se niega a subir esos archivos.
- **Si el sistema de permisos rechaza un despliegue, no lo rodees.** Resuelve por el sitio si se puede y pide a Daniel
  su sí en una línea.
- **Un solo push por minuto y nunca `git add -A`:** dos seguidos tumban la publicación, y `CLAVES.txt` jamás se sube.
- **El puente del repositorio dice la verdad:** `funciones/puente-sparked/index.ts` solo se guarda cuando el
  despliegue se hizo.

## Cómo avisarle a Daniel

Daniel es maestro, no programador. Háblale de tú, en español simple y corto, sin tecnicismos («dispositivos», «la
dirección con la que se abre la guía», «el servidor»). Primero lo que le importa: si sus clientes pueden usar lo que
pagaron.

```
Qué pasó: lo que vio la familia, en una frase.
Desde cuándo y a cuántos: hora de inicio, hora del arreglo, familias afectadas.
Por qué: la causa, sin tecnicismos.
Cómo quedó: arreglado y comprobado / lo que falta.
Cómo lo comprobé: el dato real (por ejemplo: «la familia abrió su guía a las 7:33»).
Lo que te toca a ti: una lista corta, o «nada».
Para que no se repita: el candado nuevo.
```

## Dónde está cada cosa

| Archivo | Léelo cuando |
|---|---|
| `scripts/ronda.mjs` | Siempre, lo primero. `--detalle` muestra todas las comprobaciones; `--horas 168` mira una semana. |
| `scripts/lanzar.mjs` | Vas a publicar o a regresar algo del sitio. `--revisar` solo revisa. |
| `references/sintomas.md` | Alguien describe un fallo y hay que saber qué comprobar y quién decide. |
| `references/publicar-rapido.md` | Hay que arreglar en vivo o regresar: sitio, servidor por el puente, copia guardada, permisos. |
| `references/consultas.md` | Necesitas datos: compras, accesos, trabajos, reportes, registro del servidor. |
| `references/mapa-del-camino.md` | Quieres saber qué archivo, dirección y tabla atienden cada paso del cliente. |
| `references/incidentes.md` | Antes de atender un fallo (para reconocerlo) y al cerrarlo (para registrarlo). |

En el repositorio: `herramientas/prueba-de-humo.mjs` (producción, sin llaves), `herramientas/probar-rutas.mjs` (antes
de desplegar), `herramientas/probar-guia.mjs` (recorre una guía real), `herramientas/abrir-guia.mjs` (qué ve una
familia, con una clave inventada), `docs/CRITERIOS-FASE-2.md` (reglas del producto).

## Mantener viva la guardia

La versión que manda está en el repositorio, en `_guardia/`. Si cambias algo aquí, cámbialo ahí, publícalo y corre
`node _guardia/instalar.mjs` para actualizar la copia de esta computadora (la ronda avisa si quedó atrasada). Cada
vez que el camino del cliente cambie, actualiza `references/mapa-del-camino.md` y la prueba de humo. Cada fallo deja
su entrada en la bitácora y su candado: así la guardia aprende.
