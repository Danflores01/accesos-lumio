// Ronda de vigilancia de SparkEd: revisa en producción TODO el camino del cliente y dice, en segundos, qué está roto.
//
//   node ronda.mjs [--repo <ruta a accesos-lumio>] [--horas 72] [--detalle] [--sin-humo]
//
// Qué revisa:
//   1. Prueba de humo (herramientas/prueba-de-humo.mjs): sitio publicado y servidor, con claves inventadas.
//   2. Servidor: versión desplegada contra la del repositorio, y que los motores de la venta estén encendidos.
//   3. WhatsApp: que el teléfono de SparkEd siga enlazado.
//   4. Compras recientes: pagadas sin guía, guías sin entregar, entregas sin correo o sin WhatsApp, guías que nadie abre.
//   5. Guías pagadas que la IA no terminó.
//   6. Reportes nuevos, sobre todo los «AVISO AUTOMÁTICO» (una guía pagada no abrió).
//   7. Publicación del sitio (GitHub Pages) y estado de la copia local.
//
// No escribe nada y no gasta accesos. Usa la clave de administrador de CLAVES.txt (primera línea) sin imprimirla; sin
// ese archivo solo hace la parte pública. Nunca imprime nombres, teléfonos, correos ni links: solo folios, horas y estados.
// Termina con código 1 si hubo alguna FALLA (algo que un cliente sufre ya); los AVISOS son para mirar con calma.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opcion = (n, d = null) => { const i = args.indexOf("--" + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : d; };
const HORAS = Number(opcion("horas", 72)) || 72, DETALLE = !!opcion("detalle", false), SIN_HUMO = !!opcion("sin-humo", false);

// ---------- Dónde está la copia del repositorio ----------
function buscarRepo() {
  const esRepo = (d) => !!d && fs.existsSync(path.join(d, "herramientas", "prueba-de-humo.mjs")) && fs.existsSync(path.join(d, "funciones", "sparked", "index.ts"));
  const guardado = (() => { try { return fs.readFileSync(path.join(AQUI, "..", "repo.txt"), "utf8").trim(); } catch { return ""; } })();
  const candidatos = [typeof opcion("repo") === "string" ? opcion("repo") : "", process.env.SPARKED_REPO, path.resolve(AQUI, "..", "..", "..", ".."), guardado, process.cwd(), path.join(process.cwd(), "accesos-lumio")];
  for (let d = process.cwd(), i = 0; i < 6; i++, d = path.dirname(d)) candidatos.push(d, path.join(d, "accesos-lumio"));
  return candidatos.find(esRepo) ?? null;
}
const REPO = buscarRepo();
if (!REPO) {
  console.log("FALLA no encuentro la copia del repositorio accesos-lumio (busqué en --repo, SPARKED_REPO, repo.txt y las carpetas de alrededor).");
  console.log("      Clónalo: gh repo clone Danflores01/accesos-lumio   y vuelve a correr con --repo <ruta>.");
  process.exit(2);
}

let fallas = 0, avisos = 0;
const ok = (t) => console.log("ok    " + t);
const aviso = (t) => { avisos++; console.log("AVISO " + t); };
const falla = (t) => { fallas++; console.log("FALLA " + t); };
const titulo = (t) => console.log("\n— " + t + " —");
const hace = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 90 ? `${m} min` : m < 2880 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m / 1440)} días`; };
const hora = (iso) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const git = (...a) => { const r = spawnSync("git", a, { cwd: REPO, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : null; };

console.log(`Ronda de SparkEd · ${new Date().toLocaleString("es-MX")} · copia: ${REPO}`);

// ---------- 1. Prueba de humo ----------
titulo("1. Sitio y servidor, como los usa una familia (prueba de humo)");
if (SIN_HUMO) aviso("prueba de humo omitida (--sin-humo)");
else {
  const r = spawnSync(process.execPath, [path.join(REPO, "herramientas", "prueba-de-humo.mjs")], { cwd: REPO, encoding: "utf8", timeout: 180000 });
  const lineas = (r.stdout ?? "").split(/\r?\n/).filter((l) => /^(ok|FALLA|AVISO)\s/.test(l));
  const malas = lineas.filter((l) => l.startsWith("FALLA")), dudosas = lineas.filter((l) => l.startsWith("AVISO"));
  for (const l of DETALLE ? lineas : [...malas, ...dudosas]) console.log(l.slice(0, 5).padEnd(6) + l.replace(/^(ok|FALLA|AVISO)\s+/, "").slice(0, 260));
  fallas += malas.length; avisos += dudosas.length;
  if (!lineas.length) falla("la prueba de humo no corrió: " + String(r.stderr || r.error?.message || "sin salida").slice(0, 200));
  else if (!malas.length) ok(`prueba de humo: ${lineas.length - dudosas.length} comprobaciones bien (incluye ABRIR UNA GUÍA con la dirección del reproductor publicado)`);
  else console.log(`      prueba de humo: ${malas.length} de ${lineas.length} con falla`);
}

// ---------- Clave de administrador (sin imprimirla) ----------
const config = (() => { try { return fs.readFileSync(path.join(REPO, "sparked", "js", "config.js"), "utf8"); } catch { return ""; } })();
const API = (config.match(/api:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked").replace(/\/$/, "");
const clave = (() => { try { return fs.readFileSync(path.join(REPO, "CLAVES.txt"), "utf8").split(/\r?\n/)[0].trim(); } catch { return ""; } })();
async function admin(ruta) {
  try {
    const r = await fetch(API + "/admin" + ruta, { headers: { "x-admin-key": clave, "user-agent": "guardia-sparked/ronda" }, signal: AbortSignal.timeout(25000) });
    return { st: r.status, d: await r.json().catch(() => null) };
  } catch (e) { return { st: 0, d: null, error: e.message }; }
}

if (!clave) {
  titulo("2 a 6. Servidor, compras y reportes");
  aviso("no hay CLAVES.txt en la copia: solo se hizo la parte pública. Sin la clave de administrador no se pueden revisar compras ni reportes.");
} else {
  // ---------- 2. Servidor ----------
  titulo("2. Servidor");
  const ping = await admin("/ping");
  if (ping.st === 401) falla("la clave de CLAVES.txt ya no sirve (401): pídele a Daniel la clave vigente");
  else if (ping.st !== 200 || !ping.d) falla(`/admin/ping no respondió (HTTP ${ping.st}${ping.error ? ", " + ping.error : ""})`);
  else {
    const local = (() => { try { return fs.readFileSync(path.join(REPO, "funciones", "sparked", "index.ts"), "utf8").match(/const VERSION = "([^"]+)"/)?.[1] ?? "?"; } catch { return "?"; } })();
    const puente = (() => { try { return fs.readFileSync(path.join(REPO, "funciones", "puente-sparked", "index.ts"), "utf8").match(/accesos-lumio\/([0-9a-f]{7})[0-9a-f]{33}\//)?.[1] ?? "?"; } catch { return "?"; } })();
    if (ping.d.version === local) ok(`versión desplegada ${ping.d.version}, igual a la del repositorio (puente → ${puente})`);
    else aviso(`está desplegada la versión ${ping.d.version} y el repositorio trae la ${local} (puente → ${puente}): hay un despliegue pendiente, o esta copia está atrasada`);
    const m = ping.d.motores ?? {};
    const MOTORES = { ia: "no se pueden generar guías", mercadopago: "no se puede cobrar en línea", mercadopago_webhook: "los pagos no activan la guía solos", correo: "no salen los correos con el link", whatsapp: "no salen los WhatsApp con el link" };
    const apagados = Object.entries(MOTORES).filter(([k]) => m[k] !== true);
    if (!apagados.length) ok("los 5 motores de la venta están encendidos (IA, Mercado Pago, aviso de pago, correo, WhatsApp)");
    for (const [k, efecto] of apagados) falla(`motor apagado: ${k} → ${efecto}`);
    if (m.mercadopago_prueba === true) falla("Mercado Pago está en MODO DE PRUEBA: las compras no cobran de verdad");
    if (!String(ping.d.config?.sparked_correo_aviso ?? "").includes("@")) aviso("Daniel no tiene puesto su «correo de avisos» (Ajustes): los avisos automáticos solo se ven en el panel");
  }

  // ---------- 3. WhatsApp ----------
  titulo("3. WhatsApp");
  const wa = await admin("/whatsapp");
  if (wa.st !== 200 || !wa.d) aviso(`/admin/whatsapp no respondió (HTTP ${wa.st})`);
  else if (!wa.d.motor) aviso("WhatsApp no está conectado: las guías se entregan solo por correo");
  else {
    if (wa.d.estado_instancia === "authorized") ok("el teléfono de SparkEd está enlazado");
    else falla(`el WhatsApp de entregas está en «${wa.d.estado_instancia}»: las guías no llegan por WhatsApp (sí por correo)`);
    if (wa.d.webhook_configurado === false) aviso("los avisos de Green API no están configurados (botón «Conectar» en Ajustes)");
    if ((wa.d.fallidos_7d ?? 0) > 0) aviso(`${wa.d.fallidos_7d} entrega(s) por WhatsApp fallaron en 7 días`);
  }

  // ---------- 4. Compras recientes ----------
  titulo(`4. Compras de las últimas ${HORAS} horas`);
  const compras = await admin("/compras");
  if (compras.st !== 200 || !Array.isArray(compras.d)) falla(`/admin/compras no respondió (HTTP ${compras.st})`);
  else {
    const desde = Date.now() - HORAS * 3600000;
    const C = compras.d.filter((c) => new Date(c.creada_en).getTime() >= desde);
    const pagadas = C.filter((c) => c.estado === "pagada");
    let abiertas = 0;
    for (const c of C) {
      const f = `compra ${c.folio}`;
      if (c.estado === "pendiente" && c.mp_estado === "approved") falla(`${f}: Mercado Pago ya aprobó el pago y sigue «pendiente» (revisar: POST /admin/compras/<id>/revisar)`);
      if (c.estado !== "pagada") continue;
      const min = (Date.now() - new Date(c.pagada_en ?? c.creada_en).getTime()) / 60000;
      if (!c.guia_lista && min > 12) falla(`${f}: pagada hace ${hace(c.pagada_en)} y su guía todavía no está lista`);
      else if (c.guia_lista && !c.entregada_en && min > 12) falla(`${f}: su guía está lista desde hace rato y no se ha entregado`);
      if (!c.entregada_en) continue;
      if (!c.acceso) { falla(`${f}: entregada sin acceso (no hay link)`); continue; }
      if (!c.correo_lista_en) aviso(`${f}: entregada ${hora(c.entregada_en)} sin correo registrado`);
      if (["fallido", "sin_whatsapp"].includes(c.wa_estado)) aviso(`${f}: WhatsApp «${c.wa_estado}» (el correo es el respaldo)`);
      if ((c.acceso.usos ?? 0) > 0) abiertas++;
      else if (Date.now() - new Date(c.entregada_en).getTime() > 3 * 3600000) aviso(`${f}: entregada hace ${hace(c.entregada_en)} y nadie la ha abierto (puede ser normal; si son varias, revisa que abrir funcione)`);
      // Estados normales de un acceso de guía: «pendiente» (aún no la abren) y «abierto». Los demás, dentro de sus 7 días, se avisan.
      if (c.acceso.estado && !["abierto", "pendiente", "activo"].includes(c.acceso.estado) && new Date(c.acceso.expira_en).getTime() > Date.now()) aviso(`${f}: su acceso está «${c.acceso.estado}» y todavía no vence`);
    }
    const entregadas = pagadas.filter((c) => c.entregada_en);
    ok(`${C.length} compras: ${pagadas.length} pagadas, ${entregadas.length} entregadas, ${abiertas} abiertas por la familia, ${C.filter((c) => c.estado === "pendiente").length} pendientes de pago`);
    const viejas = entregadas.filter((c) => Date.now() - new Date(c.entregada_en).getTime() > 3600000);
    if (viejas.length >= 3 && abiertas === 0) falla(`ninguna de las ${viejas.length} guías entregadas se ha abierto: es la señal del fallo del 10 nov 2026. Revisa ya «ABRIR UNA GUÍA»`);

    // Llaves entregadas: el servidor debe reconocer la de cada compra y su guía debe estar completa. Se pregunta con
    // GET /acceso/<clave>/estado, que no gasta el acceso ni cuenta como dispositivo. La clave sale del link de la
    // compra y nunca se imprime.
    const vigentes = entregadas.filter((c) => c.link && c.acceso && !["expirado", "revocado", "cerrado"].includes(c.acceso.estado) && (!c.acceso.expira_en || new Date(c.acceso.expira_en).getTime() > Date.now())).slice(0, 25);
    let reconocidas = 0;
    for (const c of vigentes) {
      const t = String(c.link).match(/#([A-Za-z0-9]{8,64})$/)?.[1];
      if (!t) { falla(`compra ${c.folio}: su link no trae una clave válida`); continue; }
      try {
        const r = await fetch(`${API}/acceso/${t}/estado`, { headers: { "user-agent": "guardia-sparked/ronda" }, signal: AbortSignal.timeout(20000) });
        const d = await r.json().catch(() => null);
        if (r.status === 200 && d?.completo === true) reconocidas++;
        else if (r.status === 404) falla(`compra ${c.folio}: el servidor no reconoce la clave de su link (HTTP 404 ${JSON.stringify(d ?? "").slice(0, 60)}): esa familia no puede abrir su guía`);
        else if (d?.completo === false) falla(`compra ${c.folio}: se entregó el link y su guía no está completa`);
        else falla(`compra ${c.folio}: el servidor respondió algo inesperado al preguntar por su clave (HTTP ${r.status})`);
      } catch (e) { aviso(`compra ${c.folio}: no pude preguntar por su clave (${e.message})`); }
    }
    if (vigentes.length && reconocidas === vigentes.length) ok(`llaves entregadas y vigentes: el servidor reconoce las ${vigentes.length} y cada una tiene su guía completa (sin gastar accesos)`);
  }

  // ---------- 5. Guías pagadas que no se terminaron ----------
  titulo("5. Generación");
  const res = await admin("/resumen");
  if (res.st !== 200 || !res.d) aviso(`/admin/resumen no respondió (HTTP ${res.st})`);
  else {
    const E = res.d.entregas_con_error ?? [];
    for (const x of E) falla(`una guía pagada no se terminó (paso ${x.paso ?? "?"}, desde ${hora(x.desde)}): la familia ve «Estamos revisando tu guía». Reintentar: POST /admin/trabajos/${x.trabajo_id}/reintentar`);
    if (!E.length) ok(`ninguna guía pagada a medias · trabajos de IA corriendo: ${res.d.ia?.corriendo ?? 0} · con error este mes: ${res.d.ia?.errores ?? 0}`);
  }

  // ---------- 6. Reportes ----------
  titulo("6. Reportes");
  const rep = await admin("/reportes");
  if (rep.st !== 200 || !Array.isArray(rep.d)) aviso(`/admin/reportes no respondió (HTTP ${rep.st})`);
  else {
    const nuevos = rep.d.filter((r) => r.estado === "nuevo");
    const autom = nuevos.filter((r) => /^AVISO AUTOM/i.test(r.comentario ?? ""));
    for (const r of autom.slice(0, 8)) falla(`${hora(r.creado_en)} · ${String(r.comentario).slice(0, 230)}`);
    if (autom.length > 8) console.log(`      … y ${autom.length - 8} avisos automáticos más`);
    const otros = nuevos.length - autom.length;
    if (!autom.length) ok(`sin avisos automáticos de guías que no abren · ${otros} reporte(s) de familias sin revisar`);
    else if (otros) aviso(`${otros} reporte(s) de familias sin revisar`);
  }
}

// ---------- 7. Publicación y copia local ----------
titulo("7. Publicación del sitio y copia local");
git("fetch", "-q", "origin");
const cabeza = git("rev-parse", "--short", "HEAD"), remoto = git("rev-parse", "--short", "origin/main"), sucios = (git("status", "--short") ?? "").split("\n").filter(Boolean).length;
if (!cabeza) aviso("no pude leer el estado de git de la copia");
else if (cabeza !== remoto) aviso(`la copia local (${cabeza}) y GitHub (${remoto}) no están en el mismo commit`);
else ok(`copia local al día con GitHub (${cabeza})${sucios ? ` · ${sucios} archivo(s) con cambios sin guardar` : ""}`);
// La señal fiable es la última corrida «pages build and deployment»: la lista antigua (pages/builds) a veces anota el
// commit anterior aunque el sitio ya esté publicado (pasó el 10 nov 2026).
const gh = spawnSync("gh", ["api", "repos/Danflores01/accesos-lumio/actions/runs?per_page=30", "--jq", "[.workflow_runs[] | select(.path | test(\"pages\"))][0] | \"\\(.status) \\(.conclusion) \\(.head_sha[0:7])\""], { encoding: "utf8", shell: false });
if (gh.status !== 0 || gh.stdout.startsWith("null")) aviso("no pude preguntar a GitHub por la última publicación (¿falta gh?)");
else {
  const [estado, conclusion, commit] = gh.stdout.trim().split(" ");
  if (estado !== "completed") aviso(`el sitio se está publicando (${commit}): repite la ronda en un minuto`);
  else if (conclusion !== "success") falla(`la última publicación del sitio (${commit}) falló: lo publicado es una versión anterior. Relanzar: gh api -X POST repos/Danflores01/accesos-lumio/pages/builds`);
  else if (remoto && commit !== remoto) aviso(`lo publicado es ${commit} y GitHub va en ${remoto}`);
  else ok(`sitio publicado en ${commit}`);
}

// El vigilante automático (.github/workflows/guardia.yml) corre la prueba de humo cada 15 minutos y después de cada
// publicación, aunque nadie tenga abierta una sesión. Aquí se revisa que siga encendido y cómo le fue la última vez.
const vig = spawnSync("gh", ["api", "repos/Danflores01/accesos-lumio/actions/workflows/guardia.yml", "--jq", ".state"], { encoding: "utf8", shell: false });
if (vig.status !== 0) aviso("el vigilante automático no aparece en GitHub (o no pude preguntar): nadie revisa el sitio entre sesiones. Debería estar en .github/workflows/guardia.yml; volver a subirlo necesita el sí de Daniel (_guardia/LEEME.md)");
else if (vig.stdout.trim() !== "active") falla(`el vigilante automático está apagado («${vig.stdout.trim()}»): nadie revisa el sitio entre sesiones. Encenderlo: gh workflow enable guardia.yml -R Danflores01/accesos-lumio`);
else {
  const u = spawnSync("gh", ["api", "repos/Danflores01/accesos-lumio/actions/workflows/guardia.yml/runs?per_page=1&status=completed", "--jq", ".workflow_runs[0] | \"\\(.conclusion) \\(.created_at) \\(.event)\""], { encoding: "utf8", shell: false });
  const [conclusion, cuando, evento] = (u.stdout ?? "").trim().split(" ");
  if (u.status !== 0 || !cuando || cuando === "null") aviso("el vigilante automático está encendido y todavía no tiene corridas terminadas");
  else if (conclusion !== "success") falla(`la última revisión del vigilante automático terminó en «${conclusion}» (${hora(cuando)}): mira qué falló con  gh run list -R Danflores01/accesos-lumio -w guardia.yml -L 3`);
  else if (Date.now() - new Date(cuando).getTime() > 3 * 3600000) aviso(`el vigilante automático no corre desde hace ${hace(cuando)} (debería correr cada 15 minutos)`);
  else ok(`vigilante automático encendido · última revisión bien hace ${hace(cuando)} (${evento === "schedule" ? "por horario" : evento === "workflow_run" ? "tras una publicación" : "a mano"})`);
}

// ¿Esta ronda corre desde la copia instalada y el repositorio ya trae una guardia más nueva?
const fuente = path.join(REPO, "_guardia", "skill", "guardia-sparked");
if (fs.existsSync(fuente) && path.resolve(AQUI, "..") !== path.resolve(fuente)) {
  const leer = (a) => { try { return fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n"); } catch { return null; } };
  const atrasados = ["SKILL.md", "scripts/ronda.mjs", "scripts/lanzar.mjs", ...["incidentes", "publicar-rapido", "consultas", "mapa-del-camino", "sintomas"].map((n) => `references/${n}.md`)].filter((r) => leer(path.join(fuente, r)) !== leer(path.join(AQUI, "..", r)));
  if (atrasados.length) aviso(`la guardia instalada en esta computadora está atrasada respecto al repositorio (${atrasados.length} archivo(s)). Actualízala: node _guardia/instalar.mjs`);
}

console.log(`\n${fallas ? `${fallas} FALLA(S)` : "Sin fallas"}${avisos ? ` · ${avisos} aviso(s)` : ""}. ${fallas ? "Hay algo que un cliente está sufriendo o va a sufrir: atiéndelo antes que cualquier otra cosa." : "El camino del cliente responde bien."}`);
process.exit(fallas ? 1 : 0);
