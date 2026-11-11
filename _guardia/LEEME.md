# La guardia de SparkEd

Esta carpeta guarda al «guardia»: lo que usa Claude para que a ningún cliente le falle lo que pagó. Nació del fallo
del 10 de noviembre de 2026 (una familia pagó y su link no abrió). No es parte del sitio: GitHub no publica las
carpetas que empiezan con guion bajo.

## Qué hay aquí

| Carpeta o archivo | Qué es |
|---|---|
| `skill/guardia-sparked/SKILL.md` | Las instrucciones de la guardia: qué revisar antes y después de lanzar algo, qué hacer cuando un cliente tiene un fallo y cómo hacer una ronda. |
| `skill/guardia-sparked/scripts/ronda.mjs` | La ronda: revisa en producción todo el camino del cliente en unos 15 segundos. |
| `skill/guardia-sparked/scripts/lanzar.mjs` | La compuerta de lanzamiento: revisa, publica, espera y comprueba en un solo comando. |
| `skill/guardia-sparked/references/` | La bitácora de fallos, cómo publicar o regresar rápido, las consultas, el mapa del camino del cliente y la tabla de síntomas. |
| `agente/guardia-sparked.md` | El ayudante de guardia: un Claude dedicado solo a esto, que otro Claude puede llamar. |
| `instalar.mjs` | Copia la skill y el agente a la computadora para que estén en cualquier sesión de Claude. |
| `vigilante/guardia.yml` | El **vigilante automático**, guardado y apagado. Encendido, GitHub corre la prueba de humo cada 15 minutos y después de cada publicación; si falla dos veces seguidas, abre un aviso en la pestaña Issues y manda un correo a Daniel. |

Fuera de esta carpeta, pero parte de la guardia: `herramientas/prueba-de-humo.mjs`, `probar-rutas.mjs`,
`probar-guia.mjs` y `abrir-guia.mjs` (las pruebas).

## Encender el vigilante automático (necesita el sí de Daniel)

El vigilante trabaja solo, sin que nadie abra Claude: por eso es la pieza que avisa en minutos y no cuando una clienta
se queja. Como corre en la cuenta de GitHub de Daniel, **solo se enciende cuando él lo aprueba**. No usa llaves, no
gasta accesos y no cuesta (el repositorio es público). Con su sí:

```bash
mkdir -p .github/workflows && git mv _guardia/vigilante/guardia.yml .github/workflows/guardia.yml
```

```bash
node _guardia/skill/guardia-sparked/scripts/lanzar.mjs --automatizacion-aprobada-por-daniel -m "Enciende el vigilante automático de SparkEd" .github/workflows/guardia.yml _guardia/vigilante/guardia.yml
```

Después, un simulacro para comprobar que el aviso le llega a Daniel (abre un aviso marcado «SIMULACRO», que se cierra
solo en la siguiente revisión):

```bash
gh workflow run guardia.yml -R Danflores01/accesos-lumio -f simulacro=true
```

Al encenderlo, cambia en este archivo y en la bitácora «guardado y apagado» por «encendido», con la fecha.

## Cómo se usa

- **Tú (Daniel):** escríbele a Claude «guardia: …» y lo que pasa. Por ejemplo: «guardia: una clienta dice que su guía
  no abre», «guardia: haz una ronda», «guardia: llegó un correo de que falló el vigilante».
- **Claude:** la skill se activa sola al publicar algo de SparkEd o cuando alguien reporta un fallo.

## Instalar en otra computadora

```bash
gh repo clone Danflores01/accesos-lumio
```

```bash
node accesos-lumio/_guardia/instalar.mjs
```

Hace falta Node 22 o más nuevo y `gh` con la cuenta `Danflores01`. Para revisar compras y reportes, la ronda necesita
el archivo `CLAVES.txt` (la clave de administrador en la primera línea) en la raíz de la copia; ese archivo nunca se
sube a GitHub y lo pone Daniel.

## Apagar el vigilante automático (cuando ya esté encendido)

En GitHub: pestaña **Actions** → **Guardia SparkEd** → botón «…» → **Disable workflow** (para volver a encenderlo,
**Enable workflow**). La ronda avisa si está apagado.

## Si cambias algo de la guardia

Cámbialo aquí, publícalo con la compuerta y corre `node _guardia/instalar.mjs` para actualizar la copia instalada.
