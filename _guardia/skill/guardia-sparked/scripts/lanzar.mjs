// Compuerta de lanzamiento de SparkEd: revisa, publica, espera y comprueba, en un solo comando. Así publicar es rápido
// y la comprobación de después no depende de que alguien se acuerde.
//
//   node lanzar.mjs -m "qué cambia" [-m "otro párrafo"] <archivo> [<archivo> …]   revisa → guarda → sube → espera → ronda
//   node lanzar.mjs --revisar <archivo> [<archivo> …]                             solo las revisiones (no publica nada)
//   node lanzar.mjs --esperar                                                     espera lo ya subido y corre la ronda
//   node lanzar.mjs --regresar <commit>                                           deshace ese commit, publica y comprueba
//   Opción: --repo <ruta a accesos-lumio>
//
// Revisiones ANTES de subir (si una falla, no se sube nada):
//   · la copia local está al día con GitHub;
//   · ningún archivo es privado (CLAVES.txt) ni de la fase 1 (accesos/, entrar.html, panel.html de la raíz, icons/,
//     funciones/ir, funciones/admin);
//   · sintaxis de cada .js, .mjs, .ts y .json, y de los guiones escritos dentro de cada .html;
//   · si va código del servidor: herramientas/probar-rutas.mjs (ningún módulo tapa una ruta ajena);
//   · prueba de humo del sitio TAL COMO QUEDARÍA (esta copia, servida en local) contra el servidor de producción:
//     atrapa, antes de publicar, que el reproductor nuevo pida una dirección que el servidor no atiende.
// DESPUÉS de subir: espera a que GitHub Pages termine y corre la ronda completa (ronda.mjs) contra producción.
//
// Publica el SITIO. El servidor (funciones/sparked) no cambia hasta desplegar el puente: ver references/publicar-rapido.md.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const T0 = Date.now(), seg = () => `${Math.round((Date.now() - T0) / 1000)} s`;
const args = process.argv.slice(2), mensajes = [], dados = [];
let modo = "lanzar", repoDado = "", commitMalo = "", automatizacionAprobada = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-m") mensajes.push(args[++i] ?? "");
  else if (a === "--repo") repoDado = args[++i] ?? "";
  else if (a === "--revisar") modo = "revisar";
  else if (a === "--esperar") modo = "esperar";
  else if (a === "--regresar") { modo = "regresar"; commitMalo = args[++i] ?? ""; }
  else if (a === "--automatizacion-aprobada-por-daniel") automatizacionAprobada = true;
  else if (a.startsWith("-")) { console.log("Opción desconocida: " + a); process.exit(2); }
  else dados.push(a);
}

function buscarRepo() {
  const esRepo = (d) => !!d && fs.existsSync(path.join(d, "herramientas", "prueba-de-humo.mjs")) && fs.existsSync(path.join(d, "funciones", "sparked", "index.ts"));
  const guardado = (() => { try { return fs.readFileSync(path.join(AQUI, "..", "repo.txt"), "utf8").trim(); } catch { return ""; } })();
  const candidatos = [repoDado, process.env.SPARKED_REPO, path.resolve(AQUI, "..", "..", "..", ".."), guardado, process.cwd(), path.join(process.cwd(), "accesos-lumio")];
  for (let d = process.cwd(), i = 0; i < 6; i++, d = path.dirname(d)) candidatos.push(d, path.join(d, "accesos-lumio"));
  return candidatos.find(esRepo) ?? null;
}
const REPO = buscarRepo();
if (!REPO) { console.log("No encuentro la copia del repositorio accesos-lumio (usa --repo <ruta>)."); process.exit(2); }
const RONDA = [path.join(AQUI, "ronda.mjs"), path.join(REPO, "_guardia", "skill", "guardia-sparked", "scripts", "ronda.mjs")].find((p) => fs.existsSync(p));
const NOMBRE = "Danflores01/accesos-lumio";

const git = (...a) => { const r = spawnSync("git", a, { cwd: REPO, encoding: "utf8" }); return { bien: r.status === 0, sale: (r.stdout ?? "").trim(), error: (r.stderr ?? "").trim() }; };
const gh = (...a) => { const r = spawnSync("gh", a, { cwd: REPO, encoding: "utf8", shell: false }); return r.status === 0 ? (r.stdout ?? "").trim() : null; };
const correr = (archivo, extra = [], silencio = false) => new Promise((ok) => {
  const h = spawn(process.execPath, [archivo, ...extra], { cwd: REPO, stdio: silencio ? ["ignore", "pipe", "pipe"] : "inherit" });
  let sale = ""; h.stdout?.on("data", (d) => (sale += d)); h.stderr?.on("data", (d) => (sale += d));
  h.on("close", (codigo) => ok({ codigo, sale }));
});
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const paso = (t) => console.log(`\n— ${t} (${seg()}) —`);
const alto = (t) => { console.log("ALTO  " + t); process.exit(1); };

// ---------- Revisiones de antes ----------
const PROHIBIDOS = [
  [/^(CLAVES\.txt|\.prueba_ids)$|^(\.dev|\.claude)\//, "es privado y nunca se sube"],
  [/^(accesos\/|icons\/|funciones\/(ir|admin)\/)|^(entrar|panel)\.html$/, "es de la fase 1, que no se toca"],
];
const relativo = (f) => {
  const porAqui = path.resolve(process.cwd(), f), porRepo = path.resolve(REPO, f);
  const abs = !path.relative(REPO, porAqui).startsWith("..") && fs.existsSync(porAqui) ? porAqui : porRepo;
  return path.relative(REPO, abs).replace(/\\/g, "/");
};
function sintaxis(rel, tmp) {
  const abs = path.join(REPO, rel), ext = path.extname(rel).toLowerCase();
  if (!fs.existsSync(abs)) return null;   // se está borrando
  const checar = (archivo) => { const r = spawnSync(process.execPath, ["--check", archivo], { encoding: "utf8" }); return r.status === 0 ? null : (r.stderr || "error de sintaxis").split(/\r?\n/).filter((l) => l.trim()).slice(0, 5).join(" | ").slice(0, 400); };
  if ([".js", ".mjs", ".ts"].includes(ext)) return checar(abs);
  if (ext === ".json") { try { JSON.parse(fs.readFileSync(abs, "utf8")); return null; } catch (e) { return e.message; } }
  if (ext === ".html") {
    let n = 0;
    for (const [, atributos, codigo] of fs.readFileSync(abs, "utf8").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      n++;
      if (/\bsrc\s*=/i.test(atributos) || !codigo.trim() || /type\s*=\s*["']?(application\/(ld\+)?json|importmap|text\/(template|plain))/i.test(atributos)) continue;
      const archivo = path.join(tmp, `guion-${n}${/type\s*=\s*["']?module/i.test(atributos) ? ".mjs" : ".cjs"}`);
      fs.writeFileSync(archivo, codigo);
      const e = checar(archivo);
      if (e) return `guion número ${n} de la página: ${e.replaceAll(tmp, "")}`;
    }
  }
  return null;
}
async function humoLocal() {
  // Sirve esta copia en un puerto libre y corre la prueba de humo contra ella: el sitio como quedaría + el servidor real.
  const servidor = http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";
    const abs = path.join(REPO, ruta);
    if (path.relative(REPO, abs).startsWith("..") || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end("no existe"); return; }
    res.writeHead(200, { "cache-control": "no-store" }); fs.createReadStream(abs).pipe(res);
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const r = await correr(path.join(REPO, "herramientas", "prueba-de-humo.mjs"), [`http://127.0.0.1:${servidor.address().port}/sparked/`], true);
  servidor.close();
  return r;
}
async function revisar(archivos) {
  let mal = 0;
  const bien = (t) => console.log("ok    " + t), falla = (t) => { mal++; console.log("FALLA " + t); };
  for (const f of archivos) for (const [patron, motivo] of PROHIBIDOS) if (patron.test(f)) falla(`${f}: ${motivo}`);
  // Un archivo en .github/workflows/ enciende algo que trabaja solo en la cuenta de GitHub de Daniel: lo decide él.
  if (!automatizacionAprobada) for (const f of archivos) if (f.startsWith(".github/")) falla(`${f}: enciende o cambia una automatización permanente en GitHub. Necesita el sí expreso de Daniel; con su sí, repite con --automatizacion-aprobada-por-daniel`);
  if (mal) return false;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lanzar-"));
  let revisados = 0;
  for (const f of archivos) { const e = sintaxis(f, tmp); if (e) falla(`${f}: ${e}`); else revisados++; }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  if (revisados === archivos.length) bien(`sintaxis de ${archivos.length} archivo(s)`);
  if (archivos.some((f) => f.startsWith("funciones/sparked/"))) {
    // Los candados del servidor: cada uno nació de un fallo real y debe pasar antes de subir código del servidor.
    for (const [prueba, queCuida] of [["probar-rutas.mjs", "ningún módulo tapa una ruta ajena"], ["probar-ventas.mjs", "solo cuenta como venta lo que de verdad se cobró"], ["probar-codigos.ts", "los códigos de descuento cobran lo que deben"]]) {
      if (!fs.existsSync(path.join(REPO, "herramientas", prueba))) continue;
      const r = await correr(path.join(REPO, "herramientas", prueba), [], true);
      if (r.codigo === 0) bien(`servidor: ${queCuida} (${prueba})`);
      else falla(`${prueba} falló:\n` + r.sale.split(/\r?\n/).filter((l) => /FALLA|falla|Error/.test(l)).slice(0, 8).join("\n"));
    }
    console.log("nota  va código del servidor: subirlo NO lo despliega. Falta apuntar el puente y desplegar (references/publicar-rapido.md).");
  }
  const tocaSitio = archivos.some((f) => f.startsWith("sparked/"));
  if (archivos.some((f) => /^sparked\/js\/.+\.js$/.test(f)) && !archivos.includes("sparked/guia.html")) console.log("nota  cambian guiones del sitio y no guia.html: el navegador guarda 10 minutos cada archivo. Si es urgente, sube también el ?v= del reproductor en sparked/guia.html.");
  const r = await humoLocal();
  const malas = r.sale.split(/\r?\n/).filter((l) => l.startsWith("FALLA"));
  if (r.codigo === 0) bien(`prueba de humo de esta copia contra el servidor real${tocaSitio ? "" : " (no cambia el sitio; se corre igual)"}`);
  else { falla("la prueba de humo de esta copia NO pasa: publicarla rompería (o dejaría roto) el camino de las familias"); for (const l of malas.slice(0, 8)) console.log("      " + l.slice(0, 260)); if (!malas.length) console.log(r.sale.slice(-500)); }
  return mal === 0;
}

// ---------- Publicación ----------
// ¿Ya se publicó este commit? La señal fiable es la corrida «pages build and deployment» de ESE commit. La lista
// antigua de construcciones (pages/builds) a veces anota el commit anterior (pasó el 10 nov 2026: el sitio ya estaba
// publicado y la lista seguía diciendo el commit viejo), así que solo se usa de respaldo y por su hora.
function estadoPublicacion(cabeza, desde) {
  const corrida = gh("api", `repos/${NOMBRE}/actions/runs?head_sha=${cabeza}&per_page=20`, "--jq", '[.workflow_runs[] | select(.path | test("pages"))][0] | "\\(.status) \\(.conclusion)"');
  if (corrida && !corrida.startsWith("null")) {
    const [estado, conclusion] = corrida.split(" ");
    return estado !== "completed" ? "construyendo" : conclusion === "success" ? "publicado" : "fallo";
  }
  const [estado, commit, creada] = (gh("api", `repos/${NOMBRE}/pages/builds/latest`, "--jq", '"\\(.status) \\(.commit) \\(.created_at)"') ?? "").split(" ");
  const esDeEste = commit === cabeza || (!!creada && new Date(creada).getTime() >= desde - 5000);
  return esDeEste && estado === "built" ? "publicado" : esDeEste && estado === "errored" ? "fallo" : "construyendo";
}
async function esperarPublicacion(desde) {
  const cabeza = git("rev-parse", "HEAD").sale;
  for (let i = 0, relanzado = false; i < 50; i++) {
    const e = estadoPublicacion(cabeza, desde);
    if (e === "publicado") return true;
    if (e === "fallo") {
      if (relanzado) return false;
      relanzado = true; console.log("      la construcción falló: la relanzo una vez"); gh("api", "-X", "POST", `repos/${NOMBRE}/pages/builds`);
      await espera(15000);
    }
    await espera(5000);
  }
  return false;
}
// La prueba definitiva: lo que está en vivo es idéntico a lo de esta copia. Se comparan los archivos de este
// lanzamiento que el sitio sirve tal cual (no las carpetas con guion bajo o punto, ni los .md, que GitHub transforma).
async function enVivoIgual(archivos) {
  const dominio = (() => { try { return fs.readFileSync(path.join(REPO, "CNAME"), "utf8").trim(); } catch { return ""; } })();
  const comparables = archivos.filter((f) => /\.(js|mjs|css|html|json|svg|txt)$/i.test(f) && !f.split("/").some((p) => /^[_.]/.test(p)) && fs.existsSync(path.join(REPO, f))).slice(0, 12);
  if (!dominio || !comparables.length) return null;
  const limpio = (t) => t.replace(/\r\n/g, "\n");
  let distintos = [];
  for (let intento = 0; intento < 8; intento++) {
    distintos = [];
    for (const f of comparables) {
      const local = limpio(fs.readFileSync(path.join(REPO, f), "utf8"));
      if (local.startsWith("---")) continue;   // GitHub procesa los archivos que empiezan así
      try { const r = await fetch(`https://${dominio}/${f}?v=${Date.now()}`, { headers: { "user-agent": "guardia-sparked/lanzar" }, signal: AbortSignal.timeout(15000) }); if (!r.ok || limpio(await r.text()) !== local) distintos.push(f); } catch { distintos.push(f); }
    }
    if (!distintos.length) return { bien: true, cuantos: comparables.length };
    await espera(8000);
  }
  return { bien: false, distintos };
}
async function despuesDeSubir(desde, archivos = []) {
  paso("Esperando a que GitHub Pages publique");
  if (!(await esperarPublicacion(desde))) alto(`el sitio no terminó de publicarse. Mira qué pasó:  gh run list -R ${NOMBRE} -L 3   y repite con --esperar`);
  console.log(`ok    publicado ${git("rev-parse", "--short", "HEAD").sale}`);
  const vivo = await enVivoIgual(archivos);
  if (vivo?.bien) console.log(`ok    comprobado en vivo: ${vivo.cuantos} archivo(s) del sitio son idénticos a los de esta copia`);
  else if (vivo) console.log(`AVISO lo que está en vivo todavía NO coincide con esta copia en: ${vivo.distintos.join(", ")}. Puede ser la copia guardada de GitHub; si sigue así en unos minutos, la publicación no salió.`);
  paso("Ronda de comprobación en producción");
  const r = RONDA ? await correr(RONDA, ["--repo", REPO]) : await correr(path.join(REPO, "herramientas", "prueba-de-humo.mjs"));
  const cabeza = git("rev-parse", "--short", "HEAD").sale;
  if (r.codigo === 0) console.log(`\nPUBLICADO Y COMPROBADO en ${seg()} (${cabeza}).`);
  else console.log(`\nPUBLICADO, PERO LA RONDA ENCONTRÓ FALLAS (${seg()}). Si alguna es del camino de las familias y antes no estaba, regresa ya:\n   node ${path.relative(process.cwd(), fileURLToPath(import.meta.url)).replace(/\\/g, "/")} --regresar ${cabeza}`);
  process.exit(r.codigo === 0 ? 0 : 1);
}
function alDia() {
  if (!git("fetch", "-q", "origin").bien) alto("no pude hablar con GitHub (git fetch). Revisa la conexión y la cuenta: gh auth status (debe estar activa Danflores01)");
  const atras = Number(git("rev-list", "--count", "HEAD..origin/main").sale), adelante = git("log", "--format=%h %s", "origin/main..HEAD").sale;
  if (atras) alto(`GitHub tiene ${atras} cambio(s) que esta copia no tiene. Tráelos (git pull --ff-only) y vuelve a revisar: quizá otra sesión publicó algo.`);
  if (adelante) console.log("nota  esta copia tiene cambios guardados sin subir, que también se van a publicar:\n      " + adelante.split("\n").join("\n      "));
}
async function sinConstruccionEnCurso() {
  for (let i = 0; i < 30; i++) {
    const estado = gh("api", `repos/${NOMBRE}/pages/builds`, "--jq", ".[0].status");
    if (estado === null || estado === "built" || estado === "errored") return;
    if (i === 0) console.log("      hay una publicación en curso: espero a que termine (dos seguidas tumban la construcción)");
    await espera(5000);
  }
}

console.log(`Compuerta de lanzamiento de SparkEd · copia: ${REPO}`);
// --esperar: lo ya subido. De referencia se toma la hora del último commit y se comparan en vivo sus archivos.
if (modo === "esperar") await despuesDeSubir(Number(git("log", "-1", "--format=%ct").sale) * 1000, git("show", "--name-only", "--format=", "HEAD").sale.split("\n").filter(Boolean));

if (modo === "regresar") {
  if (!/^[0-9a-f]{7,40}$/i.test(commitMalo)) alto("di qué commit se deshace: --regresar <commit>");
  paso("Antes de regresar"); alDia(); await sinConstruccionEnCurso();
  const tocados = git("show", "--name-only", "--format=", commitMalo).sale.split("\n").filter(Boolean);
  for (const f of tocados) for (const [patron, motivo] of PROHIBIDOS) if (patron.test(f)) alto(`ese commit tocó ${f}, que ${motivo}: deshazlo a mano y con el visto bueno de Daniel.`);
  const r = git("revert", "--no-edit", commitMalo);
  if (!r.bien) { git("revert", "--abort"); alto("no se pudo deshacer solo (hay cambios encima): " + r.error.slice(0, 300)); }
  const desde = Date.now();
  const s = git("push", "origin", "main"); if (!s.bien) alto("no se pudo subir: " + s.error.slice(0, 300));
  console.log(`ok    deshecho ${commitMalo} y subido (${seg()})`);
  await despuesDeSubir(desde, tocados);
}

const archivos = [...new Set(dados.map(relativo))];
if (!archivos.length) alto("di qué archivos se publican (nunca «todos»: así no se cuela nada privado ni de pruebas).");
if (modo === "lanzar" && !mensajes.filter((m) => m.trim()).length) alto('falta decir qué cambia: -m "…"');
paso("Revisiones antes de publicar");
if (modo === "lanzar") alDia();
if (!(await revisar(archivos))) alto("no se publicó nada. Corrige lo de arriba y vuelve a lanzar.");
if (modo === "revisar") { console.log(`\nRevisiones bien (${seg()}). No se publicó nada.`); process.exit(0); }

paso("Guardar y subir");
await sinConstruccionEnCurso();
const a = git("add", "--", ...archivos); if (!a.bien) alto("git add falló: " + a.error.slice(0, 300));
const c = git("commit", ...mensajes.filter((m) => m.trim()).flatMap((m) => ["-m", m]), "--", ...archivos);
if (!c.bien) alto("no se pudo guardar el cambio (¿no hay nada nuevo en esos archivos?): " + (c.error || c.sale).slice(0, 300));
const desde = Date.now();
const s = git("push", "origin", "main");
if (!s.bien) alto("se guardó pero no se pudo subir: " + s.error.slice(0, 300) + "\nArréglalo y termina con: git push origin main  y luego  --esperar");
console.log(`ok    subido ${git("rev-parse", "--short", "HEAD").sale} (${seg()})`);
await despuesDeSubir(desde, archivos);
