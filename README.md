# SparkEd Accesos (accesos-lumio)

App personal para repartir accesos a clases de Lumio por WhatsApp: cada familia recibe un link
único, con vigencia propia, que deja de funcionar si lo reenvían.

- **App (celular y computadora):** `index.html`, publicada con GitHub Pages en
  https://danflores01.github.io/accesos-lumio/
- **Página que ven los alumnos:** `entrar.html` (el código del link va después de `#`).
- **Servidor:** proyecto Supabase `accesos-lumio` (funciones en `funciones/`, esquema inicial en
  `sql/esquema.sql` y migraciones posteriores en `sql/migraciones/`).
- **Guía de uso y detalles:** `GUIA.md`.

La clave de administrador no está en este repositorio: vive en el archivo privado `CLAVES.txt`
y el servidor solo guarda su hash.

## Publicar una versión nueva

Cada publicación debe subir la versión **en los dos lugares a la vez**, con el mismo valor:

1. La constante `VERSION` al inicio del script de `index.html` (formato `AAAA-MM-DD.n`; `n` cuenta las
   publicaciones de ese día: `2026-10-20.1`, `2026-10-20.2`…).
2. El archivo `version.json`: `{ "version": "2026-10-20.1" }`.

La app abierta compara su `VERSION` con el `version.json` publicado y, si difieren, muestra la banda
"Hay una versión nueva" con el botón Actualizar. Si solo se cambia uno de los dos, la app avisará de una
versión que nunca llega (o no avisará nunca). GitHub Pages tarda hasta 10 minutos en servir lo nuevo.

Después, `git commit` y `git push` a `main`. Las funciones del servidor se despliegan aparte en Supabase y las
migraciones se aplican allí (copia en `sql/migraciones/`).
