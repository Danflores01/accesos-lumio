// Prueba en vivo del paquete de 3 guías, de punta a punta, contra PRODUCCIÓN y sin dinero real.
//
//   node probar-paquete.mjs [--repo <ruta a accesos-lumio>] [--sin-ia] [--guia] [--conservar] [--limpiar]
//
// Crea UNA cuenta de prueba (número +52 000…, que no puede ser de ninguna familia), le manda peticiones como las del
// sitio y al final la borra con todo lo que creó. Con una cuenta de prueba el servidor no manda WhatsApp ni correos y
// nada de lo que hace cuenta como venta. Revisa:
//   · el código de entrada (simulado: se pide con la clave de administrador y no se manda a nadie) y la sesión;
//   · el abono de prueba de +3 guías, marcado como prueba, y que vence a los 90 días;
//   · dos usos al mismo tiempo con saldo 1: solo uno pasa;
//   · la devolución (una sola vez) y que un saldo vencido no se puede usar;
//   · el límite de 2 dispositivos y el freno de códigos por número;
//   · «Comprar»: el link de pago de Mercado Pago se crea (no se paga), y marcar la compra como pagada dos veces a la
//     vez abona el paquete UNA sola vez (es la misma función que usa el aviso de Mercado Pago);
//   · una guía con una foto en blanco: la generación falla y la guía regresa sola al saldo (gasta centavos de IA;
//     se omite con --sin-ia);
//   · con --guia: además genera UNA guía completa de verdad con saldo (tarda unos minutos y gasta hasta 5 pesos de IA).
//     Con --guia --conservar la cuenta de prueba no se borra al final, para poder ver esa guía en el reproductor
//     (node herramientas/probar-guia.mjs <id que imprime la prueba>); después se borra con --limpiar.
// La firma falsa de un aviso de pago, los frenos por conexión y los mensajes a la familia se prueban sin internet en
// herramientas/probar-saldo.ts.
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

async function pedir(m, ruta, cuerpo, op = {}) {
  const cabeceras = { "content-type": "application/json", "user-agent": "guardia-sparked/probar-paquete" };
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
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "edge-paquete-")), puerto = 9500 + Math.floor(Math.random() * 300);
  spawn(EDGE, ["--headless=new", `--remote-debugging-port=${puerto}`, "--force-device-scale-factor=1", "--no-first-run", "--disable-extensions", `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", detached: true }).unref();
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
<h1 style="font-size:38px;margin:0 0 6px">Historia · 6.º de primaria</h1>
<h2 style="font-size:31px;margin:0 0 18px;color:#7a1f1f">La Independencia de México (apuntes para el examen)</h2>
<p><b>1. Causas.</b> En la Nueva España los criollos (hijos de españoles nacidos en América) no podían ocupar los cargos más importantes; esos puestos eran para los peninsulares. Había mucha desigualdad entre los grupos sociales. En 1808 Napoleón invadió España y el rey Fernando VII fue hecho prisionero.</p>
<p><b>2. Inicio.</b> La madrugada del 16 de septiembre de 1810, en el pueblo de Dolores (Guanajuato), el cura Miguel Hidalgo y Costilla llamó al pueblo a levantarse en armas: el «Grito de Dolores». Lo acompañaban Ignacio Allende y Juan Aldama. Josefa Ortiz de Domínguez, la Corregidora, avisó que la conspiración de Querétaro había sido descubierta.</p>
<p><b>3. Organización.</b> Hidalgo fue fusilado en 1811. José María Morelos y Pavón continuó la lucha en el sur. En 1813 convocó al Congreso de Chilpancingo y presentó los «Sentimientos de la Nación», donde pidió la independencia y el fin de la esclavitud. Morelos fue fusilado en 1815.</p>
<p><b>4. Resistencia.</b> Vicente Guerrero mantuvo la lucha en las montañas del sur con la guerra de guerrillas.</p>
<p><b>5. Consumación.</b> En 1821 Agustín de Iturbide y Vicente Guerrero se unieron con el Plan de Iguala, que tenía tres garantías: religión, independencia y unión. El Ejército Trigarante entró a la Ciudad de México el 27 de septiembre de 1821. La lucha duró 11 años.</p>
<p><b>Palabras clave:</b> criollo, peninsular, insurgente, realista, Congreso, consumación.</p>
</body></html>`;

// ---------- La prueba ----------
const NUMERO = "000" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const ULTIMOS = NUMERO.slice(-4);
let cuentaId = null;
const cuentasDePrueba = async () => ((await admin("GET", "paquetes")).d?.cuentas ?? []).filter((c) => c.de_prueba);
const borrarCuenta = async (id) => (await admin("DELETE", "cuentas/" + id)).st;
const cuentaAdmin = async () => (await admin("GET", "cuentas/" + cuentaId)).d ?? {};
const saldoDe = async (sesion) => (await pedir("GET", "cuenta", undefined, { sesion })).d?.saldo ?? {};
const usar = () => admin("POST", `cuentas/${cuentaId}/prueba`, { accion: "usar" });
const codigoSimulado = async () => (await pedir("POST", "cuenta/codigo", { telefono: NUMERO, simular: true }, { admin: true }));
const cifras = (r) => JSON.stringify(r ?? null);
let cifrasAntes = null;

if (SOLO_LIMPIAR) {
  const viejas = await cuentasDePrueba();
  for (const c of viejas) await borrarCuenta(c.id);
  const quedan = await cuentasDePrueba();
  console.log(quedan.length ? `FALLA quedaron ${quedan.length} cuenta(s) de prueba sin borrar` : `ok    ${viejas.length} cuenta(s) de prueba borrada(s) con todo lo que crearon`);
  process.exit(quedan.length ? 1 : 0);
}

console.log(`Prueba en vivo del paquete de 3 guías · ${new Date().toLocaleString("es-MX")} · servidor: ${API.replace(/^https:\/\//, "").split("/")[0]}`);
try {
  titulo("0. Servidor");
  const ping = await admin("GET", "ping"), info = await pedir("GET", "paquete/info");
  if (!ok(ping.st === 200 && info.st === 200, `el servidor responde (versión ${ping.d?.version ?? "?"}) y conoce el paquete`, `ping ${ping.st} · info ${info.st}`)) throw new Error("el servidor no tiene las rutas del paquete: ¿está desplegada la versión nueva?");
  const ENCENDIDO = info.d.disponible === true;
  ok(info.d.precio > 0 && info.d.guias === 3 && info.d.dias > 0, `paquete: ${info.d.guias} guías por $${info.d.precio}, saldo de ${info.d.dias} días · venta ${ENCENDIDO ? "ENCENDIDA" : "apagada"}`);
  const viejas = await cuentasDePrueba();
  for (const c of viejas) await borrarCuenta(c.id);
  if (viejas.length) aviso(`había ${viejas.length} cuenta(s) de prueba de una corrida anterior: se borraron antes de empezar`);
  const R0 = (await admin("GET", "paquetes")).d?.resumen, V0 = (await admin("GET", "resumen")).d;
  ok(!!R0 && !!V0?.compras, "foto de las cifras del panel antes de empezar (deben quedar iguales al final)");
  cifrasAntes = { R0, V0 };

  titulo("1. Código de entrada y sesión");
  ok((await pedir("POST", "cuenta/codigo", { telefono: NUMERO, simular: true })).st === 401, "simular el envío del código exige la clave de administrador");
  ok((await pedir("POST", "cuenta/codigo", { telefono: NUMERO })).st === 400, "un número de prueba no entra por la puerta de las familias");
  const c1 = await codigoSimulado();
  ok(c1.st === 200 && c1.d?.simulado === true && /^\d{6}$/.test(c1.d?.codigo ?? ""), "con la clave: el código de 6 dígitos se devuelve aquí y no se manda a nadie", `HTTP ${c1.st}`);
  const malo = String((Number(c1.d?.codigo ?? 0) + 1) % 1000000).padStart(6, "0");
  ok((await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: malo })).st === 401, "un código equivocado no entra");
  const e1 = await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c1.d?.codigo });
  const sesionA = e1.d?.sesion ?? "";
  if (!ok(e1.st === 200 && sesionA.length >= 32 && e1.d.saldo?.guias === 0, "el código correcto abre la sesión; la cuenta nace con saldo 0", `HTTP ${e1.st}`)) throw new Error("no se pudo entrar con la cuenta de prueba");
  ok((await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c1.d.codigo })).st === 401, "el mismo código no sirve dos veces");
  const mia = await pedir("GET", "cuenta", undefined, { sesion: sesionA });
  ok(mia.st === 200 && mia.d.cuenta?.whatsapp === "••• ••• " + ULTIMOS && (await pedir("GET", "cuenta")).st === 401, "«Mi cuenta» abre con la sesión (el número sale enmascarado) y sin sesión responde 401");
  const mias = (await cuentasDePrueba()).filter((c) => c.whatsapp === "••• ••• " + ULTIMOS);
  cuentaId = mias[0]?.id ?? null;
  if (!ok(mias.length === 1 && !!cuentaId, "la cuenta quedó marcada «de prueba» (no cuenta en ninguna cifra)")) throw new Error("no encontré la cuenta de prueba en el panel");

  titulo("2. Abono de prueba de 3 guías y vencimiento a 90 días");
  const ab = await admin("POST", `cuentas/${cuentaId}/ajuste`, { cambio: 3, dias: 90, nota: "Prueba automática: abono de 3 guías" });
  const dias = (new Date(ab.d?.vence_en ?? 0).getTime() - Date.now()) / 86400000;
  ok(ab.st === 200 && ab.d.saldo?.guias === 3 && Math.abs(dias - 90) < 0.01, `+3 guías de prueba: saldo 3, vencen en ${dias.toFixed(2)} días`, `HTTP ${ab.st}`);
  ok(ab.d?.movimientos?.[0]?.de_prueba === true && ab.d.movimientos[0].motivo_texto === "Abono de prueba" && ab.d.movimientos[0].cambio === 3, "el abono queda en el libro marcado como prueba");
  ok(cifras((await admin("GET", "paquetes")).d?.resumen) === cifras(R0), "las cifras del panel no cambian: una prueba no es venta ni saldo de una familia");

  titulo("3. Dos usos al mismo tiempo con saldo 1");
  const u1 = await usar(), u2 = await usar();
  ok(u1.st === 200 && u2.st === 200 && u2.d.quedan === 1, "se usan 2 guías, una tras otra: queda 1");
  const [a, b] = await Promise.all([usar(), usar()]);
  const estados = [a.st, b.st].sort().join(" y ");
  ok(estados === "200 y 402" && (await saldoDe(sesionA)).guias === 0, `dos usos al mismo tiempo con saldo 1: uno pasa y el otro recibe «sin saldo» (${estados}); el saldo queda en 0, nunca negativo`);
  ok((await usar()).st === 402, "con saldo 0 no se puede usar otra");

  titulo("4. Devolución, una sola vez");
  const ganador = a.st === 200 ? a : b;
  const d1 = await admin("POST", `cuentas/${cuentaId}/prueba`, { accion: "devolver", movimiento_id: ganador.d?.movimiento_id });
  const d2 = await admin("POST", `cuentas/${cuentaId}/prueba`, { accion: "devolver", movimiento_id: ganador.d?.movimiento_id });
  ok(d1.d?.devuelta === true && d1.d.quedan === 1 && d2.d?.devuelta === false && (await saldoDe(sesionA)).guias === 1, "una guía devuelta regresa al saldo (+1) y la misma no se devuelve dos veces");
  ok(d1.d?.vence_en === ab.d?.vence_en, "la guía devuelta conserva la fecha de vencimiento de su paquete");

  titulo("5. Un saldo vencido no se puede usar");
  await admin("POST", `cuentas/${cuentaId}/ajuste`, { cambio: 1, dias: 0, nota: "Prueba automática: abono ya vencido" });
  await espera(1200);
  const sv = await saldoDe(sesionA);
  ok(sv.guias === 1 && sv.vencidas === 1, `una guía vencida no cuenta en el saldo: disponibles ${sv.guias}, vencidas sin usar ${sv.vencidas}`);
  const u5 = await usar(), u6 = await usar();
  ok(u5.st === 200 && u5.d.quedan === 0 && u6.st === 402, "se usa la vigente y la vencida ya no se puede usar");

  titulo("6. Máximo 2 dispositivos y freno de códigos");
  const c2 = await codigoSimulado(), e2 = await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c2.d?.codigo });
  const sesionB = e2.d?.sesion ?? "";
  ok(e2.st === 200 && e2.d.dispositivos?.abiertos === 2, "segundo dispositivo: entra (2 de 2)");
  const c3 = await codigoSimulado(), e3 = await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c3.d?.codigo });
  ok(e3.st === 409 && e3.d?.limite === true && e3.d.dispositivos?.length === 2, "tercer dispositivo: no entra solo; se le pregunta si cierra la sesión más antigua");
  const e4 = await pedir("POST", "cuenta/entrar", { telefono: NUMERO, codigo: c3.d?.codigo, cerrar_antigua: true });
  const sesionC = e4.d?.sesion ?? "";
  const tras = await Promise.all([sesionA, sesionB, sesionC].map((s) => pedir("GET", "cuenta", undefined, { sesion: s })));
  ok(e4.st === 200 && e4.d.cerradas === 1 && tras.map((x) => x.st).join(" ") === "401 200 200", "al aceptar, entra y se cierra la sesión del dispositivo más antiguo (los otros dos siguen abiertos)", tras.map((x) => x.st).join(" "));
  const c4 = await codigoSimulado();
  ok(c4.st === 429, "cuarto código en una hora para el mismo número: el freno responde «espera un rato»", `HTTP ${c4.st}`);
  const sesion = sesionC;

  titulo("7. Comprar el paquete (sin pagar) y abono una sola vez");
  if (!ENCENDIDO) ok((await pedir("POST", "paquete/comprar", { nombre: "Prueba Automática", correo: "prueba@sparked.invalid" }, { sesion })).st === 503, "con la venta apagada, «Comprar» responde «no disponible»");
  const compra = await pedir("POST", "paquete/comprar", { nombre: "Prueba Automática", correo: "prueba@sparked.invalid" }, { sesion, admin: true });
  const compraId = compra.d?.compra_id;
  if (compra.d?.modo === "mercadopago") ok(/^https:\/\/(www\.)?mercadopago\.com(\.mx)?\/checkout\/v1\/redirect\?pref_id=[\w-]+$/.test(compra.d.url ?? "") && compra.d.precio === info.d.precio, `«Comprar» crea en Mercado Pago un link de pago válido por $${compra.d.precio} (folio ${compra.d.folio}); no se paga`);
  else ok(false, "«Comprar» no creó el link de Mercado Pago", `HTTP ${compra.st} · modo ${compra.d?.modo ?? "?"}`);
  if (compraId) {
    const otra = await pedir("POST", "paquete/comprar", { nombre: "Prueba Automática", correo: "prueba@sparked.invalid" }, { sesion, admin: true });
    ok(otra.d?.compra_id === compraId, "oprimir «Comprar» otra vez reutiliza la misma compra pendiente");
    const est = await pedir("GET", `paquete/estado/${compraId}`, undefined, { sesion });
    const pub = await pedir("GET", `pago/estado/${compraId}`);
    ok(est.st === 200 && est.d.estado === "pendiente" && est.d.abonado === false && est.d.saldo?.guias === 0, "sin pagar: la compra sigue pendiente y no hay saldo");
    ok(pub.st === 200 && pub.d.producto === "paquete3" && !("correo" in pub.d) && !("telefono" in pub.d) && !("link" in pub.d), "la ruta pública del estado de un pago no dice nada de la cuenta");
    const pagar = () => admin("POST", `compras/${compraId}/pagar`, { cobro: "cortesia" });
    const [p1, p2] = await Promise.all([pagar(), pagar()]); const p3 = await pagar();
    const est2 = await pedir("GET", `paquete/estado/${compraId}`, undefined, { sesion });
    const abonos = ((await cuentaAdmin()).movimientos ?? []).filter((m) => m.motivo === "compra");
    ok([p1, p2, p3].every((x) => x.st === 200) && abonos.length === 1 && abonos[0].cambio === 3 && est2.d?.saldo?.guias === 3 && est2.d.abonado === true, `la compra se marca pagada tres veces (dos a la vez): UN solo abono de 3 guías (saldo ${est2.d?.saldo?.guias})`, `abonos ${abonos.length}`);
    const dias2 = (new Date(est2.d?.guias_vencen_en ?? 0).getTime() - Date.now()) / 86400000;
    ok(Math.abs(dias2 - info.d.dias) < 0.01 && abonos[0]?.de_prueba === true, `las guías del paquete vencen a los ${info.d.dias} días de la compra (${dias2.toFixed(2)})`);
    const V1 = (await admin("GET", "resumen")).d;
    ok(cifras((await admin("GET", "paquetes")).d?.resumen) === cifras(R0) && V1?.compras?.pagadas_mes === V0.compras.pagadas_mes && V1.compras.ingresos_mes === V0.compras.ingresos_mes && V1.paquetes?.vendidos_mes === V0.paquetes?.vendidos_mes, "nada de esto cuenta como venta: las ventas y los ingresos del panel siguen igual");
    ok((await admin("POST", `compras/${compraId}/reenviar`, {})).st === 409, "un paquete no tiene link que reenviar");
  }

  titulo("8. Una guía que falla regresa sola al saldo");
  const crearGuia = async (jpg, etiqueta) => {
    const bo = await pedir("POST", "borrador", { grado: "6° primaria", materia: "Historia", paginas: [{ nombre: `${etiqueta}.jpg`, tipo: "image/jpeg", tamano: jpg.length }] });
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
  if (SIN_IA) aviso("guía con foto en blanco omitida (--sin-ia): la devolución automática queda probada solo sin internet (probar-saldo.ts)");
  else {
    const imagenes = await fotos(CON_GUIA ? [HOJA_EN_BLANCO, APUNTES] : [HOJA_EN_BLANCO]);
    if (!imagenes) aviso("no pude preparar las fotos de prueba (falta Edge): se omite la guía con foto en blanco");
    else {
      const antes = (await saldoDe(sesion)).guias;
      const g = await crearGuia(imagenes[0], "hoja-en-blanco");
      if (ok(g.st === 202 && g.d?.quedan === antes - 1, `crear una guía con saldo: se acepta y descuenta 1 (quedan ${g.d?.quedan})`, `HTTP ${g.st} ${g.d?.error ?? ""}`)) {
        const fin = await seguir(g.d.compra_id, 5);
        ok(fin.d?.estado === "devuelta" && fin.d.saldo?.guias === antes, `la foto no era material de estudio: la guía se devolvió sola al saldo (${fin.d?.saldo?.guias} de ${antes}) en ${seg()}`, `quedó «${fin.d?.estado}»`);
        const lista = (await pedir("GET", "cuenta", undefined, { sesion })).d?.guias ?? [];
        ok(lista.find((x) => x.id === g.d.compra_id)?.estado === "devuelta" && !lista.some((x) => x.link), "en «Mi cuenta» esa guía sale como devuelta y sin link");
      }
      if (CON_GUIA) {
        titulo("9. Una guía completa de verdad, hecha con saldo");
        const antes2 = (await saldoDe(sesion)).guias;
        const g2 = await crearGuia(imagenes[1], "apuntes");
        if (ok(g2.st === 202 && g2.d?.quedan === antes2 - 1, `se acepta y descuenta 1 (quedan ${g2.d?.quedan}); se genera completa, sin vista previa`, `HTTP ${g2.st} ${g2.d?.error ?? ""}`)) {
          const fin2 = await seguir(g2.d.compra_id, 20);
          ok(fin2.d?.estado === "lista" && /\/guia\.html#[A-Za-z0-9]{8,}$/.test(fin2.d.link ?? "") && fin2.d.saldo?.guias === antes2 - 1, `la guía «${fin2.d?.titulo ?? "?"}» quedó lista en ${seg()}, con su link de 7 días; el saldo queda en ${fin2.d?.saldo?.guias}`, `quedó «${fin2.d?.estado}»`);
          const fila = ((await admin("GET", "compras")).d ?? []).find((x) => x.id === g2.d.compra_id);
          const guia = fila?.guia_id ? (await admin("GET", "guias/" + fila.guia_id)).d : null;
          ok(fila?.cobro === "saldo" && fila.guia_lista === true && !!fila.entregada_en && guia?.completo === true && guia.estado === "publicada", `en el panel: compra sin cobro («saldo»), guía completa (${guia?.bloques ?? "?"} bloques, ${guia?.actividades ?? "?"} actividades), entregada`);
          const costo = Number(guia?.costo_mxn ?? NaN);
          // El tope de producción es de 5 pesos por guía y el de las pruebas, 15. El costo depende del generador de
          // siempre (pipeline.ts), no del paquete: si pasa de 5 es un aviso para la sesión de IA, no una falla de esto.
          const caro = (guia?.reporte?.metricas ?? []).slice().sort((x, y) => (Number(y?.costo_usd) || 0) - (Number(x?.costo_usd) || 0))[0];
          const elCaro = caro?.paso ? ` (el paso más caro fue «${caro.paso}»)` : "";
          if (!Number.isFinite(costo)) aviso("no pude leer el costo de IA de la guía");
          else if (costo <= 5) ok(true, `costo de IA de esa guía: $${costo.toFixed(2)} MXN (tope de producción: 5)`);
          else if (costo <= 15) aviso(`esa guía costó $${costo.toFixed(2)} MXN de IA: pasa del tope de 5 por guía${elCaro}. Es el generador de siempre, no el paquete: hay que avisarle a la sesión de IA`);
          else ok(false, `costo de IA de esa guía: $${costo.toFixed(2)} MXN (el tope de las pruebas es 15)${elCaro}`);
          if (guia?.id) console.log(CONSERVAR ? `      para verla en el reproductor:  node herramientas/probar-guia.mjs ${guia.id}` : "      (para verla en el reproductor, repite con --guia --conservar)");
        }
      }
    }
  }

  titulo("Privacidad");
  const panel = JSON.stringify((await admin("GET", "paquetes")).d ?? {}) + JSON.stringify(await cuentaAdmin());
  ok(!panel.includes(NUMERO) && !panel.includes("prueba@sparked.invalid") && panel.includes("••• ••• " + ULTIMOS), "en el panel el WhatsApp y el correo salen enmascarados, nunca completos");
} catch (e) {
  fallas++; console.log("FALLA la prueba se detuvo: " + (e?.message ?? e));
} finally {
  titulo("Limpieza");
  if (CONSERVAR) aviso("la cuenta de prueba NO se borró (--conservar). Cuando termines, bórrala con:  node probar-paquete.mjs --limpiar");
  else {
    let quedan = [];
    for (let i = 0; i < 2; i++) { for (const c of await cuentasDePrueba()) await borrarCuenta(c.id); quedan = await cuentasDePrueba(); if (!quedan.length) break; await espera(2000); }
    ok(quedan.length === 0, "la cuenta de prueba se borró con todo lo que creó (compras, guías, accesos, movimientos y códigos)", `${quedan.length} sin borrar`);
    if (cifrasAntes) {
      const R1 = (await admin("GET", "paquetes")).d?.resumen, V1 = (await admin("GET", "resumen")).d;
      ok(cifras(R1) === cifras(cifrasAntes.R0) && cifras(V1?.compras) === cifras(cifrasAntes.V0.compras) && cifras(V1?.paquetes) === cifras(cifrasAntes.V0.paquetes), "las cifras del panel (ventas, ingresos, paquetes y saldos) quedaron idénticas a las de antes de la prueba", "si una familia compró algo durante la prueba es normal que cambien: revísalo en el panel");
    }
  }
}
console.log(`\n${fallas ? "CON FALLAS" : "TODO BIEN"}: ${bien} de ${bien + fallas} comprobaciones bien${avisos ? ` · ${avisos} aviso(s)` : ""} · ${seg()}.`);
process.exit(fallas ? 1 : 0);
