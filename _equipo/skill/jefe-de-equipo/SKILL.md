---
name: jefe-de-equipo
description: >-
  Trabajo de la sesión JEFE de SparkEd («Study Guide Hub»): mantener al día los manuales de las sesiones de operación
  (_equipo/ del repositorio accesos-lumio) y ponerlas en contexto cuando algo cambia. Úsala SIEMPRE en la sesión jefe,
  aunque nadie la nombre, cuando: Daniel da una regla, criterio, precio, decisión o corrección nueva; se despliega o
  publica algo que cambia cómo trabaja otra sesión (ruta, archivo, tabla, herramienta, prueba, flujo); pasa un fallo o
  incidente; se crea, renombra, archiva o cambia de motor una sesión; Daniel pide «pon en contexto a las sesiones»,
  «actualiza los manuales», «avísales a todas», o va a delegar un encargo a otra sesión. NO la uses dentro de una
  sesión de operación (IA, Pagos, Visuales, Animaciones): ellas solo leen su manual.
---

# Jefe de equipo de SparkEd

Daniel trabaja con varias sesiones de Claude, cada una con un tema y un motor fijo. Esta sesión (la jefe, en Fable)
es la única que ve todo. Su chamba aquí: que cada sesión de operación tenga siempre un manual vigente y sepa a tiempo
de los cambios que le afectan, para que nadie improvise ni trabaje con reglas viejas. Cada aviso cuesta uso, así que
se avisa lo que cambia su trabajo, a quien le afecta, una vez y corto.

Todo vive en el repositorio `accesos-lumio`, carpeta `_equipo/` (GitHub Pages no la publica):

- `LEEME.md`: el equipo (sesión, motor, manual) y las reglas para todos.
- `<tema>.md`: el manual de cada sesión (propósito, lo que le toca y no, parte administrativa, checklists, lo
  aprendido, pendientes).
- `CAMBIOS.md`: la bitácora de cambios avisados.
- `references/equipo.md` (junto a esta skill): ids de sesión, motores y qué tema cubre cada una.

## Cuándo un cambio merece aviso

Avisa si cambia **cómo trabaja** una sesión: una regla o criterio de Daniel, una ruta, archivo, tabla o comando que
usa, una prueba o paso obligatorio, un precio o texto oficial, quién decide algo, o un fallo que pudo pasarle a ella.

No avises por cambios que no tocan su trabajo, detalles que ya están en su manual o trabajo a medias que aún puede
cambiar. Junta varios cambios del mismo día en un solo aviso si nada urge. Si es urgente (un fallo que puede repetir
ya mismo), avisa en el momento.

## Pasos

1. **Ubica a quién afecta.** Usa la tabla de temas de `references/equipo.md`. Si afecta a todas, también va a
   `_equipo/LEEME.md`.
2. **Actualiza el manual primero, el mensaje después.** Edita solo las secciones que cambian del `_equipo/<tema>.md`
   de cada sesión afectada: la regla en su lugar (checklist, «Lo que me toca», administrativa) y una línea con fecha
   en «Lo aprendido» si viene de un error o de una decisión de Daniel. Quita lo que quedó viejo; un manual con reglas
   que se contradicen es peor que uno corto. Mantén cada manual en ~200 líneas.
3. **Anota en `_equipo/CAMBIOS.md`** (lo más nuevo arriba): fecha, qué cambió, por qué, a qué sesiones, qué secciones.
4. **Publica los manuales** con la compuerta de la guardia:
   `node _guardia/skill/guardia-sparked/scripts/lanzar.mjs -m "Equipo: <qué cambia>" _equipo/<archivos>`.
5. **Avisa a cada sesión afectada** con `SendMessage` (`to` = su id), con la plantilla de abajo. Pide una respuesta de
   una línea: así sabes que lo leyó sin pagar un turno largo.
6. **Comprueba.** Cuando contesten, cuenta las confirmaciones. Si una no contesta o no le llegó (sesión archivada o
   borrada), díselo a Daniel en una línea y actualiza `references/equipo.md`.
7. **Cuéntaselo a Daniel** en 2 o 3 líneas: qué cambió, a quién se avisó y quién confirmó.

## Plantilla del aviso

```
CAMBIO EN TU MANUAL (<fecha>): <una frase con el cambio>.
Por qué: <una frase>.
Qué haces distinto desde ahora: <1 a 3 puntos concretos>.
Ya está en _equipo/<tema>.md, sección «<sección>». Léela y contesta solo «Entendido» en una línea.
```

La primera línea es lo que la sesión ve de vista previa: que diga el cambio, no un saludo. No mandes contenido largo
en el mensaje; el detalle vive en el manual.

## Al delegar un encargo

Antes de mandar trabajo a una sesión: revisa que su manual cubra lo que le vas a pedir y que tenga lo más reciente
(un cambio de hoy que aún no le avisaste va en el mismo mensaje del encargo). En el encargo di qué quiere Daniel, qué
es «terminado» y qué debe entregarte. Cuando entregue, revisa su resultado (no basta su informe) y, si aprendió algo
que debe quedar, súbelo a su manual.

## Cambios de equipo

- **Sesión nueva:** propón a Daniel nombre por tema y el motor más barato que alcance (Haiku para tareas mecánicas,
  Sonnet para diseño y trabajo de diario, Opus si un error cuesta dinero o calidad de lo que se vende, Fable solo la
  jefe). Al crearla: su manual en `_equipo/`, su fila en `LEEME.md` y en `references/equipo.md`, y su primer mensaje
  con el encargo de leerlo.
- **Cambio de motor:** con su sí, `set_session_model`; actualiza las dos tablas.
- **Sesión archivada o borrada:** quítala de las tablas; su manual se queda por si vuelve.

## Cada cierto tiempo

Si pasaron varios días o muchos cambios, haz un repaso: lee los manuales contra lo que se decidió aquí y corrige lo
viejo. Si algo se repite en todos, súbelo a `LEEME.md`.
