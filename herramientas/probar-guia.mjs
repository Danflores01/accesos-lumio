// Comprueba que una guía guardada se ve bien en el reproductor SIN usar el link de la familia (no gasta ninguno de sus
// 2 dispositivos): baja el contenido con la clave de administrador (primera línea de CLAVES.txt; nunca se imprime ni
// se guarda), lo pone en un navegador de prueba y abre guia.html?local=… Recorre todas las pantallas en celular y en
// computadora y cuenta errores.
//
//   node herramientas/probar-guia.mjs <id completo de la guía> [base del sitio]
//
// Base por omisión: el sitio publicado (https://sparkeducation-mx.com/sparked/). Para probar un cambio ANTES de
// publicarlo: node herramientas/servir.js  y  …probar-guia.mjs <id> http://localhost:8790/sparked/
// Necesita Edge en Windows y Node 22 o más nuevo. El id de la guía sale de compras.guia_id.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [guia, base = "https://sparkeducation-mx.com/sparked/"] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(guia ?? "")) { console.log("Uso: node herramientas/probar-guia.mjs <id completo de la guía> [base del sitio]"); process.exit(2); }
const clave = (() => { try { return fs.readFileSync(path.join(REPO, "CLAVES.txt"), "utf8").split(/\r?\n/)[0].trim(); } catch { return ""; } })();
if (!clave) { console.log("Falta CLAVES.txt (la clave de administrador) en la raíz de la copia."); process.exit(2); }
const config = fs.readFileSync(path.join(REPO, "sparked", "js", "config.js"), "utf8");
const API = (config.match(/api:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "").replace(/\/$/, "");
const r = await fetch(`${API}/admin/guias/${guia}/cartucho`, { headers: { "x-admin-key": clave } });
const d = await r.json().catch(() => null);
const cartucho = d?.cartucho ?? d;
if (!r.ok || !cartucho?.plan) { console.log("No pude bajar la guía: HTTP", r.status, d?.error ?? ""); process.exit(1); }
const bloques = cartucho.bloques ?? [];
console.log(`guía bajada: ${JSON.stringify(cartucho).length} caracteres · completa: ${cartucho.completo} · bloques: ${bloques.length} · idioma: ${cartucho.plan?.idioma_guia} · pistas: ${bloques.reduce((s, b) => s + (b.pistas?.length ?? 0), 0)} · actividades: ${bloques.reduce((s, b) => s + (b.actividades?.length ?? 0) + (b.mini_examen?.length ?? 0) + (b.duelo?.length ?? 0), 0)}`);

const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
if (!EDGE) { console.log("No encontré Edge: no puedo abrir el reproductor."); process.exit(2); }
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "edge-guia-"));
const puerto = 9400 + Math.floor(Math.random() * 90);
spawn(EDGE, ["--headless=new", `--remote-debugging-port=${puerto}`, "--force-device-scale-factor=1", "--no-first-run", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await espera(200); }
if (!ws) { console.log("No pude abrir Edge."); process.exit(2); }
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
let id = 0; const pend = new Map(), errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  // «AssistantLoadState» es un error del propio Edge, no del sitio.
  if (m.method === "Runtime.exceptionThrown" && !/AssistantLoadState/.test(m.params.exceptionDetails.exception?.description ?? "")) errores.push("excepción: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errores.push("consola: " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
});
const cdp = (method, params = {}) => new Promise((ok) => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); ok({}); } }, 30000); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp("Page.enable"); await cdp("Runtime.enable");
let mal = 0;
for (const [ancho, alto, movil] of [[390, 844, true], [1280, 800, false]]) {
  errores.length = 0;
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
  // Cada pasada empieza en la portada: se borra el avance guardado de la pasada anterior.
  const s = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `try { localStorage.setItem("sparked_cartucho_prueba", ${JSON.stringify(JSON.stringify(cartucho))}); sessionStorage.setItem("sparked_giro", "1"); for (const k of Object.keys(localStorage)) if (k.startsWith("sparked_prog_")) localStorage.removeItem(k); } catch (e) {}` });
  await cdp("Page.navigate", { url: base.replace(/\/?$/, "/") + "guia.html?local=prueba&t=" + Date.now() });
  // Espera a que termine la pantalla de carga (hasta 40 s: mide fotos y acomoda la teoría).
  let listo = null;
  for (let i = 0; i < 80 && !listo; i++) { await espera(500); listo = await ev(`(() => { const e = document.querySelector("#escenario"); const m = e?.querySelector(".sl.mensaje"); if (m) return "MENSAJE: " + m.querySelector("h2")?.textContent; const sl = e?.querySelector(".sl"); return sl && !e.querySelector(".carga, .pantalla-carga, [class*=carga]") ? "ok" : null; })()`); }
  // Recorre todas las pantallas con el botón de bajar: cuántas hay, de qué tipo y si alguna queda vacía.
  const recorrido = await ev(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector("#rejilla").click(); await espera(150);
    const total = document.querySelectorAll("#lista-mini button").length;
    document.querySelector("#miniaturas").classList.add("oculto");
    let vacias = 0, tipos = {};
    for (let i = 0; i < total; i++) {
      const sl = document.querySelector("#escenario .sl");
      if (!sl || sl.innerText.trim().length < 2) vacias++;
      const k = (sl?.className || "").split(/\\s+/).filter((c) => c !== "sl").slice(0, 1).join("") || "otra"; tipos[k] = (tipos[k] || 0) + 1;
      if (sl?.classList.contains("mensaje")) return { total, i, mensaje: sl.querySelector("h2")?.textContent };
      document.querySelector("#abajo").click(); await espera(140);
    }
    return { total, vacias, tipos };
  })()`);
  const bien = listo === "ok" && recorrido && !recorrido.mensaje && recorrido.total > 5 && recorrido.vacias === 0 && errores.length === 0;
  console.log(`${bien ? "ok   " : "FALLA"} ${movil ? "celular" : "computadora"} ${ancho} × ${alto}: carga ${listo ?? "no terminó"} · pantallas ${recorrido?.total ?? "?"} · vacías ${recorrido?.vacias ?? "?"}${recorrido?.mensaje ? " · se detuvo en «" + recorrido.mensaje + "» (pantalla " + (recorrido.i + 1) + ")" : ""} · errores ${errores.length}${errores.length ? " → " + errores.slice(0, 3).join(" | ") : ""}`);
  if (!bien) mal++;
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: s.result.identifier });
}
try { await ev(`localStorage.removeItem("sparked_cartucho_prueba")`); await cdp("Browser.close"); } catch {}
await espera(500);
try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" }); } catch {}
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
console.log(mal ? "\nLa guía NO se ve bien: no la des por buena." : "\nLa guía se ve bien en celular y computadora.");
process.exit(mal ? 1 : 0);
