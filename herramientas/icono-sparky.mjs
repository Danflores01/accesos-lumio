// Icono de SparkEd para anclar las páginas al inicio del teléfono: Sparky asomándose, con los colores oficiales
// (pedido de Daniel, 10 nov 2026). Genera los archivos de sparked/img/iconos/ a partir del dibujo oficial de Sparky
// (sparked/js/arte.js), así que si Sparky cambia basta con volver a correr esta herramienta.
//
//   node herramientas/icono-sparky.mjs [carpeta de salida] [cara]
//
// cara: "quieto" (ojos redondos, la de siempre) o cualquier otra de arte.js ("riendo" = ojitos > <, "saludo"…).
// Escribe un .svg por cada archivo y, si encuentra Edge o Chrome, también el .png del tamaño exacto (dibujado directo
// del vector). Sin navegador deja solo los .svg y avisa.
//
// Las tres piezas:
//   sparky-180.png  cuadrado, fondo completo: iPhone y iPad (apple-touch-icon; iOS redondea las esquinas y no admite
//                   transparencia).
//   sparky-192.png  disco con las esquinas transparentes: Android (Chrome mete el icono de una página dentro de la
//                   figura del teléfono sobre blanco; un disco se ve como insignia, un cuadrado se vería pegado encima).
//   sparky-48.png   disco «de cerca» (solo la cabeza): pestaña del navegador y otros tamaños diminutos.
// La pose es la de las stories «Próximamente»: todo el cuerpo girado -6° alrededor del cuello, la cara mirando un poco
// hacia arriba y los guantes sobre la orilla. Fondo: degradado oficial noche → violeta → magenta con el sol detrás.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(AQUI, "..");
const SALIDA = path.resolve(process.argv[2] || path.join(REPO, "sparked/img/iconos"));
const CARA = process.argv[3] || "quieto";
const { capaSparky } = await import(pathToFileURL(path.join(REPO, "sparked/js/arte.js")).href);

const LINEA = "#2A2340", NARANJA = "#FF7A3D";
const r2 = (v) => Math.round(v * 100) / 100;
const guante = (cx, cy) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="1.15" fill="${NARANJA}" stroke="${LINEA}" stroke-width="0.45" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="${r2(cx - .35)}" cy="${r2(cy - .4)}" rx=".4" ry=".25" fill="#fff" opacity=".5"/>`;

// Sparky oficial; "mira" desplaza las luces de la cara (0.5, -0.32: mira un poco hacia arriba, como en las stories).
function sparkyOficial(cara, mira) {
  let s = capaSparky(cara, 0, 0);
  if (!s.includes('<g class="sk-cara">')) throw new Error("arte.js cambió: no encuentro el grupo de la cara de Sparky");
  if (mira) s = s.replace('<g class="sk-cara">', `<g class="sk-cara" transform="translate(${mira[0]} ${mira[1]})">`);
  return s.replace(/<ellipse class="sk-sombra"[^>]*\/>/, "");   // la sombra del piso no se ve en el icono
}

// El dibujo se arma en un lienzo de 512; "lado" solo cambia el tamaño final. k = px por unidad de Sparky;
// cy = altura del centro del casco; guantes = [separación desde el centro, altura] en unidades de Sparky, o null.
function icono({ id, lado, forma, cara, k, cy, guantes, estrellas = [], giro = -6, mira = [0.5, -0.32] }) {
  const T = 512, cx = T / 2, tx = cx - 8 * k, ty = cy - 6.1 * k;
  // Fondo oficial: linear-gradient(172deg, #1B1340 0%, #4C1D95 52%, #B8336A 100%)
  const a = 172 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = T * (Math.abs(dx) + Math.abs(dy)) / 2;
  const g = [T / 2 - dx * L, T / 2 - dy * L, T / 2 + dx * L, T / 2 + dy * L].map(r2);
  const sx = tx + 8 * k, sy = ty + 6.28 * k, sr = 6.08 * k, br = 8.56 * k;   // sol y su resplandor, detrás del casco
  const disco = forma === "disco";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${T} ${T}">
  <defs>
    <linearGradient id="${id}-fondo" gradientUnits="userSpaceOnUse" x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}"><stop offset="0" stop-color="#1B1340"/><stop offset=".52" stop-color="#4C1D95"/><stop offset="1" stop-color="#B8336A"/></linearGradient>
    <radialGradient id="${id}-brillo" gradientUnits="userSpaceOnUse" cx="${r2(sx)}" cy="${r2(sy)}" r="${r2(br)}"><stop offset="0" stop-color="#FFB347" stop-opacity=".5"/><stop offset=".629" stop-color="#FF6B9D" stop-opacity=".3"/><stop offset="1" stop-color="#FF6B9D" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD400"/><stop offset=".45" stop-color="#FFB347"/><stop offset="1" stop-color="#FF6B9D"/></linearGradient>
    ${disco ? `<clipPath id="${id}-disco"><circle cx="${T / 2}" cy="${T / 2}" r="${T / 2}"/></clipPath>` : ""}
  </defs>
  <g${disco ? ` clip-path="url(#${id}-disco)"` : ""}>
    <rect width="${T}" height="${T}" fill="url(#${id}-fondo)"/>
    <rect width="${T}" height="${T}" fill="url(#${id}-brillo)"/>
    ${estrellas.map(([x, y, r, op]) => `<circle cx="${r2(x * T)}" cy="${r2(y * T)}" r="${r2(r * T)}" fill="#fff" opacity="${op}"/>`).join("")}
    <circle cx="${r2(sx)}" cy="${r2(sy)}" r="${r2(sr)}" fill="url(#${id}-sol)" opacity=".95"/>
    <g transform="translate(${r2(tx)} ${r2(ty)}) scale(${k})">
      <g transform="rotate(${giro} 8 10)">${sparkyOficial(cara, mira)}</g>
      ${guantes ? guante(8 - guantes[0], guantes[1]) + guante(8 + guantes[0], guantes[1]) : ""}
    </g>
  </g>
</svg>`;
}

const EST_C = [[.12, .11, .011, .85], [.87, .09, .013, .9], [.30, .06, .006, .6], [.71, .17, .007, .65], [.07, .33, .008, .6], [.93, .31, .009, .7], [.50, .045, .005, .55]];
const EST_D = [[.27, .16, .011, .85], [.74, .14, .012, .9], [.50, .07, .006, .6]];
const ARCHIVOS = [
  { nombre: "sparky-180", lado: 180, transparente: false, forma: "cuadrado", k: 38, cy: 352, guantes: [5.0, 9.75], estrellas: EST_C },
  { nombre: "sparky-192", lado: 192, transparente: true, forma: "disco", k: 33, cy: 356, guantes: [5.35, 8.6], estrellas: EST_D },
  { nombre: "sparky-48", lado: 48, transparente: true, forma: "disco", k: 40, cy: 296, guantes: null, estrellas: [] },
];

fs.mkdirSync(SALIDA, { recursive: true });
for (const f of ARCHIVOS) fs.writeFileSync(path.join(SALIDA, f.nombre + ".svg"), icono({ ...f, id: f.nombre, cara: CARA }));
console.log(`SVG escritos en ${SALIDA} (cara «${CARA}»)`);

// ---------- De SVG a PNG con Edge o Chrome sin ventana (DevTools; Node 22 o más nuevo) ----------
const NAVEGADOR = [process.env.NAVEGADOR, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && fs.existsSync(p));
if (!NAVEGADOR || typeof WebSocket === "undefined") { console.log("No encontré Edge ni Chrome (o este Node no trae WebSocket): quedan solo los .svg."); process.exit(0); }
const puerto = 9400 + Math.floor(Math.random() * 80), perfil = fs.mkdtempSync(path.join(os.tmpdir(), "icono-sparky-"));
spawn(NAVEGADOR, ["--headless=new", `--remote-debugging-port=${puerto}`, "--disable-lcd-text", "--force-device-scale-factor=1", "--no-first-run", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await espera(200); }
if (!ws) { console.log("No pude abrir el navegador: quedan solo los .svg."); process.exit(1); }
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pend = new Map(), eventos = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m.method); });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); r({}); } }, 25000); });
await cdp("Page.enable");
let fallas = 0;
for (const f of ARCHIVOS) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: f.lado, height: f.lado, deviceScaleFactor: 1, mobile: false });
  await cdp("Emulation.setDefaultBackgroundColorOverride", f.transparente ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  eventos.length = 0;
  await cdp("Page.navigate", { url: pathToFileURL(path.join(SALIDA, f.nombre + ".svg")).href });
  for (let i = 0; i < 60 && !eventos.includes("Page.loadEventFired"); i++) await espera(100);
  await espera(250);
  let png = null;
  for (let intento = 0; intento < 3 && !png; intento++) { const s = await cdp("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: f.lado, height: f.lado, scale: 1 } }); if (s.result?.data) png = Buffer.from(s.result.data, "base64"); else await espera(600); }
  if (!png || png.readUInt32BE(16) !== f.lado || png.readUInt32BE(20) !== f.lado) { console.log("NO SE PUDO:", f.nombre); fallas++; continue; }
  fs.writeFileSync(path.join(SALIDA, f.nombre + ".png"), png);
  console.log(`${f.nombre}.png: ${f.lado} × ${f.lado} px, ${png.length} bytes${f.transparente ? ", esquinas transparentes" : ", sin transparencia"}`);
}
try { await cdp("Browser.close"); } catch {}
try { ws.close(); } catch {}
await espera(700);
if (process.platform === "win32") { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" }); } catch {} }
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
process.exit(fallas ? 1 : 0);
