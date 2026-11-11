// Prueba del aviso automático del reproductor (11 nov 2026): cuando una guía pagada no abre por un fallo nuestro, el
// reproductor manda UN reporte que empieza con «AVISO AUTOMÁTICO» (queda en el panel y, con correo de avisos puesto,
// le llega a Daniel). Lo normal (link vencido, inexistente, en otros dispositivos) no avisa.
// Todo es simulado: las llamadas al servidor se interceptan en Edge sin ventana (nada llega a producción).
// Necesita el sitio servido en local (node herramientas/servir.js) y Edge en Windows.
// Uso: REPO=<ruta al repositorio> node herramientas/probar-aviso-de-fallo.mjs [base del sitio, por omisión http://localhost:8790/sparked/]
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const base = process.argv[2] || "http://localhost:8790/sparked/";
const EDGE = ["C:", "Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"].join(path.sep);
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "edge-guia-"));
spawn(EDGE, ["--headless=new", "--remote-debugging-port=9392", "--force-device-scale-factor=1", "--no-first-run", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch("http://127.0.0.1:9392/json/list")).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await espera(200); }
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
let id = 0; const pend = new Map();
let responder = () => ({ st: 404, cuerpo: { estado: "inexistente" } }), reportes = [], abiertas = [];
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const CORS = [{ name: "access-control-allow-origin", value: "*" }, { name: "access-control-allow-headers", value: "*" }, { name: "access-control-allow-methods", value: "GET, POST, OPTIONS" }];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method !== "Fetch.requestPaused") return;
  const { requestId, request } = m.params, ruta = request.url.split("/functions/v1/sparked/")[1] ?? "";
  const manda = (st, cuerpo, tipo = "application/json") => ws.send(JSON.stringify({ id: ++id, method: "Fetch.fulfillRequest", params: { requestId, responseCode: st, responseHeaders: [...CORS, { name: "content-type", value: tipo }], body: b64(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) } }));
  if (request.method === "OPTIONS") return manda(204, "");
  if (ruta.startsWith("reporte")) { reportes.push(JSON.parse(request.postData || "{}")); return manda(200, { ok: true }); }
  if (/^acceso\/[A-Za-z0-9]+\/abrir$/.test(ruta) && request.method === "POST") { abiertas.push(ruta); const r = responder(); return manda(r.st, r.cuerpo, r.tipo); }
  if (/^acceso\/[A-Za-z0-9]+\/estado$/.test(ruta)) return manda(200, { completo: false });
  return manda(404, { error: "Ruta no encontrada (simulada)" });
});
const cdp = (method, params = {}) => new Promise((ok) => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); ok({}); } }, 20000); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Fetch.enable", { patterns: [{ urlPattern: "*functions/v1/sparked/*" }] });
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let mal = 0, n = 0;
const revisar = (cond, texto) => { console.log((cond ? "ok   " : "FALLA") + " " + texto); if (!cond) mal++; };
async function abrir(clave, respuesta, { recargar = false, segundos = 5 } = {}) {
  responder = () => respuesta; reportes = []; abiertas = [];
  if (recargar) await cdp("Page.reload"); else await cdp("Page.navigate", { url: `${base}guia.html?p=${++n}#${clave}` });
  await espera(segundos * 1000);
  return { titulo: await ev(`document.querySelector(".sl.mensaje h2")?.textContent ?? "(sin mensaje)"`), reportes: [...reportes], abiertas: abiertas.length };
}

// 1. El fallo del 10 nov: el servidor contesta «Ruta no encontrada».
let r = await abrir("ClaveUno00001", { st: 404, cuerpo: { error: "Ruta no encontrada" } });
revisar(r.titulo === "Algo falló" && r.abiertas === 1 && r.reportes.length === 1, `servidor dice «Ruta no encontrada» → la familia ve «${r.titulo}» y sale ${r.reportes.length} aviso`);
revisar(r.reportes[0]?.token === "ClaveUno00001" && /^AVISO AUTOMÁTICO: una guía pagada no abrió\. El servidor respondió HTTP 404: Ruta no encontrada · /.test(r.reportes[0]?.comentario ?? "") && (r.reportes[0]?.comentario ?? "").length <= 500, `el aviso dice qué pasó: «${r.reportes[0]?.comentario}»`);
// 2. La familia recarga: no se repite el aviso en la misma sesión.
r = await abrir("ClaveUno00001", { st: 404, cuerpo: { error: "Ruta no encontrada" } }, { recargar: true });
revisar(r.titulo === "Algo falló" && r.reportes.length === 0, `al recargar no se manda otro aviso (${r.reportes.length})`);
// 3. Lo normal no avisa: link que no existe, vencido, en otros dispositivos, guía que se está terminando.
for (const [estado, st, titulo] of [["inexistente", 404, "Enlace no válido"], ["expirado", 403, "Tu acceso venció"], ["otro_dispositivo", 403, "Acceso en uso en otros dispositivos"], ["revisando", 200, "Estamos revisando tu guía"]]) {
  r = await abrir("ClaveDos0000" + estado.length, { st, cuerpo: { estado } }, { segundos: 4 });
  revisar(r.titulo === titulo && r.reportes.length === 0, `estado «${estado}» → «${r.titulo}», sin aviso (${r.reportes.length})`);
}
// 4. Error del servidor sin JSON (HTTP 500).
r = await abrir("ClaveTres0001", { st: 500, cuerpo: "Internal Server Error", tipo: "text/plain" });
revisar(r.titulo === "Algo falló" && r.reportes.length === 1 && /HTTP 500: error/.test(r.reportes[0]?.comentario ?? ""), `error 500 del servidor → 1 aviso: «${r.reportes[0]?.comentario}»`);
// 5. Llega «ok» pero sin contenido.
r = await abrir("ClaveCuatro01", { st: 200, cuerpo: { estado: "ok", guia_id: "93470423-3ffa-4ade-a48c-c8f0929f02ed" } });
revisar(r.titulo === "Algo falló" && r.reportes.length === 1 && /sin contenido/.test(r.reportes[0]?.comentario ?? ""), `«ok» sin contenido → 1 aviso: «${r.reportes[0]?.comentario}»`);
// 6. El contenido llega dañado y el reproductor truena al armarlo.
r = await abrir("ClaveCinco001", { st: 200, cuerpo: { estado: "ok", guia_id: "93470423-3ffa-4ade-a48c-c8f0929f02ed", cartucho: { plan: null, bloques: "roto" } } });
revisar(r.titulo === "Algo falló" && r.reportes.length === 1 && /Error al abrirla en el navegador: /.test(r.reportes[0]?.comentario ?? "") && r.reportes[0]?.guia_id === "93470423-3ffa-4ade-a48c-c8f0929f02ed", `contenido dañado → 1 aviso: «${r.reportes[0]?.comentario}»`);

// 7. Lo normal: el servidor entrega la guía (aquí, la de ejemplo del repositorio) y abre sin avisos.
if (process.env.REPO) {
  const ejemplo = JSON.parse(fs.readFileSync(path.join(process.env.REPO, "sparked/ejemplos/historia1.json"), "utf8"));
  r = await abrir("ClaveSeis0001", { st: 200, cuerpo: { estado: "ok", guia_id: "93470423-3ffa-4ade-a48c-c8f0929f02ed", dispositivo: "d".repeat(32), cartucho: ejemplo, progreso: null } }, { segundos: 12 });
  const portada = (await ev(`document.querySelector("#escenario .sl")?.innerText ?? ""`)).replace(/\s+/g, " ").slice(0, 60);
  revisar(r.titulo === "(sin mensaje)" && r.reportes.length === 0 && portada.length > 10, `guía que sí abre → sin mensaje de error, sin aviso (${r.reportes.length}) y se ve la portada («${portada}»)`);
}
console.log(mal ? `\n${mal} fallas` : "\nAviso automático bien");
try { await cdp("Browser.close"); } catch {}
await espera(500);
try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" }); } catch {}
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
process.exit(mal ? 1 : 0);
