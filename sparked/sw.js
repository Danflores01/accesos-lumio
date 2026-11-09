// Service worker de SparkEd: SOLO sirve la pantalla "sin internet" cuando una página del sitio no se puede abrir.
// Alcance: /sparked/ (nunca /accesos/, /entrar.html ni la raíz). No guarda ni sirve desde caché ningún otro archivo,
// así que nadie ve versiones viejas del sitio. No intercepta scripts, imágenes ni llamadas al servidor (Supabase).
// Para quitarlo si diera problemas, ver docs/SIN-INTERNET.md (publicar un sw.js que se desregistre).
const PREFIJO = "sparked-sin-internet-";
const CACHE = PREFIJO + "v1";
const PAGINA = new URL("sin-internet.html", self.registration.scope).href;

self.addEventListener("install", (evento) => {
  // Guarda únicamente la página sin conexión (siempre fresca de la red al instalar).
  evento.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(PAGINA, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  // Borra cachés viejas de este mismo service worker (las que empiezan con el prefijo) y toma el control de inmediato.
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith(PREFIJO) && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Solo navegaciones (abrir una página) por GET y del mismo origen; todo lo demás sigue su camino normal.
  if (pedido.mode !== "navigate" || pedido.method !== "GET") return;
  if (new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(
    fetch(pedido).catch(() => caches.match(PAGINA).then((r) => r || Response.error()))
  );
});
