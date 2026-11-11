# Publicar o regresar rápido

Meta: desde «ya sé qué falla» hasta «arreglado en vivo», **3 minutos por el sitio y 5 por el servidor**. Cuando un
cliente no puede usar lo que pagó, primero se restablece el servicio y después se busca la causa de fondo.

## Los dos caminos

| | Sitio (GitHub Pages) | Servidor (función `sparked` de Supabase) |
|---|---|---|
| Qué es | Todo lo de `sparked/`: páginas, reproductor, panel | `funciones/sparked/*.ts` |
| Cómo se publica | `git push origin main` | Subir a GitHub, apuntar el puente y desplegar |
| Cuánto tarda | 40 a 70 segundos | 1 a 2 minutos después del push |
| Permisos | Ninguno especial | El despliegue puede ser **rechazado** en modo automático |
| Cómo se regresa | `git revert` y push | Puente al commit anterior y desplegar |
| Copia guardada | El navegador guarda 10 minutos cada archivo | No hay |

Por eso el sitio es la **primera opción** para restablecer: es más rápido y no depende de permisos.

## Decidir en 30 segundos

1. **¿Empezó con una publicación reciente?** Compara la hora del primer fallo (registro del servidor, `consultas.md`)
   con `git log --format='%h %ad %s' --date=format:'%d %b %H:%M' -8`. Si coincide, **regresar** esa publicación es lo
   más rápido, siempre que lo que se pierde no lo usen los clientes (por ejemplo, una mejora del panel).
2. **¿Se puede esquivar desde el sitio?** Cambiar la dirección que pide el reproductor, tolerar una respuesta, apagar
   un botón nuevo. Así se resolvió el 10 nov 2026: el servidor seguía mal y el sitio dejó de pasar por ahí.
3. **Si solo el servidor lo arregla:** sube el arreglo a GitHub, intenta desplegar y, si el permiso es rechazado, pide
   a Daniel el visto bueno en una línea («necesito tu sí para desplegar el servidor») mientras preparas el plan B.

Nunca esperes en silencio: mientras algo construye o despliega, comprueba otra cosa o escribe el aviso a Daniel.

## Publicar el sitio

**Con la compuerta (lo normal, también en una urgencia).** Un solo comando revisa, sube una vez, espera a GitHub Pages
y corre la ronda. Si las revisiones de antes fallan, no sube nada:

```bash
node _guardia/skill/guardia-sparked/scripts/lanzar.mjs -m "URGENTE: <qué se arregla>" <archivo> [<archivo> …]
```

Lo que revisa antes: copia al día con GitHub, nada privado ni de la fase 1, sintaxis de cada archivo (también los
guiones dentro de las páginas), `probar-rutas` si va código del servidor y la prueba de humo **de esta copia** contra
el servidor real. Esa última es la que habría atrapado un reproductor que pide una dirección que el servidor no
atiende. `--revisar` hace solo las revisiones; `--esperar` espera lo ya subido y corre la ronda.

**A mano** (solo si la compuerta no está disponible):

```bash
git fetch origin && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" || echo "EL REMOTO CAMBIÓ: revisa antes de subir"
git add <archivos exactos>            # nunca git add -A: CLAVES.txt y pruebas no se suben
git commit -m "URGENTE: <qué se arregla>"
git push origin main                  # UN solo push: dos en menos de un minuto tumban la construcción
```

Esperar la construcción (no adivinar):

```bash
until s=$(gh api "repos/Danflores01/accesos-lumio/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '[.workflow_runs[] | select(.path | test("pages"))][0] | "\(.status) \(.conclusion)"') && case "$s" in completed*) true;; *) false;; esac; do sleep 6; done; echo "$s"
```

Debe decir `completed success`. Si dice `completed failure`: `gh api -X POST repos/Danflores01/accesos-lumio/pages/builds`
y esperar otra vez.

**No te fíes de la lista antigua** (`pages/builds`) para saber qué commit está publicado: el 10 nov 2026 anotó el
commit anterior cuando el sitio ya traía el nuevo, y una espera basada en ella se quedó colgada 7 minutos. La señal
fiable es la corrida «pages build and deployment» de ese commit; la prueba definitiva, que un archivo publicado sea
idéntico al de la copia (la compuerta hace las dos cosas).

**Copia guardada del navegador.** Si cambias `sparked/js/reproductor.js` de forma urgente, sube también el `?v=` de su
etiqueta en `sparked/guia.html` (por ejemplo `?v=2026-11-11b`). Sin eso, quien abrió la página hace menos de 10 minutos
sigue con el archivo viejo. Pídele a Daniel que le diga a la familia que recargue la página.

## Desplegar el servidor (por el puente)

1. `node herramientas/probar-rutas.mjs` (y las pruebas del módulo tocado). Si falla, no se despliega.
2. Sube el código (`git push`). GitHub debe servirlo:
   `curl -s -o /dev/null -w "%{http_code}" https://raw.githubusercontent.com/Danflores01/accesos-lumio/$(git rev-parse HEAD)/funciones/sparked/index.ts` → 200.
3. Que no haya una guía generándose: `select count(*) from trabajos where estado not in ('listo','fallido')` → 0.
4. Apunta el puente al commit y despliega solo ese archivo:

```bash
SHA=$(git rev-parse HEAD); V=$(grep -o 'VERSION = "[^"]*"' funciones/sparked/index.ts | cut -d'"' -f2)
sed -i "s/^\/\/ Versión del código: .*$/\/\/ Versión del código: $V (commit $SHA)./; s#accesos-lumio/[0-9a-f]\{40\}/funciones/sparked/index.ts#accesos-lumio/$SHA/funciones/sparked/index.ts#" funciones/puente-sparked/index.ts
```

   Herramienta `deploy_edge_function` de Supabase: proyecto `wfqfqfsbkqbaejnkhidz`, nombre `sparked`, entrada
   `index.ts`, `verify_jwt: false`, un solo archivo `index.ts` con el contenido del puente. Nunca subas los archivos
   grandes de `funciones/sparked/`.
5. Comprueba la versión (`ronda.mjs` lo hace) y guarda el puente en un commit **solo si el despliegue se hizo**: el
   puente del repositorio siempre dice qué está desplegado de verdad.

**Si el despliegue es rechazado por permisos:** no lo intentes por otro lado. Deja el puente como estaba
(`git checkout -- funciones/puente-sparked/index.ts`), resuelve por el sitio si se puede y pídele a Daniel el sí.

## Regresar

- **Sitio:** `node _guardia/skill/guardia-sparked/scripts/lanzar.mjs --regresar <commit malo>` (deshace ese commit,
  sube, espera y corre la ronda). A mano: `git revert --no-edit <commit malo> && git push origin main`. Si fueron
  varios, revierte del más nuevo al más viejo en un solo push.
- **Servidor:** mismo paso 4 de arriba, con `SHA=<commit bueno anterior>`. La lista de puentes anteriores:
  `git log --format='%h %ad %s' --date=format:'%d %b %H:%M' -- funciones/puente-sparked/index.ts`.
  Antes de regresar, revisa qué se pierde: si el commit bueno es anterior a una migración o a una función que el sitio
  ya usa, el regreso rompe otra cosa.

## Comprobar que quedó (siempre, antes de avisar)

1. `node _guardia/skill/guardia-sparked/scripts/ronda.mjs` sin FALLA.
2. El caso real: en `accesos`, `primer_uso_en` y `usos` de la compra afectada (ver `consultas.md`). Ese dato es la
   prueba de que la familia ya entró. No abras tú su link: gastarías uno de sus dos dispositivos.
3. El contenido: `node herramientas/probar-guia.mjs <id de la guía>` (baja la guía con la clave de administrador y la
   recorre en el reproductor publicado).

## Preparativos que ahorran minutos

- **Permiso para desplegar.** Si Daniel quiere que una emergencia no dependa de que esté disponible, puede permitir de
  forma permanente la herramienta de despliegue de Supabase en los permisos de Claude Code. Es decisión suya: abre la
  puerta a desplegar sin preguntar.
- **Correo de avisos** puesto en Ajustes del panel: sin él, los avisos automáticos solo se ven en Reportes.
- **Vigilante automático encendido** (`.github/workflows/guardia.yml`): corre la prueba de humo cada 15 minutos y tras
  cada publicación, y avisa por correo. Con él, un fallo como el del 10 nov se sabe en minutos y no por una clienta.
  Encenderlo es decisión de Daniel (pasos en `_guardia/LEEME.md`); la ronda dice si está encendido.
- **Copia local al día:** `git fetch origin && git status` antes de tocar nada. Otra sesión puede haber subido cambios.
