// Prueba de humo de SparkEd EN PRODUCCIÓN. Hay que correrla después de CADA despliegue de la función y de CADA
// publicación del sitio que toque el reproductor, el formulario o el panel. Tarda unos segundos.
//
//   node herramientas/prueba-de-humo.mjs            (Node 22 o más nuevo)
//
// No usa llaves, no gasta accesos y no escribe nada: pregunta con claves y folios inventados y revisa que cada ruta
// conteste lo que contesta su propio código («no existe»), y no «Ruta no encontrada» (señal de que la ruta está tapada
// o desapareció). Nació del fallo del 10 nov 2026: la entrada con correo del panel tapó POST /acceso/<clave> y durante
// horas ninguna familia pudo abrir su guía; las comprobaciones de entonces solo miraban /admin/ping.
//
// Lo más importante que revisa: lee el reproductor PUBLICADO, saca de ahí la dirección exacta con la que abre una guía
// y la prueba contra el servidor. Así sitio y servidor se comprueban juntos, como los usa una familia.
const SITIO = (process.argv[2] || "https://sparkeducation-mx.com/sparked/").replace(/\/?$/, "/");
const CLAVE = "ClaveDeHumo0000", UUID = "00000000-0000-4000-8000-000000000000", CLAVE_BORRADOR = "BorradorDeHumo000000";
let mal = 0;
const revisar = (cond, texto) => { console.log((cond ? "ok   " : "FALLA") + " " + texto); if (!cond) mal++; };
const corto = (s) => String(s ?? "").replace(/\s+/g, " ").slice(0, 110);
async function pedir(url, init = {}) {
  try {
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json", "user-agent": "guardia-sparked/prueba-de-humo", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
    const texto = await r.text(); let json = null; try { json = JSON.parse(texto); } catch {}
    return { st: r.status, texto, json };
  } catch (e) { return { st: 0, texto: "sin respuesta: " + e.message, json: null }; }
}
const tapada = (r) => r.st === 0 || r.st >= 500 || r.json?.error === "Ruta no encontrada";

// ---------- 1. El sitio publicado ----------
const paginas = {};
for (const p of ["index.html", "crear.html", "listo.html", "guia.html", "panel.html", "js/config.js"]) {
  paginas[p] = await pedir(SITIO + p + "?humo=" + Date.now());
  revisar(paginas[p].st === 200 && paginas[p].texto.length > 200, `sitio · ${p} abre (HTTP ${paginas[p].st})`);
}
const API = paginas["js/config.js"].texto.match(/api:\s*["'`]([^"'`]+)["'`]/)?.[1]?.replace(/\/$/, "");
revisar(!!API && API.startsWith("https://"), `sitio · config.js dice a qué servidor pregunta el sitio`);
if (!API) { console.log("\nSin la dirección del servidor no se puede seguir: FALLA"); process.exit(1); }
const guion = paginas["guia.html"].texto.match(/<script[^>]+src="(js\/reproductor\.js[^"]*)"/)?.[1];
const reproductor = guion ? await pedir(SITIO + guion) : { st: 0, texto: "" };
revisar(reproductor.st === 200, `sitio · guia.html carga su reproductor (${guion ?? "no lo encontré"})`);
// La dirección con la que el reproductor abre una guía pagada: `${CONFIG.api}/acceso/${token}<cola>` con método POST.
const cola = reproductor.texto.match(/fetch\(`\$\{CONFIG\.api\}\/acceso\/\$\{token\}([^`]*)`,\s*\{\s*method:\s*"POST"/)?.[1];
revisar(cola !== undefined, `sitio · el reproductor abre la guía con POST /acceso/<clave>${cola ?? " (no encontré la llamada)"}`);

// ---------- 2. El camino de una familia: abrir su guía ----------
if (cola !== undefined) {
  const r = await pedir(`${API}/acceso/${CLAVE}${cola}`, { method: "POST", body: JSON.stringify({}) });
  revisar(r.st === 404 && r.json?.estado === "inexistente", `ABRIR UNA GUÍA · el servidor atiende POST /acceso/<clave>${cola}: con una clave inventada dice «inexistente» (HTTP ${r.st} ${corto(r.texto)})`);
}
{
  const r = await pedir(`${API}/acceso/${CLAVE}/estado`);
  revisar(r.st === 404 && r.json?.estado === "inexistente", `abrir una guía · GET /acceso/<clave>/estado (HTTP ${r.st} ${corto(r.texto)})`);
  const p = await pedir(`${API}/progreso/${CLAVE}`, { method: "POST", body: JSON.stringify({ dispositivo: "x", datos: {} }) });
  revisar(!tapada(p), `abrir una guía · POST /progreso/<clave> está atendida (HTTP ${p.st} ${corto(p.texto)})`);
  // Defensa extra, no es FALLA: el reproductor publicado ya no usa la dirección sin /abrir. Si sale AVISO, el servidor
  // desplegado todavía no trae el arreglo de fondo del 10 nov 2026 (código 2026-11-10.6 o más nuevo).
  const viejo = await pedir(`${API}/acceso/${CLAVE}`, { method: "POST", body: JSON.stringify({}) });
  const bien = viejo.st === 404 && viejo.json?.estado === "inexistente";
  console.log(`${bien ? "ok   " : "AVISO"} servidor · la dirección anterior, POST /acceso/<clave>, ${bien ? "también llega a su ruta" : "sigue tapada: falta desplegar el arreglo de fondo (el reproductor publicado ya no la usa)"} (HTTP ${viejo.st} ${corto(viejo.texto)})`);
}

// ---------- 3. El camino de una compra ----------
for (const [nombre, url, init] of [
  ["GET /publico", `${API}/publico`],
  ["GET /datos-curiosos", `${API}/datos-curiosos`],
  ["GET /vista-previa/<folio>", `${API}/vista-previa/${UUID}`],
  ["GET /borrador/<clave>", `${API}/borrador/${CLAVE_BORRADOR}`],
  ["GET /pago/estado/<folio>", `${API}/pago/estado/${UUID}`],
  ["POST /reporte (vacío: no guarda nada)", `${API}/reporte`, { method: "POST", body: "{}" }],
  ["POST /comentarios (vacío: no guarda nada)", `${API}/comentarios`, { method: "POST", body: "{}" }],
]) {
  const r = await pedir(url, init);
  revisar(!tapada(r), `compra · ${nombre} está atendida (HTTP ${r.st} ${corto(r.texto)})`);
}

// ---------- 4. El panel ----------
{
  const e = await pedir(`${API}/acceso/entrar`, { method: "POST", body: JSON.stringify({ correo: "no-es-correo", contrasena: "x" }) });
  revisar(e.st === 401, `panel · la entrada con correo responde (HTTP ${e.st}; con datos malos debe ser 401)`);
  const ping = await pedir(`${API}/admin/ping`);
  revisar(ping.st === 401, `panel · /admin/ping pide clave (HTTP ${ping.st})`);
}

console.log(mal ? `\n${mal} FALLAS. Si alguna es de «ABRIR UNA GUÍA» o de «compra», las familias no pueden usar SparkEd: hay que arreglarlo o regresar a la versión anterior YA.` : "\nPrueba de humo bien: sitio y servidor contestan como deben.");
process.exit(mal ? 1 : 0);
