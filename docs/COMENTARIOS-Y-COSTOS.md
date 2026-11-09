# Comentarios y costos en pesos (panel de SparkEd)

Código: `funciones/sparked/extras.ts` (servidor) y `sparked/panel.html` (pestañas «Comentarios» y «Costos»).
Base de datos: `sql/migraciones/20261109_sparked_comentarios_tipos_cambio.sql` (tablas `comentarios` y `tipos_cambio`).

## 1. Comentarios de la portada

La caja de comentarios al final de la portada manda los datos a `POST /comentarios`:

```json
{ "nombre": "…", "texto": "…", "estrellas": 5, "relacion": "mama_papa", "permiso_publicar": true, "sitio_web": "", "idioma": "es" }
```

| Campo | Regla |
|---|---|
| `nombre` | de 2 a 60 letras |
| `texto` | de 10 a 600 letras (se respetan los saltos de línea) |
| `estrellas` | número entero de 1 a 5 |
| `relacion` | opcional: `mama_papa`, `alumno`, `docente` u `otro` |
| `permiso_publicar` | `true` o `false` |
| `sitio_web` | trampa para robots: si trae texto, se responde `{ ok: true }` y no se guarda nada |
| `idioma` | opcional: `es` o `en` |

Respuestas: `{ ok: true }` o `{ error }` con uno de estos textos:

- «Escribe tu nombre.»
- «Escribe tu comentario (de 10 a 600 letras).»
- «Elige de 1 a 5 estrellas.»
- «Ya recibimos varios comentarios desde este dispositivo. Inténtalo mañana.» (más de 3 en 24 horas desde la misma conexión)
- «No pudimos guardar tu comentario. Inténtalo más tarde.» (falla de la base de datos o más de 150 comentarios en 24 horas en todo el sitio)

Cuidados: se quitan los caracteres de control e invisibles; no se guarda la IP, solo una huella (sha256 de la IP con sal);
el panel muestra todo el texto escapado (nunca como HTML). Cada comentario nuevo manda un correo de aviso a Daniel
(si hay correo de avisos en Ajustes).

Panel → «Comentarios»: el número en la pestaña son los nuevos; cada comentario se puede marcar como leído, destacar
(para publicarlo más adelante, solo si la persona dio permiso), ocultar, borrar o copiar. En «Resumen» aparece un aviso
cuando hay comentarios nuevos. Nada se publica solo.

Rutas de administración: `GET /admin/comentarios?estado=nuevo|leido|destacado|oculto|todos` → `{ comentarios, nuevos }`;
`PATCH /admin/comentarios/:id { estado }`; `DELETE /admin/comentarios/:id`.

## 2. Costos en pesos

`GET /admin/costos?dias=30` (de 1 a 365 días) devuelve:

- `tipo_cambio`: valor, fecha de publicación, `fuente` (`DOF`, `Banxico` o `ajuste`), `consulta` (`ok`, `no_hacia_falta`
  o `fallo`) y un `aviso` en palabras cuando no se pudo consultar.
- `gasto_ia`: hoy, últimos 7 días, últimos 30, mes en curso y el periodo pedido, en pesos y dólares.
- `por_dia`: gasto, vistas previas, guías completas, ventas y tipo de cambio de cada día.
- `por_paso`: gasto por paso y modelo (leer las fotos, planear, escribir, reparar, revisar ortografía, verificar).
- `promedios`: costo promedio de una vista previa y de una guía completa (vista previa + resto, o completa de una vez).
- `ingresos`, `servicios_fijos`, `fijos_mes_mxn` y `balance` (ventas − IA − servicios fijos).

Cómo se calcula:

- Cada trabajo de la IA (`trabajos.costo_usd`) se convierte con el tipo de cambio del día en que se creó, en hora de
  Ciudad de México. Los fines de semana y días festivos usan el último tipo publicado.
- El desglose por paso sale de `trabajos.datos.metricas`. El trabajo «resto» copia las métricas de su vista previa;
  solo se cuentan las llamadas hechas después de que empezó el trabajo, para no contarlas dos veces. Si sobra algo sin
  desglose, aparece como «Sin desglose», así el desglose siempre suma lo mismo que el total.
- Ingresos = compras pagadas con dinero (`estado = pagada`, por `pagada_en`). Las de código gratis no son ventas.
- No incluye la comisión de Mercado Pago ni impuestos.

### Tipo de cambio oficial

Es el «tipo de cambio para solventar obligaciones denominadas en moneda extranjera» (el FIX de Banxico que se publica
en el Diario Oficial de la Federación).

1. Fuente principal: API abierta del DOF, sin llave:
   `https://sidofqa.segob.gob.mx/dof/sidof/indicadores/158/DD-MM-AAAA/DD-MM-AAAA` (indicador 158). Si en esas fechas
   no hubo publicación (fin de semana) responde `messageCode: 404`.
2. Alternativa opcional: API SIE de Banxico, serie `SF60653` (la misma cifra, por fecha de publicación en el DOF).
   Solo se usa si existe el secreto `BANXICO_TOKEN` en Supabase (el token se pide gratis en el sitio de Banxico).
3. Si ninguna responde, se usa el último tipo guardado; si no hay ninguno, el «Tipo de cambio de respaldo» de Ajustes
   (`sparked_tipo_cambio`). El panel lo dice en un aviso rojo.

No hay tareas programadas: cuando el panel pide los costos, el servidor revisa qué días faltan en `tipos_cambio` y los
pide (como mucho una vez cada 15 minutos si ya hay datos).

### Servicios fijos

Lista editable en el panel (pestaña «Costos», abajo), guardada como JSON en la fila `sparked_servicios_fijos` de la
tabla `config`. Cada servicio tiene nombre, monto al mes, moneda (dólares o pesos) y nota. Ruta:
`POST /admin/costos/servicios { servicios: [{ nombre, monto, moneda: "USD" | "MXN", nota }] }` (máximo 20).
