# Pantalla «sin internet» de SparkEd (Sparky repara el router)

Cuando no hay conexión, en lugar del error del navegador sale una escena animada de Sparky reparando un router con el
mensaje «Tu internet no quiso estudiar hoy. Deja que vuelva de su descanso e inténtalo más tarde.» y un botón
«Reintentar». En inglés (si `localStorage.sparked_idioma === "en"` o la dirección trae `?lang=en`): "Your internet
didn't feel like studying today / Let it come back from its break and try again later. / Try again".

## Qué hace

1. **Página sin conexión** (`sparked/sin-internet.html`): autocontenida (CSS, SVG y JavaScript dentro del archivo,
   tipografías del sistema, cero peticiones de red). «Reintentar» comprueba la conexión y recarga la dirección que se
   quería abrir; si vuelve la conexión (evento `online`) recarga sola.
2. **Service worker** (`sparked/sw.js`, alcance solo `/sparked/`):
   - al instalarse guarda en caché únicamente `sin-internet.html` (caché `sparked-sin-internet-v1`);
   - para peticiones de **navegación** (abrir una página: GET, mismo origen) intenta la red y, solo si falla, responde con
     la página sin conexión;
   - no guarda ni sirve desde caché ningún otro archivo (nadie ve versiones viejas del sitio) y no intercepta scripts,
     imágenes ni llamadas al servidor (Supabase);
   - usa `skipWaiting` y `clients.claim`, y borra las cachés viejas que empiecen con `sparked-sin-internet-`.
   - Nunca controla `/accesos/`, `/entrar.html` ni la raíz (fase 1): quedan fuera de su alcance.
3. **Con la página ya abierta** (`sparked/js/sin-internet.js`, lo cargan `index`, `crear`, `listo` y `guia`):
   - en `index`, `crear` y `listo`, si se cae la conexión (evento `offline`) aparece la misma escena como capa encima,
     con «Reintentar» (comprueba de verdad la conexión y se quita si ya hay) y se quita sola con `online`. La capa solo
     tapa: no toca la página de abajo, así que lo escrito en un formulario sigue ahí;
   - en `guia.html` (alumno jugando) **no se tapa el juego**: solo aparece un aviso pequeño abajo a la derecha («Sin
     internet: tu avance se guardará cuando vuelva.») que desaparece al volver.
   - El mismo archivo registra el service worker (solo si el navegador lo permite y la página es https o localhost; un
     fallo al registrar se ignora). No modifica `window.fetch` ni el código de otros archivos.

## Límites (importante)

- **Primera visita:** un service worker solo puede mostrar algo si la persona ya abrió el sitio alguna vez *con
  internet* (ahí se instala y guarda la página). Quien entra por primera vez sin conexión ve el error normal del
  navegador; no hay forma de evitarlo.
- Solo se cubre `/sparked/`. En la fase 1 (`/accesos/`, `entrar.html`, raíz) sigue saliendo el error del navegador.
- Con una conexión «a medias» (muy lenta, no caída) el navegador espera a que la red responda o falle; el service worker
  solo actúa cuando falla.
- La capa dentro de la página depende de los eventos `offline`/`online` del navegador; algunos no los lanzan en una
  conexión mala. «Reintentar» siempre comprueba pidiendo un archivo mínimo del sitio.
- Un navegador sin service workers (o en `http` que no sea localhost) solo muestra la capa de la página ya abierta.

## Cómo quitarlo si diera problemas

Los navegadores ya instalados siguen usando el `sw.js` que tienen hasta que bajan uno nuevo, así que **no basta con
borrarlo**. Se publica un `sparked/sw.js` que se desregistra y borra su caché:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((n) => Promise.all(n.filter((x) => x.startsWith("sparked-sin-internet-")).map((x) => caches.delete(x))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: "window" }))
    .then((cs) => cs.forEach((c) => c.navigate(c.url)))
));
```

Después de unos días (cuando los visitantes ya lo hayan bajado) se puede quitar también el registro en `sin-internet.js`
(la función `registrarServiceWorker`). Para solo apagar la capa, basta vaciar `sin-internet.js`.

## Cómo está armado

La escena (SVG + CSS, bucle de 5 s, respeta `prefers-reduced-motion`) vive copiada en dos sitios, porque la pantalla debe
funcionar aunque falten otros archivos del sitio: dentro de `sin-internet.html` y dentro de `js/sin-internet.js`. Sparky
es el mismo dibujo de `js/arte.js` (pose «arreglando»: vuela con jetpack y aprieta con una llave), con ids y clases
propios (`si-`) para no chocar con la página. Si se cambia el dibujo de Sparky o los textos, hay que actualizar ambos
archivos. Para ver cambios en `sw.js` hay que subir la versión de la caché (`sparked-sin-internet-v2`) si se cambia la
página guardada: al instalarse un `sw.js` nuevo, vuelve a guardarla.

## Cómo se probó (9 nov 2026)

- Servidor propio en el puerto 8791 (`sparked-sin-internet` en `.claude/launch.json`). Se abrió `index.html` con internet:
  el service worker quedó activo (alcance `/sparked/`), controlando la página, y la caché `sparked-sin-internet-v1`
  contiene solo `sin-internet.html`.
- Se apagó el servidor, se navegó a `crear.html`: salió la página sin conexión (título «Sin conexión · SparkEd»). Con el
  servidor apagado, «Reintentar» queda en «Comprobando…»/«Todavía sin conexión.»; al encender el servidor, cargó
  `crear.html` normal.
- Capa dentro de la página con `window.dispatchEvent(new Event("offline"))` y `online` en `index`, `crear` y `listo`:
  aparece, enfoca «Reintentar» y se quita; en `crear` el texto escrito se conservó. «Reintentar» con conexión la quita.
  En inglés salen los textos en inglés.
- `guia.html?demo=historia1`: solo el aviso pequeño abajo a la derecha, sin capa ni tapar el juego; desaparece con `online`.
- Sin archivos viejos: se añadió una marca a `sin-internet.js` y la recarga (con el service worker activo) trajo la
  versión nueva; la única caché es la de la página sin conexión.
- `http://localhost:8791/accesos/`: sin service worker controlando.
- Sin errores de consola propios (el único 404 es `/favicon.ico` que pide el navegador por su cuenta).
- Capturas con Edge sin ventana a 390 y 1280 px.

No se pudo verificar: el comportamiento en GitHub Pages real (https) ni en Safari/iPhone; la reducción de movimiento
(`prefers-reduced-motion`) solo se revisó leyendo el CSS.
