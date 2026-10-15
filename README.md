# Accesos Lumio

App personal para repartir accesos a clases de Lumio por WhatsApp: cada persona recibe un link
único, con vigencia propia, que deja de funcionar si lo reenvían.

- **App (celular y computadora):** `web/index.html`, publicada con GitHub Pages.
- **Página que ven los alumnos:** `web/entrar.html` (el token va después de `#`).
- **Servidor:** proyecto Supabase `accesos-lumio` (funciones en `funciones/`, esquema en `sql/`).
- **Guía de uso y detalles:** `GUIA.md`.

La clave de administrador no está en este repositorio: vive en el archivo privado `CLAVES.txt`
y el servidor solo guarda su hash.
