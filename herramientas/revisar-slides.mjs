// Revisor de slides de SparkEd (criterio de Daniel, 9 nov 2026: todo cabe, nada se encima, fotos completas).
// Abre cada slide de una guía en Edge sin ventana, con el escenario de 1280 x 720, entra a cada juego (botón Iniciar)
// y reporta:
//   - texto que se sale de la slide o de su caja,
//   - cajas encimadas (por ejemplo, una tarjeta debajo del botón "¡A jugar!"),
//   - contenido cortado o con barra de desplazamiento,
//   - fotos recortadas (porcentaje visible) o deformadas.
// Uso:  node herramientas/revisar-slides.mjs <guia> [<guia> ...]
//   <guia> = nombre de una guía de sparked/ejemplos (por ejemplo historia1) o la ruta de un cartucho .json
//   (por ejemplo uno descargado del panel con /admin/guias/<id>/cartucho). Con ":previa" al final (historia1:previa)
//   se revisa la vista previa gratis (portada con sello, una pista, dos juegos y el candado).
// Variables opcionales: SALIDA (carpeta de resultados; por defecto, una carpeta temporal), FOTOS=0 (sin capturas).
// Deja en SALIDA/<guia>/ una captura PNG por slide (y otra con el juego ya iniciado) y reporte.json. Sale con
// código 1 si encontró algo. Solo usa lo que trae Node 22+ y el Edge de Windows.
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, basename, dirname, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = process.env.SALIDA || join(tmpdir(), "revision-slides");
const CAPTURAS = process.env.FOTOS !== "0";
const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pedidas = process.argv.slice(2);
if (!pedidas.length) { console.error("Uso: node herramientas/revisar-slides.mjs <guia o cartucho.json> [...]"); process.exit(2); }

// Cada guía se sirve como sparked/ejemplos/<nombre>.json; los cartuchos sueltos, con el prefijo zz-.
const sueltas = new Map();
const guias = pedidas.map((g0) => {
  const previa = /:previa$/i.test(g0), g = g0.replace(/:previa$/i, ""), extra = previa ? "&vista=previa" : "", sufijo = previa ? "-previa" : "";
  if (existsSync(join(RAIZ, "sparked", "ejemplos", g + ".json"))) return { nombre: g + sufijo, demo: g + extra };
  const ruta = resolve(g);
  if (!existsSync(ruta)) { console.error("No existe:", g); process.exit(2); }
  const nombre = basename(ruta).replace(/\.json$/i, "").replace(/[^a-z0-9_-]/gi, "-");
  sueltas.set(nombre, ruta);
  return { nombre: nombre + sufijo, demo: "zz-" + nombre + extra };
});

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const servidor = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const m = p.match(/^\/sparked\/ejemplos\/zz-([a-z0-9_-]+)\.json$/i);
  let archivo = m ? sueltas.get(m[1]) : normalize(join(RAIZ, p.endsWith("/") ? p + "index.html" : p));
  if (!archivo || (!m && (!archivo.startsWith(RAIZ) || /CLAVES/i.test(archivo)))) { res.writeHead(403); return res.end("No"); }
  try {
    if (!statSync(archivo).isFile()) throw 0;
    res.writeHead(200, { "content-type": TIPOS[extname(archivo).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(archivo));
  } catch { res.writeHead(404); res.end("No existe"); }
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const WEB = `http://127.0.0.1:${servidor.address().port}`;

const perfil = mkdtempSync(join(tmpdir(), "edge-revision-"));
const puerto = 9300 + Math.floor(Math.random() * 600);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const VW = 1376, VH = 731; // con la barra de 76 px, el escenario queda a escala 1
spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--mute-audio", "--disable-extensions", "--disable-component-extensions-with-background-pages", "--disable-sync", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--force-device-scale-factor=1", "--disable-lcd-text", "--font-render-hinting=none", `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${puerto}`, `--window-size=${VW},${VH}`, "about:blank"], { stdio: "ignore" });

// ---------- La revisión que corre dentro de la página ----------
const REVISAR = String.raw`(() => {
  const esc = document.getElementById("escenario");
  const E = esc.getBoundingClientRect();
  const k = E.width / esc.offsetWidth, W = esc.offsetWidth, H = esc.offsetHeight;
  const rel = (r) => ({ x: (r.left - E.left) / k, y: (r.top - E.top) / k, d: (r.right - E.left) / k, a: (r.bottom - E.top) / k });
  const visible = (el) => {
    for (let e = el; e && e !== esc; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false; }
    return el.getClientRects().length > 0;
  };
  const nombre = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const ruta = (el) => { const p = []; for (let e = el; e && e !== esc && p.length < 3; e = e.parentElement) p.unshift(nombre(e)); return p.join(" > "); };
  // dentro de un área que se desplaza (la lista de resultados), lo que no se ve está guardado, no cortado
  const enDesplazable = (el) => { for (let e = el.parentElement; e && e !== esc; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY)) return e; } return null; };
  const IGNORAR = "svg, canvas, .confeti, .toast:not(.on), [aria-hidden=true], .escena, #medidor, .sk-anima";
  const CAJAS = ".tcard, .ojo, .claves, .caja-clave, .banda, .caja-ej, .caja-corregido, .dato-rapido, .cat, .lista-iconos .fila, .hito, .comparacion .col, .ciclo .paso, .qcard, .opt, .card-d, .carta-swipe, .superdato-texto, .hueco, .drop, .sort .grupo, .rank .casilla, .tarjeta-inicio, .pill, .pildora, .a-jugar, .portada .objetivos > div, .portada .bloques > div, .portada .retrato, .tc, .tut-pasos > div, .chip, .rep-bloque, .retrato-col .r, .cuadro, .hud-pill, .reloj, .btn, button, .match .der .fila, .fin .caja, .candado .caja";
  const HOJAS = ".tcard, .ojo, .claves, .caja-clave, .banda, .dato-rapido, .cat, .lista-iconos .fila, .hito, .comparacion .col, .ciclo .paso, .qcard, .opt, .card-d, .carta-swipe, .superdato-texto, .sort .grupo, .rank .casilla, .tarjeta-inicio, .a-jugar, .portada .objetivos > div, .portada .bloques > div, .portada .retrato, .portada .texto, .portada .aprender, .tc, .tut-pasos > div, .rep-bloque, .retrato-col .r, .cuadro, .cabeza h1, .cabeza .pildora, .match .der .fila, .pill, .hud-pill, .reloj, .marca-pie, .fuente-pie";
  const problemas = [];
  const agregar = (tipo, el, extra) => { if (problemas.length < 80) problemas.push({ tipo, donde: ruta(el), ...extra }); };
  // 1) Texto fuera de la slide o fuera de su caja
  const tw = document.createTreeWalker(esc, NodeFilter.SHOW_TEXT);
  let n; const vistos = new Set();
  while ((n = tw.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || el.closest(IGNORAR) || !visible(el) || enDesplazable(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter((b) => b.width > 0.5 && b.height > 0.5).map(rel);
    if (!rects.length) continue;
    const fuera = rects.find((b) => b.x < -1 || b.y < -1 || b.d > W + 1 || b.a > H + 1);
    if (fuera) agregar("texto fuera de la slide", el, { texto: t.slice(0, 50), rect: [fuera.x, fuera.y, fuera.d, fuera.a].map(Math.round) });
    const caja = el.closest(CAJAS);
    if (caja && !vistos.has(caja)) {
      const C = rel(caja.getBoundingClientRect());
      const sale = rects.find((b) => b.x < C.x - 1.5 || b.y < C.y - 1.5 || b.d > C.d + 1.5 || b.a > C.a + 1.5);
      if (sale) { vistos.add(caja); agregar("texto se sale de su caja", caja, { texto: t.slice(0, 50), sobra: Math.round(Math.max(C.x - sale.x, C.y - sale.y, sale.d - C.d, sale.a - C.a)) }); }
    }
  }
  // 2) Contenido cortado o con barra de desplazamiento
  esc.querySelectorAll("*").forEach((el) => {
    if (el.closest(IGNORAR) || !visible(el)) return;
    const cs = getComputedStyle(el);
    if (!/(hidden|auto|scroll|clip)/.test(cs.overflowY + " " + cs.overflowX)) return;
    if (!(el.innerText || "").trim()) return;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)
      agregar(/(auto|scroll)/.test(cs.overflowY) ? "contenido con barra de desplazamiento" : "contenido cortado", el, { alto: [el.scrollHeight, el.clientHeight], ancho: [el.scrollWidth, el.clientWidth] });
  });
  // 3) Cajas encimadas y cajas fuera de la slide
  const capa = (e) => e.closest(".inicio, .fin, .victoria, .gameover, #giro, .toast");
  const hojas = [...esc.querySelectorAll(HOJAS)].filter((el) => !el.closest(IGNORAR) && visible(el) && !enDesplazable(el) && (el.innerText || "").trim());
  const R = hojas.map((el) => rel(el.getBoundingClientRect()));
  for (let i = 0; i < hojas.length; i++) for (let j = i + 1; j < hojas.length; j++) {
    const a = hojas[i], b = hojas[j];
    if (a.contains(b) || b.contains(a) || capa(a) !== capa(b)) continue;
    const ra = R[i], rb = R[j];
    const ancho = Math.min(ra.d, rb.d) - Math.max(ra.x, rb.x), alto = Math.min(ra.a, rb.a) - Math.max(ra.y, rb.y);
    if (ancho > 2 && alto > 2) agregar("cajas encimadas", a, { con: ruta(b), px: [Math.round(ancho), Math.round(alto)] });
  }
  hojas.forEach((el, i) => { const r = R[i]; if (r.x < -1 || r.y < -1 || r.d > W + 1 || r.a > H + 1) agregar("caja fuera de la slide", el, { rect: [r.x, r.y, r.d, r.a].map(Math.round) }); });
  // 4) Fotos: recorte por object-fit, por círculo o por un contenedor; deformación
  const fotos = [];
  esc.querySelectorAll("img").forEach((im) => {
    if (!visible(im)) return;
    const cs = getComputedStyle(im);
    const nw = im.naturalWidth, nh = im.naturalHeight, bw = im.clientWidth, bh = im.clientHeight;
    const info = { src: decodeURIComponent(im.src.split("/").pop()).slice(0, 50), natural: [nw, nh], caja: [bw, bh], fit: cs.objectFit };
    if (!nw || !nh) { info.problema = "no cargó"; fotos.push(info); return; }
    let vis = 1;
    if (cs.objectFit === "cover") { const s = Math.max(bw / nw, bh / nh); vis = (bw * bh) / (nw * s * nh * s); }
    else if (cs.objectFit === "fill") { const dist = (bw / bh) / (nw / nh); if (Math.abs(dist - 1) > 0.03) info.deformada = +dist.toFixed(2); }
    if (/50%/.test(cs.borderRadius) || parseFloat(cs.borderRadius) >= Math.min(bw, bh) / 2 - 1) { vis *= Math.PI / 4; info.circulo = true; }
    const R0 = rel(im.getBoundingClientRect());
    for (let e = im.parentElement; e && e !== esc; e = e.parentElement) {
      const c2 = getComputedStyle(e);
      if (/(hidden|clip)/.test(c2.overflowX + c2.overflowY)) {
        const C = rel(e.getBoundingClientRect());
        const iw = Math.max(0, Math.min(R0.d, C.d) - Math.max(R0.x, C.x)), ih = Math.max(0, Math.min(R0.a, C.a) - Math.max(R0.y, C.y));
        const f = (iw * ih) / Math.max(1, (R0.d - R0.x) * (R0.a - R0.y));
        if (f < 0.99) { vis *= f; info.cortadaPor = nombre(e); }
      }
    }
    info.visible = Math.round(vis * 100);
    fotos.push(info);
  });
  const h1 = esc.querySelector(".cabeza h1, .portada h1, .rep-cabeza h1");
  return JSON.stringify({ titulo: (h1?.innerText || "").slice(0, 80), clase: esc.firstElementChild?.className || "", problemas, fotos, inicio: !!esc.querySelector(".inicio .start") });
})()`;

const ESPERAR = `(async () => {
  const imgs = [...document.querySelectorAll("#escenario img")];
  await Promise.race([Promise.all(imgs.map((im) => im.complete ? 0 : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); }))), new Promise((r) => setTimeout(r, 5000))]);
  try { await document.fonts.ready; } catch {}
  return imgs.length;
})()`;

async function pagina() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); const p = l.find((t) => t.type === "page" && t.url === "about:blank") ?? l.find((t) => t.type === "page"); if (p) return p; } catch {}
    await dormir(250);
  }
  throw new Error("Edge no abrió el puerto de control");
}

let ws = null, codigo = 0;
try {
  const pag = await pagina();
  ws = new WebSocket(pag.webSocketDebuggerUrl);
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
  let id = 0; const esperando = new Map(); const eventos = []; const consola = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && esperando.has(d.id)) { const { ok, mal } = esperando.get(d.id); esperando.delete(d.id); d.error ? mal(new Error(JSON.stringify(d.error))) : ok(d.result); }
    else if (d.method === "Runtime.exceptionThrown") consola.push("EXCEPCIÓN " + (d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text ?? "").slice(0, 200));
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") consola.push("console.error " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    else if (d.method) eventos.push(d.method);
  };
  const enviar = (method, params = {}) => new Promise((ok, mal) => { const i = ++id; esperando.set(i, { ok, mal }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluar = async (expression, awaitPromise = false) => { const r = await enviar("Runtime.evaluate", { expression, awaitPromise, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const captura = async (archivo) => {
    const rect = JSON.parse(await evaluar(`JSON.stringify(document.getElementById("escenario").getBoundingClientRect())`));
    const shot = await enviar("Page.captureScreenshot", { format: "png", clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } });
    writeFileSync(archivo, Buffer.from(shot.data, "base64"));
  };
  await enviar("Page.enable"); await enviar("Runtime.enable");
  await enviar("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });

  for (const g of guias) {
    const dir = join(SALIDA, g.nombre); mkdirSync(dir, { recursive: true });
    consola.length = 0; eventos.length = 0;
    await enviar("Page.navigate", { url: `${WEB}/sparked/guia.html?demo=${g.demo}` });
    await enviar("Page.bringToFront").catch(() => {});
    for (let i = 0; i < 120 && !eventos.includes("Page.loadEventFired"); i++) await dormir(250);
    let total = 0;
    for (let i = 0; i < 160; i++) { const pg = await evaluar(`document.getElementById("pg")?.textContent || ""`); const m = pg.match(/^(\d+)\/(\d+)$/); if (m) { total = +m[2]; break; } await dormir(250); }
    if (!total) throw new Error(`${g.nombre}: el reproductor no arrancó (${consola.join(" | ")})`);
    const reporte = [];
    for (let i = 1; i <= total; i++) {
      await evaluar(ESPERAR, true); await dormir(450);
      const estados = [["slide", JSON.parse(await evaluar(REVISAR))]];
      if (CAPTURAS) await captura(join(dir, `${String(i).padStart(2, "0")}-slide.png`));
      if (estados[0][1].inicio) {
        await evaluar(`(() => { const b = document.querySelector("#escenario .inicio .start"); if (b) b.click(); return !!b; })()`);
        await dormir(1600); await evaluar(ESPERAR, true);
        estados.push(["juego", JSON.parse(await evaluar(REVISAR))]);
        if (CAPTURAS) await captura(join(dir, `${String(i).padStart(2, "0")}-juego.png`));
      }
      for (const [estado, r] of estados) reporte.push({ slide: i, estado, titulo: r.titulo, clase: r.clase, problemas: r.problemas, fotos: r.fotos });
      await evaluar(`document.getElementById("abajo").click()`); await dormir(350);
    }
    writeFileSync(join(dir, "reporte.json"), JSON.stringify({ guia: g.nombre, total, consola, reporte }, null, 1));
    // Resumen: la lista de resultados puede desplazarse a propósito (guías con muchos bloques); eso no cuenta como falla.
    const cuenta = {}; let fotosMal = 0, fotosTotal = 0;
    reporte.forEach((r) => {
      r.problemas.filter((p) => !(p.tipo === "contenido con barra de desplazamiento" && /rep-lista/.test(p.donde))).forEach((p) => (cuenta[p.tipo] = (cuenta[p.tipo] ?? 0) + 1));
      r.fotos.forEach((f) => { fotosTotal++; if ((f.visible ?? 100) < 98 || f.deformada || f.problema) fotosMal++; });
    });
    const fallas = Object.values(cuenta).reduce((a, b) => a + b, 0) + fotosMal + consola.length;
    if (fallas) codigo = 1;
    console.log(`${g.nombre}: ${total} slides · ${fallas ? "REVISAR" : "todo bien"} ·`, JSON.stringify({ ...cuenta, fotos: `${fotosMal} de ${fotosTotal} recortadas o con falla`, errores_consola: consola.length }));
  }
  console.log("Resultados en", SALIDA);
  await new Promise((r) => { ws.onclose = r; try { ws.send(JSON.stringify({ id: ++id, method: "Browser.close" })); } catch { r(); } setTimeout(r, 4000); });
} catch (e) {
  console.error("ERROR:", e.message); codigo = 2;
} finally {
  servidor.close();
  await dormir(700);
  // Edge sin ventana se desprende de Node: si no se cerró con Browser.close, se cierran solo SUS procesos (por su carpeta).
  try { rmSync(perfil, { recursive: true, force: true }); }
  catch {
    spawnSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*" + basename(perfil) + "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: "ignore" });
    await dormir(1200);
    try { rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
  process.exit(codigo);
}
