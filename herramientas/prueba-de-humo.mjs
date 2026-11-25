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
for (const p of ["index.html", "crear.html", "listo.html", "guia.html", "panel.html", "js/config.js"]) {   // las del paquete, en la parte 5
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
  console.log(`${bien ? "ok   " : "AVISO"} servidor · la dirección anterior, POST /acceso/<clave>, ${bien ? "también llega a su ruta" : "sigue tapada: falta desplegar el arreglo de fondo. El reproductor publicado ya no la usa; solo le afecta a quien tenga la página abierta desde antes del arreglo y no la haya recargado"} (HTTP ${viejo.st} ${corto(viejo.texto)})`);
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

// ---------- 5. Cuentas y paquete de guías (24 nov 2026) ----------
// Con datos vacíos y sin sesión: no escribe nada ni manda mensajes. Revisa que el servidor atiende lo que piden
// paquetes.html, cuenta.html y crear.html?saldo=1, y que el sitio y el servidor dicen lo mismo sobre la venta.
{
  const sinRuta = (r) => r.st === 0 || r.st >= 500 || /^Ruta no (encontrada|reconocida)/.test(r.json?.error ?? "");
  for (const p of ["paquetes.html", "cuenta.html", "js/cuenta.js"]) {
    const r = await pedir(SITIO + p + "?humo=" + Date.now());
    revisar(r.st === 200 && r.texto.length > 200, `sitio · ${p} abre (HTTP ${r.st})`);
    if (p === "js/cuenta.js") revisar(r.texto.includes("/paquete/info") && r.texto.includes("x-cuenta"), "sitio · cuenta.js pregunta por el paquete y manda la sesión en la cabecera x-cuenta");
  }
  const info = await pedir(`${API}/paquete/info`);
  revisar(info.st === 200 && typeof info.json?.disponible === "boolean" && info.json?.precio > 0 && info.json?.guias > 0, `paquete · GET /paquete/info (HTTP ${info.st}): ${info.json?.disponible ? "a la venta" : "apagado"}, ${info.json?.guias} guías por $${info.json?.precio}`);
  if (info.json?.disponible) revisar(paginas["index.html"].texto.includes('href="paquetes.html"') && paginas["index.html"].texto.includes("data-paquete"), "paquete · está a la venta y la portada publicada trae su botón «Paquetes y suscripción»");
  for (const [nombre, url, init, esperado] of [
    ["GET /cuenta sin sesión pide entrar", `${API}/cuenta`, undefined, 401],
    ["POST /cuenta/codigo sin número pide un WhatsApp válido (no manda nada)", `${API}/cuenta/codigo`, { method: "POST", body: "{}" }, 400],
    ["POST /cuenta/entrar sin código no entra", `${API}/cuenta/entrar`, { method: "POST", body: "{}" }, 401],
    ["POST /cuenta/guia sin sesión no crea nada", `${API}/cuenta/guia`, { method: "POST", body: "{}" }, 401],
    ["POST /paquete/comprar sin sesión no compra nada", `${API}/paquete/comprar`, { method: "POST", body: "{}" }, 401],
    ["GET /paquete/estado/<folio> sin sesión pide entrar", `${API}/paquete/estado/${UUID}`, undefined, 401],
  ]) {
    const r = await pedir(url, init);
    revisar(r.st === esperado && !sinRuta(r), `cuenta · ${nombre} (HTTP ${r.st} ${corto(r.texto)})`);
  }
  const adm = await pedir(`${API}/admin/paquetes`);
  revisar(adm.st === 401, `panel · /admin/paquetes pide clave (HTTP ${adm.st})`);
}

// ---------- 6. Suscripción mensual «Guías ilimitadas» (25 nov 2026) ----------
// Sin sesión, sin firma y con datos vacíos: no escribe nada, no manda mensajes y no toca Mercado Pago. Revisa que el
// servidor atiende lo que pide cuenta.html y que, mientras no esté abierta al público, la portada dice «Próximamente».
{
  const sinRuta = (r) => r.st === 0 || r.st >= 500 || /^Ruta (de administración )?no (encontrada|reconocida)/.test(r.json?.error ?? "");
  const info = await pedir(`${API}/suscripcion/info`);
  revisar(info.st === 200 && typeof info.json?.disponible === "boolean" && info.json?.precio > 0, `suscripción · GET /suscripcion/info (HTTP ${info.st}): ${info.json?.disponible ? "ABIERTA AL PÚBLICO" : "apagada para el público"}, $${info.json?.precio} al mes`);
  if (info.json?.disponible === false) revisar(/class="boton op-boton apagado"[^>]*>Próximamente</.test(paginas["index.html"].texto), "suscripción · está apagada para el público y la portada publicada dice «Próximamente»");
  const cuentaHtml = await pedir(SITIO + "cuenta.html?humo=" + Date.now());
  revisar(cuentaHtml.texto.includes("/suscripcion/crear") && cuentaHtml.texto.includes("/suscripcion/cancelar"), "sitio · cuenta.html trae la suscripción (suscribirse y cancelar)");
  for (const [nombre, url, init, esperado] of [
    ["POST /suscripcion/crear sin sesión no contrata nada", `${API}/suscripcion/crear`, { method: "POST", body: "{}" }, 401],
    ["GET /suscripcion/estado sin sesión pide entrar", `${API}/suscripcion/estado`, undefined, 401],
    ["POST /suscripcion/cancelar sin sesión pide entrar", `${API}/suscripcion/cancelar`, { method: "POST", body: "{}" }, 401],
    ["POST /pago/mercadopago: un aviso de suscripción sin firma se rechaza", `${API}/pago/mercadopago?type=subscription_preapproval&data.id=humo0000`, { method: "POST", body: JSON.stringify({ type: "subscription_preapproval", data: { id: "humo0000" } }) }, 401],
    ["GET /admin/suscripciones pide clave", `${API}/admin/suscripciones`, undefined, 401],
    ["POST /admin/suscripciones/diario pide clave (no revisa nada)", `${API}/admin/suscripciones/diario`, { method: "POST", body: "{}" }, 401],
  ]) {
    const r = await pedir(url, init);
    revisar(r.st === esperado && !sinRuta(r), `suscripción · ${nombre} (HTTP ${r.st} ${corto(r.texto)})`);
  }
}

console.log(mal ? `\n${mal} FALLAS. Si alguna es de «ABRIR UNA GUÍA» o de «compra», las familias no pueden usar SparkEd: hay que arreglarlo o regresar a la versión anterior YA.` : "\nPrueba de humo bien: sitio y servidor contestan como deben.");
process.exit(mal ? 1 : 0);
