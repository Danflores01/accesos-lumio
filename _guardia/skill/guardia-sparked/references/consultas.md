# Consultas listas para diagnosticar

Proyecto de Supabase: `wfqfqfsbkqbaejnkhidz`. Las consultas a la base van con la herramienta `execute_sql` y las del
registro del servidor con `query_logs` (ventana máxima de 24 horas; pasa siempre inicio y fin).

**Privacidad.** Estas consultas no traen nombres, teléfonos, correos ni claves de acceso. No las cambies para traerlos:
para diagnosticar bastan folios, horas y estados. La clave de un link (`accesos.token`) nunca se imprime.

Horas: la base y el registro están en UTC. México = UTC − 6.

## 1. Compras recientes, con todo su camino

```sql
select left(c.id::text, 8) as folio, c.estado, c.metodo_pago, c.mp_estado,
       c.creada_en, c.pagada_en, c.entregada_en, c.correo_lista_en, c.wa_estado, left(coalesce(c.wa_detalle,''), 80) as wa_detalle,
       c.grado, c.materia, c.guia_id, g.estado as guia_estado, g.reporte->>'etapa' as etapa,
       (g.cartucho->>'completo') as completa,
       a.id is not null as tiene_acceso, a.usos, a.primer_uso_en, a.ultimo_uso_en, a.expira_en, a.revocado,
       (select count(*) from acceso_dispositivos d where d.acceso_id = a.id) as dispositivos
from compras c
left join guias g on g.id = c.guia_id
left join accesos a on a.id = c.acceso_id
where c.creada_en > now() - interval '48 hours'
order by c.creada_en desc limit 30;
```

Cómo leerla: `pagada` + `completa = true` + `entregada_en` + `usos > 0` es el camino completo. Lo que falte dice en qué
etapa se quedó. `usos = 0` horas después de entregar puede ser normal (no la han abierto) o señal de que no pueden.

## 2. ¿Ya entró la familia? (la prueba de que un arreglo funcionó)

```sql
select left(a.id::text, 8) as acceso, a.usos, a.primer_uso_en, a.ultimo_uso_en, a.expira_en,
       (select count(*) from acceso_dispositivos d where d.acceso_id = a.id) as dispositivos
from accesos a join compras c on c.acceso_id = a.id
where c.id::text like '<folio en minúsculas>%';
```

## 3. Trabajos de generación (vista previa y guía completa)

```sql
select left(t.id::text, 8) as trabajo, t.tipo, t.estado, t.paso, t.intentos, left(coalesce(t.error,''), 200) as error,
       t.creado_en, t.actualizado_en, left(t.guia_id::text, 8) as guia
from trabajos t
where t.creado_en > now() - interval '24 hours' or t.estado not in ('listo','fallido')
order by t.creado_en desc limit 30;
```

`pendiente` o `corriendo` con `actualizado_en` de hace más de 5 minutos = atorado. `error` o `fallido` = la familia ve
«Estamos revisando tu guía». Reintento: `POST /admin/trabajos/<id completo>/reintentar` (lo mismo que el botón
↻ Reintentar del Resumen).

## 4. Antes de desplegar: que no haya nada a medias

```sql
select (select count(*) from trabajos where estado not in ('listo','fallido')) as trabajos_en_curso,
       (select count(*) from compras where estado = 'pendiente' and creada_en > now() - interval '30 minutes') as compras_en_proceso;
```

## 5. Reportes y avisos automáticos

```sql
select left(r.id::text, 8) as reporte, r.estado, r.creado_en, r.slide, left(r.comentario, 220) as comentario,
       left(r.guia_id::text, 8) as guia, r.acceso_id is not null as con_acceso
from reportes r where r.creado_en > now() - interval '7 days' order by r.creado_en desc limit 30;
```

Un comentario que empieza con `AVISO AUTOMÁTICO` lo mandó el reproductor porque una guía pagada no abrió. Trae el
código HTTP y el motivo: es el diagnóstico más rápido que existe.

## 6. WhatsApp: últimos movimientos

```sql
select creado_en, direccion, tipo, estado, left(coalesce(detalle,''), 120) as detalle, compra_id is not null as con_compra
from wa_mensajes order by creado_en desc limit 25;
```

## 7. Registro del servidor: qué pidieron y qué se les contestó

Las pruebas de la guardia (la prueba de humo, la ronda y el vigilante automático, que pregunta cada 15 minutos con
claves inventadas) se identifican como `guardia-sparked/…`. Estas consultas ya las dejan fuera: sin ese filtro verías
cientos de respuestas 404 que no son de ninguna familia.

Camino del cliente, sin las claves (cambia las horas):

```sql
select formatDateTime(timestamp, '%d %H:%i:%S') as hora,
       log_attributes['request.method'] as m,
       replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(log_attributes['request.pathname'],
         '/acceso/[A-Za-z0-9]+', '/acceso/<clave>'), '/progreso/[A-Za-z0-9]+', '/progreso/<clave>'), '/borrador/[A-Za-z0-9]+', '/borrador/<clave>') as ruta,
       log_attributes['response.status_code'] as st,
       log_attributes['execution_time_ms'] as ms,
       multiIf(position(log_attributes['request.headers.user_agent'], 'iPhone') > 0, 'iPhone',
               position(log_attributes['request.headers.user_agent'], 'Android') > 0, 'Android',
               position(log_attributes['request.headers.user_agent'], 'Windows') > 0, 'Windows',
               position(log_attributes['request.headers.user_agent'], 'Macintosh') > 0, 'Mac',
               position(log_attributes['request.headers.user_agent'], 'MercadoPago') > 0, 'Mercado Pago',
               position(log_attributes['request.headers.user_agent'], 'Deno') > 0, 'servidor', 'otro') as equipo
from logs
where source = 'function_edge_logs'
  and log_attributes['request.method'] != 'OPTIONS'
  and log_attributes['request.pathname'] not like '%/whatsapp/webhook%'
  and log_attributes['request.pathname'] not like '%/admin/%'
  and log_attributes['request.headers.user_agent'] not like 'guardia-sparked%'
order by timestamp asc limit 200
```

Solo los fallos (cualquier respuesta 4xx o 5xx), agrupados: la forma más rápida de ver qué está roto.

```sql
select replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(log_attributes['request.pathname'],
         '/acceso/[A-Za-z0-9]{8,64}', '/acceso/<clave>'), '/progreso/[A-Za-z0-9]{8,64}', '/progreso/<clave>'), '/borrador/[A-Za-z0-9]{8,64}', '/borrador/<clave>'),
         '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<folio>'), '/ir/[A-Za-z0-9]+', '/ir/<clave>') as ruta,
       log_attributes['request.method'] as m, log_attributes['response.status_code'] as st,
       count() as veces, formatDateTime(min(timestamp), '%d %H:%i') as primero, formatDateTime(max(timestamp), '%d %H:%i') as ultimo
from logs
where source = 'function_edge_logs' and toInt32OrZero(log_attributes['response.status_code']) >= 400
  and log_attributes['request.pathname'] not like '%/whatsapp/webhook%'
  and log_attributes['request.headers.user_agent'] not like 'guardia-sparked%'
group by ruta, m, st order by veces desc limit 40
```

Un 404 o 500 repetido en `/acceso/…`, `/pago/…` o `/borrador/…` es un cliente que no pudo. Un 404 con el cuerpo
`{"error":"Ruta no encontrada"}` en una dirección que sí existe significa que la ruta está tapada o desapareció.

Cuántas personas distintas intentaron abrir una guía y qué les contestó el servidor (para medir el daño):

```sql
select substring(hex(cityHash64(log_attributes['request.headers.cf_connecting_ip'])), 1, 6) as quien,
       log_attributes['response.status_code'] as st, count() as intentos,
       formatDateTime(min(timestamp), '%d %H:%i') as primero, formatDateTime(max(timestamp), '%d %H:%i') as ultimo
from logs
where source = 'function_edge_logs' and log_attributes['request.method'] = 'POST'
  and match(log_attributes['request.pathname'], '/sparked/acceso/[A-Za-z0-9]{8,64}(/abrir)?$')
  and log_attributes['request.headers.user_agent'] not like 'guardia-sparked%'
group by quien, st order by min(timestamp) asc limit 60
```

`quien` es una huella de la dirección de red, no la dirección. Las pruebas que hagas a mano (con `curl` o desde un
navegador de prueba) sí salen ahí: réstalas.

Errores que escribió el propio servidor (`console.error` y avisos):

```sql
select formatDateTime(timestamp, '%d %H:%i:%S') as hora, log_attributes['level'] as nivel, substring(event_message, 1, 300) as mensaje
from logs
where source = 'function_logs' and log_attributes['level'] in ('error', 'warning')
order by timestamp desc limit 40
```

Los avisos «Actividad descartada» son normales: el revisor de la IA quitó una pregunta mala. Lo que importa son los de
nivel `error`. No uses referencias `\1` en las expresiones de estas consultas: la herramienta las entrega mal y sale un
«1» en su lugar; encadena varios `replaceRegexpAll`, como arriba.

## 8. Qué versión está desplegada

`node _guardia/skill/guardia-sparked/scripts/ronda.mjs` lo dice. A mano:
`GET /admin/ping` con la cabecera `x-admin-key` (primera línea de `CLAVES.txt`, sin imprimirla) → `version`.
El puente (`funciones/puente-sparked/index.ts`) dice qué commit está desplegado.
