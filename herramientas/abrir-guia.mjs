// Abre una dirección de guia.html en Edge sin ventana y dice qué pidió al servidor, qué respondió y qué se ve.
// Sirve para ver con tus ojos lo que ve una familia SIN usar su link: úsalo con una clave inventada (debe decir
// «Enlace no válido»; si dice «Algo falló», la ruta de las guías está rota) o con ?demo=historia1.
//   node herramientas/abrir-guia.mjs "https://sparkeducation-mx.com/sparked/guia.html#ClaveInventada0000" [segundos] [captura.png]
// La clave nunca se imprime: en la salida va tapada. NUNCA lo uses con el link de una familia (gasta un dispositivo).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const url = process.argv[2], segundos = Number(process.argv[3] || 6);
const clave = (url.split("#")[1] || "");
const tapar = (s) => clave ? String(s).split(clave).join("<clave>") : String(s);
const EDGE = ["C:", "Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"].join(path.sep);
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "edge-guia-"));
spawn(EDGE, ["--headless=new", "--remote-debugging-port=9390", "--force-device-scale-factor=1", "--no-first-run", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch("http://127.0.0.1:9390/json/list")).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await espera(200); }
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pend = new Map(), pedidos = new Map(), errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Network.requestWillBeSent" && m.params.request.url.includes("/functions/v1/")) pedidos.set(m.params.requestId, { m: m.params.request.method, url: m.params.request.url });
  if (m.method === "Network.responseReceived" && pedidos.has(m.params.requestId)) pedidos.get(m.params.requestId).st = m.params.response.status;
  if (m.method === "Runtime.exceptionThrown" && !/AssistantLoadState/.test(m.params.exceptionDetails.exception?.description ?? "")) errores.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errores.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); r({}); } }, 20000); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cdp("Page.navigate", { url });
await espera(segundos * 1000);
const visto = await ev(`(() => { const m = document.querySelector(".sl.mensaje"); return { mensaje: m ? m.querySelector("h2")?.textContent + " — " + m.querySelector("p")?.textContent : null, slides: document.querySelectorAll("#escenario .sl").length, titulo: document.title, escenario: (document.querySelector("#escenario")?.innerText || "").replace(/\\s+/g, " ").slice(0, 90), guion: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).join(", ") }; })()`);
console.log("pedidos al servidor:");
for (const p of pedidos.values()) console.log("  " + p.m + " " + tapar(p.url.split("/functions/v1/")[1]) + " → HTTP " + (p.st ?? "sin respuesta"));
console.log("en la pantalla:", tapar(JSON.stringify(visto)));
console.log("errores de la página:", errores.length ? errores.map(tapar).join(" | ").slice(0, 400) : "ninguno");
if (process.argv[4]) { const s = await cdp("Page.captureScreenshot", { format: "png" }); if (s.result?.data) fs.writeFileSync(process.argv[4], Buffer.from(s.result.data, "base64")); }
try { await cdp("Browser.close"); } catch {}
await espera(500);
try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" }); } catch {}
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
