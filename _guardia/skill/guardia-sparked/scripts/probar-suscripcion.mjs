// Prueba en vivo de la suscripción mensual «Guías ilimitadas», de punta a punta, contra PRODUCCIÓN y sin dinero real.
//
//   node probar-suscripcion.mjs [--repo <ruta a accesos-lumio>] [--sin-ia] [--guia] [--conservar] [--limpiar]
//
// Crea UNA cuenta de prueba (número +52 000…, que no puede ser de ninguna familia), le manda peticiones como las del
// sitio y al final la borra con todo lo que creó. Con una cuenta de prueba el servidor NO toca Mercado Pago, no manda
// WhatsApp ni correos, no llena los Reportes de Daniel y nada cuenta como venta: lo que diría Mercado Pago (la
// suscripción autorizada, un cobro aprobado, un cobro rechazado) se le escribe con POST /admin/suscripciones/:id/prueba
// y pasa por el mismo código de verdad. Revisa:
//   · que para el público siga apagada y que un número que no es probador no pueda contratarla;
//   · el alta con 7 días gratis (hace falta marcar la casilla), que no se duplica y que «Mi cuenta» la enseña;
//   · el aviso de más de 15 guías durante la prueba (solo la bandera);
//   · la tarea diaria SOLO sobre suscripciones de prueba: aviso de renovación una vez, gracia y vencida con fecha simulada;
//   · el cobro: activa, pagada un mes más; el mismo cobro repetido no alarga dos veces;
//   · cambiar el método de pago SIN cancelar («como Xbox»): con la suscripción activa (mismo folio, mismo periodo, sin
//     cobro) y con un cobro sin pasar (se cobra con el método nuevo y vuelve a activa; no deja abrir otro cambio encima);
//   · cobro rechazado → en gracia (no crea guías) → vencida;
//   · volver a suscribirse ya sin prueba gratis, y cancelar en un clic con el mensaje que pidió Daniel;
//   · una guía con una foto en blanco hecha con la suscripción: falla, queda como fallida y no gasta saldo (gasta
//     centavos de IA; se omite con --sin-ia);
//   · con --guia: además genera UNA guía completa de verdad con la suscripción (unos minutos y hasta 5 pesos de IA).
//     Con --guia --conservar la cuenta de prueba no se borra al final; después se borra con --limpiar.
// Lo demás (avisos firmados de Mercado Pago, una prueba por tarjeta, mensajes a la familia, cancelar con Mercado Pago
// caído) se prueba sin internet en herramientas/probar-suscripciones.ts.
//
// Usa la clave de administrador de CLAVES.txt (primera línea) sin imprimirla. No imprime tokens ni links.
// Termina con código 1 si algo falló. Si se interrumpe, vuelve a correrla: borra las cuentas de prueba que hayan quedado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null; };
const SIN_IA = !!opcion("sin-ia"), CON_GUIA = !!opcion("guia"), CONSERVAR = !!opcion("conservar"), SOLO_LIMPIAR = !!opcion("limpiar");

function buscarRepo() {
  const esRepo = (d) => !!d && fs.existsSync(path.join(d, "herramientas", "prueba-de-humo.mjs")) && fs.existsSync(path.join(d, "funciones", "sparked", "index.ts"));
  const guardado = (() => { try { return fs.readFileSync(path.join(AQUI, "..", "repo.txt"), "utf8").trim(); } catch { return ""; } })();
  const candidatos = [typeof opcion("repo") === "string" ? opcion("repo") : "", process.env.SPARKED_REPO, path.resolve(AQUI, "..", "..", "..", ".."), guardado, process.cwd(), path.join(process.cwd(), "accesos-lumio")];
  for (let d = process.cwd(), i = 0; i < 6; i++, d = path.dirname(d)) candidatos.push(d, path.join(d, "accesos-lumio"));
  return candidatos.find(esRepo) ?? null;
}
const REPO = buscarRepo();
if (!REPO) { console.log("FALLA no encuentro la copia del repositorio accesos-lumio (usa --repo <ruta>)."); process.exit(2); }
const config = (() => { try { return fs.readFileSync(path.join(REPO, "sparked", "js", "config.js"), "utf8"); } catch { return ""; } })();
const API = (config.match(/api:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked").replace(/\/$/, "");
const clave = (() => { try { return fs.readFileSync(path.join(REPO, "CLAVES.txt"), "utf8").split(/\r?\n/)[0].trim(); } catch { return ""; } })();
if (!clave) { console.log("FALLA falta CLAVES.txt (la clave de administrador) en la raíz de la copia: sin ella no hay cuenta de prueba."); process.exit(2); }

let bien = 0, fallas = 0, avisos = 0;
const ok = (cond, que, detalle = "") => { if (cond) { bien++; console.log("ok    " + que); } else { fallas++; console.log("FALLA " + que + (detalle ? " · " + detalle : "")); } return !!cond; };
const aviso = (t) => { avisos++; console.log("AVISO " + t); };
const titulo = (t) => console.log("\n— " + t + " —");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), seg = () => `${Math.round((Date.now() - T0) / 1000)} s`;
const DIA = 86400000, HORA = 3600000;
// Un mes después de una fecha: entre 28 y 31 días (la base suma «1 month» y los meses no miden lo mismo).
const unMesDespues = (fin, desde) => { const d = (new Date(fin ?? 0).getTime() - new Date(desde ?? 0).getTime()) / DIA; return d > 27.9 && d < 31.1; };
const cerca = (a, b, margen = 10 * 60000) => Math.abs(new Date(a ?? 0).getTime() - (typeof b === "number" ? b : new Date(b ?? 0).getTime())) <= margen;

async function pedir(m, ruta, cuerpo, op = {}) {
  const cabeceras = { "content-type": "application/json", "user-agent": "guardia-sparked/probar-suscripcion" };
  if (op.sesion) cabeceras["x-cuenta"] = op.sesion;
  if (op.admin) cabeceras["x-admin-key"] = clave;
  for (let intento = 0; ; intento++) {
    try {
      const r = await fetch(API + "/" + ruta, { method: m, headers: cabeceras, body: cuerpo !== undefined && m !== "GET" ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(60000) });
      return { st: r.status, d: await r.json().catch(() => null) };
    } catch (e) { if (intento >= 1 || m !== "GET") return { st: 0, d: null, error: e.message }; await espera(1500); }
  }
}
const admin = (m, ruta, cuerpo) => pedir(m, "admin/" + ruta, cuerpo, { admin: true });

// ---------- Fotos de prueba (Edge sin ventana): una hoja en blanco y una página de apuntes ----------
const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
async function fotos(paginas) {
  if (!EDGE) return null;
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "edge-suscripcion-")), puerto = 9500 + Math.floor(Math.random() * 300);
  spawn(EDGE, ["--headless=new", `--remote-debugging-port=${puerto}`, "--force-device-scale-factor=1", "--no-first-run", "--disable-extensions", "--disable-sync", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
  const salida = [];
  try {
    let ws = null;
    for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await espera(250); }
    if (!ws) return null;
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0; const pend = new Map();
    ws.addEventListener("message", (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
    const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); r({}); } }, 20000); });
    await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 900, height: 1200, deviceScaleFactor: 1, mobile: false });
    for (const html of paginas) {
      await cdp("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
      await espera(700);
      const r = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      if (r.result?.data) salida.push(Buffer.from(r.result.data, "base64"));
    }
    try { await cdp("Browser.close"); } catch {}
  } finally {
    await espera(400);
    try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" }); } catch {}
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
  return salida.length === paginas.length ? salida : null;
}
const HOJA_EN_BLANCO = `<html><body style="margin:0;background:#fff"></body></html>`;
const APUNTES = `<html><body style="margin:0;background:#fffdf5;font-family:Georgia,serif;color:#1b1b1f;padding:56px 64px;font-size:25px;line-height:1.5">
<h1 style="font-size:38px;margin:0 0 6px">Ciencias Naturales · 5.º de primaria</h1>
<h2 style="font-size:31px;margin:0 0 18px;color:#1f5a7a">El ciclo del agua (apuntes para el examen)</h2>
<p><b>1. Qué es.</b> El ciclo del agua es el recorrido que hace el agua en la Tierra: pasa del mar y los ríos al aire y regresa a la superficie. No tiene principio ni fin. El Sol le da la energía.</p>
<p><b>2. Evaporación.</b> El calor del Sol convierte el agua líquida de mares, ríos y lagos en vapor de agua, que sube a la atmósfera. Las plantas también sueltan vapor por sus hojas: eso se llama transpiración.</p>
<p><b>3. Condensación.</b> Al subir, el vapor se enfría y se convierte en gotitas muy pequeñas que forman las nubes.</p>
<p><b>4. Precipitación.</b> Cuando las gotas se juntan y pesan mucho, caen como lluvia, nieve o granizo.</p>
<p><b>5. Escurrimiento e infiltración.</b> Parte del agua corre por la superficie hacia ríos y mares (escurrimiento) y otra parte entra al suelo y forma los mantos acuíferos (infiltración).</p>
<p><b>Estados del agua:</b> sólido (hielo), líquido (agua) y gaseoso (vapor). <b>Palabras clave:</b> evaporación, condensación, precipitación, infiltración, acuífero.</p>
</body></html>`;

// ---------- La prueba ----------
const NUMERO = "000" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const ULTIMOS = NUMERO.slice(-4), PAGADOR = "9" + String(Math.floor(Math.random() * 1e15)).padStart(15, "0");
let cuentaId = null, sesion = "", cifrasAntes = null;
const cuentasDePrueba = async () => ((await admin("GET", "paquetes")).d?.cuentas ?? []).filter((c) => c.de_prueba);
const borrarCuenta = async (id) => (await admin("DELETE", "cuentas/" + id));
const miCuenta = async () => (await pedir("GET", "cuenta", undefined, { sesion })).d ?? {};
const actual = async () => (await miCuenta()).suscripcion?.actual ?? null;
const delPanel = async () => (await admin("GET", "suscripciones")).d ?? {};
const cifras = (r) => JSON.stringify(r ?? null);
const accion = (id, cuerpo) => admin("POST", `suscripciones/${id}/prueba`, cuerpo);
const pagoAprobado = (n) => ({ id: `prueba-${NUMERO}-${n}`, status: "approved", status_detail: "accredited", transaction_amount: 0, currency_id: "MXN", payment_type_id: "credit_card", date_approved: new Date().toISOString() });

if (SOLO_LIMPIAR) {
  const viejas = await cuentasDePrueba();
  for (const c of viejas) await borrarCuenta(c.id);
  const quedan = await cuentasDePrueba(), sus = (await delPanel()).resumen?.de_prueba ?? 0;
  console.log(quedan.length || sus ? `FALLA quedaron ${quedan.length} cuenta(s) y ${sus} suscripción(es) de prueba sin borrar` : `ok    ${viejas.length} cuenta(s) de prueba borrada(s) con todo lo que crearon`);
  process.exit(quedan.length || sus ? 1 : 0);
}

console.log(`Prueba en vivo de la suscripción mensual · ${new Date().toLocaleString("es-MX")} · servidor: ${API.replace(/^https:\/\//, "").split("/")[0]}`);
try {
  titulo("0. Servidor y modo");
  const ping = await admin("GET", "ping"), info = await pedir("GET", "suscripcion/info"), P0 = await delPanel();
  if (!ok(ping.st === 200 && info.st === 200 && !!P0.ajustes, `el servidor responde (versión ${ping.d?.version ?? "?"}) y conoce la suscripción`, `ping ${ping.st} · info ${info.st}`)) throw new Error("el servidor no tiene las rutas de la suscripción: ¿está desplegada la versión nueva?");
  const MODO = P0.ajustes.modo, PRECIO = Number(P0.ajustes.precio);
  ok(["no", "probadores", "si"].includes(MODO) && PRECIO > 0 && info.d.precio === PRECIO && info.d.prueba_dias === 7, `suscripción: $${PRECIO} al mes, ${info.d.prueba_dias} días gratis · modo ${MODO === "si" ? "ABIERTA AL PÚBLICO" : MODO === "probadores" ? `solo probadores (${P0.ajustes.probadores?.length ?? 0} en la lista)` : "apagada"}`);
  ok(info.d.disponible === (MODO === "si"), MODO === "si" ? "para el público está ABIERTA (el sitio la ofrece)" : "para el público está apagada: el sitio dice «Próximamente»");
  ok((await pedir("GET", "admin/suscripciones")).st === 401 && (await pedir("POST", "admin/suscripciones/diario", {})).st === 401, "el panel de suscripciones y la revisión diaria piden la clave de administrador");
  const viejas = await cuentasDePrueba();
  for (const c of viejas) await borrarCuenta(c.id);
  if (viejas.length) aviso(`había ${viejas.length} cuenta(s) de prueba de una corrida anterior: se borraron antes de empezar`);
  const P1 = await delPanel(), V0 = (await admin("GET", "resumen")).d;
  ok(!!P1.resumen && !!V0?.compras && P1.resumen.de_prueba === 0, "foto de las cifras del panel antes de empezar (deben quedar iguales al final)");
  cifrasAntes = { R0: P1.resumen, V0 };

  titulo("1. Cuenta de prueba");
  const c1 = await pedir("POST", "cuenta/codigo", { telefono: NUMERO, simular: true }, { admin: true });
  const e1 = await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c1.d?.codigo });
  sesion = e1.d?.sesion ?? "";
  if (!ok(e1.st === 200 && sesion.length >= 32, "la cuenta de prueba entra con su código simulado (no se manda a nadie)", `HTTP ${c1.st} / ${e1.st}`)) throw new Error("no se pudo entrar con la cuenta de prueba");
  cuentaId = (await cuentasDePrueba()).find((c) => c.whatsapp === "••• ••• " + ULTIMOS)?.id ?? null;
  if (!ok(!!cuentaId, "la cuenta quedó marcada «de prueba»")) throw new Error("no encontré la cuenta de prueba en el panel");
  const mia0 = await miCuenta();
  ok(mia0.suscripcion?.actual === null && mia0.suscripcion.disponible === (MODO === "si"), `«Mi cuenta» sin suscripción${MODO === "si" ? "" : ": a un número que no es probador no le ofrece suscribirse"}`);
  ok((await pedir("POST", "suscripcion/crear", { acepta: true })).st === 401 && (await pedir("GET", "suscripcion/estado")).st === 401 && (await pedir("POST", "suscripcion/cancelar", {})).st === 401, "sin sesión, suscribirse, ver el estado y cancelar piden entrar");

  titulo("2. Suscribirse (7 días gratis)");
  const datos = { nombre: "Prueba Automática", correo: "prueba@sparked.invalid" };
  if (MODO !== "si") ok((await pedir("POST", "suscripcion/crear", { acepta: true, ...datos }, { sesion })).st === 503, "un número que no es probador NO puede suscribirse (el servidor dice «no disponible»)");
  ok((await pedir("POST", "suscripcion/crear", { ...datos }, { sesion, admin: true })).d?.campo === "acepta", "sin marcar la casilla del cobro automático no se crea nada");
  const alta = await pedir("POST", "suscripcion/crear", { acepta: true, ...datos }, { sesion, admin: true });
  const susId = alta.d?.suscripcion_id;
  if (!ok(alta.st === 200 && alta.d.modo === "simulada" && alta.d.con_prueba === true && alta.d.precio === PRECIO && cerca(alta.d.primer_cobro_en, Date.now() + 7 * DIA), `con la clave de administrador la cuenta de prueba se suscribe SIN tocar Mercado Pago: prueba gratis, primer cobro en 7 días (folio ${alta.d?.folio})`, `HTTP ${alta.st} ${alta.d?.error ?? ""}`)) throw new Error("no se pudo crear la suscripción de prueba");
  const otra = await pedir("POST", "suscripcion/crear", { acepta: true, ...datos }, { sesion, admin: true });
  ok(otra.d?.suscripcion_id === susId, "oprimir «Suscribirme» otra vez reutiliza la misma");
  // «Mi cuenta» solo conoce el correo a medias (p•••@…). Si una página lo manda de regreso como correo de pago, el
  // servidor lo ignora y usa el de la cuenta; si lo guardara, este pedido ya no sería igual y abriría OTRA suscripción.
  const aMedias = String((await miCuenta()).cuenta?.correo ?? "");
  const conMedias = await pedir("POST", "suscripcion/crear", { acepta: true, correo_pago: aMedias }, { sesion, admin: true });
  ok(aMedias.includes("•") && conMedias.st === 200 && conMedias.d?.suscripcion_id === susId, "el correo a medias que enseña «Mi cuenta» nunca se usa como correo de pago (sigue siendo la misma suscripción)", `HTTP ${conMedias.st}`);
  const a0 = await actual();
  ok(a0?.estado === "pendiente" && a0.falta === "tarjeta" && a0.puede_crear === false && a0.puede_cancelar === true, "mientras no «pone su tarjeta»: pendiente, sin derecho a crear guías");
  const aut = await accion(susId, { accion: "preapproval", datos: { status: "authorized", next_payment_date: alta.d.primer_cobro_en, payer_id: PAGADOR, payment_method_id: "visa" }, pagos: [] });
  const a1 = await actual();
  ok(aut.d?.resultado === "en_prueba" && a1?.estado === "en_prueba" && a1.puede_crear === true && cerca(a1.prueba_hasta, alta.d.primer_cobro_en) && cerca(a1.proximo_cobro, alta.d.primer_cobro_en), "aviso simulado de «tarjeta autorizada»: queda en prueba gratis hasta la fecha del primer cobro y ya puede crear guías");
  const sin = await accion(susId, { accion: "preapproval", datos: { status: "authorized", next_payment_date: alta.d.primer_cobro_en, payer_id: PAGADOR }, pagos: [] });
  ok(sin.d?.resultado === "al_dia", "el mismo aviso repetido no cambia nada");
  const fila1 = (await delPanel()).suscripciones?.find((x) => x.id === susId);
  ok(fila1?.de_prueba === true && fila1.estado === "en_prueba" && fila1.whatsapp === "••• ••• " + ULTIMOS, "en el panel aparece marcada «de prueba», con el WhatsApp a medias");

  titulo("3. Uso durante la prueba y tarea diaria");
  const uso = await accion(susId, { accion: "uso", guias: 16 });
  const V1 = (await admin("GET", "resumen")).d;
  ok(uso.d?.resultado === true && uso.d.suscripcion?.revisar === true && V1?.reportes_nuevos === V0.reportes_nuevos, "más de 15 guías en la prueba: queda la bandera «revisar» (no bloquea) y, por ser de prueba, no llena los Reportes de Daniel");
  ok((await accion(susId, { accion: "uso", guias: 17 })).d?.resultado === false, "el aviso de uso sale una sola vez");
  await accion(susId, { accion: "fechas", proximo_cobro: new Date(Date.now() + 5 * DIA + HORA).toISOString(), periodo_fin: new Date(Date.now() + 5 * DIA + HORA).toISOString(), aviso_renovacion_para: null });
  const d1 = await admin("POST", "suscripciones/diario", { solo_prueba: true });
  const d2 = await admin("POST", "suscripciones/diario", { solo_prueba: true });
  ok(d1.st === 200 && d1.d.solo_prueba === true && d1.d.revisadas === 1 && d1.d.avisos_renovacion === 1 && d2.d?.avisos_renovacion === 0, "tarea diaria (solo suscripciones de prueba): a 5 días del cobro marca el aviso de renovación UNA vez; repetida, ya no", `revisadas ${d1.d?.revisadas} · avisos ${d1.d?.avisos_renovacion} y ${d2.d?.avisos_renovacion}`);

  titulo("4. El cobro, y el cobro repetido");
  const finPrueba = (await actual())?.periodo_fin;
  const pago1 = { ...pagoAprobado(1), transaction_amount: PRECIO };
  const k1 = await accion(susId, { accion: "pago", pago: pago1 });
  const a2 = await actual();
  ok(k1.d?.resultado === "cobrado" && a2?.estado === "activa" && unMesDespues(a2.periodo_fin, finPrueba) && cerca(a2.proximo_cobro, a2.periodo_fin), "un cobro aprobado la deja activa y pagada un mes más (desde el fin de la prueba)");
  const k2 = await accion(susId, { accion: "pago", pago: pago1 });
  const [k3, k4] = await Promise.all([accion(susId, { accion: "pago", pago: pago1 }), accion(susId, { accion: "pago", pago: pago1 })]);
  const a3 = await actual(), det = (await admin("GET", `suscripciones/${susId}`)).d;
  ok([k2, k3, k4].every((x) => x.d?.resultado === "sin_cambios") && a3?.periodo_fin === a2?.periodo_fin && det?.cobros?.length === 1 && det.cobros[0].estado === "aprobado", "el mismo cobro avisado tres veces más (dos a la vez): UN solo cobro anotado y el periodo no se alarga otra vez", `cobros ${det?.cobros?.length}`);
  const P2 = await delPanel(), V2 = (await admin("GET", "resumen")).d;
  ok(P2.resumen?.cobros === cifrasAntes.R0.cobros && P2.resumen.ingreso_mxn === cifrasAntes.R0.ingreso_mxn && P2.resumen.de_prueba === 1 && cifras(V2?.suscripciones) === cifras(V0.suscripciones) && V2.compras.ingresos_mes === V0.compras.ingresos_mes, "nada de esto cuenta como venta: los cobros y los ingresos del panel siguen igual");

  titulo("4b. Cambiar el método de pago con la suscripción activa (sin cancelar y sin cobro)");
  const antesCambio = await actual();
  ok((await pedir("POST", "suscripcion/metodo-de-pago", {})).st === 401, "sin sesión, cambiar el método de pago pide entrar");
  ok(antesCambio?.metodo?.puede_cambiar === true && antesCambio.metodo.inmediato === false && antesCambio.metodo.cambio === null, "«Mi cuenta» ofrece «Cambiar método de pago» con la suscripción activa");
  const cm1 = await pedir("POST", "suscripcion/metodo-de-pago", {}, { sesion });
  if (!ok(cm1.st === 200 && cm1.d.modo === "simulada" && cm1.d.inmediato === false && cerca(cm1.d.primer_cobro_en, antesCambio?.periodo_fin, 60000) && !!cm1.d.cambio_id, "pedir el cambio abre un contrato nuevo de la MISMA suscripción (simulado: no toca Mercado Pago) que empezaría a cobrar el día en que termina lo ya pagado", `HTTP ${cm1.st} ${cm1.d?.error ?? ""}`)) throw new Error("no se pudo pedir el cambio de método de pago: ¿está desplegada la versión nueva?");
  const cm2 = await pedir("POST", "suscripcion/metodo-de-pago", {}, { sesion });
  const aMitad = await actual();
  ok(cm2.d?.cambio_id === cm1.d.cambio_id && aMitad?.estado === "activa" && aMitad.periodo_fin === antesCambio.periodo_fin && aMitad.puede_crear === true && aMitad.metodo?.cambio?.estado === "pendiente", "oprimir el botón otra vez reutiliza el mismo cambio; mientras no «pone su tarjeta nueva», la suscripción sigue exactamente igual (abandonar a la mitad no cambia nada)");
  const apl = await accion(susId, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: antesCambio.periodo_fin, payer_id: PAGADOR, payment_method_id: "master" }, pagos: [] });
  const yaCambiada = await actual(), det2 = (await admin("GET", `suscripciones/${susId}`)).d;
  ok(apl.d?.resultado === "metodo_cambiado" && yaCambiada?.estado === "activa" && yaCambiada.id === antesCambio.id && yaCambiada.folio === antesCambio.folio && yaCambiada.periodo_fin === antesCambio.periodo_fin && cerca(yaCambiada.proximo_cobro, antesCambio.proximo_cobro, 60000) && yaCambiada.puede_crear === true && yaCambiada.metodo?.cambio?.estado === "aplicado" && !!yaCambiada.metodo.cambiado_en && yaCambiada.metodo.medio === "master" && det2?.cobros?.length === 1, "aviso simulado de «tarjeta nueva autorizada»: el método de pago queda cambiado y la suscripción es la misma (mismo folio, mismo periodo, mismo próximo cobro): no se canceló, no se cobró nada y no perdió días", `resultado ${apl.d?.resultado} · cobros ${det2?.cobros?.length}`);
  const rep = await accion(susId, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: antesCambio.periodo_fin, payer_id: PAGADOR }, pagos: [] });
  const viejo = await accion(susId, { accion: "preapproval", contrato: "anterior", datos: { status: "cancelled" }, pagos: [] });
  const sigueViva = await actual();
  ok(["al_dia", "metodo_ya_cambiado"].includes(rep.d?.resultado) && viejo.d?.resultado === "contrato_anterior_cancelado" && sigueViva?.estado === "activa" && sigueViva.puede_cancelar === true && sigueViva.periodo_fin === antesCambio.periodo_fin, "el aviso repetido no cambia nada, y el aviso de «contrato anterior cancelado» NO cancela la suscripción", `repetido ${rep.d?.resultado} · anterior ${viejo.d?.resultado}`);
  const fila2 = (await delPanel()).suscripciones?.find((x) => x.id === susId);
  ok(fila2?.metodo_pago?.cambios === 1 && fila2.metodo_pago.historial?.length === 1 && !!fila2.metodo_pago.ultimo_cambio_en && fila2.metodo_pago.en_curso === false && fila2.metodo_pago.falta_cancelar === 0 && !JSON.stringify(det2 ?? {}).includes("prueba-"), "el panel enseña el cambio en la fila de la suscripción (1 cambio, con su fecha en el historial) y nunca los identificadores de Mercado Pago");

  titulo("5. Cobro rechazado: en gracia y vencida");
  const malo = await accion(susId, { accion: "pago", pago: { id: `prueba-${NUMERO}-malo`, status: "rejected", status_detail: "cc_rejected_insufficient_amount", transaction_amount: PRECIO, currency_id: "MXN", payment_type_id: "credit_card" } });
  const a4 = await actual();
  ok(malo.d?.resultado === "rechazado" && a4?.estado === "en_gracia" && a4.puede_crear === false && a4.puede_cancelar === true && cerca(a4.gracia_hasta, Date.now() + 10 * DIA), "un cobro rechazado la deja «en gracia» por 10 días: no puede crear guías nuevas");
  ok(a4?.metodo?.puede_cambiar === true && a4.metodo.inmediato === true && a4.metodo.esperando_cobro === false, "en gracia, «Mi cuenta» ofrece cambiar el método de pago (el cobro se haría ese mismo día)");
  const d3 = await admin("POST", "suscripciones/diario", { fecha: new Date(Date.now() + 9 * DIA).toISOString() });
  const d4 = await admin("POST", "suscripciones/diario", { fecha: new Date(Date.now() + 10 * DIA + HORA).toISOString() });
  const a5 = await actual();
  ok(d3.d?.solo_prueba === true && d3.d.vencidas === 0 && d4.d?.vencidas === 1 && a5?.estado === "vencida" && a5.puede_crear === false, "tarea diaria con fecha simulada (solo toca suscripciones de prueba): a los 9 días sigue en gracia; pasados los 10, queda vencida");

  titulo("6. Volver a suscribirse (ya sin prueba gratis) y cancelar en un clic");
  const alta2 = await pedir("POST", "suscripcion/crear", { acepta: true }, { sesion, admin: true });
  const sus2 = alta2.d?.suscripcion_id;
  ok(alta2.st === 200 && alta2.d.con_prueba === false && alta2.d.primer_cobro_en === null && sus2 && sus2 !== susId, "ese número ya usó su prueba gratis: la segunda suscripción se crea SIN prueba y se cobra desde el primer día", `HTTP ${alta2.st} ${alta2.d?.error ?? ""}`);
  const aut2 = await accion(sus2, { accion: "preapproval", datos: { status: "authorized", payer_id: PAGADOR }, pagos: [] });
  const a6 = await actual();
  ok(aut2.d?.resultado === "esperando_primer_cobro" && a6?.estado === "pendiente" && a6.falta === "cobro" && a6.puede_crear === false, "sin prueba gratis no se activa con solo poner la tarjeta: espera el primer cobro aprobado");
  // «Como Xbox»: el primer cobro no pasa → cambia su método de pago SIN cancelar → Mercado Pago cobra con el nuevo.
  const malo6 = await accion(sus2, { accion: "pago", pago: { id: `prueba-${NUMERO}-malo6`, status: "rejected", status_detail: "cc_rejected_insufficient_amount", transaction_amount: PRECIO, currency_id: "MXN", payment_type_id: "credit_card" } });
  const g6 = await actual();
  ok(malo6.d?.resultado === "rechazado" && g6?.estado === "en_gracia" && g6.puede_crear === false && g6.metodo?.puede_cambiar === true && g6.metodo.inmediato === true, "el cobro no pasa: queda en gracia y «Mi cuenta» ofrece cambiar el método de pago (el cobro se haría ese mismo día)", `resultado ${malo6.d?.resultado} · estado ${g6?.estado}`);
  const cg = await pedir("POST", "suscripcion/metodo-de-pago", {}, { sesion });
  const sinTocar = await actual();
  ok(cg.st === 200 && cg.d.inmediato === true && cg.d.primer_cobro_en === null && sinTocar?.estado === "en_gracia" && sinTocar.metodo?.cambio?.estado === "pendiente", "en gracia el contrato nuevo se pide SIN fecha de inicio (cobra al poner la tarjeta); si abandona a la mitad, sigue en gracia como estaba", `HTTP ${cg.st} ${cg.d?.error ?? ""}`);
  const aplG = await accion(sus2, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", payer_id: PAGADOR, payment_method_id: "debvisa" }, pagos: [] });
  const esperando = await actual(), otroCambio = await pedir("POST", "suscripcion/metodo-de-pago", {}, { sesion });
  ok(aplG.d?.resultado === "metodo_cambiado" && esperando?.estado === "en_gracia" && esperando.id === g6.id && esperando.metodo?.esperando_cobro === true && esperando.metodo.puede_cambiar === false && otroCambio.st === 409 && otroCambio.d?.esperando_cobro === true, "tarjeta nueva autorizada: la suscripción es la misma, queda esperando el cobro con el método nuevo y NO deja abrir otro cambio encima (nunca dos contratos cobrando a la vez)", `resultado ${aplG.d?.resultado} · otro cambio HTTP ${otroCambio.st}`);
  const k5 = await accion(sus2, { accion: "pago", contrato: "nuevo", pago: { ...pagoAprobado(2), transaction_amount: PRECIO } });
  const a7 = await actual(), det6 = (await admin("GET", `suscripciones/${sus2}`)).d;
  ok(k5.d?.resultado === "cobrado" && a7?.estado === "activa" && a7.puede_crear === true && unMesDespues(a7.periodo_fin, Date.now()) && a7.metodo?.esperando_cobro === false && (det6?.cobros ?? []).filter((x) => x.estado === "aprobado").length === 1 && det6?.metodo_pago?.cambios === 1, "Mercado Pago cobra con el método nuevo: queda activa por un mes, ya puede crear guías y hubo UN solo cobro aprobado (sin cobro doble)", `resultado ${k5.d?.resultado} · aprobados ${(det6?.cobros ?? []).filter((x) => x.estado === "aprobado").length}`);
  const fin = a7?.periodo_fin;
  const can = await pedir("POST", "suscripcion/cancelar", {}, { sesion });
  const a8 = await actual();
  const fecha = new Date(fin).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
  ok(can.st === 200 && can.d.estado === "cancelada" && can.d.hasta === fin && can.d.mensaje === `Lamentamos que te vayas. Esperamos que regreses pronto al salón de clases. Tu suscripción seguirá activa hasta el ${fecha}; después ya no se te cobrará nada.`, "cancelar es UNA petición: queda cancelada y la respuesta trae el mensaje que pidió Daniel, con la fecha de fin", `HTTP ${can.st} · «${String(can.d?.mensaje ?? "").slice(0, 80)}»`);
  ok(a8?.estado === "cancelada" && a8.puede_crear === true && a8.puede_cancelar === false && a8.proximo_cobro === null && a8.hasta === fin, "cancelada: ya no hay próximo cobro y conserva lo pagado (puede crear guías) hasta el fin del periodo");
  const can2 = await pedir("POST", "suscripcion/cancelar", {}, { sesion });
  ok(can2.st === 200 && can2.d.ya === true && can2.d.hasta === fin, "cancelar otra vez no hace nada más");

  titulo("7. Guías con la suscripción");
  const crearGuia = async (jpg, etiqueta) => {
    const bo = await pedir("POST", "borrador", { grado: "5° primaria", materia: "Ciencias", paginas: [{ nombre: `${etiqueta}.jpg`, tipo: "image/jpeg", tamano: jpg.length }] });
    if (bo.st !== 201 || !bo.d?.subidas?.[0]?.url) return { st: bo.st, d: bo.d };
    const sube = await fetch(bo.d.subidas[0].url, { method: "PUT", headers: { "content-type": "image/jpeg", "x-upsert": "true" }, body: jpg, signal: AbortSignal.timeout(60000) });
    if (!sube.ok) return { st: sube.status, d: { error: "no se pudo subir la página" } };
    return await pedir("POST", "cuenta/guia", { clave: bo.d.clave }, { sesion });
  };
  const seguir = async (id, minutos) => {
    let ultimo = null;
    for (let i = 0; i < minutos * 12; i++) {
      const r = await pedir("GET", `cuenta/guia/${id}`, undefined, { sesion });
      if (r.d?.estado && r.d.estado !== "generando") return r;
      if (r.d?.progreso?.mensaje && r.d.progreso.mensaje !== ultimo) { ultimo = r.d.progreso.mensaje; console.log(`      ${seg()} · ${r.d.progreso.pct ?? "?"} % · ${ultimo}`); }
      await espera(5000);
    }
    return { st: 0, d: { estado: "sin terminar" } };
  };
  if (SIN_IA) aviso("guías omitidas (--sin-ia): la guía con suscripción queda probada solo sin internet (probar-suscripciones.ts)");
  else {
    const imagenes = await fotos(CON_GUIA ? [HOJA_EN_BLANCO, APUNTES] : [HOJA_EN_BLANCO]);
    if (!imagenes) aviso("no pude preparar las fotos de prueba (falta Edge): se omiten las guías");
    else {
      const g = await crearGuia(imagenes[0], "hoja-en-blanco");
      if (ok(g.st === 202 && g.d?.con_suscripcion === true, "crear una guía con la suscripción (cancelada, pero con días pagados): se acepta y no gasta saldo", `HTTP ${g.st} ${g.d?.error ?? ""}`)) {
        const finG = await seguir(g.d.compra_id, 5);
        ok(finG.d?.estado === "devuelta" && finG.d.con_suscripcion === true && /suscripción sigue activa|material de estudio|No se pudo leer/i.test(finG.d.mensaje ?? ""), `la foto no era material de estudio: la guía quedó como fallida en ${seg()} y la suscripción sigue igual`, `quedó «${finG.d?.estado}»`);
        const lista = (await miCuenta()).guias ?? [];
        ok(lista.find((x) => x.id === g.d.compra_id)?.estado === "devuelta" && !lista.some((x) => x.link) && (await actual())?.puede_crear === true, "en «Mi cuenta» esa guía sale como no creada, sin link, y puede intentarlo de nuevo");
      }
      if (CON_GUIA) {
        titulo("8. Una guía completa de verdad, hecha con la suscripción");
        const g2 = await crearGuia(imagenes[1], "apuntes");
        if (ok(g2.st === 202 && g2.d?.con_suscripcion === true, "se acepta; se genera completa, sin vista previa", `HTTP ${g2.st} ${g2.d?.error ?? ""}`)) {
          const fin2 = await seguir(g2.d.compra_id, 20);
          ok(fin2.d?.estado === "lista" && fin2.d.con_suscripcion === true && /\/guia\.html#[A-Za-z0-9]{8,}$/.test(fin2.d.link ?? ""), `la guía «${fin2.d?.titulo ?? "?"}» quedó lista en ${seg()}, con su link`, `quedó «${fin2.d?.estado}»`);
          ok(cerca(fin2.d?.expira_en, fin, HORA) && new Date(fin2.d?.expira_en ?? 0).getTime() > Date.now() + 8 * DIA, "su acceso no se queda en 7 días: llega hasta donde llega lo pagado de la suscripción");
          const fila = ((await admin("GET", "compras")).d ?? []).find((x) => x.id === g2.d.compra_id);
          const guia = fila?.guia_id ? (await admin("GET", "guias/" + fila.guia_id)).d : null;
          ok(fila?.cobro === "suscripcion" && fila.guia_lista === true && !!fila.entregada_en && guia?.completo === true, `en el panel: compra sin cobro («suscripción»), guía completa (${guia?.bloques ?? "?"} bloques, ${guia?.actividades ?? "?"} actividades), entregada`);
          const costo = Number(guia?.costo_mxn ?? NaN);
          const caro = (guia?.reporte?.metricas ?? []).slice().sort((x, y) => (Number(y?.costo_usd) || 0) - (Number(x?.costo_usd) || 0))[0];
          const elCaro = caro?.paso ? ` (el paso más caro fue «${caro.paso}»)` : "";
          if (!Number.isFinite(costo)) aviso("no pude leer el costo de IA de la guía");
          else if (costo <= 5) ok(true, `costo de IA de esa guía: $${costo.toFixed(2)} MXN (tope de producción: 5)`);
          else if (costo <= 15) aviso(`esa guía costó $${costo.toFixed(2)} MXN de IA: pasa del tope de 5 por guía${elCaro}. Es el generador de siempre, no la suscripción: hay que avisarle a la sesión de IA`);
          else ok(false, `costo de IA de esa guía: $${costo.toFixed(2)} MXN (el tope de las pruebas es 15)${elCaro}`);
          if (guia?.id) console.log(CONSERVAR ? `      para verla en el reproductor:  node herramientas/probar-guia.mjs ${guia.id}` : "      (para verla en el reproductor, repite con --guia --conservar)");
        }
      }
    }
  }

  titulo("Privacidad");
  const panel = JSON.stringify(await delPanel()) + JSON.stringify((await admin("GET", `suscripciones/${susId}`)).d ?? {});
  ok(!panel.includes(NUMERO) && !panel.includes("prueba@sparked.invalid") && panel.includes("••• ••• " + ULTIMOS), "en el panel el WhatsApp y el correo salen enmascarados, nunca completos");
} catch (e) {
  fallas++; console.log("FALLA la prueba se detuvo: " + (e?.message ?? e));
} finally {
  titulo("Limpieza");
  if (CONSERVAR) aviso("la cuenta de prueba NO se borró (--conservar). Cuando termines, bórrala con:  node probar-suscripcion.mjs --limpiar");
  else {
    let quedan = [], borradas = 0;
    for (let i = 0; i < 2; i++) { for (const c of await cuentasDePrueba()) { const r = await borrarCuenta(c.id); borradas += Number(r.d?.borrado?.suscripciones ?? 0); } quedan = await cuentasDePrueba(); if (!quedan.length) break; await espera(2000); }
    const P9 = await delPanel();
    ok(quedan.length === 0 && P9.resumen?.de_prueba === 0, `la cuenta de prueba se borró con todo lo que creó (${borradas} suscripciones, sus cobros, guías y accesos)`, `${quedan.length} cuenta(s) y ${P9.resumen?.de_prueba ?? "?"} suscripción(es) sin borrar`);
    if (cifrasAntes) {
      const V9 = (await admin("GET", "resumen")).d;
      ok(cifras(P9.resumen) === cifras(cifrasAntes.R0) && cifras(V9?.suscripciones) === cifras(cifrasAntes.V0.suscripciones) && cifras(V9?.compras) === cifras(cifrasAntes.V0.compras), "las cifras del panel (suscripciones, cobros, ventas e ingresos) quedaron idénticas a las de antes de la prueba", "si una familia compró algo durante la prueba es normal: compara a mano");
    }
  }
}
console.log(`\n${fallas ? "CON FALLAS" : "TODO BIEN"}: ${bien} de ${bien + fallas} comprobaciones bien${avisos ? ` · ${avisos} aviso(s)` : ""} · ${seg()}.`);
process.exit(fallas ? 1 : 0);
