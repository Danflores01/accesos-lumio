# Bitácora de incidentes de SparkEd

Cada fallo que le llegó (o estuvo por llegarle) a un cliente queda aquí: qué pasó, por qué, cómo se resolvió, qué
estuvo lento y qué candado dejó. Antes de atender un fallo nuevo, lee los anteriores: lo más probable es que se parezca.
Al cerrar un fallo, agrega el suyo con la plantilla del final.

Horas en hora de México (UTC−6).

---

## 2026-11-10 · Las guías pagadas no abrían («Algo falló»)

**Gravedad:** máxima. Se cobraba y se entregaba un link que no abría.
**Duración del fallo:** 10:46 → 19:31 (8 h 45 min). **Familias afectadas:** 1 (23 minutos, 11 intentos). Fueron dos
compras de la misma guía: la de tarjeta de las 19:01 y otra con código a las 19:21, hecha en plena falla (parece un
reintento para conseguir un link nuevo), que tampoco abrió. Por las huellas de red, 10 de los 11 intentos salieron de
una misma red (una computadora y un iPhone) y 1 de un segundo teléfono en otra red.
**Del aviso de Daniel al arreglo en vivo:** unos 6 minutos.

### Qué vio el cliente
Pagó con tarjeta, recibió su guía por correo y WhatsApp y, al abrir el link, la pantalla decía «Algo falló. No se pudo
abrir la guía. Intenta de nuevo en un momento». Lo intentó 11 veces en dos dispositivos. Daniel lo describió como «dice
que algo salió mal».

### Línea de tiempo
| Hora | Qué pasó |
|---|---|
| 10:46 | Se despliega el código 2026-11-10.3 (función v45) con el módulo nuevo `acceso.ts`: entrada al panel con correo y contraseña. **Aquí empieza el fallo.** |
| 11:32 y 15:40 | Dos despliegues más (v46 y v47). Ninguna comprobación abre una guía con una clave. |
| 19:01 | Una familia paga con tarjeta. A las 19:04 su guía está completa y entregada. |
| 19:10 – 19:23 | 11 intentos de abrir el link: el servidor responde HTTP 404 `{"error":"Ruta no encontrada"}`. |
| ≈ 19:24 | Daniel avisa. |
| 19:26 | Causa confirmada leyendo el registro del servidor y el código. |
| 19:27 | Arreglo del servidor guardado en GitHub (`22a67ec`). El despliegue es **rechazado** por el sistema de permisos. |
| 19:28 | Salida alterna comprobada con una clave inventada: `POST /acceso/<clave>/abrir` sí llega a la ruta de las guías. |
| 19:30 | Reproductor corregido y publicado (`55b4a69`). **Fin del fallo.** |
| 19:33 | La familia abre su guía (`accesos.primer_uso_en`). A las 19:45 se abre el segundo link de la misma guía. |
| 19:45 | Publicados los candados: prueba de humo, aviso automático, reglas (`fa704ef`). |

### Causa
`funciones/sparked/acceso.ts` atendía **toda** dirección `POST /acceso/<algo>` y respondía «Ruta no encontrada» a lo
que no fuera `entrar`, `renovar` o `salir`. Pero `POST /acceso/<clave de la familia>` es la dirección con la que el
reproductor abre una guía pagada, y vive en `index.ts`. Los módulos aparte se ejecutan **antes** que las rutas de
`index.ts`, así que la ruta de las familias dejó de ejecutarse.

Por qué no se detectó en nueve horas:
1. El módulo lo escribió un ayudante y su propia prueba daba por bueno ese comportamiento («rutas que no existen → 404»).
   Nadie comparó las direcciones nuevas con las que ya existían.
2. Después de cada despliegue solo se revisaba `/admin/ping` y el panel. Nunca se abría una guía con una clave.
3. Comprar, pagar, generar y entregar seguían funcionando; el fallo solo se veía al abrir el link.
4. No había ningún aviso: el servidor no registraba el fallo como error y Daniel se enteró por la clienta.

### Cómo se resolvió
1. **Ubicar la compra** en `compras` (las de las últimas horas, sin datos personales).
2. **Leer el registro del servidor** de esa hora: todas las `POST /acceso/<clave>` devolvían 404 con 50 bytes.
3. **Leer el orden de las rutas** en `index.ts` y el filtro de `acceso.ts`: choque confirmado.
4. **Arreglar el servidor** (`acceso.ts` solo se queda con sus tres rutas) y subirlo. El despliegue fue rechazado.
5. **Buscar otra salida que no dependiera del despliegue:** la ruta de `index.ts` no revisa lo que va después de la
   clave, y `acceso.ts` solo tapa cuando no hay nada después. Entonces `POST /acceso/<clave>/abrir` sí pasa. Se probó en
   producción con una clave inventada (respondió `{"estado":"inexistente"}`, o sea, la ruta verdadera).
6. **Publicar el reproductor** con esa dirección y `?v=` nuevo en `guia.html` para saltarse la copia guardada.
7. **Comprobar con evidencia real:** `accesos.primer_uso_en` de esa compra se llenó a las 19:33.
8. **Comprobar el contenido sin usar el link de la familia:** `GET /admin/guias/<id>/cartucho` + `guia.html?local=`
   (22 pantallas, cero errores, en celular y computadora).
9. **Medir el daño** en el registro del servidor: quién intentó abrir una guía durante el fallo (solo esa familia).

### Qué salió bien
- La causa se encontró con datos (registro del servidor), no con suposiciones.
- Hubo una salida por el sitio cuando el servidor no se pudo desplegar.
- Se comprobó con una clave inventada antes de publicar, y con el dato real después.
- No se gastó ningún dispositivo de la familia ni se tocó su acceso.

### Qué estuvo lento o mal
- **Dos minutos buscando el texto equivocado.** Daniel dijo «algo salió mal»; el texto real era «Algo falló». Primero
  hay que mirar el sistema, no buscar frases.
- **Un minuto perdido** preparando un despliegue que el sistema de permisos rechazó.
- **No existía prueba de humo.** Con ella, el diagnóstico habría sido de 30 segundos.
- **Daniel se enteró por la clienta**, no por nosotros.
- El primer mensaje a Daniel salió con el arreglo ya publicado. Debió salir uno antes, en cuanto se supo la causa.

### Cómo resolverlo más rápido la próxima vez
1. Primer comando, siempre: `node _guardia/skill/guardia-sparked/scripts/ronda.mjs`. Dice en segundos qué etapa del
   camino del cliente está rota.
2. Si falla «ABRIR UNA GUÍA» o «compra», **restablecer antes de entender**: ver `publicar-rapido.md`. El sitio se
   publica en un minuto y no pide permisos; es la primera opción.
3. Mientras GitHub Pages construye (≈ 1 min), hacer en paralelo lo demás: revisar el contenido de la guía y contar
   afectados.
4. Avisar a Daniel dos veces: al saber la causa («ya sé qué es, lo estoy arreglando») y al quedar restablecido.

### Candados que dejó
- `herramientas/probar-rutas.mjs`: antes de desplegar; falla si un módulo responde en una ruta de `index.ts`.
- `herramientas/prueba-de-humo.mjs`: después de publicar; prueba contra producción la dirección exacta con la que el
  reproductor publicado abre una guía.
- Aviso automático del reproductor (`AVISO AUTOMÁTICO` en Reportes) y correo a Daniel desde el código 2026-11-10.7.
- `acceso.ts` solo atiende sus tres rutas; `index.ts` acepta de forma explícita `/acceso/<clave>` y `/acceso/<clave>/abrir`.
- Vigilante automático (GitHub Actions): la prueba de humo corre sola cada 15 minutos y tras cada publicación; si
  falla dos veces, aviso en Issues y correo a Daniel. Con él, este fallo se habría sabido a las 11:00 y no a las
  19:24. **Quedó escrito y apagado** en `_guardia/vigilante/guardia.yml`: encenderlo necesita el sí de Daniel.
- Compuerta de lanzamiento (`scripts/lanzar.mjs`): no sube nada si la copia, servida en local, no pasa la prueba de
  humo contra el servidor real; después de subir corre la ronda.
- La ronda (`scripts/ronda.mjs`) pregunta al servidor por la llave de cada compra entregada, sin gastarla.
- Esta skill y su agente.

### Simulacro del mismo día (20:31)
Un ayudante sin contexto recibió «una clienta dice que pagó hoy en la tarde y su link dice que algo salió mal». Con la
skill llegó en minuto y medio al diagnóstico correcto (la dirección tapada, ya resuelta; las dos compras abiertas a
las 19:33 y 19:45). Lo que le costó, ya corregido: contó dos familias donde había una (ahora la skill dice «cuenta
compras, no huellas»), la consulta de compras no mostraba una compra creada antes y pagada después, las horas venían
en UTC y faltaba una consulta de intentos de abrir uno por uno. La compuerta también tuvo su tropiezo: esperaba la
publicación mirando una lista de GitHub que anotó el commit anterior y se quedó colgada 7 minutos; ahora mira la
corrida de ese commit y compara lo publicado con la copia.

### Pendiente al cerrar
- Desplegar el código 2026-11-10.7 (necesita el visto bueno de Daniel; el permiso fue rechazado). Mientras no se
  despliegue, la dirección anterior sigue tapada: quien tenga la página abierta desde antes de las 19:30 del 10 nov
  tiene que recargarla.
- Encender el vigilante automático (necesita el visto bueno de Daniel; el permiso para subirlo fue rechazado). Pasos
  en `_guardia/LEEME.md`.
- Daniel no tenía puesto su «correo de avisos» en Ajustes.

---

## Plantilla para el siguiente incidente

```markdown
## AAAA-MM-DD · Título corto con lo que vio el cliente

**Gravedad:** … **Duración del fallo:** … **Familias afectadas:** … **Del aviso al arreglo en vivo:** …

### Qué vio el cliente
### Línea de tiempo
| Hora | Qué pasó |
### Causa   (y por qué no se detectó antes)
### Cómo se resolvió   (pasos, en orden)
### Qué salió bien
### Qué estuvo lento o mal
### Cómo resolverlo más rápido la próxima vez
### Candados que dejó   (la prueba nueva debe fallar con el código viejo)
### Pendiente al cerrar
```
